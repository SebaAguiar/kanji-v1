import { describe, it, expect, beforeAll } from 'bun:test';
import {
  generateRandomState,
  getAuthorizationUrl,
  exchangeCodeForToken,
  getUserProfile,
  generateCodeVerifier,
  generateCodeChallenge,
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
  it('should exchange code for access token successfully', async () => {
    const provider = { ...mockGoogleProvider, tokenUrl: 'https://example.com/token' };
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async (url: RequestInfo | URL) => {
      return new Response(
        JSON.stringify({ access_token: 'mock-access-token', token_type: 'Bearer' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };

    try {
      const token = await exchangeCodeForToken(provider, 'auth-code', 'http://localhost:3000/callback');
      expect(token).toBe('mock-access-token');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('should throw when exchange code returns non-200 status', async () => {
    const provider = { ...mockGoogleProvider, tokenUrl: 'https://example.com/token' };
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async () => {
      return new Response('Bad Request', { status: 400, statusText: 'Bad Request' });
    };

    try {
      await expect(
        exchangeCodeForToken(provider, 'bad-code', 'http://localhost:3000/callback'),
      ).rejects.toThrow('Failed to exchange code for token');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('should throw when exchange response has no access_token', async () => {
    const provider = { ...mockGoogleProvider, tokenUrl: 'https://example.com/token' };
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async () => {
      return new Response(JSON.stringify({ error: 'invalid_grant' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    try {
      await expect(
        exchangeCodeForToken(provider, 'bad-code', 'http://localhost:3000/callback'),
      ).rejects.toThrow('Access token not found in provider response');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

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

  it('should return user profile for successful response', async () => {
    const provider = { ...mockGoogleProvider, userInfoUrl: 'https://example.com/userinfo' };
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({ id: 'user-1', email: 'test@example.com', name: 'Test User' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };

    try {
      const profile = await getUserProfile(provider, 'valid-token');
      expect(profile.id).toBe('user-1');
      expect(profile.email).toBe('test@example.com');
      expect(profile.name).toBe('Test User');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('StateStore', () => {
  let StateStore: typeof import('../state-store.js').StateStore;

  beforeAll(async () => {
    const mod = await import('../state-store.js');
    StateStore = mod.StateStore;
  });

  it('should generate and verify a state', () => {
    const store = new StateStore(10000);
    const state = store.generate('google', 'http://localhost:3000/callback');
    expect(state).toBeString();
    expect(state.length).toBeGreaterThan(0);

    const entry = store.verify(state);
    expect(entry).not.toBeNull();
    expect(entry!.provider).toBe('google');
    expect(entry!.redirectUri).toBe('http://localhost:3000/callback');
  });

  it('should consume state on first verify (single use)', () => {
    const store = new StateStore(10000);
    const state = store.generate('github', 'http://localhost:3000/callback');

    // First verify succeeds
    const first = store.verify(state);
    expect(first).not.toBeNull();

    // Second verify returns null (consumed)
    const second = store.verify(state);
    expect(second).toBeNull();
  });

  it('should return null for unknown state', () => {
    const store = new StateStore(10000);
    const entry = store.verify('non-existent-state');
    expect(entry).toBeNull();
  });

  it('should return null for expired state', async () => {
    const store = new StateStore(50); // 50ms TTL
    const state = store.generate('google', 'http://localhost:3000/callback');

    await new Promise((resolve) => setTimeout(resolve, 100));

    const entry = store.verify(state);
    expect(entry).toBeNull();
  });

  it('should keep unexpired states valid after verifying a different one', () => {
    const store = new StateStore(10000);
    const state1 = store.generate('google', 'http://localhost:3000/callback1');
    const state2 = store.generate('github', 'http://localhost:3000/callback2');

    // Verify state1 — consumes it
    const entry1 = store.verify(state1);
    expect(entry1).not.toBeNull();

    // state2 should still be valid
    const entry2 = store.verify(state2);
    expect(entry2).not.toBeNull();
    expect(entry2!.provider).toBe('github');
  });
});

describe('PKCE Support', () => {
  it('should generate a cryptographically secure base64url code verifier', () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toBeString();
    expect(verifier.length).toBeGreaterThan(40);
    expect(verifier).not.toContain('+');
    expect(verifier).not.toContain('/');
    expect(verifier).not.toContain('=');
  });

  it('should generate a SHA-256 code challenge from a verifier', async () => {
    const verifier = 'test-code-verifier-value-random-enough-1234567890';
    const challenge = await generateCodeChallenge(verifier);
    expect(challenge).toBeString();
    expect(challenge).not.toBe(verifier);
    expect(challenge).not.toContain('+');
    expect(challenge).not.toContain('/');
    expect(challenge).not.toContain('=');
  });

  it('should include code_challenge parameters in authorization URL', () => {
    const url = getAuthorizationUrl(
      mockGoogleProvider,
      'http://localhost:3000/callback',
      'state',
      'mock-challenge',
    );
    const parsed = new URL(url);
    expect(parsed.searchParams.get('code_challenge')).toBe('mock-challenge');
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('should send code_verifier when exchanging code for token', async () => {
    const provider = { ...mockGoogleProvider, tokenUrl: 'https://example.com/token' };
    const originalFetch = globalThis.fetch;
    let requestBody: URLSearchParams | null = null;

    globalThis.fetch = async (url, options) => {
      if (options?.body instanceof URLSearchParams) {
        requestBody = options.body;
      } else if (typeof options?.body === 'string') {
        requestBody = new URLSearchParams(options.body);
      }
      return new Response(
        JSON.stringify({ access_token: 'mock-access-token', token_type: 'Bearer' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };

    try {
      const token = await exchangeCodeForToken(
        provider,
        'auth-code',
        'http://localhost:3000/callback',
        'my-verifier',
      );
      expect(token).toBe('mock-access-token');
      expect(requestBody).not.toBeNull();
      expect(requestBody!.get('code_verifier')).toBe('my-verifier');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
