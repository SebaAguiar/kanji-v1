# Security Practices & Configurations

Kanji is designed with secure defaults. This guide details key features to secure your APIs.

---

## 1. Security HTTP Headers

Kanji provides built-in integration to inject essential security headers (HSTS, CSP, Content-Type Options, Frame Options, XSS Protection).

### Configuration
Configure headers via options inside `KanjijsAdapter.create(...)`:

```typescript
import { KanjijsAdapter } from '@kanjijs/platform-hono';
import { AppModule } from './app.module.js';

const { app } = await KanjijsAdapter.create(AppModule, {
  securityHeaders: {
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    contentSecurityPolicy: "default-src 'self'; script-src 'self' 'unsafe-inline'",
    xFrameOptions: 'DENY',
    xssProtection: true,
  },
});
```

---

## 2. Rate Limiting

Endpoints can be rate-limited using the `@RateLimit` decorator.

### Usage Example
```typescript
import { Controller, Post } from '@kanjijs/platform-hono';
import { RateLimit } from '@kanjijs/platform-hono';

@Controller('/auth')
export class AuthController {
  @Post('/login')
  @RateLimit({
    limit: 5,       // Max 5 requests
    window: '1m',   // Per 1 minute window
    by: 'ip',       // Track by Client IP
  })
  async login() {
    return { status: 'ok' };
  }
}
```

### Rate Limit Keys (`by` option)
* `ip`: Rates are segmented by client IP (using `x-forwarded-for`, `x-real-ip`, or socket addresses).
* `user`: Rates are segmented by the authenticated user's ID (`kanji.auth.user` context key).
* `global`: Shared rate limit key applied globally across all clients.

---

## 3. Rate Limit Stores (Scalability)

By default, Kanji uses an in-memory `MemoryStore` for local development. For production multi-process or serverless clusters, you can provide custom external stores (like Redis) globally or locally.

### Creating a Custom Store
Implement the `RateLimitStore` interface:

```typescript
import type { RateLimitStore } from '@kanjijs/platform-hono';
import { Redis } from 'ioredis';

export class RedisRateLimitStore implements RateLimitStore {
  constructor(private redis: Redis) {}

  async increment(key: string, windowMs: number) {
    const current = await this.redis.incr(key);
    if (current === 1) {
      await this.redis.pexpire(key, windowMs);
    }
    const ttl = await this.redis.pttl(key);
    const resetTime = Date.now() + (ttl > 0 ? ttl : windowMs);
    return { count: current, resetTime };
  }
}
```

### Injecting the Store
You can register it globally in your Adapter Options:

```typescript
const { app } = await KanjijsAdapter.create(AppModule, {
  rateLimitStore: new RedisRateLimitStore(new Redis()),
});
```

Or inject it locally on specific decorators:

```typescript
@RateLimit({ limit: 10, window: '1m', by: 'ip', store: myLocalStore })
```
