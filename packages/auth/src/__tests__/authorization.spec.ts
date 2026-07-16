import { describe, it, expect } from 'bun:test';
import { Hono } from 'hono';
import { clp, acl } from '../guards';
import { KANJI_CTX } from '@kanjijs/platform-hono';

class DummyModule {}

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

    app.delete(
      '/posts',
      (c, next) => {
        c.set(KANJI_CTX.AUTH_USER, { id: '1', email: '', name: '', roles: ['admin'] });
        return next();
      },
      rule,
      (c) => c.text('deleted'),
    );

    const res = await app.request('/posts', { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('deleted');
  });

  it('should block if user lacks required role', async () => {
    const app = new Hono();
    const rule = clp({ delete: { role: 'admin' } });

    app.delete(
      '/posts',
      (c, next) => {
        c.set(KANJI_CTX.AUTH_USER, { id: '1', email: '', name: '', roles: ['user'] });
        return next();
      },
      rule,
      (c) => c.text('deleted'),
    );

    const res = await app.request('/posts', { method: 'DELETE' });
    expect(res.status).toBe(403);
  });

  it('should allow access if user has any of the anyRole roles', async () => {
    const app = new Hono();
    const rule = clp({ delete: { anyRole: ['admin', 'moderator'] } });

    app.delete(
      '/posts',
      (c, next) => {
        c.set(KANJI_CTX.AUTH_USER, { id: '1', email: '', name: '', roles: ['moderator'] });
        return next();
      },
      rule,
      (c) => c.text('deleted'),
    );

    const res = await app.request('/posts', { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('deleted');
  });

  it('should allow access with public as object property', async () => {
    const app = new Hono();
    const rule = clp({ read: { public: true } });

    app.get('/posts', rule, (c) => c.text('ok'));

    const res = await app.request('/posts');
    expect(res.status).toBe(200);
  });

  it('should allow access with authenticated as object property when user is present', async () => {
    const app = new Hono();
    const rule = clp({ read: { authenticated: true } });

    app.get(
      '/posts',
      (c, next) => {
        c.set(KANJI_CTX.AUTH_USER, { id: '1', email: '', name: '', roles: [] });
        return next();
      },
      rule,
      (c) => c.text('ok'),
    );

    const res = await app.request('/posts');
    expect(res.status).toBe(200);
  });

  it('should block when action has no rule defined in permissions', async () => {
    const app = new Hono();
    const rule = clp({}); // empty — no rules defined

    app.get(
      '/posts',
      (c, next) => {
        c.set(KANJI_CTX.AUTH_USER, { id: '1', email: '', name: '', roles: [] });
        return next();
      },
      rule,
      (c) => c.text('ok'),
    );

    const res = await app.request('/posts');
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Forbidden');
  });

  it('should use list action for GET requests without :id param when list rule exists', async () => {
    const app = new Hono();
    const rule = clp({ list: { role: 'admin' } });

    app.get(
      '/posts',
      (c, next) => {
        c.set(KANJI_CTX.AUTH_USER, { id: '1', email: '', name: '', roles: ['user'] });
        return next();
      },
      rule,
      (c) => c.text('list-ok'),
    );

    const res = await app.request('/posts');
    expect(res.status).toBe(403); // user is not admin
  });
});

describe('acl (Access Control List)', () => {
  class MockPolicy {
    canRead(c: import('hono').Context, resource: Record<string, unknown>, user: { id: string }) {
      return resource.ownerId === user.id;
    }
  }

  it('should allow access if policy evaluates to true', async () => {
    const app = new Hono();
    const mockContainer = {
      resolve: (_key: unknown, _mod: unknown) => new MockPolicy(),
    };

    const guard = acl({
      policy: MockPolicy,
      action: 'read',
      contextModule: DummyModule,
      resourceResolver: async (c, id) => ({ id, ownerId: 'user-1' }),
    });

    app.get(
      '/posts/:id',
      (c, next) => {
        c.set(KANJI_CTX.CONTAINER, mockContainer as never);
        c.set(KANJI_CTX.AUTH_USER, { id: 'user-1', email: '', name: '', roles: [] });
        return next();
      },
      guard,
      (c) => c.text('ok'),
    );

    const res = await app.request('/posts/post-1');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
  });

  it('should block access if policy evaluates to false', async () => {
    const app = new Hono();
    const mockContainer = {
      resolve: (_key: unknown, _mod: unknown) => new MockPolicy(),
    };

    const guard = acl({
      policy: MockPolicy,
      action: 'read',
      contextModule: DummyModule,
      resourceResolver: async (c, id) => ({ id, ownerId: 'user-2' }),
    });

    app.get(
      '/posts/:id',
      (c, next) => {
        c.set(KANJI_CTX.CONTAINER, mockContainer as never);
        c.set(KANJI_CTX.AUTH_USER, { id: 'user-1', email: '', name: '', roles: [] });
        return next();
      },
      guard,
      (c) => c.text('ok'),
    );

    const res = await app.request('/posts/post-1');
    expect(res.status).toBe(403);
  });
});
