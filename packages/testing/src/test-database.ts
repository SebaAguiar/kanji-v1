import type { Database, DatabaseValue, QueryBuilder } from '@kanjijs/store';

class MockQueryBuilder implements QueryBuilder<Record<string, DatabaseValue>> {
  private data: Record<string, DatabaseValue>[] = [];

  select(_fields?: string[]): this {
    return this;
  }

  where(_conditions: Record<string, DatabaseValue>): this {
    return this;
  }

  limit(_n: number): this {
    return this;
  }

  offset(_n: number): this {
    return this;
  }

  orderBy(_field: string, _direction?: 'asc' | 'desc'): this {
    return this;
  }

  insert(data: Record<string, DatabaseValue> | Record<string, DatabaseValue>[]): this {
    const arr = Array.isArray(data) ? data : [data];
    this.data.push(...arr);
    return this;
  }

  update(data: Record<string, DatabaseValue>): this {
    this.data = this.data.map((item) => ({ ...item, ...data }));
    return this;
  }

  delete(): this {
    const deleted = [...this.data];
    this.data = [];
    void deleted;
    return this;
  }

  clear(): void {
    this.data = [];
  }

  async findById(id: string | number): Promise<Record<string, DatabaseValue> | null> {
    return this.data.find((item) => item.id === id || (item as any).id === id) ?? null;
  }

  async findBy(criteria: Record<string, DatabaseValue>): Promise<Record<string, DatabaseValue> | null> {
    return this.data.find((item) =>
      Object.entries(criteria).every(([key, val]) => item[key] === val)
    ) ?? null;
  }

  then<TResult1 = Record<string, DatabaseValue>[], TResult2 = never>(
    onfulfilled?: ((value: Record<string, DatabaseValue>[]) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: Error) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ): Promise<TResult1 | TResult2> {
    const result = Promise.resolve(this.data);
    if (onfulfilled) {
      return result.then(onfulfilled, onrejected);
    }
    return result as Promise<TResult1 | TResult2>;
  }
}

export function createMockDatabase(): Database {
  const tables = new Map<string, MockQueryBuilder>();

  const getQueryBuilder = (tableName: string): MockQueryBuilder => {
    if (!tables.has(tableName)) {
      tables.set(tableName, new MockQueryBuilder());
    }
    return tables.get(tableName)!;
  };

  const db = {
    query: new Proxy({} as Database['query'], {
      get: (_target, prop) => {
        if (typeof prop === 'string') {
          return getQueryBuilder(prop);
        }
        return undefined;
      },
    }),
    transaction: async <T>(fn: (trx: Database) => Promise<T>): Promise<T> => {
      return fn(createMockDatabase());
    },
    raw: async (_query: string, _params?: DatabaseValue[]): Promise<Record<string, DatabaseValue>[]> => {
      return [];
    },
    disconnect: async (): Promise<void> => {
      tables.clear();
    },
    __tables: tables,
  };

  return db as Database & { __tables: Map<string, MockQueryBuilder> };
}

export function clearMockDatabase(db: Database): void {
  const mockDb = db as { __tables?: Map<string, MockQueryBuilder> };
  if (mockDb.__tables) {
    for (const builder of mockDb.__tables.values()) {
      builder.clear();
    }
    mockDb.__tables.clear();
  }
}
