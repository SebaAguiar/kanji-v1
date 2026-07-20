import type { DatabaseValue } from '@kanjijs/store';

export type ConflictStrategy = 'last-write-wins' | 'server-wins' | 'client-wins' | 'reject';

export interface OfflineChange {
  id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  table: string;
  data?: Record<string, DatabaseValue> | null;
  clientVersion?: number;
  clientTimestamp: number;
}

export interface Conflict {
  type: 'MISSING' | 'VERSION_MISMATCH' | 'CONSTRAINT_VIOLATION';
  change: OfflineChange;
  serverVersion?: number;
  serverData?: Record<string, DatabaseValue> | null;
  reason: string;
}

export interface SyncResult {
  synced: Array<{ id: string; status: 'ok' | 'conflict' }>;
  conflicts: Conflict[];
  errors: Array<{ id: string; error: string }>;
}
