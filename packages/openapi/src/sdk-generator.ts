import type {
  OpenApiDocument,
  OpenApiSchema,
  OpenApiOperation,
  OpenApiParameter,
} from './types.js';
import { writeFile } from 'fs/promises';

export class SdkGenerator {
  public generateSdk(doc: OpenApiDocument): string {
    const interfaces: string[] = [];
    const methods: string[] = [];

    // Helper: Mapear OpenApiSchema a tipo TS
    const schemaToTs = (schema?: OpenApiSchema): string => {
      if (!schema) return 'unknown';

      if (schema.allOf) {
        return schema.allOf.map((s) => schemaToTs(s)).join(' & ');
      }
      if (schema.anyOf) {
        return schema.anyOf.map((s) => schemaToTs(s)).join(' | ');
      }
      if (schema.oneOf) {
        return schema.oneOf.map((s) => schemaToTs(s)).join(' | ');
      }

      let typeStr = 'unknown';
      switch (schema.type) {
        case 'string':
          if (schema.enum) {
            typeStr = schema.enum.map((e) => `'${e}'`).join(' | ');
          } else {
            typeStr = 'string';
          }
          break;
        case 'number':
        case 'integer':
          typeStr = 'number';
          break;
        case 'boolean':
          typeStr = 'boolean';
          break;
        case 'array':
          if (schema.prefixItems) {
            typeStr = `[${schema.prefixItems.map((s) => schemaToTs(s)).join(', ')}]`;
          } else {
            typeStr = `${schemaToTs(schema.items)}[]`;
          }
          break;
        case 'object':
          if (schema.properties) {
            const props = Object.entries(schema.properties).map(([key, prop]) => {
              const isRequired = schema.required?.includes(key);
              const jsdoc: string[] = [];
              if (prop.format === 'date-time') {
                jsdoc.push('  /** @format date-time */\n');
              }
              if (prop.description) {
                jsdoc.push(`  /** ${prop.description} */\n`);
              }
              return `${jsdoc.join('')}  ${key}${isRequired ? '' : '?'}: ${schemaToTs(prop)};`;
            });

            let propStr = `{\n${props.join('\n')}\n}`;
            if (schema.additionalProperties) {
              const addPropsType =
                schema.additionalProperties === true
                  ? 'unknown'
                  : schemaToTs(schema.additionalProperties);
              propStr = `(${propStr} & Record<string, ${addPropsType}>)`;
            }
            typeStr = propStr;
          } else if (schema.additionalProperties) {
            const addPropsType =
              schema.additionalProperties === true
                ? 'unknown'
                : schemaToTs(schema.additionalProperties);
            typeStr = `Record<string, ${addPropsType}>`;
          } else {
            typeStr = 'Record<string, unknown>';
          }
          break;
      }

      if (schema.nullable) {
        typeStr = `(${typeStr} | null)`;
      }

      return typeStr;
    };

    // Helper: Nombre único de operación
    const getOperationName = (method: string, path: string): string => {
      const cleanedPath = path.replace(/\.[a-zA-Z0-9]+$/, '');
      const parts = cleanedPath.split('/').filter(Boolean);
      const cleanParts = parts.map((p) => {
        if (p.startsWith('{') && p.endsWith('}')) {
          return 'By' + p.slice(1, -1).charAt(0).toUpperCase() + p.slice(2, -1);
        }
        const subParts = p.split(/[^a-zA-Z0-9]/).filter(Boolean);
        return subParts.map((sp) => sp.charAt(0).toUpperCase() + sp.slice(1)).join('');
      });
      return `${method.toLowerCase()}${cleanParts.join('')}`;
    };

    // Recorrer las rutas
    for (const [path, pathItem] of Object.entries(doc.paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (!operation) continue;
        const op = operation as OpenApiOperation;

        const opName = getOperationName(method, path);
        const opCapitalized = opName.charAt(0).toUpperCase() + opName.slice(1);

        // 1. Interfaces de Entrada (Body, Query, Params)
        let bodyType = 'undefined';
        if (op.requestBody?.content?.['application/json']?.schema) {
          const bodyInterfaceName = `${opCapitalized}Body`;
          const bodySchema = op.requestBody.content['application/json'].schema;
          if (bodySchema.type === 'array') {
            interfaces.push(`export type ${bodyInterfaceName} = ${schemaToTs(bodySchema)};`);
          } else {
            interfaces.push(`export interface ${bodyInterfaceName} ${schemaToTs(bodySchema)}`);
          }
          bodyType = bodyInterfaceName;
        }

        let queryType = 'undefined';
        const queryParams = op.parameters?.filter((p: OpenApiParameter) => p.in === 'query') || [];
        if (queryParams.length > 0) {
          const queryInterfaceName = `${opCapitalized}Query`;
          const props = queryParams.map((p: OpenApiParameter) => {
            const isRequired = p.required;
            const jsdoc: string[] = [];
            if (p.schema?.format === 'date-time') {
              jsdoc.push('  /** @format date-time */\n');
            }
            if (p.description) {
              jsdoc.push(`  /** ${p.description} */\n`);
            }
            return `${jsdoc.join('')}  ${p.name}${isRequired ? '' : '?'}: ${schemaToTs(p.schema)};`;
          });
          interfaces.push(`export interface ${queryInterfaceName} {\n${props.join('\n')}\n}`);
          queryType = queryInterfaceName;
        }

        // Determinar path params
        const pathParams = op.parameters?.filter((p: OpenApiParameter) => p.in === 'path') || [];

        // 2. Interfaces de Respuesta
        let successResponseInterface = 'unknown';
        const successStatuses = Object.keys(op.responses).filter((s) => s.startsWith('2'));
        if (successStatuses.length > 0) {
          const status = successStatuses[0];
          const resp = op.responses[status];
          if (resp.content?.['application/json']?.schema) {
            const respInterfaceName = `${opCapitalized}Response`;
            const respSchema = resp.content['application/json'].schema;
            if (respSchema.type === 'array') {
              interfaces.push(`export type ${respInterfaceName} = ${schemaToTs(respSchema)};`);
            } else {
              interfaces.push(`export interface ${respInterfaceName} ${schemaToTs(respSchema)}`);
            }
            successResponseInterface = respInterfaceName;
          } else {
            successResponseInterface = 'null';
          }
        }

        // 3. Firma del Método
        const methodArgs: string[] = [];
        pathParams.forEach((p: OpenApiParameter) => {
          methodArgs.push(`${p.name}: string`);
        });

        if (bodyType !== 'undefined') {
          methodArgs.push(`body: ${bodyType}`);
        }

        if (queryType !== 'undefined') {
          methodArgs.push(`query?: ${queryType}`);
        }

        methodArgs.push(`options?: { headers?: Record<string, string> }`);

        // Format URL path with template strings for path parameters
        let jsPath = path.replace(/\{([a-zA-Z0-9_]+)\}/g, '${$1}');

        const methodLines: string[] = [];
        if (op.deprecated) {
          methodLines.push('  /**');
          methodLines.push(
            '   * @deprecated This endpoint is deprecated and may be removed in future versions.',
          );
          methodLines.push('   */');
        }
        methodLines.push(
          `  async ${opName}(${methodArgs.join(', ')}): Promise<${successResponseInterface}> {`,
        );

        const reqOpts: string[] = [];
        if (bodyType !== 'undefined') reqOpts.push('body');
        if (queryType !== 'undefined') reqOpts.push('query');
        reqOpts.push('headers: options?.headers');

        methodLines.push(
          `    return this.request<${successResponseInterface}>('${method.toUpperCase()}', \`${jsPath}\`, {`,
        );
        if (reqOpts.length > 0) {
          methodLines.push(`      ${reqOpts.join(',\n      ')}`);
        }
        methodLines.push('    });');
        methodLines.push('  }');

        methods.push(methodLines.join('\n'));
      }
    }

    return `/**
 * Auto-generated Client SDK for Kanji API
 * Generated at: ${new Date().toISOString()}
 */

export interface APIClientOptions {
  baseUrl: string;
  headers?: Record<string, string>;
}

${interfaces.join('\n\n')}

export class APIClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor(options: APIClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\\/$/, '');
    this.defaultHeaders = options.headers || {};
  }

  private async request<T>(
    method: string,
    path: string,
    options: {
      body?: unknown;
      query?: Record<string, unknown>;
      headers?: Record<string, string>;
    } = {}
  ): Promise<T> {
    const url = new URL(this.baseUrl + path);
    if (options.query) {
      for (const [key, val] of Object.entries(options.query)) {
        if (val !== undefined && val !== null) {
          url.searchParams.append(key, String(val));
        }
      }
    }

    const headers = {
      'Content-Type': 'application/json',
      ...this.defaultHeaders,
      ...options.headers,
    };

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(\`API Request failed with status \${response.status}: \${errorText}\`);
    }

    if (response.status === 204) {
      return null as unknown as T;
    }

    return response.json() as Promise<T>;
  }

${methods.join('\n\n')}
}
`;
  }

  public async generateToFile(doc: OpenApiDocument, outputPath: string): Promise<void> {
    const code = this.generateSdk(doc);
    await writeFile(outputPath, code, 'utf-8');
  }
}
