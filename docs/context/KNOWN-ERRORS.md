# Known Errors and Gotchas

This document lists known edge cases, performance vulnerabilities, and system-specific quirks in the Kanji Framework.

---

## 1. DI Container: Circular Dependencies

- **Symptom:** App crashes at bootstrap with "circular dependency detected" or hangs indefinitely.
- **Cause:** Module A imports Module B, and Module B imports Module A (directly or transitively).
- **Solution:** Break the cycle by extracting shared providers into a third module:
  ```typescript
  // ❌ Circular: UsersModule ↔ PostsModule
  // ✅ Fixed: Both import SharedModule
  @KanjijsModule({
    imports: [SharedModule],  // Shared types, no circular deps
  })
  export class UsersModule {}
  ```
- **Prevention:** Design modules as a directed acyclic graph (DAG). Use `global: true` modules sparingly for truly cross-cutting concerns (database, config).

---

## 2. Contract Validation Edge Cases

- **Empty request body:** If a `POST` endpoint expects a body but receives none, Zod will fail validation. Make fields optional with `.optional()` or use default values.
  ```typescript
  // Will fail if body is empty or missing
  body: z.object({
    name: z.string(),
  })

  // ✅ Safe: Use .optional() or .default()
  body: z.object({
    name: z.string().optional(),
  }).optional()
  ```

- **Query params vs URL params confusion:** `@Contract()` validates query params and URL params separately. A param defined in `request.query` but passed in the URL path will not be found:
  ```typescript
  // URL: GET /users/123?active=true
  // ✅ query: z.object({ active: z.boolean() })
  // ✅ params: z.object({ id: z.string() })
  ```

- **Date serialization:** Zod's `z.date()` expects a JavaScript `Date` object or ISO string. If the client sends a timestamp number, validation will fail:
  ```typescript
  // ✅ Use z.coerce.date() for flexible date input
  createdAfter: z.coerce.date().optional(),
  ```

---

## 3. Database: N+1 Query Problem

- **Symptom:** API endpoint is slow despite small dataset. Hundreds of database queries for a single request.
- **Cause:** Loading related entities in a loop:
  ```typescript
  // ❌ N+1: One query for users, then N queries for each user's posts
  const users = await this.db.select().from(users);
  for (const user of users) {
    user.posts = await this.db.select()
      .from(posts)
      .where(eq(posts.userId, user.id));
  }
  ```
- **Solution:** Use joins or batch loading:
  ```typescript
  // ✅ Single query with join
  const result = await this.db.select()
    .from(users)
    .leftJoin(posts, eq(posts.userId, users.id));
  ```
- **Detection:** Enable query logging and count queries per request.

---

## 4. Database: Migration Ordering Issues

- **Symptom:** `kanji migrate` fails with "relation already exists" or "column does not exist".
- **Cause:** Migrations are applied out of order, or a migration references a table/column that hasn't been created yet.
- **Solution:** Ensure migrations have sequential timestamps and never reference objects created in later migrations. Renaming a column? Create a new migration, don't edit an existing one.
- **Prevention:** Never modify existing migrations after they've been committed. Create new migrations for schema changes.

---

## 5. Auth: JWT Secret Mismatch

- **Symptom:** Tokens created in development fail in production (401 errors).
- **Cause:** Different `JWT_SECRET` between environments. Kanji falls back to `'dev-secret'` when not set, which is not suitable for production.
- **Solution:** Always set `JWT_SECRET` as an environment variable in production:
  ```bash
  # Generate a strong secret
  openssl rand -base64 32
  # Set in .env or environment
  JWT_SECRET=your-generated-secret
  ```
- **Prevention:** The app should warn at startup if `JWT_SECRET` is the default value in production.

---

## 6. CLI Code Generation: File Conflicts

- **Symptom:** `kanji g resource users` fails because `users.controller.ts` already exists.
- **Cause:** Running `generate` for a resource that already exists.
- **Solution:** Use `--force` flag to overwrite, or `--dry-run` to preview:
  ```bash
  kanji g resource users --dry-run   # Preview only
  kanji g resource users --force     # Overwrite existing
  ```
- **Prevention:** Always run with `--dry-run` first to verify what will be generated.

---

## 7. OpenAPI / SDK Generation: Outdated Spec

- **Symptom:** Frontend SDK types don't match the API.
- **Cause:** Contracts were updated but `openapi.json` was not regenerated.
- **Solution:** Always regenerate after contract changes:
  ```bash
  kanji openapi:generate && kanji sdk:generate --output ../frontend/src/api.ts
  ```
- **Prevention:** Add a CI check that fails if `openapi.json` is out of date:
  ```bash
  kanji openapi:generate --check
  ```

---

## 8. Multi-DB: Feature Parity Gaps

- **Symptom:** Code works with PostgreSQL but fails with MongoDB.
- **Cause:** A database-specific feature (e.g., `RETURNING`, `JOIN`, transactions) behaves differently or doesn't exist in MongoDB.
- **Check:**
  ```typescript
  // PostgreSQL-specific: RETURNING clause
  const [user] = await db.insert(users).values(data).returning();
  // MongoDB doesn't support RETURNING — must re-fetch
  ```
- **Solution:** Keep queries simple and avoid database-specific features in shared code. Use the `Database` interface's common methods. If needed, add an adapter-specific method and check adapter type.

---

## 9. Hono Context Key Namespacing

- **Symptom:** `c.get('kanji.validated.body')` returns `undefined` even after validation.
- **Cause:** The context key name has a typo or the middleware wasn't applied in the correct order.
- **Check:**
  ```typescript
  // ✅ Correct key names
  c.get('kanji.validated.body')
  c.get('kanji.validated.query')
  c.get('kanji.validated.params')
  c.get('kanji.auth.user')
  c.get('kanji.auth.roles')
  c.get('kanji.auth.principal')

  // ❌ Wrong — typo or wrong namespace
  c.get('kanji.validation.body')
  c.get('auth.user')
  ```
- **Prevention:** Define constants for context keys to avoid typos:
  ```typescript
  export const KANJI_CTX = {
    VALIDATED_BODY: 'kanji.validated.body',
    VALIDATED_QUERY: 'kanji.validated.query',
    AUTH_USER: 'kanji.auth.user',
    AUTH_ROLES: 'kanji.auth.roles',
  } as const;
  ```

---

## 10. Path Normalization in Different OS

- **Symptom:** Module resolution or file generation fails on Windows.
- **Cause:** Hardcoded `/` path separators or Unix assumptions.
- **Solution:** Use `path.join()` and `path.resolve()` from Bun's Node.js compat layer:
  ```typescript
  import { join, resolve } from 'path';
  const templatePath = join(__dirname, '..', 'templates', 'controller.hbs');
  ```
- **Prevention:** Test CLI commands on Windows before release. Use `path.sep` for cross-platform separator handling.

---

## 11. DI Container: Controller Visibility

- **Symptom:** App fails to bootstrap at startup throwing `Dependency injection error: Token "class UserController" is not visible in module "UserModule"`.
- **Cause:** Controller classes registered inside modules under the `controllers` metadata array were not implicitly treated as local providers during the module scanning phase, preventing the dependency injection container from resolving them inside the HTTP Hono adapter.
- **Solution:** In `packages/core/src/container.ts`, scan `metadata.controllers` and register each controller class directly as a provider in the module's `providerRegistry` and `localProviders`.

---

## 12. DI Container: Dynamic Global Modules Visibility

- **Symptom:** Injectable tokens registered inside a `DynamicModule` with `global: true` (e.g. `StoreModule.forRoot()`) throw a `Provider for token "Symbol(DATABASE_CLIENT)" not found in visible modules` error when resolved inside non-root modules.
- **Cause:**
  - Providers registered via dynamic modules are associated with the importing module (typically `AppModule`). Since `AppModule` is not global, those providers were never flagged as global.
  - The module scanning logic did not check `imported.global` flag on `DynamicModule` configurations, failing to register dynamic providers into `globalProviders`.
- **Solution:** 
  - Update `Container.scanModule` to verify if `imported.global` is set on dynamic imports, adding their tokens to `this.globalProviders`.
  - Update `Container.findProviderModule` to look up the source module in the registry for any token flagged as global in `globalProviders`.

