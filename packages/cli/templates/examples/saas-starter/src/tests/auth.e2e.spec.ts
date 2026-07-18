import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { KanjijsAdapter } from '@kanjijs/platform-hono';
import { DATABASE_CLIENT } from '@kanjijs/store';

describe('SaaS Starter API (E2E)', () => {
  let appInstance: any;
  let db: any;

  const testDbUrl =
    process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@localhost:5433/postgres';

  beforeAll(async () => {
    // Override DATABASE_URL so AppModule bootstraps against the test DB
    process.env.DATABASE_URL = testDbUrl;

    const { AppModule } = await import('../app.module.js');
    const { ZodValidator } = await import('@kanjijs/contracts');

    const { app, container } = await KanjijsAdapter.create(AppModule, {
      logger: false,
      validator: new ZodValidator(),
    });

    appInstance = app;
    db = await container.resolve(DATABASE_CLIENT, AppModule);

    // Schema initialization via resolved DATABASE_CLIENT
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

    // Clean tables
    await db.raw('TRUNCATE TABLE users, organizations, organization_members, teams, subscriptions CASCADE');
  });

  afterAll(async () => {
    // Drop tables safely and disconnect
    await db.raw('DROP TABLE IF EXISTS subscriptions, teams, organization_members, organizations, users');
    await db.disconnect();
  });

  let tokenUserA: string;
  let tokenUserB: string;
  let orgId: string;

  it('should register User A', async () => {
    const response = await appInstance.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'usera@example.com',
        name: 'User A',
        password: 'password123',
      }),
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.token).toBeString();
    expect(body.user.email).toBe('usera@example.com');
    tokenUserA = body.token;
  });

  it('should register User B', async () => {
    const response = await appInstance.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'userb@example.com',
        name: 'User B',
        password: 'password123',
      }),
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    tokenUserB = body.token;
  });

  it('should allow User A to create an Organization', async () => {
    const response = await appInstance.request('/organizations/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenUserA}`,
      },
      body: JSON.stringify({ name: 'Org A' }),
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.id).toBeString();
    expect(body.name).toBe('Org A');
    orgId = body.id;
  });

  it('should allow User A to read Org A details', async () => {
    const response = await appInstance.request(`/organizations/${orgId}`, {
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.name).toBe('Org A');
  });

  it('should block User B from reading Org A details (ACL block)', async () => {
    const response = await appInstance.request(`/organizations/${orgId}`, {
      headers: { Authorization: `Bearer ${tokenUserB}` },
    });

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('Forbidden');
  });

  it('should allow User A to create a Team inside Org A', async () => {
    const response = await appInstance.request(`/organizations/${orgId}/teams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenUserA}`,
      },
      body: JSON.stringify({ name: 'Engineering' }),
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.id).toBeString();
    expect(body.name).toBe('Engineering');
  });

  it('should block User B from creating a Team in Org A (ACL block)', async () => {
    const response = await appInstance.request(`/organizations/${orgId}/teams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenUserB}`,
      },
      body: JSON.stringify({ name: 'Marketing' }),
    });

    expect(response.status).toBe(403);
  });

  it('should allow User A to list Teams in Org A', async () => {
    const response = await appInstance.request(`/organizations/${orgId}/teams`, {
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toBeArray();
    expect(body.length).toBe(1);
    expect(body[0].name).toBe('Engineering');
  });

  it('should block User B from listing Teams in Org A', async () => {
    const response = await appInstance.request(`/organizations/${orgId}/teams`, {
      headers: { Authorization: `Bearer ${tokenUserB}` },
    });

    expect(response.status).toBe(403);
  });

  it('should allow User A to view the billing plan for Org A', async () => {
    const response = await appInstance.request(`/billing/plan?orgId=${orgId}`, {
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.plan).toBe('free');
    expect(body.status).toBe('active');
  });

  it('should allow User A to upgrade the billing plan to pro', async () => {
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
    const body = await response.json();
    expect(body.plan).toBe('pro');
  });

  it('should block User B from upgrading Org A billing plan (not admin/member)', async () => {
    const response = await appInstance.request('/billing/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenUserB}`,
      },
      body: JSON.stringify({
        orgId,
        plan: 'pro',
      }),
    });

    expect(response.status).toBe(403);
  });
});
