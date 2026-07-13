import 'reflect-metadata';

export const OPENAPI_SUMMARY_KEY = 'kanji:openapi:summary';
export const OPENAPI_DESCRIPTION_KEY = 'kanji:openapi:description';
export const OPENAPI_TAGS_KEY = 'kanji:openapi:tags';

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
