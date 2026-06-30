import { KanjijsModule, DynamicModule } from '@kanjijs/core';
import { PostgresDatabase } from './adapters/postgres';
import { MongoDatabase } from './adapters/mongodb';
import { DATABASE_CLIENT, StoreConfig } from './types';
import { Table } from 'drizzle-orm';

@KanjijsModule({
  exports: [DATABASE_CLIENT],
  global: true,
})
export class StoreModule {
  static forRoot(config: StoreConfig): DynamicModule {
    return {
      module: StoreModule,
      providers: [
        {
          provide: DATABASE_CLIENT,
          useFactory: () => {
            if (config.type === 'postgres') {
              const schema = (config.schema || {}) as Record<string, Table>;
              return new PostgresDatabase(config.connectionString, schema);
            } else if (config.type === 'mongodb') {
              return new MongoDatabase(config.connectionString, config.dbName);
            }
            throw new Error(`Unknown database type: ${(config as { type: string }).type}`);
          },
        },
      ],
      exports: [DATABASE_CLIENT],
      global: true,
    };
  }
}
