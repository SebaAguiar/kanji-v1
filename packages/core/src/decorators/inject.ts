import { MetadataStorage } from '../metadata-storage.js';
import type { Token, Constructor } from '../types.js';

export function Inject(token: Token<object>): ParameterDecorator {
  return (target: object, _propertyKey: string | symbol | undefined, parameterIndex: number) => {
    const constructor = target as Constructor<object>;
    MetadataStorage.getInstance().registerCustomInjection(constructor, parameterIndex, token);
  };
}
