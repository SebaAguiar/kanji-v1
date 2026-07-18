import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { KanjijsAdapter } from '@kanjijs/platform-hono';
import { DATABASE_CLIENT } from '@kanjijs/store';
import { SessionProvider } from '@kanjijs/auth';

describe('Users API (E2E)', () => {
  let appInstance: any;
  let db: any;
  let sessionProvider: any;

  const testDbUrl =
    process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@localhost:5433/kanji_core_test';

  beforeAll(async () => {
    // Override DATABASE_URL so AppModule bootstraps against the test DB (port 5433)
    process.env.DATABASE_URL = testDbUrl;

    // Dynamically import AppModule so the class decorator parses the overridden process.env.DATABASE_URL
    const { AppModule } = await import('../app.module.js');

    const { ZodValidator } = await import('@kanjijs/contracts');

    const { app, container } = await KanjijsAdapter.create(AppModule, {
      logger: false,
      validator: new ZodValidator(),
    });

    appInstance = app;
    db = await container.resolve(DATABASE_CLIENT, AppModule);
    sessionProvider = await container.resolve(SessionProvider, AppModule);

    // Direct Postgres connection via resolved DATABASE_CLIENT to seed the schema
    await db.raw(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL
      )
    `);

    // Clean table to prevent test contamination
    await db.raw('TRUNCATE TABLE users CASCADE');
  });

  afterAll(async () => {
    // Teardown connections and drop table safely
    await db.raw('DROP TABLE IF EXISTS users');
    await db.disconnect();
  });

  it('should create a new user via POST /users', async () => {
    const response = await appInstance.request('/users/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'e2e@example.com',
        name: 'E2E User',
      }),
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.id).toBeString();
    expect(body.email).toBe('e2e@example.com');
    expect(body.name).toBe('E2E User');
  });

  it('should return all users via GET /users', async () => {
    const response = await appInstance.request('/users/');
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toBeArray();
    expect(body.length).toBeGreaterThanOrEqual(1);
    expect(body[0].email).toBe('e2e@example.com');
  });

  it('should block GET /users/me without Bearer token', async () => {
    const response = await appInstance.request('/users/me');
    expect(response.status).toBe(401);
  });

  it('should allow GET /users/me with valid JWT session', async () => {
    const token = sessionProvider.createToken(
      {
        userId: 'session-id-e2e',
        email: 'e2e@example.com',
        name: 'E2E User',
        roles: [],
        scopes: [],
      },
      300,
    );

    const response = await appInstance.request('/users/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.id).toBe('session-id-e2e');
    expect(body.email).toBe('e2e@example.com');
  });

  describe('POST /auth/refresh', () => {
    it('should refresh a valid token', async () => {
      const token = sessionProvider.createToken(
        {
          userId: 'refresh-user',
          email: 'refresh@example.com',
          name: 'Refresh User',
          roles: [],
          scopes: [],
        },
        300,
      );

      const response = await appInstance.request('/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.token).toBeString();

      const verified = sessionProvider.verifyToken(body.token);
      expect(verified).not.toBeNull();
      expect(verified!.userId).toBe('refresh-user');
    });

    it('should fail to refresh an expired token', async () => {
      const token = sessionProvider.createToken(
        {
          userId: 'refresh-user',
          email: 'refresh@example.com',
          name: 'Refresh User',
          roles: [],
          scopes: [],
        },
        0,
      );

      // wait to expire
      await new Promise((resolve) => setTimeout(resolve, 10));

      const response = await appInstance.request('/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    });

    it('should fail to refresh a tampered token', async () => {
      const response = await appInstance.request('/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: 'bad-token' }),
      });

      expect(response.status).toBe(401);
    });
  });
});
