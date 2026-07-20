import type { Database, DatabaseValue } from '@kanjijs/store';
import type {
  OfflineChange,
  Conflict,
  ConflictStrategy,
  SyncResult,
} from './types.js';

const SYNC_VERSIONS_TABLE = '_sync_versions';

interface SyncVersionRow {
  resource_id: string;
  table_name: string;
  version: number;
}

export class OfflineSyncManager {
  constructor(private readonly db: Database) {}

  /**
   * Detecta conflictos entre cambios enviados por el cliente y el estado actual
   * del servidor.
   */
  async detectConflicts(changes: OfflineChange[]): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];

    for (const change of changes) {
      // 1. Buscar el recurso actual en BD
      const serverRow = await this.findCurrentRow(change.table, change.id);

      if (change.action !== 'CREATE' && !serverRow) {
        // El recurso no existe en servidor — MISSING conflict
        conflicts.push({
          type: 'MISSING',
          change,
          reason: `Resource "${change.id}" in table "${change.table}" not found on server. It may have been deleted.`,
        });
        continue;
      }

      // 2. Version check (si el cliente envió una versión)
      if (
        change.action !== 'CREATE' &&
        change.clientVersion !== undefined &&
        serverRow
      ) {
        const serverVersion = await this.getServerVersion(change.table, change.id);

        if (serverVersion !== undefined && serverVersion > change.clientVersion) {
          conflicts.push({
            type: 'VERSION_MISMATCH',
            change,
            serverVersion,
            serverData: serverRow,
            reason: `Client version ${change.clientVersion} is behind server version ${serverVersion}.`,
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Resuelve una lista de conflictos según la estrategia elegida.
   * Retorna los cambios limpios (sin conflictos) para aplicar.
   */
  async resolveConflicts(
    conflicts: Conflict[],
    strategy: ConflictStrategy,
  ): Promise<{ resolved: OfflineChange[]; rejected: Conflict[] }> {
    if (strategy === 'reject') {
      return { resolved: [], rejected: conflicts };
    }

    if (strategy === 'server-wins') {
      // Descartar cambios del cliente — no se aplica nada
      return { resolved: [], rejected: conflicts };
    }

    if (strategy === 'client-wins') {
      // Forzar cambios del cliente ignorando el estado del servidor
      return {
        resolved: conflicts.map((c) => c.change),
        rejected: [],
      };
    }

    if (strategy === 'last-write-wins') {
      const resolved: OfflineChange[] = [];
      const rejected: Conflict[] = [];

      for (const conflict of conflicts) {
        if (conflict.serverData && conflict.serverData.updatedAt) {
          const serverTime = new Date(
            conflict.serverData.updatedAt as string,
          ).getTime();
          if (serverTime > conflict.change.clientTimestamp) {
            // Servidor tiene el cambio más reciente — descartar cliente
            rejected.push(conflict);
          } else {
            // Cliente tiene el cambio más reciente — forzar
            resolved.push(conflict.change);
          }
        } else {
          // No hay timestamp para comparar — gana cliente (default)
          resolved.push(conflict.change);
        }
      }

      return { resolved, rejected };
    }

    return { resolved: [], rejected: conflicts };
  }

  /**
   * Aplica un lote de cambios de forma atómica (transaccional).
   */
  async applySyncChanges(changes: OfflineChange[]): Promise<SyncResult> {
    const synced: Array<{ id: string; status: 'ok' | 'conflict' }> = [];
    const errors: Array<{ id: string; error: string }> = [];

    // Verificar conflictos antes de aplicar
    const conflicts = await this.detectConflicts(changes);
    if (conflicts.length > 0) {
      return {
        synced: [],
        conflicts,
        errors: [],
      };
    }

    try {
      await this.db.transaction(async (trx: Database) => {
        for (const change of changes) {
          try {
            await this.applyOne(trx, change);
            synced.push({ id: change.id, status: 'ok' });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            errors.push({ id: change.id, error: message });
            // Rollback implícito: la transacción lanza error, todo se revierte
            throw new Error(
              `Batch sync failed at change "${change.id}": ${message}`,
            );
          }
        }
      });
    } catch (err) {
      // Si la transacción falló, todos los cambios que marcamos como 'ok'
      // en realidad no se aplicaron — los limpiamos y reportamos errores
      synced.length = 0;
      if (errors.length === 0) {
        const message = err instanceof Error ? err.message : String(err);
        for (const change of changes) {
          errors.push({ id: change.id, error: message });
        }
      }
      return { synced, conflicts: [], errors };
    }

    return { synced, conflicts: [], errors };
  }

  /**
   * Flujo completo: detecta conflictos, resuelve según estrategia, aplica.
   */
  async sync(
    changes: OfflineChange[],
    strategy: ConflictStrategy = 'last-write-wins',
  ): Promise<SyncResult> {
    const conflicts = await this.detectConflicts(changes);

    if (conflicts.length === 0) {
      return this.applySyncChanges(changes);
    }

    const { resolved, rejected } = await this.resolveConflicts(
      conflicts,
      strategy,
    );

    // Si hay cambios rechazados y no hay cambios resueltos, devolver conflictos
    if (resolved.length === 0) {
      return {
        synced: [],
        conflicts: rejected,
        errors: [],
      };
    }

    // Aplicar solo los cambios resueltos
    const result = await this.applySyncChanges(resolved);

    // Agregar conflictos rechazados al resultado
    return {
      synced: result.synced,
      conflicts: [...rejected, ...result.conflicts],
      errors: result.errors,
    };
  }

  // ─── private ──────────────────────────────────────────────

  private async findCurrentRow(
    table: string,
    id: string,
  ): Promise<Record<string, DatabaseValue> | null> {
    try {
      const rows = await this.db.query[table]
        .where({ id })
        .limit(1);
      return rows.length > 0 ? (rows[0] as Record<string, DatabaseValue>) : null;
    } catch {
      return null;
    }
  }

  private async getServerVersion(
    table: string,
    resourceId: string,
  ): Promise<number | undefined> {
    try {
      const rows = await this.db.query[SYNC_VERSIONS_TABLE]
        .where({ resource_id: resourceId, table_name: table })
        .limit(1);
      if (rows.length > 0) {
        return (rows[0] as SyncVersionRow).version;
      }
      return undefined;
    } catch {
      return undefined;
    }
  }

  private async applyOne(
    trx: Database,
    change: OfflineChange,
  ): Promise<void> {
    switch (change.action) {
      case 'CREATE':
        await trx.query[change.table].insert(change.data!);
        break;

      case 'UPDATE':
        await trx.query[change.table]
          .update(change.data!)
          .where({ id: change.id });
        break;

      case 'DELETE':
        await trx.query[change.table]
          .delete()
          .where({ id: change.id });
        break;
    }

    // Actualizar o insertar versión de sync
    await this.upsertSyncVersion(trx, change.table, change.id);
  }

  private async upsertSyncVersion(
    trx: Database,
    table: string,
    resourceId: string,
  ): Promise<void> {
    const existing = await trx.query[SYNC_VERSIONS_TABLE]
      .where({ resource_id: resourceId, table_name: table })
      .limit(1);

    if (existing.length > 0) {
      await trx.query[SYNC_VERSIONS_TABLE]
        .update({ version: (existing[0] as SyncVersionRow).version + 1 })
        .where({ resource_id: resourceId, table_name: table });
    } else {
      await trx.query[SYNC_VERSIONS_TABLE].insert({
        resource_id: resourceId,
        table_name: table,
        version: 1,
      });
    }
  }
}
