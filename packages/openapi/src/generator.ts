import 'reflect-metadata';
import { type ZodTypeAny } from 'zod';
import { HttpMetadataStorage } from '@kanjijs/platform-hono';
import { parseZodSchema } from './zod-parser.js';
import {
  OPENAPI_SUMMARY_KEY,
  OPENAPI_DESCRIPTION_KEY,
  OPENAPI_TAGS_KEY,
  OPENAPI_SECURITY_KEY,
  OPENAPI_DEPRECATED_KEY,
  OPENAPI_OPERATIONID_KEY,
} from './decorators.js';
import type {
  OpenApiDocument,
  OpenApiPathItem,
  OpenApiOperation,
  OpenApiParameter,
  OpenApiRequestBody,
  OpenApiResponse,
  OpenApiConfig,
  OpenApiSecurityScheme,
} from './types.js';
import { writeFile } from 'fs/promises';

interface ContractShape {
  _def?: { shape?: () => Record<string, ZodTypeAny>; typeName?: string };
  isOptional?: () => boolean;
}

function isContractShape(value: ZodTypeAny): value is ZodTypeAny & ContractShape {
  return typeof value === 'object' && value !== null && '_def' in value;
}

function getStatusDescription(status: string): string {
  const map: Record<string, string> = {
    '200': 'OK',
    '201': 'Created',
    '202': 'Accepted',
    '204': 'No Content',
    '301': 'Moved Permanently',
    '302': 'Found',
    '400': 'Bad Request',
    '401': 'Unauthorized',
    '403': 'Forbidden',
    '404': 'Not Found',
    '409': 'Conflict',
    '422': 'Validation Error',
    '500': 'Internal Server Error',
  };
  return map[status] || `Response status ${status}`;
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

    const securitySchemes: Record<string, OpenApiSecurityScheme> = {};

    for (const [controller, controllerPath] of httpMetadata.controllers.entries()) {
      const routes = httpMetadata.routes.get(controller) || [];

      for (const route of routes) {
        const contract = Reflect.getMetadata(
          'kanji:contract',
          controller.prototype,
          route.propertyKey,
        );

        const fullPath = `${controllerPath}${route.path}`.replace(/\/+/g, '/');
        const cleanedPath =
          fullPath.endsWith('/') && fullPath !== '/' ? fullPath.slice(0, -1) : fullPath;
        const openApiPath = this.formatOpenApiPath(cleanedPath);

        if (!doc.paths[openApiPath]) {
          doc.paths[openApiPath] = {};
        }

        const decoratorSummary = Reflect.getMetadata(
          OPENAPI_SUMMARY_KEY,
          controller.prototype,
          route.propertyKey,
        );
        const decoratorDescription = Reflect.getMetadata(
          OPENAPI_DESCRIPTION_KEY,
          controller.prototype,
          route.propertyKey,
        );
        const decoratorTags = Reflect.getMetadata(
          OPENAPI_TAGS_KEY,
          controller.prototype,
          route.propertyKey,
        );
        const deprecated = Reflect.getMetadata(
          OPENAPI_DEPRECATED_KEY,
          controller.prototype,
          route.propertyKey,
        );
        const security = Reflect.getMetadata(
          OPENAPI_SECURITY_KEY,
          controller.prototype,
          route.propertyKey,
        );
        const explicitId = Reflect.getMetadata(
          OPENAPI_OPERATIONID_KEY,
          controller.prototype,
          route.propertyKey,
        );

        const operation: OpenApiOperation = {
          summary: decoratorSummary ?? `${route.propertyKey.toString()} endpoint`,
          description: decoratorDescription,
          tags: decoratorTags ?? [controller.name.replace(/Controller$/, '')],
          responses: {},
        };

        if (deprecated) {
          operation.deprecated = true;
        }

        if (explicitId) {
          operation.operationId = explicitId;
        } else {
          operation.operationId = `${route.propertyKey.toString()}${controller.name.replace(/Controller$/, '')}`;
        }

        if (security) {
          operation.security = security;
          for (const req of security) {
            for (const key of Object.keys(req)) {
              if (key === 'bearerAuth' && !securitySchemes.bearerAuth) {
                securitySchemes.bearerAuth = {
                  type: 'http',
                  scheme: 'bearer',
                  bearerFormat: 'JWT',
                };
              } else if (key === 'apiKey' && !securitySchemes.apiKey) {
                const meta = Reflect.getMetadata(
                  'kanji:openapi:security:apikey',
                  controller.prototype,
                  route.propertyKey,
                );
                securitySchemes.apiKey = {
                  type: 'apiKey',
                  name: meta?.name || 'api_key',
                  in: meta?.in || 'header',
                };
              } else if (key === 'oauth2' && !securitySchemes.oauth2) {
                securitySchemes.oauth2 = {
                  type: 'oauth2',
                  flows: {
                    implicit: {
                      authorizationUrl: 'https://example.com/oauth/authorize',
                      scopes: {},
                    },
                  },
                };
              }
            }
          }
        }

        const parameters: OpenApiParameter[] = [];

        // Always parse path parameters from the URL path first to ensure they are defined in OpenAPI
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

        if (contract) {
          const requestBodySchema = contract.body || contract.request?.body;
          const querySchema = contract.query || contract.request?.query;
          const paramsSchema = contract.params || contract.request?.params;
          const headersSchema = contract.headers || contract.request?.headers;

          if (paramsSchema && isContractShape(paramsSchema) && paramsSchema._def?.shape) {
            const shape = paramsSchema._def.shape() as Record<string, ZodTypeAny>;
            for (const [key, value] of Object.entries(shape)) {
              const idx = parameters.findIndex((p) => p.name === key && p.in === 'path');
              const paramObj: OpenApiParameter = {
                name: key,
                in: 'path',
                required: true,
                schema: parseZodSchema(value),
              };
              if (idx !== -1) {
                parameters[idx] = paramObj;
              } else {
                parameters.push(paramObj);
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
                description: getStatusDescription(statusCode),
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

        if (parameters.length > 0) {
          operation.parameters = parameters;
        }

        if (Object.keys(operation.responses).length === 0) {
          const defaultStatus = route.method.toLowerCase() === 'post' ? '201' : '200';
          operation.responses[defaultStatus] = {
            description: getStatusDescription(defaultStatus),
          };
        }

        const methodKey = route.method.toLowerCase() as keyof OpenApiPathItem;
        doc.paths[openApiPath][methodKey] = operation;
      }
    }

    if (Object.keys(securitySchemes).length > 0) {
      doc.components = {
        ...doc.components,
        securitySchemes,
      };
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
