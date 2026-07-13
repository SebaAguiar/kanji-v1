import 'reflect-metadata';
import { describe, it, expect } from 'bun:test';
import { Container } from '../container.js';
import { Injectable } from '../decorators/injectable.js';
import { KanjijsModule } from '../decorators/module.js';
import { Inject } from '../decorators/inject.js';

describe('DI Container', () => {
  it('should register and resolve a simple injectable provider', async () => {
    const container = new Container({ logger: false });

    @Injectable()
    class DummyService {
      getValue() { return 'dummy'; }
    }

    @KanjijsModule({
      providers: [DummyService],
    })
    class DummyModule {}

    container.bootstrap(DummyModule);

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

    container.bootstrap(CounterModule);

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

    container.bootstrap(ApiModule);

    const api = await container.resolve(ApiService, ApiModule);
    expect(api.config).toBeInstanceOf(ConfigService);
    expect(api.config.port).toBe(8080);
  });

  it('should support custom inject token decorators (@Inject)', async () => {
    const container = new Container({ logger: false });
    const API_KEY = Symbol('API_KEY');

    @Injectable()
    class ClientService {
      constructor(
        @Inject(API_KEY) public readonly apiKey: string
      ) {}
    }

    @KanjijsModule({
      providers: [
        { provide: API_KEY, useValue: 'secret-key-123' },
        ClientService,
      ],
    })
    class ClientModule {}

    container.bootstrap(ClientModule);

    const client = await container.resolve(ClientService, ClientModule);
    expect(client.apiKey).toBe('secret-key-123');
  });

  it('should detect circular dependencies and throw error', async () => {
    const container = new Container({ logger: false });

    @Injectable()
    class ServiceA {
      constructor(@Inject('ServiceB') public readonly b: any) {}
    }

    @Injectable()
    class ServiceB {
      constructor(@Inject('ServiceA') public readonly a: any) {}
    }

    @KanjijsModule({
      providers: [
        { provide: 'ServiceA', useClass: ServiceA },
        { provide: 'ServiceB', useClass: ServiceB },
      ],
    })
    class LoopModule {}

    container.bootstrap(LoopModule);

    expect(async () => {
      await container.resolve('ServiceA', LoopModule);
    }).toThrow(); // Circular dependency throws
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

    container.bootstrap(DbModule);

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

    container.bootstrap(AsyncModule);

    const result = await container.resolve(ASYNC_VAL, AsyncModule);
    expect(result).toBe('hello-world');
  });

  it('should make global module providers visible without explicit imports', async () => {
    const container = new Container({ logger: false });
    const SHARED_VAL = Symbol('SHARED_VAL');

    @KanjijsModule({
      providers: [
        { provide: SHARED_VAL, useValue: 'shared-data-globally' }
      ],
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

    container.bootstrap(ConsumerModule);

    const consumer = await container.resolve(ConsumerService, ConsumerModule);
    expect(consumer.val).toBe('shared-data-globally');
  });
});
