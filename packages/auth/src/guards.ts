import type { Context, Next, MiddlewareHandler } from 'hono';
import { KANJI_CTX, HttpMetadataStorage } from '@kanjijs/platform-hono';


export const AuthGuard: MiddlewareHandler = async (c: Context, next: Next): Promise<Response | void> => {
  const user = c.get(KANJI_CTX.AUTH_USER as string);
  if (!user) {
    return c.json({ error: 'Unauthorized', message: 'Missing or invalid authentication session' }, 401);
  }
  await next();
};

export function UseGuards(...guards: MiddlewareHandler[]): (target: object | Function, propertyKey?: string | symbol) => void {
  return (target: object | Function, propertyKey?: string | symbol): void => {
    if (propertyKey) {
      HttpMetadataStorage.getInstance().registerRouteMiddleware(
        target.constructor,
        propertyKey,
        guards,
      );
    } else {
      HttpMetadataStorage.getInstance().registerControllerMiddleware(
        target as Function,
        guards,
      );
    }
  };
}
