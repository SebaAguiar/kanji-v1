# Kanji Framework — Paso a Paso de lo Pendiente

> Fecha: 2026-07-20 · Versión: v1.0.0-alpha.21

---

## Índice

1. [CLI Refactor](#1-cli-refactor)
2. [Seguridad (gaps del audit)](#2-seguridad-gaps-del-audit)
3. [Fase 5: Polish + Launch](#3-fase-5-polish--launch)
4. [Ejemplos: Tests faltantes](#4-ejemplos-tests-faltantes)
5. [OpenAPI Decorators](#5-openapi-decorators)
6. [CI Templates](#6-ci-templates)
7. [Offline Package](#7-offline-package)

---

## 1. CLI Refactor

**Por qué:** `commands/generate.ts` tiene **603 líneas** manejando 8 tipos de artefacto.
`commands/new.ts` tiene **453 líneas**. `module-updater.ts` (207 líneas) usa regex
para modificar decoradores — frágil y propenso a errores.

### Paso 1: Dividir `commands/generate.ts`

| Nuevo archivo | Contenido | ~líneas |
|---|-----------|--------|
| `commands/generate/index.ts` | Comando principal, wizard prompts, shared utils | 100 |
| `commands/generate/resource.ts` | Handler para `kanji g resource` | 150 |
| `commands/generate/module.ts` | Handler para `kanji g module` | 50 |
| `commands/generate/controller.ts` | Handler para `kanji g controller` | 50 |
| `commands/generate/service.ts` | Handler para `kanji g service` | 30 |
| `commands/generate/repository.ts` | Handler para `kanji g repository` | 40 |
| `commands/generate/auth.ts` | Handler para `kanji g auth` | 180 |
| `commands/generate/gateway.ts` | Handler para `kanji g gateway` | 50 |
| `commands/generate/webhook.ts` | Handler para `kanji g webhook` | 180 |

**Verificación:** `cd packages/cli && bun test` — 0 regresiones.

### Paso 2: Dividir `commands/new.ts`

| Nuevo archivo | Contenido | ~líneas |
|---|-----------|--------|
| `commands/new/index.ts` | Entry point, parsing args | 50 |
| `commands/new/scaffold.ts` | Wizard interactivo + opciones | 150 |
| `commands/new/template-copier.ts` | `copyTemplate()` y helpers | 100 |
| `commands/new.ts` (reducido) | Handler delegando a los submodulos | ~150 |

**Verificación:** `cd packages/cli && bun test` — 0 regresiones.

### Paso 3: Reemplazar `module-updater.ts` con AST

Reemplazar el regex actual con `ts-morph` (TypeScript compiler API wrapper):

```bash
cd packages/cli && pnpm add ts-morph
```

```typescript
// utils/module-updater.ts — versión AST
import { Project, SyntaxKind } from 'ts-morph';

export function ensurePropertyInDecorator(content: string, propertyName: string): string {
  const project = new Project({ useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile('temp.ts', content);

  // Find @KanjijsModule({...}) decorator
  const classDec = sourceFile.getClasses()[0];
  const decorator = classDec?.getDecorator('KanjijsModule');
  if (!decorator) return content;

  const callExpr = decorator.getCallExpression();
  if (!callExpr) return content;

  const objLiteral = callExpr.getArguments()[0];
  if (!objLiteral || objLiteral.getKind() !== SyntaxKind.ObjectLiteralExpression) return content;

  const existingProp = (objLiteral as any).getProperty(propertyName);
  if (existingProp) return content; // already exists

  // Add the property
  const text = objLiteral.getText();
  const newText = text.length > 2
    ? text.slice(0, -1) + `,\n  ${propertyName}: [],\n}`
    : text.slice(0, -2) + `  ${propertyName}: [],\n}`;
  objLiteral.replaceWithText(newText);

  return sourceFile.getFullText();
}
```

**Verificación:** `cd packages/cli && bun test` — los tests de generate y new deben seguir pasando. Corre también `bun test --filter @kanjijs/cli` desde raíz.

---

## 2. Seguridad (gaps del audit)

Referencia: `docs/security-audit-v1.md`

### Paso 1: Security Headers Middleware (🟡 Medio · 0.5d)

Crear `packages/platform-hono/src/middleware/security-headers.ts`:

```typescript
import type { MiddlewareHandler } from 'hono';

export interface SecurityHeadersOptions {
  hsts?: { maxAge: number; includeSubDomains?: boolean; preload?: boolean };
  contentSecurityPolicy?: string | false;
  xContentTypeOptions?: boolean;
  xFrameOptions?: 'DENY' | 'SAMEORIGIN' | 'ALLOW-FROM' | false;
  xssProtection?: boolean;
}

export function securityHeadersMiddleware(
  options: SecurityHeadersOptions = {},
): MiddlewareHandler {
  return async (c, next) => {
    await next();

    // HSTS
    if (options.hsts !== false) {
      const hsts = options.hsts ?? { maxAge: 31536000, includeSubDomains: true };
      let value = `max-age=${hsts.maxAge}`;
      if (hsts.includeSubDomains) value += '; includeSubDomains';
      if (hsts.preload) value += '; preload';
      c.header('Strict-Transport-Security', value);
    }

    // CSP
    if (options.contentSecurityPolicy !== false) {
      c.header(
        'Content-Security-Policy',
        options.contentSecurityPolicy ?? "default-src 'self'",
      );
    }

    // X-Content-Type-Options
    if (options.xContentTypeOptions !== false) {
      c.header('X-Content-Type-Options', 'nosniff');
    }

    // X-Frame-Options
    if (options.xFrameOptions !== false) {
      c.header('X-Frame-Options', options.xFrameOptions ?? 'DENY');
    }

    // X-XSS-Protection
    if (options.xssProtection !== false) {
      c.header('X-XSS-Protection', '0');
    }
  };
}
```

Registrarlo como middleware global en `hono-adapter.ts`:

```typescript
// En KanjijsAdapter.create(), después de CORS
const { securityHeadersMiddleware } = await import('./middleware/security-headers.js');
app.use('*', securityHeadersMiddleware(options.securityHeaders));
```

Agregar `securityHeaders?: SecurityHeadersOptions` a `KanjijsAdapterOptions` en `types.ts`.

**Verificación:** Crear test en `adapter.spec.ts` que verifique headers en response.

### Paso 2: Rate Limit Store Interface (🟡 Medio · 1d)

Crear interfaz en `rate-limit.ts`:

```typescript
export interface RateLimitStore {
  increment(key: string, windowMs: number, limit: number): Promise<{
    count: number;
    remaining: number;
    resetAt: number;
  }>;
}
```

Implementar `InMemoryRateLimitStore` (el actual, refactorizado) y `RedisRateLimitStore`:

```typescript
// Adaptador Redis (requiere ioredis como peer dep)
import { Redis } from 'ioredis';

export class RedisRateLimitStore implements RateLimitStore {
  constructor(private redis: Redis) {}

  async increment(key: string, windowMs: number, limit: number) {
    // Usa INCR + EXPIRE de Redis
    const current = await this.redis.incr(key);
    if (current === 1) await this.redis.pexpire(key, windowMs);
    const ttl = await this.redis.pttl(key);
    const resetAt = Date.now() + ttl;
    const remaining = Math.max(0, limit - current);
    return { count: current, remaining, resetAt };
  }
}
```

Modificar `createRateLimitMiddleware()` para aceptar store opcional:

```typescript
export function createRateLimitMiddleware(
  options: RateLimitOptions,
  routeKey: string,
  store?: RateLimitStore,
): MiddlewareHandler {
  const effectiveStore = store ?? new InMemoryRateLimitStore();
  // ... usar effectiveStore en lugar de _rateLimitStore
}
```

**Verificación:** Tests existentes de rate-limit deben pasar sin cambios (usan InMemoryRateLimitStore por defecto).

### Paso 3: PKCE para OAuth2 (🔴 Alto · 1d)

En `packages/auth/src/oauth.ts`, agregar funciones:

```typescript
export function generateCodeVerifier(): string {
  const buffer = crypto.getRandomValues(new Uint8Array(32));
  return base64urlEncode(buffer);
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64urlEncode(new Uint8Array(hash));
}

function base64urlEncode(buffer: Uint8Array): string {
  return btoa(String.fromCharCode(...buffer))
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}
```

Modificar `getAuthorizationUrl()` para aceptar `codeChallenge` opcional:

```typescript
export function getAuthorizationUrl(
  provider: OAuthProviderConfig,
  redirectUri: string,
  state: string,
  codeChallenge?: string,
): string {
  const url = new URL(provider.authorizationUrl);
  // ... parámetros existentes ...
  if (codeChallenge) {
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
  }
  return url.toString();
}
```

Agregar `codeVerifier` a `exchangeCodeForToken()`:

```typescript
export async function exchangeCodeForToken(
  provider: OAuthProviderConfig,
  code: string,
  redirectUri: string,
  codeVerifier?: string,
): Promise<string> {
  const body = new URLSearchParams({ /* ... */ });
  if (codeVerifier) body.set('code_verifier', codeVerifier);
  // ...
}
```

**Verificación:** Tests existentes de OAuth deben pasar (PKCE es opcional, backward compatible). Agregar test de `generateCodeVerifier()` y `generateCodeChallenge()`.

### Paso 4: JWT Secret Rotation (🟢 Bajo · 0.5d)

Modificar `SessionProvider` para aceptar múltiples secrets:

```typescript
export class SessionProvider {
  private secrets: Array<{ secret: string; kid?: string }>;

  constructor(
    @Inject(AUTH_CONFIG)
    private readonly config: AuthConfig,
  ) {
    // Si jwtSecret es string, wrapper en array con kid = 'current'
    this.secrets = [{
      secret: this.config.jwtSecret,
      kid: 'current',
    }];
    // Si hay previousSecrets, agregarlos con kid = 'previous-N'
    if (this.config.previousSecrets) {
      for (const [i, s] of this.config.previousSecrets.entries()) {
        this.secrets.push({ secret: s, kid: `previous-${i}` });
      }
    }
  }

  public createToken(...): string {
    const current = this.secrets[0];
    return jwt.sign(payload, current.secret, {
      expiresIn: expiresInSeconds,
      header: { kid: current.kid },
    });
  }

  public verifyToken(token: string): KanjiSession | null {
    for (const { secret } of this.secrets) {
      try {
        return this.decodeAndVerify(token, secret);
      } catch {
        continue; // try next key
      }
    }
    return null;
  }
}
```

Agregar `previousSecrets?: string[]` a `AuthConfig`.

**Verificación:** Tests de session deben pasar. Agregar test que verifica token firmado con current es verificable con previousSecrets.

### Paso 5: authz context keys (🟢 Bajo · 0.5d)

En `packages/auth/src/guards.ts`, al final de `clp()` y `acl()`, agregar:

```typescript
// En clp, antes de await next()
const decision = { allowed: true, action, reason: 'role matched' };
c.set('kanji.authz.decision', decision);

// Inicializar cache si no existe
if (!c.get('kanji.authz.cache')) {
  c.set('kanji.authz.cache', new Map());
}
c.get('kanji.authz.cache').set(action, decision);
```

**Verificación:** Tests de authorization.spec.ts deben pasar. Agregar test que verifica `kanji.authz.decision` y `kanji.authz.cache`.

---

## 3. Fase 5: Polish + Launch

### Paso 1: Performance Benchmarks (0.5d)

Crear `benchmarks/` en raíz:

**Archivo:** `benchmarks/http.bench.ts`

```typescript
import { bench, run } from 'mitata';

import { KanjijsAdapter } from '@kanjijs/platform-hono';
import { AppModule } from '../examples/basic/src/app.module.js';
import { ZodValidator } from '@kanjijs/contracts';

const { app } = await KanjijsAdapter.create(AppModule, {
  validator: new ZodValidator(),
  logger: false,
});

// Benchmarks
bench('GET /users', async () => {
  await app.request('/users');
});

bench('POST /users (validated)', async () => {
  await app.request('/users', {
    method: 'POST',
    body: JSON.stringify({ name: 'Alice', email: 'alice@test.com' }),
  });
});

await run();
```

Ejecutar: `bun run benchmarks/http.bench.ts`

Crear `benchmarks/README.md` con resultados y comparación contra targets de ARCHITECTURE.md.

### Paso 2: Completar documentación (2d)

**docs/guides/ a verificar/crear:**

| Guía | Estado |
|------|--------|
| `docs/guides/authentication.md` | ❌ Verificar existencia |
| `docs/guides/database.md` | ❌ Verificar |
| `docs/guides/websockets.md` | ❌ Verificar (recién creamos el ejemplo) |
| `docs/guides/security.md` | ❌ Verificar |
| `docs/guides/testing.md` | ❌ Verificar |

Para cada guía faltante, crear desde el template de ARCHITECTURE.md Tier correspondiente.

`docs/QUICKSTART.md` — debe cubrir:
- Instalación `npm create kanji@latest`
- Crear proyecto con `kanji new my-api`
- Agregar recurso con `kanji g resource users`
- Correr con `kanji dev`
- Endpoints generados

`docs/API.md` — referencia de API para cada package:
- `@kanjijs/core`: Container, Module, Injectable, Inject
- `@kanjijs/platform-hono`: KanjijsAdapter, Controller, Get/Post, context helpers
- `@kanjijs/contracts`: ZodValidator, Contract, formatZodIssues
- `@kanjijs/auth`: AuthModule, SessionProvider, clp, acl, AuthGuard
- `@kanjijs/store`: StoreModule, PostgresDatabase, MongoDatabase
- `@kanjijs/openapi`: OpenApiGenerator, OpenApiController, decorators
- `@kanjijs/cli`: todos los comandos

### Paso 3: Real-world examples — README y polish (0.5d)

Cada ejemplo necesita:
- `README.md` con: propósito, cómo correr, qué prueba
- `package.json` con scripts funcionales
- `.env.example` si aplica

### Paso 4: Community setup (0.5d)

- Verificar `.github/ISSUE_TEMPLATE/` existe
- Verificar `pull_request_template.md`
- Crear Discord invite en README
- Habilitar GitHub Discussions en el repo

---

## 4. Ejemplos: Tests Faltantes

### Paso 1: `examples/starter`

Crear `src/__tests__/hello.controller.spec.ts`:

```typescript
import { describe, it, expect, afterAll } from 'bun:test';
import { KanjijsAdapter } from '@kanjijs/platform-hono';
import { ZodValidator } from '@kanjijs/contracts';
import { AppModule } from '../app.module.js';

describe('Starter App', () => {
  it('should respond to GET /hello', async () => {
    const { app, shutdown } = await KanjijsAdapter.create(AppModule, {
      validator: new ZodValidator(),
      logger: false,
    });
    const res = await app.request('/hello?name=Test');
    expect(res.status).toBe(200);
    await shutdown();
  });
});
```

### Paso 2: `examples/saas-starter`

Crear tests para cada módulo:
- `src/modules/users/__tests__/users.e2e.spec.ts` — CRUD users
- `src/modules/organizations/__tests__/organizations.e2e.spec.ts` — multi-tenant
- `src/modules/billing/__tests__/billing.e2e.spec.ts` — billing integration

Usar `createTestingModule` + mock database.

---

## 5. OpenAPI Decorators

### Paso 1: Agregar `@Example()` decorator

En `packages/openapi/src/decorators.ts`:

```typescript
export const OPENAPI_EXAMPLE_KEY = 'kanji:openapi:example';

export function Example(example: unknown): MethodDecorator {
  return (target: object, propertyKey: string | symbol): void => {
    Reflect.defineMetadata(OPENAPI_EXAMPLE_KEY, example, target, propertyKey);
  };
}
```

### Paso 2: Wire en generator.ts

En `buildOperation()`, después de leer summary/description:

```typescript
const example = Reflect.getMetadata(OPENAPI_EXAMPLE_KEY, target, propertyKey);
if (example !== undefined) {
  operation.requestBody = operation.requestBody ?? { content: { 'application/json': { schema: {} } } };
  // Inyectar example en el schema del body
}
```

### Paso 3: Fix zod-parser.ts

Corregir mapeos de checks:

```
minLength → schema.minLength (no minItems)
maxLength → schema.maxLength (no maxItems)
Agregar: z.number().min() → schema.minimum
Agregar: z.number().max() → schema.maximum
Agregar: z.string().length(n) → schema.minLength = schema.maxLength = n
```

---

## 6. CI Templates

### Paso 1: Bitbucket Pipelines

Crear `packages/cli/src/templates/ci/bitbucket.ts`:

```typescript
export function getBitbucketPipelinesTemplate(opts: ProjectOptions): string {
  return `image: node:22
pipelines:
  default:
    - step:
        caches:
          - pnpm
        script:
          - npm install -g pnpm
          - pnpm install
          - pnpm build
          - pnpm test:ci
`;
}
```

### Paso 2: CircleCI

Crear `packages/cli/src/templates/ci/circleci.ts`:

```typescript
export function getCircleCIConfigTemplate(opts: ProjectOptions): string {
  return `version: 2.1
jobs:
  build:
    docker:
      - image: cimg/node:22
    steps:
      - checkout
      - run: npm install -g pnpm
      - run: pnpm install
      - run: pnpm build
      - run: pnpm test:ci
`;
}
```

### Paso 3: Dockerfile

Crear `packages/cli/src/templates/dockerfile.ts`:

```typescript
export function getDockerfileTemplate(opts: ProjectOptions): string {
  return `FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1-slim
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
EXPOSE 3000
CMD ["bun", "dist/main.js"]
`;
}
```

### Paso 4: Actualizar `init-ci.ts`

Agregar opciones para Bitbucket, CircleCI, Dockerfile. Extender el enum `CiPlatform`.

---

## 7. Offline Package

**Prioridad: Baja — para post-v1.0.0**

### Paso 1: Scaffold del package

Crear `packages/offline/` con:
- `package.json` — `name: "@kanjijs/offline"`, dep: `@kanjijs/store`
- `tsconfig.json` — extends root
- `src/index.ts`
- `src/types.ts` — `OfflineChange`, `Conflict`, `ConflictStrategy`, `SyncResult`

### Paso 2: Sync Manager

`src/sync-manager.ts`:

```typescript
export class OfflineSyncManager {
  async detectConflicts(changes: OfflineChange[]): Promise<Conflict[]> {
    // 3 tipos de conflicto:
    // 1. VERSION_MISMATCH — el resource tiene version mayor en server
    // 2. MISSING — el resource fue borrado en server
    // 3. CONSTRAINT_VIOLATION — unique constraint, foreign key, etc.
  }

  async resolveConflicts(conflicts: Conflict[], strategy: ConflictStrategy): Promise<OfflineChange[]> {
    // Estrategias:
    // - last-write-wins: gana el timestamp más reciente
    // - server-wins: ignora cambios del cliente
    // - client-wins: fuerza cambios del cliente
    // - reject: lanza error, no aplica nada
  }

  async sync(changes: OfflineChange[], strategy?: ConflictStrategy): Promise<SyncResult> {
    const conflicts = await this.detectConflicts(changes);
    if (conflicts.length === 0) {
      return this.applySyncChanges(changes);
    }
    const resolved = await this.resolveConflicts(conflicts, strategy ?? 'last-write-wins');
    return this.applySyncChanges(resolved);
  }

  private async applySyncChanges(changes: OfflineChange[]): Promise<SyncResult> {
    // Batch atómico con transacción (rollback si falla)
  }
}
```

### Paso 3: Tests

`packages/offline/src/__tests__/sync-manager.spec.ts`:
- detectConflicts: version mismatch, missing resource, no conflicts
- resolveConflicts: last-write-wins, server-wins, client-wins
- sync: end-to-end flow

---

## Orden Recomendado de Ejecución

| Orden | Área | Por qué primero |
|-------|------|-----------------|
| 1 | **Seguridad: Security Headers** | Bajo esfuerzo, alto impacto en postura de seguridad |
| 2 | **Seguridad: authz context keys** | Bajo esfuerzo, arregla dead code |
| 3 | **OpenAPI Decorators: @Example + fix zod-parser** | Corrige bugs en spec generado |
| 4 | **CI Templates** | Bajo esfuerzo, completa feature existente |
| 5 | **CLI Refactor** | Mejora mantenibilidad a largo plazo |
| 6 | **Seguridad: Rate Limit Store Interface** | Desbloquea deploys multi-proceso |
| 7 | **Ejemplos: Tests** | Atado a refactor de CLI (usa templates) |
| 8 | **Seguridad: PKCE + JWT Rotation** | Más complejo, requiere diseño cuidadoso |
| 9 | **Fase 5: Benchmarks + Docs** | Lo último, depende de features estables |
| 10 | **Offline Package** | Post-v1.0.0, baja prioridad |

---

## Resumen de Esfuerzo Total Estimado

| Área | Días | Dependencias |
|------|------|-------------|
| CLI Refactor | 2-3 | — |
| Security Headers | 0.5 | — |
| Rate Limit Store | 1 | — |
| PKCE | 1 | — |
| JWT Rotation | 0.5 | — |
| authz context | 0.5 | — |
| OpenAPI Decorators | 1 | — |
| CI Templates | 0.5-1 | — |
| Fase 5: Benchmarks | 0.5 | Todas las features |
| Fase 5: Docs | 2 | Todas las features |
| Fase 5: Community | 0.5 | — |
| Ejemplos: Tests | 1-2 | CLI refactor (usa templates) |
| Offline Package | 2-3 | Store package |
| **Total** | **13-18** | |
