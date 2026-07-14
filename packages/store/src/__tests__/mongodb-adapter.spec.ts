import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { MongoDatabase } from '../adapters/mongodb.js';

const connectionString = process.env.TEST_MONGODB_URL;

if (!connectionString) {
  describe('MongoDatabase Adapter', () => {
    it('skipped — set TEST_MONGODB_URL env var to run integration tests', () => {});
  });
} else {
describe('MongoDatabase Adapter (Integration)', () => {
  const COLLECTION = 'test_users';
  const db = new MongoDatabase(connectionString, 'kanji_test');

  beforeAll(async () => {
    // Create a clean collection for tests
    try {
      await db.raw(JSON.stringify({ create: COLLECTION }));
    } catch {
      // Collection may already exist; drop and recreate for clean state
      await db.raw(JSON.stringify({ drop: COLLECTION }));
      await db.raw(JSON.stringify({ create: COLLECTION }));
    }
  });

  afterAll(async () => {
    try {
      await db.raw(JSON.stringify({ drop: COLLECTION }));
    } catch {
      // Ignore if drop fails during teardown
    }
    await db.disconnect();
  });

  describe('insert', () => {
    it('should insert a single record and return it with id as string', async () => {
      const docs = await db.query[COLLECTION].insert({ name: 'Alice', age: 30 });

      expect(docs).toBeArray();
      expect(docs).toHaveLength(1);
      expect(docs[0].name).toBe('Alice');
      expect(docs[0].age).toBe(30);
      expect(typeof docs[0].id).toBe('string');
      expect(docs[0]._id).toBeUndefined();
    });

    it('should insert multiple records at once', async () => {
      const docs = await db.query[COLLECTION].insert([
        { name: 'Bob', age: 25 },
        { name: 'Charlie', age: 35 },
      ]);

      expect(docs).toHaveLength(2);
      expect(docs.map(d => d.name).sort()).toEqual(['Bob', 'Charlie']);
    });

    it('should preserve the provided id', async () => {
      const customId = '507f1f77bcf86cd799439011';
      const docs = await db.query[COLLECTION].insert({ id: customId, name: 'Custom' });

      expect(docs).toHaveLength(1);
      expect(docs[0].id).toBe(customId);
    });
  });

  describe('select', () => {
    it('should return all documents in the collection', async () => {
      const docs = await db.query[COLLECTION].select();

      expect(docs.length).toBeGreaterThanOrEqual(3);
      expect(docs.every(d => typeof d.id === 'string')).toBeTrue();
    });

    it('should select specific fields when projected', async () => {
      const docs = await db.query[COLLECTION].select(['name']);

      expect(docs.length).toBeGreaterThan(0);
      for (const doc of docs) {
        expect(doc.name).toBeDefined();
      }
    });
  });

  describe('where', () => {
    it('should filter documents by field value', async () => {
      const docs = await db.query[COLLECTION].where({ name: 'Alice' }).select();

      expect(docs).toHaveLength(1);
      expect(docs[0].name).toBe('Alice');
    });

    it('should filter documents by id (auto-convert to _id)', async () => {
      const all = await db.query[COLLECTION].select();
      const targetId = all[0].id;

      const docs = await db.query[COLLECTION].where({ id: targetId }).select();

      expect(docs).toHaveLength(1);
      expect(docs[0].id).toBe(targetId);
    });

    it('should return empty array when no document matches', async () => {
      const docs = await db.query[COLLECTION].where({ name: 'NonExistent' }).select();

      expect(docs).toBeArray();
      expect(docs).toHaveLength(0);
    });
  });

  describe('findById', () => {
    it('should find a document by its id', async () => {
      const all = await db.query[COLLECTION].select();
      const targetId = all[0].id;

      const doc = await db.query[COLLECTION].findById(targetId);

      expect(doc).not.toBeNull();
      expect(doc!.id).toBe(targetId);
    });

    it('should return null when id does not exist', async () => {
      const doc = await db.query[COLLECTION].findById('000000000000000000000000');

      expect(doc).toBeNull();
    });
  });

  describe('findBy', () => {
    it('should find a document matching criteria', async () => {
      const doc = await db.query[COLLECTION].findBy({ name: 'Alice' });

      expect(doc).not.toBeNull();
      expect(doc!.name).toBe('Alice');
    });

    it('should return null when no document matches', async () => {
      const doc = await db.query[COLLECTION].findBy({ name: 'NonExistent' });

      expect(doc).toBeNull();
    });
  });

  describe('update', () => {
    it('should update matching documents and return them', async () => {
      const docs = await db.query[COLLECTION].where({ name: 'Alice' }).update({ age: 31 });

      expect(docs).toHaveLength(1);
      expect(docs[0].age).toBe(31);
      expect(docs[0].name).toBe('Alice');
    });

    it('should return empty array when no document matches update', async () => {
      const docs = await db.query[COLLECTION].where({ name: 'NonExistent' }).update({ age: 99 });

      expect(docs).toBeArray();
      expect(docs).toHaveLength(0);
    });
  });

  describe('delete', () => {
    it('should delete matching documents and return them', async () => {
      const docs = await db.query[COLLECTION].where({ name: 'Charlie' }).delete();

      expect(docs).toHaveLength(1);
      expect(docs[0].name).toBe('Charlie');

      // Verify deletion
      const remaining = await db.query[COLLECTION].where({ name: 'Charlie' }).select();
      expect(remaining).toHaveLength(0);
    });

    it('should return empty array when no document matches delete', async () => {
      const docs = await db.query[COLLECTION].where({ name: 'NonExistent' }).delete();

      expect(docs).toBeArray();
      expect(docs).toHaveLength(0);
    });
  });

  describe('orderBy / limit / offset', () => {
    it('should order results ascending', async () => {
      const docs = await db.query[COLLECTION].orderBy('name', 'asc').select();

      expect(docs.length).toBeGreaterThan(1);
      for (let i = 1; i < docs.length; i++) {
        expect(docs[i - 1].name <= docs[i].name).toBeTrue();
      }
    });

    it('should limit the number of results', async () => {
      const docs = await db.query[COLLECTION].limit(1).select();

      expect(docs).toHaveLength(1);
    });

    it('should offset results', async () => {
      const all = await db.query[COLLECTION].select();
      const offset = await db.query[COLLECTION].offset(1).select();

      expect(offset.length).toBe(all.length - 1);
    });
  });

  describe('transaction', () => {
    it('should execute operations atomically within a transaction', async () => {
      await db.transaction(async (trx) => {
        await trx.query[COLLECTION].insert({ name: 'TransactionUser1' });
        await trx.query[COLLECTION].insert({ name: 'TransactionUser2' });
      });

      const found1 = await db.query[COLLECTION].findBy({ name: 'TransactionUser1' });
      const found2 = await db.query[COLLECTION].findBy({ name: 'TransactionUser2' });

      expect(found1).not.toBeNull();
      expect(found2).not.toBeNull();
    });
  });
});
}
