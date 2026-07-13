import 'reflect-metadata';
import { HttpMetadataStorage, type HttpMethod } from '../http-metadata-storage';
import { captureLocation } from '@kanjijs/contracts';

function createRouteDecorator(method: HttpMethod) {
  return (path: string = ''): MethodDecorator => {
    return (target: object, propertyKey: string | symbol) => {
      Reflect.defineMetadata(
        'kanji:http:method',
        { method: method.toUpperCase(), path },
        target,
        propertyKey
      );

      const location = captureLocation();
      if (location) {
        Reflect.defineMetadata('kanji:location', location, target, propertyKey);
      }
      
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
export const Options = createRouteDecorator('options');
export const Head = createRouteDecorator('head');
