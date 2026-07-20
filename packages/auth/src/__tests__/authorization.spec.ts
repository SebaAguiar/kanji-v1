import { describe, it, expect } from 'bun:test';
import { Hono, type MiddlewareHandler } from 'hono';
import { clp, acl, UseGuards } from '../guards.js';
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

  it('should set kanji.authz.decision and kanji.authz.cache on successful clp authorization', async () => {
    const app = new Hono();
    const rule = clp({ read: 'public' });
    let decision: any;
    let cache: any;

    app.get('/posts', rule, (c) => {
      decision = c.get('kanji.authz.decision');
      cache = c.get('kanji.authz.cache');
      return c.text('ok');
    });

    const res = await app.request('/posts');
    expect(res.status).toBe(200);
    expect(decision).toBeDefined();
    expect(decision.allowed).toBe(true);
    expect(decision.action).toBe('read');
    expect(decision.reason).toBe('public access');
    expect(cache).toBeDefined();
    expect(cache.get('read')).toEqual(decision);
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

  it('should return 404 when hideExistence is true and policy denies', async () => {
    const app = new Hono();
    const mockContainer = {
      resolve: (_key: unknown, _mod: unknown) => new MockPolicy(),
    };

    const guard = acl({
      policy: MockPolicy,
      action: 'read',
      contextModule: DummyModule,
      hideExistence: true,
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
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Not Found');
  });

  it('should allow access via canCreate policy', async () => {
    class CreatePolicy {
      canCreate(c: import('hono').Context, _resource: unknown, user: { id: string }) {
        return user.id === 'admin-1';
      }
    }

    const app = new Hono();
    const mockContainer = {
      resolve: (_key: unknown, _mod: unknown) => new CreatePolicy(),
    };

    const guard = acl({
      policy: CreatePolicy,
      action: 'create',
      contextModule: DummyModule,
      resourceResolver: async (c, id) => ({ id }),
    });

    app.post(
      '/posts/:id',
      (c, next) => {
        c.set(KANJI_CTX.CONTAINER, mockContainer as never);
        c.set(KANJI_CTX.AUTH_USER, { id: 'admin-1', email: '', name: '', roles: [] });
        return next();
      },
      guard,
      (c) => c.text('created'),
    );

    const res = await app.request('/posts/post-1', { method: 'POST' });
    expect(res.status).toBe(200);
  });

  it('should allow access via canUpdate policy', async () => {
    class UpdatePolicy {
      canUpdate(c: import('hono').Context, resource: { ownerId: string }, user: { id: string }) {
        return resource.ownerId === user.id;
      }
    }

    const app = new Hono();
    const mockContainer = {
      resolve: (_key: unknown, _mod: unknown) => new UpdatePolicy(),
    };

    const guard = acl({
      policy: UpdatePolicy,
      action: 'update',
      contextModule: DummyModule,
      resourceResolver: async (c, id) => ({ id, ownerId: 'user-1' }),
    });

    app.put(
      '/posts/:id',
      (c, next) => {
        c.set(KANJI_CTX.CONTAINER, mockContainer as never);
        c.set(KANJI_CTX.AUTH_USER, { id: 'user-1', email: '', name: '', roles: [] });
        return next();
      },
      guard,
      (c) => c.text('updated'),
    );

    const res = await app.request('/posts/post-1', { method: 'PUT' });
    expect(res.status).toBe(200);
  });

  it('should allow access via canDelete policy', async () => {
    class DeletePolicy {
      canDelete(c: import('hono').Context, resource: { ownerId: string }, user: { id: string }) {
        return resource.ownerId === user.id;
      }
    }

    const app = new Hono();
    const mockContainer = {
      resolve: (_key: unknown, _mod: unknown) => new DeletePolicy(),
    };

    const guard = acl({
      policy: DeletePolicy,
      action: 'delete',
      contextModule: DummyModule,
      resourceResolver: async (c, id) => ({ id, ownerId: 'user-1' }),
    });

    app.delete(
      '/posts/:id',
      (c, next) => {
        c.set(KANJI_CTX.CONTAINER, mockContainer as never);
        c.set(KANJI_CTX.AUTH_USER, { id: 'user-1', email: '', name: '', roles: [] });
        return next();
      },
      guard,
      (c) => c.text('deleted'),
    );

    const res = await app.request('/posts/post-1', { method: 'DELETE' });
    expect(res.status).toBe(200);
  });

  it('should use custom resourceId selector', async () => {
    const app = new Hono();
    const mockContainer = {
      resolve: (_key: unknown, _mod: unknown) => new MockPolicy(),
    };

    const guard = acl({
      policy: MockPolicy,
      action: 'read',
      contextModule: DummyModule,
      resourceId: (c) => c.req.query('postId') || '',
      resourceResolver: async (c, id) => ({ id, ownerId: 'user-1' }),
    });

    app.get(
      '/posts',
      (c, next) => {
        c.set(KANJI_CTX.CONTAINER, mockContainer as never);
        c.set(KANJI_CTX.AUTH_USER, { id: 'user-1', email: '', name: '', roles: [] });
        return next();
      },
      guard,
      (c) => c.text('ok'),
    );

    const res = await app.request('/posts?postId=post-1');
    expect(res.status).toBe(200);
  });

  it('should set kanji.authz.decision and kanji.authz.cache on successful acl authorization', async () => {
    const app = new Hono();
    const mockContainer = {
      resolve: () => ({
        canRead: async () => true,
      }),
    };
    const guard = acl({
      action: 'read',
      policy: class DummyPolicy {},
      resourceId: (c) => c.req.query('postId'),
      resourceResolver: async (c, id) => ({ id, ownerId: 'user-1' }),
    });

    let decision: any;
    let cache: any;

    app.get(
      '/posts',
      (c, next) => {
        c.set(KANJI_CTX.CONTAINER, mockContainer as never);
        c.set(KANJI_CTX.AUTH_USER, { id: 'user-1', email: '', name: '', roles: [] });
        return next();
      },
      guard,
      (c) => {
        decision = c.get('kanji.authz.decision');
        cache = c.get('kanji.authz.cache');
        return c.text('ok');
      },
    );

    const res = await app.request('/posts?postId=post-1');
    expect(res.status).toBe(200);
    expect(decision).toBeDefined();
    expect(decision.allowed).toBe(true);
    expect(decision.action).toBe('read');
    expect(decision.reason).toBe('policy passed');
    expect(cache).toBeDefined();
    expect(cache.get('read')).toEqual(decision);
  });
});

describe('UseGuards decorator', () => {
  it('should register middlewares on controller via HttpMetadataStorage', async () => {
    const { HttpMetadataStorage } = await import('@kanjijs/platform-hono');
    const storage = HttpMetadataStorage.getInstance();
    storage.controllerMiddlewares.clear();
    storage.routeMiddlewares.clear();

    const mockGuard: MiddlewareHandler = async (c, next) => {
      await next();
    };

    @UseGuards(mockGuard)
    class TestController {
      method() {}
    }

    // UseGuards without propertyKey registers as controller middleware
    const middlewares = storage.controllerMiddlewares.get(TestController);
    expect(middlewares).toBeDefined();
    expect(middlewares!.length).toBe(1);
  });

  it('should register middlewares on route via HttpMetadataStorage', async () => {
    const { HttpMetadataStorage } = await import('@kanjijs/platform-hono');
    const storage = HttpMetadataStorage.getInstance();
    storage.controllerMiddlewares.clear();
    storage.routeMiddlewares.clear();

    const mockGuard: MiddlewareHandler = async (c, next) => {
      await next();
    };

    class TestController {
      @UseGuards(mockGuard)
      findOne() {}
    }

    // UseGuards with propertyKey registers as route middleware
    const key = 'TestController:findOne';
    const middlewares = storage.routeMiddlewares.get(key);
    expect(middlewares).toBeDefined();
    expect(middlewares!.length).toBe(1);
  });
});
