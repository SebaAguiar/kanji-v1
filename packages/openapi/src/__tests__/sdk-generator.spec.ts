import { describe, it, expect } from 'bun:test';
import { SdkGenerator } from '../sdk-generator.js';
import type { OpenApiDocument } from '../types.js';

describe('SdkGenerator', () => {
  const generator = new SdkGenerator();

  it('should generate client methods with type signatures for GET/POST paths', () => {
    const doc: OpenApiDocument = {
      openapi: '3.0.0',
      info: { title: 'Test', version: '1.0' },
      paths: {
        '/items': {
          get: {
            responses: {
              '200': {
                description: 'Success',
                content: {
                  'application/json': {
                    schema: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
          post: {
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                    },
                    required: ['name'],
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Success',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const sdkCode = generator.generateSdk(doc);

    expect(sdkCode).toContain('export class APIClient');
    expect(sdkCode).toContain('async getItems(');
    expect(sdkCode).toContain('async postItems(');
    expect(sdkCode).toContain('export interface PostItemsBody');
    expect(sdkCode).toContain('name: string;');
  });

  it('should generate intersection types for allOf schema keyword', () => {
    const doc: OpenApiDocument = {
      openapi: '3.0.0',
      info: { title: 'Test', version: '1.0' },
      paths: {
        '/mix': {
          get: {
            responses: {
              '200': {
                description: 'Success',
                content: {
                  'application/json': {
                    schema: {
                      allOf: [
                        { type: 'object', properties: { foo: { type: 'string' } } },
                        { type: 'object', properties: { bar: { type: 'number' } } },
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const sdkCode = generator.generateSdk(doc);
    expect(sdkCode).toContain('foo?: string;');
    expect(sdkCode).toContain('bar?: number;');
    expect(sdkCode).toContain('export interface GetMixResponse');
  });

  it('should generate union types for oneOf and anyOf schema keywords', () => {
    const doc: OpenApiDocument = {
      openapi: '3.0.0',
      info: { title: 'Test', version: '1.0' },
      paths: {
        '/union': {
          get: {
            responses: {
              '200': {
                description: 'Success',
                content: {
                  'application/json': {
                    schema: {
                      oneOf: [{ type: 'string' }, { type: 'number' }],
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const sdkCode = generator.generateSdk(doc);
    expect(sdkCode).toContain('export interface GetUnionResponse string | number');
  });

  it('should generate tuple type format [T1, T2] for prefixItems array schemas', () => {
    const doc: OpenApiDocument = {
      openapi: '3.0.0',
      info: { title: 'Test', version: '1.0' },
      paths: {
        '/tuple': {
          get: {
            responses: {
              '200': {
                description: 'Success',
                content: {
                  'application/json': {
                    schema: {
                      type: 'array',
                      prefixItems: [{ type: 'string' }, { type: 'number' }],
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const sdkCode = generator.generateSdk(doc);
    expect(sdkCode).toContain('export interface GetTupleResponse [string, number]');
  });

  it('should generate Record types when additionalProperties keyword is specified', () => {
    const doc: OpenApiDocument = {
      openapi: '3.0.0',
      info: { title: 'Test', version: '1.0' },
      paths: {
        '/map': {
          get: {
            responses: {
              '200': {
                description: 'Success',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      additionalProperties: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const sdkCode = generator.generateSdk(doc);
    expect(sdkCode).toContain('export interface GetMapResponse Record<string, string>');
  });

  it('should attach JSDoc comments to deprecated methods and datetime formats', () => {
    const doc: OpenApiDocument = {
      openapi: '3.0.0',
      info: { title: 'Test', version: '1.0' },
      paths: {
        '/deprecated-endpoint': {
          get: {
            deprecated: true,
            responses: {
              '200': {
                description: 'Success',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        created: {
                          type: 'string',
                          format: 'date-time',
                          description: 'Creation date',
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const sdkCode = generator.generateSdk(doc);
    expect(sdkCode).toContain('@deprecated This endpoint is deprecated');
    expect(sdkCode).toContain('@format date-time');
    expect(sdkCode).toContain('Creation date');
  });

  it('should wrap types in union with null when nullable is set to true', () => {
    const doc: OpenApiDocument = {
      openapi: '3.0.0',
      info: { title: 'Test', version: '1.0' },
      paths: {
        '/nullable': {
          get: {
            responses: {
              '200': {
                description: 'Success',
                content: {
                  'application/json': {
                    schema: {
                      type: 'string',
                      nullable: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const sdkCode = generator.generateSdk(doc);
    expect(sdkCode).toContain('export interface GetNullableResponse (string | null)');
  });

  it('should construct literal string union types for enums', () => {
    const doc: OpenApiDocument = {
      openapi: '3.0.0',
      info: { title: 'Test', version: '1.0' },
      paths: {
        '/status': {
          get: {
            responses: {
              '200': {
                description: 'Success',
                content: {
                  'application/json': {
                    schema: {
                      type: 'string',
                      enum: ['active', 'inactive', 'pending'],
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const sdkCode = generator.generateSdk(doc);
    expect(sdkCode).toContain("'active' | 'inactive' | 'pending'");
  });

  it('should declare methods to return Promise<null> for empty 204 responses', () => {
    const doc: OpenApiDocument = {
      openapi: '3.0.0',
      info: { title: 'Test', version: '1.0' },
      paths: {
        '/empty': {
          delete: {
            responses: {
              '204': {
                description: 'No content',
              },
            },
          },
        },
      },
    };

    const sdkCode = generator.generateSdk(doc);
    expect(sdkCode).toContain(
      'async deleteEmpty(options?: { headers?: Record<string, string> }): Promise<null>',
    );
    expect(sdkCode).toContain('return this.request<null>(');
  });
});
