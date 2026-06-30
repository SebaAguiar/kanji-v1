# Glossary of Terms

This glossary defines core terms and entities used within the Kanji Framework codebase.

---

## 1. Domain Entities

- **Module:** A self-contained unit of the application that groups related controllers, services, and providers. Every feature lives in a module. Modules define explicit `imports`, `exports`, `providers`, and `controllers`.
- **Controller:** A class decorated with `@Controller()` that handles HTTP requests. Controllers are thin — they parse input, delegate to services, and return responses.
- **Service:** A class decorated with `@Injectable()` that contains business logic. Services are injected into controllers and other services via DI.
- **Provider:** Any dependency that can be injected via the DI container. Can be a class, value, or factory. Providers are declared in a module's `providers` array.
- **Token:** A unique identifier for a provider in the DI container. Usually a `Symbol` (e.g., `DATABASE_CLIENT`) or a class reference.
- **Contract:** A Zod schema definition for a request/response pair. Contracts define what a route accepts (body, query, params) and returns (status codes + shapes).
- **Dynamic Module:** A module that accepts configuration at import time (e.g., `ConfigModule.forRoot({...})`). Returns a `DynamicModule` object with its own providers.

---

## 2. Technical Terms

- **DI (Dependency Injection):** A pattern where dependencies are provided to a class from the outside rather than created internally. Kanji uses constructor-based DI resolved at startup.
- **Container:** The DI container that holds all providers and resolves dependencies. One container per app instance (not global). Resolution happens once at bootstrap.
- **Hono:** The HTTP router framework that Kanji uses as its foundation. Ultra-fast, TypeScript-native, runs on Bun/Deno/Node.js.
- **Zod:** A TypeScript-first schema validation library used for contract definitions. Infer types from schemas automatically.
- **Drizzle ORM:** A lightweight, TypeScript-first ORM used for database access. Supports PostgreSQL (primary) and MongoDB.
- **OpenAPI:** An industry-standard specification for RESTful APIs. Kanji generates `openapi.json` from Zod contracts automatically.
- **SDK Generator:** A tool that consumes `openapi.json` and generates a fully typed TypeScript client. Enables type-safe frontend-backend communication.
- **OAuth (Open Authorization):** An open standard for token-based authentication. Kanji includes built-in OAuth providers for Google, GitHub, and Microsoft.
- **JWT (JSON Web Token):** A compact, URL-safe token format used for session management. Kanji uses JWTs with configurable expiry.
- **WAL Mode (Write-Ahead Logging):** An SQLite journaling mode that enables concurrent reads during writes. Used in tests for database isolation.
- **RBAC (Role-Based Access Control):** An access control model where permissions are assigned to roles, and roles are assigned to users. Built into Kanji's auth system.
- **ACL (Access Control List):** A fine-grained permission model where permissions are assigned directly to specific resources. Kanji supports object-level ACL.
- **Bun:** The JavaScript runtime used by Kanji. Fast startup, built-in test runner, TypeScript support without configuration.
- **pnpm:** A fast, disk-space-efficient package manager with workspace support. Used for Kanji's monorepo.
- **CLI (Command Line Interface):** The `kanji` command-line tool for scaffolding projects (`kanji new`), generating resources (`kanji g resource`), and running migrations (`kanji migrate`).

---

## 3. Architectural Terms

- **Module-first:** The principle that all code in Kanji lives within modules. No global state, no auto-registration, no implicit discovery.
- **Contract-first:** The development workflow where API contracts (Zod schemas) are defined before implementation. Contracts drive validation, OpenAPI generation, and SDK generation.
- **Deterministic DI:** The property that DI resolution is deterministic and happens once at startup. If a provider isn't visible, the error is thrown immediately, not at runtime.
- **Thin controllers:** The pattern where controllers handle only HTTP concerns (parsing, delegating, responding). All business logic lives in services.
- **Database-agnostic:** The property that service code works identically with PostgreSQL and MongoDB via the common `Database` interface.
- **One container per app:** The pattern that each `KanjijsAdapter.create()` call creates its own DI container, enabling isolated testing and multi-instance scenarios.
- **Provider Token:** A `Symbol` or class reference used to identify a provider in the DI container. Tokens enable multiple providers of the same type (e.g., multiple database connections).
- **Factory Provider:** A provider defined with `useFactory` that creates its value lazily. Used for async initialization (e.g., database connections).
- **Global Module:** A module marked with `global: true` whose exports are visible to all modules without explicit import. Use sparingly (database, config, auth).
- **Testing Module:** An isolated module created by `createTestingModule()` for integration tests. Uses a separate DI container and in-memory database.

---

## 4. CLI Terms

- **`kanji new`:** Creates a new Kanji project from a template. Sets up the directory structure, package.json, tsconfig, and example files.
- **`kanji g resource`:** Generates a complete CRUD resource (controller, service, contracts, module) with a single command.
- **`kanji openapi:generate`:** Scans all modules for `@Contract()` decorators and generates `openapi.json`.
- **`kanji sdk:generate`:** Consumes `openapi.json` and generates a TypeScript SDK client.
- **`kanji migrate`:** Runs pending database migrations using Drizzle Kit.
- **`kanji dev`:** Starts the development server with hot reload.
