export type DatabaseValue = string | number | boolean | null | Date;

export interface QueryBuilder<T = Record<string, DatabaseValue>> {
  // Configuración de la consulta
  select(fields?: string[]): this;
  where(conditions: Record<string, DatabaseValue>): this;
  limit(n: number): this;
  offset(n: number): this;
  orderBy(field: string, direction?: 'asc' | 'desc'): this;

  // Acciones de escritura
  insert(data: Record<string, DatabaseValue> | Record<string, DatabaseValue>[]): this;
  update(data: Record<string, DatabaseValue>): this;
  delete(): this;

  // Firma PromiseLike: resuelve a un array del tipo de entidad genérico T
  then<TResult1 = T[], TResult2 = never>(
    onfulfilled?: ((value: T[]) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: Error) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ): Promise<TResult1 | TResult2>;
}

export interface Database {
  // El Proxy resolverá dinámicamente cualquier nombre de tabla a un QueryBuilder genérico
  query: {
    [table: string]: QueryBuilder<Record<string, DatabaseValue>>;
  };
  
  // Soporte unificado de transacciones.
  transaction<T>(fn: (trx: Database) => Promise<T>): Promise<T>;
  
  // Queries crudas seguras
  raw(query: string, params?: DatabaseValue[]): Promise<Record<string, DatabaseValue>[]>;
  
  // Cerrar conexiones
  disconnect(): Promise<void>;
}

export const DATABASE_CLIENT = Symbol('DATABASE_CLIENT');

export interface PostgresStoreConfig {
  type: 'postgres';
  connectionString: string;
  schema?: Record<string, object>;
}

export interface MongoStoreConfig {
  type: 'mongodb';
  connectionString: string;
  dbName?: string;
}

export type StoreConfig = PostgresStoreConfig | MongoStoreConfig;
