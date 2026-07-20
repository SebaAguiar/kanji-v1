import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { KanjijsAdapter } from '@kanjijs/platform-hono';
import { DATABASE_CLIENT } from '@kanjijs/store';

describe('Users API (E2E)', () => {
  let appInstance: any;
  let db: any;
  let token: string;

  const testDbUrl =
    process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@localhost:5433/postgres';

  beforeAll(async () => {
    process.env.DATABASE_URL = testDbUrl;

    const { AppModule } = await import('../../../app.module.js');
    const { ZodValidator } = await import('@kanjijs/contracts');


    const { app, container } = await KanjijsAdapter.create(AppModule, {
      logger: false,
      validator: new ZodValidator(),
    });

    appInstance = app;
    db = await container.resolve(DATABASE_CLIENT, AppModule);

    await db.raw(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'user',
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    await db.raw('TRUNCATE TABLE users CASCADE');

    // Registrar un usuario de prueba
    const response = await appInstance.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'user.test@example.com',
        name: 'Test User',
        password: 'password123',
      }),
    });
    const body = (await response.json()) as { token: string };
    token = body.token;
  });

  afterAll(async () => {
    await db.raw('DROP TABLE IF EXISTS users CASCADE');
    await db.disconnect();
  });

  it('should get current user profile (GET /users/me)', async () => {
    const response = await appInstance.request('/users/me', {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { email: string; name: string };
    expect(body.email).toBe('user.test@example.com');
    expect(body.name).toBe('Test User');
  });

  it('should update current user profile (PATCH /users/me)', async () => {
    const response = await appInstance.request('/users/me', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: 'Updated Name',
      }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { name: string };
    expect(body.name).toBe('Updated Name');

    // Verificar cambios en un GET posterior
    const getResponse = await appInstance.request('/users/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const getBody = (await getResponse.json()) as { name: string };
    expect(getBody.name).toBe('Updated Name');
  });
});
