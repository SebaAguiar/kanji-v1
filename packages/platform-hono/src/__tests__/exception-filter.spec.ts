import 'reflect-metadata';
import { describe, it, expect } from 'bun:test';
import { Hono, type Context } from 'hono';
import { Controller, Get, KanjijsAdapter } from '../index.js';
import { Catch, type ExceptionFilter } from '@kanjijs/common';
import { KanjijsModule, Injectable } from '@kanjijs/core';

class CustomNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CustomNotFoundError';
  }
}

class AnotherUnmatchedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AnotherUnmatchedError';
  }
}

@Catch(CustomNotFoundError)
@Injectable()
class CustomNotFoundFilter implements ExceptionFilter {
  catch(exception: CustomNotFoundError, c: Context) {
    return c.json({ error: 'CUSTOM_NOT_FOUND', message: exception.message }, 404);
  }
}

@Controller('/test')
class TestController {
  @Get('/not-found')
  throwNotFound() {
    throw new CustomNotFoundError('Item not found');
  }

  @Get('/unmatched')
  throwUnmatched() {
    throw new AnotherUnmatchedError('Something went wrong');
  }
}

@KanjijsModule({
  controllers: [TestController],
})
class TestAppModule {}

describe('Exception Filters', () => {
  it('should catch matched exceptions and return custom response', async () => {
    const { app } = await KanjijsAdapter.create(TestAppModule, {
      logger: false,
      exceptionFilters: [CustomNotFoundFilter],
    });

    const res = await app.request('/test/not-found');
    expect(res.status).toBe(404);

    const body = (await res.json()) as any;
    expect(body.error).toBe('CUSTOM_NOT_FOUND');
    expect(body.message).toBe('Item not found');
  });

  it('should fall back to default error handler when exception is not matched', async () => {
    const { app } = await KanjijsAdapter.create(TestAppModule, {
      logger: false,
      exceptionFilters: [CustomNotFoundFilter],
    });

    const res = await app.request('/test/unmatched');
    expect(res.status).toBe(500);

    const body = (await res.json()) as any;
    expect(body.error).toBe('INTERNAL_SERVER_ERROR');
  });
});
