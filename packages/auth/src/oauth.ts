import { randomUUID } from 'crypto';
import type { OAuthProviderConfig } from './types.js';

export function generateRandomState(): string {
  return randomUUID();
}

export function getAuthorizationUrl(
  provider: OAuthProviderConfig,
  redirectUri: string,
  state: string,
): string {
  const url = new URL(provider.authorizationUrl);
  url.searchParams.set('client_id', provider.clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);

  const scopes = provider.defaultScopes || [];
  if (scopes.length > 0) {
    url.searchParams.set('scope', scopes.join(' '));
  }

  return url.toString();
}

export async function exchangeCodeForToken(
  provider: OAuthProviderConfig,
  code: string,
  redirectUri: string,
): Promise<string> {
  const response = await fetch(provider.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: new URLSearchParams({
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Failed to exchange code for token: ${response.statusText}. Details: ${errorBody}`,
    );
  }

  const data = (await response.json()) as {
    access_token?: string;
  };

  const accessToken = data.access_token;
  if (typeof accessToken !== 'string') {
    throw new Error('Access token not found in provider response');
  }

  return accessToken;
}

export async function getUserProfile(
  provider: OAuthProviderConfig,
  accessToken: string,
): Promise<{ id: string; email: string; name?: string }> {
  const response = await fetch(provider.userInfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Failed to fetch user profile: ${response.statusText}. Details: ${errorBody}`,
    );
  }

  const data = (await response.json()) as {
    id?: string | number;
    sub?: string;
    objectId?: string;
    email?: string;
    mail?: string;
    userPrincipalName?: string;
    name?: string;
    displayName?: string;
  };

  let id = '';
  let email = '';
  let name: string | undefined;

  if (provider.id === 'github') {
    id = data.id !== undefined ? String(data.id) : '';
    email = data.email !== undefined && data.email !== null ? String(data.email) : '';
    name = data.name !== undefined ? String(data.name) : undefined;

    if (!email && accessToken) {
      try {
        const emailsResponse = await fetch('https://api.github.com/user/emails', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
            'User-Agent': 'Kanji-Auth-Module',
          },
        });
        if (emailsResponse.ok) {
          const emails = (await emailsResponse.json()) as Array<{
            email: string;
            primary: boolean;
            verified: boolean;
          }>;
          const primaryEmail = emails.find((e) => e.primary)?.email || emails[0]?.email;
          if (primaryEmail) {
            email = primaryEmail;
          }
        }
      } catch (error) {
        console.warn('Kanji Auth: Failed to fetch private emails from GitHub.', error);
      }
    }
  } else {
    id = String(data.id ?? data.sub ?? data.objectId ?? '');
    email = String(data.email ?? data.mail ?? data.userPrincipalName ?? '');
    name = data.name !== undefined
      ? String(data.name)
      : data.displayName !== undefined
        ? String(data.displayName)
        : undefined;
  }

  if (!id) {
    throw new Error(`User ID not found in profile response from provider ${provider.id}`);
  }

  return { id, email, name };
}
