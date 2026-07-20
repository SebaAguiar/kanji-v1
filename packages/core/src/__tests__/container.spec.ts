import 'reflect-metadata';
import { describe, it, expect } from 'bun:test';
import { Container } from '../container.js';
import { Injectable } from '../decorators/injectable.js';
import { KanjijsModule } from '../decorators/module.js';
import { Inject } from '../decorators/inject.js';
import type { OnModuleInit, OnApplicationBootstrap, OnDestroy } from '../types.js';

describe('DI Container', () => {
  it('should register and resolve a simple injectable provider', async () => {
    const container = new Container({ logger: false });

    @Injectable()
    class DummyService {
      getValue() {
        return 'dummy';
      }
    }

    @KanjijsModule({
      providers: [DummyService],
    })
    class DummyModule {}

    await container.bootstrap(DummyModule);

    const instance = await container.resolve(DummyService, DummyModule);
    expect(instance).toBeInstanceOf(DummyService);
    expect(instance.getValue()).toBe('dummy');
  });

  it('should resolve singleton class providers by default', async () => {
    const container = new Container({ logger: false });

    @Injectable()
    class CounterService {
      public count = 0;
    }

    @KanjijsModule({
      providers: [CounterService],
    })
    class CounterModule {}

    await container.bootstrap(CounterModule);

    const inst1 = await container.resolve(CounterService, CounterModule);
    const inst2 = await container.resolve(CounterService, CounterModule);

    inst1.count = 42;
    expect(inst2.count).toBe(42);
    expect(inst1).toBe(inst2);
  });

  it('should inject constructor arguments using design:paramtypes', async () => {
    const container = new Container({ logger: false });

    @Injectable()
    class ConfigService {
      public port = 8080;
    }

    @Injectable()
    class ApiService {
      constructor(public readonly config: ConfigService) {}
    }

    @KanjijsModule({
      providers: [ConfigService, ApiService],
    })
    class ApiModule {}

    await container.bootstrap(ApiModule);

    const api = await container.resolve(ApiService, ApiModule);
    expect(api.config).toBeInstanceOf(ConfigService);
    expect(api.config.port).toBe(8080);
  });

  it('should support custom inject token decorators (@Inject)', async () => {
    const container = new Container({ logger: false });
    const API_KEY = Symbol('API_KEY');

    @Injectable()
    class ClientService {
      constructor(@Inject(API_KEY) public readonly apiKey: string) {}
    }

    @KanjijsModule({
      providers: [{ provide: API_KEY, useValue: 'secret-key-123' }, ClientService],
    })
    class ClientModule {}

    await container.bootstrap(ClientModule);

    const client = await container.resolve(ClientService, ClientModule);
    expect(client.apiKey).toBe('secret-key-123');
  });

  it('should support factory providers (useFactory)', async () => {
    const container = new Container({ logger: false });
    const DSN = Symbol('DSN');
    const CONNECTION = Symbol('CONNECTION');

    @KanjijsModule({
      providers: [
        { provide: DSN, useValue: 'postgres://localhost:5432' },
        {
          provide: CONNECTION,
          useFactory: (dsn: string) => {
            return `connected-to-${dsn}`;
          },
          inject: [DSN],
        },
      ],
    })
    class DbModule {}

    await container.bootstrap(DbModule);

    const conn = await container.resolve(CONNECTION, DbModule);
    expect(conn).toBe('connected-to-postgres://localhost:5432');
  });

  it('should support async factory providers (useFactory returning Promise)', async () => {
    const container = new Container({ logger: false });
    const VALUE = Symbol('VALUE');
    const ASYNC_VAL = Symbol('ASYNC_VAL');

    @KanjijsModule({
      providers: [
        { provide: VALUE, useValue: 'hello' },
        {
          provide: ASYNC_VAL,
          useFactory: async (val: string) => {
            await new Promise((resolve) => setTimeout(resolve, 5));
            return `${val}-world`;
          },
          inject: [VALUE],
        },
      ],
    })
    class AsyncModule {}

    await container.bootstrap(AsyncModule);

    const result = await container.resolve(ASYNC_VAL, AsyncModule);
    expect(result).toBe('hello-world');
  });

  it('should make global module providers visible without explicit imports', async () => {
    const container = new Container({ logger: false });
    const SHARED_VAL = Symbol('SHARED_VAL');

    @KanjijsModule({
      providers: [{ provide: SHARED_VAL, useValue: 'shared-data-globally' }],
      exports: [SHARED_VAL],
      global: true,
    })
    class GlobalModule {}

    @Injectable()
    class ConsumerService {
      constructor(@Inject(SHARED_VAL) public readonly val: string) {}
    }

    @KanjijsModule({
      imports: [GlobalModule],
      providers: [ConsumerService],
    })
    class ConsumerModule {}

    await container.bootstrap(ConsumerModule);

    const consumer = await container.resolve(ConsumerService, ConsumerModule);
    expect(consumer.val).toBe('shared-data-globally');
  });

  it('should execute lifecycle hooks (OnModuleInit, OnApplicationBootstrap, OnDestroy) in correct order', async () => {
    const container = new Container({ logger: false });
    const events: string[] = [];

    @Injectable()
    class LifecycleService implements OnModuleInit, OnApplicationBootstrap, OnDestroy {
      onModuleInit() {
        events.push('init');
      }

      onApplicationBootstrap() {
        events.push('bootstrap');
      }

      onDestroy() {
        events.push('destroy');
      }
    }

    @KanjijsModule({
      providers: [LifecycleService],
    })
    class LifecycleModule {}

    await container.bootstrap(LifecycleModule);
    expect(events).toEqual(['init', 'bootstrap']);

    await container.shutdown();
    expect(events).toEqual(['init', 'bootstrap', 'destroy']);
  });

  // ========== NEW TESTS ==========

  it('should throw an error when resolving a non-visible token', async () => {
    const container = new Container({ logger: false });

    const HIDDEN = Symbol('HIDDEN');

    @KanjijsModule({
      providers: [{ provide: HIDDEN, useValue: 'secret' }],
      // no exports → not visible to other modules
    })
    class SecretModule {}

    @KanjijsModule({
      imports: [SecretModule],
    })
    class ConsumerModule {}

    await container.bootstrap(ConsumerModule);

    await expect(container.resolve(HIDDEN, ConsumerModule)).rejects.toThrow(
      'is not visible in module',
    );
  });

  it('should support recursive module imports', async () => {
    const container = new Container({ logger: false });

    const LEVEL3 = Symbol('LEVEL3');

    @KanjijsModule({
      providers: [{ provide: LEVEL3, useValue: 'deep-value' }],
      exports: [LEVEL3],
    })
    class Level3Module {}

    @KanjijsModule({
      imports: [Level3Module],
    })
    class Level2Module {}

    @KanjijsModule({
      imports: [Level2Module],
    })
    class Level1Module {}

    // Level1 does not import Level3 directly — it's 2 hops away
    await container.bootstrap(Level1Module);
    await expect(container.resolve(LEVEL3, Level1Module)).rejects.toThrow();
  });

  it('should make exported tokens visible one level deep (not transitive)', async () => {
    const container = new Container({ logger: false });
    const DB_CLIENT = Symbol('DB_CLIENT');

    @KanjijsModule({
      providers: [{ provide: DB_CLIENT, useValue: 'pg://localhost' }],
      exports: [DB_CLIENT],
    })
    class DatabaseModule {}

    @KanjijsModule({
      imports: [DatabaseModule],
    })
    class UsersModule {}

    @KanjijsModule({
      imports: [UsersModule],
    })
    class AppModule {}

    await container.bootstrap(AppModule);
    // DB_CLIENT is exported by DatabaseModule, which is imported by UsersModule.
    // AppModule imports UsersModule, not DatabaseModule directly — so DB_CLIENT
    // is NOT visible in AppModule (Kanji does not support transitive visibility).
    await expect(container.resolve(DB_CLIENT, AppModule)).rejects.toThrow(
      'is not visible in module',
    );

    // But it IS visible from UsersModule (direct import)
    const db = await container.resolve(DB_CLIENT, UsersModule);
    expect(db).toBe('pg://localhost');
  });

  it('should handle useClass providers correctly', async () => {
    const container = new Container({ logger: false });
    const SERVICE = Symbol('SERVICE');

    @Injectable()
    class RealService {
      public readonly name = 'real';
    }

    @Injectable()
    class MockService {
      public readonly name = 'mock';
    }

    @KanjijsModule({
      providers: [{ provide: SERVICE, useClass: MockService }],
    })
    class TestModule {}

    await container.bootstrap(TestModule);
    const instance = await container.resolve(SERVICE, TestModule);
    expect(instance).toBeInstanceOf(MockService);
    expect((instance as MockService).name).toBe('mock');
  });

  it('should register and retrieve controllers', async () => {
    const container = new Container({ logger: false });

    @Injectable()
    class UsersController {}

    @KanjijsModule({
      controllers: [UsersController],
    })
    class AppModule {}

    await container.bootstrap(AppModule);
    const controllers = container.getControllers();
    expect(controllers).toHaveLength(1);
    expect(controllers[0].controller).toBe(UsersController);
    expect(controllers[0].module).toBe(AppModule);
  });

  it('should register and retrieve gateways', async () => {
    const container = new Container({ logger: false });

    class ChatGateway {}

    @KanjijsModule({
      gateways: [ChatGateway],
    })
    class AppModule {}

    await container.bootstrap(AppModule);
    const gateways = container.getGateways();
    expect(gateways).toHaveLength(1);
    expect(gateways[0].gateway).toBe(ChatGateway);
    expect(gateways[0].module).toBe(AppModule);
  });

  it('should throw an error when bootstrapping a module without @KanjijsModule', async () => {
    const container = new Container({ logger: false });

    class PlainModule {}

    await expect(container.bootstrap(PlainModule)).rejects.toThrow('missing @KanjijsModule');
  });

  it('should make global module providers visible when module is imported', async () => {
    const container = new Container({ logger: false });
    const DB = Symbol('DB');

    @KanjijsModule({
      providers: [{ provide: DB, useValue: 'global-db' }],
      exports: [DB],
      global: true,
    })
    class GlobalDbModule {}

    @KanjijsModule({
      imports: [GlobalDbModule],
    })
    class AppModule {}

    await container.bootstrap(AppModule);
    const db = await container.resolve(DB, AppModule);
    expect(db).toBe('global-db');
  });

  it('should support dynamic module with providers and exports', async () => {
    const container = new Container({ logger: false });
    const CONFIG = Symbol('CONFIG');

    @KanjijsModule({})
    class ConfigModule {
      static forRoot(config: Record<string, string>) {
        return {
          module: ConfigModule,
          providers: [{ provide: CONFIG, useValue: config }],
          exports: [CONFIG],
        };
      }
    }

    @KanjijsModule({
      imports: [ConfigModule.forRoot({ env: 'test' })],
    })
    class AppModule {}

    await container.bootstrap(AppModule);
    const config = await container.resolve(CONFIG, AppModule);
    expect(config).toEqual({ env: 'test' });
  });

  it('should resolve the same instance for singleton providers (value)', async () => {
    const container = new Container({ logger: false });
    const TOKEN = Symbol('TOKEN');

    @KanjijsModule({
      providers: [{ provide: TOKEN, useValue: { count: 0 } }],
    })
    class SingletonModule {}

    await container.bootstrap(SingletonModule);
    const a = await container.resolve(TOKEN, SingletonModule);
    const b = await container.resolve(TOKEN, SingletonModule);
    (a as Record<string, number>).count = 42;
    expect((b as Record<string, number>).count).toBe(42);
    expect(a).toBe(b);
  });

  it('should detect circular dependencies and throw error', async () => {
    const container = new Container({ logger: false });

    @Injectable()
    class ServiceA {
      constructor(@Inject('ServiceB') public readonly b: unknown) {}
    }

    @Injectable()
    class ServiceB {
      constructor(@Inject('ServiceA') public readonly a: unknown) {}
    }

    @KanjijsModule({
      providers: [
        { provide: 'ServiceA', useClass: ServiceA },
        { provide: 'ServiceB', useClass: ServiceB },
      ],
    })
    class LoopModule {}

    await expect(container.bootstrap(LoopModule)).rejects.toThrow();
  });
});
