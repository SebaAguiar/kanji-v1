import type { Token } from '@kanjijs/core';

export interface FixtureDefinition<T extends object = object> {
  token: Token<T>;
  factory: () => T | Promise<T>;
}

export class FixtureSet {
  private readonly fixtures = new Map<Token<object>, object>();
  private readonly definitions = new Map<Token<object>, FixtureDefinition>();

  register<T extends object>(definition: FixtureDefinition<T>): void {
    this.fixtures.delete(definition.token);
    this.definitions.set(definition.token, definition as FixtureDefinition);
  }

  async get<T extends object>(token: Token<T>): Promise<T> {
    if (this.fixtures.has(token)) {
      return this.fixtures.get(token) as T;
    }

    const definition = this.definitions.get(token);
    if (!definition) {
      throw new Error(`No fixture registered for token "${String(token)}"`);
    }

    const instance = await definition.factory();
    this.fixtures.set(token, instance);
    return instance as T;
  }

  async createAll(): Promise<void> {
    for (const [token] of this.definitions) {
      await this.get(token);
    }
  }

  clear(): void {
    this.fixtures.clear();
  }

  getAll(): Map<Token<object>, object> {
    return new Map(this.fixtures);
  }
}

export function createFixture<T extends object>(
  token: Token<T>,
  factory: () => T | Promise<T>,
): FixtureDefinition<T> {
  return { token, factory };
}

export class FixtureModule {
  private readonly definitions: FixtureDefinition[] = [];

  add(definition: FixtureDefinition): this {
    this.definitions.push(definition);
    return this;
  }

  async build(): Promise<FixtureSet> {
    const set = new FixtureSet();
    for (const def of this.definitions) {
      set.register(def);
    }
    await set.createAll();
    return set;
  }
}
