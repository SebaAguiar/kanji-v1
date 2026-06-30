# Development Conventions

This document outlines the coding standards, patterns, testing guidelines, and commit message protocols for the Kanji Framework codebase.

---

## 1. Code Style and Naming Conventions

### TypeScript (all packages)
- **Files:** `kebab-case` for utilities and helpers (e.g., `metadata-storage.ts`), `PascalCase` for React components if applicable.
- **Classes:** `PascalCase` (e.g., `UsersController`, `UsersService`, `SessionProvider`).
- **Functions and Methods:** `camelCase` (e.g., `getUserById`, `createToken`, `findAll`).
- **Constants:** `UPPER_SNAKE_CASE` (e.g., `DATABASE_CLIENT`, `MAX_CONNECTIONS`, `CONFIG_TOKEN`).
- **Interfaces and Types:** `PascalCase` with descriptive names (e.g., `ModuleMetadata`, `Provider`, `DynamicModule`, `User`).
- **Symbol tokens:** Use `Symbol('TOKEN_NAME')` for DI tokens (e.g., `const DATABASE_CLIENT = Symbol('DATABASE_CLIENT')`).
- **Decorators:** `PascalCase` with `@` prefix (e.g., `@Injectable`, `@Controller`, `@Get`, `@Contract`).

### Typing Strictness
- **`any` is strictly forbidden.** All APIs, contracts, providers, and return types must be explicitly typed.
- **`unknown` is forbidden** in public APIs — use proper unions or generics.
- **No implicit any.** Enable `strict: true` and `noImplicitAny: true` in `tsconfig.json`.

### Imports Organization
Group imports in this order, separated by a blank line:
1. Standard library / Bun built-ins
2. Third-party packages (zod, hono, drizzle-orm)
3. Internal `@kanjijs/*` packages
4. Relative imports (../, ./)

---

## 2. Architectural Patterns

### [DO] Allowed and Encouraged Patterns

- **Module-first design:** Every feature lives in a module. Modules define `imports`, `controllers`, `providers`, `exports`. No global state, no auto-registration.
- **Deterministic DI:** One container per app instance. Resolution happens once at startup, never in hot-path. If a provider isn't visible, the error is caught at bootstrap.
- **Contract-first development:** Define Zod schemas as contracts. Use `@Contract()` decorator for metadata. Validation happens in middleware, not in handlers.
- **Thin controllers:** Controllers handle HTTP only (parse input, call service, return response). Business logic lives in services.
- **Error typing:** Use custom error classes extending `KanjiError` base class. Never return raw strings as errors.
- **Drizzle ORM for database:** All database access goes through Drizzle query builder. Raw SQL only inside migrations.
- **Database-agnostic services:** Services depend on the `Database` interface, never on a specific adapter (Postgres or MongoDB).
- **Auth middleware:** All protected routes use `@UseGuards(AuthGuard)`. Auth state is accessed via `c.get('kanji.auth.*')` context keys.
- **Validation middleware:** Contract validation happens automatically. Use `c.get('kanji.validated.*')` for typed input.

### [DONT] Forbidden Patterns

- **Global state / singletons:** No global `container`, no static `providers` array. App creates its own container per instance.
- **Auto-registration:** If a provider isn't declared in a module, it cannot be resolved. No implicit discovery.
- **Raw SQL in business logic:** DDL or DML outside migrations is forbidden. Use Drizzle query builder.
- **Magic decorators with runtime side effects:** Decorators are metadata-only. Side effects (validation, auth) happen in middleware.
- **`any` in contracts or services:** Every request/response shape must be a typed Zod schema.
- **Hardcoded configuration:** Environment variables go through `ConfigModule.forRoot()`, never `process.env` directly in services.
- **`console.log` in production code:** Use the logger service injected via DI.

---

## 3. Testing Guidelines

**For comprehensive testing strategy, refer to `/docs/context/TESTING.md`.**

### TypeScript/Bun Tests
- Write tests alongside source files with `.spec.ts` or `.test.ts` suffix.
- Use **Bun's built-in test runner** (`bun test`) or **Vitest** for more features.
- Focus on behavior, not implementation. Test contracts: inputs → expected outputs → error states.

### Coverage Targets
- `packages/*/src/` — 80% minimum for business logic (services, middleware).
- `packages/contracts/src/` — 90% for validation schemas.
- `packages/auth/src/` — 85% for auth flows (happy + error paths).
- `packages/cli/src/` — 70% for CLI commands.

### Test Patterns
- Unit tests: `#[cfg(test)]` equivalent — use `describe` / `it` / `expect`.
- Integration tests: Use `createTestingModule` from `@kanjijs/testing` to bootstrap modules in-memory.
- Database tests: Use in-memory SQLite or testcontainers for Postgres/MongoDB.
- E2E tests: Run example apps with `bun run dev` and hit endpoints with `fetch` or `hono/testing`.

### Running Tests
```bash
# Run all tests (root)
bun test

# Run tests for specific package
bun test --filter @kanjijs/core

# Run with coverage
bun test --coverage

# Run in watch mode
bun test --watch
```

---

## 4. Commit Message Protocol

All commits must follow **Conventional Commits**. Messages must be written in **English**.

### Format
```
<type>(<scope>): <short description in present tense>

[Optional body describing the reasoning behind the change]
```

### Valid Types
| Type | When to use |
|------|-------------|
| `feat` | A new user-facing feature |
| `fix` | A bug fix |
| `perf` | A performance improvement |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test` | Adding or correcting tests |
| `docs` | Documentation-only changes |
| `chore` | Maintenance (dependencies, build tooling, config) |

### Valid Scopes
| Scope | What it covers |
|-------|----------------|
| `core` | DI container, module system, decorators |
| `platform-hono` | Hono HTTP adapter, middleware |
| `contracts` | Zod validation, contract decorators |
| `openapi` | OpenAPI spec and SDK generation |
| `store` | Database abstraction, adapters (Postgres, MongoDB) |
| `auth` | OAuth, JWT, session, guards |
| `testing` | Test utilities, testing module |
| `cli` | CLI commands and code generation |
| `common` | Shared types and utilities |
| `deps` | Dependency updates |

### Examples
```
feat(core): add support for dynamic modules with forRoot pattern

Dynamic modules allow packages like ConfigModule and AuthModule
to accept configuration at import time, enabling per-app customization
without global state.

Closes #42
```

```
fix(auth): handle expired JWT tokens gracefully

Previously an expired token caused an unhandled error. Now it returns
401 with a clear error message and suggests refresh endpoint.
```

```
refactor(store): unify Postgres and MongoDB query builder interface

Both adapters now implement the same QueryBuilder interface,
making services truly database-agnostic.
```
