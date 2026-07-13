import type { MongoClient, Db, Document, ObjectId, ClientSession } from 'mongodb';
import { Database, QueryBuilder, DatabaseValue } from '../types';

let MongoLib: typeof import('mongodb') | null = null;

// Helper to attempt converting 24-character hex strings to ObjectId
function toMongoQueryValue(val: DatabaseValue): DatabaseValue | ObjectId {
  if (typeof val === 'string' && val.length === 24 && /^[0-9a-fA-F]{24}$/.test(val)) {
    if (!MongoLib) {
      throw new Error('MongoDB library is not initialized. Ensure connection has been established.');
    }
    return new MongoLib.ObjectId(val);
  }
  return val;
}

// Convert a unified filter { id, ... } into Mongo-compatible filters { _id, ... }
function mapFilters(conditions?: Record<string, DatabaseValue>): Document {
  const query: Document = {};
  if (!conditions) {
    return query;
  }
  for (const [key, val] of Object.entries(conditions)) {
    const mongoKey = key === 'id' ? '_id' : key;
    query[mongoKey] = toMongoQueryValue(val);
  }
  return query;
}

// Normalize a Mongo document by replacing _id with id: string
function normalizeDoc<T>(doc: Document): T {
  const { _id, ...rest } = doc;
  const normalized = {
    id: _id && (typeof _id === 'object' && 'toString' in _id) ? _id.toString() : String(_id),
    ...rest,
  };
  return normalized as T;
}

export class MongoQueryBuilder<T = Record<string, DatabaseValue>> implements QueryBuilder<T> {
  private type: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private fields?: string[];
  private conditions?: Record<string, DatabaseValue>;
  private limitVal?: number;
  private offsetVal?: number;
  private orderByVal?: { field: string; direction: 'asc' | 'desc' };
  private insertData?: Record<string, DatabaseValue> | Record<string, DatabaseValue>[];
  private updateData?: Record<string, DatabaseValue>;

  constructor(
    private db: Db | Promise<Db>,
    private collectionName: string,
    private session?: ClientSession
  ) {}

  select(fields?: string[]): this {
    this.type = 'select';
    this.fields = fields;
    return this;
  }

  where(conditions: Record<string, DatabaseValue>): this {
    this.conditions = conditions;
    return this;
  }

  limit(n: number): this {
    this.limitVal = n;
    return this;
  }

  offset(n: number): this {
    this.offsetVal = n;
    return this;
  }

  orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): this {
    this.orderByVal = { field, direction };
    return this;
  }

  insert(data: Record<string, DatabaseValue> | Record<string, DatabaseValue>[]): this {
    this.type = 'insert';
    this.insertData = data;
    return this;
  }

  update(data: Record<string, DatabaseValue>): this {
    this.type = 'update';
    this.updateData = data;
    return this;
  }

  delete(): this {
    this.type = 'delete';
    return this;
  }

  then<TResult1 = T[], TResult2 = never>(
    onfulfilled?: ((value: T[]) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: Error) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ): Promise<TResult1 | TResult2> {
    const execute = async (): Promise<T[]> => {
      const resolvedDb = await this.db;
      const collection = resolvedDb.collection(this.collectionName);
      const options = this.session ? { session: this.session } : {};
      let result: T[] = [];

      if (this.type === 'select') {
        const query = mapFilters(this.conditions);
        let cursor = collection.find(query, options);

        if (this.fields && this.fields.length > 0) {
          const projection: Document = {};
          for (const f of this.fields) {
            projection[f === 'id' ? '_id' : f] = 1;
          }
          cursor = cursor.project(projection);
        }

        if (this.orderByVal) {
          const sortKey = this.orderByVal.field === 'id' ? '_id' : this.orderByVal.field;
          const sortDir = this.orderByVal.direction === 'desc' ? -1 : 1;
          cursor = cursor.sort({ [sortKey]: sortDir });
        }

        if (this.offsetVal !== undefined) {
          cursor = cursor.skip(this.offsetVal);
        }

        if (this.limitVal !== undefined) {
          cursor = cursor.limit(this.limitVal);
        }

        const docs = await cursor.toArray();
        result = docs.map(normalizeDoc) as T[];
      } else if (this.type === 'insert') {
        if (!this.insertData) {
          throw new Error('Insert data is missing');
        }

        const dataArr = Array.isArray(this.insertData) ? this.insertData : [this.insertData];
        const docsToInsert = dataArr.map((item) => {
          const { id, ...rest } = item;
          const doc: Document = { ...rest };
          if (id) {
            doc._id = toMongoQueryValue(id);
          }
          return doc;
        });

        const insertResult = await collection.insertMany(docsToInsert, options);
        const insertedIds = Object.values(insertResult.insertedIds);

        const docs = await collection.find({ _id: { $in: insertedIds } }, options).toArray();
        result = docs.map(normalizeDoc) as T[];
      } else if (this.type === 'update') {
        if (!this.updateData) {
          throw new Error('Update data is missing');
        }

        const query = mapFilters(this.conditions);
        
        const docsToUpdate = await collection.find(query, options).toArray();
        const idsToUpdate = docsToUpdate.map((d) => d._id);

        if (idsToUpdate.length > 0) {
          const { id, ...updateFields } = this.updateData;
          const updateDoc = { $set: updateFields };

          await collection.updateMany({ _id: { $in: idsToUpdate } }, updateDoc, options);

          const updatedDocs = await collection.find({ _id: { $in: idsToUpdate } }, options).toArray();
          result = updatedDocs.map(normalizeDoc) as T[];
        }
      } else if (this.type === 'delete') {
        const query = mapFilters(this.conditions);

        const docsToDelete = await collection.find(query, options).toArray();
        const idsToDelete = docsToDelete.map((d) => d._id);

        if (idsToDelete.length > 0) {
          await collection.deleteMany({ _id: { $in: idsToDelete } }, options);
          result = docsToDelete.map(normalizeDoc) as T[];
        }
      } else {
        throw new Error(`Unsupported query type: ${this.type}`);
      }

      return result;
    };

    return execute().then(onfulfilled, onrejected);
  }
}

export class MongoDatabase implements Database {
  public clientInstance?: MongoClient;
  public dbInstance?: Db;

  constructor(
    private readonly connectionString: string,
    private readonly dbName?: string
  ) {}

  private async ensureConnected(): Promise<Db> {
    if (this.dbInstance) {
      return this.dbInstance;
    }

    if (!MongoLib) {
      // Injected Bun node:v8 compatibility patch encapsulated inside the adapter
      if (typeof globalThis.Bun !== 'undefined' && globalThis.process) {
        const proc: { getBuiltinModule?: (name: string) => unknown } = globalThis.process as never;
        const originalGetBuiltin = proc.getBuiltinModule;
        if (originalGetBuiltin) {
          proc.getBuiltinModule = function (name: string) {
            if (name === 'v8') {
              return {
                startupSnapshot: {
                  isBuildingSnapshot: () => false
                }
              };
            }
            return originalGetBuiltin.call(this, name);
          };
        }
      }

      MongoLib = await import('mongodb');
    }

    this.clientInstance = new MongoLib.MongoClient(this.connectionString);
    this.dbInstance = this.clientInstance.db(this.dbName);
    return this.dbInstance;
  }

  get query() {
    return new Proxy({}, {
      get: (_target, prop) => {
        if (typeof prop === 'string') {
          return new MongoQueryBuilder(this.ensureConnected(), prop);
        }
        return undefined;
      }
    }) as { [table: string]: QueryBuilder<Record<string, DatabaseValue>> };
  }

  async transaction<T>(fn: (trx: Database) => Promise<T>): Promise<T> {
    const db = await this.ensureConnected();
    if (!MongoLib) {
      throw new Error('Database not initialized');
    }
    const session = this.clientInstance!.startSession();
    try {
      let result: T = undefined as T;
      await session.withTransaction(async () => {
        const trxDb = new MongoDatabase(this.connectionString, this.dbName);
        trxDb.clientInstance = this.clientInstance;
        trxDb.dbInstance = db;
        
        Object.defineProperty(trxDb, 'query', {
          get: () => {
            return new Proxy({}, {
              get: (_target, prop) => {
                if (typeof prop === 'string') {
                  return new MongoQueryBuilder(db, prop, session);
                }
                return undefined;
              }
            });
          }
        });
        
        result = await fn(trxDb);
      });
      return result;
    } finally {
      await session.endSession();
    }
  }

  async raw(query: string, _params?: DatabaseValue[]): Promise<Record<string, DatabaseValue>[]> {
    const db = await this.ensureConnected();
    const commandObj = JSON.parse(query) as Document;
    const res = await db.command(commandObj);
    
    if (res.cursor && res.cursor.firstBatch) {
      const batch = res.cursor.firstBatch as Document[];
      return batch.map(normalizeDoc) as Record<string, DatabaseValue>[];
    }
    
    return [normalizeDoc(res)] as Record<string, DatabaseValue>[];
  }

  async disconnect(): Promise<void> {
    if (this.clientInstance) {
      await this.clientInstance.close();
    }
  }
}
