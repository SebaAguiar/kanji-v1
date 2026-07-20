import { describe, it, expect, beforeEach } from 'bun:test';
import { Hono } from 'hono';
import { KanjijsModule } from '@kanjijs/core';
import { KanjijsAdapter } from '../hono-adapter.js';
import { HttpMetadataStorage } from '../http-metadata-storage.js';
import { requestIdMiddleware } from '../middleware/request-id.js';
import { KanjiError, NotFoundError, ValidationError } from '@kanjijs/common';
import { Controller, Get } from '../index.js';

@Controller('/test')
class TestController {
  @Get('/')
  index(c: any) {
    return c.text('ok');
  }
}

@KanjijsModule({
  controllers: [TestController],
})
class SimpleAppModule {}

describe('KanjijsAdapter', () => {
  it('should create app with logger and return full API', async () => {
    const instance = await KanjijsAdapter.create(SimpleAppModule, { logger: true });
    expect(instance.app).toBeDefined();
    expect(instance.container).toBeDefined();
    expect(instance.serve).toBeFunction();
    expect(instance.shutdown).toBeFunction();
    await instance.shutdown();
  });

  it('should create app with CORS enabled', async () => {
    const instance = await KanjijsAdapter.create(SimpleAppModule, {
      logger: false,
      cors: true,
    });

    const res = await instance.app.request('/test', {
      method: 'OPTIONS',
      headers: { Origin: 'http://example.com' },
    });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    await instance.shutdown();
  });

  it('should apply default security headers if enabled', async () => {
    const instance = await KanjijsAdapter.create(SimpleAppModule, {
      logger: false,
    });

    const res = await instance.app.request('/test');
    expect(res.headers.get('Strict-Transport-Security')).toContain('max-age=31536000');
    expect(res.headers.get('Content-Security-Policy')).toBe("default-src 'self'");
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(res.headers.get('X-XSS-Protection')).toBe('0');
    await instance.shutdown();
  });

  it('should not apply security headers if explicitly disabled', async () => {
    const instance = await KanjijsAdapter.create(SimpleAppModule, {
      logger: false,
      securityHeaders: false,
    });

    const res = await instance.app.request('/test');
    expect(res.headers.get('Strict-Transport-Security')).toBeNull();
    expect(res.headers.get('Content-Security-Policy')).toBeNull();
    await instance.shutdown();
  });

  it('should apply customized security headers options', async () => {
    const instance = await KanjijsAdapter.create(SimpleAppModule, {
      logger: false,
      securityHeaders: {
        hsts: { maxAge: 100, includeSubDomains: false },
        contentSecurityPolicy: "default-src 'none'",
        xFrameOptions: 'SAMEORIGIN',
      },
    });

    const res = await instance.app.request('/test');
    expect(res.headers.get('Strict-Transport-Security')).toBe('max-age=100');
    expect(res.headers.get('Content-Security-Policy')).toBe("default-src 'none'");
    expect(res.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
    await instance.shutdown();
  });
});

describe('requestIdMiddleware', () => {
  beforeEach(() => {
    const storage = HttpMetadataStorage.getInstance();
    storage.reset();
  });

  it('should generate and set a UUID requestId on every request', async () => {
    const app = new Hono();
    app.use('*', requestIdMiddleware);
    app.get('/test', (c) => {
      const id = c.get('kanji.requestId');
      return c.json({ requestId: id });
    });

    const res = await app.request('/test');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.requestId).toBeString();
    expect(body.requestId).not.toBe('');
  });

  it('should generate unique IDs for different requests', async () => {
    const app = new Hono();
    app.use('*', requestIdMiddleware);
    app.get('/test', (c) => {
      return c.json({ requestId: c.get('kanji.requestId') });
    });

    const res1 = await app.request('/test');
    const res2 = await app.request('/test');
    const body1 = await res1.json();
    const body2 = await res2.json();
    expect(body1.requestId).not.toBe(body2.requestId);
  });
});

describe('Global Exception Filter (app.onError)', () => {
  it('should catch KanjiError and return structured JSON with correct status', async () => {
    const app = new Hono();
    app.onError((err, c) => {
      if (err instanceof KanjiError) {
        return c.json({ error: err.code, message: err.message, issues: [] }, err.statusCode as 400);
      }
      return c.json({ error: 'INTERNAL_SERVER_ERROR', message: 'Unexpected', issues: [] }, 500);
    });
    app.get('/test', () => {
      throw new NotFoundError('User not found');
    });

    const res = await app.request('/test');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('NOT_FOUND');
    expect(body.message).toBe('User not found');
  });

  it('should catch ValidationError and return issues array', async () => {
    const app = new Hono();
    app.onError((err, c) => {
      if (err instanceof ValidationError) {
        return c.json({ error: err.code, message: err.message, issues: err.issues }, 422);
      }
      return c.json({ error: 'INTERNAL_SERVER_ERROR', message: 'Unexpected', issues: [] }, 500);
    });
    app.get('/test', () => {
      throw new ValidationError([
        { path: 'email', code: 'invalid_format', message: 'Invalid email' },
      ]);
    });

    const res = await app.request('/test');
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe('VALIDATION_ERROR');
    expect(body.issues).toHaveLength(1);
    expect(body.issues[0].path).toBe('email');
  });

  it('should catch unknown errors and return 500', async () => {
    const app = new Hono();
    app.onError((err, c) => {
      if (err instanceof KanjiError) {
        return c.json({ error: err.code, message: err.message, issues: [] }, err.statusCode as 400);
      }
      return c.json(
        { error: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred', issues: [] },
        500,
      );
    });
    app.get('/test', () => {
      throw new Error('something broke');
    });

    const res = await app.request('/test');
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('INTERNAL_SERVER_ERROR');
  });
});

describe('HttpMetadataStorage.reset()', () => {
  it('should clear all maps when reset is called', () => {
    const storage = HttpMetadataStorage.getInstance();
    class Dummy {}
    storage.registerController(Dummy, '/dummy');
    storage.registerRoute(Dummy, { propertyKey: 'index', method: 'get', path: '/' });

    expect(storage.controllers.size).toBeGreaterThan(0);
    expect(storage.routes.size).toBeGreaterThan(0);

    storage.reset();

    expect(storage.controllers.size).toBe(0);
    expect(storage.routes.size).toBe(0);
    expect(storage.controllerMiddlewares.size).toBe(0);
    expect(storage.routeMiddlewares.size).toBe(0);
  });
});
