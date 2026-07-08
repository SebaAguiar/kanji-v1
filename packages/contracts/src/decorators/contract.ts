import 'reflect-metadata';
import type { KanjiContract } from '../types';
import { captureLocation } from '../validation';

export function Contract(schema: KanjiContract): MethodDecorator {
  return (target: object, propertyKey: string | symbol) => {
    Reflect.defineMetadata("kanji:contract", schema, target, propertyKey);

    const location = captureLocation();
    if (location) {
      Reflect.defineMetadata("kanji:location", location, target, propertyKey);
    }
  };
}

export function getRegisteredContractActions(controllerClass: Function): Set<string> {
  const prototype = controllerClass.prototype;
  const methods = Object.getOwnPropertyNames(prototype).filter(
    (name) => name !== 'constructor' && typeof prototype[name] === 'function'
  );
  return new Set(methods);
}
