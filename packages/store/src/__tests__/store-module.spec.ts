import { describe, it, expect } from 'bun:test';
import { StoreModule } from '../store.module.js';
import { DATABASE_CLIENT } from '../types.js';

describe('StoreModule', () => {
  it('forRoot with postgres should return a DynamicModule', () => {
    const mod = StoreModule.forRoot({
      type: 'postgres',
      connectionString: 'postgres://localhost:5432/test',
    });

    expect(mod.module).toBe(StoreModule);
    expect(mod.global).toBe(true);
    expect(mod.providers).toBeDefined();
    expect(mod.providers!.length).toBe(1);
    expect(mod.providers![0]).toMatchObject({
      provide: DATABASE_CLIENT,
      useFactory: expect.any(Function),
    });
    expect(mod.exports).toContain(DATABASE_CLIENT);
  });

  it('forRoot with mongodb should return a DynamicModule', () => {
    const mod = StoreModule.forRoot({
      type: 'mongodb',
      connectionString: 'mongodb://localhost:27017/test',
      dbName: 'kanji-test',
    });

    expect(mod.module).toBe(StoreModule);
    expect(mod.global).toBe(true);
    expect(mod.providers).toBeDefined();
    expect(mod.providers!.length).toBe(1);
    expect(mod.providers![0]).toMatchObject({
      provide: DATABASE_CLIENT,
    });
    expect(mod.exports).toContain(DATABASE_CLIENT);
  });
});
