import type { Context } from 'hono';
import { Controller, Get, Use } from '@kanjijs/platform-hono';
import { Inject, Injectable } from '@kanjijs/core';
import {
  SESSION_PROVIDER,
  AUTH_CONFIG,
  type AuthConfig,
  type OAuthProviderConfig,
} from './types.js';
import type { SessionProvider } from './session.js';
import { OAuthProviders } from './providers.js';
import { getAuthorizationUrl, exchangeCodeForToken, getUserProfile } from './oauth.js';
import { StateStore } from './state-store.js';
import { AuthGuard } from './guards.js';

const SUPPORTED_PROVIDERS = ['google', 'github', 'microsoft'] as const;
type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number];

function isSupportedProvider(value: string): value is SupportedProvider {
  return (SUPPORTED_PROVIDERS as readonly string[]).includes(value);
}

@Controller('/auth')
@Injectable()
export class OAuthController {
  private stateStore = new StateStore();

  constructor(
    @Inject(SESSION_PROVIDER)
    private readonly session: SessionProvider,
    @Inject(AUTH_CONFIG)
    private readonly authConfig: AuthConfig,
  ) {}

  @Get('/signin/:provider')
  async signInWithProvider(c: Context): Promise<Response> {
    const providerName = c.req.param('provider') ?? '';

    if (!isSupportedProvider(providerName)) {
      return c.json(
        {
          error: 'Bad Request',
          message: `Unsupported provider "${providerName}". Supported: ${SUPPORTED_PROVIDERS.join(', ')}`,
        },
        400,
      );
    }

    const providerConfig = this.getProviderConfig(providerName);
    if (!providerConfig) {
      return c.json(
        { error: 'Bad Request', message: `Provider "${providerName}" is not configured` },
        400,
      );
    }

    const origin = new URL(c.req.url).origin;
    const redirectUri = `${origin}/auth/callback`;
    const state = this.stateStore.generate(providerName, redirectUri);
    const authUrl = getAuthorizationUrl(providerConfig, redirectUri, state);

    return c.redirect(authUrl);
  }

  @Get('/callback')
  async oauthCallback(c: Context): Promise<Response> {
    const code = c.req.query('code');
    const state = c.req.query('state');

    if (!code || !state) {
      return c.json({ error: 'Bad Request', message: 'Missing code or state parameter' }, 400);
    }

    const stateEntry = this.stateStore.verify(state);
    if (!stateEntry) {
      return c.json({ error: 'Unauthorized', message: 'Invalid or expired OAuth state' }, 401);
    }

    if (!isSupportedProvider(stateEntry.provider)) {
      return c.json(
        { error: 'Internal Server Error', message: 'Invalid provider in OAuth state' },
        500,
      );
    }

    const providerConfig = this.getProviderConfig(stateEntry.provider);
    if (!providerConfig) {
      return c.json(
        { error: 'Internal Server Error', message: 'Provider configuration not found' },
        500,
      );
    }

    try {
      const accessToken = await exchangeCodeForToken(providerConfig, code, stateEntry.redirectUri);
      const profile = await getUserProfile(providerConfig, accessToken);

      const token = this.session.createToken(
        {
          userId: profile.id,
          email: profile.email,
          name: profile.name ?? profile.email,
          roles: ['user'],
          scopes: [],
        },
        3600,
      );

      return c.json({ token, user: { id: profile.id, email: profile.email, name: profile.name } });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'OAuth authentication failed';
      return c.json({ error: 'Unauthorized', message }, 401);
    }
  }

  @Get('/me')
  @Use(AuthGuard)
  async getCurrentUser(c: Context): Promise<Response> {
    const user = c.get('kanji.auth.user');
    const session = c.get('kanji.auth.session');
    return c.json({ user, session });
  }

  private getProviderConfig(name: SupportedProvider): OAuthProviderConfig | null {
    const providerDefs = this.authConfig.providers;
    if (!providerDefs) return null;

    const creds = providerDefs[name];
    if (!creds) return null;

    const factory = OAuthProviders[name];
    return factory(creds.clientId, creds.clientSecret);
  }
}
