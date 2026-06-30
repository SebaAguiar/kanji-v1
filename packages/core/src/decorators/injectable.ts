import { MetadataStorage } from '../metadata-storage';
import type { Constructor } from '../types';

export function Injectable(): ClassDecorator {
  return (target: object) => {
    const constructor = target as Constructor<object>;
    MetadataStorage.getInstance().registerInjectable(constructor);
  };
}
