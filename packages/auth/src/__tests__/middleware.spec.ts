import { describe, it, expect } from 'bun:test';
import { Hono, type Context } from 'hono';
import { createAuthMiddleware } from '../middleware.js';
import { SessionProvider } from '../session.js';
import { KANJI_CTX } from '@kanjijs/platform-hono';

describe('Auth Middleware', () => {
  const sessionProvider = new SessionProvider({
    jwtSecret: 'middleware-test-secret',
  });

  const mockSession = {
    userId: 'user-777',
    email: 'mid@test.com',
    name: 'Middleware User',
    roles: ['moderator'],
    scopes: [],
  };

  it('should authenticate user and set details in Hono context when valid Bearer token is provided', async () => {
    const token = sessionProvider.createToken(mockSession, 300);
    const app = new Hono();

    app.use('*', createAuthMiddleware(sessionProvider));
    
    let ctxUser: { id: string; email: string; name: string; roles: string[] } | null = null;
    app.get('/me', (c) => {
      ctxUser = c.get(KANJI_CTX.AUTH_USER);
      return c.text('OK');
    });

    const response = await app.request('/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(response.status).toBe(200);
    expect(ctxUser).not.toBeNull();
    expect(ctxUser.id).toBe('user-777');
    expect(ctxUser.email).toBe('mid@test.com');
  });

  it('should continue middleware chain but not authenticate when header is missing', async () => {
    const app = new Hono();
    app.use('*', createAuthMiddleware(sessionProvider));
    
    let ctxUser: { id: string; email: string; name: string; roles: string[] } | undefined;
    app.get('/me', (c) => {
      ctxUser = c.get(KANJI_CTX.AUTH_USER);
      return c.text('OK');
    });

    const response = await app.request('/me');

    expect(response.status).toBe(200);
    expect(ctxUser).toBeUndefined();
  });
});
