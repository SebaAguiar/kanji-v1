import 'reflect-metadata';

export function Contract(schema: any): MethodDecorator {
  return (target: object, propertyKey: string | symbol) => {
    Reflect.defineMetadata("kanji:contract", schema, target, propertyKey);
  };
}
