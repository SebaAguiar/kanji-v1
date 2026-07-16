import 'reflect-metadata';

export const OPENAPI_SUMMARY_KEY = 'kanji:openapi:summary';
export const OPENAPI_DESCRIPTION_KEY = 'kanji:openapi:description';
export const OPENAPI_TAGS_KEY = 'kanji:openapi:tags';
export const OPENAPI_SECURITY_KEY = 'kanji:openapi:security';
export const OPENAPI_DEPRECATED_KEY = 'kanji:openapi:deprecated';
export const OPENAPI_OPERATIONID_KEY = 'kanji:openapi:operationId';

export function Summary(summary: string): MethodDecorator {
  return (target: object, propertyKey: string | symbol): void => {
    Reflect.defineMetadata(OPENAPI_SUMMARY_KEY, summary, target, propertyKey);
  };
}

export function Description(description: string): MethodDecorator {
  return (target: object, propertyKey: string | symbol): void => {
    Reflect.defineMetadata(OPENAPI_DESCRIPTION_KEY, description, target, propertyKey);
  };
}

export function Tag(...tags: string[]): MethodDecorator {
  return (target: object, propertyKey: string | symbol): void => {
    Reflect.defineMetadata(OPENAPI_TAGS_KEY, tags, target, propertyKey);
  };
}

export function BearerAuth(): MethodDecorator {
  return (target: object, propertyKey: string | symbol): void => {
    const existing = Reflect.getMetadata(OPENAPI_SECURITY_KEY, target, propertyKey) || [];
    Reflect.defineMetadata(
      OPENAPI_SECURITY_KEY,
      [...existing, { bearerAuth: [] }],
      target,
      propertyKey,
    );
  };
}

export function ApiKey(name: string, location: 'query' | 'header' | 'cookie'): MethodDecorator {
  return (target: object, propertyKey: string | symbol): void => {
    const existing = Reflect.getMetadata(OPENAPI_SECURITY_KEY, target, propertyKey) || [];
    Reflect.defineMetadata(
      OPENAPI_SECURITY_KEY,
      [...existing, { apiKey: [] }],
      target,
      propertyKey,
    );
    Reflect.defineMetadata(
      'kanji:openapi:security:apikey',
      { name, in: location },
      target,
      propertyKey,
    );
  };
}

export function OAuth2(scopes: string[]): MethodDecorator {
  return (target: object, propertyKey: string | symbol): void => {
    const existing = Reflect.getMetadata(OPENAPI_SECURITY_KEY, target, propertyKey) || [];
    Reflect.defineMetadata(
      OPENAPI_SECURITY_KEY,
      [...existing, { oauth2: scopes }],
      target,
      propertyKey,
    );
  };
}

export function Deprecated(): MethodDecorator {
  return (target: object, propertyKey: string | symbol): void => {
    Reflect.defineMetadata(OPENAPI_DEPRECATED_KEY, true, target, propertyKey);
  };
}

export function OperationId(id: string): MethodDecorator {
  return (target: object, propertyKey: string | symbol): void => {
    Reflect.defineMetadata(OPENAPI_OPERATIONID_KEY, id, target, propertyKey);
  };
}
