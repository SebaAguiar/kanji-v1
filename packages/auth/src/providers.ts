import type { OAuthProviderConfig } from './types.js';

export const OAuthProviders = {
  google: (clientId: string, clientSecret: string): OAuthProviderConfig => ({
    id: 'google',
    name: 'Google',
    clientId,
    clientSecret,
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    defaultScopes: ['openid', 'email', 'profile'],
  }),

  github: (clientId: string, clientSecret: string): OAuthProviderConfig => ({
    id: 'github',
    name: 'GitHub',
    clientId,
    clientSecret,
    authorizationUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    defaultScopes: ['read:user', 'user:email'],
  }),

  microsoft: (clientId: string, clientSecret: string): OAuthProviderConfig => ({
    id: 'microsoft',
    name: 'Microsoft',
    clientId,
    clientSecret,
    authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
    defaultScopes: ['openid', 'email', 'profile', 'User.Read'],
  }),
};
