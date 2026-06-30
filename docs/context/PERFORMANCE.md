# Performance Budgets & Metrics

This document defines concrete performance targets for Kanji Framework, how to measure them, and what regressions are acceptable or not.

---

## 1. Performance Philosophy

Kanji's tagline is "Velocity without compromise." Performance is a feature, not an afterthought. Every decision in the framework is made with startup time, request latency, and memory footprint in mind.

**Core principle:** The developer should never feel like the framework is the bottleneck. App startup should be instant, requests should be fast, and memory usage should be predictable.

---

## 2. Startup Performance

### 2.1 Time to First Request (TTFR)

| Scenario | Target | Max Acceptable |
|---|---|---|
| Cold start (no cache) — basic app | <200ms | <500ms |
| Cold start — full app with DB + auth | <500ms | <1s |
| Hot reload (after file change) | <50ms | <100ms |

**What's measured:**
- From `bun run dev` execution until the server responds to the first HTTP request.
- Includes: module loading, DI container resolution, database connection, middleware setup.

**How to measure:**
```bash
time bun run src/main.ts &
sleep 1
time curl http://localhost:3000/health
```

### 2.2 Module Bootstrap Time

| Number of Modules | Target | Max Acceptable |
|---|---|---|
| <10 modules | <50ms | <100ms |
| 10-50 modules | <100ms | <200ms |
| 50+ modules | <200ms | <400ms |

**How to measure:**
```typescript
const start = performance.now();
const { app } = await KanjijsAdapter.create(AppModule);
console.log(`Bootstrap took ${performance.now() - start}ms`);
```

---

## 3. Request Performance

### 3.1 Request Latency (p50/p99)

| Operation | p50 Target | p99 Max |
|---|---|---|
| Simple GET (no DB) | <5ms | <20ms |
| GET with single DB query | <20ms | <100ms |
| POST with validation + DB write | <50ms | <200ms |
| POST with auth + validation + DB write | <80ms | <300ms |

**What's measured:**
- From request arrival at the Hono router until response is sent.
- Includes: middleware chain, validation, auth check, handler execution, serialization.

**How to measure:**
```typescript
// Use Hono's built-in timing middleware
import { timing } from 'hono/timing';

app.use('*', timing());
// Response headers include: Server-Timing
```

### 3.2 Validation Overhead

| Schema Complexity | Overhead | Budget |
|---|---|---|
| Simple (3-5 fields) | <0.5ms | <1ms |
| Medium (10-20 fields, nested) | <2ms | <5ms |
| Complex (50+ fields, deep nesting) | <10ms | <20ms |

---

## 4. Memory Usage

### 4.1 RAM Baseline

| Scenario | Target | Max Acceptable |
|---|---|---|
| App running, no DB connected | <30 MB | <50 MB |
| App with DB connection (idle) | <50 MB | <80 MB |
| App under load (100 concurrent req) | <80 MB | <120 MB |

**What's measured:**
- RSS (Resident Set Size) measured with system tools.
- Not VSZ (virtual memory), which can be misleading.

**How to measure:**
```bash
# Monitor in real-time
pidstat -r -p $(pgrep -f "bun run") 1

# Or use /proc (Linux)
cat /proc/$(pgrep -f main.ts)/status | grep VmRSS

# macOS
vmmap <PID> | grep "Physical footprint"
```

### 4.2 Memory Leak Detection

Run the app under sustained load and monitor:
```bash
# Simulate 1000 requests
for i in {1..1000}; do curl http://localhost:3000/health; done

# Check memory before and after
# If memory doesn't return to baseline, there's a leak
```

---

## 5. Database Performance

### 5.1 Query Latency

| Query Type | Target | Max Acceptable |
|---|---|---|
| Single row lookup by PK | <5ms | <10ms |
| Simple list (10 rows) | <10ms | <30ms |
| Complex join (3+ tables) | <30ms | <100ms |
| Write (single row insert) | <10ms | <30ms |
| Transaction (3+ operations) | <50ms | <150ms |

**How to measure:**
```typescript
const start = performance.now();
const result = await db.select().from(users).where(eq(users.id, id));
logger.debug(`Query took ${performance.now() - start}ms`);
```

### 5.2 Connection Pool Health

| Metric | Healthy | Warning | Critical |
|---|---|---|---|
| Active connections | <50% of max | >80% of max | 100% of max |
| Query queue depth | 0 | >5 | >20 |
| Average query time | <10ms | >50ms | >200ms |

---

## 6. Build Performance

### 6.1 Compilation Time

| Build Type | Target | Max Acceptable |
|---|---|---|
| `bun run build` (single package) | <2s | <5s |
| `bun run build` (all packages) | <10s | <20s |
| `bun install` (fresh) | <5s | <15s |
| CI pipeline (test + lint + build) | <30s | <60s |

---

## 7. Performance Regression Prevention

### 7.1 Pre-Commit Checklist

Before pushing code that touches performance-critical paths:

- [ ] Benchmark the affected route(s) before and after the change
- [ ] Check query count per request hasn't increased
- [ ] Verify memory usage is stable (±5 MB)
- [ ] No synchronous operations in async handlers
- [ ] No N+1 queries introduced

### 7.2 Performance Audit Template

When adding a feature, document expected performance impact:

```markdown
## Performance Impact

### Request Latency
- Before: 15ms (p50), 60ms (p99)
- After: 18ms (p50), 70ms (p99)
- Δ: +3ms (+20%)
- Acceptable? YES (new validation middleware)

### Memory
- Before: 45 MB baseline
- After: 48 MB baseline
- Δ: +3 MB (new provider in DI container)
- Acceptable? YES

### Startup
- Before: 180ms
- After: 200ms
- Δ: +20ms (+11%)
- Acceptable? YES (within 500ms budget)
```

---

## 8. Performance Budgets by Package

| Package | Startup Overhead | Request Overhead | Memory |
|---|---|---|---|
| `@kanjijs/core` | <30ms | <0.1ms | <5 MB |
| `@kanjijs/platform-hono` | <10ms | <0.1ms | <2 MB |
| `@kanjijs/contracts` | <5ms | <1ms (validation) | <1 MB |
| `@kanjijs/openapi` | <50ms (scan only) | N/A | <5 MB |
| `@kanjijs/store` | <50ms (connection) | <0.5ms | <10 MB |
| `@kanjijs/auth` | <20ms | <2ms (verify) | <3 MB |
| `@kanjijs/cli` | N/A | N/A | <10 MB |
| `@kanjijs/common` | <5ms | <0.1ms | <1 MB |
