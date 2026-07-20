import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { KanjijsAdapter } from '@kanjijs/platform-hono';
import { DATABASE_CLIENT } from '@kanjijs/store';

describe('Organizations API (E2E)', () => {
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
      CREATE TABLE IF NOT EXISTS teams (
        id VARCHAR(255) PRIMARY KEY,
        organization_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
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

    await db.raw('TRUNCATE TABLE users, organizations, organization_members, teams, subscriptions CASCADE');

    // Registrar Usuario A
    const resA = await appInstance.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'usera.orgs@example.com',
        name: 'User A Orgs',
        password: 'password123',
      }),
    });
    tokenUserA = ((await resA.json()) as { token: string }).token;

    // Registrar Usuario B
    const resB = await appInstance.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'userb.orgs@example.com',
        name: 'User B Orgs',
        password: 'password123',
      }),
    });
    tokenUserB = ((await resB.json()) as { token: string }).token;
  });

  afterAll(async () => {
    await db.raw('DROP TABLE IF EXISTS subscriptions, teams, organization_members, organizations, users CASCADE');
    await db.disconnect();
  });

  it('should allow User A to create an Organization', async () => {
    const response = await appInstance.request('/organizations/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenUserA}`,
      },
      body: JSON.stringify({ name: 'Alpha Org' }),
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as { id: string; name: string };
    expect(body.id).toBeString();
    expect(body.name).toBe('Alpha Org');
    orgId = body.id;
  });

  it('should allow User A to list their organizations', async () => {
    const response = await appInstance.request('/organizations/', {
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as Array<{ id: string; name: string }>;
    expect(body).toBeArray();
    expect(body.length).toBe(1);
    expect(body[0].name).toBe('Alpha Org');
  });

  it('should allow User A to read details of Alpha Org', async () => {
    const response = await appInstance.request(`/organizations/${orgId}`, {
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { name: string };
    expect(body.name).toBe('Alpha Org');
  });

  it('should block User B from reading details of Alpha Org', async () => {
    const response = await appInstance.request(`/organizations/${orgId}`, {
      headers: { Authorization: `Bearer ${tokenUserB}` },
    });

    expect(response.status).toBe(403);
  });
});
