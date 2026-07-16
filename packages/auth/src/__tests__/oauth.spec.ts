import { describe, it, expect } from 'bun:test';
import {
  generateRandomState,
  getAuthorizationUrl,
  exchangeCodeForToken,
  getUserProfile,
} from '../oauth.js';
import type { OAuthProviderConfig } from '../types.js';

const mockGoogleProvider: OAuthProviderConfig = {
  id: 'google',
  name: 'Google',
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
  defaultScopes: ['openid', 'email', 'profile'],
};

describe('generateRandomState', () => {
  it('should return a valid UUID string', () => {
    const state = generateRandomState();
    expect(state).toBeString();
    expect(state).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('should return unique values on each call', () => {
    const s1 = generateRandomState();
    const s2 = generateRandomState();
    expect(s1).not.toBe(s2);
  });
});

describe('getAuthorizationUrl', () => {
  it('should build correct URL with provider params and state', () => {
    const url = getAuthorizationUrl(
      mockGoogleProvider,
      'http://localhost:3000/callback',
      'test-state',
    );
    const parsed = new URL(url);

    expect(parsed.origin + parsed.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(parsed.searchParams.get('client_id')).toBe('test-client-id');
    expect(parsed.searchParams.get('redirect_uri')).toBe('http://localhost:3000/callback');
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('state')).toBe('test-state');
    expect(parsed.searchParams.get('scope')).toBe('openid email profile');
  });

  it('should omit scope when no defaultScopes are configured', () => {
    const provider = { ...mockGoogleProvider, defaultScopes: [] };
    const url = getAuthorizationUrl(provider, 'http://localhost:3000/callback', 'state');
    const parsed = new URL(url);
    expect(parsed.searchParams.has('scope')).toBe(false);
  });
});

describe('getUserProfile', () => {
  it('should throw if user ID is missing from response', async () => {
    const provider = { ...mockGoogleProvider, userInfoUrl: 'https://example.com/userinfo' };

    // Mock fetch globally
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return new Response(JSON.stringify({ email: 'test@example.com', name: 'Test' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    try {
      await expect(getUserProfile(provider, 'token')).rejects.toThrow('User ID not found');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
