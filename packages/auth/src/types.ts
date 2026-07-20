export interface KanjiSession {
  userId: string;
  email: string;
  name: string;
  roles: string[];
  scopes: string[];
  expiresAt: number;
}

export interface OAuthProviderConfig {
  id: string;
  name: string;
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  defaultScopes?: string[];
}

export interface AuthConfig {
  jwtSecret: string;
  previousSecrets?: string[];
  providers?: {
    google?: { clientId: string; clientSecret: string };
    github?: { clientId: string; clientSecret: string };
    microsoft?: { clientId: string; clientSecret: string };
  };
}

export const SESSION_PROVIDER = Symbol.for('kanji:session_provider');
export const AUTH_CONFIG = Symbol('AUTH_CONFIG');
