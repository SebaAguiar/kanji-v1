# Test Coverage — Round 2

> Continuación del plan anterior. Objetivo: cubrir contracts, openapi, store,
> testing, y adapter de platform-hono.

---

## WI1: contracts

### Archivos: `validator.spec.ts` (existe), `errors.spec.ts` (nuevo)

**validator.spec.ts** — agregar al final:

```
- ZodValidator.validate() con body válido → setea kanji.validated.body, llama next
- ZodValidator.validate() con body inválido → responde 400 con issues
- ZodValidator.validate() sin body en contract → no valida, llama next directo
```

**errors.spec.ts** — nuevo:

```
- formatZodIssues() con issues simples → devuelve { error, issues[] }
- formatZodIssues() con issues anidados (path con dots) → issues con path "a.b.c"
- formatZodIssues() con issues vacío → issues vacío
```

Total: **+6 tests**

---

## WI2: openapi

### Archivo: `openapi.controller.spec.ts` (nuevo)

```
- OpenApiController responde GET /api/openapi.json → JSON con openapi, info, paths
- OpenApiController responde GET /api/docs → HTML con Swagger UI
- OpenApiController responde GET /api/docs/redoc → HTML con ReDoc
```

Dependencias: instanciar `new OpenApiController(config)` directamente.
No requiere DI completo.

Total: **+3 tests**

---

## WI3: store

### Archivo: `store-module.spec.ts` (nuevo)

```
- StoreModule.forRoot({ type: 'postgres', ... }) → DynamicModule con module, global, providers, exports
- StoreModule.forRoot({ type: 'mongodb', ... }) → DynamicModule válido
```

Total: **+2 tests**

---

## WI4: testing

### Archivo: `fixtures.spec.ts` (nuevo)

```
- FixtureSet.register() + get() → devuelve instancia de la factory
- FixtureSet.get() sin registrar → lanza error
- FixtureSet.get() cachea la instancia (segunda llamada no re-ejecuta factory)
```

Total: **+3 tests**

---

## WI5: platform-hono adapter

### Archivo: `adapter.spec.ts` (existe) — agregar al final

```
- KanjijsAdapter.create() con logger: true → devuelve { app, container, serve, shutdown }
- KanjijsAdapter.create() con cors: true → CORS habilitado en OPTIONS
```

Total: **+2 tests**

---

## Resumen

| WI | Package | Archivos | Tests nuevos |
|----|---------|----------|-------------|
| 1 | contracts | 2 | 6 |
| 2 | openapi | 1 | 3 |
| 3 | store | 1 | 2 |
| 4 | testing | 1 | 3 |
| 5 | platform-hono | 1 | 2 |
| **Total** | **5** | **6** | **16** |

Cada WI se verifica con `cd packages/<name> && bun test`. Sin regresiones.
