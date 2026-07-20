import { describe, it, expect } from 'bun:test';
import { z } from 'zod';

describe('env()', () => {
  it('should read and validate env vars, cache values, and register schemas', async () => {
    process.env.TEST_E2E = 'hello';
    const mod = await import('../env.js');

    // Read
    const result = mod.env('TEST_E2E', z.string().min(1));
    expect(result).toBe('hello');

    // Cache (same call returns same value)
    const cached = mod.env('TEST_E2E', z.string());
    expect(cached).toBe('hello');

    // Schema registered
    const schemas = mod.getRegisteredEnvs();
    expect(schemas.has('TEST_E2E')).toBe(true);

    // No errors so far
    expect(() => mod.assertEnvValid()).not.toThrow();
  });

  it('should accumulate errors and fail on assertEnvValid', async () => {
    process.env.BAD_NUM = 'not-a-number';
    const mod = await import('../env.js');

    const result = mod.env('BAD_NUM', z.number());
    expect(result).toBeUndefined();
  });
});
