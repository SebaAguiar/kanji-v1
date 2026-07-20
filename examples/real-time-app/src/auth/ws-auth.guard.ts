import type { MiddlewareHandler } from 'hono';
import { KANJI_CTX } from '@kanjijs/platform-hono';
import jwt from 'jsonwebtoken';

interface WsSession {
  userId: string;
  email: string;
  name: string;
  roles: string[];
  scopes: string[];
  expiresAt: number;
}

/**
 * Middleware that authenticates WebSocket upgrade requests via a token query parameter.
 *
 * Clients connect as: ws://host/chat?token=<jwt>
 *
 * The JWT must be signed with the same secret as the app's AuthModule.
 */
export function createWsAuthGuard(jwtSecret: string): MiddlewareHandler {
  return async (c, next) => {
    const token = c.req.query('token');

    if (token) {
      try {
        const decoded = jwt.verify(token, jwtSecret) as WsSession;
        if (decoded && decoded.userId && decoded.expiresAt > Math.floor(Date.now() / 1000)) {
          c.set(KANJI_CTX.AUTH_USER as string, {
            id: decoded.userId,
            email: decoded.email,
            name: decoded.name,
            roles: decoded.roles,
          });
          c.set(KANJI_CTX.AUTH_SESSION as string, decoded);
          c.set(KANJI_CTX.AUTH_ROLES as string, decoded.roles);
          c.set(KANJI_CTX.AUTH_PRINCIPAL as string, decoded);
          c.set(KANJI_CTX.AUTH_SCOPES as string, decoded.scopes);
          await next();
          return;
        }
      } catch {
        // Invalid token — fall through to 401
      }
    }

    c.status(401);
    return c.json({ error: 'Unauthorized', message: 'Missing or invalid token' }, 401);
  };
}
