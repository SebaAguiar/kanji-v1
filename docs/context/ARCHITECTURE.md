# Kanji Framework v1.0.0 — Complete Architecture Document
## Backend Framework: Hono + Modules + Native ORM + Auth + Real-time + Type-safe SDKs

> **Vision:** Build "Rails for Bun" — type-safe, fast, developer-first framework that ships features 10x faster than NestJS.
>
> **Tagline:** Velocity without compromise. Security by default. Modular by design. Type-safe end-to-end.
>
> **Status:** v1.0.0 — Ready for Implementation

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Repository Structure & Organization](#repository-structure--organization)
3. [Working Within the Repository](#working-within-the-repository)
4. [Core Principles](#core-principles)
5. [Architecture Overview](#architecture-overview)
6. [Package Ecosystem](#package-ecosystem)
7. [Tier 1: Module System](#tier-1-module-system)
8. [Tier 2: Dependency Injection](#tier-2-dependency-injection)
9. [Tier 3: HTTP Layer (Hono)](#tier-3-http-layer-hono)
10. [Tier 4: Contract-First Development](#tier-4-contract-first-development)
    - [Environment Variable Validation (Colocated Pattern)](#environment-variable-validation-colocated-pattern)
11. [Tier 5: OpenAPI + SDK Generation](#tier-5-openapi--sdk-generation)
12. [Tier 6: Native ORM Integration](#tier-6-native-orm-integration)
13. [Tier 7: Multi-Database Support](#tier-7-multi-database-support)
14. [Tier 8: Authentication (Native)](#tier-8-authentication-native)
15. [Tier 9: Real-Time (WebSockets)](#tier-9-real-time-websockets)
16. [Tier 10: Security (RBAC + ACL)](#tier-10-security-rbac--acl)
17. [Tier 11: CLI & Developer Experience](#tier-11-cli--developer-experience)
18. [Tier 12: Performance Guarantees](#tier-12-performance-guarantees)
19. [Tier 13: Testing Strategy](#tier-13-testing-strategy)
20. [Code Organization (Recommended Pattern)](#code-organization-recommended-pattern)
21. [Implementation Roadmap](#implementation-roadmap)
22. [Appendix: Complete Code Examples](#appendix-complete-code-examples)
23. [Future Roadmap: @kanjijs/client](#future-roadmap-kanjijsclient)

---

## Executive Summary

Kanji v1.0.0 is a **production-ready backend framework** for Bun that combines:

1. **Hono-first runtime** (3-10x faster than NestJS)
2. **Strict modular architecture** (boundaries enforced, no magic)
3. **Native ORM + Multi-DB** (PostgreSQL + MongoDB, database-agnostic code)
4. **Contract-first development** (types flow end-to-end)
5. **Auto-generated OpenAPI + TypeScript SDK** (type-safe frontend integration, like Parse/tRPC)
6. **Built-in Authentication** (OAuth + JWT, zero-config, no adapters)
7. **Real-time by default** (WebSockets + auth integrated)
8. **Secure by default** (RBAC + ACL built-in)

**Target market:** Startups, scale-ups, and developer teams that value **shipping speed + code quality + type safety**.

**Differentiation:**
- **NestJS speed** with **Rails simplicity** and **tRPC type-safety**.
- Auth out-of-the-box (unlike NestJS, Express, tRPC).
- Multi-DB support (unlike most frameworks).
- OpenAPI standard (unlike tRPC).

---

## Repository Structure & Organization

### Monorepo Layout

Kanji es un **monorepo** usando `pnpm workspaces`. Esta estructura permite:
- Cada package es independiente pero interconectado.
- Código compartido en `packages/common`.
- Ejemplos completos en `examples/`.
- Documentación centralizada en `docs/`.

### Complete Folder Structure

```
kanji/
│
├── packages/                           # Core framework packages
│   ├── core/                           # @kanjijs/core (DI, modules, decorators)
│   │   ├── src/
│   │   │   ├── decorators/             # @Controller, @Get, @Post, @Injectable, etc
│   │   │   ├── container.ts            # DI container implementation
│   │   │   ├── modules.ts              # Module system, metadata
│   │   │   ├── metadata-storage.ts     # Central metadata registry
│   │   │   └── index.ts
│   │   ├── tests/                      # Core tests
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── platform-hono/                  # @kanjijs/platform-hono (HTTP adapter)
│   │   ├── src/
│   │   │   ├── adapter.ts              # Hono integration
│   │   │   ├── context-helper.ts       # Context key setters
│   │   │   ├── middleware.ts           # Global middleware setup
│   │   │   └── index.ts
│   │   ├── tests/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── contracts/                      # @kanjijs/contracts (Zod + validation)
│   │   ├── src/
│   │   │   ├── validator.ts            # ZodValidator implementation
│   │   │   ├── errors.ts               # Validation error normalization
│   │   │   └── index.ts
│   │   ├── tests/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── openapi/                        # @kanjijs/openapi (spec + SDK generator)
│   │   ├── src/
│   │   │   ├── generator.ts            # OpenAPI spec generator
│   │   │   ├── sdk-generator.ts        # TypeScript SDK generator
│   │   │   ├── types.ts                # OpenAPI type definitions
│   │   │   └── index.ts
│   │   ├── tests/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── store/                          # @kanjijs/store (DB abstraction)
│   │   ├── src/
│   │   │   ├── types.ts                # Database interface
│   │   │   ├── adapters/
│   │   │   │   ├── postgres.ts         # PostgreSQL (Drizzle)
│   │   │   │   └── mongodb.ts          # MongoDB
│   │   │   ├── store.module.ts         # DI module
│   │   │   └── index.ts
│   │   ├── tests/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── auth/                           # @kanjijs/auth (OAuth + JWT)
│   │   ├── src/
│   │   │   ├── session.ts              # SessionProvider (JWT)
│   │   │   ├── providers.ts            # OAuth providers (Google, GitHub, etc)
│   │   │   ├── middleware.ts           # Auth middleware
│   │   │   ├── auth.module.ts          # DI module
│   │   │   └── index.ts
│   │   ├── tests/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── testing/                        # @kanjijs/testing (Test utilities)
│   │   ├── src/
│   │   │   ├── test.module.ts          # createTestingModule
│   │   │   ├── test-database.ts        # In-memory test DB
│   │   │   ├── fixtures.ts             # Test fixtures, factories
│   │   │   └── index.ts
│   │   ├── tests/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── cli/                            # @kanjijs/cli (kanji command)
│   │   ├── src/
│   │   │   ├── commands/
│   │   │   │   ├── new.ts              # kanji new <name>
│   │   │   │   ├── generate.ts         # kanji g resource <name>
│   │   │   │   ├── migrate.ts          # kanji migrate
│   │   │   │   ├── openapi.ts          # kanji openapi:generate
│   │   │   │   ├── sdk.ts              # kanji sdk:generate
│   │   │   │   └── dev.ts              # kanji dev
│   │   │   ├── templates/              # Code generation templates
│   │   │   │   ├── controller.hbs
│   │   │   │   ├── service.hbs
│   │   │   │   ├── contracts.hbs
│   │   │   │   ├── module.hbs
│   │   │   │   └── index.hbs
│   │   │   ├── utils/
│   │   │   │   ├── file-generator.ts
│   │   │   │   ├── inflection.ts       # camelCase, PascalCase conversions
│   │   │   │   └── validators.ts
│   │   │   ├── cli.ts                  # CLI entry point
│   │   │   └── index.ts
│   │   ├── tests/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── common/                         # @kanjijs/common (Shared utilities)
│       ├── src/
│       │   ├── types.ts                # Common TypeScript types
│       │   ├── utils/
│       │   │   ├── decorators.ts       # Utility decorators
│       │   │   ├── errors.ts           # Custom error classes
│       │   │   └── helpers.ts          # Utility functions
│       │   └── index.ts
│       ├── tests/
│       ├── package.json
│       └── tsconfig.json
│
├── examples/                           # Real-world examples
│   ├── basic/                          # Basic CRUD app
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── users/              # User feature
│   │   │   │   │   ├── users.controller.ts
│   │   │   │   │   ├── users.service.ts
│   │   │   │   │   ├── users.contracts.ts
│   │   │   │   │   ├── users.module.ts
│   │   │   │   │   └── index.ts
│   │   │   │   ├── posts/              # Post feature
│   │   │   │   └── auth/               # Auth feature
│   │   │   ├── database/
│   │   │   │   ├── database.module.ts
│   │   │   │   └── schema.ts
│   │   │   ├── app.module.ts
│   │   │   └── main.ts
│   │   ├── tests/
│   │   ├── .env.example
│   │   ├── package.json
│   │   └── README.md
│   │
│   ├── saas-starter/                  # SaaS app with org, teams, multi-tenant
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/
│   │   │   │   ├── organizations/
│   │   │   │   ├── teams/
│   │   │   │   ├── users/
│   │   │   │   └── billing/
│   │   │   ├── database/
│   │   │   ├── app.module.ts
│   │   │   └── main.ts
│   │   ├── tests/
│   │   ├── .env.example
│   │   ├── package.json
│   │   └── README.md
│   │
│   └── real-time-app/                 # Real-time chat app with WebSockets
│       ├── src/
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   ├── users/
│       │   │   ├── rooms/
│       │   │   └── messages/
│       │   ├── gateways/
│       │   │   └── chat.gateway.ts
│       │   ├── database/
│       │   ├── app.module.ts
│       │   └── main.ts
│       ├── tests/
│       ├── .env.example
│       ├── package.json
│       └── README.md
│
├── docs/                               # Documentation
│   ├── ARCHITECTURE.md                 # (Este archivo)
│   ├── QUICKSTART.md                   # Quick start guide
│   ├── CONTRIBUTING.md                 # Contributing guidelines
│   ├── ROADMAP.md                      # Feature roadmap
│   ├── API.md                          # API reference
│   ├── guides/
│   │   ├── authentication.md
│   │   ├── database.md
│   │   ├── websockets.md
│   │   ├── security.md
│   │   └── testing.md
│   └── examples/
│       ├── crud.md
│       ├── oauth.md
│       └── real-time.md
│
├── scripts/                            # Build and automation scripts
│   ├── build.sh                        # Build all packages
│   ├── test.sh                         # Run all tests
│   ├── lint.sh                         # Lint code
│   ├── publish.sh                      # Publish to npm
│   └── release.sh                      # Release process
│
├── .github/                            # GitHub config
│   ├── workflows/
│   │   ├── test.yml                    # CI: run tests on PR
│   │   ├── lint.yml                    # CI: lint on PR
│   │   ├── publish.yml                 # CD: publish on release
│   │   └── docs.yml                    # CI: build docs
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   └── feature_request.md
│   └── pull_request_template.md
│
├── .gitignore
├── .npmrc                              # npm config (registry, auth)
├── pnpm-workspace.yaml                 # pnpm workspace config
├── package.json                        # Root package.json
├── tsconfig.json                       # Shared TypeScript config
├── tsconfig.build.json                 # Build TypeScript config
├── prettier.config.js                  # Code formatting
├── .eslintrc.json                      # Linting rules
├── CHANGELOG.md                        # Release notes
├── LICENSE                             # MIT license
└── README.md                           # Main README
```

### Package Dependencies Graph

```
┌─────────────────────────────────────────┐
│         @kanjijs/core                   │  ← Foundation (DI, modules)
│  (decorators, container, metadata)      │
└────────────┬────────────────────────────┘
             │
   ┌─────────┼─────────┬─────────┐
   │         │         │         │
   ▼         ▼         ▼         ▼
@kanjijs/ @kanjijs/ @kanjijs/ @kanjijs/
platform- contracts  common   testing
hono

   ▼         ▼
store     auth      ← DB & Auth
   │         │
   └────┬────┘
        │
        ▼
    @kanjijs/
    openapi    ← OpenAPI + SDK generation

        │
        ▼
    @kanjijs/cli   ← CLI (kanji command)
```

---

## Working Within the Repository

### Development Workflow

#### 1. Setup Local Environment

```bash
# Clone repository
git clone https://github.com/kanjijs/kanji.git
cd kanji

# Install pnpm (if not installed)
npm install -g pnpm

# Install all dependencies
pnpm install

# Setup git hooks (optional but recommended)
pnpm exec husky install
```

#### 2. Package-Level Development

```bash
# Work on specific package
cd packages/core

# Install/update deps for this package only
pnpm add zod

# Run package tests
pnpm test

# Build package
pnpm build

# Watch mode (for development)
pnpm dev
```

#### 3. Running Examples

```bash
# Run basic example
cd examples/basic
pnpm install
pnpm dev  # Server on http://localhost:3000

# In another terminal, run tests
pnpm test

# Run SaaS example
cd examples/saas-starter
pnpm dev

# Run real-time example
cd examples/real-time-app
pnpm dev
```

#### 4. Testing Strategy

```bash
# Run all tests (root)
pnpm test

# Run tests for specific package
pnpm test --filter @kanjijs/core

# Run tests in watch mode
pnpm test --watch

# Run tests with coverage
pnpm test --coverage

# Run specific test file
pnpm test users.controller.spec.ts

# Run tests in CI mode (no watch)
pnpm test:ci
```

#### 5. Building

```bash
# Build all packages
pnpm build

# Build specific package
pnpm build --filter @kanjijs/core

# Build and watch for changes
pnpm build:watch

# Build examples
cd examples/basic && pnpm build
```

#### 6. Linting & Formatting

```bash
# Lint all code
pnpm lint

# Lint specific package
pnpm lint --filter @kanjijs/core

# Fix linting issues
pnpm lint:fix

# Format code with Prettier
pnpm format

# Format specific package
pnpm format --filter @kanjijs/core
```

### Git Workflow

#### Branch Naming Convention

```
feature/  → New feature (feature/openapi-generator)
bugfix/   → Bug fix (bugfix/auth-middleware-crash)
docs/     → Documentation (docs/architecture)
chore/    → Maintenance (chore/update-dependencies)
refactor/ → Code refactoring (refactor/di-container)
```

#### Commit Message Convention

```
feat: add OpenAPI spec generator
^    ^
|    └─ subject (lowercase, no period)
└─ type (feat, fix, docs, style, refactor, perf, test, chore)

Detailed commit message (optional):

- Add OpenAPI generator class
- Support Zod schema parsing
- Generate spec from @Contract decorators
- Add CLI command: kanji openapi:generate

Closes #123
```

#### PR Process

1. **Create feature branch**
   ```bash
   git checkout -b feature/openapi-generator
   ```

2. **Make changes and commit**
   ```bash
   git add .
   git commit -m "feat: add OpenAPI spec generator"
   ```

3. **Push and create PR**
   ```bash
   git push origin feature/openapi-generator
   # Then create PR on GitHub
   ```

4. **PR Title format**
   ```
   [PACKAGE] Brief description
   [core] Add OpenAPI spec generator
   [cli] Fix kanji g resource command
   [docs] Update authentication guide
   ```

5. **PR Description template**
   ```markdown
   ## Description
   What does this PR do?

   ## Changes
   - Bullet points of changes
   - More changes

   ## Tests
   - [ ] Unit tests added
   - [ ] Integration tests added
   - [ ] Example updated

   ## Type of change
   - [ ] New feature
   - [ ] Bug fix
   - [ ] Documentation
   - [ ] Breaking change
   ```

### IDE Setup Recommendations

#### VSCode Extensions

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "zxh404.vscode-proto3",
    "ms-vscode.makefile-tools",
    "redhat.vscode-yaml",
    "bierner.markdown-preview-github-styles"
  ]
}
```

#### VSCode Settings

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "eslint.validate": ["javascript", "typescript"],
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true
  }
}
```

#### Recommended Extensions

- **ESLint** — Code quality
- **Prettier** — Code formatting
- **TypeScript Vue Plugin** — Vue support (if needed)
- **GitLens** — Git history
- **REST Client** — Test endpoints
- **Thunder Client** — Alternative REST client

### Debugging

#### Debug Core Package

```bash
# In VSCode, create .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Core Tests",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["test", "--", "--runInBand"],
      "cwd": "${workspaceFolder}/packages/core",
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

#### Debug Example App

```bash
# In VSCode launch.json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Basic Example",
  "program": "${workspaceFolder}/examples/basic/src/main.ts",
  "cwd": "${workspaceFolder}/examples/basic",
  "console": "integratedTerminal"
}
```

### Code Style Guidelines

#### TypeScript

```typescript
// ✅ Good: Clear, type-safe, modular
@Injectable()
export class UsersService {
  constructor(@Inject(DATABASE_CLIENT) private db: Database) {}

  async findById(id: string): Promise<User | null> {
    const result = await this.db.query.users
      .select()
      .where({ id })
      .limit(1);
    return result[0] || null;
  }
}

// ❌ Bad: Any types, unclear names, no types
export class UserService {
  constructor(private db: any) {}

  async get(x: any) {
    return this.db.query('SELECT * FROM users WHERE id = ?', [x])[0];
  }
}
```

#### Naming Conventions

```typescript
// Classes: PascalCase
class UsersController {}
class UsersService {}

// Functions/methods: camelCase
function getUserById(id: string) {}

// Constants: UPPER_SNAKE_CASE
const DATABASE_CLIENT = Symbol('DATABASE_CLIENT');
const MAX_CONNECTIONS = 100;

// Files: kebab-case
users.controller.ts
users.service.ts
users.contracts.ts

// Folders: lowercase
/users
/posts
/database
```

#### Comments & Documentation

```typescript
/**
 * Create a new user with provided data
 * @param data - User creation input (name, email, password)
 * @returns Created user object with ID and timestamps
 * @throws Error if email already exists
 * @example
 * const user = await usersService.create({
 *   name: 'Alice',
 *   email: 'alice@example.com',
 *   password: '...'
 * });
 */
async create(data: CreateUserInput): Promise<User> {
  // ...
}
```

### Performance & Scalability Rules

#### DO's ✅

- ✅ Use services for business logic
- ✅ Keep controllers thin (HTTP only)
- ✅ Use contract validation
- ✅ Cache expensive operations
- ✅ Use database query optimization
- ✅ Add indexes to frequently queried fields
- ✅ Use transactions for data consistency
- ✅ Test edge cases and error scenarios

#### DON'Ts ❌

- ❌ Don't do sync operations in async functions
- ❌ Don't call DB multiple times in loops
- ❌ Don't catch errors silently
- ❌ Don't use `any` types
- ❌ Don't hardcode configuration
- ❌ Don't skip input validation
- ❌ Don't ignore type errors
- ❌ Don't leave console.log in production code

### Release Process

#### Version Numbering

```
v1.0.0-alpha.1  → First alpha release
v1.0.0-beta.1   → First beta release
v1.0.0-rc.1     → Release candidate
v1.0.0          → Stable release
v1.1.0          → Minor release (new features)
v1.0.1          → Patch release (bug fixes)
```

#### Release Steps

```bash
# 1. Update version in all package.json files
pnpm version patch|minor|major

# 2. Update CHANGELOG.md
# Document all changes since last release

# 3. Commit changes
git add .
git commit -m "chore: release v1.0.0"

# 4. Create git tag
git tag -a v1.0.0 -m "Release v1.0.0"

# 5. Push to GitHub
git push origin main --tags

# 6. Publish to npm
pnpm publish --filter "@kanjijs/*"

# 7. Create GitHub release
# (Automated via CI workflow)
```

#### CI/CD Workflows

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm lint
      - run: pnpm test:ci

# .github/workflows/publish.yml
name: Publish
on:
  push:
    tags:
      - 'v*'
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
      - run: pnpm install
      - run: pnpm build
      - run: pnpm publish --filter "@kanjijs/*"
```

### Documentation Standards

#### README.md (each package)

```markdown
# @kanjijs/core

> Core DI, modules, and decorators for Kanji Framework

## Installation

\`\`\`bash
npm install @kanjijs/core
\`\`\`

## Quick Start

[Example code]

## API

[API documentation]

## Contributing

See CONTRIBUTING.md

## License

MIT
```

#### Code Comments

```typescript
// BAD: Obvious comment
const name = 'John'; // Set name to John

// GOOD: Why, not what
// Use 'John' as default for demo purposes
const name = 'John';

// GOOD: Complex logic explanation
// Hash password with bcrypt (10 rounds) to prevent rainbow table attacks
const hash = await bcrypt.hash(password, 10);
```

---

### 1. **Hono-first**
- The HTTP router is Hono. Not Express, not a custom implementation.
- Kanji adds structure on top: modules, DI, contracts, security.
- Handlers receive `c: Context` directly (no abstraction).

### 2. **Module-first (mandatory)**
- Everything lives in a module.
- Modules define `imports`, `exports`, `providers`, `controllers`.
- No global state. No auto-registration. Errors caught at bootstrap.

### 3. **DI Deterministic**
- One container per app instance (not global static).
- If a provider isn't visible → error, early.
- No reflection in hot-path (DI resolved once at startup).

### 4. **Contract-first (without decorator magic)**
- `@Contract()` = metadata only.
- Validation happens in middleware.
- Types flow: Contract → OpenAPI → Client SDK.

### 5. **Performance by Default**
- No logs in hot-path.
- No DI.resolve() per request.
- Caching decorators for free wins.
- WebSockets without overhead.

### 6. **Secure by Default**
- RBAC + ACL built-in (Parse-style).
- Every endpoint asks: "does this principal have permission?"
- Defaults are restrictive.

### 7. **Developer Experience Obsession**
- `kanji new` + `kanji g resource` = API in 90 seconds.
- Type safety end-to-end.
- Minimal boilerplate.
- Clear error messages.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                       Request                                │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────▼─────────────┐
        │  @Use() Global Middleware │ (requestId, cors, logger)
        └────────────┬─────────────┘
                     │
        ┌────────────▼──────────────┐
        │  Auth Middleware          │ (resolves principal from JWT/session)
        └────────────┬──────────────┘
                     │
        ┌────────────▼──────────────┐
        │  CLP (Class-Level Perms)  │ (can user access resource?)
        └────────────┬──────────────┘
                     │
        ┌────────────▼──────────────┐
        │  Contract Validation       │ (body, params, query)
        │  (Zod schemas)             │
        └────────────┬──────────────┘
                     │
        ┌────────────▼──────────────┐
        │  ACL (Object-Level Perms)  │ (can user access THIS object?)
        └────────────┬──────────────┘
                     │
        ┌────────────▼──────────────┐
        │  Handler Execution         │
        │  (service + business logic)│
        └────────────┬──────────────┘
                     │
        ┌────────────▼──────────────┐
        │  Response Serialization    │
        │  (OpenAPI contract)        │
        └────────────┬──────────────┘
                     │
        ┌────────────▼──────────────┐
        │  Exception Filter          │
        │  (if error occurred)       │
        └────────────┬──────────────┘
                     │
        ┌────────────▼──────────────┐
        │  Response to Client        │
        └────────────────────────────┘
```

---

## Package Ecosystem

Kanji is organized as a monorepo with the following packages:

```
@kanjijs/core              Core: DI, metadata, decorators
@kanjijs/platform-hono     HTTP adapter (Hono integration)
@kanjijs/contracts         Contract validation (Zod integration)
@kanjijs/openapi           OpenAPI spec generation + SDK generator
@kanjijs/store             Database abstraction (Postgres + MongoDB)
@kanjijs/auth              Authentication (OAuth + JWT)
@kanjijs/testing           Testing utilities (createTestingModule)
@kanjijs/cli               CLI (kanji new, kanji g resource)
@kanjijs/common            Shared utilities

@kanjijs/client (future)   Frontend SDK generator (Post v1.0.0)
```

---

## Tier 1: Module System

### Philosophy
Modules are **boundaries**. Imports/exports are **real**.

### Module Metadata

```typescript
export interface ModuleMetadata {
  imports?: (ModuleRef | DynamicModule)[];      // Modules this depends on
  controllers?: ControllerRef[];                 // HTTP handlers
  providers?: Provider[];                        // Services, factories
  exports?: Token[];                             // Tokens visible to importers
  global?: boolean;                              // Visible to all modules
}

export interface DynamicModule {
  module: ModuleRef;
  imports?: (ModuleRef | DynamicModule)[];
  providers?: Provider[];
  exports?: Token[];
  global?: boolean;
}
```

### Visibility Rules

1. **A provider is visible if:**
   - It's defined in this module, OR
   - It's exported by an imported module, OR
   - It's in a module marked `global: true`.

2. **If not visible → bootstrap error (caught early).**

### Example Module

```typescript
// src/users/users.module.ts
@KanjijsModule({
  imports: [DatabaseModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

### Dynamic Modules

```typescript
@KanjijsModule({})
export class ConfigModule {
  static forRoot(options: ConfigOptions): DynamicModule {
    return {
      module: ConfigModule,
      providers: [
        { provide: CONFIG_TOKEN, useValue: options },
      ],
      exports: [CONFIG_TOKEN],
      global: true,
    };
  }
}

// In AppModule:
@KanjijsModule({
  imports: [ConfigModule.forRoot({ env: 'production' })],
})
export class AppModule {}
```

---

## Tier 2: Dependency Injection

### Container per App (Not Global)

```typescript
const { app, container } = await KanjijsAdapter.create(AppModule, {
  validator: new ZodValidator(),
});
```

### Provider Model

```typescript
type Token<T = unknown> = string | symbol | (new (...args: any[]) => T);

type Provider<T = unknown> =
  | (new (...args: any[]) => T)                          // Class provider
  | { provide: Token<T>; useValue: T }                   // Value
  | { provide: Token<T>; useClass: new (...args: any[]) => T } // Class
  | {                                                     // Factory
      provide: Token<T>;
      useFactory: (...args: any[]) => T | Promise<T>;
      inject?: Token[];
    };
```

### No Auto-Registration

```typescript
// ❌ WRONG: Auto-registration
container.resolve(UserService);  // If not registered, auto-register

// ✅ CORRECT: Must be explicitly declared
// Provider declared in module → can resolve
```

---

## Tier 3: HTTP Layer (Hono)

### Hono Integration

Kanji wraps Hono for routing + middleware. Internally uses Hono's standard APIs.

### Context Keys (Official)

These are the **only** official context keys. Modules should use them, not invent others.

```typescript
// Authentication
kanji.auth.user              // Authenticated user object
kanji.auth.session           // Session (if applicable)
kanji.auth.roles             // string[] of roles
kanji.auth.scopes            // string[] of scopes (optional)
kanji.auth.principal         // Normalized identity object

// Authorization
kanji.authz.cache            // Map<string, Decision> per request
kanji.authz.decision         // Last authz decision (for debugging)

// Metadata
kanji.requestId              // Unique request identifier
kanji.validated              // Validated input
kanji.validated.body         // Validated request body
kanji.validated.query        // Validated query params
kanji.validated.params       // Validated URL params
kanji.validated.headers      // Validated headers
kanji.validated.cookies      // Validated cookies
```

### Middleware Pattern

```typescript
// Global middleware
export const loggerMiddleware = (c: Context, next: Next) => {
  console.log(`${c.req.method} ${c.req.path}`);
  return next();
};

app.use(loggerMiddleware);

// Controller-level middleware
@Controller('/users')
@Use(loggerMiddleware)
export class UsersController { }

// Route-level middleware
@Get('/sensitive')
@Use(authMiddleware)
getSensitive(c: Context) { }
```

---

## Tier 4: Contract-First Development

### Philosophy
Contracts are **metadata** only. Validation happens in **middleware**. Handlers are **clean**.

### Contract Definition

```typescript
const CreateUserContract = {
  request: {
    body: z.object({
      name: z.string().min(1),
      email: z.string().email(),
      role: z.enum(['admin', 'user']).default('user'),
    }),
    query: z.object({
      sendWelcomeEmail: z.boolean().optional(),
    }),
  },
  response: {
    201: z.object({
      id: z.string().uuid(),
      name: z.string(),
      email: z.string(),
      createdAt: z.date(),
    }),
    400: z.object({
      error: z.string(),
      issues: z.array(z.object({
        path: z.string(),
        code: z.string(),
        message: z.string(),
      })),
    }),
  },
};
```

### Usage in Controller

```typescript
@Post('/')
@Contract(CreateUserContract)
create(c: Context) {
  const body = c.get('kanji.validated.body');  // Typed ✅
  const query = c.get('kanji.validated.query'); // Typed ✅

  const user = this.usersService.create(body);
  return c.json(user, 201);
}
```

### Benefits

1. **No DTO duplication**: One schema (Zod) → types + validation + docs.
2. **Type safety**: Body, query, params are typed automatically.
3. **OpenAPI auto-generation**: Contract → OpenAPI spec.
4. **SDK generation**: OpenAPI → TypeScript SDK for clients.

### Error Shape (Standardized)

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "issues": [
    {
      "path": "body.email",
      "code": "invalid_email",
      "message": "Invalid email format"
    }
  ]
}
```

### Environment Variable Validation (Colocated Pattern)

**Problem:** A central `env.ts` with a hand-maintained Zod schema is a second source of truth. A developer adding `JWT_SECRET` to `auth.module.ts` has to remember to also declare it in `env.ts` — and nothing enforces that. This drifts silently and fails at runtime, not at build time.

**Solution:** Apply the same principle as Contracts — the schema lives **where the variable is used**, not in a separate registry.

```typescript
// packages/common/src/env.ts
import { z } from 'zod';

const cache = new Map<string, unknown>();
const errors: string[] = [];

export function env<T extends z.ZodTypeAny>(key: string, schema: T): z.infer<T> {
  if (cache.has(key)) return cache.get(key) as z.infer<T>;

  const result = schema.safeParse(process.env[key]);
  if (!result.success) {
    errors.push(`${key}: ${result.error.issues.map(i => i.message).join(', ')}`);
    return undefined as any; // reported in aggregate, not thrown here
  }
  cache.set(key, result.data);
  return result.data;
}

export function assertEnvValid(): void {
  if (errors.length > 0) {
    throw new Error(`❌ Invalid environment:\n${errors.map(e => `  - ${e}`).join('\n')}`);
  }
}
```

Usage — declared at the exact call site, no separate file to touch:

```typescript
// packages/auth/src/session.ts
import { env } from '@kanjijs/common';
import { z } from 'zod';

const jwtSecret = env('JWT_SECRET', z.string().min(32));
```

Because module imports execute their top-level code, every `env()` call registers itself as a side effect of the module graph being loaded. `main.ts` calls `assertEnvValid()` once, after all modules are imported and before the server starts listening — so missing/invalid variables fail fast, grouped into a single startup error, with zero manual bookkeeping.

**Enforcement (defense in depth):**

1. **Types** — `packages/common/src/env.d.ts` widens `process.env` values to `undefined`, so any direct `process.env.X` access fails type-checking. This is the primary guard: harder to bypass than a lint rule (survives destructuring, bracket access, aliasing).
2. **ESLint** — `no-restricted-properties` on `process.env` gives fast in-editor feedback with a custom message pointing to `env()`. A secondary layer, not the sole guard — it's syntactic and can be bypassed (`const { env } = process`), so it should never be relied on alone.
3. **CLI (`kanji env:check`)** — scans the built output (not just source) for raw `process.env` access and auto-generates `.env.example` from the registered `env()` calls, so the example file never drifts either.

**Benefits:**

1. **No second source of truth**: the schema declaration *is* the usage; there's nothing else to remember to update.
2. **Fail fast, once**: all env errors surface together at boot, not one crash at a time in production.
3. **Self-documenting**: `.env.example` generation comes for free from the same registrations.
4. **Consistent with Contract-First**: same Zod-colocation philosophy already used for HTTP request/response validation, so there's only one pattern to learn.

---

## Tier 5: OpenAPI + SDK Generation

### Workflow

```
Backend Contract Definition (Zod)
  ↓
@Contract() decorator (metadata)
  ↓
OpenAPI Generator (scans modules)
  ↓
openapi.json (industry standard)
  ↓
SDK Generator (TypeScript)
  ↓
Frontend SDK (fully typed client)
  ↓
Zero runtime API errors ✅
```

### Example: Contract → SDK

**Backend Contract:**
```typescript
export const CreateUserContract = {
  request: {
    body: z.object({
      name: z.string().min(1),
      email: z.string().email(),
    }),
  },
  response: {
    201: z.object({
      id: z.string().uuid(),
      name: z.string(),
      email: z.string(),
    }),
  },
};
```

**Auto-Generated Frontend SDK:**
```typescript
export class APIClient {
  async usersCreate(body: CreateUserRequest): Promise<User> {
    return this.request<User>('POST', '/users', { body });
  }
}

export const client = new APIClient('http://localhost:3000');
```

**Frontend Usage (fully typed):**
```typescript
const user = await client.usersCreate({ 
  name: 'Alice', 
  email: 'alice@example.com' 
});
// ✅ TypeScript checks types at compile time
// ✅ user is typed as User (from contract)
// ✅ IDE autocomplete
// ✅ No runtime errors
```

### CLI Commands

```bash
# Generate OpenAPI spec from contracts
kanji openapi:generate --output ./openapi.json

# Generate TypeScript SDK
kanji sdk:generate --spec ./openapi.json --output ../frontend/src/api.ts

# Serve Swagger UI
kanji openapi:serve --port 3001
```

### Benefits

**For Backend:**
- Single source of truth (no DTO duplication).
- Automatic documentation.
- Type safety enforced.

**For Frontend:**
- Fully typed API client.
- IDE autocomplete.
- Zero breaking surprises.
- Self-documenting code.

### Comparison

| Feature | Kanji | tRPC | Parse |
|---------|-------|------|-------|
| **Auto SDK** | ✅ Yes | ✅ Yes (magic) | ✅ Yes |
| **Industry standard** | ✅ OpenAPI | ❌ Proprietary | ❌ Custom |
| **Framework agnostic** | ✅ Yes (REST) | ❌ No | ✅ Partially |
| **REST compliant** | ✅ Yes | ❌ RPC | ✅ Yes |

---

## Tier 6: Native ORM Integration

### Decision: Drizzle ORM

Why Drizzle?
- TypeScript-first (not Node.js bolted on).
- Lightweight, no magic.
- Excellent schema definitions.
- Great migration tooling.
- Active community.

### Schema Definition

```typescript
// src/database/schema.ts
import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 256 }).notNull(),
  email: varchar('email', { length: 256 }).notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const posts = pgTable('posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 512 }).notNull(),
  content: text('content'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
```

### Module Integration

```typescript
// src/database/database.module.ts
const DATABASE_CLIENT = Symbol('DATABASE_CLIENT');

@KanjijsModule({
  providers: [
    {
      provide: DATABASE_CLIENT,
      useFactory: async () => {
        const client = postgres(process.env.DATABASE_URL!);
        return drizzle(client);
      },
    },
  ],
  exports: [DATABASE_CLIENT],
  global: true,
})
export class DatabaseModule {}
```

### Service Pattern

```typescript
// src/users/users.service.ts
@Injectable()
export class UsersService {
  constructor(
    @Inject(DATABASE_CLIENT)
    private db: ReturnType<typeof drizzle>,
  ) {}

  async findById(id: string): Promise<User | null> {
    return this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1)
      .then(rows => rows[0] || null);
  }

  async create(data: InsertUser): Promise<User> {
    return this.db
      .insert(users)
      .values(data)
      .returning()
      .then(rows => rows[0]);
  }

  async findWithPosts(userId: string) {
    return this.db
      .select()
      .from(users)
      .leftJoin(posts, eq(posts.userId, users.id))
      .where(eq(users.id, userId));
  }
}
```

### Migrations

```bash
# Generate migration from schema changes
drizzle-kit generate:pg

# Run migrations
kanji migrate

# Seed database
kanji seed:run
```

### CLI Integration

```bash
kanji migrate              # Run pending migrations
kanji migrate:rollback     # Rollback last migration
kanji seed:run             # Run seed file
kanji db:studio            # Open Drizzle Studio (visual browser)
```

---

## Tier 7: Multi-Database Support

### Philosophy

1. **Database agnostic at business logic level** — Services don't care if it's Postgres or Mongo.
2. **Easy switching** — Change DB with one config change.
3. **Common interface** — Same query builder works for both.

### Database Abstraction Layer

```typescript
// packages/store/src/types.ts
export interface Database {
  query: {
    [table: string]: QueryBuilder;
  };
  transaction<T>(fn: (trx: Database) => Promise<T>): Promise<T>;
  raw(sql: string, params?: any[]): Promise<any>;
  disconnect(): Promise<void>;
}
```

### PostgreSQL Adapter (with Drizzle)

```typescript
// packages/store/src/adapters/postgres.ts
export class PostgresDatabase implements Database {
  private db: ReturnType<typeof drizzle>;
  private client: ReturnType<typeof postgres>;

  constructor(connectionString: string) {
    this.client = postgres(connectionString);
    this.db = drizzle(this.client);
  }

  get query() {
    return {
      users: new PostgresQueryBuilder(this.db, 'users'),
      posts: new PostgresQueryBuilder(this.db, 'posts'),
    };
  }

  async transaction<T>(fn: (trx: Database) => Promise<T>): Promise<T> {
    return this.client.begin(async (sql) => {
      const trxDb = drizzle(sql);
      return fn(new PostgresDatabase(trxDb));
    });
  }

  async disconnect(): Promise<void> {
    await this.client.end();
  }
}
```

### MongoDB Adapter

```typescript
// packages/store/src/adapters/mongodb.ts
export class MongoDatabase implements Database {
  private client: MongoClient;
  private dbInstance: any;

  constructor(connectionString: string, dbName: string) {
    this.client = new MongoClient(connectionString);
    this.dbInstance = this.client.db(dbName);
  }

  get query() {
    return {
      users: new MongoQueryBuilder(this.dbInstance, 'users'),
      posts: new MongoQueryBuilder(this.dbInstance, 'posts'),
    };
  }

  async transaction<T>(fn: (trx: Database) => Promise<T>): Promise<T> {
    const session = this.client.startSession();
    try {
      await session.withTransaction(async () => {
        return fn(this);
      });
    } finally {
      await session.endSession();
    }
  }

  async disconnect(): Promise<void> {
    await this.client.close();
  }
}
```

### Store Module (with DI)

```typescript
// packages/store/src/store.module.ts
const DATABASE_CLIENT = Symbol('DATABASE_CLIENT');

export interface StoreConfig {
  type: 'postgres' | 'mongodb';
  connectionString: string;
  dbName?: string; // For MongoDB
}

@KanjijsModule({
  exports: [DATABASE_CLIENT],
  global: true,
})
export class StoreModule {
  static forRoot(config: StoreConfig) {
    return {
      module: StoreModule,
      providers: [
        {
          provide: DATABASE_CLIENT,
          useFactory: async () => {
            if (config.type === 'postgres') {
              return new PostgresDatabase(config.connectionString);
            } else if (config.type === 'mongodb') {
              return new MongoDatabase(config.connectionString, config.dbName!);
            }
            throw new Error(`Unknown database type: ${config.type}`);
          },
        },
      ],
      exports: [DATABASE_CLIENT],
      global: true,
    };
  }
}
```

### Usage (database agnostic)

```typescript
// src/users/users.service.ts
@Injectable()
export class UsersService {
  constructor(@Inject(DATABASE_CLIENT) private db: Database) {}

  async list(): Promise<User[]> {
    // Works for BOTH Postgres and MongoDB
    return this.db.query.users
      .select()
      .limit(10);
  }

  async findById(id: string): Promise<User | null> {
    return this.db.query.users
      .select()
      .where({ id })
      .limit(1);
  }

  // Same code works for Postgres AND MongoDB
}
```

### Configuration in AppModule

```typescript
// src/app.module.ts
@KanjijsModule({
  imports: [
    // Option 1: PostgreSQL
    StoreModule.forRoot({
      type: 'postgres',
      connectionString: process.env.DATABASE_URL!,
    }),

    // Option 2: MongoDB (just change config)
    // StoreModule.forRoot({
    //   type: 'mongodb',
    //   connectionString: process.env.MONGODB_URI!,
    //   dbName: 'myapp',
    // }),
  ],
})
export class AppModule {}
```

---

## Tier 8: Authentication (Native)

### Philosophy

Kanji's auth should be:
1. **Zero-config** — Works immediately after `npm install`.
2. **OAuth providers built-in** — Google, GitHub, Microsoft supported natively.
3. **No adapters needed** — Unlike NestJS (no passport, no adapters).
4. **Session + JWT support** — Both patterns supported.
5. **Integrated with Kanji** — Works with modules, DI, contracts.

### Session Provider (JWT)

```typescript
// packages/auth/src/session.ts
export interface KanjiSession {
  userId: string;
  email: string;
  name: string;
  roles: string[];
  scopes: string[];
  expiresAt: number;
}

export class SessionProvider {
  constructor(
    private jwtSecret: string = process.env.JWT_SECRET || 'dev-secret',
  ) {}

  createToken(session: Omit<KanjiSession, 'expiresAt'>): string {
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
    return sign({ ...session, expiresAt }, this.jwtSecret, { expiresIn: '24h' });
  }

  verifyToken(token: string): KanjiSession | null {
    try {
      const decoded = verify(token, this.jwtSecret) as KanjiSession;
      if (decoded.expiresAt < Date.now()) return null;
      return decoded;
    } catch {
      return null;
    }
  }

  refreshToken(token: string): string | null {
    const session = this.verifyToken(token);
    if (!session) return null;
    return this.createToken({
      userId: session.userId,
      email: session.email,
      name: session.name,
      roles: session.roles,
      scopes: session.scopes,
    });
  }
}
```

### OAuth Providers (AuthJS-compatible)

```typescript
// packages/auth/src/providers.ts
export const OAuthProviders = {
  google: (clientId: string, clientSecret: string) => ({
    id: 'google',
    name: 'Google',
    clientId,
    clientSecret,
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
  }),

  github: (clientId: string, clientSecret: string) => ({
    id: 'github',
    name: 'GitHub',
    clientId,
    clientSecret,
    authorizationUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
  }),

  microsoft: (clientId: string, clientSecret: string) => ({
    id: 'microsoft',
    name: 'Microsoft',
    clientId,
    clientSecret,
    authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
  }),
};
```

### Auth Module (DI-integrated)

```typescript
// packages/auth/src/auth.module.ts
const SESSION_PROVIDER = Symbol('SESSION_PROVIDER');
const AUTH_CONFIG = Symbol('AUTH_CONFIG');

export interface AuthConfig {
  jwtSecret: string;
  providers?: {
    google?: { clientId: string; clientSecret: string };
    github?: { clientId: string; clientSecret: string };
    microsoft?: { clientId: string; clientSecret: string };
  };
}

@KanjijsModule({
  exports: [SESSION_PROVIDER],
  global: true,
})
export class AuthModule {
  static forRoot(config: AuthConfig) {
    return {
      module: AuthModule,
      providers: [
        { provide: AUTH_CONFIG, useValue: config },
        {
          provide: SESSION_PROVIDER,
          useFactory: () => new SessionProvider(config.jwtSecret),
        },
      ],
      exports: [SESSION_PROVIDER],
      global: true,
    };
  }
}
```

### Auth Middleware (automatically applied)

```typescript
// packages/auth/src/middleware.ts
export const createAuthMiddleware = (sessionProvider: SessionProvider) => {
  return async (c: Context, next) => {
    const authHeader = c.req.header('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (token) {
      const session = sessionProvider.verifyToken(token);
      if (session) {
        c.set('kanji.auth.user', {
          id: session.userId,
          email: session.email,
          name: session.name,
        });
        c.set('kanji.auth.roles', session.roles);
        c.set('kanji.auth.scopes', session.scopes);
        c.set('kanji.auth.principal', session);
      }
    }

    await next();
  };
};
```

### OAuth Routes (auto-generated by CLI)

```typescript
// src/auth/oauth.controller.ts
@Controller('/auth')
export class OAuthController {
  constructor(
    @Inject(SESSION_PROVIDER) private session: SessionProvider,
  ) {}

  @Get('/signin/:provider')
  async signInWithProvider(c: Context) {
    const provider = c.req.param('provider');
    const redirectUri = `${process.env.APP_URL}/auth/callback`;

    const authUrl = getAuthorizationUrl(
      OAuthProviders[provider](clientId, clientSecret),
      redirectUri,
      generateRandomState(),
    );

    return c.redirect(authUrl);
  }

  @Get('/callback')
  async oauthCallback(c: Context) {
    const code = c.req.query('code');
    const state = c.req.query('state');
    const provider = c.req.query('provider');

    // Verify state, exchange code, get profile, create user, return token
    const token = '...';
    return c.redirect(`/auth/callback?token=${token}`);
  }

  @Post('/signin')
  @Contract(SignInContract)
  async signIn(c: Context) {
    const { email, password } = c.get('kanji.validated.body');

    const user = await this.usersService.findByEmail(email);
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    const token = this.session.createToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles,
      scopes: [],
    });

    return c.json({ token });
  }

  @Get('/me')
  @UseGuards(AuthGuard)
  async getCurrentUser(c: Context) {
    const user = c.get('kanji.auth.user');
    return c.json(user);
  }
}
```

### Usage in AppModule

```typescript
// src/app.module.ts
@KanjijsModule({
  imports: [
    AuthModule.forRoot({
      jwtSecret: process.env.JWT_SECRET || 'dev-secret',
      providers: {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        },
        github: {
          clientId: process.env.GITHUB_CLIENT_ID!,
          clientSecret: process.env.GITHUB_CLIENT_SECRET!,
        },
      },
    }),
    DatabaseModule,
    UsersModule,
  ],
})
export class AppModule {}
```

---

## Tier 9: Real-Time (WebSockets)

### Philosophy
WebSockets are **first-class citizens**. Authentication + authorization + validation work seamlessly.

### WebSocket Handler Pattern

```typescript
// src/chat/chat.gateway.ts
@WebSocketGateway('/chat')
@UseGuards(AuthGuard)
export class ChatGateway {
  constructor(
    @Inject(ChatService)
    private chatService: ChatService,
  ) {}

  @WebSocketMessage('send_message')
  @Contract({
    body: z.object({
      text: z.string().min(1),
      roomId: z.string().uuid(),
    }),
  })
  async onMessage(c: WebSocketContext) {
    const message = c.get('kanji.validated.body');
    const userId = c.get('kanji.auth.user')!.id;

    await this.chatService.broadcastMessage(
      message.roomId,
      userId,
      message.text,
    );

    c.send('message_sent', { timestamp: new Date() });
  }

  @WebSocketEvent('connect')
  onConnect(c: WebSocketContext) {
    console.log(`User ${c.get('kanji.auth.user')!.id} connected`);
  }

  @WebSocketEvent('disconnect')
  onDisconnect(c: WebSocketContext) {
    console.log(`User ${c.get('kanji.auth.user')!.id} disconnected`);
  }
}
```

### Hono Integration

Internally, Kanji uses Hono's `.upgrade()` method for WebSockets.

### Broadcasting

```typescript
// src/chat/chat.service.ts
@Injectable()
export class ChatService {
  private connections = new Map<string, WebSocket[]>();

  async broadcastMessage(roomId: string, userId: string, text: string) {
    const message = {
      id: uuid(),
      userId,
      text,
      timestamp: new Date(),
    };

    // Save to DB
    await this.db.insert(messages).values(message);

    // Broadcast to all connected users in room
    const roomConnections = this.connections.get(roomId) || [];
    roomConnections.forEach(socket => {
      socket.send('new_message', message);
    });
  }
}
```

---

## Tier 10: Security (RBAC + ACL)

### Model

**RBAC (Role-Based Access Control)**: Macro permissions  
**ACL (Access Control List)**: Micro permissions per object

**Rule:** Access granted **only if CLP AND ACL** allow it.

### CLP (Class-Level Permissions)

Decides if principal can **attempt** an action on a resource type.

```typescript
const postPermissions = {
  create: 'auth',
  read: 'public',
  update: { role: 'admin' },
  delete: { anyRole: ['admin', 'moderator'] },
  list: { role: 'user' },
};
```

Middleware usage:

```typescript
@Controller('/posts')
@Use(clp('Post', postPermissions))
export class PostsController {
  // All endpoints in this controller are protected by CLP
}
```

### ACL (Object-Level Permissions)

Decides if principal can **access this specific object**.

Model (Parse-style):

```typescript
type Acl = {
  public?: {
    read?: boolean;
    update?: boolean;
    delete?: boolean;
  };
  users?: {
    [userId: string]: {
      read?: boolean;
      update?: boolean;
      delete?: boolean;
    };
  };
  roles?: {
    [roleName: string]: {
      read?: boolean;
      update?: boolean;
      delete?: boolean;
    };
  };
};
```

Middleware:

```typescript
@Get('/:id')
@Use(acl({
  type: 'Post',
  action: 'read',
  id: (c) => c.req.param('id'),
  hideExistence: true,
}))
async getOne(c: Context) {
  const post = await this.postsService.findById(c.req.param('id'));
  return c.json(post);
}
```

### Authorization Helpers

```typescript
@Use(authorize({
  anyOf: [
    { role: 'admin' },
    { permission: 'post:write' },
  ],
}))
@Post('/')
create(c: Context) {
  // User is admin OR has permission "post:write"
}
```

### List with ACL Filter

Critical: ACL on `list` must be a **SQL filter**, not post-fetch loop.

```typescript
async listForUser(userId: string) {
  return this.db
    .select()
    .from(posts)
    .where(
      or(
        eq(posts.publicRead, true),
        eq(posts.ownerId, userId),
      ),
    );
}
```

---

## Tier 11: CLI & Developer Experience

### `kanji new`

```bash
kanji new my-api

# Creates:
# my-api/
# ├── src/
# │   ├── app.module.ts
# │   ├── app.controller.ts
# │   ├── main.ts
# │   └── modules/
# ├── .env.example
# ├── package.json
# ├── tsconfig.json
# └── README.md

cd my-api
npm install
npm run dev  # → Server running on http://localhost:3000
```

### `kanji g resource`

```bash
kanji g resource users

# Creates:
# src/users/
# ├── users.controller.ts
# ├── users.service.ts
# ├── users.contracts.ts
# ├── users.module.ts
# └── index.ts
```

### Other CLI Commands

```bash
# Database
kanji migrate                    # Run migrations
kanji migrate:create             # Create new migration
kanji seed:run                   # Run seed file
kanji db:studio                  # Open Drizzle Studio

# OpenAPI
kanji openapi:generate          # Export OpenAPI spec
kanji sdk:generate              # Generate TS SDK for clients
kanji openapi:serve             # Serve Swagger UI

# Development
kanji dev                        # Start dev server (HMR)
kanji build                      # Build for production
```

---

## Tier 12: Performance Guarantees

### Benchmarks (Target)

| Operation | Kanji | NestJS | Hono |
|-----------|-------|--------|------|
| **Simple GET** | 0.8ms | 2.5ms | 0.6ms |
| **POST with validation** | 1.2ms | 4.2ms | 1.0ms |
| **DB query + serialize** | 2.5ms | 3.8ms | 2.3ms |
| **WebSocket message** | 0.5ms | 1.5ms | 0.4ms |

### Rules

1. **No reflection per request** (only at bootstrap).
2. **No DI.resolve() per request** (DI happens once at startup).
3. **No logs by default** (only on debug flag or error).
4. **Request-level caching** (automatic deduplication).
5. **Smart relation loading** (N+1 protection in ORM).

### Caching Decorator

```typescript
@Injectable()
export class UsersService {
  @Cacheable({ ttl: 60 })
  async getUserFull(id: string) {
    return this.db.query.users.select().where({ id });
  }
}
```

### Rate Limiting (Built-in)

```typescript
@RateLimit({ limit: 100, window: '1m', by: 'user' })
@Post('/send-email')
sendEmail(c: Context) {
  // Sliding window rate limiting
}
```

---

## Tier 13: Testing Strategy

### Philosophy

**Integration testing first.** Unit tests second.

### Test Module Creation

```typescript
// tests/users.controller.spec.ts
describe('UsersController', () => {
  let app: Hono;
  let db: Database;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DATABASE_CLIENT)
      .useValue(createTestDatabase())
      .compile();

    app = module.app;
    db = module.db;
  });

  afterEach(async () => {
    await db.clear();
  });

  it('should create user', async () => {
    const res = await app.request(
      new Request('http://test/users', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Alice',
          email: 'alice@example.com',
        }),
      }),
    );

    expect(res.status).toBe(201);

    const user = await db.query.users.select().where({ email: 'alice@example.com' });
    expect(user).toBeDefined();
  });
});
```

### Factories & Fixtures

```typescript
// tests/fixtures/users.fixture.ts
export async function createTestUser(
  db: Database,
  overrides?: Partial<InsertUser>,
): Promise<User> {
  return db.query.users
    .insert({
      name: 'Test User',
      email: `user-${Date.now()}@example.com`,
      ...overrides,
    })
    .returning();
}
```

---

## Code Organization (Recommended Pattern)

### Hybrid Architecture: Feature-based + Separated Layers

**Principle:** Features are colocated but layers are separated (scales from 5 to 500 endpoints).

### Structure

```
src/
├── users/
│   ├── users.controller.ts       (HTTP handlers)
│   ├── users.service.ts          (business logic)
│   ├── users.contracts.ts        (types + validation)
│   ├── users.module.ts           (DI setup)
│   └── index.ts                  (barrel export)
├── posts/
│   ├── posts.controller.ts
│   ├── posts.service.ts
│   ├── posts.contracts.ts
│   ├── posts.module.ts
│   └── index.ts
├── auth/
│   ├── oauth.controller.ts
│   ├── oauth.service.ts
│   ├── auth.contracts.ts
│   ├── auth.module.ts
│   └── index.ts
├── database/
│   ├── database.module.ts
│   └── schema.ts
├── app.module.ts
└── main.ts
```

### When to Scale (50+ endpoints)

```
src/users/
├── controller/
│   ├── users.controller.ts       (basic CRUD)
│   ├── profile.controller.ts
│   └── settings.controller.ts
├── service/
│   ├── users.service.ts
│   ├── profile.service.ts
│   └── settings.service.ts
├── users.contracts.ts
├── users.module.ts
└── index.ts
```

### Example: Complete Feature

**users.controller.ts:**
```typescript
@Controller('/users')
@Use(clp('User', { create: 'auth', read: 'public', update: 'auth', delete: { role: 'admin' } }))
export class UsersController {
  constructor(private service: UsersService) {}

  @Get('/')
  async list(c: Context) {
    return c.json(await this.service.list());
  }

  @Post('/')
  @Contract(CreateUserContract)
  async create(c: Context) {
    const body = c.get('kanji.validated.body');
    return c.json(await this.service.create(body), 201);
  }

  @Get('/:id')
  @Use(acl({ type: 'User', action: 'read', id: (c) => c.req.param('id') }))
  async getOne(c: Context) {
    const user = await this.service.findById(c.req.param('id'));
    return c.json(user);
  }

  @Put('/:id')
  @Use(acl({ type: 'User', action: 'update', id: (c) => c.req.param('id') }))
  @Contract(UpdateUserContract)
  async update(c: Context) {
    const body = c.get('kanji.validated.body');
    return c.json(await this.service.update(c.req.param('id'), body));
  }

  @Delete('/:id')
  @Use(acl({ type: 'User', action: 'delete', id: (c) => c.req.param('id') }))
  async delete(c: Context) {
    await this.service.delete(c.req.param('id'));
    return c.body(null, 204);
  }
}
```

**users.service.ts:**
```typescript
@Injectable()
export class UsersService {
  constructor(@Inject(DATABASE_CLIENT) private db: Database) {}

  async list(): Promise<User[]> {
    return this.db.query.users.select().limit(100);
  }

  async findById(id: string): Promise<User | null> {
    const result = await this.db.query.users.select().where({ id }).limit(1);
    return result[0] || null;
  }

  async create(data: CreateUserInput): Promise<User> {
    return this.db.query.users.insert(data).returning();
  }

  async update(id: string, data: UpdateUserInput): Promise<User> {
    return this.db.query.users.update(data).where({ id }).returning();
  }

  async delete(id: string): Promise<void> {
    await this.db.query.users.delete().where({ id });
  }
}
```

**users.contracts.ts:**
```typescript
export const CreateUserContract = {
  request: {
    body: z.object({
      name: z.string().min(1),
      email: z.string().email(),
    }),
  },
  response: {
    201: z.object({
      id: z.string().uuid(),
      name: z.string(),
      email: z.string(),
      createdAt: z.date(),
    }),
  },
};

export const UpdateUserContract = {
  request: {
    body: z.object({
      name: z.string().min(1).optional(),
      email: z.string().email().optional(),
    }),
  },
  response: {
    200: z.object({
      id: z.string().uuid(),
      name: z.string(),
      email: z.string(),
      createdAt: z.date(),
    }),
  },
};
```

**users.module.ts:**
```typescript
@KanjijsModule({
  imports: [DatabaseModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

**index.ts:**
```typescript
export { UsersController } from './users.controller';
export { UsersService } from './users.service';
export { CreateUserContract, UpdateUserContract } from './users.contracts';
export type { User, CreateUserInput, UpdateUserInput } from './users.contracts';
```

---

## Implementation Roadmap

### Phase 1: Foundation (3-4 weeks) → v1.0.0-alpha
**Goal:** Stable foundation ready for feature addition

- [ ] Core module system + DI
- [ ] Hono adapter + routing
- [ ] Contract validation (Zod)
- [ ] Drizzle integration + migrations
- [ ] CLI: `kanji new` + basic `kanji g resource`
- [ ] Testing framework
- [ ] Basic docs + examples

**Deliverable:** `npm install @kanjijs/core@1.0.0-alpha`

### Phase 2: OpenAPI + SDK (2-3 weeks) → v1.0.0-beta
**Goal:** Type-safe frontend integration

- [ ] OpenAPI generation from contracts
- [ ] TypeScript SDK generation
- [ ] CLI: `kanji openapi:generate`, `kanji sdk:generate`
- [ ] Swagger UI integration
- [ ] Example: full-stack app with SDK
- [ ] Documentation

**Deliverable:** `npm install @kanjijs/core@1.0.0-beta`

### Phase 3: Auth + Multi-DB (2 weeks) → v1.0.0-rc
**Goal:** Production infrastructure

- [ ] Auth module (SessionProvider, OAuth)
- [ ] MongoDB adapter
- [ ] Database abstraction layer
- [ ] Auth + DB integration tests
- [ ] CLI generators (schema, oauth routes)

**Deliverable:** `npm install @kanjijs/core@1.0.0-rc`

### Phase 4: Real-time + Security (2 weeks) → v1.0.0-rc2
**Goal:** Advanced features

- [ ] WebSocket gateway + real-time
- [ ] RBAC + ACL system
- [ ] Rate limiting decorator
- [ ] Caching decorator
- [ ] Security audit

**Deliverable:** `npm install @kanjijs/core@1.0.0-rc2`

### Phase 5: Polish + Launch (2 weeks) → v1.0.0 stable
**Goal:** Production battle-tested

- [ ] Performance benchmarks + optimization
- [ ] Comprehensive documentation
- [ ] Blog posts + marketing
- [ ] Community setup (Discord, GitHub discussions)
- [ ] Real-world examples

**Deliverable:** `npm install @kanjijs/core@1.0.0` ✅

---

## Appendix: Complete Code Examples

### Example 1: App Bootstrap

```typescript
// src/main.ts
import { KanjijsAdapter } from '@kanjijs/platform-hono';
import { ZodValidator } from '@kanjijs/contracts';
import { AppModule } from './app.module';

async function bootstrap() {
  const { app, container } = await KanjijsAdapter.create(AppModule, {
    validator: new ZodValidator(),
  });

  const port = process.env.PORT || 3000;
  console.log(`🚀 Kanji running on http://localhost:${port}`);

  return app;
}

export default bootstrap();
```

### Example 2: AppModule

```typescript
// src/app.module.ts
import { KanjijsModule } from '@kanjijs/core';
import { AuthModule } from '@kanjijs/auth';
import { StoreModule } from '@kanjijs/store';
import { UsersModule } from './users/users.module';
import { PostsModule } from './posts/posts.module';

@KanjijsModule({
  imports: [
    AuthModule.forRoot({
      jwtSecret: process.env.JWT_SECRET || 'dev-secret',
      providers: {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        },
        github: {
          clientId: process.env.GITHUB_CLIENT_ID!,
          clientSecret: process.env.GITHUB_CLIENT_SECRET!,
        },
      },
    }),
    StoreModule.forRoot({
      type: 'postgres',
      connectionString: process.env.DATABASE_URL!,
    }),
    UsersModule,
    PostsModule,
  ],
})
export class AppModule {}
```

### Example 3: Full Feature (Users CRUD + Auth)

**users.contracts.ts:**
```typescript
import { z } from 'zod';

export const CreateUserContract = {
  request: {
    body: z.object({
      name: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(8),
    }),
  },
  response: {
    201: z.object({
      id: z.string().uuid(),
      name: z.string(),
      email: z.string(),
      createdAt: z.date(),
    }),
    400: z.object({
      error: z.string(),
    }),
  },
};

export const UpdateUserContract = {
  request: {
    body: z.object({
      name: z.string().min(1).optional(),
      email: z.string().email().optional(),
    }),
  },
  response: {
    200: z.object({
      id: z.string().uuid(),
      name: z.string(),
      email: z.string(),
      createdAt: z.date(),
    }),
  },
};

export type User = z.infer<typeof CreateUserContract.response[201]>;
export type CreateUserInput = z.infer<typeof CreateUserContract.request.body>;
export type UpdateUserInput = z.infer<typeof UpdateUserContract.request.body>;
```

**users.service.ts:**
```typescript
import { Injectable, Inject } from '@kanjijs/core';
import { DATABASE_CLIENT } from '@kanjijs/store';
import { User, CreateUserInput, UpdateUserInput } from './users.contracts';
import bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(@Inject(DATABASE_CLIENT) private db: Database) {}

  async list(): Promise<User[]> {
    return this.db.query.users
      .select({ id: true, name: true, email: true, createdAt: true })
      .limit(100);
  }

  async findById(id: string): Promise<User | null> {
    const result = await this.db.query.users
      .select({ id: true, name: true, email: true, createdAt: true })
      .where({ id })
      .limit(1);
    return result[0] || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.db.query.users
      .select({ id: true, name: true, email: true, createdAt: true })
      .where({ email })
      .limit(1);
    return result[0] || null;
  }

  async create(data: CreateUserInput): Promise<User> {
    const passwordHash = await bcrypt.hash(data.password, 10);

    const result = await this.db.query.users
      .insert({
        name: data.name,
        email: data.email,
        passwordHash,
        createdAt: new Date(),
      })
      .returning({ id: true, name: true, email: true, createdAt: true });

    return result[0];
  }

  async update(id: string, data: UpdateUserInput): Promise<User> {
    const result = await this.db.query.users
      .update(data)
      .where({ id })
      .returning({ id: true, name: true, email: true, createdAt: true });

    return result[0];
  }

  async delete(id: string): Promise<void> {
    await this.db.query.users.delete().where({ id });
  }
}
```

**users.controller.ts:**
```typescript
import { Controller, Get, Post, Put, Delete, Inject } from '@kanjijs/core';
import { Context } from 'hono';
import { UsersService } from './users.service';
import { CreateUserContract, UpdateUserContract } from './users.contracts';
import { SESSION_PROVIDER } from '@kanjijs/auth';

@Controller('/users')
@Use(clp('User', {
  create: 'public',
  read: 'public',
  update: 'auth',
  delete: { role: 'admin' },
}))
export class UsersController {
  constructor(
    private service: UsersService,
    @Inject(SESSION_PROVIDER) private session: SessionProvider,
  ) {}

  @Get('/')
  async list(c: Context) {
    const users = await this.service.list();
    return c.json(users);
  }

  @Post('/')
  @Contract(CreateUserContract)
  async create(c: Context) {
    const body = c.get('kanji.validated.body');

    // Check if email already exists
    const existing = await this.service.findByEmail(body.email);
    if (existing) {
      return c.json({ error: 'Email already registered' }, 400);
    }

    const user = await this.service.create(body);
    return c.json(user, 201);
  }

  @Get('/:id')
  @Use(acl({ type: 'User', action: 'read', id: (c) => c.req.param('id') }))
  async getOne(c: Context) {
    const user = await this.service.findById(c.req.param('id'));
    if (!user) return c.notFound();
    return c.json(user);
  }

  @Put('/:id')
  @UseGuards(AuthGuard)
  @Use(acl({ type: 'User', action: 'update', id: (c) => c.req.param('id') }))
  @Contract(UpdateUserContract)
  async update(c: Context) {
    const body = c.get('kanji.validated.body');
    const user = await this.service.update(c.req.param('id'), body);
    return c.json(user);
  }

  @Delete('/:id')
  @UseGuards(AuthGuard)
  @Use(acl({ type: 'User', action: 'delete', id: (c) => c.req.param('id') }))
  async delete(c: Context) {
    await this.service.delete(c.req.param('id'));
    return c.body(null, 204);
  }

  @Get('/me')
  @UseGuards(AuthGuard)
  async getCurrentUser(c: Context) {
    const user = c.get('kanji.auth.user');
    return c.json(user);
  }
}
```

**users.module.ts:**
```typescript
import { KanjijsModule } from '@kanjijs/core';
import { StoreModule } from '@kanjijs/store';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@KanjijsModule({
  imports: [StoreModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

---

## Future Roadmap: @kanjijs/client

### Overview

`@kanjijs/client` is a **future package** (post-v1.0.0) for frontend SDK generation and client-side integration.

### Planned Features

```typescript
// @kanjijs/client package (v1.1.0+)

// Auto-generated from OpenAPI spec
import { createClient } from '@kanjijs/client';

const client = createClient({
  baseURL: 'http://localhost:3000',
  token: sessionStorage.getItem('auth_token'),
});

// Fully typed API calls
const user = await client.users.create({
  name: 'Alice',
  email: 'alice@example.com',
});

// Built-in types from OpenAPI
type User = typeof client.users.$response[201];

// Real-time subscriptions
client.posts.subscribe('created', (post) => {
  console.log('New post:', post);
});

// Request/response hooks
client.use({
  request: (config) => { /* ... */ },
  response: (response) => { /* ... */ },
  error: (error) => { /* ... */ },
});
```

### Architecture

```
Backend (Kanji)
  ↓
@Contract() decorators
  ↓
OpenAPI spec (openapi.json)
  ↓
kanji openapi:generate
  ↓
Frontend SDK (@kanjijs/client)
  ↓
Fully typed React/Vue/Svelte components
```

### When to Implement

- **v1.0.0:** Focus on backend (core, auth, DB, ORM, OpenAPI).
- **v1.1.0:** SDK generation (TypeScript client).
- **v1.2.0+:** `@kanjijs/client` package with framework bindings (React hooks, Vue composables, etc).

### Note

Currently, we generate **raw TypeScript SDK** from OpenAPI. `@kanjijs/client` will wrap this with:
- Automatic request/response handling
- Error boundaries
- Caching strategies
- Real-time subscriptions (if WebSockets enabled)
- Framework-specific bindings

---

## Conclusion

Kanji v1.0.0 is designed to be:

1. **Fast** — Hono-level performance, no compromise.
2. **Safe** — Type-safe end-to-end, with auto-generated SDKs.
3. **Developer-friendly** — 0-to-API in 90 seconds, with OpenAPI + SDK.
4. **Production-ready** — Built for startups shipping fast.
5. **Learnable** — You understand every line.

**Differentiation:** The framework that combines Hono's speed, NestJS's structure, tRPC's type safety, Parse's ease-of-use, and Rails's simplicity. All via industry-standard REST + OpenAPI.

**Target:** The developer who wants Rails velocity + TypeScript safety + Bun speed + auto-generated type-safe SDKs + built-in auth + multi-DB support, without the overhead of NestJS or the minimalism of Express.

---

## References & Next Steps

- **GitHub Repository:** [kanjijs/kanji](https://github.com/kanjijs/kanji)
- **Getting Started:** See `QUICKSTART.md`
- **Contributing:** See `CONTRIBUTING.md`
- **Examples:** See `examples/` directory
- **Roadmap:** See `ROADMAP.md`

---

**Document Version:** 1.0.0  
**Last Updated:** 2025  
**Status:** Architecture Complete → Implementation Phase 1 Ready  
**Target Release:** v1.0.0-alpha (Week 1-4) → v1.0.0 stable (Week 9)