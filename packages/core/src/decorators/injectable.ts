import { MetadataStorage } from '../metadata-storage.js';
import type { Constructor } from '../types.js';

export function Injectable(): ClassDecorator {
  return (target: object) => {
    const constructor = target as Constructor<object>;
    MetadataStorage.getInstance().registerInjectable(constructor);
  };
}
