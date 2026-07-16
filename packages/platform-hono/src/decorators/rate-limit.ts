import 'reflect-metadata';

export interface RateLimitOptions {
  limit: number;
  window: string | number; // e.g., '1m', '5s', '1h', o milisegundos directamente
  by: 'ip' | 'user' | 'global';
}

/**
 * Decorador para aplicar rate limit a un endpoint de controlador HTTP.
 */
export function RateLimit(options: RateLimitOptions): MethodDecorator {
  return (target: object, propertyKey: string | symbol) => {
    Reflect.defineMetadata('kanji:rate-limit', options, target, propertyKey);
  };
}
