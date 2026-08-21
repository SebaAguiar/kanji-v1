import type { ClassConstructor } from '@kanjijs/common';
import { HttpMetadataStorage } from '../http-metadata-storage.js';

export function Controller(path: string = ''): (target: ClassConstructor) => void {
  return (target) => {
    HttpMetadataStorage.getInstance().registerController(target, path);
  };
}
