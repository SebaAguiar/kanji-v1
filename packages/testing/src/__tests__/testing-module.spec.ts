import 'reflect-metadata';
import { describe, it, expect } from 'bun:test';
import { Test } from '../testing.module.js';
import { Injectable, KanjijsModule, Inject } from '@kanjijs/core';

describe('TestingModule Builder', () => {
  it('should compile a testing module and resolve basic providers', async () => {
    @Injectable()
    class HelloService {
      greet() { return 'hello'; }
    }

    @KanjijsModule({
      providers: [HelloService],
    })
    class HelloModule {}

    const module = await Test.createTestingModule({
      imports: [HelloModule],
    }).compile();

    const service = await module.get(HelloService);
    expect(service).toBeInstanceOf(HelloService);
    expect(service.greet()).toBe('hello');
  });

  it('should override registered providers with mock values', async () => {
    const MY_TOKEN = Symbol('MY_TOKEN');

    @Injectable()
    class ConsumerService {
      constructor(
        @Inject(MY_TOKEN) public readonly value: string
      ) {}
    }

    @KanjijsModule({
      providers: [
        { provide: MY_TOKEN, useValue: 'original-value' },
        ConsumerService,
      ],
    })
    class RootModule {}

    const module = await Test.createTestingModule({
      imports: [RootModule],
    })
      .overrideProvider(MY_TOKEN)
      .useValue('mocked-value')
      .compile();

    expect(await module.get(MY_TOKEN)).toBe('mocked-value');
  });
});
