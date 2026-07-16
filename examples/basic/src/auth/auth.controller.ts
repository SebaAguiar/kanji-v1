import { Controller, Post } from '@kanjijs/platform-hono';
import { Inject } from '@kanjijs/core';
import { SESSION_PROVIDER, SessionProvider } from '@kanjijs/auth';
import { OperationId } from '@kanjijs/openapi';
import type { Context } from 'hono';

@Controller('/auth')
export class AuthController {
  constructor(
    @Inject(SESSION_PROVIDER)
    private readonly session: SessionProvider,
  ) {}

  @Post('/login')
  @OperationId('loginSession')
  async login(c: Context): Promise<Response> {
    const body = await c.req.json().catch(() => ({}));
    const email = body.email || 'guest@kanjijs.com';
    const name = body.name || 'Guest User';

    // Generate a signed token for testing valid for 1 hour (3600 seconds)
    const token = this.session.createToken(
      {
        userId: 'usr-' + Math.random().toString(36).substring(7),
        email,
        name,
        roles: ['user'],
        scopes: ['read', 'write'],
      },
      3600,
    );

    return c.json({ token }, 200);
  }

  @Post('/refresh')
  @OperationId('refreshSession')
  async refresh(c: Context): Promise<Response> {
    const body = await c.req.json().catch(() => ({}));
    const token = body.token;
    if (!token) {
      return c.json({ error: 'Bad Request', message: 'Missing token parameter' }, 400);
    }
    const refreshed = this.session.refreshToken(token, 3600);
    if (!refreshed) {
      return c.json({ error: 'Unauthorized', message: 'Invalid or expired token' }, 401);
    }
    return c.json({ token: refreshed }, 200);
  }
}
