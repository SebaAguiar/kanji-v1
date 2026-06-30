import type { Context, Next, MiddlewareHandler } from 'hono';
import { KANJI_CTX } from '@kanjijs/platform-hono';
import type { SessionProvider } from './session.js';

export function createAuthMiddleware(sessionProvider: SessionProvider): MiddlewareHandler {
  return async (c: Context, next: Next): Promise<void> => {
    const authHeader = c.req.header('Authorization');
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : authHeader;

    if (token) {
      const session = sessionProvider.verifyToken(token);
      if (session) {
        c.set(KANJI_CTX.AUTH_USER as string, {
          id: session.userId,
          email: session.email,
          name: session.name,
        });
        c.set(KANJI_CTX.AUTH_SESSION as string, session);
        c.set(KANJI_CTX.AUTH_ROLES as string, session.roles);
        c.set(KANJI_CTX.AUTH_PRINCIPAL as string, session);
      }
    }

    await next();
  };
}
