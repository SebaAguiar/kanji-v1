import 'reflect-metadata';

export function createParamDecorator(factory: (ctx: unknown) => unknown): ParameterDecorator {
  return (target: object, propertyKey: string | symbol | undefined, parameterIndex: number) => {
    if (propertyKey === undefined) return;

    const existingMetadata = Reflect.getMetadata('kanji:params', target, propertyKey as string | symbol) ?? [];
    existingMetadata.push({ index: parameterIndex, factory });
    Reflect.defineMetadata('kanji:params', existingMetadata, target, propertyKey as string | symbol);
  };
}

export function createPropertyDecorator(metakey: string, value: unknown): PropertyDecorator {
  return (target: object, propertyKey?: string | symbol) => {
    if (propertyKey === undefined) return;
    Reflect.defineMetadata(metakey, value, target, propertyKey);
  };
}

export function createMethodDecorator(
  factory: (...args: Array<unknown>) => PropertyDecorator,
): (...args: Array<unknown>) => MethodDecorator {
  return (...args: Array<unknown>) => {
    const propertyDecorator = factory(...args);
    return (target: object, propertyKey: string | symbol | undefined) => {
      if (propertyKey !== undefined) {
        propertyDecorator(target, propertyKey);
      }
    };
  };
}
