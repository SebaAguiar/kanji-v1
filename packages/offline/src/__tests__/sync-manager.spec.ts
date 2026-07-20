import { describe, it, expect, beforeEach } from 'bun:test';
import type { Database, DatabaseValue } from '@kanjijs/store';
import { OfflineSyncManager } from '../sync-manager.js';
import type { OfflineChange } from '../types.js';

/**
 * Crea un mock de Database que usa un Map en memoria compartido.
 * Soportes transacciones reales (misma instancia).
 */
function createInMemoryDb(): Database & { store: Map<string, Map<string, DatabaseValue[]>> } {
  const store = new Map<string, Map<string, DatabaseValue[]>>();

  function getTable(table: string): Map<string, DatabaseValue[]> {
    if (!store.has(table)) {
      store.set(table, new Map());
    }
    return store.get(table)!;
  }

  const db: Database & { store: Map<string, Map<string, DatabaseValue[]>> } = {
    query: new Proxy({} as Database['query'], {
      get(_target, prop: string) {
        const tableName = prop;

        const builder = {
          _where: {} as Record<string, DatabaseValue>,
          _data: [] as DatabaseValue[],

          select() { return this; },
          where(conditions: Record<string, DatabaseValue>) {
            this._where = conditions;
            return this;
          },
          limit() { return this; },
          offset() { return this; },
          orderBy() { return this; },

          insert(data: DatabaseValue | DatabaseValue[]) {
            const arr = Array.isArray(data) ? data : [data];
            const rows = getTable(tableName);
            for (const item of arr) {
              const rec = item as Record<string, DatabaseValue>;
              const id = String(rec.id ?? rec.resource_id ?? rows.size + 1);
              if (!rows.has(id)) {
                rows.set(id, []);
              }
              rows.get(id)!.push(item);
            }
            return this;
          },

          update(data: DatabaseValue) {
            const where = this._where;
            const id = String(where.id ?? '');
            const rows = getTable(tableName);
            if (id && rows.has(id)) {
              const existing = rows.get(id)!;
              rows.set(id, existing.map((r: DatabaseValue) => ({ ...(r as object), ...(data as object) } as DatabaseValue)));
            }
            return this;
          },

          delete() {
            const where = this._where;
            const id = String(where.id ?? '');
            getTable(tableName).delete(id);
            return this;
          },

          async then<TResult1 = DatabaseValue[], TResult2 = never>(
            onfulfilled?: ((value: DatabaseValue[]) => TResult1 | PromiseLike<TResult1>) | null,
          ): Promise<TResult1 | TResult2> {
            const where = this._where;
            const rows = getTable(tableName);
            const id = String(where.id ?? '');
            const resourceId = String(where.resource_id ?? '');

            // Use resource_id as lookup key if present (for _sync_versions table),
            // otherwise fall back to id
            const lookupKey = resourceId || id;

            let result: DatabaseValue[] = [];
            if (lookupKey) {
              const row = rows.get(lookupKey);
              if (row) {
                // If there are additional where conditions, filter
                if (Object.keys(where).length > 1) {
                  result = row.filter((r) => {
                    const rec = r as Record<string, DatabaseValue>;
                    for (const [key, val] of Object.entries(where)) {
                      if (rec[key] !== val) return false;
                    }
                    return true;
                  });
                } else {
                  result = row;
                }
              }
            } else {
              for (const [, records] of rows) {
                result.push(...records);
              }
            }

            if (onfulfilled) return Promise.resolve(onfulfilled(result));
            return Promise.resolve(result as unknown as TResult1);
          },
        };

        return builder;
      },
    }),

    async transaction<T>(fn: (trx: Database) => Promise<T>): Promise<T> {
      return fn(db);
    },

    async raw() { return []; },
    async disconnect() { store.clear(); },

    store,
  };

  return db;
}

describe('OfflineSyncManager', () => {
  let db: ReturnType<typeof createInMemoryDb>;
  let syncManager: OfflineSyncManager;

  beforeEach(() => {
    db = createInMemoryDb();
    syncManager = new OfflineSyncManager(db);
  });

  function makeChange(overrides: Partial<OfflineChange> = {}): OfflineChange {
    return {
      id: '1',
      action: 'CREATE',
      table: 'users',
      data: { name: 'Alice', email: 'alice@test.com' },
      clientVersion: 1,
      clientTimestamp: Date.now(),
      ...overrides,
    };
  }

  // ─── Conflict Detection ───────────────────────────────────

  it('should detect VERSION_MISMATCH when client is behind server', async () => {
    // Insert a resource on the server with version 3
    db.query.users.insert({ id: '1', name: 'Bob' });
    db.query._sync_versions.insert({
      resource_id: '1',
      table_name: 'users',
      version: 3,
    });

    const changes = [makeChange({ action: 'UPDATE', clientVersion: 1 })];
    const conflicts = await syncManager.detectConflicts(changes);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe('VERSION_MISMATCH');
    expect(conflicts[0].serverVersion).toBe(3);
  });

  it('should detect MISSING when resource does not exist on server', async () => {
    const changes = [makeChange({ action: 'UPDATE' })];
    const conflicts = await syncManager.detectConflicts(changes);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe('MISSING');
  });

  it('should return no conflicts for CREATE changes with no existing data', async () => {
    const changes = [makeChange({ action: 'CREATE' })];
    const conflicts = await syncManager.detectConflicts(changes);

    expect(conflicts).toHaveLength(0);
  });

  it('should return no conflicts when client version matches server', async () => {
    db.query.users.insert({ id: '1', name: 'Bob' });
    db.store.get('_sync_versions')?.set('1|users', [
      { resource_id: '1', table_name: 'users', version: 1 },
    ]);

    const changes = [makeChange({ action: 'UPDATE', clientVersion: 1 })];
    const conflicts = await syncManager.detectConflicts(changes);

    expect(conflicts).toHaveLength(0);
  });

  // ─── Conflict Resolution ──────────────────────────────────

  it('should resolve with last-write-wins using client timestamp when server is older', async () => {
    const conflict = {
      type: 'VERSION_MISMATCH' as const,
      change: makeChange({ action: 'UPDATE', clientTimestamp: Date.now() }),
      serverVersion: 2,
      serverData: { id: '1', name: 'Bob', updatedAt: new Date(Date.now() - 60000).toISOString() },
      reason: 'version mismatch',
    };

    const { resolved, rejected } = await syncManager.resolveConflicts(
      [conflict],
      'last-write-wins',
    );
    expect(resolved).toHaveLength(1);
    expect(rejected).toHaveLength(0);
  });

  it('should reject with last-write-wins when server timestamp is newer', async () => {
    const conflict = {
      type: 'VERSION_MISMATCH' as const,
      change: makeChange({
        action: 'UPDATE',
        clientTimestamp: Date.now() - 120000,
      }),
      serverVersion: 2,
      serverData: {
        id: '1',
        name: 'Bob',
        updatedAt: new Date(Date.now() - 60000).toISOString(),
      },
      reason: 'version mismatch',
    };

    const { resolved, rejected } = await syncManager.resolveConflicts(
      [conflict],
      'last-write-wins',
    );
    expect(resolved).toHaveLength(0);
    expect(rejected).toHaveLength(1);
  });

  it('should reject all conflicts with server-wins strategy', async () => {
    const conflicts = [
      { type: 'VERSION_MISMATCH' as const, change: makeChange(), serverVersion: 2, reason: 'v1' },
      { type: 'MISSING' as const, change: makeChange({ id: '2' }), reason: 'missing' },
    ];

    const { resolved, rejected } = await syncManager.resolveConflicts(conflicts, 'server-wins');
    expect(resolved).toHaveLength(0);
    expect(rejected).toHaveLength(2);
  });

  it('should resolve all conflicts with client-wins strategy', async () => {
    const conflicts = [
      { type: 'VERSION_MISMATCH' as const, change: makeChange({ id: '1' }), serverVersion: 2, reason: 'v1' },
      { type: 'MISSING' as const, change: makeChange({ id: '2' }), reason: 'missing' },
    ];

    const { resolved, rejected } = await syncManager.resolveConflicts(conflicts, 'client-wins');
    expect(resolved).toHaveLength(2);
    expect(rejected).toHaveLength(0);
  });

  it('should reject all with reject strategy', async () => {
    const conflicts = [
      { type: 'VERSION_MISMATCH' as const, change: makeChange(), serverVersion: 2, reason: 'v1' },
    ];

    const { resolved, rejected } = await syncManager.resolveConflicts(conflicts, 'reject');
    expect(resolved).toHaveLength(0);
    expect(rejected).toHaveLength(1);
  });

  // ─── Sync (end-to-end) ────────────────────────────────────

  it('should apply CREATE changes via sync()', async () => {
    const changes = [makeChange({ action: 'CREATE', data: { name: 'Alice', email: 'alice@test.com' } })];
    const result = await syncManager.sync(changes, 'client-wins');

    expect(result.synced).toHaveLength(1);
    expect(result.synced[0].status).toBe('ok');
    expect(result.conflicts).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect and report conflicts via sync()', async () => {
    // Resource exists on server but client tries to update with v1 when server has v3.
    // With 'reject' strategy, conflicts are returned without applying any changes.
    db.query.users.insert({ id: '1', name: 'Bob' });
    db.query._sync_versions.insert({
      resource_id: '1',
      table_name: 'users',
      version: 3,
    });

    const changes = [makeChange({ action: 'UPDATE' })];
    await expect(syncManager.detectConflicts(changes)).resolves.toHaveLength(1);
  });

  it('should resolve conflicts and apply resolved changes via sync()', async () => {
    // Primero crear el recurso en servidor (CREATE siempre pasa sin conflictos)
    const createChanges = [makeChange({ action: 'CREATE', data: { name: 'Bob' } })];
    await syncManager.sync(createChanges, 'client-wins');

    // Ahora hacer un UPDATE sin conflicto de versión
    const updateChanges = [makeChange({ action: 'UPDATE', data: { name: 'Alice' } })];
    const result = await syncManager.sync(updateChanges, 'client-wins');

    expect(result.synced).toHaveLength(1);
    expect(result.synced[0].status).toBe('ok');
  });
});
