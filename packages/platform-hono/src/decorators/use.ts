import type { MiddlewareHandler } from 'hono';
import { HttpMetadataStorage } from '../http-metadata-storage.js';

export function Use(...middlewares: MiddlewareHandler[]): MethodDecorator {
  return (target: object, propertyKey?: string | symbol) => {
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
