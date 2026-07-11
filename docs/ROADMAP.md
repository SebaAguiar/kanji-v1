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
