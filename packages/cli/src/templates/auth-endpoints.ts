import { AuthProvider } from '../types.js';

export function getAuthModuleTemplate(
  providers: AuthProvider[],
): { module: string; controller: string } {
  const imports = `import { Controller, Post, Get } from '@kanjijs/platform-hono';
import { type Context } from 'hono';
`;

  let controllerBody = '';

  if (providers.includes('jwt') || providers.length === 0) {
    controllerBody += `  @Post('/login')
  async login(c: Context): Promise<Response> {
    const { email, password } = await c.req.json();
    
    // TODO: Implement credential verification and JWT issuance
    // Example: validate against database, use SessionProvider.createToken()
    return c.json({ error: 'Not implemented: replace with real credential verification' }, 501);
  }

  @Post('/refresh')
  async refresh(c: Context): Promise<Response> {
    const { refreshToken } = await c.req.json();
    // TODO: Verify refresh token and issue new access token
    return c.json({
      accessToken: 'new-mock-access-token',
    }, 200);
  }
`;
  }

  for (const provider of providers) {
    if (provider !== 'jwt') {
      const capProvider = provider.charAt(0).toUpperCase() + provider.slice(1);
      controllerBody += `
  @Get('/${provider}')
  async ${provider}Login(c: Context): Promise<Response> {
    // TODO: Redirect to ${capProvider} OAuth authorization endpoint
    return c.redirect('https://example.com/oauth/authorize');
  }

  @Get('/${provider}/callback')
  async ${provider}Callback(c: Context): Promise<Response> {
    // TODO: Handle OAuth callback, retrieve token and profile
    return c.json({
      accessToken: 'mock-oauth-access-token',
      user: { email: 'oauth-user@kanji.dev', provider: '${provider}' }
    }, 200);
  }
`;
    }
  }

  const controller = `${imports}
@Controller('/auth')
export class AuthController {
${controllerBody}}
`;

  const module = `import { KanjijsModule } from '@kanjijs/core';
import { AuthController } from './auth.controller.js';

@KanjijsModule({
  controllers: [AuthController],
})
export class AuthModule {}
`;

  return { module, controller };
}
