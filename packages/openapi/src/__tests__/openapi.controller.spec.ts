import 'reflect-metadata';
import { describe, it, expect } from 'bun:test';
import { Hono } from 'hono';
import { OpenApiController } from '../openapi.controller.js';
import { OPENAPI_CONFIG } from '../types.js';

describe('OpenApiController', () => {
  const config = {
    title: 'Test API',
    version: '1.0.0',
    description: 'A test API description',
  };

  const controller = new OpenApiController(config);

  it('should respond with valid OpenAPI JSON at GET /api/openapi.json', async () => {
    const app = new Hono();
    app.get('/api/openapi.json', (c) => controller.spec(c));

    const res = await app.request('/api/openapi.json');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.openapi).toBeString();
    expect(body.info.title).toBe('Test API');
    expect(body.info.version).toBe('1.0.0');
    expect(body.info.description).toBe('A test API description');
    expect(body.paths).toBeDefined();
  });

  it('should respond with Swagger UI HTML at GET /api/docs', async () => {
    const app = new Hono();
    app.get('/api/docs', (c) => controller.docs(c));

    const res = await app.request('/api/docs');
    expect(res.status).toBe(200);

    const html = await res.text();
    expect(html).toContain('swagger-ui');
    expect(html).toContain('Test API');
    expect(html).toContain('/api/openapi.json');
  });

  it('should respond with ReDoc HTML at GET /api/docs/redoc', async () => {
    const app = new Hono();
    app.get('/api/docs/redoc', (c) => controller.redoc(c));

    const res = await app.request('/api/docs/redoc');
    expect(res.status).toBe(200);

    const html = await res.text();
    expect(html).toContain('redoc');
    expect(html).toContain('Test API');
    expect(html).toContain('/api/openapi.json');
  });
});
