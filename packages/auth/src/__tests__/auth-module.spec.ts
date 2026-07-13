import { describe, it, expect, beforeEach } from 'bun:test';
import { AuthModule } from '../auth.module.js';
import { AUTH_CONFIG, SESSION_PROVIDER } from '../types.js';
import { SessionProvider } from '../session.js';

describe('AuthModule.forRoot()', () => {
  it('should return a valid DynamicModule with correct structure', () => {
    const mod = AuthModule.forRoot({ jwtSecret: 'test-secret' });

    expect(mod.module).toBe(AuthModule);
    expect(mod.global).toBe(true);
    expect(mod.providers).toBeDefined();
    expect(mod.providers!.length).toBe(3);
    expect(mod.exports).toContain(SessionProvider);
    expect(mod.exports).toContain(SESSION_PROVIDER);
  });

  it('should register AUTH_CONFIG with the provided value', () => {
    const config = { jwtSecret: 'my-secret' };
    const mod = AuthModule.forRoot(config);

    const authConfigProvider = mod.providers!.find(
      (p) => 'provide' in p && p.provide === AUTH_CONFIG,
    );
    expect(authConfigProvider).toBeDefined();
    expect('useValue' in authConfigProvider!).toBe(true);
    expect((authConfigProvider as { useValue: unknown }).useValue).toEqual(config);
  });

  it('should register SESSION_PROVIDER pointing to SessionProvider class', () => {
    const mod = AuthModule.forRoot({ jwtSecret: 'test' });

    const sessionProviderDef = mod.providers!.find(
      (p) => 'provide' in p && p.provide === SESSION_PROVIDER,
    );
    expect(sessionProviderDef).toBeDefined();
    expect('useClass' in sessionProviderDef!).toBe(true);
    expect((sessionProviderDef as { useClass: unknown }).useClass).toBe(SessionProvider);
  });
});
