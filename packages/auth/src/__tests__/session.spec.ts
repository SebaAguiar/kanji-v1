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

  describe('JWT Secret Rotation', () => {
    const primarySecret = 'primary-jwt-secret-key-1';
    const oldSecret1 = 'old-jwt-secret-key-2';
    const oldSecret2 = 'old-jwt-secret-key-3';

    const rotatingProvider = new SessionProvider({
      jwtSecret: primarySecret,
      previousSecrets: [oldSecret1, oldSecret2],
    });

    it('should verify a token signed with the primary secret', () => {
      const token = rotatingProvider.createToken(mockSession, 3600);
      const verified = rotatingProvider.verifyToken(token);
      expect(verified).not.toBeNull();
      expect(verified!.userId).toBe(mockSession.userId);
    });

    it('should verify tokens signed with previous/retired secrets in cascade', () => {
      // Firmar token usando oldSecret1 manualmente
      const providerOld1 = new SessionProvider({ jwtSecret: oldSecret1 });
      const tokenOld1 = providerOld1.createToken(mockSession, 3600);

      const verified = rotatingProvider.verifyToken(tokenOld1);
      expect(verified).not.toBeNull();
      expect(verified!.userId).toBe(mockSession.userId);

      // Firmar token usando oldSecret2 manualmente
      const providerOld2 = new SessionProvider({ jwtSecret: oldSecret2 });
      const tokenOld2 = providerOld2.createToken(mockSession, 3600);

      const verified2 = rotatingProvider.verifyToken(tokenOld2);
      expect(verified2).not.toBeNull();
      expect(verified2!.userId).toBe(mockSession.userId);
    });

    it('should sign refreshed tokens with the primary secret', () => {
      const providerOld = new SessionProvider({ jwtSecret: oldSecret1 });
      const oldToken = providerOld.createToken(mockSession, 3600);

      const refreshedToken = rotatingProvider.refreshToken(oldToken, 3600);
      expect(refreshedToken).not.toBeNull();

      // Verificar que el token refrescado se firmó con la clave principal
      // (por ende, un provider que solo conoce la clave principal debe poder verificarlo)
      const primaryOnlyProvider = new SessionProvider({ jwtSecret: primarySecret });
      const verified = primaryOnlyProvider.verifyToken(refreshedToken!);
      expect(verified).not.toBeNull();
      expect(verified!.userId).toBe(mockSession.userId);
    });

    it('should reject tokens signed with fully deprecated or unknown secrets', () => {
      const unknownProvider = new SessionProvider({ jwtSecret: 'completely-unknown-secret' });
      const token = unknownProvider.createToken(mockSession, 3600);

      const verified = rotatingProvider.verifyToken(token);
      expect(verified).toBeNull();
    });
  });
});
