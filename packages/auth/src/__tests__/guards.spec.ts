import { describe, it, expect } from 'bun:test';
import { Hono } from 'hono';
import { AuthGuard } from '../guards.js';
import { KANJI_CTX } from '@kanjijs/platform-hono';

describe('AuthGuard', () => {
  it('should allow request if user is authenticated in context', async () => {
    const app = new Hono();

    app.get('/protected', (c, next) => {
      c.set(KANJI_CTX.AUTH_USER as any, { id: '123' });
      return next();
    }, AuthGuard, (c) => c.text('Granted'));

    const res = await app.request('/protected');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('Granted');
  });

  it('should block request and return 401 if user is not in context', async () => {
    const app = new Hono();

    app.get('/protected', AuthGuard, (c) => c.text('Granted'));

    const res = await app.request('/protected');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });
});
