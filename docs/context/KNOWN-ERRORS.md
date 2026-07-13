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

---

## 13. Contract-First: Missing Controller Handlers for Declared Contracts

- **Symptom:** Endpoints declared in a Zod API Contract (e.g. `UserContracts.update`) return `404 Not Found` silently in runtime, without throwing bootstrap warnings or TypeScript compiler errors.
- **Cause:** The framework's Hono router adapter (`@kanjijs/platform-hono`) builds endpoints by reading decorators on the controller methods (`@Get`, `@Post`), and does not cross-validate whether all routes defined in the contract are actually implemented in the controller.
- **Solution/Prevention:**
  - **Option A (Compile-time):** Create a utility type `ControllerOf<TContract>` to force the controller class to implement the corresponding methods.
  - **Option B (Runtime - Recommended):** Implement an automatic validation check at application startup inside `KanjijsAdapter.create()` (in `@kanjijs/platform-hono`). It will scan metadata using `Reflect.getMetadata` to verify alignment between contracts and controller decorators.

### Specification & Pseudocode for Bootstrap Validation

1. **Verify three scenarios**:
   - Method has `@Contract` but no HTTP method decorator (`@Get`, `@Post`, etc.) → **Fatal error** (fail-fast, app does not start).
   - Method has HTTP method decorator but no `@Contract` → **Warning** (logged on console).
   - Both decorators exist → Cross-validate that the `method` and `path` defined in the contract match exactly with the decorator's parameters. Throw an error if a mismatch is found.

2. **Validation Logic**:
   ```typescript
   for (const controller of scannedControllers) {
     for (const methodName of Object.getOwnPropertyNames(controller.prototype)) {
       const contractMeta = Reflect.getMetadata('kanji:contract', controller.prototype, methodName);
       const httpMeta = Reflect.getMetadata('kanji:http:method', controller.prototype, methodName);
       
       // 1. Contract exists, but HTTP method decorator is missing
       if (contractMeta && !httpMeta) {
         throw new Error(
           `[Kanji] ${controller.name}.${methodName} has @Contract but no HTTP method decorator`
         );
       }
       
       // 2. HTTP method exists, but @Contract is missing (warn)
       if (httpMeta && !contractMeta) {
         logger.warn(`${controller.name}.${methodName} has no @Contract`, 'ContractValidator');
       }
       
       // 3. Mismatch checks
       if (contractMeta && httpMeta) {
         if (contractMeta.method !== httpMeta.method || contractMeta.path !== httpMeta.path) {
           throw new Error(
             `[Kanji] Mismatch in ${controller.name}.${methodName}: ` +
             `@Contract says ${contractMeta.method} ${contractMeta.path} ` +
             `but decorator says ${httpMeta.method} ${httpMeta.path}`
           );
         }
       }
     }
   }
   ```

3. **Expected Bootstrap Logging Output**:
   *   **Success case**:
       ```text
       [Kanji] 19:25:01 ✅ [ContractValidator] create: POST / [match]
       [Kanji] 19:25:01 ✅ [ContractValidator] findAll: GET / [match]
       ```
   *   **Mismatch case**:
       ```text
       [Kanji] ❌ [ContractValidator] Error in UsersController.create:
                @Contract says POST / but decorator says @Get /
                
                Fix: change @Get to @Post, or update the contract
       ```

---

## 14. Architecture Compliance: `any` Type Usage in Production Code

- **Severity:** HIGH — Violates core principle §4.2 of ARCHITECTURE.md ("`any` and `unknown` are strictly forbidden").
- **Status:** ✅ FIXED — Most violations resolved. Remaining `any` in test files and CLI template strings are acceptable.

### What Was Fixed

**`@kanjijs/contracts` — `src/validator.ts`**
- Removed `as any` casts on `c.set()` calls. Refactored to use typed helper functions with explicit key constants.
- Changed `catch (err: any)` to `catch (err: unknown)` with proper type narrowing.

**`@kanjijs/platform-hono` — `src/hono-adapter.ts`**
- Replaced `(c as any).set(...)` with `c.set(...)` using the new context augmentation.
- Replaced `import('@kanjijs/auth' as any)` with typed dynamic import via `AuthModuleExport` interface.
- Typed `validationResults` as `ValidationResult[]` instead of `any[]`.

**`@kanjijs/store` — `src/adapters/mongodb.ts`**
- Replaced `globalThis.process as any` with typed assertion: `globalThis.process as { getBuiltinModule?: (name: string) => unknown }`.

**`@kanjijs/auth` — `src/guards.ts`**
- Replaced `const container: any` with typed `import('@kanjijs/core').Container | undefined`.

**`@kanjijs/auth` — `src/policy.ts`**
- Added `AuthUser` interface with proper typing.
- Replaced `any` in `ResourcePolicy` methods with `Record<string, unknown>` for resource and `AuthUser` for user.
- Replaced `AclOptions.policy: any` with `Token<ResourcePolicy>` from `@kanjijs/core`.

**`@kanjijs/openapi` — `src/generator.ts`**
- Added `ContractShape` interface for type-safe Zod schema introspection.
- Replaced `as any` casts with `isContractShape()` type guard.
- Used `ZodTypeAny` import for proper typing.

**`@kanjijs/testing` — `src/testing.module.ts`**
- Replaced `app as unknown as Record<string, ...>` with proper method lookup: `app[method as 'get' | 'post' | ...]`.
- Added typed import for `HttpMetadataStorage`.

**`@kanjijs/platform-hono` — `src/decorators/use.ts`**
- Changed return type from `any` to `MethodDecorator`.

### Remaining (Acceptable)
- `as any` in test files for mocking purposes.
- `any` in CLI template strings (generated code, not runtime).
- `as string` casts on `KANJI_CTX` constants (harmless, could be removed with augmentation).

---

## 15. Architecture Compliance: CLI Package is Monolithic

- **Severity:** MEDIUM — Violates ARCHITECTURE.md §11 (CLI & Developer Experience) file structure.
- **Expected:** Separate command files, templates directory, utils directory:
  ```
  packages/cli/src/
  ├── commands/
  │   ├── new.ts
  │   ├── generate.ts
  │   ├── migrate.ts
  │   ├── openapi.ts
  │   ├── sdk.ts
  │   └── dev.ts
  ├── templates/
  │   ├── controller.hbs
  │   ├── service.hbs
  │   ├── contracts.hbs
  │   ├── module.hbs
  │   └── index.hbs
  ├── utils/
  │   ├── file-generator.ts
  │   ├── inflection.ts
  │   └── validators.ts
  ├── cli.ts
  └── index.ts
  ```
- **Actual:** Everything lives in a single `src/cli.ts` file (1300+ lines). No `templates/` directory, no `utils/` directory, no barrel `index.ts`. Templates are inline JavaScript template strings, not Handlebars (`.hbs`) files.

### Impact
- Hard to maintain, test, and extend.
- Cannot independently test individual commands.
- Template changes require editing a massive file.
- No separation of concerns between CLI framework setup, command logic, and template rendering.

---

## 16. Architecture Compliance: Missing `packages/common` Utility Files

- **Severity:** MEDIUM — ARCHITECTURE.md §6 specifies utility files that don't exist.
- **Status:** ✅ FIXED — All utility files created.

### What Was Fixed

Created the following files:
```
packages/common/src/
├── utils/
│   ├── decorators.ts    ← createParamDecorator, createPropertyDecorator, createMethodDecorator
│   ├── errors.ts        ← KanjiError base class + BadRequestError, UnauthorizedError, ForbiddenError, NotFoundError, ConflictError, ValidationError
│   └── helpers.ts       ← capitalize, toSingular, toPlural, toCamelCase, toKebabCase, fileExists, ensureArray, slugify
├── types.ts
├── env.ts
├── env.d.ts
├── logger.ts
└── index.ts             ← Updated to export all utils
```

---

## 17. Architecture Compliance: Missing `packages/testing` Files

- **Severity:** LOW — Missing test infrastructure described in ARCHITECTURE.md §13.
- **Status:** ✅ FIXED — All files created.

### What Was Fixed

```
packages/testing/src/
├── testing.module.ts    ← EXISTS
├── test-database.ts     ← Created — Mock in-memory database implementing Database interface
├── fixtures.ts          ← Created — FixtureSet, FixtureModule, createFixture for test data factories
└── index.ts             ← Updated to export all modules
```

---

## 18. Architecture Compliance: Missing `tsconfig.build.json`

- **Severity:** LOW — ARCHITECTURE.md §2 references `tsconfig.build.json` in the root directory structure.
- **Status:** ✅ FIXED — Created at project root with proper build configuration.

---

## 19. Architecture Compliance: Incomplete Environment Variable Validation Enforcement

- **Severity:** MEDIUM — ARCHITECTURE.md Tier 4 specifies three-layer enforcement for env variables. Only layer 1 is partially implemented.
- **Status:** ✅ PARTIALLY FIXED — Layer 2 (ESLint) implemented. Layer 3 (CLI) still pending.

### What Was Fixed

**Layer 2: ESLint Rule Added**
```json
"no-restricted-properties": ["error", {
  "object": "process",
  "property": "env",
  "message": "Use env() from @kanjijs/common instead of process.env directly. See ARCHITECTURE.md Tier 4."
}]
```

### Remaining
- Layer 3: `kanji env:check` CLI command still not implemented.

---

## 20. Architecture Compliance: Contract Type Shape Deviation

- **Severity:** LOW — Informational. The actual contract type differs from the ARCHITECTURE example but is a functional improvement.

### ARCHITECTURE Definition (Tier 4)
```typescript
const CreateUserContract = {
  request: {
    body: z.object({...}),
    query: z.object({...}),
  },
  response: {
    201: z.object({...}),
  },
};
```
No `method` or `path` — those live on the `@Get`/`@Post` decorator.

### Actual Implementation (`packages/contracts/src/types.ts`)
```typescript
export interface KanjiContract {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';
  path: string;
  request?: { body?; params?; query?; headers? };
  responses: Record<number, z.ZodTypeAny>;
}
```
Includes `method` and `path` on the contract itself.

### Impact
- The contract is self-describing (can generate OpenAPI without decorators).
- BUT it creates a **dual source of truth**: the contract says `method: 'POST'` and the decorator says `@Post()` — if they disagree, the ContractValidator catches it at bootstrap (this is handled correctly).
- The ARCHITECTURE should be updated to reflect this intentional design.

---

## 21. Architecture Compliance: Global Singleton Metadata Storages

- **Severity:** LOW — Design concern, not a bug. But worth documenting.

### Issue
Both `MetadataStorage` (`@kanjijs/core`) and `HttpMetadataStorage` (`@kanjijs/platform-hono`) are global singletons (private constructor + static `getInstance()`). This means:

1. **Test isolation:** Metadata accumulates across test files in the same process. If test A defines a `@Controller('/users')` and test B defines a different `@Controller('/users')`, they share the same metadata storage.
2. **Multi-app scenarios:** Two `KanjijsAdapter.create()` calls in the same process share metadata, potentially registering the same routes twice.
3. **Hot reload:** During development with `--watch`, metadata may accumulate across reloads.

### Why It Exists
Decorators execute at import time (when the module is loaded), before any container or adapter is created. There is no instance to attach metadata to. The global singleton is the only viable pattern for decorator-based metadata collection.

### Mitigation
- The Container itself is per-app (correct).
- Tests should use `bun test --watch` (separate processes) or carefully reset metadata between suites.
- The testing package could provide a `resetMetadata()` helper for test isolation.

---

## 22. Architecture Compliance: Missing `@kanjijs/common` Hard Dependencies

- **Severity:** LOW — `@kanjijs/common` has no runtime dependencies listed in `package.json`.
- **Status:** ✅ FIXED — Added `zod` as a dependency.

---

## 23. Architecture Compliance: `platform-hono` Missing Tests

- **Severity:** MEDIUM — No test files exist in `packages/platform-hono/`.
- **Status:** ✅ FIXED — Created comprehensive test suite.

### What Was Fixed

Created `packages/platform-hono/src/__tests__/decorators.spec.ts` covering:
- `HttpMetadataStorage` registration (controllers, routes, middlewares)
- `Controller` decorator (default and custom paths)
- Route decorators (`Get`, `Post`, `Put`, `Delete`, `Patch`)
- `KANJI_CTX` constant values
- Hono integration (context get/set, route handling)

---

## 24. Architecture Compliance: `Error Shape` Doesn't Match ARCHITECTURE Spec

- **Severity:** LOW — Minor schema deviation in validation error responses.
- **Status:** ✅ FIXED — Error shape now matches ARCHITECTURE spec.

### What Was Fixed

Updated `packages/contracts/src/errors.ts` to include `message` field and use correct error code:
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "issues": [...]
}
```

---


