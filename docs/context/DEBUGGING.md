# Debugging & Troubleshooting Guide

This document covers how to investigate and resolve bugs in Kanji Framework, including where logs are located, how to profile code, and reference for common error patterns.

---

## 1. Getting Started with Debugging

### 1.1 Development Mode

```bash
# Run an example app in development
cd examples/basic
bun run dev

# Server starts on http://localhost:3000 with hot reload
# Logs print to stdout automatically
```

### 1.2 Debug with Bun

Bun has built-in support for Node.js `--inspect`:

```bash
# Debug with Chrome DevTools or VS Code
bun --inspect run src/main.ts

# Break at first line
bun --inspect-brk run src/main.ts
```

Then open `chrome://inspect` in Chrome or use VS Code's "Attach to Bun" debug configuration.

---

## 2. Logs and Where to Find Them

### 2.1 Application Logs

Kanji uses the logger service injected via DI. By default, logs go to stdout:

```bash
# Development — all logs to console
bun run dev

# With log level filter
LOG_LEVEL=debug bun run dev

# Available levels: error, warn, info, debug, trace
```

### 2.2 Enabling Verbose Logging

```typescript
// In src/main.ts or app.module.ts
import { logger } from '@kanjijs/common';

// Set log level at startup
logger.setLevel('debug');

// In any service:
logger.debug('Processing request', { method, path });
logger.info('User created', { userId });
logger.error('Failed to authenticate', { error });
```

### 2.3 HTTP Request Logging

Hono middleware logs all requests automatically:

```
[2025-01-15T10:30:00Z] GET /api/users 200 42ms
[2025-01-15T10:30:01Z] POST /api/users 201 120ms
[2025-01-15T10:30:05Z] GET /api/users/abc 404 5ms
```

Enable body logging in development:
```bash
LOG_BODIES=true bun run dev
```

### 2.4 Database Query Logging

Enable Drizzle query logging:

```typescript
// In database.module.ts
const client = postgres(connectionString);
const db = drizzle(client, {
  logger: true,  // ← Logs all queries
});
```

This produces:
```
[ drizzle ] SELECT * FROM users WHERE id = $1
[ drizzle ] INSERT INTO users (name, email) VALUES ($1, $2)
```

---

## 3. Common Error Patterns and Solutions

### 3.1 "Provider not found" or "Cannot resolve dependency"

**Symptom:** App crashes at startup with a DI resolution error.

**Likely causes:**
1. Provider not declared in the module's `providers` array
2. Provider not exported and consumer doesn't import the module
3. Circular dependency between modules

**Debug steps:**
1. Check the module where the provider is consumed — is it in `imports`?
2. Check the module where the provider is defined — is it in `exports`?
3. Enable verbose DI logging:
```bash
KANJI_DEBUG_DI=true bun run dev
```

**Solutions:**
- Add the missing provider to `providers` array
- Add `exports: [TokenOrService]` to the defining module
- Import the module in the consuming module's `imports`

### 3.2 Contract Validation Errors

**Symptom:** Requests fail with 400 and a validation error, but you're sure the input is correct.

**Check:**
1. Does the Zod schema match the actual request shape?
2. Are you reading validated data from the correct context key?
3. Is the `@Contract()` decorator applied to the handler?

```typescript
@Post('/')
@Contract(CreateUserContract)
create(c: Context) {
  // ✅ Correct
  const body = c.get('kanji.validated.body');

  // ❌ Wrong — data hasn't been validated
  const rawBody = await c.req.json();
}
```

### 3.3 Database Connection Errors

**Symptom:** "Connection refused" or "Cannot connect to database"

**Check:**
1. Is the database running?
```bash
# Postgres
pg_isready

# MongoDB
mongosh --eval "db.runCommand({ ping: 1 })"
```

2. Is the connection string correct in `.env`?
```
DATABASE_URL=postgres://user:password@localhost:5432/mydb
MONGODB_URI=mongodb://localhost:27017/mydb
```

3. Can the app reach the database?
```bash
curl $DATABASE_URL  # Should not fail
```

### 3.4 Authentication Errors

**Symptom:** OAuth callback fails or JWT is rejected.

**Debug steps:**
1. Check JWT secret — does the verifying instance use the same secret?
2. Check token expiry — is the token still valid?
3. Enable auth logging:
```bash
KANJI_DEBUG_AUTH=true bun run dev
```

**Common issues:**
- Missing `JWT_SECRET` environment variable (falls back to `'dev-secret'`)
- OAuth redirect URI mismatch between config and provider console
- State parameter mismatch in OAuth flow

### 3.5 Module Bootstrap Errors

**Symptom:** App crashes during `KanjijsAdapter.create()` with "cannot bootstrap" or "unknown module".

**Check:**
1. Are there circular imports between modules?
2. Does every module in `imports` actually exist and export what's needed?
3. Are dynamic modules properly configured with `forRoot()`?

**Debug:**
```bash
KANJI_DEBUG_BOOTSTRAP=true bun run dev
```

---

## 4. Profiling

### 4.1 CPU Profiling

**Bun's built-in profiler:**
```bash
bun --profile run src/main.ts
# Generates profile.json — open in Chrome DevTools
```

**Using Node.js inspector:**
```bash
bun --inspect run src/main.ts
# Open chrome://inspect → profile tab
```

### 4.2 Memory Profiling

```bash
# Heap snapshot
bun --inspect run src/main.ts
# In Chrome DevTools → Memory tab → Take heap snapshot

# Check for memory leaks
# Take snapshot before and after repeated operations
# Compare to find retained objects
```

### 4.3 Database Query Performance

Enable query timing in Drizzle:
```typescript
const db = drizzle(client, {
  logger: {
    logQuery: (query, params) => {
      console.log(`[DB] ${query} — ${params}`);
    },
  },
});
```

Use `EXPLAIN ANALYZE` for slow queries:
```typescript
const result = await db.execute(
  sql`EXPLAIN ANALYZE SELECT * FROM users WHERE email = ${email}`
);
```

---

## 5. Debugging with VS Code

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "bun",
      "request": "launch",
      "name": "Debug Basic Example",
      "program": "${workspaceFolder}/examples/basic/src/main.ts",
      "cwd": "${workspaceFolder}/examples/basic",
      "stopOnEntry": false,
      "watch": true
    },
    {
      "type": "bun",
      "request": "launch",
      "name": "Debug Core Tests",
      "program": "${workspaceFolder}/packages/core/src/__tests__/container.spec.ts",
      "cwd": "${workspaceFolder}/packages/core",
      "stopOnEntry": false
    }
  ]
}
```

---

## 6. Using `console.log` and `debugger`

### 6.1 Quick Debugging

```typescript
// Print with file:line reference
console.log('[UsersService] Creating user:', input);

// Inspect full object depth
console.dir(user, { depth: null });

// Stop execution (only when DevTools is attached)
debugger;
```

### 6.2 Conditional Debug Logging

```typescript
const DEBUG = process.env.DEBUG === 'true';

function createUser(input: CreateUserInput) {
  if (DEBUG) console.log('[DEBUG] createUser input:', input);
  // ...
}
```

---

## 7. Debugging IPC / Contract Boundary Issues

### 7.1 Contract Type Mismatch

If the frontend SDK receives unexpected data:

```typescript
// Validate response shape at the client boundary
function validateUserResponse(data: unknown): User {
  const result = UserResponseSchema.safeParse(data);
  if (!result.success) {
    console.error('[Type Contract] Response validation failed:', result.error);
    throw new Error('API response shape mismatch');
  }
  return result.data;
}
```

### 7.2 Generated SDK Debugging

```bash
# Regenerate SDK after contract changes
kanji sdk:generate --spec ./openapi.json --output ../frontend/src/api.ts

# Verify types match
bun run --check types
```

---

## 8. Debugging Concurrency Issues

### 8.1 Race Conditions in Async Code

**Symptom:** Intermittent failures — sometimes works, sometimes doesn't.

**Check:**
1. Are you awaiting promises in the correct order?
2. Are there shared mutable objects being modified concurrently?
3. Is there a missing `await`?

```typescript
// ❌ Race condition
const user = this.usersService.findById(id);
const posts = this.postsService.findByUserId(id);
// Both started, but order undefined

// ✅ Sequential when order matters
const user = await this.usersService.findById(id);
const posts = await this.postsService.findByUserId(id);

// ✅ Parallel when independent (use Promise.all)
const [user, posts] = await Promise.all([
  this.usersService.findById(id),
  this.postsService.findByUserId(id),
]);
```

### 8.2 Database Transaction Debugging

```typescript
// Log all operations within a transaction
const result = await db.transaction(async (tx) => {
  const user = await tx.query.users.findByEmail(email);
  logger.debug('[Transaction] Found user:', user?.id);

  const updated = await tx.update(users)
    .set({ lastLogin: new Date() })
    .where(eq(users.id, user.id))
    .returning();
  logger.debug('[Transaction] Updated user:', updated[0]?.id);

  return user;
});
```

---

## 9. Reference: Common Error Messages

| Error | Meaning | Action |
|-------|---------|--------|
| `Provider not found: Symbol(DATABASE_CLIENT)` | DI token not registered | Add provider to module or import the module that exports it |
| `Validation failed: body.email` | Zod schema rejected the input | Check the contract schema vs actual request body |
| `ECONNREFUSED` | Database not running | Start the database service or check connection string |
| `JWT_EXPIRED` | Token has expired | Refresh the token or re-authenticate |
| `UNAUTHORIZED` | Missing or invalid auth | Check Authorization header and token format |
| `Cannot bootstrap module` | Module graph has errors | Check imports/exports for circular or missing dependencies |
| `openapi.json not found` | Spec not generated | Run `kanji openapi:generate` first |
| `Migration directory not found` | No migrations exist | Run `drizzle-kit generate` first |

---

## 10. Where to Look First

| Symptom | Check This First |
|---------|-----------------|
| App crashes on startup | `KANJI_DEBUG_BOOTSTRAP=true` — check module graph |
| Request returns 400 | Check contract schema — are all required fields present? |
| Request returns 401/403 | Check `Authorization` header and JWT validity |
| Database operations fail | Is the database running? Is the connection string correct? |
| WebSocket doesn't connect | Check gateway path and auth middleware |
| CLI command fails | Run with `--verbose` flag |
| SDK types are wrong | Regenerate with `kanji sdk:generate` |
| Memory grows over time | Heap snapshot comparison — look for detached DOM or event listeners |
| Slow responses | Enable query logging — look for missing indexes or N+1 queries |
