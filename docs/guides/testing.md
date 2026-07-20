# Testing Guide

This guide details how to write unit, integration, and E2E tests inside a Kanji application.

---

## 1. Setup and Tooling

Kanji recommends using **Bun Test** for running and writing tests due to its fast compilation and native support for TypeScript.

To run tests in your project:
```bash
bun test
```

---

## 2. E2E API Testing

To write end-to-end API tests, use `KanjijsAdapter.create` inside a `beforeAll` block to bootstrap a test instance of your application. You can issue requests directly using Hono's in-memory request router (`app.request`), avoiding binding to physical TCP ports.

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { KanjijsAdapter } from '@kanjijs/platform-hono';
import { ZodValidator } from '@kanjijs/contracts';
import { AppModule } from '../src/app.module.js';

describe('App E2E', () => {
  let appInstance: any;
  let shutdownHandler: () => Promise<void>;

  beforeAll(async () => {
    const { app, shutdown } = await KanjijsAdapter.create(AppModule, {
      validator: new ZodValidator(),
      logger: false, // Turn off logger to avoid polluting logs
    });
    appInstance = app;
    shutdownHandler = shutdown;
  });

  afterAll(async () => {
    await shutdownHandler();
  });

  it('should respond with 200 on healthcheck', async () => {
    const res = await appInstance.request('/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });
});
```

---

## 3. Database Testing Isolation

When testing modules that interact with database layers, you can swap out target environment variables (like `DATABASE_URL`) to point to a test database and handle schema initialization inside the lifecycle hooks:

```typescript
import { DATABASE_CLIENT } from '@kanjijs/store';

beforeAll(async () => {
  // Use a dedicated local test database
  process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:5433/test_db';

  const { app, container } = await KanjijsAdapter.create(AppModule, {
    validator: new ZodValidator(),
    logger: false,
  });

  const db = await container.resolve(DATABASE_CLIENT, AppModule);
  
  // Apply schema changes
  await db.raw(`CREATE TABLE IF NOT EXISTS users (...)`);
  await db.raw('TRUNCATE TABLE users CASCADE');
});
```
