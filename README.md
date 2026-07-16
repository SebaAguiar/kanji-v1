# Kanji Framework

Kanji is a modern, high-performance backend framework built for **Bun** using **Hono**, designed for modularity, type-safety, and secure-by-default architectures.

## Key Features

- **Modular Dependency Injection**: Deterministic container system per app instance, built on TypeScript decorators. Dynamic modules with `forRoot()` pattern.
- **Contract-First Validation**: Declare API contracts using Zod schemas once. Automatic request validation, type inference, and OpenAPI documentation generation.
- **Database Agnostic Store**: PostgreSQL (via Drizzle ORM) and MongoDB adapters sharing a common `Database` interface. Switch databases with a single config change.
- **Action-Level Security**: Native Class-Level Permissions (CLP), Access Control Lists (ACL), and `AuthGuard` for route protection.
- **Built-in Authentication**: JWT sessions, OAuth 2.0 providers (Google, GitHub, Microsoft), and auto-generated OAuth routes.
- **WebSocket Gateways**: First-class real-time support with `@WebSocketGateway`, `@WebSocketMessage`, auth integration, and contract validation.
- **OpenAPI + SDK Generation**: Contracts → OpenAPI spec → TypeScript client SDK. Fully typed frontend integration.
- **Exception Filters**: Decorator-based error handling with DI support via `@Catch()`.
- **Interactive Scaffolding**: CLI wizard to generate modules, CRUD resources, policies, and test suites.

---

## Repository Structure

```text
kanji/
├── packages/
│   ├── core/             # DI container, module system, decorators, metadata
│   ├── platform-hono/    # Hono adapter, context keys, HTTP metadata, WebSocket gateways, exception filters
│   ├── contracts/        # Zod validation, contract decorator, error normalization
│   ├── auth/             # JWT sessions, OAuth providers, CLP & ACL guards, policy system
│   ├── store/            # Database abstraction (Postgres via Drizzle + MongoDB adapter)
│   ├── openapi/          # OpenAPI spec generation, TypeScript SDK generator, Swagger UI
│   ├── testing/          # Testing utilities (TestingModuleBuilder, test database, fixtures)
│   ├── common/           # Shared utilities (errors, decorator helpers, env validation, logger)
│   └── cli/              # Commander-based CLI for scaffolding, migrations, and dev tooling
│
└── examples/
    └── basic/            # Reference CRUD application with users, products, auth
```

---

## Quick Start

Clone the repository and install dependencies:

```bash
pnpm install
```

Run the test suite:

```bash
bun test
```

Explore the example application:

```bash
cd examples/basic
bun run dev
```

---

## CLI Overview

Kanji ships with a CLI for scaffolding and development tasks. When installed as a package dependency, it's available as `kanji`:

```bash
bunx kanji new my-app         # Scaffold a new project
kanji g resource users        # Generate a CRUD module (or omit args for interactive wizard)
kanji migrate                 # Run database migrations
kanji openapi:generate        # Generate OpenAPI spec from contracts
kanji sdk:generate            # Generate TypeScript client SDK
kanji dev                     # Start dev server with watch mode
kanji auth-setup              # Configure authorization policies interactively
```

The CLI is organized into three layers:

```text
packages/cli/src/
├── commands/          # One file per command (new, generate, migrate, dev, etc.)
├── templates/         # Pure template functions returning strings (controller, service, contracts, etc.)
├── utils/             # Shared utilities (inflection, file generation, module updates)
├── cli.ts             # Entry point — registers all commands with Commander
└── index.ts           # Barrel exports for programmatic use
```

### Interactive Resource Generator

To scaffold a complete, type-safe CRUD module:

```bash
cd examples/basic
bunx kanji g
```

The generator:
- Scans `app.module.ts` to auto-detect your database adapter (PostgreSQL or MongoDB)
- Prompts for resource name and CRUD actions (create, findAll, findOne, update, delete)
- Optionally configures authorization models per action (public, role-based, owner-based)
- Generates contracts, repository, service, controller, module, and tests
- Auto-registers the module in `app.module.ts`

### Authorization Policy Wizard

To configure route permissions:

```bash
bunx kanji auth-setup
```

1. Select the module to protect.
2. Select which CRUD actions to secure.
3. Choose an authorization model per action:
   - **Role-based (RBAC)**: Allowed roles (e.g. `admin`, `moderator`)
   - **Owner-based (ACL)**: Restrict to the resource owner
4. The CLI creates a `{resource}.policy.ts` file and registers it in the module.

---

## Granular Policy Example

An auto-generated policy securing different CRUD actions on a `products` resource:

```typescript
import { Injectable } from '@kanjijs/core';
import type { ResourcePolicy } from '@kanjijs/auth';
import type { Context } from 'hono';

@Injectable()
export class ProductPolicy implements ResourcePolicy {
  canRead(c: Context, resource: any, user: any): boolean {
    return true; // Read is public
  }

  canCreate(c: Context, resource: any, user: any): boolean {
    const allowed = ['admin'];
    return user.roles.some((role: string) => allowed.includes(role));
  }

  canUpdate(c: Context, resource: any, user: any): boolean {
    return resource.userId === user.userId || user.roles.includes('admin');
  }

  canDelete(c: Context, resource: any, user: any): boolean {
    return resource.userId === user.userId || user.roles.includes('admin');
  }
}
```

This policy is mapped to the controller using `@UseGuards(acl(...))` and `@UseGuards(clp(...))` decorators, validated at runtime before handler execution.

---

## Packages

| Package | Description |
|---|---|
| `@kanjijs/core` | Module system, DI container, decorators (`@Injectable`, `@Controller`, `@Module`) |
| `@kanjijs/platform-hono` | Hono HTTP adapter, WebSocket gateways, exception filters, context helpers |
| `@kanjijs/contracts` | Contract-first validation with Zod, error normalization |
| `@kanjijs/auth` | JWT sessions, OAuth (Google, GitHub, Microsoft), guards, CLP/ACL |
| `@kanjijs/store` | Database abstraction — PostgreSQL (Drizzle) and MongoDB adapters |
| `@kanjijs/openapi` | OpenAPI spec generation, TypeScript SDK generator, Swagger UI |
| `@kanjijs/testing` | Testing utilities, in-memory test database, fixtures |
| `@kanjijs/common` | Shared utilities (env validation, error classes, decorator helpers) |
| `@kanjijs/cli` | CLI commands for scaffolding, migrations, and dev tooling |

---

## License

GNU AGPL v3
