import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { KanjijsAdapter } from '@kanjijs/platform-hono';
import { DATABASE_CLIENT } from '@kanjijs/store';

describe('Billing API (E2E)', () => {
  let appInstance: any;
  let db: any;
  let tokenUserA: string;
  let tokenUserB: string;
  let orgId: string;

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

    await db.raw(`
      CREATE TABLE IF NOT EXISTS organizations (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    await db.raw(`
      CREATE TABLE IF NOT EXISTS organization_members (
        id VARCHAR(255) PRIMARY KEY,
        organization_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    await db.raw(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id VARCHAR(255) PRIMARY KEY,
        organization_id VARCHAR(255) NOT NULL,
        plan VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL,
        expires_at TIMESTAMP NOT NULL
      )
    `);

    await db.raw('TRUNCATE TABLE users, organizations, organization_members, subscriptions CASCADE');

    // Registrar Usuario A
    const resA = await appInstance.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'usera.billing@example.com',
        name: 'User A Billing',
        password: 'password123',
      }),
    });
    tokenUserA = ((await resA.json()) as { token: string }).token;

    // Registrar Usuario B
    const resB = await appInstance.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'userb.billing@example.com',
        name: 'User B Billing',
        password: 'password123',
      }),
    });
    tokenUserB = ((await resB.json()) as { token: string }).token;

    // Crear Organización para el test
    const resOrg = await appInstance.request('/organizations/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenUserA}`,
      },
      body: JSON.stringify({ name: 'Billing Test Org' }),
    });
    orgId = ((await resOrg.json()) as { id: string }).id;
  });

  afterAll(async () => {
    await db.raw('DROP TABLE IF EXISTS subscriptions, organization_members, organizations, users CASCADE');
    await db.disconnect();
  });

  it('should view the initial billing plan for the organization (GET /billing/plan)', async () => {
    const response = await appInstance.request(`/billing/plan?orgId=${orgId}`, {
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { plan: string; status: string };
    expect(body.plan).toBe('free');
    expect(body.status).toBe('active');
  });

  it('should allow User A to upgrade organization to pro (POST /billing/subscribe)', async () => {
    const response = await appInstance.request('/billing/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenUserA}`,
      },
      body: JSON.stringify({
        orgId,
        plan: 'pro',
      }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { plan: string };
    expect(body.plan).toBe('pro');

    // Verificar en base de datos el cambio de plan
    const checkResponse = await appInstance.request(`/billing/plan?orgId=${orgId}`, {
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });
    const checkBody = (await checkResponse.json()) as { plan: string };
    expect(checkBody.plan).toBe('pro');
  });

  it('should block User B from upgrading billing plan (POST /billing/subscribe)', async () => {
    const response = await appInstance.request('/billing/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenUserB}`,
      },
      body: JSON.stringify({
        orgId,
        plan: 'enterprise',
      }),
    });

    expect(response.status).toBe(403);
  });
});
