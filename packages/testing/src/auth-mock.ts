import type { Context, Next, MiddlewareHandler } from 'hono';
import { KANJI_CTX } from '@kanjijs/platform-hono';

export interface MockSession {
  userId: string;
  email: string;
  name: string;
  roles: string[];
  scopes: string[];
  expiresAt: number;
}

export function createMockSession(overrides?: Partial<MockSession>): MockSession {
  return {
    userId: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    roles: ['user'],
    scopes: ['read'],
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  };
}

export function createMockAuthMiddleware(session?: MockSession): MiddlewareHandler {
  const mockSession = session ?? createMockSession();
  return async (c: Context, next: Next): Promise<void> => {
    c.set(KANJI_CTX.AUTH_USER as string, {
      id: mockSession.userId,
      email: mockSession.email,
      name: mockSession.name,
      roles: mockSession.roles,
    });
    c.set(KANJI_CTX.AUTH_SESSION as string, mockSession);
    c.set(KANJI_CTX.AUTH_ROLES as string, mockSession.roles);
    c.set(KANJI_CTX.AUTH_PRINCIPAL as string, mockSession);
    c.set(KANJI_CTX.AUTH_SCOPES as string, mockSession.scopes);

    await next();
  };
}
