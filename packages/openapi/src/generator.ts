import { HttpMetadataStorage } from '@kanjijs/platform-hono';
import { parseZodSchema } from './zod-parser.js';
import type { 
  OpenApiDocument, 
  OpenApiPathItem, 
  OpenApiOperation, 
  OpenApiParameter, 
  OpenApiRequestBody, 
  OpenApiResponse 
} from './types.js';
import { writeFile } from 'fs/promises';

export class OpenApiGenerator {
  public generateSpec(): OpenApiDocument {
    const httpMetadata = HttpMetadataStorage.getInstance();
    const doc: OpenApiDocument = {
      openapi: '3.0.0',
      info: {
        title: 'Kanji API',
        version: '1.0.0',
        description: 'Auto-generated API documentation by Kanji Framework',
      },
      paths: {},
    };

    // 1. Recorrer los controladores registrados
    for (const [controller, controllerPath] of httpMetadata.controllers.entries()) {
      const routes = httpMetadata.routes.get(controller) || [];

      for (const route of routes) {
        // Resolver el contrato guardado en los metadatos de la ruta
        const contract = Reflect.getMetadata('kanji:contract', controller.prototype, route.propertyKey);
        
        // Si no hay contrato, ignoramos o agregamos documentación básica sin schemas
        const fullPath = `${controllerPath}${route.path}`.replace(/\/+/g, '/');
        const cleanedPath = fullPath.endsWith('/') && fullPath !== '/' ? fullPath.slice(0, -1) : fullPath;
        const openApiPath = this.formatOpenApiPath(cleanedPath);

        if (!doc.paths[openApiPath]) {
          doc.paths[openApiPath] = {};
        }

        const operation: OpenApiOperation = {
          summary: `${route.propertyKey.toString()} endpoint`,
          tags: [controller.name.replace(/Controller$/, '')],
          responses: {},
        };

        if (contract) {
          // Extraer request body, params, query, headers de forma robusta (directa o anidada en request)
          const requestBodySchema = contract.body || contract.request?.body;
          const querySchema = contract.query || contract.request?.query;
          const paramsSchema = contract.params || contract.request?.params;
          const headersSchema = contract.headers || contract.request?.headers;

          const parameters: OpenApiParameter[] = [];

          // Path params
          if (paramsSchema && paramsSchema._def?.shape) {
            const shape = paramsSchema._def.shape();
            for (const [key, value] of Object.entries(shape)) {
              parameters.push({
                name: key,
                in: 'path',
                required: true,
                schema: parseZodSchema(value as any),
              });
            }
          } else {
            // Si el path de Hono tiene parámetros como :id pero no hay schema de params,
            // los agregamos de forma genérica como strings para cumplir con la especificación de OpenAPI
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

          // Query params
          if (querySchema && querySchema._def?.shape) {
            const shape = querySchema._def.shape();
            for (const [key, value] of Object.entries(shape)) {
              const val = value as any;
              parameters.push({
                name: key,
                in: 'query',
                required: !val.isOptional() && val._def.typeName !== 'ZodOptional',
                schema: parseZodSchema(val),
              });
            }
          }

          // Headers
          if (headersSchema && headersSchema._def?.shape) {
            const shape = headersSchema._def.shape();
            for (const [key, value] of Object.entries(shape)) {
              const val = value as any;
              parameters.push({
                name: key,
                in: 'header',
                required: !val.isOptional() && val._def.typeName !== 'ZodOptional',
                schema: parseZodSchema(val),
              });
            }
          }

          if (parameters.length > 0) {
            operation.parameters = parameters;
          }

          // Request Body
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

          // Responses
          if (contract.responses) {
            for (const [statusCode, schema] of Object.entries(contract.responses)) {
              const res: OpenApiResponse = {
                description: `Response status ${statusCode}`,
                content: {
                  'application/json': {
                    schema: parseZodSchema(schema as any),
                  },
                },
              };
              operation.responses[statusCode] = res;
            }
          }
        }

        // Si no se proveyeron respuestas en el contrato, documentamos una básica 200/201/204 por defecto
        if (Object.keys(operation.responses).length === 0) {
          const defaultStatus = route.method.toLowerCase() === 'post' ? '201' : '200';
          operation.responses[defaultStatus] = {
            description: 'Successful operation',
          };
        }

        const methodKey = route.method.toLowerCase() as keyof OpenApiPathItem;
        doc.paths[openApiPath][methodKey] = operation as any;
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
