import type { MiddlewareHandler } from 'hono';
import { TooManyRequestsError } from '@kanjijs/common';
import type { RateLimitOptions } from '../decorators/rate-limit.js';
import type { RateLimitStore } from '../types.js';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export class MemoryStore implements RateLimitStore {
  private cache = new Map<string, RateLimitEntry>();
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor() {
    const CLEANUP_INTERVAL_MS = 60000; // 1 minuto
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.cache.entries()) {
        if (entry.resetAt <= now) {
          this.cache.delete(key);
        }
      }
    }, CLEANUP_INTERVAL_MS);

    if (typeof this.cleanupTimer.unref === 'function') {
      this.cleanupTimer.unref();
    }
  }

  async increment(key: string, windowMs: number): Promise<{ count: number; resetTime: number }> {
    const now = Date.now();
    let entry = this.cache.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = {
        count: 0,
        resetAt: now + windowMs,
      };
    }

    entry.count++;
    this.cache.set(key, entry);

    return {
      count: entry.count,
      resetTime: entry.resetAt,
    };
  }

  clear(): void {
    this.cache.clear();
  }

  // Helper method for testing/introspection
  getEntry(key: string): RateLimitEntry | undefined {
    return this.cache.get(key);
  }
}

export const defaultMemoryStore = new MemoryStore();
export const _rateLimitStore = defaultMemoryStore;

export function parseWindow(window: string | number): number {
  if (typeof window === 'number') {
    return window;
  }
  const match = window.match(/^(\d+)(ms|s|m|h|d)$/);
  if (!match) {
    throw new Error(`Formato de ventana de rate limit inválido: ${window}`);
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 'ms':
      return value;
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      return value;
  }
}

/**
 * Crea un middleware de Hono para limitar la tasa de solicitudes de un endpoint.
 */
export function createRateLimitMiddleware(
  options: RateLimitOptions,
  routeKey: string,
  globalStore?: RateLimitStore,
): MiddlewareHandler {
  const windowMs = parseWindow(options.window);
  const store = options.store || globalStore || defaultMemoryStore;

  return async (c, next) => {
    let clientKey = '';

    if (options.by === 'ip') {
      const forwardedFor = c.req.header('x-forwarded-for');
      const realIp = c.req.header('x-real-ip');
      const env = c.env as Record<string, unknown> | undefined;
      const incoming = env?.incoming as Record<string, unknown> | undefined;
      const socket = incoming?.socket as Record<string, unknown> | undefined;
      const remoteAddr = socket?.remoteAddress as string | undefined;
      clientKey = forwardedFor || realIp || remoteAddr || 'ip:unknown';
    } else if (options.by === 'user') {
      const user = c.get('kanji.auth.user') as { id?: string } | undefined;
      const principal = c.get('kanji.auth.principal') as { id?: string } | undefined;
      clientKey = user?.id || principal?.id || 'user:anonymous';
    } else {
      clientKey = 'global';
    }

    const key = `rate-limit:${routeKey}:${clientKey}`;
    const now = Date.now();
    const result = await store.increment(key, windowMs);

    const remaining = Math.max(0, options.limit - result.count);
    const resetSeconds = Math.ceil((result.resetTime - now) / 1000);

    c.header('X-RateLimit-Limit', String(options.limit));
    c.header('X-RateLimit-Remaining', String(remaining));
    c.header('X-RateLimit-Reset', String(resetSeconds));

    if (result.count > options.limit) {
      throw new TooManyRequestsError(
        'Límite de solicitudes excedido. Por favor intente más tarde.',
      );
    }

    await next();
  };
}
