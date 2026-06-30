import { HttpMetadataStorage, HttpMethod } from '../http-metadata-storage';

function createRouteDecorator(method: HttpMethod) {
  return (path: string = ''): MethodDecorator => {
    return (target: object, propertyKey: string | symbol) => {
      HttpMetadataStorage.getInstance().registerRoute(target.constructor, {
        propertyKey,
        method,
        path,
      });
    };
  };
}

export const Get = createRouteDecorator('get');
export const Post = createRouteDecorator('post');
export const Put = createRouteDecorator('put');
export const Delete = createRouteDecorator('delete');
export const Patch = createRouteDecorator('patch');
