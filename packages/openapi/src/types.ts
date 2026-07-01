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
  description?: string;
  nullable?: boolean;
  anyOf?: OpenApiSchema[];
  oneOf?: OpenApiSchema[];
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

export interface OpenApiOperation {
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: OpenApiParameter[];
  requestBody?: OpenApiRequestBody;
  responses: Record<string, OpenApiResponse>;
  tags?: string[];
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
  securitySchemes?: Record<string, Record<string, unknown>>;
}

export interface OpenApiDocument {
  openapi: string;
  info: OpenApiInfo;
  paths: OpenApiPaths;
  components?: OpenApiComponents;
}
