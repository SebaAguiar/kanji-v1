# Testing Strategy & Guidelines

This document defines how to write and structure tests across the Kanji Framework codebase, including unit tests, integration tests, and E2E tests.

---

## 1. Testing Philosophy

- **Test the contract, not the implementation.** Tests must validate that inputs produce expected outputs and error states, not that the code does it "the right way."
- **Isolation is mandatory.** No test should depend on another test's state. Each test creates its own DI container and database.
- **Type safety in tests.** No `any` in test code either. Tests are part of the specification.
- **Coverage targets:** Minimum 80% for business logic (`services/`, `middleware/`). Lower threshold for CLI scaffolding (60%). Higher expected for security-critical paths (auth, validation: 90%+).

---

## 2. Test Runner Setup

Kanji uses Bun's built-in test runner:

```typescript
// bunfig.toml (optional, for advanced config)
[test]
preload = "./test-setup.ts"
coverageDir = "./coverage"

// Run tests
bun test
bun test --coverage
bun test --watch
```

For packages that need more features (mocking, spies), use Vitest:

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
```

---

## 3. Backend / Package Testing (TypeScript)

### 3.1 Unit Tests — Location and Structure

Tests live alongside source code in `__tests__/` directories:

```
packages/core/src/
├── container.ts
├── modules.ts
├── __tests__/
│   ├── container.spec.ts
│   └── modules.spec.ts
```

### 3.2 Testing Services

```typescript
// packages/core/src/__tests__/container.spec.ts
import { describe, it, expect } from 'bun:test';
import { Container } from '../container';

describe('Container', () => {
  it('should resolve a registered class provider', () => {
    const container = new Container();

    class UserService {
      getName() { return 'Alice'; }
    }

    container.register(UserService);
    const instance = container.resolve(UserService);

    expect(instance).toBeInstanceOf(UserService);
    expect(instance.getName()).toBe('Alice');
  });

  it('should throw when resolving unregistered provider', () => {
    const container = new Container();

    class UnknownService {}

    expect(() => container.resolve(UnknownService)).toThrow('Provider not found');
  });

  it('should support singleton scope', () => {
    const container = new Container();

    class ConfigService {
      getPort() { return 3000; }
    }

    container.register(ConfigService, { singleton: true });
    const instance1 = container.resolve(ConfigService);
    const instance2 = container.resolve(ConfigService);

    expect(instance1).toBe(instance2);  // Same instance
  });
});
```

**Key principles:**
- One `it()` per logical case (happy path, error variants, edge cases).
- Use descriptive names: `should <expected behavior> when <condition>`.
- Test error paths with `toThrow()` and specific error messages.

### 3.3 Testing Contracts (Zod Schemas)

```typescript
// packages/contracts/src/__tests__/validator.spec.ts
import { describe, it, expect } from 'bun:test';
import { z } from 'zod';
import { ZodValidator } from '../validator';

describe('ZodValidator', () => {
  it('should validate a correct request body', async () => {
    const schema = z.object({
      name: z.string().min(1),
      email: z.string().email(),
    });

    const validator = new ZodValidator();
    const result = await validator.validate(schema, {
      name: 'Alice',
      email: 'alice@example.com',
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      name: 'Alice',
      email: 'alice@example.com',
    });
  });

  it('should fail validation for missing required fields', async () => {
    const schema = z.object({
      name: z.string().min(1),
      email: z.string().email(),
    });

    const validator = new ZodValidator();
    const result = await validator.validate(schema, {
      name: 'Alice',
      // missing email
    });

    expect(result.success).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].path).toContain('email');
  });

  it('should normalize Zod errors to standard format', async () => {
    const schema = z.object({
      email: z.string().email(),
    });

    const validator = new ZodValidator();
    const result = await validator.validate(schema, {
      email: 'not-an-email',
    });

    expect(result.success).toBe(false);
    expect(result.issues[0]).toMatchObject({
      path: ['email'],
      code: 'invalid_string',
      message: expect.any(String),
    });
  });
});
```

### 3.4 Testing Auth Middleware

```typescript
// packages/auth/src/__tests__/session.spec.ts
import { describe, it, expect } from 'bun:test';
import { SessionProvider } from '../session';

describe('SessionProvider', () => {
  const provider = new SessionProvider('test-secret');

  it('should create a valid JWT token', () => {
    const token = provider.createToken({
      userId: '123',
      email: 'alice@example.com',
      name: 'Alice',
      roles: ['user'],
      scopes: [],
    });

    expect(token).toBeString();
    expect(token.split('.')).toHaveLength(3);  // JWT has 3 parts
  });

  it('should verify a valid token', () => {
    const token = provider.createToken({
      userId: '123',
      email: 'alice@example.com',
      name: 'Alice',
      roles: ['user'],
      scopes: [],
    });

    const session = provider.verifyToken(token);
    expect(session).not.toBeNull();
    expect(session!.userId).toBe('123');
    expect(session!.email).toBe('alice@example.com');
  });

  it('should reject an expired token', () => {
    // Create a token that expires immediately
    const expiredToken = 'expired.jwt.token';

    const session = provider.verifyToken(expiredToken);
    expect(session).toBeNull();
  });

  it('should reject a tampered token', () => {
    const token = provider.createToken({
      userId: '123',
      email: 'alice@example.com',
      name: 'Alice',
      roles: ['user'],
      scopes: [],
    });

    // Tamper with the payload
    const parts = token.split('.');
    const tamperedToken = `${parts[0]}.${parts[1]}x.${parts[2]}`;

    const session = provider.verifyToken(tamperedToken);
    expect(session).toBeNull();
  });
});
```

### 3.5 Testing Database Operations

Use `createTestingModule` for isolated database tests:

```typescript
// packages/store/src/__tests__/postgres-adapter.spec.ts
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { createTestingModule } from '@kanjijs/testing';
import { StoreModule } from '../store.module';
import { DATABASE_CLIENT } from '../types';

describe('PostgresDatabase', () => {
  let module: TestingModule;
  let db: Database;

  beforeAll(async () => {
    module = await createTestingModule({
      imports: [
        StoreModule.forRoot({
          type: 'postgres',
          connectionString: process.env.TEST_DATABASE_URL!,
        }),
      ],
    });
    db = module.get(DATABASE_CLIENT);
  });

  afterAll(async () => {
    await db.disconnect();
  });

  it('should insert and retrieve a user', async () => {
    const [user] = await db.query.users
      .insert({
        name: 'Test User',
        email: 'test@example.com',
      })
      .returning();

    expect(user).toMatchObject({
      name: 'Test User',
      email: 'test@example.com',
    });
    expect(user.id).toBeDefined();
  });

  it('should enforce unique email constraint', async () => {
    await db.query.users.insert({
      name: 'User 1',
      email: 'duplicate@example.com',
    });

    expect(
      db.query.users.insert({
        name: 'User 2',
        email: 'duplicate@example.com',
      })
    ).rejects.toThrow();
  });
});
```

### 3.6 Testing Modules (Integration)

```typescript
// packages/testing/src/__tests__/testing-module.spec.ts
import { describe, it, expect } from 'bun:test';
import { createTestingModule } from '../test.module';

describe('TestingModule', () => {
  it('should create an isolated DI container', async () => {
    @Injectable()
    class TestService {
      getMessage() { return 'hello'; }
    }

    @KanjijsModule({
      providers: [TestService],
    })
    class TestModule {}

    const module = await createTestingModule({
      imports: [TestModule],
    });

    const service = module.get(TestService);
    expect(service.getMessage()).toBe('hello');
  });

  it('should not share state between test modules', async () => {
    const module1 = await createTestingModule({
      providers: [
        { provide: 'VALUE', useValue: 'module1' },
      ],
    });

    const module2 = await createTestingModule({
      providers: [
        { provide: 'VALUE', useValue: 'module2' },
      ],
    });

    expect(module1.get('VALUE')).toBe('module1');
    expect(module2.get('VALUE')).toBe('module2');
    // Different instances, no shared state
  });
});
```

---

## 4. E2E Testing

### 4.1 Testing HTTP Endpoints

```typescript
// examples/basic/src/__tests__/users.e2e.spec.ts
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { KanjijsAdapter } from '@kanjijs/core';
import { AppModule } from '../app.module';

describe('Users API (E2E)', () => {
  let app: KanjijsApp;

  beforeAll(async () => {
    app = await KanjijsAdapter.create(AppModule);
    await app.listen(0);  // Random port
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /users should return a list of users', async () => {
    const res = await fetch(`http://localhost:${app.port}/users`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it('POST /users should create a new user', async () => {
    const res = await fetch(`http://localhost:${app.port}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alice',
        email: 'alice@example.com',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({
      name: 'Alice',
      email: 'alice@example.com',
    });
  });

  it('POST /users should validate required fields', async () => {
    const res = await fetch(`http://localhost:${app.port}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alice',
        // missing email
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('VALIDATION_ERROR');
  });
});
```

### 4.2 Testing Auth-Protected Endpoints

```typescript
it('should return 401 without auth token', async () => {
  const res = await fetch(`http://localhost:${app.port}/auth/me`);
  expect(res.status).toBe(401);
});

it('should return 200 with valid auth token', async () => {
  const loginRes = await fetch(`http://localhost:${app.port}/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'alice@example.com',
      password: 'password123',
    }),
  });

  const { token } = await loginRes.json();

  const res = await fetch(`http://localhost:${app.port}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res.status).toBe(200);
});
```

---

## 5. CLI Testing

Test CLI commands programmatically:

```typescript
// packages/cli/src/__tests__/generate.spec.ts
import { describe, it, expect } from 'bun:test';
import { execSync } from 'child_process';
import { mkdtempSync, readdirSync } from 'fs';
import { join } from 'path';

describe('CLI: kanji g resource', () => {
  it('should generate resource files', () => {
    const tmpDir = mkdtempSync('kanji-test-');
    
    execSync(`node ${join(__dirname, '../cli.js')} g resource users`, {
      cwd: tmpDir,
    });

    const files = readdirSync(join(tmpDir, 'src', 'users'));
    expect(files).toContain('users.controller.ts');
    expect(files).toContain('users.service.ts');
    expect(files).toContain('users.contracts.ts');
    expect(files).toContain('users.module.ts');
  });
});
```

---

## 6. Coverage Targets

### 6.1 Minimum Coverage by Package

| Package | Minimum Coverage |
|---------|-----------------|
| `@kanjijs/core` | 85% |
| `@kanjijs/contracts` | 90% |
| `@kanjijs/auth` | 85% |
| `@kanjijs/store` | 80% |
| `@kanjijs/platform-hono` | 80% |
| `@kanjijs/openapi` | 75% |
| `@kanjijs/testing` | 85% |
| `@kanjijs/cli` | 60% |
| `@kanjijs/common` | 80% |

### 6.2 Running Coverage

```bash
# Bun's built-in coverage
bun test --coverage

# Vitest coverage (if configured)
npx vitest --coverage
```

---

## 7. Test Organization

```
packages/<name>/src/
├── services/
│   ├── users.service.ts
│   └── __tests__/
│       └── users.service.spec.ts
├── __tests__/
│   ├── integration.spec.ts
│   └── setup.ts          # Shared test setup, mocks
```

```
examples/basic/src/
├── __tests__/
│   ├── users.e2e.spec.ts
│   └── setup.ts
```

---

## 8. Common Testing Pitfalls

| Pitfall | Problem | Solution |
|---------|---------|----------|
| Testing implementation | Tests break on refactor | Test the contract: inputs → outputs → errors |
| Shared state between tests | Tests are not isolated | Use `createTestingModule()` for each test |
| Not testing error paths | Only happy path covered | Test every validation error and service exception |
| Using `any` in test code | Loses type safety | Write full types, match error messages |
| Hardcoded database URLs | Tests fail on different machines | Use `TEST_DATABASE_URL` env var |
| Mocking too much | Tests pass but app fails | Prefer integration tests over mocks |
