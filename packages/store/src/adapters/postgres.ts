import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, and, asc, desc, Table } from 'drizzle-orm';
import { PgTable, PgColumn } from 'drizzle-orm/pg-core';
import { Database, QueryBuilder, DatabaseValue } from '../types';

export class PostgresQueryBuilder<T = Record<string, DatabaseValue>> implements QueryBuilder<T> {
  private type: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private fields?: string[];
  private conditions?: Record<string, DatabaseValue>;
  private limitVal?: number;
  private offsetVal?: number;
  private orderByVal?: { field: string; direction: 'asc' | 'desc' };
  private insertData?: Record<string, DatabaseValue> | Record<string, DatabaseValue>[];
  private updateData?: Record<string, DatabaseValue>;

  constructor(
    private db: PostgresJsDatabase<Record<string, never>>,
    private table: PgTable,
    private tableName: string,
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

  async findById(id: string | number): Promise<T | null> {
    this.type = 'select';
    this.conditions = { id: id as DatabaseValue };
    this.limitVal = 1;
    const results = await this.then();
    return results[0] ?? null;
  }

  async findBy(criteria: Record<string, DatabaseValue>): Promise<T | null> {
    this.type = 'select';
    this.conditions = criteria;
    this.limitVal = 1;
    const results = await this.then();
    return results[0] ?? null;
  }

  then<TResult1 = T[], TResult2 = never>(
    onfulfilled?: ((value: T[]) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: Error) => TResult2 | PromiseLike<TResult2>) | undefined | null,
  ): Promise<TResult1 | TResult2> {
    const execute = async (): Promise<T[]> => {
      let result: T[];

      if (this.type === 'select') {
        let baseQuery;

        if (this.fields && this.fields.length > 0) {
          const tableWithIndex = this.table as object as Record<string, PgColumn>;
          const selection: Record<string, PgColumn> = {};

          for (const field of this.fields) {
            const column = tableWithIndex[field];
            if (!column) {
              throw new Error(`Column '${field}' not found on table '${this.tableName}'`);
            }
            selection[field] = column;
          }

          baseQuery = this.db.select(selection).from(this.table);
        } else {
          baseQuery = this.db.select().from(this.table);
        }

        if (this.conditions) {
          const filters = Object.entries(this.conditions).map(([key, val]) => {
            const tableWithIndex = this.table as object as Record<string, PgColumn>;
            const column = tableWithIndex[key];
            if (!column) {
              throw new Error(`Column '${key}' not found on table '${this.tableName}'`);
            }
            return eq(column, val);
          });
          if (filters.length > 0) {
            baseQuery = baseQuery.where(and(...filters)) as typeof baseQuery;
          }
        }

        if (this.orderByVal) {
          const tableWithIndex = this.table as object as Record<string, PgColumn>;
          const column = tableWithIndex[this.orderByVal.field];
          if (!column) {
            throw new Error(
              `Column '${this.orderByVal.field}' not found on table '${this.tableName}'`,
            );
          }
          const orderFn = this.orderByVal.direction === 'desc' ? desc(column) : asc(column);
          baseQuery = baseQuery.orderBy(orderFn) as typeof baseQuery;
        }

        if (this.limitVal !== undefined) {
          baseQuery = baseQuery.limit(this.limitVal) as typeof baseQuery;
        }

        if (this.offsetVal !== undefined) {
          baseQuery = baseQuery.offset(this.offsetVal) as typeof baseQuery;
        }

        const rows = await baseQuery;
        result = rows as T[];
      } else if (this.type === 'insert') {
        if (!this.insertData) {
          throw new Error('Insert data is missing');
        }
        const insertQuery = this.db
          .insert(this.table)
          .values(this.insertData as Record<string, DatabaseValue>);
        const rows = await insertQuery.returning();
        result = rows as T[];
      } else if (this.type === 'update') {
        if (!this.updateData) {
          throw new Error('Update data is missing');
        }
        let updateQuery = this.db.update(this.table).set(this.updateData);

        if (this.conditions) {
          const filters = Object.entries(this.conditions).map(([key, val]) => {
            const tableWithIndex = this.table as object as Record<string, PgColumn>;
            const column = tableWithIndex[key];
            if (!column) {
              throw new Error(`Column '${key}' not found on table '${this.tableName}'`);
            }
            return eq(column, val);
          });
          if (filters.length > 0) {
            updateQuery = updateQuery.where(and(...filters)) as typeof updateQuery;
          }
        }
        const rows = await updateQuery.returning();
        result = rows as T[];
      } else if (this.type === 'delete') {
        let deleteQuery = this.db.delete(this.table);

        if (this.conditions) {
          const filters = Object.entries(this.conditions).map(([key, val]) => {
            const tableWithIndex = this.table as object as Record<string, PgColumn>;
            const column = tableWithIndex[key];
            if (!column) {
              throw new Error(`Column '${key}' not found on table '${this.tableName}'`);
            }
            return eq(column, val);
          });
          if (filters.length > 0) {
            deleteQuery = deleteQuery.where(and(...filters)) as typeof deleteQuery;
          }
        }
        const rows = await deleteQuery.returning();
        result = rows as T[];
      } else {
        throw new Error(`Unsupported query type: ${this.type}`);
      }

      return result;
    };

    return execute().then(onfulfilled, onrejected);
  }
}

export class PostgresDatabase implements Database {
  public db: PostgresJsDatabase<Record<string, never>>;
  private client: ReturnType<typeof postgres>;
  private schema: Record<string, Table>;

  constructor(connectionString: string, schema: Record<string, Table> = {}) {
    this.client = postgres(connectionString);
    this.schema = schema;
    this.db = drizzle(this.client);
  }

  get query() {
    return new Proxy(
      {},
      {
        get: (_target, prop) => {
          if (typeof prop === 'string') {
            const table = this.schema[prop];
            if (!table) {
              throw new Error(
                `Table '${prop}' not found in Drizzle schema. Make sure it is exported.`,
              );
            }
            return new PostgresQueryBuilder(this.db, table as PgTable, prop);
          }
          return undefined;
        },
      },
    ) as { [table: string]: QueryBuilder<Record<string, DatabaseValue>> };
  }

  async transaction<T>(fn: (trx: Database) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      const trxDb = new PostgresDatabase('', this.schema);
      trxDb.db = tx as typeof trxDb.db;
      return fn(trxDb);
    });
  }

  async raw(query: string, params?: DatabaseValue[]): Promise<Record<string, DatabaseValue>[]> {
    // Use PostgresJS client to execute raw queries
    const rows = await this.client.unsafe(query, params as string[]);
    return rows as Record<string, DatabaseValue>[];
  }

  async disconnect(): Promise<void> {
    await this.client.end();
  }
}
