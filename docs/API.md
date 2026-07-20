# Kanji API Reference Manual

This document provides a concise reference API for each of the core packages of the Kanji Framework.

---

## 1. `@kanjijs/core`

Core package containing the Dependency Injection container and module lifecycle mappings.

* `@Module({ imports, providers, exports })`: Class decorator defining modular boundaries and dependency registrations.
* `@Injectable()`: Marks a class as available for injection and resolution in the DI container.
* `@Inject(token)`: Parameter decorator to inject custom Symbols, configurations, or non-class dependencies.

---

## 2. `@kanjijs/platform-hono`

Adapts the Hono HTTP routing server into the Kanji DI framework.

* `KanjijsAdapter.create(AppModule, options)`: Bootstraps the application, resolved gateways, controllers, and middlewares.
* `@Controller(prefix)`: Registers a class containing HTTP endpoint route handlers.
* Route Decorators: `@Get(path)`, `@Post(path)`, `@Put(path)`, `@Patch(path)`, `@Delete(path)`.
* `@Use(...middlewares)`: Controller or method-level decorator to apply Hono middleware functions.
* `@RateLimit(options)`: Limit requests by IP or user IDs over a specific time window.
* Context Helpers:
  - `getValidatedBody<T>(c)`: Retrieves validated payload body.
  - `getValidatedQuery<T>(c)`: Retrieves validated search query object.
  - `getAuthUser(c)`: Retrieves the authenticated user session details.

---

## 3. `@kanjijs/contracts`

Provides Contract-first API validation schemas via Zod.

* `@ContractOf(contractMap)`: Associates a controller class with a set of Zod route contracts.
* `@Contract(zodSchema)`: Validates incoming request (body, query, params, headers) and response types.

---

## 4. `@kanjijs/auth`

Authentication, Authorization, Role-Based Access Control, and OAuth2.

* `AuthModule.forRoot(config)`: Dynamically registers authentication credentials and providers.
* `AuthGuard`: Middleware validating Bearer JWT tokens in request headers.
* `clp(rules)`: Class-Level Permissions guard validating roles for standard actions.
* `acl(options)`: Access Control List guard enforcing dynamic policy classes.

---

## 5. `@kanjijs/store`

Database abstraction tier supporting multi-database setups.

* `StoreModule.forRoot(config)`: Registers database connection settings and ORM drivers.
* `DATABASE_CLIENT`: Token to inject the active Database client interface.

---

## 6. `@kanjijs/openapi`

Autogenerates OpenAPI 3.0 specs and client SDKs.

* `@BearerAuth()`: Documents that an endpoint requires authorization headers.
* `@OperationId(name)`: Explicit name for generated SDK client methods.
* `@Example(data)`: Attaches JSON payload examples to endpoint requests or responses.
* `@Summary(text)` / `@Description(text)`: Endpoint documentation.
