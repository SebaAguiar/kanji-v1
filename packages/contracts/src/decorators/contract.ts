import 'reflect-metadata';
import type { KanjiContract } from '../types';

export function Contract(schema: KanjiContract): MethodDecorator {
  return (target: object, propertyKey: string | symbol) => {
    Reflect.defineMetadata("kanji:contract", schema, target, propertyKey);
  };
}
