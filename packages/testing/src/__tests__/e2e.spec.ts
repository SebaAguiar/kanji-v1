import { describe, it, expect } from 'bun:test';
import { Hono } from 'hono';
import { request, E2eRequestBuilder } from '../e2e.js';

describe('E2eRequestBuilder', () => {
  it('should send GET requests and return response', async () => {
    const app = new Hono();
    app.get('/hello', (c) => c.text('world'));

    const res = await request(app).get('/hello');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('world');
  });

  it('should send POST requests with JSON body', async () => {
    const app = new Hono();
    app.post('/data', async (c) => {
      const body = await c.req.json();
      return c.json(body);
    });

    const res = await request(app).post('/data', { name: 'test' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('test');
  });

  it('should set auth header via auth()', async () => {
    const app = new Hono();
    app.get('/me', (c) => {
      const auth = c.req.header('Authorization');
      return c.json({ auth });
    });

    const res = await request(app).auth('my-token').get('/me');
    const body = await res.json();
    expect(body.auth).toBe('Bearer my-token');
  });

  it('should send PUT, PATCH and DELETE requests', async () => {
    const app = new Hono();
    app.put('/r/:id', (c) => c.text('put'));
    app.patch('/r/:id', (c) => c.text('patch'));
    app.delete('/r/:id', (c) => c.text('delete'));

    expect(await (await request(app).put('/r/1')).text()).toBe('put');
    expect(await (await request(app).patch('/r/1')).text()).toBe('patch');
    expect(await (await request(app).delete('/r/1')).text()).toBe('delete');
  });
});
