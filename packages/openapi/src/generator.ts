import 'reflect-metadata';
import { type ZodTypeAny } from 'zod';
import { HttpMetadataStorage } from '@kanjijs/platform-hono';
import { parseZodSchema } from './zod-parser.js';
import {
  OPENAPI_SUMMARY_KEY,
  OPENAPI_DESCRIPTION_KEY,
  OPENAPI_TAGS_KEY,
} from './decorators.js';
import type {
  OpenApiDocument,
  OpenApiPathItem,
  OpenApiOperation,
  OpenApiParameter,
  OpenApiRequestBody,
  OpenApiResponse,
  OpenApiConfig,
} from './types.js';
import { writeFile } from 'fs/promises';

interface ContractShape {
  _def?: { shape?: () => Record<string, ZodTypeAny>; typeName?: string };
  isOptional?: () => boolean;
}

function isContractShape(value: ZodTypeAny): value is ZodTypeAny & ContractShape {
  return typeof value === 'object' && value !== null && '_def' in value;
}

export class OpenApiGenerator {
  private readonly config: OpenApiConfig;

  constructor(config: OpenApiConfig) {
    this.config = config;
  }

  public generateSpec(): OpenApiDocument {
    const httpMetadata = HttpMetadataStorage.getInstance();
    const doc: OpenApiDocument = {
      openapi: '3.0.0',
      info: {
        title: this.config.title,
        version: this.config.version,
        description: this.config.description,
      },
      paths: {},
    };

    for (const [controller, controllerPath] of httpMetadata.controllers.entries()) {
      const routes = httpMetadata.routes.get(controller) || [];

      for (const route of routes) {
        const contract = Reflect.getMetadata('kanji:contract', controller.prototype, route.propertyKey);

        const fullPath = `${controllerPath}${route.path}`.replace(/\/+/g, '/');
        const cleanedPath = fullPath.endsWith('/') && fullPath !== '/' ? fullPath.slice(0, -1) : fullPath;
        const openApiPath = this.formatOpenApiPath(cleanedPath);

        if (!doc.paths[openApiPath]) {
          doc.paths[openApiPath] = {};
        }

        const decoratorSummary = Reflect.getMetadata(OPENAPI_SUMMARY_KEY, controller.prototype, route.propertyKey);
        const decoratorDescription = Reflect.getMetadata(OPENAPI_DESCRIPTION_KEY, controller.prototype, route.propertyKey);
        const decoratorTags = Reflect.getMetadata(OPENAPI_TAGS_KEY, controller.prototype, route.propertyKey);

        const operation: OpenApiOperation = {
          summary: decoratorSummary ?? `${route.propertyKey.toString()} endpoint`,
          description: decoratorDescription,
          tags: decoratorTags ?? [controller.name.replace(/Controller$/, '')],
          responses: {},
        };

        if (contract) {
          const requestBodySchema = contract.body || contract.request?.body;
          const querySchema = contract.query || contract.request?.query;
          const paramsSchema = contract.params || contract.request?.params;
          const headersSchema = contract.headers || contract.request?.headers;

          const parameters: OpenApiParameter[] = [];

          if (paramsSchema && isContractShape(paramsSchema) && paramsSchema._def?.shape) {
            const shape = paramsSchema._def.shape() as Record<string, ZodTypeAny>;
            for (const [key, value] of Object.entries(shape)) {
              parameters.push({
                name: key,
                in: 'path',
                required: true,
                schema: parseZodSchema(value),
              });
            }
          } else {
            const pathParams = openApiPath.match(/\{([a-zA-Z0-9_]+)\}/g);
            if (pathParams) {
              for (const p of pathParams) {
                const paramName = p.slice(1, -1);
                parameters.push({
                  name: paramName,
                  in: 'path',
                  required: true,
                  schema: { type: 'string' },
                });
              }
            }
          }

          if (querySchema && isContractShape(querySchema) && querySchema._def?.shape) {
            const shape = querySchema._def.shape() as Record<string, ZodTypeAny>;
            for (const [key, value] of Object.entries(shape)) {
              parameters.push({
                name: key,
                in: 'query',
                required: value._def?.typeName !== 'ZodOptional',
                schema: parseZodSchema(value),
              });
            }
          }

          if (headersSchema && isContractShape(headersSchema) && headersSchema._def?.shape) {
            const shape = headersSchema._def.shape() as Record<string, ZodTypeAny>;
            for (const [key, value] of Object.entries(shape)) {
              parameters.push({
                name: key,
                in: 'header',
                required: value._def?.typeName !== 'ZodOptional',
                schema: parseZodSchema(value),
              });
            }
          }

          if (parameters.length > 0) {
            operation.parameters = parameters;
          }

          if (requestBodySchema) {
            const requestBody: OpenApiRequestBody = {
              required: true,
              content: {
                'application/json': {
                  schema: parseZodSchema(requestBodySchema),
                },
              },
            };
            operation.requestBody = requestBody;
          }

          if (contract.responses) {
            for (const [statusCode, schema] of Object.entries(contract.responses)) {
              const res: OpenApiResponse = {
                description: `Response status ${statusCode}`,
                content: {
                  'application/json': {
                    schema: parseZodSchema(schema as ZodTypeAny),
                  },
                },
              };
              operation.responses[statusCode] = res;
            }
          }
        }

        if (Object.keys(operation.responses).length === 0) {
          const defaultStatus = route.method.toLowerCase() === 'post' ? '201' : '200';
          operation.responses[defaultStatus] = {
            description: 'Successful operation',
          };
        }

        const methodKey = route.method.toLowerCase() as keyof OpenApiPathItem;
        doc.paths[openApiPath][methodKey] = operation;
      }
    }

    return doc;
  }

  public async generateToFile(outputPath: string): Promise<void> {
    const spec = this.generateSpec();
    await writeFile(outputPath, JSON.stringify(spec, null, 2), 'utf-8');
  }

  private formatOpenApiPath(path: string): string {
    return path.replace(/:([a-zA-Z0-9_]+)/g, '{$1}');
  }
}
