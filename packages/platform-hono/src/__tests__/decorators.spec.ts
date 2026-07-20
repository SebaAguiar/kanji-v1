import { describe, it, expect, beforeEach } from 'bun:test';
import { Hono, type Context } from 'hono';
import { Controller } from '../decorators/controller.js';
import { Get, Post, Put, Delete, Patch } from '../decorators/route.js';
import { HttpMetadataStorage } from '../http-metadata-storage.js';
import { KANJI_CTX } from '../types.js';
import { Use } from '../decorators/use.js';
import type { MiddlewareHandler } from 'hono';

describe('HttpMetadataStorage', () => {
  let storage: HttpMetadataStorage;

  beforeEach(() => {
    storage = HttpMetadataStorage.getInstance();
    storage.controllers.clear();
    storage.routes.clear();
    storage.controllerMiddlewares.clear();
    storage.routeMiddlewares.clear();
  });

  it('should register a controller with path', () => {
    class TestController {}
    storage.registerController(TestController, '/test');
    expect(storage.controllers.get(TestController)).toBe('/test');
  });

  it('should register routes for a controller', () => {
    class TestController {}
    storage.registerRoute(TestController, {
      propertyKey: 'findAll',
      method: 'get',
      path: '/',
    });

    const routes = storage.routes.get(TestController);
    expect(routes).toBeDefined();
    expect(routes!.length).toBe(1);
    expect(routes![0].propertyKey).toBe('findAll');
    expect(routes![0].method).toBe('get');
  });

  it('should register controller middlewares', () => {
    class TestController {}
    const middleware = async (c: import('hono').Context, next: import('hono').Next) => {
      await next();
    };

    storage.registerControllerMiddleware(TestController, [middleware]);
    const middlewares = storage.controllerMiddlewares.get(TestController);
    expect(middlewares).toBeDefined();
    expect(middlewares!.length).toBe(1);
  });

  it('should register route middlewares', () => {
    class TestController {}
    const middleware = async (c: import('hono').Context, next: import('hono').Next) => {
      await next();
    };

    storage.registerRouteMiddleware(TestController, 'findAll', [middleware]);
    const key = 'TestController:findAll';
    const middlewares = storage.routeMiddlewares.get(key);
    expect(middlewares).toBeDefined();
    expect(middlewares!.length).toBe(1);
  });
});

describe('Controller Decorator', () => {
  let storage: HttpMetadataStorage;

  beforeEach(() => {
    storage = HttpMetadataStorage.getInstance();
    storage.controllers.clear();
    storage.routes.clear();
  });

  it('should register controller with default empty path', () => {
    @Controller()
    class DefaultPathController {}

    expect(storage.controllers.get(DefaultPathController)).toBe('');
  });

  it('should register controller with custom path', () => {
    @Controller('/api/users')
    class UsersController {}

    expect(storage.controllers.get(UsersController)).toBe('/api/users');
  });
});

describe('Route Decorators', () => {
  let storage: HttpMetadataStorage;

  beforeEach(() => {
    storage = HttpMetadataStorage.getInstance();
    storage.controllers.clear();
    storage.routes.clear();
  });

  it('should register GET route', () => {
    @Controller('/items')
    class ItemsController {
      @Get('/')
      findAll() {}
    }

    const routes = storage.routes.get(ItemsController);
    expect(routes).toBeDefined();
    expect(routes!.length).toBe(1);
    expect(routes![0].method).toBe('get');
    expect(routes![0].path).toBe('/');
  });

  it('should register POST route', () => {
    @Controller('/items')
    class ItemsController {
      @Post('/')
      create() {}
    }

    const routes = storage.routes.get(ItemsController);
    expect(routes!.length).toBe(1);
    expect(routes![0].method).toBe('post');
  });

  it('should register PUT route', () => {
    @Controller('/items')
    class ItemsController {
      @Put('/:id')
      update() {}
    }

    const routes = storage.routes.get(ItemsController);
    expect(routes!.length).toBe(1);
    expect(routes![0].method).toBe('put');
    expect(routes![0].path).toBe('/:id');
  });

  it('should register DELETE route', () => {
    @Controller('/items')
    class ItemsController {
      @Delete('/:id')
      remove() {}
    }

    const routes = storage.routes.get(ItemsController);
    expect(routes!.length).toBe(1);
    expect(routes![0].method).toBe('delete');
  });

  it('should register PATCH route', () => {
    @Controller('/items')
    class ItemsController {
      @Patch('/:id')
      patch() {}
    }

    const routes = storage.routes.get(ItemsController);
    expect(routes!.length).toBe(1);
    expect(routes![0].method).toBe('patch');
  });

  it('should register multiple routes on same controller', () => {
    @Controller('/items')
    class ItemsController {
      @Get('/')
      findAll() {}

      @Get('/:id')
      findOne() {}

      @Post('/')
      create() {}
    }

    const routes = storage.routes.get(ItemsController);
    expect(routes!.length).toBe(3);
  });
});

describe('KANJI_CTX Constants', () => {
  it('should have all required context keys', () => {
    expect(KANJI_CTX.VALIDATED_BODY).toBe('kanji.validated.body');
    expect(KANJI_CTX.VALIDATED_QUERY).toBe('kanji.validated.query');
    expect(KANJI_CTX.VALIDATED_PARAMS).toBe('kanji.validated.params');
    expect(KANJI_CTX.VALIDATED_HEADERS).toBe('kanji.validated.headers');
    expect(KANJI_CTX.VALIDATED_COOKIES).toBe('kanji.validated.cookies');
    expect(KANJI_CTX.AUTH_USER).toBe('kanji.auth.user');
    expect(KANJI_CTX.AUTH_SESSION).toBe('kanji.auth.session');
    expect(KANJI_CTX.AUTH_ROLES).toBe('kanji.auth.roles');
    expect(KANJI_CTX.AUTH_PRINCIPAL).toBe('kanji.auth.principal');
    expect(KANJI_CTX.REQUEST_ID).toBe('kanji.requestId');
    expect(KANJI_CTX.CONTAINER).toBe('kanji.container');
    expect(KANJI_CTX.RESOURCE_READ).toBe('kanji.resource.read');
    expect(KANJI_CTX.RESOURCE_UPDATE).toBe('kanji.resource.update');
    expect(KANJI_CTX.RESOURCE_DELETE).toBe('kanji.resource.delete');
    expect(KANJI_CTX.RESOURCE_CREATE).toBe('kanji.resource.create');
  });
});

describe('Hono Integration', () => {
  it('should work with Hono app and route decorators', async () => {
    const app = new Hono();

    app.get('/test', (c: Context) => {
      return c.json({ message: 'ok' });
    });

    const response = await app.request('/test');
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.message).toBe('ok');
  });

  it('should set and get context values', async () => {
    const app = new Hono();

    app.use('*', async (c, next) => {
      c.set('kanji.requestId', 'req-123');
      await next();
    });

    app.get('/test', (c: Context) => {
      const requestId = c.get('kanji.requestId');
      return c.json({ requestId });
    });

    const response = await app.request('/test');
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.requestId).toBe('req-123');
  });
});

describe('@Use decorator', () => {
  let storage: HttpMetadataStorage;

  beforeEach(() => {
    storage = HttpMetadataStorage.getInstance();
    storage.controllers.clear();
    storage.routes.clear();
    storage.controllerMiddlewares.clear();
    storage.routeMiddlewares.clear();
  });

  it('should register middleware on controller-level', () => {
    const guard: MiddlewareHandler = async (c, next) => {
      await next();
    };

    @Use(guard)
    class GuardedController {}

    const middlewares = storage.controllerMiddlewares.get(GuardedController);
    expect(middlewares).toBeDefined();
    expect(middlewares!.length).toBe(1);
  });

  it('should register middleware on route-level', () => {
    const guard: MiddlewareHandler = async (c, next) => {
      await next();
    };

    class TestController {
      @Use(guard)
      findOne() {}
    }

    const key = 'TestController:findOne';
    const middlewares = storage.routeMiddlewares.get(key);
    expect(middlewares).toBeDefined();
    expect(middlewares!.length).toBe(1);
  });
});
