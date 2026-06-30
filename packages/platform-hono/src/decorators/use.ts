import type { MiddlewareHandler } from 'hono';
import { HttpMetadataStorage } from '../http-metadata-storage';

export function Use(...middlewares: MiddlewareHandler[]): any {
  return (target: object | Function, propertyKey?: string | symbol) => {
    if (propertyKey) {
      HttpMetadataStorage.getInstance().registerRouteMiddleware(
        target.constructor,
        propertyKey,
        middlewares,
      );
    } else {
      HttpMetadataStorage.getInstance().registerControllerMiddleware(
        target as Function,
        middlewares,
      );
    }
  };
}
