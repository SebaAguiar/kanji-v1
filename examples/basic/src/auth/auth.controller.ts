import { Controller, Post } from '@kanjijs/platform-hono';
import { Inject } from '@kanjijs/core';
import { SESSION_PROVIDER, SessionProvider } from '@kanjijs/auth';
import type { Context } from 'hono';

@Controller('/auth')
export class AuthController {
  constructor(
    @Inject(SESSION_PROVIDER)
    private readonly session: SessionProvider
  ) {}

  @Post('/login')
  async login(c: Context): Promise<Response> {
    const body = await c.req.json().catch(() => ({}));
    const email = body.email || 'guest@kanjijs.com';
    const name = body.name || 'Guest User';

    // Generar un token firmado para pruebas con validez de 1 hora (3600 segundos)
    const token = this.session.createToken(
      {
        userId: 'usr-' + Math.random().toString(36).substring(7),
        email,
        name,
        roles: ['user'],
        scopes: ['read', 'write'],
      },
      3600
    );

    return c.json({ token }, 200);
  }
}
