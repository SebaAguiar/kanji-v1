# Database Integration & ORM Guide

This guide details how to integrate and manage databases within Kanji using the `@kanjijs/store` package.

---

## 1. Setup and Config

Database connections in Kanji are initialized using the `StoreModule` inside the application root module:

```typescript
import { Module } from '@kanjijs/core';
import { StoreModule } from '@kanjijs/store';

@Module({
  imports: [
    StoreModule.forRoot({
      type: 'postgres', // Or 'mongodb'
      url: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/postgres',
      schema: './src/database/schema.ts', // Drizzle schema path
    }),
  ],
})
export class AppModule {}
```

---

## 2. PostgreSQL with Drizzle ORM

When using `'postgres'`, Kanji exposes the underlying Drizzle client and SQL builders.

### Defining Schemas
Create your schema in `src/database/schema.ts` using Drizzle ORM builder:

```typescript
import { pgTable, varchar, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: varchar('id', { length: 255 }).primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### Dependency Injection
Inject `DATABASE_CLIENT` directly into your services:

```typescript
import { Injectable, Inject } from '@kanjijs/core';
import { DATABASE_CLIENT, type Database } from '@kanjijs/store';
import { users } from '../database/schema.js';

@Injectable()
export class UsersService {
  constructor(
    @Inject(DATABASE_CLIENT)
    private readonly db: Database,
  ) {}

  async findAll() {
    return this.db.select().from(users);
  }

  async create(id: string, email: string, name: string) {
    return this.db.insert(users).values({ id, email, name }).returning();
  }
}
```

---

## 3. MongoDB Integration

When using `'mongodb'`, Kanji configures an adapter allowing you to work with collections while keeping your repositories database-agnostic.

```typescript
import { Injectable, Inject } from '@kanjijs/core';
import { DATABASE_CLIENT, type Database } from '@kanjijs/store';

@Injectable()
export class ProductsService {
  constructor(
    @Inject(DATABASE_CLIENT)
    private readonly db: Database,
  ) {}

  async findAll() {
    return this.db.collection('products').find({}).toArray();
  }
}
```

---

## 4. Migrations & Schema Syncing

Kanji includes script aliases mapping to `drizzle-kit` for schema syncing and generation.

```bash
# Generate new migration files based on schema changes
kanji db:generate

# Push changes directly (recommended for prototyping/dev)
kanji db:push

# Run pending migrations
kanji db:migrate
```
