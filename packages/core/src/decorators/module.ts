import { MetadataStorage } from '../metadata-storage';
import type { ModuleMetadata, Constructor } from '../types';

export function KanjijsModule(metadata: ModuleMetadata): ClassDecorator {
  return (target: object) => {
    const constructor = target as Constructor<object>;
    MetadataStorage.getInstance().registerModule(constructor, metadata);
  };
}
