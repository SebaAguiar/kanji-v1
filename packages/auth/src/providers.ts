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

  x: (clientId: string, clientSecret: string): OAuthProviderConfig => ({
    id: 'x',
    name: 'X',
    clientId,
    clientSecret,
    authorizationUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    userInfoUrl: 'https://api.twitter.com/2/users/me',
    defaultScopes: ['tweet.read', 'users.read'],
  }),

  instagram: (clientId: string, clientSecret: string): OAuthProviderConfig => ({
    id: 'instagram',
    name: 'Instagram',
    clientId,
    clientSecret,
    authorizationUrl: 'https://www.facebook.com/v22.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v22.0/oauth/access_token',
    userInfoUrl: 'https://graph.instagram.com/me',
    defaultScopes: ['instagram_basic', 'pages_show_list'],
  }),
};
