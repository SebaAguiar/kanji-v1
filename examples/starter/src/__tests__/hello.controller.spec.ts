import { describe, it, expect } from 'bun:test';
import { KanjijsAdapter } from '@kanjijs/platform-hono';
import { ZodValidator } from '@kanjijs/contracts';
import { AppModule } from '../app.module.js';

describe('Starter App', () => {
  it('should respond to GET /hello', async () => {
    const { app, shutdown } = await KanjijsAdapter.create(AppModule, {
      validator: new ZodValidator(),
      logger: false,
    });
    const res = await app.request('/hello?name=Test');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { message: string };
    expect(body.message).toBe('Hello, Test!');
    await shutdown();
  });
});
