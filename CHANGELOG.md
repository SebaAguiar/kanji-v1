# Changelog

## 1.0.0-alpha.2 (2026-07-17)

### Features

- **cli**: Add `--template` flag and interactive flow in `kanji new` command
- **examples**: Add basic starter and saas-starter applications

### Chores

- Bump all packages to 1.0.0-alpha.2
- Fix test runner configuration

## 1.0.0-alpha.1 (2026-07-17)

### Features

- **core**: DI container with module system, decorators (`@KanjijsModule`, `@Injectable`, `@Inject`, `@Repository`), dynamic module pattern with `forRoot()`, lifecycle hooks, circular dependency detection
- **platform-hono**: Hono HTTP adapter with contract validation wiring, auth middleware auto-wiring, WebSocket gateway system, CORS, rate-limit middleware, request-logger, exception filters
- **contracts**: Contract-first validation with Zod schemas, automatic body/params/query/headers validation, HTTP method/path consistency checks at startup
- **store**: Unified database abstraction layer with PostgreSQL (Drizzle ORM) and MongoDB adapters, `QueryBuilder` interface, pagination, ordering, transactions
- **auth**: JWT session management (create/verify/refresh), OAuth providers (Google, GitHub, Microsoft), auth middleware, `AuthGuard`, `clp()` and `acl()` permission systems, resource policies
- **openapi**: OpenAPI 3.0 spec generation from contracts, Zod-to-JSON-Schema converter (20+ Zod types), TypeScript SDK client generation, Swagger UI serving
- **cli**: Project scaffolding (`kanji new`, `kanji g resource`), migration management, CI template generation (GitHub Actions, GitLab CI), environment setup
- **testing**: `TestingModule` with DI integration, mock database with `QueryBuilder`, test fixtures, auth mocking, E2E test utilities
- **common**: Env validation with Zod, typed error hierarchy (7 error classes), structured logger with colors, decorator helpers, exception filter pattern, cacheable utility
