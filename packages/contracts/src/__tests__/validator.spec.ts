import { describe, it, expect } from 'bun:test';
import { z } from 'zod';
import { Hono, type Context } from 'hono';
import { ZodValidator } from '../validator.js';

describe('ZodValidator Middleware', () => {
  const validator = new ZodValidator();

  it('should validate body and set data in hono context', async () => {
    const app = new Hono();
    const schema = z.object({
      name: z.string().min(2),
      age: z.number(),
    });

    let validatedBody: any = null;

    app.post(
      '/test',
      validator.validate({
        method: 'POST',
        path: '/test',
        request: {
          body: schema,
        },
      }),
      (c) => {
        validatedBody = c.get('kanji.validated.body' as any);
        return c.text('OK');
      },
    );

    const response = await app.request('/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Alice', age: 30 }),
    });

    expect(response.status).toBe(200);
    expect(validatedBody).toEqual({ name: 'Alice', age: 30 });
  });

  it('should return 400 Bad Request on invalid body format', async () => {
    const app = new Hono();
    const schema = z.object({
      email: z.string().email(),
    });

    app.post(
      '/test',
      validator.validate({
        method: 'POST',
        path: '/test',
        request: {
          body: schema,
        },
      }),
      (c) => c.text('OK'),
    );

    const response = await app.request('/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: 'not-an-email' }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('VALIDATION_ERROR');
    expect(body.message).toBe('Request validation failed');
    expect(body.issues).toBeArray();
    expect(body.issues[0].path).toContain('email');
  });

  it('should validate query parameters', async () => {
    const app = new Hono();
    const schema = z.object({
      limit: z.coerce.number().default(10),
    });

    let validatedQueryAs: any = null;

    app.get(
      '/test',
      validator.validate({
        method: 'GET',
        path: '/test',
        request: {
          query: schema,
        },
      }),
      (c) => {
        validatedQueryAs = c.get('kanji.validated.query' as any);
        return c.text('OK');
      },
    );

    const response = await app.request('/test?limit=25');

    expect(response.status).toBe(200);
    expect(validatedQueryAs).toEqual({ limit: 25 });
  });

  it('should skip validation when contract has no request body', async () => {
    const app = new Hono();

    app.get(
      '/test',
      validator.validate({
        method: 'GET',
        path: '/test',
      }),
      (c) => c.text('OK'),
    );

    const response = await app.request('/test');
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('OK');
  });
});
