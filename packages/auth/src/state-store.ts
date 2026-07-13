interface StateEntry {
  provider: string;
  redirectUri: string;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes

export class StateStore {
  private store = new Map<string, StateEntry>();
  private readonly ttlMs: number;

  constructor(ttlMs: number = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  public generate(provider: string, redirectUri: string): string {
    const state = crypto.randomUUID();
    this.store.set(state, {
      provider,
      redirectUri,
      expiresAt: Date.now() + this.ttlMs,
    });
    this.evictExpired();
    return state;
  }

  public verify(state: string): StateEntry | null {
    const entry = this.store.get(state);
    if (!entry) return null;
    this.store.delete(state); // consume — single use
    if (Date.now() > entry.expiresAt) return null;
    return entry;
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }
}
