import { describe, it, expect } from 'bun:test';
import { Hono } from 'hono';
import { clp, acl } from '../guards';
import { KANJI_CTX } from '@kanjijs/platform-hono';

describe('clp (Class-Level Permissions)', () => {
  it('should allow public access if route action is public', async () => {
    const app = new Hono();
    const rule = clp({ read: 'public' });

    app.get('/posts', rule, (c) => c.text('read-ok'));

    const res = await app.request('/posts');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('read-ok');
  });

  it('should block if authenticated is required and user is missing', async () => {
    const app = new Hono();
    const rule = clp({ create: 'authenticated' });

    app.post('/posts', rule, (c) => c.text('created'));

    const res = await app.request('/posts', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('should allow if user has required role', async () => {
    const app = new Hono();
    const rule = clp({ delete: { role: 'admin' } });

    app.delete('/posts', (c, next) => {
      c.set(KANJI_CTX.AUTH_USER as any, { roles: ['admin'] });
      return next();
    }, rule, (c) => c.text('deleted'));

    const res = await app.request('/posts', { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('deleted');
  });

  it('should block if user lacks required role', async () => {
    const app = new Hono();
    const rule = clp({ delete: { role: 'admin' } });

    app.delete('/posts', (c, next) => {
      c.set(KANJI_CTX.AUTH_USER as any, { roles: ['user'] });
      return next();
    }, rule, (c) => c.text('deleted'));

    const res = await app.request('/posts', { method: 'DELETE' });
    expect(res.status).toBe(403);
  });
});

describe('acl (Access Control List)', () => {
  class MockPolicy {
    canRead(c: any, resource: any, user: any) {
      return resource.ownerId === user.id;
    }
  }

  it('should allow access if policy evaluates to true', async () => {
    const app = new Hono();
    const mockContainer = {
      resolve: (key: any) => new MockPolicy()
    };

    const guard = acl({
      policy: MockPolicy,
      action: 'read',
      resourceResolver: async (c, id) => ({ id, ownerId: 'user-1' })
    });

    app.get('/posts/:id', (c, next) => {
      c.set(KANJI_CTX.CONTAINER as any, mockContainer);
      c.set(KANJI_CTX.AUTH_USER as any, { id: 'user-1' });
      return next();
    }, guard, (c) => c.text('ok'));

    const res = await app.request('/posts/post-1');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
  });

  it('should block access if policy evaluates to false', async () => {
    const app = new Hono();
    const mockContainer = {
      resolve: (key: any) => new MockPolicy()
    };

    const guard = acl({
      policy: MockPolicy,
      action: 'read',
      resourceResolver: async (c, id) => ({ id, ownerId: 'user-2' })
    });

    app.get('/posts/:id', (c, next) => {
      c.set(KANJI_CTX.CONTAINER as any, mockContainer);
      c.set(KANJI_CTX.AUTH_USER as any, { id: 'user-1' });
      return next();
    }, guard, (c) => c.text('ok'));

    const res = await app.request('/posts/post-1');
    expect(res.status).toBe(403);
  });
});
