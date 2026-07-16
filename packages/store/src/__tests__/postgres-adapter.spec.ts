import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { pgTable, varchar, serial } from 'drizzle-orm/pg-core';
import { PostgresDatabase } from '../adapters/postgres.js';

const testUsersTable = pgTable('test_users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
});

describe('PostgresDatabase Adapter (Integration)', () => {
  const connectionString =
    process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@localhost:5433/kanji_core_test';

  const db = new PostgresDatabase(connectionString, {
    testUsers: testUsersTable,
  });

  beforeAll(async () => {
    // Setup test table using raw query before running test assertions
    await db.raw(`
      CREATE TABLE IF NOT EXISTS test_users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL
      )
    `);
  });

  afterAll(async () => {
    // Teardown test table and close driver connections safely
    await db.raw('DROP TABLE IF EXISTS test_users');
    await db.disconnect();
  });

  it('should insert a record and return it via drizzle proxy', async () => {
    const records = await db.query.testUsers.insert({
      name: 'Integration User',
    });

    expect(records).toBeArray();
    expect(records).toHaveLength(1);
    expect(records[0].name).toBe('Integration User');
    expect(records[0].id).toBeDefined();
  });

  it('should retrieve inserted records from database using select()', async () => {
    const list = await db.query.testUsers.select();
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list.find((r) => r.name === 'Integration User')).toBeDefined();
  });

  it('should perform transactions correctly', async () => {
    await db.transaction(async (trx) => {
      await trx.query.testUsers.insert({ name: 'Tx User 1' });
      await trx.query.testUsers.insert({ name: 'Tx User 2' });
    });

    const all = await db.query.testUsers.select();
    expect(all.find((r) => r.name === 'Tx User 1')).toBeDefined();
    expect(all.find((r) => r.name === 'Tx User 2')).toBeDefined();
  });
});
