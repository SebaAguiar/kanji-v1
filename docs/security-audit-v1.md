# Kanji Framework v1.0.0 — Security Audit

> **Version:** 1.0.0-alpha.21
> **Audit Date:** 2026-07-20
> **Scope:** Authentication, Authorization, WebSocket, Rate Limiting, Input Validation

---

## 1. Overview

This document describes the security posture of the Kanji Framework v1.0.0.
It covers authentication (JWT + OAuth2), authorization (RBAC + ACL), WebSocket
transport, input validation, and rate limiting. Identified gaps and
recommendations for remediation are documented in sections 6 and 7.

---

## 2. Authentication

### 2.1 JWT Sessions (`packages/auth/src/session.ts`)

- **Algorithm:** HS256 (HMAC with SHA-256) via `jsonwebtoken`.
- **Token verification:** Structural validation on decoded payload
  (userId, email, name, roles, scopes, expiresAt must be present and correct type).
  Rejects tampered, expired, and differently-keyed tokens.
- **Token creation:** Configurable expiry via `expiresInSeconds`.
  No `iat`/`nbf` enforcement beyond what `jsonwebtoken` provides.
- **Secret:** Configured via `AuthConfig.jwtSecret`. No default production secret;
  dev fallback exists but logs no warning.

### 2.2 Session Middleware (`packages/auth/src/middleware.ts`)

- Extracts Bearer token from `Authorization` header.
- Verifies via `SessionProvider.verifyToken()`.
- Sets 5 context keys: `kanji.auth.user`, `kanji.auth.session`,
  `kanji.auth.roles`, `kanji.auth.principal`, `kanji.auth.scopes`.
- **Non-blocking:** Missing/invalid token does not abort the request;
  downstream guards (AuthGuard, clp, acl) enforce authentication.

### 2.3 OAuth2 (`packages/auth/src/oauth.ts`)

- **Flow:** Authorization Code (no PKCE).
- **State protection:** `StateStore` in `packages/auth/src/state-store.ts`
  generates single-use, 10-minute TTL states. Verified on callback, consumed
  immediately.
- **Token exchange:** POST to provider tokenUrl with client_id, client_secret,
  code, redirect_uri. Validates response contains `access_token`.
- **User profile:** Fetches from provider userInfoUrl. Handles Google, GitHub,
  Microsoft field mappings. GitHub private email fallback via separate API call.

---

## 3. Authorization

### 3.1 RBAC — Class-Level Permissions (`clp`)

- Applied via `clp(permissions)` middleware on controllers.
- Maps HTTP methods to actions: POST→create, GET→read/list, PATCH/PUT→update,
  DELETE→delete.
- Rule evaluation:
  1. `'public'` or `{ public: true }` → allow all
  2. No user → 401 (if not public)
  3. `'authenticated'` or `{ authenticated: true }` → allow
  4. `{ role: 'X' }` → check user has role X (403 if not)
  5. `{ anyRole: ['X','Y'] }` → check any match (403 if not)
- Undefined action → 403.

### 3.2 ACL — Object-Level Permissions (`acl`)

- Applied via `acl(options)` middleware on routes.
- Resolves a `ResourcePolicy` instance from the DI container.
- Calls `canCreate`/`canRead`/`canUpdate`/`canDelete` on the policy with
  `(context, resource, user)`.
- Supports `hideExistence: true` → returns 404 instead of 403 on denial
  (prevents resource enumeration).
- Custom `resourceId` selector supported.

---

## 4. WebSocket Security

### 4.1 Gateway Upgrade

- WS upgrade path is a standard Hono `GET` route.
- Controller-level middlewares (from `@UseWsGuards`) run before the upgrade
  handler, enabling authentication checks at upgrade time.
- If the guard returns a non-101 response, the WS connection is rejected.

### 4.2 Message Validation

- `@Contract({ body: z.object(...) })` validates incoming WS message payloads.
- Invalid payloads receive a structured `VALIDATION_ERROR` response.
- Unparseable JSON receives a `PARSE_ERROR` response.

### 4.3 Error Handling

- Handler exceptions are caught, logged, and sent as `INTERNAL_ERROR` messages
  to the client. Stack traces are **not** exposed in production-like logs.

---

## 5. Rate Limiting

- **Store:** In-memory `Map<string, RateLimitEntry>` with 60-second cleanup timer.
- **Window:** Configurable (ms, s, m, h, d). Sliding window per key.
- **Keys:** By IP (x-forwarded-for → x-real-ip → remote address), by user
  (kanji.auth.user.id), or global.
- **Headers:** `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.
- **Enforcement:** Throws `TooManyRequestsError` (429) when limit exceeded.
- **Limitation:** In-memory only; not shared across processes. No Redis/DB backend.

---

## 6. Identified Gaps

### 6.1 No PKCE for OAuth2

The OAuth2 Authorization Code flow does not implement PKCE (Proof Key for Code
Exchange). Native/mobile apps or public clients that cannot securely store
`client_secret` are vulnerable to authorization code interception attacks.

**Severity:** Medium  
**Affected:** `packages/auth/src/oauth.ts` — `exchangeCodeForToken()`

### 6.2 No HTTP Security Headers

No middleware applies security-related HTTP response headers:
- `Strict-Transport-Security` (HSTS)
- `Content-Security-Policy`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection`

**Severity:** Low  
**Affected:** `packages/platform-hono/src/hono-adapter.ts` — global middleware setup

### 6.3 Rate Limit Store is In-Memory Only

Rate limit state is lost on process restart. Multi-process deployments
(PaaS, serverless, Kubernetes replicas) cannot share rate limit state
without a distributed store.

**Severity:** Low  
**Affected:** `packages/platform-hono/src/middleware/rate-limit.ts`

### 6.4 No JWT Secret Rotation

`SessionProvider` has no support for key rotation (multiple signing keys,
grace period for old keys). Changing `jwtSecret` invalidates all existing
sessions.

**Severity:** Low  
**Affected:** `packages/auth/src/session.ts`

### 6.5 No Input Sanitization Layer

Input validation relies entirely on Zod schema validation. There is no
general-purpose sanitization layer (HTML escaping, SQL injection prevention
beyond Drizzle's parameterized queries, NoSQL injection prevention).

**Severity:** Low  
**Affected:** All packages

### 6.6 Auth Context Not POPULATED for `authz.cache` and `authz.decision`

The context keys `kanji.authz.cache` and `kanji.authz.decision` are declared
in `KANJI_CTX` and typed in `ContextVariableMap` but are never written by
any middleware or guard. This means authorization decision caching and
debugging information are not available at runtime.

**Severity:** Informational  
**Affected:** `packages/platform-hono/src/types.ts`, `packages/platform-hono/src/hono-context.d.ts`

---

## 7. Recommendations

| Priority | Recommendation | Effort | Impact |
|----------|---------------|--------|--------|
| 🔴 High | Add PKCE support to OAuth2 flow | Medium | Prevents authorization code interception |
| 🟡 Medium | Add helmet-like middleware for security headers | Low | Improves overall security posture |
| 🟡 Medium | Add Redis/DB backend interface for rate limiting | Medium | Enables multi-process deployments |
| 🟢 Low | Add key rotation support to SessionProvider | Medium | Allows rolling secrets without session invalidation |
| 🟢 Low | Populate `kanji.authz.cache` and `kanji.authz.decision` | Low | Enables auth debugging and per-request caching |
| 🟢 Low | Document security best practices in user-facing guides | Low | Helps developers avoid common misconfigurations |

---

## 8. Past Fixes

| Issue | Fixed In | Details |
|-------|----------|---------|
| `any` type violations across all packages | alpha.18 | All explicit `any` and `unknown` removed |
| Error shape standardization | alpha.19 | Error responses match ARCHITECTURE spec |
| `@UseWsGuards` not wiring to WS upgrade | alpha.21 | WAS reading from HttpMetadataStorage instead of WsMetadataStorage |
| Gateway handler `this` binding | alpha.21 | `method()` called without `.call(instance)` — `this` was undefined |
