import { describe, it, expect } from 'bun:test';
import { FixtureSet } from '../fixtures.js';

describe('FixtureSet', () => {
  const USER_TOKEN = Symbol('USER');

  it('should register and return a fixture instance', async () => {
    const set = new FixtureSet();
    set.register({
      token: USER_TOKEN,
      factory: () => ({ id: '1', name: 'Alice' }),
    });

    const user = await set.get(USER_TOKEN);
    expect(user).toEqual({ id: '1', name: 'Alice' });
  });

  it('should throw when getting an unregistered fixture', async () => {
    const set = new FixtureSet();
    const UNKNOWN = Symbol('UNKNOWN');

    await expect(set.get(UNKNOWN)).rejects.toThrow('No fixture registered');
  });

  it('should cache the instance on first get', async () => {
    const set = new FixtureSet();
    let callCount = 0;

    set.register({
      token: USER_TOKEN,
      factory: () => {
        callCount++;
        return { id: String(callCount) };
      },
    });

    const a = await set.get(USER_TOKEN);
    const b = await set.get(USER_TOKEN);

    expect(callCount).toBe(1);
    expect(a).toBe(b);
  });
});
