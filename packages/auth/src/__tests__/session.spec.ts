import { describe, it, expect } from 'bun:test';
import { SessionProvider } from '../session.js';
import type { AuthConfig } from '../types.js';

describe('SessionProvider JWT authentication', () => {
  const config: AuthConfig = {
    jwtSecret: 'test-jwt-secret-key-987654321',
  };
  const provider = new SessionProvider(config);

  const mockSession = {
    userId: 'user-id-abc-123',
    email: 'test@example.com',
    name: 'Test User',
    roles: ['admin'],
    scopes: ['read:users'],
  };

  it('should sign and create a token that contains the payload data', () => {
    const token = provider.createToken(mockSession, 3600);
    expect(token).toBeString();

    const verified = provider.verifyToken(token);
    expect(verified).not.toBeNull();
    expect(verified!.userId).toBe(mockSession.userId);
    expect(verified!.email).toBe(mockSession.email);
    expect(verified!.roles).toEqual(['admin']);
  });

  it('should reject tampered tokens', () => {
    const token = provider.createToken(mockSession, 3600);
    const tampered = token + 'manipulated';

    const verified = provider.verifyToken(tampered);
    expect(verified).toBeNull();
  });

  it('should reject tokens signed with a different key', () => {
    const wrongProvider = new SessionProvider({ jwtSecret: 'completely-different-secret-key' });
    const token = wrongProvider.createToken(mockSession, 3600);

    const verified = provider.verifyToken(token);
    expect(verified).toBeNull();
  });

  it('should reject expired tokens', async () => {
    // Generate token with 0 seconds lifespan
    const token = provider.createToken(mockSession, 0);

    // Small delay to ensure expiration
    await new Promise((resolve) => setTimeout(resolve, 10));

    const verified = provider.verifyToken(token);
    expect(verified).toBeNull();
  });

  describe('refreshToken', () => {
    it('should generate a new token from a valid token', () => {
      const token = provider.createToken(mockSession, 3600);
      const refreshed = provider.refreshToken(token, 7200);
      expect(refreshed).toBeString();
      expect(refreshed).not.toBeNull();

      const decoded = provider.verifyToken(refreshed!);
      expect(decoded).not.toBeNull();
      expect(decoded!.userId).toBe(mockSession.userId);
    });

    it('should return null for an expired token', async () => {
      const token = provider.createToken(mockSession, 0);
      await new Promise((resolve) => setTimeout(resolve, 10));

      const refreshed = provider.refreshToken(token, 3600);
      expect(refreshed).toBeNull();
    });

    it('should return null for a tampered token', () => {
      const token = provider.createToken(mockSession, 3600);
      const refreshed = provider.refreshToken(token + 'bad', 3600);
      expect(refreshed).toBeNull();
    });
  });
});
