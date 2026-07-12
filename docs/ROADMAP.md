# Feature Roadmap & Future Proposals

Este documento recopila las propuestas de diseño y especificaciones para futuras características y extensiones del Kanji Framework.

---

# Offline-First Sync Support (Optional)

## Propuesta

Agregar soporte nativo para **sincronización offline-first** en Kanji mediante utilidades helper en un nuevo paquete `@kanjijs/offline`.

---

## ¿Qué Es?

Para aplicaciones que funcionan offline (mobile, PWA, Electron) y sincronizan cambios cuando recuperan conexión:

```
Cliente (Offline-First)           Kanji (Backend)
  ↓                                  ↓
  SQLite/IndexedDB local             POST /sync
  ↓                                  ↓
  Cambios pendientes                 Recibe batch de cambios
  ↓                                  ↓
  Conecta a internet                 Detecta conflictos
  ↓                                  ↓
  Envía cambios                      Resuelve conflictos
  ↓                                  ↓
  Recibe estado sincronizado         Aplica cambios (transaccional)
```

---

## Funcionalidad

### Core: `OfflineSyncManager`

```typescript
import { OfflineSyncManager } from '@kanjijs/offline';

@Injectable()
export class SyncService {
  private syncManager: OfflineSyncManager;

  constructor(@Inject(DATABASE_CLIENT) private db: Database) {
    this.syncManager = new OfflineSyncManager(db);
  }

  async syncOfflineChanges(
    changes: OfflineChange[],
    strategy: 'last-write-wins' | 'server-wins' | 'client-wins' | 'reject'
  ) {
    return this.syncManager.sync(changes, strategy);
  }
}

@Post('/sync')
@Contract(SyncContracts.syncOfflineChanges)
async syncOfflineChanges(c: Context) {
  const changes = c.get('kanji.validated.body');
  const result = await this.syncService.syncOfflineChanges(changes, 'last-write-wins');
  return c.json(result, 200);
}
```

### Características del MVP

- ✅ **Conflict Detection**: Detecta versión mismatch, recursos faltantes, etc
- ✅ **Conflict Resolution**: 3 estrategias built-in + soporte para custom
- ✅ **Atomic Apply**: Usa transacciones de BD para consistencia
- ✅ **Type-Safe**: Contratos Zod para request/response
- ✅ **Transactional**: Todo-o-nada — si algo falla, se revierte todo

---

## Tipos Principales

```typescript
export type ConflictStrategy = 
  | 'last-write-wins'   // Cambio más reciente gana
  | 'server-wins'       // Servidor siempre gana (descartar cliente)
  | 'client-wins'       // Cliente siempre gana (sobrescribir)
  | 'reject';           // Rechazar y reportar conflicto

export interface OfflineChange {
  id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  table: string;        // Tabla en BD donde se aplica
  data?: any;           // Datos (null para DELETE)
  clientVersion?: number;  // Versión que el cliente vio
  clientTimestamp: number; // Cuándo se hizo localmente
}

export interface Conflict {
  type: 'MISSING' | 'VERSION_MISMATCH' | 'CONSTRAINT_VIOLATION';
  change: OfflineChange;
  serverVersion?: any;
  reason: string;
}

export interface SyncResult {
  synced: Array<{ id: string; status: 'ok' | 'conflict' }>;
  conflicts: Conflict[];
  errors: Array<{ id: string; error: string }>;
}
```

---

## Implementación

### Paso 1: Crear `@kanjijs/offline`

```typescript
// packages/offline/src/index.ts
export { OfflineSyncManager } from './sync-manager';
export type { OfflineChange, Conflict, ConflictStrategy, SyncResult } from './types';

// packages/offline/src/sync-manager.ts
export class OfflineSyncManager {
  constructor(private db: Database) {}
  
  async detectConflicts(changes: OfflineChange[]): Promise<Conflict[]> { ... }
  async resolveConflicts(conflicts: Conflict[], strategy: ConflictStrategy): Promise<OfflineChange[]> { ... }
  async applySyncChanges(changes: OfflineChange[]): Promise<SyncResult> { ... }
  async sync(changes: OfflineChange[], strategy: ConflictStrategy): Promise<SyncResult> { ... }
}
```

### Paso 2: Contratos Type-Safe

```typescript
// En la app del dev
export const SyncContracts = {
  syncOfflineChanges: {
    method: 'POST' as const,
    path: '/sync' as const,
    request: {
      body: z.array(z.object({
        id: z.string(),
        action: z.enum(['CREATE', 'UPDATE', 'DELETE']),
        table: z.string(),
        data: z.any().optional(),
        clientVersion: z.number().optional(),
        clientTimestamp: z.number(),
      })),
    },
    responses: {
      200: z.object({
        synced: z.array(z.object({
          id: z.string(),
          status: z.enum(['ok', 'conflict']),
        })),
        conflicts: z.array(z.any()),
        errors: z.array(z.any()),
      }),
    },
  },
};
```

### Paso 3: Tests

```typescript
describe('OfflineSyncManager', () => {
  it('should detect version mismatch conflicts', async () => {
    const changes = [
      {
        id: '1',
        action: 'UPDATE',
        table: 'users',
        data: { name: 'Alice' },
        clientVersion: 1,  // Cliente vio v1
        clientTimestamp: Date.now() - 1000,
      },
    ];
    
    // Pero en servidor hay v3
    const conflicts = await syncManager.detectConflicts(changes);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe('VERSION_MISMATCH');
  });

  it('should apply changes atomically', async () => {
    const changes = [
      { id: '1', action: 'UPDATE', table: 'users', data: {...} },
      { id: '2', action: 'DELETE', table: 'posts', data: null },
      { id: '3', action: 'CREATE', table: 'comments', data: {...} },
    ];
    
    const result = await syncManager.sync(changes, 'last-write-wins');
    expect(result.synced).toHaveLength(3);
  });
});
```

---

## Roadmap

### MVP (v1.0) — 2-3 days
- [ ] Crear `packages/offline/`
- [ ] Implementar `OfflineSyncManager`
- [ ] Detectar conflictos (MISSING, VERSION_MISMATCH)
- [ ] Resolver conflictos (3 estrategias)
- [ ] Aplicar cambios atómicamente
- [ ] Tests unitarios
- [ ] Documentación + ejemplo

### v1.1 — Future
- [ ] Custom conflict resolver (callback)
- [ ] Soft deletes (marcar como `deletedAt`)
- [ ] Audit log (quién, cuándo, qué)
- [ ] Retry logic para cambios fallidos

### v1.2+ — Future
- [ ] Delta sync (solo cambios, no todo)
- [ ] Compression para payloads grandes
- [ ] Real-time notifications (WebSocket)
- [ ] Multi-user conflict merge

---

## ¿Cuándo Implementar?

**Prioridad**: 🔴 BAJA (nice-to-have)  
**Bloqueadores**: Ninguno — se puede hacer en paralelo a otros features  
**Dependencias**: Requiere que `@kanjijs/store` esté completo  

**Sugerencia**: Agregar al roadmap después de:
1. Contract Validation + Stack Trace
2. Authorization Framework
3. Repository Pattern + CLI

---

## ¿Por Qué Es Útil?

✅ Devs que hacen offline-first no reinventan conflict resolution  
✅ Type-safe — los cambios pasan por contratos Zod  
✅ Transaccional — consistencia garantizada  
✅ Configurable — cada app elige su estrategia  
✅ Optional — no afecta a apps que no lo usan  

---

## ¿Por Qué NO es Crítico?

❌ Kanji es **backend** — la lógica offline vive en el cliente  
❌ No es un bloqueador — los devs pueden implementarlo manualmente  
❌ Cada app tiene **reglas de conflicto distintas** — no hay one-size-fits-all  
❌ Puede agregarse después sin cambios breaking  

---

## Decisión

**Recomendación**: Agregar a la lista de pendientes con **prioridad BAJA**, para implementar después de los features críticos.

**Alternativa**: Dejarla fuera del MVP y solo considerarla si hay demanda real de usuarios.

---

# Swagger/OpenAPI Nativo + CI/CD Multi-Plataforma

## Parte 1: Swagger/OpenAPI Nativo

### Visión General

Generar **especificación OpenAPI 3.0 automáticamente** desde:
- **Contratos** (`@Contract` + Zod schemas)
- **Rutas** (`@Get`, `@Post`, etc.)
- **Autorización** (`@Authorize` + políticas)
- **Metadatos** (descripción, tags, ejemplos)

Exponer en:
- `GET /api/openapi.json` — spec crudo
- `GET /api/docs` — **Swagger UI** interactivo
- `GET /api/docs/redoc` — ReDoc (alternativa)

---

### Funcionalidad

#### Core: `OpenAPIExtractor`

```typescript
// packages/openapi/src/extractor.ts

import { OpenAPI, OpenAPIV3 } from 'openapi-types';

export class OpenAPIExtractor {
  private spec: OpenAPIV3.Document;

  constructor(info: OpenAPIV3.InfoObject) {
    this.spec = {
      openapi: '3.0.0',
      info,
      paths: {},
      components: {
        schemas: {},
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    };
  }

  /**
   * Agrega un endpoint a la especificación
   */
  addEndpoint(endpoint: EndpointMetadata): void {
    const { path, method, contract, controller, authorization, description } = endpoint;

    if (!this.spec.paths[path]) {
      this.spec.paths[path] = {};
    }

    const operation: OpenAPIV3.OperationObject = {
      summary: description || `${method} ${path}`,
      tags: [controller.name.replace('Controller', '')],
      operationId: `${method.toLowerCase()}_${path.replace(/\//g, '_')}`,
      parameters: [],
      requestBody: undefined,
      responses: {},
    };

    // Request body (si tiene)
    if (contract.request?.body) {
      operation.requestBody = {
        required: true,
        content: {
          'application/json': {
            schema: this.zodToOpenAPI(contract.request.body),
          },
        },
      };
    }

    // Query params
    if (contract.request?.query) {
      operation.parameters!.push({
        name: 'query',
        in: 'query',
        schema: this.zodToOpenAPI(contract.request.query),
      });
    }

    // Path params (inferir de la ruta)
    const pathParams = path.match(/:(w+)/g) || [];
    for (const param of pathParams) {
      const name = param.slice(1);
      operation.parameters!.push({
        name,
        in: 'path',
        required: true,
        schema: { type: 'string' },
      });
    }

    // Responses
    for (const [status, schema] of Object.entries(contract.responses)) {
      operation.responses[status] = {
        description: this.getStatusDescription(parseInt(status)),
        content: {
          'application/json': {
            schema: this.zodToOpenAPI(schema),
          },
        },
      };
    }

    // Authorization
    if (authorization) {
      operation.security = [{ bearerAuth: [] }];
    }

    this.spec.paths[path]![method.toLowerCase()] = operation;
  }

  /**
   * Convierte Zod schema a JSON Schema (OpenAPI)
   */
  private zodToOpenAPI(schema: any): OpenAPIV3.SchemaObject {
    // Implementación de transformación Zod → JSON Schema
    return {};
  }

  private getStatusDescription(status: number): string {
    const descriptions: Record<number, string> = {
      200: 'Success',
      201: 'Created',
      204: 'No Content',
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      500: 'Internal Server Error',
    };
    return descriptions[status] || 'Unknown';
  }

  getSpec(): OpenAPI.Document {
    return this.spec;
  }
}
```

#### Exponer Endpoints en Hono

```typescript
// packages/platform-hono/src/hono-adapter.ts (modificado)

import { createOpenAPIMiddleware } from './middleware/openapi.middleware';

export class KanjijsAdapter {
  public static async create(rootModule, options) {
    // ... setup existente ...

    // Crear extractor de OpenAPI
    const openAPIExtractor = createOpenAPIMiddleware(app);

    // GET /api/openapi.json - Raw spec
    app.get('/api/openapi.json', (c) => {
      return c.json(openAPIExtractor.getSpec());
    });

    // GET /api/docs - Swagger UI
    app.get('/api/docs', (c) => {
      return c.html(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>API Docs</title>
            <meta charset="utf-8"/>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@4/swagger-ui.css">
          </head>
          <body>
            <div id="swagger-ui"></div>
            <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@4/swagger-ui-bundle.js"></script>
            <script>
              window.onload = () => {
                SwaggerUIBundle({
                  url: '/api/openapi.json',
                  dom_id: '#swagger-ui',
                  deepLinking: true,
                  presets: [SwaggerUIBundle.presets.apis],
                  layout: 'BaseLayout'
                })
              }
            </script>
          </body>
        </html>
      `);
    });

    // GET /api/docs/redoc - ReDoc
    app.get('/api/docs/redoc', (c) => {
      return c.html(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>API Docs (ReDoc)</title>
            <meta charset="utf-8"/>
            <meta name="viewport" content="width=device-width, initial-scale=1">
          </head>
          <body>
            <redoc spec-url='/api/openapi.json'></redoc>
            <script src="https://cdn.jsdelivr.net/npm/redoc@next/bundles/redoc.standalone.js"></script>
          </body>
        </html>
      `);
    });
  }
}
```

#### Decoradores Opcionales

```typescript
// packages/platform-hono/src/decorators/

export function Description(text: string) {
  return function(target: any, propertyKey: string) {
    Reflect.defineMetadata('kanji:description', text, target, propertyKey);
  };
}

export function Tag(name: string) {
  return function(target: any, propertyKey: string) {
    Reflect.defineMetadata('kanji:tag', name, target, propertyKey);
  };
}

export function Example(example: any) {
  return function(target: any, propertyKey: string) {
    Reflect.defineMetadata('kanji:example', example, target, propertyKey);
  };
}

// Uso
@Post('/')
@Contract(UserContracts.create)
@Description('Create a new user with email and name')
@Tag('Users')
@Example({ email: 'john@example.com', name: 'John Doe' })
async create(c: Context) { }
```

### Output Esperado

**GET /api/docs:**
```
                        KANJI API 1.0.0
               Auto-generated from @Contract schemas

[Swagger UI interactivo]

👥 Users
  POST /users              Create a new user
  GET /users               List all users
  GET /users/{id}          Get a user by ID
  PUT /users/{id}          Update a user
  DELETE /users/{id}       Delete a user
```

**GET /api/openapi.json:**
```json
{
  "openapi": "3.0.0",
  "info": { "title": "Kanji API", "version": "1.0.0" },
  "paths": {
    "/users": {
      "post": {
        "summary": "Create a new user",
        "tags": ["Users"],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "email": { "type": "string", "format": "email" },
                  "name": { "type": "string" }
                },
                "required": ["email", "name"]
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Created",
            "content": { "application/json": { "schema": {...} } }
          }
        }
      }
    }
  }
}
```

### Configuración (kanji.config.ts)

```typescript
export default {
  openapi: {
    enabled: true,
    title: 'My Kanji API',
    version: '1.0.0',
    description: 'Auto-generated OpenAPI spec from @Contract',
    
    endpoints: {
      spec: '/api/openapi.json',
      docs: '/api/docs',
      redoc: '/api/docs/redoc',
    },

    swaggerUI: {
      theme: 'dark',
      layout: 'BaseLayout',
    },

    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },

    servers: [
      { url: 'http://localhost:3000', description: 'Local' },
      { url: 'https://api.example.com', description: 'Production' },
    ],
  },
};
```

### Roadmap OpenAPI

#### MVP (v1.0) — 2-3 days
- [ ] Crear `@kanjijs/openapi` package
- [ ] `OpenAPIExtractor` básico
- [ ] `zodToOpenAPI` converter
- [ ] Middleware en `hono-adapter`
- [ ] GET `/api/openapi.json`
- [ ] GET `/api/docs` (Swagger UI)
- [ ] Tests + documentación

#### v1.1 — Future (1-2 days)
- [ ] Decoradores `@Description`, `@Tag`, `@Example`
- [ ] GET `/api/docs/redoc` (ReDoc)
- [ ] Comando `kanji generate:openapi`
- [ ] Configuración en `kanji.config.ts`

#### v1.2+
- [ ] SDK generation (OpenAPI → TypeScript client)
- [ ] Postman collection export
- [ ] Mock server generation

### Ventajas OpenAPI

✅ Cero configuración (genera desde `@Contract`)  
✅ Siempre sincronizado (una fuente de verdad)  
✅ Type-safe (Zod → JSON Schema)  
✅ Interactivo (probar endpoints)  
✅ Estándar (OpenAPI 3.0)  

---

## Parte 2: CI/CD Multi-Plataforma

### Visión General

Kanji **NO es un proveedor de CI/CD**, pero puede:
1. **Generar pipelines automáticos** para plataformas comunes
2. **Proporcionar templates/recetas** para cada plataforma
3. **CLI helper**: `kanji init:ci` para scaffold configuración

### Plataformas Soportadas

✅ GitHub Actions  
✅ GitLab CI  
✅ Bitbucket Pipelines  
✅ CircleCI  
✅ Cualquier plataforma con YAML config  

---

### Comando: `kanji init:ci`

```bash
kanji init:ci

? Which CI platform?
  > GitHub Actions
    GitLab CI
    Bitbucket Pipelines
    CircleCI
    None (manual setup)

? Deploy target?
  > Docker (push a registry)
    Vercel
    Railway
    Heroku
    Manual

? Run tests? Yes
? Run kanji check? Yes

      CI configuration created at: .github/workflows/ci.yml
   Commit and push to trigger your first build!
```

---

### Templates

#### GitHub Actions

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install --frozen-lockfile
      - run: bun run lint
      - run: bun run build
      - run: bun run test
      - run: bun run kanji check

  integration:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install --frozen-lockfile
      - run: bun run test:integration

  deploy:
    needs: [build, integration]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install --frozen-lockfile
      - run: bun run build
      - name: Deploy
        run: |
          # Tu lógica de deploy aquí
          # ej: docker push, vercel deploy, etc
```

#### GitLab CI

```yaml
# .gitlab-ci.yml
image: oven/bun:latest

stages:
  - build
  - test
  - deploy

build:
  stage: build
  script:
    - bun install --frozen-lockfile
    - bun run build
    - bun run lint

test:unit:
  stage: test
  script:
    - bun install --frozen-lockfile
    - bun run test

test:integration:
  stage: test
  services:
    - postgres:16
  variables:
    POSTGRES_DB: test_db
    POSTGRES_PASSWORD: postgres
  script:
    - bun install --frozen-lockfile
    - bun run test:integration

kanji:check:
  stage: test
  script:
    - bun install --frozen-lockfile
    - bun run kanji check
  allow_failure: true

deploy:
  stage: deploy
  script:
    - bun install --frozen-lockfile
    - bun run build
  only:
    - main
```

#### Bitbucket Pipelines

```yaml
# bitbucket-pipelines.yml
image: oven/bun:latest

pipelines:
  default:
    - step:
        name: Build & Test
        script:
          - bun install --frozen-lockfile
          - bun run lint
          - bun run build
          - bun run test
          - bun run kanji check

  branches:
    main:
      - step:
          name: Build & Test
          script:
            - bun install --frozen-lockfile
            - bun run build
            - bun run test
      - step:
          name: Deploy
          script:
            - # Tu lógica de deploy
```

### Stages en Todos los Pipelines

```
Build → Unit Tests → Integration Tests → Kanji Check → Deploy
```

Cada pipeline includes:
- `bun run lint` — linting
- `bun run build` — compilación
- `bun run test` — tests unitarios
- `bun run test:integration` — tests de integración
- `bun run kanji check` — validación de contratos
- Deploy solo en rama `main`

### Dockerfile (Bonus)

```dockerfile
# Dockerfile
FROM oven/bun:latest AS builder

WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile
RUN bun run build

FROM oven/bun:latest

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json .
COPY --from=builder /app/bunfig.toml .

RUN bun install --production --frozen-lockfile

EXPOSE 3000
CMD ["bun", "run", "start"]
```

### Implementación: CLI Helper

```typescript
// packages/cli/src/commands/init/ci.ts

import { promises as fs } from 'fs';
import prompts from 'prompts';

export async function initCI() {
  const { platform, deployTarget, runTests, runCheck } = await prompts([
    {
      type: 'select',
      name: 'platform',
      message: 'Which CI platform?',
      choices: [
        { title: 'GitHub Actions', value: 'github-actions' },
        { title: 'GitLab CI', value: 'gitlab-ci' },
        { title: 'Bitbucket Pipelines', value: 'bitbucket' },
        { title: 'CircleCI', value: 'circleci' },
        { title: 'None (manual setup)', value: 'none' },
      ],
    },
    {
      type: 'select',
      name: 'deployTarget',
      message: 'Deploy target?',
      choices: [
        { title: 'Docker', value: 'docker' },
        { title: 'Vercel', value: 'vercel' },
        { title: 'Railway', value: 'railway' },
        { title: 'Manual', value: 'manual' },
      ],
    },
    {
      type: 'confirm',
      name: 'runTests',
      message: 'Run tests in CI?',
      initial: true,
    },
    {
      type: 'confirm',
      name: 'runCheck',
      message: 'Run kanji check?',
      initial: true,
    },
  ]);

  if (platform === 'none') {
    console.log('No CI configuration generated. Set up manually.');
    return;
  }

  const template = await loadTemplate(`ci/${platform}.yml.hbs`);
  const context = { deployTarget, runTests, runCheck };
  const config = Handlebars.compile(template)(context);

  const outputPath = getOutputPath(platform);
  await fs.mkdir(require('path').dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, config);

  console.log(`✅ CI configuration created at: ${outputPath}`);
  console.log(`   Commit and push to trigger your first build!`);
}

function getOutputPath(platform: string): string {
  const paths: Record<string, string> = {
    'github-actions': '.github/workflows/ci.yml',
    'gitlab-ci': '.gitlab-ci.yml',
    'bitbucket': 'bitbucket-pipelines.yml',
    'circleci': '.circleci/config.yml',
  };
  return paths[platform] || 'ci.yml';
}
```

### Roadmap CI/CD

#### MVP (v1.0) — 1-2 days
- [ ] Crear templates en `packages/cli/templates/ci/`
  - [ ] GitHub Actions
  - [ ] GitLab CI
  - [ ] Bitbucket Pipelines
- [ ] Comando `kanji init:ci` interactivo
- [ ] Documentación

#### v1.1 — Future
- [ ] CircleCI template
- [ ] Dockerfile scaffold
- [ ] Secrets management guide
- [ ] Multi-region deploy helpers

#### v1.2+
- [ ] Automated versioning (semantic release)
- [ ] Dependency scanning
- [ ] Performance benchmarking
- [ ] E2E test integration

### Ventajas CI/CD

✅ Multi-platform support (not only GitHub)  
✅ Automatic scaffold (not manual)  
✅ Includes Kanji validation checks (`kanji check`)  
✅ Clear stages (build → test → deploy)  
✅ Easy to customize  

---

## Resumen

### OpenAPI
- **Prioridad**: 🟢 ALTA (essential DX)
- **Tiempo**: 2-3 days (MVP)
- **Complejidad**: Media
- **Beneficio**: Documentación automática + Swagger UI interactivo

### CI/CD
- **Prioridad**: 🟡 MEDIA (nice-to-have, pero útil)
- **Tiempo**: 1-2 days (MVP)
- **Complejidad**: Baja
- **Beneficio**: Onboarding rápido + multi-plataforma

### Implementación Recomendada

1. **OpenAPI primero** (es más impactante en DX)
2. **CI/CD después** (es scaffold + templates)

Ambos pueden hacerse en paralelo si el tiempo lo permite.
