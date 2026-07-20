import { describe, it, expect } from 'bun:test';
import { PasswordAuth, MagicLinkAuth } from '../credentials.js';

describe('PasswordAuth', () => {
  const auth = new PasswordAuth();

  it('should hash and verify a password', async () => {
    const hash = await auth.hashPassword('my-secure-password');
    expect(hash).toBeString();
    expect(hash).not.toBe('my-secure-password');

    const valid = await auth.verifyPassword('my-secure-password', hash);
    expect(valid).toBe(true);
  });

  it('should reject wrong password', async () => {
    const hash = await auth.hashPassword('correct-password');
    const valid = await auth.verifyPassword('wrong-password', hash);
    expect(valid).toBe(false);
  });

  it('should build a session object', () => {
    const session = auth.buildSession({
      id: 'user-1',
      email: 'test@test.com',
      name: 'Test User',
      roles: ['admin'],
    });

    expect(session.userId).toBe('user-1');
    expect(session.email).toBe('test@test.com');
    expect(session.name).toBe('Test User');
    expect(session.roles).toEqual(['admin']);
    expect(session.scopes).toEqual([]);
  });

  it('should default roles to ["user"]', () => {
    const session = auth.buildSession({
      id: 'u-1',
      email: 'a@b.com',
      name: 'A',
    });
    expect(session.roles).toEqual(['user']);
  });
});

describe('MagicLinkAuth', () => {
  it('should generate a magic link token and verify it', async () => {
    const mla = new MagicLinkAuth({ ttlSeconds: 300 });
    const { token, link } = await mla.sendMagicLink('user@test.com', 'http://localhost:3000');

    expect(token).toBeString();
    expect(token.length).toBeGreaterThan(0);
    expect(link).toContain('/auth/magic-link?token=');
    expect(link).toContain(token);

    const result = mla.verifyToken(token);
    expect(result).not.toBeNull();
    expect(result!.email).toBe('user@test.com');
  });

  it('should return null for unknown token', () => {
    const mla = new MagicLinkAuth();
    const result = mla.verifyToken('non-existent-token');
    expect(result).toBeNull();
  });

  it('should consume token on first verify (single-use)', async () => {
    const mla = new MagicLinkAuth({ ttlSeconds: 300 });
    const { token } = await mla.sendMagicLink('user@test.com', 'http://localhost:3000');

    const first = mla.verifyToken(token);
    expect(first).not.toBeNull();

    const second = mla.verifyToken(token);
    expect(second).toBeNull();
  });

  it('should return null for expired token', async () => {
    const mla = new MagicLinkAuth({ ttlSeconds: 0 }); // Expira inmediatamente
    const { token } = await mla.sendMagicLink('user@test.com', 'http://localhost:3000');

    // Small delay to ensure expiry
    await new Promise((resolve) => setTimeout(resolve, 10));

    const result = mla.verifyToken(token);
    expect(result).toBeNull();
  });

  it('should call sendEmail when configured', async () => {
    let sentTo = '';
    let sentLink = '';

    const mla = new MagicLinkAuth({
      ttlSeconds: 300,
      sendEmail: async (to, link) => {
        sentTo = to;
        sentLink = link;
      },
    });

    await mla.sendMagicLink('user@test.com', 'http://localhost:3000');

    expect(sentTo).toBe('user@test.com');
    expect(sentLink).toContain('/auth/magic-link?token=');
  });
});
