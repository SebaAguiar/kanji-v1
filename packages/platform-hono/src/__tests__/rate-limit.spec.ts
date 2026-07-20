import { describe, it, expect, beforeEach, beforeAll } from 'bun:test';
import { Hono } from 'hono';
import { RateLimit, type RateLimitOptions } from '../decorators/rate-limit.js';
import { createRateLimitMiddleware, _rateLimitStore } from '../middleware/rate-limit.js';
import { TooManyRequestsError } from '@kanjijs/common';

describe('@RateLimit Decorator', () => {
  it('should define metadata on the controller method', () => {
    const options: RateLimitOptions = {
      limit: 10,
      window: '1m',
      by: 'ip',
    };

    class TestController {
      @RateLimit(options)
      testMethod() {}
    }

    const metadata = Reflect.getMetadata(
      'kanji:rate-limit',
      TestController.prototype,
      'testMethod',
    );
    expect(metadata).toEqual(options);
  });
});

describe('RateLimit Middleware', () => {
  beforeEach(() => {
    _rateLimitStore.clear();
  });

  it('should allow requests within limit and return headers', async () => {
    const app = new Hono();
    const options: RateLimitOptions = { limit: 2, window: '5s', by: 'global' };
    const middleware = createRateLimitMiddleware(options, 'test-route');

    app.get('/test', middleware, (c) => c.text('ok'));

    // Petición 1
    const res1 = await app.request('/test');
    expect(res1.status).toBe(200);
    expect(res1.headers.get('X-RateLimit-Limit')).toBe('2');
    expect(res1.headers.get('X-RateLimit-Remaining')).toBe('1');
    expect(res1.headers.get('X-RateLimit-Reset')).toBeDefined();

    // Petición 2
    const res2 = await app.request('/test');
    expect(res2.status).toBe(200);
    expect(res2.headers.get('X-RateLimit-Remaining')).toBe('0');
  });

  it('should throw TooManyRequestsError (429) when limit is exceeded', async () => {
    const app = new Hono();
    const options: RateLimitOptions = { limit: 1, window: '5s', by: 'global' };
    const middleware = createRateLimitMiddleware(options, 'test-route');

    app.onError((err, c) => {
      const error = err as { statusCode?: number; code?: string; name?: string; message?: string };
      if (error.statusCode === 429 || error.name === 'TooManyRequestsError') {
        c.status(429);
        return c.json({
          error: error.code ?? 'TOO_MANY_REQUESTS',
          message: error.message ?? 'Too many requests',
        });
      }
      return c.text('Internal Server Error', 500);
    });

    app.get('/test', middleware, (c) => c.text('ok'));

    // Petición 1 - ok
    const res1 = await app.request('/test');
    expect(res1.status).toBe(200);

    // Petición 2 - bloqueada (429)
    const res2 = await app.request('/test');
    expect(res2.status).toBe(429);
    const body2 = await res2.json();
    expect(body2.error).toBe('TOO_MANY_REQUESTS');
  });

  it('should respect window expiration', async () => {
    const app = new Hono();
    // Ventana corta de 100ms para el test
    const options: RateLimitOptions = { limit: 1, window: '100ms', by: 'global' };
    const middleware = createRateLimitMiddleware(options, 'test-route');

    app.get('/test', middleware, (c) => c.text('ok'));

    // Petición 1
    const res1 = await app.request('/test');
    expect(res1.status).toBe(200);

    // Esperar 150ms
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Petición 2 - debería funcionar porque la ventana expiró
    const res2 = await app.request('/test');
    expect(res2.status).toBe(200);
  });

  it('should distinguish limits by IP address', async () => {
    const app = new Hono();
    const options: RateLimitOptions = { limit: 1, window: '5s', by: 'ip' };
    const middleware = createRateLimitMiddleware(options, 'test-route');

    app.get('/test', middleware, (c) => c.text('ok'));

    // Petición 1 - IP 1
    const res1 = await app.request('/test', {
      headers: { 'X-Real-IP': '1.1.1.1' },
    });
    expect(res1.status).toBe(200);
    expect(res1.headers.get('X-RateLimit-Remaining')).toBe('0');

    // Petición 2 - IP 2 (debería pasar porque tiene su propio límite)
    const res2 = await app.request('/test', {
      headers: { 'X-Real-IP': '2.2.2.2' },
    });
    expect(res2.status).toBe(200);
    expect(res2.headers.get('X-RateLimit-Remaining')).toBe('0');
  });

  it('should distinguish limits by authenticated user', async () => {
    const app = new Hono();
    const options: RateLimitOptions = { limit: 1, window: '5s', by: 'user' };
    const middleware = createRateLimitMiddleware(options, 'test-route');

    // Simular autenticación
    app.use('*', async (c, next) => {
      const mockUserId = c.req.header('X-Mock-User-Id');
      if (mockUserId) {
        c.set('kanji.auth.user', { id: mockUserId });
      }
      await next();
    });

    app.get('/test', middleware, (c) => c.text('ok'));

    // Petición 1 - Usuario A
    const res1 = await app.request('/test', {
      headers: { 'X-Mock-User-Id': 'user-A' },
    });
    expect(res1.status).toBe(200);
    expect(res1.headers.get('X-RateLimit-Remaining')).toBe('0');

    // Petición 2 - Usuario B (pasa porque es otro usuario)
    const res2 = await app.request('/test', {
      headers: { 'X-Mock-User-Id': 'user-B' },
    });
    expect(res2.status).toBe(200);
    expect(res2.headers.get('X-RateLimit-Remaining')).toBe('0');
  });

  it('should support custom RateLimitStore implementations', async () => {
    const app = new Hono();
    let incrementCalled = false;
    const customStore = {
      async increment(key: string, windowMs: number) {
        incrementCalled = true;
        return { count: 1, resetTime: Date.now() + windowMs };
      }
    };
    const options: RateLimitOptions = { limit: 5, window: '5s', by: 'global', store: customStore };
    const middleware = createRateLimitMiddleware(options, 'test-route');

    app.get('/test', middleware, (c) => c.text('ok'));

    const res = await app.request('/test');
    expect(res.status).toBe(200);
    expect(incrementCalled).toBe(true);
  });

  it('should use global rateLimitStore from app options if provided', async () => {
    const app = new Hono();
    let globalStoreIncrementCalled = false;
    const globalStore = {
      async increment(key: string, windowMs: number) {
        globalStoreIncrementCalled = true;
        return { count: 1, resetTime: Date.now() + windowMs };
      }
    };
    const options: RateLimitOptions = { limit: 5, window: '5s', by: 'global' };
    const middleware = createRateLimitMiddleware(options, 'test-route', globalStore);

    app.get('/test', middleware, (c) => c.text('ok'));

    const res = await app.request('/test');
    expect(res.status).toBe(200);
    expect(globalStoreIncrementCalled).toBe(true);
  });
});

describe('parseWindow', () => {
  let parseWindow: (window: string | number) => number;

  beforeAll(async () => {
    const mod = await import('../middleware/rate-limit.js');
    parseWindow = mod.parseWindow;
  });

  it('should parse milliseconds', () => {
    expect(parseWindow('100ms')).toBe(100);
    expect(parseWindow('500ms')).toBe(500);
  });

  it('should parse seconds', () => {
    expect(parseWindow('1s')).toBe(1000);
    expect(parseWindow('30s')).toBe(30000);
  });

  it('should parse minutes', () => {
    expect(parseWindow('1m')).toBe(60000);
    expect(parseWindow('5m')).toBe(300000);
  });

  it('should parse hours', () => {
    expect(parseWindow('1h')).toBe(3600000);
    expect(parseWindow('2h')).toBe(7200000);
  });

  it('should parse days', () => {
    expect(parseWindow('1d')).toBe(86400000);
  });

  it('should return raw number values unchanged', () => {
    expect(parseWindow(1000)).toBe(1000);
    expect(parseWindow(0)).toBe(0);
  });

  it('should throw on invalid format', () => {
    expect(() => parseWindow('invalid')).toThrow('Formato de ventana de rate limit inválido');
    expect(() => parseWindow('10x')).toThrow();
    expect(() => parseWindow('abc')).toThrow();
  });

  it('should handle by: user without auth as anonymous', async () => {
    const app = new Hono();
    const options: RateLimitOptions = { limit: 1, window: '5s', by: 'user' };
    const middleware = createRateLimitMiddleware(options, 'test-route');

    app.onError((err, c) => {
      const error = err as { statusCode?: number; code?: string; name?: string; message?: string };
      if (error.statusCode === 429 || error.name === 'TooManyRequestsError') {
        c.status(429);
        return c.json({
          error: error.code ?? 'TOO_MANY_REQUESTS',
          message: error.message ?? 'Too many requests',
        });
      }
      return c.text('Internal Server Error', 500);
    });

    app.get('/test', middleware, (c) => c.text('ok'));

    // First request — no auth, should count as anonymous
    const res1 = await app.request('/test');
    expect(res1.status).toBe(200);
    expect(res1.headers.get('X-RateLimit-Remaining')).toBe('0');

    // Second request — no auth, same anonymous key, blocked
    const res2 = await app.request('/test');
    expect(res2.status).toBe(429);
  });
});
