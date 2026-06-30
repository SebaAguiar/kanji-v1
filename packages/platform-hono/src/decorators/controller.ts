import { HttpMetadataStorage } from '../http-metadata-storage';

export function Controller(path: string = ''): ClassDecorator {
  return (target: Function) => {
    HttpMetadataStorage.getInstance().registerController(target, path);
  };
}
