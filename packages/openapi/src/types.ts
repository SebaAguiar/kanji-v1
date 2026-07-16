export interface OpenApiInfo {
  title: string;
  version: string;
  description?: string;
}

export interface OpenApiSchema {
  type?: string;
  properties?: Record<string, OpenApiSchema>;
  items?: OpenApiSchema;
  required?: string[];
  enum?: string[];
  format?: string;
  pattern?: string;
  description?: string;
  nullable?: boolean;
  anyOf?: OpenApiSchema[];
  oneOf?: OpenApiSchema[];
  additionalProperties?: OpenApiSchema | boolean;
  allOf?: OpenApiSchema[];
  prefixItems?: OpenApiSchema[];
  minItems?: number;
  maxItems?: number;
  example?: unknown;
}

export interface OpenApiParameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  required?: boolean;
  description?: string;
  schema?: OpenApiSchema;
}

export interface OpenApiRequestBody {
  description?: string;
  content: {
    'application/json'?: {
      schema: OpenApiSchema;
    };
  };
  required?: boolean;
}

export interface OpenApiResponse {
  description: string;
  content?: {
    'application/json'?: {
      schema: OpenApiSchema;
    };
  };
}

export type SecuritySchemeType = 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';

export interface OpenApiSecurityScheme {
  type: SecuritySchemeType;
  scheme?: string; // 'bearer', 'basic'
  bearerFormat?: string; // e.g. 'JWT'
  name?: string; // for apiKey
  in?: 'query' | 'header' | 'cookie'; // for apiKey
  flows?: Record<string, unknown>; // for oauth2
  description?: string;
}

export type OpenApiSecurityRequirement = Record<string, string[]>;

export interface OpenApiOperation {
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: OpenApiParameter[];
  requestBody?: OpenApiRequestBody;
  responses: Record<string, OpenApiResponse>;
  tags?: string[];
  deprecated?: boolean;
  security?: OpenApiSecurityRequirement[];
}

export interface OpenApiPathItem {
  get?: OpenApiOperation;
  post?: OpenApiOperation;
  put?: OpenApiOperation;
  delete?: OpenApiOperation;
  patch?: OpenApiOperation;
  options?: OpenApiOperation;
  head?: OpenApiOperation;
}

export type OpenApiPaths = Record<string, OpenApiPathItem>;

export interface OpenApiComponents {
  schemas?: Record<string, OpenApiSchema>;
  securitySchemes?: Record<string, OpenApiSecurityScheme>;
}

export interface OpenApiDocument {
  openapi: string;
  info: OpenApiInfo;
  paths: OpenApiPaths;
  components?: OpenApiComponents;
}

export interface OpenApiConfig {
  title: string;
  version: string;
  description?: string;
  specPath?: string;
  docsPath?: string;
}

export const OPENAPI_CONFIG = Symbol.for('kanji:openapi_config');
