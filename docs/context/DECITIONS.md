# Technical Decisions

This document records the architectural and technical decisions made during the development of Kanji Framework, including the trade-offs and alternatives considered.

---

## 1. Hono as the HTTP Router

- **Decision:** Use Hono as the core HTTP routing layer.
- **Rationale:** Hono is 3-10x faster than Express and NestJS, has native TypeScript support, and runs on Bun, Deno, and Node.js. It provides a minimal yet powerful middleware model that Kanji extends with structure (modules, DI, contracts).
- **Alternatives Considered:**
  - *Express:* Rejected due to slower performance, poor TypeScript support, and legacy middleware patterns.
  - *NestJS:* Rejected due to heavy abstraction, slower startup, and tight coupling to Express/Fastify.
  - *Fastify:* Rejected because Hono offers better Bun integration and simpler API.
- **Trade-off:** Hono has a smaller ecosystem than Express, but Kanji provides the missing structure (auth, ORM, contracts) as built-in packages.

---

## 2. Zod for Contract Validation

- **Decision:** Use Zod schemas for request/response validation and OpenAPI generation.
- **Rationale:** Zod is the most popular TypeScript-first validation library with excellent type inference. Schemas serve dual purpose: runtime validation + TypeScript types, eliminating duplication.
- **Alternatives Considered:**
  - *Joi:* Rejected because it's not TypeScript-native and doesn't infer types.
  - *Yup:* Rejected due to weaker TypeScript integration and slower performance.
  - *io-ts:* Rejected due to complex API and steeper learning curve.
- **Trade-off:** Zod adds a compile-time dependency, but the type safety benefits outweigh the cost.

---

## 3. Drizzle ORM for Database Access

- **Decision:** Use Drizzle ORM as the primary database abstraction.
- **Rationale:** Drizzle is TypeScript-first, lightweight, has zero magic, and provides excellent schema definitions with automatic migration generation. It works with both SQL and NoSQL databases.
- **Alternatives Considered:**
  - *Prisma:* Rejected due to heavier binary, schema DSL (not TypeScript), and slower startup.
  - *TypeORM:* Rejected due to decorator-based magic, performance issues, and complex API.
  - *Knex.js:* Rejected because it's not TypeScript-first and lacks schema generation.
- **Trade-off:** Drizzle is newer than Prisma, but its TypeScript-native approach aligns with Kanji's philosophy.

---

## 4. Module System with Explicit Boundaries

- **Decision:** Enforce explicit module imports/exports with no global state or auto-registration.
- **Rationale:** Implicit dependency resolution (auto-registration, global container) leads to runtime surprises and makes testing difficult. Explicit boundaries catch errors at bootstrap time.
- **Alternatives Considered:**
  - *Auto-registration (NestJS-style):* Rejected because it hides dependency graphs and makes debugging harder.
  - *No module system (plain Hono):* Rejected because it lacks structure, leading to disorganized codebases at scale.
- **Trade-off:** More boilerplate when creating modules, but clearer dependency tracking and better tooling support.

---

## 5. Deterministic Dependency Injection (One Container per App)

- **Decision:** Create one DI container per app instance at startup, not a global singleton.
- **Rationale:** Global singletons prevent proper isolation for testing and make it impossible to run multiple app instances in the same process. Per-app containers enable `createTestingModule()` for isolated test environments.
- **Alternatives Considered:**
  - *Global container (Awilix-style):* Rejected because it prevents test isolation and creates hidden state.
  - *No DI (manual dependency passing):* Rejected because it becomes unmanageable at scale.
- **Trade-off:** Slightly more complex startup logic, but enables clean testing patterns.

---

## 6. OpenAPI + SDK Generation (Industry Standard over tRPC Magic)

- **Decision:** Generate OpenAPI specs from Zod contracts, then generate TypeScript SDKs from the specs.
- **Rationale:** OpenAPI is the industry standard for API documentation. Unlike tRPC (which uses a proprietary protocol), OpenAPI enables any client (web, mobile, third-party) to consume the API. SDK generation from OpenAPI is a well-understood pattern.
- **Alternatives Considered:**
  - *tRPC:* Rejected because it locks clients into a TypeScript-only, RPC-style protocol that's not REST-compliant and can't be consumed by non-TypeScript clients.
  - *GraphQL:* Rejected because it adds complexity (schema, resolvers, N+1 problem) that most apps don't need.
- **Trade-off:** OpenAPI requires a generation step that tRPC doesn't, but it's a standard that any tool can consume.

---

## 7. Multi-Database Support via Common Interface

- **Decision:** Define a `Database` interface with PostgreSQL (Drizzle) and MongoDB adapters, making services database-agnostic.
- **Rationale:** Teams often switch databases or use multiple databases for different use cases. A common interface means business logic doesn't change when the database changes.
- **Alternatives Considered:**
  - *Single database lock-in (PostgreSQL only):* Rejected because it limits adoption for teams using MongoDB.
  - *Separate code paths per database:* Rejected because it duplicates service logic.
- **Trade-off:** The common interface limits database-specific features, but the `raw()` escape hatch allows optimizations when needed.

---

## 8. Built-in Auth (OAuth + JWT, No Adapters)

- **Decision:** Ship authentication as a built-in package with OAuth providers (Google, GitHub, Microsoft) and JWT session management.
- **Rationale:** Authentication is required by virtually every web application. Making it a built-in (rather than requiring passport adapters or third-party services) reduces setup time from hours to minutes.
- **Alternatives Considered:**
  - *Passport.js:* Rejected because it requires adapter configuration per provider and has a complex middleware model.
  - *NextAuth.js / AuthJS:* Rejected because it's framework-specific and not designed for standalone backend frameworks.
  - *Third-party auth (Auth0, Clerk):* Rejected because Kanji aims for zero external dependencies for core features.
- **Trade-off:** Built-in auth means maintaining OAuth providers ourselves, but the developer experience benefit is significant.

---

## 9. Monorepo with pnpm Workspaces

- **Decision:** Organize Kanji as a pnpm workspace monorepo with independent packages.
- **Rationale:** A monorepo enables atomic commits across packages, shared tooling, and simplified release management. pnpm is faster than npm and Yarn, with better disk usage via content-addressable storage.
- **Alternatives Considered:**
  - *Multi-repo:* Rejected because it makes cross-package changes difficult and requires multiple CI pipelines.
  - *npm/Yarn workspaces:* Rejected because pnpm is faster and has stricter dependency isolation.
- **Trade-off:** Monorepos require CI configuration and can grow large, but the development workflow is smoother.

---

## 10. CLI Code Generation (Scaffolding)

- **Decision:** Provide a CLI (`kanji new`, `kanji g resource`) for project and resource scaffolding.
- **Rationale:** Scaffolding reduces boilerplate and enforces conventions. New projects and resources follow the same structure without manual setup.
- **Alternatives Considered:**
  - *Manual setup:* Rejected because it's error-prone and inconsistent across projects.
  - *Interactive prompts only:* CLI supports both flags and prompts for flexibility.
- **Trade-off:** CLI generation creates files that the user must understand, but the templates are minimal and designed to be modified.
