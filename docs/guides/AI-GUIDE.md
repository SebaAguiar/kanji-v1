# Kanji Framework — AI-Assisted Development Guide

> Complete reference for building backend applications with Kanji Framework.
> Use this guide with any AI coding assistant (opencode, Cursor, Copilot, Windsurf, etc.) to get correct Kanji code every time.

**Stack:** Bun + Hono + TypeScript (strict) + Zod contracts + Drizzle ORM / MongoDB + OAuth/JWT + OpenAPI SDK generation

---

## Table of Contents

1. [The Mental Model](#1-the-mental-model)
2. [Hard Constraints](#2-hard-constraints)
3. [Project Structure](#3-project-structure)
4. [How to Create a New Resource](#4-how-to-create-a-new-resource)
5. [Auth Patterns](#5-auth-patterns)
6. [Dynamic Modules](#6-dynamic-modules)
7. [DI Token Patterns](#7-di-token-patterns)
8. [Context Keys Reference](#8-context-keys-reference)
9. [Error Handling](#9-error-handling)
10. [Database Patterns (PostgreSQL + MongoDB)](#10-database-patterns)
11. [Environment Variables](#11-environment-variables)
12. [CLI Commands](#12-cli-commands)
13. [Common Gotchas](#13-common-gotchas)
14. [Testing](#14-testing)
15. [OpenAPI + SDK Generation](#15-openapi--sdk-generation)
16. [Troubleshooting](#16-troubleshooting)

---

## 1. The Mental Model

Kanji has a strict layered architecture. Every request flows through this pipeline:

```
Request
  → Global Middleware (requestId, cors, logger)
  → Auth Middleware (resolve principal from JWT)
  → CLP — Class-Level Permissions ("can user access this resource?")
  → Contract Validation (Zod schemas for body/params/query)
  → ACL — Object-Level Permissions ("can user access THIS object?")
  → Handler → Service → Business Logic
  → Response Serialization
  → Exception Filter (if error)
```

**Key insight:** Validation, auth, and permissions are NOT your responsibility in the handler. They're handled by middleware/decorators. Your handler only does business logic.

---

## 2. Hard Constraints

Violating these breaks the framework. Never do:

1. **No `any` or `unknown` in TypeScript.** Ever. Every type must be explicit.
2. **No `process.env` directly.** Use `env()` from `@kanjijs/common`.
3. **No business logic in controllers.** Controllers are thin: parse input → call service → return response.
4. **No manual validation in handlers.** Use `@Contract()` — middleware validates automatically.
5. **No auto-registration.** Every provider must be declared in a module's `providers` array.
6. **No global state.** One DI container per app. No static singletons for DI.
7. **No raw SQL in business logic.** Use Drizzle query builder.
8. **No Express/Fastify.** Hono only.

---

## 3. Project Structure

```
src/
├── modules/
│   ├── users/
│   │   ├── users.module.ts          # Module definition
│   │   ├── users.controller.ts      # HTTP handlers (thin)
│   │   ├── users.service.ts         # Business logic
│   │   ├── users.contracts.ts       # Zod schemas for all endpoints
│   │   └── index.ts                 # Barrel export
│   ├── posts/
│   └── auth/
├── database/
│   ├── database.module.ts           # StoreModule.forRoot({...})
│   ├── schema.ts                    # Drizzle table definitions (PostgreSQL)
│   └── types.ts                     # TypeScript interfaces (MongoDB)
├── app.module.ts                    # Root module (imports all feature modules)
└── main.ts                          # Entry point
```

**Rule:** Every feature = one folder under `modules/` with these 4 files minimum.

---

## 4. How to Create a New Resource

### Step 1 — Contracts First (Zod)

Always define contracts before anything else. They're the source of truth.

```typescript
// modules/users/users.contracts.ts
import { z } from 'zod';

// Every contract defines: method, path, request shape, response shape(s)
export const CreateUserContract = {
  method: 'POST' as const,
  path: '/users',
  request: {
    body: z.object({
      name: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(8),
    }),
  },
  responses: {
    201: z.object({
      id: z.string().uuid(),
      name: z.string(),
      email: z.string(),
      createdAt: z.string().datetime(),
    }),
    400: z.object({
      error: z.string(),
      issues: z.array(z.object({
        path: z.string(),
        code: z.string(),
        message: z.string(),
      })),
    }),
    409: z.object({
      error: z.string(),
      message: z.string(),
    }),
  },
};

export const GetUserContract = {
  method: 'GET' as const,
  path: '/users/:id',
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  responses: {
    200: z.object({
      id: z.string().uuid(),
      name: z.string(),
      email: z.string(),
    }),
    404: z.object({ error: z.string(), message: z.string() }),
  },
};

export const ListUsersContract = {
  method: 'GET' as const,
  path: '/users',
  request: {
    query: z.object({
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    }),
  },
  responses: {
    200: z.object({
      data: z.array(z.object({ id: z.string(), name: z.string(), email: z.string() })),
      total: z.number(),
      page: z.number(),
    }),
  },
};
```

**Why contracts first?** Because from these schemas, Kanji generates: runtime validation, TypeScript types, OpenAPI spec, and frontend SDK. One definition, four outputs.

### Step 2 — Database Schema

#### PostgreSQL (Drizzle ORM)

```typescript
// database/schema.ts
import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 256 }).notNull(),
  email: varchar('email', { length: 256 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 256 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Infer types from schema — no manual interfaces
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
```

#### MongoDB (TypeScript Interfaces)

MongoDB doesn't require schema definitions. Collections are inferred from `db.query.collectionName`.

```typescript
// database/types.ts
export interface UserDocument {
  id: string;         // maps to _id automatically
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Step 3 — Service

Services use the `Database` interface from `@kanjijs/store`. This interface is **database-agnostic** — the same service code works with both PostgreSQL and MongoDB.

#### Database-Agnostic Service (recommended)

```typescript
// modules/users/users.service.ts
import { Injectable, Inject } from '@kanjijs/core';
import { DATABASE_CLIENT, Database } from '@kanjijs/store';

@Injectable()
export class UsersService {
  constructor(@Inject(DATABASE_CLIENT) private db: Database) {}

  async create(data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const results = await this.db.query.users.insert(data as Record<string, string | number | boolean | null | Date>);
    return results[0];
  }

  async findById(id: string): Promise<Record<string, unknown> | null> {
    return this.db.query.users.findById(id);
  }

  async findByEmail(email: string): Promise<Record<string, unknown> | null> {
    return this.db.query.users.findBy({ email });
  }

  async findAll(page: number, limit: number) {
    const offset = (page - 1) * limit;
    const data = await this.db.query.users
      .select()
      .limit(limit)
      .offset(offset)
      .orderBy('createdAt', 'desc');
    return { data, page };
  }

  async update(id: string, data: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    const results = await this.db.query.users
      .where({ id })
      .update(data as Record<string, string | number | boolean | null | Date>);
    return results[0] || null;
  }

  async delete(id: string): Promise<boolean> {
    const results = await this.db.query.users.where({ id }).delete();
    return results.length > 0;
  }
}
```

#### Common QueryBuilder API (same for Postgres and MongoDB)

```typescript
// SELECT
const users = await this.db.query.users.select();
const user = await this.db.query.users.findById('abc-123');
const user = await this.db.query.users.findBy({ email: 'alice@example.com' });

// SELECT with filters
const users = await this.db.query.users
  .select()
  .where({ active: true })
  .limit(10)
  .offset(0)
  .orderBy('createdAt', 'desc');

// SELECT specific fields
const names = await this.db.query.users.select(['name', 'email']);

// INSERT (single)
const [created] = await this.db.query.users.insert({
  name: 'Alice',
  email: 'alice@example.com',
});

// INSERT (bulk)
const created = await this.db.query.users.insert([
  { name: 'Alice', email: 'alice@example.com' },
  { name: 'Bob', email: 'bob@example.com' },
]);

// UPDATE
const [updated] = await this.db.query.users
  .where({ id: userId })
  .update({ name: 'Bob' });

// DELETE
const deleted = await this.db.query.users.where({ id: userId }).delete();

// TRANSACTION
const result = await this.db.transaction(async (trx) => {
  const [user] = await trx.query.users.insert({ name: 'Alice' });
  const [post] = await trx.query.posts.insert({ userId: user.id, title: 'Hello' });
  return { user, post };
});
```

> **Note:** The `where()` method accepts plain objects: `{ field: value }`. This is intentionally simpler than Drizzle's `eq()`/`and()` — it works identically on both Postgres and MongoDB. For complex queries (OR, LIKE, nested), use the `raw()` method with database-specific syntax.

#### PostgreSQL-Only Service (Drizzle direct)

When you need Drizzle-specific features (complex joins, aggregations, `RETURNING`):

```typescript
import { Injectable, Inject } from '@kanjijs/core';
import { DATABASE_CLIENT } from '@kanjijs/store';
import { eq, and, count, desc } from 'drizzle-orm';
import { users, posts } from '../../database/schema';

@Injectable()
export class UsersServicePostgres {
  constructor(@Inject(DATABASE_CLIENT) private db: PostgresJsDatabase<Record<string, never>>) {}

  async findById(id: string) {
    return this.db.select().from(users).where(eq(users.id, id)).limit(1).then(r => r[0] || null);
  }

  async findWithPosts(userId: string) {
    return this.db.select()
      .from(users)
      .leftJoin(posts, eq(posts.userId, users.id))
      .where(eq(users.id, userId));
  }

  async countByRole() {
    return this.db.select({ role: users.role, count: count() })
      .from(users)
      .groupBy(users.role);
  }
}
```

> **Warning:** Postgres-only services will NOT work if you switch to MongoDB. Prefer the database-agnostic QueryBuilder API for services that may need to support both databases.

#### MongoDB-Specific Behavior

The MongoDB adapter handles these automatically:
- **`id` ↔ `_id` mapping:** Use `id` in your code; the adapter converts to/from `_id` transparently.
- **ObjectId conversion:** 24-character hex strings in `where()` conditions are auto-converted to `ObjectId`.
- **Lazy connection:** MongoDB connects on first query, not at startup.
- **No `RETURNING`:** MongoDB insert/update/delete don't return affected rows natively. The adapter re-fetches documents after mutation to simulate `returning()` behavior.

**Key rules for services:**
- Inject `DATABASE_CLIENT` via `@Inject()`.
- Never use `process.env` — inject config via DI tokens.
- Never return raw strings as errors — use error classes from `@kanjijs/common`.
- Prefer the database-agnostic QueryBuilder API for maximum portability.
- Only use Drizzle-specific features when you're certain the app will never switch databases.

### Step 4 — Controller (Thin!)

```typescript
// modules/users/users.controller.ts
import { Controller, Get, Post, Contract, UseGuards } from '@kanjijs/platform-hono';
import { Context } from 'hono';
import { AuthGuard } from '@kanjijs/auth';
import { UsersService } from './users.service';
import { CreateUserContract, GetUserContract, ListUsersContract } from './users.contracts';

@Controller('/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('/')
  @Contract(CreateUserContract)
  async create(c: Context) {
    // Data is already validated by middleware — guaranteed typed
    const body = c.get('kanji.validated.body');
    const user = await this.usersService.create(body);
    return c.json(user, 201);
  }

  @Get('/:id')
  @Contract(GetUserContract)
  @UseGuards(AuthGuard)  // Protected route
  async findById(c: Context) {
    const { id } = c.get('kanji.validated.params');
    const user = await this.usersService.findById(id);
    if (!user) return c.json({ error: 'NOT_FOUND', message: 'User not found' }, 404);
    return c.json(user);
  }

  @Get('/')
  @Contract(ListUsersContract)
  async findAll(c: Context) {
    const { page, limit } = c.get('kanji.validated.query');
    const result = await this.usersService.findAll(page, limit);
    return c.json(result);
  }
}
```

**Controller rules:**
- Constructor-inject services only.
- Access validated data via `c.get('kanji.validated.*')`.
- Return `c.json(data, statusCode)`.
- Never write validation logic here — `@Contract()` handles it.
- Apply `@UseGuards(AuthGuard)` on protected routes.

### Step 5 — Module

```typescript
// modules/users/users.module.ts
import { KanjijsModule } from '@kanjijs/core';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@KanjijsModule({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],  // Export if other modules need this service
})
export class UsersModule {}
```

### Step 6 — Register in AppModule

```typescript
// app.module.ts
import { KanjijsModule } from '@kanjijs/core';
import { StoreModule } from '@kanjijs/store';
import { AuthModule } from '@kanjijs/auth';
import { UsersModule } from './modules/users/users.module';

@KanjijsModule({
  imports: [
    // PostgreSQL (requires Drizzle schema objects)
    StoreModule.forRoot({
      type: 'postgres',
      connectionString: env('DATABASE_URL', z.string().url()),
      schema: { users, posts },  // ← Drizzle table objects from schema.ts
    }),

    // — OR —

    // MongoDB (no schema needed, collection names are inferred from query)
    // StoreModule.forRoot({
    //   type: 'mongodb',
    //   connectionString: env('MONGODB_URI', z.string().url()),
    //   dbName: env('MONGODB_DB', z.string()),
    // }),

    AuthModule.forRoot({
      jwtSecret: env('JWT_SECRET', z.string().min(32)),
      providers: {
        google: {
          clientId: env('GOOGLE_CLIENT_ID', z.string()),
          clientSecret: env('GOOGLE_CLIENT_SECRET', z.string()),
        },
      },
    }),
    UsersModule,
  ],
})
export class AppModule {}
```

**Postgres config:** requires `schema` — an object mapping table names to Drizzle table definitions (e.g. `{ users, posts }`). This is needed because the Postgres adapter resolves `db.query.users` to the actual Drizzle table at runtime.

**MongoDB config:** requires `dbName` — the database name. Collection names are inferred from `db.query.collectionName` (e.g. `db.query.users` → `users` collection). No schema objects needed.

### Step 7 — Entry Point

```typescript
// main.ts
import { KanjijsAdapter } from '@kanjijs/platform-hono';
import { ZodValidator } from '@kanjijs/contracts';
import { assertEnvValid } from '@kanjijs/common';
import { AppModule } from './app.module';

// Validate all env() calls succeeded
assertEnvValid();

const { app } = await KanjijsAdapter.create(AppModule, {
  validator: new ZodValidator(),
});

export default {
  port: 3000,
  fetch: app.fetch,
};
```

---

## 5. Auth Patterns

### Protecting a Route
```typescript
import { UseGuards, AuthGuard } from '@kanjijs/auth';

@Get('/profile')
@UseGuards(AuthGuard)
async getProfile(c: Context) {
  const user = c.get('kanji.auth.user');  // { id, email, name }
  const roles = c.get('kanji.auth.roles'); // string[]
  // ...
}
```

### RBAC (Role-Based Access Control)
```typescript
import { UseGuards, RolesGuard } from '@kanjijs/auth';

@Delete('/users/:id')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin')
async deleteUser(c: Context) { ... }
```

### ACL (Object-Level Permissions)
```typescript
import { UseGuards, AclGuard } from '@kanjijs/auth';

@Put('/posts/:id')
@UseGuards(AuthGuard, AclGuard)
@Acl({ action: 'update', resource: PostPolicy })
async updatePost(c: Context) { ... }
```

---

## 6. Dynamic Modules

When a module needs configuration at import time:

```typescript
@KanjijsModule({})
export class MailModule {
  static forRoot(config: MailConfig): DynamicModule {
    return {
      module: MailModule,
      providers: [
        { provide: MAIL_CONFIG, useValue: config },
        {
          provide: MAIL_SERVICE,
          useFactory: (cfg: MailConfig) => new MailService(cfg),
          inject: [MAIL_CONFIG],
        },
      ],
      exports: [MAIL_SERVICE],
      global: false,  // Only global if truly cross-cutting
    };
  }
}
```

**Usage:**
```typescript
imports: [
  MailModule.forRoot({
    host: env('SMTP_HOST', z.string()),
    port: env('SMTP_PORT', z.coerce.number()),
  }),
]
```

---

## 7. DI Token Patterns

### Symbol Tokens (preferred for services/clients)
```typescript
const DATABASE_CLIENT = Symbol('DATABASE_CLIENT');
const MAIL_SERVICE = Symbol('MAIL_SERVICE');
const CACHE_SERVICE = Symbol('CACHE_SERVICE');
```

### Class Tokens (when the class IS the token)
```typescript
providers: [
  { provide: UsersService, useClass: UsersService },
]
```

### Value Providers (config, constants)
```typescript
providers: [
  { provide: APP_CONFIG, useValue: { port: 3000, env: 'production' } },
]
```

### Factory Providers (async init, e.g. DB connections)
```typescript
providers: [
  {
    provide: DATABASE_CLIENT,
    useFactory: async () => {
      const client = postgres(process.env.DATABASE_URL!);
      return drizzle(client);
    },
  },
]
```

---

## 8. Context Keys Reference

Always use these exact keys:

```typescript
// Authentication (set by AuthMiddleware)
c.get('kanji.auth.user')       // { id: string, email: string, name: string }
c.get('kanji.auth.session')    // Full KanjiSession object
c.get('kanji.auth.roles')      // string[]
c.get('kanji.auth.scopes')     // string[]
c.get('kanji.auth.principal')  // Normalized identity

// Authorization
c.get('kanji.authz.cache')     // Map<string, Decision> per request
c.get('kanji.authz.decision')  // Last decision (debugging)

// Validated input (set by Contract middleware)
c.get('kanji.validated.body')    // Typed request body
c.get('kanji.validated.query')   // Typed query params
c.get('kanji.validated.params')  // Typed URL params
c.get('kanji.validated.headers') // Typed headers
c.get('kanji.validated.cookies') // Typed cookies

// Metadata
c.get('kanji.requestId')  // Unique request UUID
```

**Common mistake:** `c.get('kanji.validation.body')` is WRONG (no `d`).
Correct: `c.get('kanji.validated.body')`.

---

## 9. Error Handling

### Error Classes from `@kanjijs/common`
```typescript
import {
  KanjiError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
} from '@kanjijs/common';
```

### In Services
```typescript
async createUser(data: CreateUserInput): Promise<User> {
  const existing = await this.findByEmail(data.email);
  if (existing) {
    throw new ConflictError('Email already registered');
  }
  return this.db.query.users.insert(data);
}
```

### Standard Error Response Shape
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "issues": [
    { "path": "body.email", "code": "invalid_type", "message": "Expected string, received number" }
  ]
}
```

---

## 10. Database Patterns

Kanji supports two database adapters via `@kanjijs/store`. Both implement the same `Database` and `QueryBuilder` interfaces, so services written with the common API work on either database.

### PostgreSQL Setup

```typescript
// database/schema.ts — Drizzle table definitions
import { pgTable, uuid, varchar, text, timestamp, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 256 }).notNull(),
  email: varchar('email', { length: 256 }).notNull().unique(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const posts = pgTable('posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 512 }).notNull(),
  content: text('content'),
  published: boolean('published').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Infer types from Drizzle schema
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
```

### MongoDB Setup

MongoDB doesn't require schema definitions. Collections are inferred from `db.query.collectionName`. You define your data shape in TypeScript interfaces instead:

```typescript
// database/types.ts — MongoDB document shapes
export interface UserDocument {
  id: string;         // maps to _id automatically
  name: string;
  email: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PostDocument {
  id: string;
  userId: string;
  title: string;
  content?: string;
  published: boolean;
  createdAt: Date;
}
```

### Querying (Common API — works on both databases)

```typescript
// SELECT
const users = await this.db.query.users.select();
const user = await this.db.query.users.findById('abc-123');
const user = await this.db.query.users.findBy({ email: 'alice@example.com' });

// SELECT with filters
const users = await this.db.query.users
  .select()
  .where({ active: true })
  .limit(10)
  .offset(0)
  .orderBy('createdAt', 'desc');

// SELECT specific fields
const names = await this.db.query.users.select(['name', 'email']);

// INSERT (single)
const [created] = await this.db.query.users.insert({
  name: 'Alice',
  email: 'alice@example.com',
});

// INSERT (bulk)
const created = await this.db.query.users.insert([
  { name: 'Alice', email: 'alice@example.com' },
  { name: 'Bob', email: 'bob@example.com' },
]);

// UPDATE
const [updated] = await this.db.query.users
  .where({ id: userId })
  .update({ name: 'Bob' });

// DELETE
const deleted = await this.db.query.users.where({ id: userId }).delete();

// TRANSACTION
const result = await this.db.transaction(async (trx) => {
  const [user] = await trx.query.users.insert({ name: 'Alice' });
  const [post] = await trx.query.posts.insert({ userId: user.id, title: 'Hello' });
  return { user, post };
});
```

### PostgreSQL-Only Queries (Drizzle)

When you need complex joins, aggregations, or database-specific features:

```typescript
import { eq, and, count, desc, like } from 'drizzle-orm';
import { users, posts } from '../../database/schema';

// Join
const results = await this.db.select()
  .from(users)
  .leftJoin(posts, eq(posts.userId, users.id))
  .where(eq(users.id, userId));

// Aggregation
const stats = await this.db.select({
  role: users.role,
  count: count(),
}).from(users).groupBy(users.role);

// Complex filter
const results = await this.db.select().from(users)
  .where(and(
    eq(users.active, true),
    like(users.name, `%${search}%`),
  ))
  .orderBy(desc(users.createdAt));
```

> **Warning:** Drizzle-specific queries will NOT work with MongoDB. Use the common QueryBuilder API for database-agnostic code.

### MongoDB-Specific Behavior

The MongoDB adapter handles these transparently:
- **`id` ↔ `_id` mapping:** Always use `id` in your code. The adapter converts to/from MongoDB's `_id` automatically.
- **ObjectId conversion:** 24-character hex strings passed in `where()` are auto-converted to `ObjectId`.
- **Lazy connection:** MongoDB connects on first query, not at module import time.
- **No `RETURNING`:** MongoDB insert/update/delete don't return affected rows the same way. The adapter re-fetches documents after mutation to simulate `returning()` behavior.

### Avoiding N+1

```typescript
// ❌ BAD: N+1 queries
const users = await this.db.query.users.select();
for (const user of users) {
  // This creates N additional queries
  user.posts = await this.db.query.posts.where({ userId: user.id }).select();
}

// ✅ GOOD (Postgres): Single query with join
const results = await this.db.select()
  .from(users)
  .leftJoin(posts, eq(posts.userId, users.id));

// ✅ GOOD (MongoDB or Database-agnostic): Batch fetch
const userIds = users.map(u => u.id);
const allPosts = await this.db.query.posts
  .select()
  .where({ userId: userIds[0] }); // Use raw() for $in queries on MongoDB
// Or fetch per-user in parallel:
const postsByUser = await Promise.all(
  users.map(u => this.db.query.posts.where({ userId: u.id }).select())
);
```

### Switching Between Databases

The only change is in `app.module.ts` — swap `StoreModule.forRoot()` config:

```typescript
// PostgreSQL
StoreModule.forRoot({
  type: 'postgres',
  connectionString: env('DATABASE_URL', z.string().url()),
  schema: { users, posts },
})

// MongoDB (same service code works)
StoreModule.forRoot({
  type: 'mongodb',
  connectionString: env('MONGODB_URI', z.string().url()),
  dbName: env('MONGODB_DB', z.string()),
})
```

Service code using the common QueryBuilder API requires zero changes.

---

## 11. Environment Variables

```typescript
import { env, assertEnvValid } from '@kanjijs/common';
import { z } from 'zod';

// Declare at usage site — colocated, not centralized
const dbUrl = env('DATABASE_URL', z.string().url());
const jwtSecret = env('JWT_SECRET', z.string().min(32));
const port = env('PORT', z.coerce.number().default(3000));

// In main.ts — validate all at once
assertEnvValid();
```

**Never:**
```typescript
// ❌ Direct access
const url = process.env.DATABASE_URL;

// ❌ Centralized env.ts file (creates two sources of truth)
```

---

## 12. CLI Commands

```bash
kanji new my-app                    # Scaffold new project
kanji g resource users              # Generate users CRUD (controller + service + contracts + module)
kanji g resource posts --dry-run    # Preview what would be generated
kanji migrate                       # Run pending Drizzle migrations
kanji migrate:rollback              # Rollback last migration
kanji seed:run                      # Run seed file
kanji db:studio                     # Open Drizzle Studio (visual DB browser)
kanji openapi:generate              # Generate openapi.json from all contracts
kanji sdk:generate --spec ./openapi.json --output ../frontend/src/api.ts
kanji openapi:serve --port 3001     # Serve Swagger UI
kanji dev                           # Dev server with hot reload
```

---

## 13. Common Gotchas

| Gotcha | Symptom | Fix |
|---|---|---|
| Missing `@Contract` on route | Endpoint returns 404 silently | Add `@Contract()` to every route handler |
| Wrong context key | `c.get('kanji.validated.body')` returns undefined | Check spelling: `validated` not `validation` |
| N+1 queries | Endpoint slow despite small data | Use `leftJoin()` (Postgres) or batch fetch (both) |
| JWT_SECRET default | Tokens work in dev, fail in prod | Always set `JWT_SECRET` env var |
| Empty body validation | POST fails with no body | Use `.optional()` on fields or body |
| Date input | `z.date()` rejects timestamps | Use `z.coerce.date()` for flexible input |
| Migration ordering | "relation already exists" error | Never edit committed migrations, create new ones |
| OpenAPI stale | Frontend SDK types wrong | Re-run `kanji openapi:generate && kanji sdk:generate` |
| Circular deps | Bootstrap crash | Extract shared providers into third module |
| `process.env` direct | ESLint error + type error | Use `env()` from `@kanjijs/common` |
| Postgres schema missing | `Table 'x' not found in Drizzle schema` | Pass `schema` object to `StoreModule.forRoot()` |
| MongoDB `_id` confusion | Query returns data with `_id` instead of `id` | Use `id` in your code — adapter maps `_id`↔`id` automatically |
| Drizzle-only code with Mongo | `eq is not a function` or similar | Use common QueryBuilder API, not Drizzle imports |
| MongoDB insert no RETURNING | `insert()` returns empty array | Adapter re-fetches after insert — ensure collection exists |

---

## 14. Testing

```typescript
import { createTestingModule } from '@kanjijs/testing';
import { UsersModule } from './modules/users/users.module';
import { UsersService } from './modules/users/users.service';

describe('UsersService', () => {
  const testingModule = createTestingModule({
    imports: [UsersModule],
  });

  it('should create a user', async () => {
    const service = testingModule.get(UsersService);
    const user = await service.create({ name: 'Alice', email: 'alice@example.com' });
    expect(user.id).toBeDefined();
    expect(user.name).toBe('Alice');
  });
});
```

```bash
bun test                              # All tests
bun test --filter users               # Specific
bun test --coverage                   # With coverage
```

---

## 15. OpenAPI + SDK Generation

```
Your Zod contracts (source of truth)
  → @Contract() decorators (metadata)
  → kanji openapi:generate (scan all contracts)
  → openapi.json (industry standard)
  → kanji sdk:generate (consume spec)
  → TypeScript SDK (fully typed client for frontend)
```

**After every contract change, regenerate both:**
```bash
kanji openapi:generate && kanji sdk:generate --output ../frontend/src/api.ts
```

Add CI check:
```bash
kanji openapi:generate --check  # Fails if spec is outdated
```

---

## 16. Troubleshooting

1. **Bootstrap error about invisible token?** → Provider not declared in module or not exported by imported module.
2. **Validation not running?** → Check `@Contract()` decorator is on the method.
3. **Auth not working?** → Check `@UseGuards(AuthGuard)` is applied AND auth middleware is in the global pipeline.
4. **Type errors with `any`?** → Search for `any` in your code. It's forbidden.
5. **DB queries failing?** → Check Drizzle schema matches your migration. Run `kanji migrate`.
6. **SDK types wrong?** → Regenerate: `kanji openapi:generate && kanji sdk:generate`.
7. **Env var crashing?** → Check you're using `env()` not `process.env`. Run `assertEnvValid()` in main.
