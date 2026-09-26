export type DatabaseValue = string | number | boolean | null | Date;

/** A single database row: column names mapped to scalar values. */
export type DatabaseRow = Record<string, DatabaseValue>;

export interface QueryBuilder<T = DatabaseRow> {
  select(fields?: string[]): this;
  where(conditions: Record<string, DatabaseValue>): this;
  limit(n: number): this;
  offset(n: number): this;
  orderBy(field: string, direction?: 'asc' | 'desc'): this;

  insert(data: DatabaseRow | DatabaseRow[]): this;
  update(data: DatabaseRow): this;
  delete(): this;

  /** Find a single record by its primary key (id). Resolves to the record or null. */
  findById(id: string | number): Promise<T | null>;
  /** Find a single record matching the given criteria. Resolves to the record or null. */
  findBy(criteria: Record<string, DatabaseValue>): Promise<T | null>;

  // PromiseLike signature: resolves to an array of entity type T
  then<TResult1 = T[], TResult2 = never>(
    onfulfilled?: ((value: T[]) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: Error) => TResult2 | PromiseLike<TResult2>) | undefined | null,
  ): Promise<TResult1 | TResult2>;
}

export interface Database {
  // Proxy dynamically resolves any table name to a generic QueryBuilder
  query: {
    [table: string]: QueryBuilder<DatabaseRow>;
  };

  // Unified transaction support
  transaction<T>(fn: (trx: Database) => Promise<T>): Promise<T>;

  // Safe raw queries
  raw(query: string, params?: DatabaseValue[]): Promise<DatabaseRow[]>;

  // Close connection
  disconnect(): Promise<void>;
}

export const DATABASE_CLIENT = Symbol('DATABASE_CLIENT');

export interface PostgresStoreConfig {
  type: 'postgres';
  connectionString: string;
  schema?: Record<string, object>;
  casing?: 'snake_case' | 'camelCase';
}

export interface MongoStoreConfig {
  type: 'mongodb';
  connectionString: string;
  dbName?: string;
}

export type StoreConfig = PostgresStoreConfig | MongoStoreConfig;
