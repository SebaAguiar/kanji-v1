import type { MiddlewareHandler } from 'hono';
import { TooManyRequestsError } from '@kanjijs/common';
import type { RateLimitOptions } from '../decorators/rate-limit.js';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export const _rateLimitStore = new Map<string, RateLimitEntry>();

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

// Cleanup periódico para evitar memory leaks
const CLEANUP_INTERVAL_MS = 60000; // 1 minuto
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of _rateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      _rateLimitStore.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS);

// Permitir que el proceso de Bun termine de manera limpia sin esperar a que finalice el timer
if (typeof cleanupTimer.unref === 'function') {
  cleanupTimer.unref();
}

/**
 * Crea un middleware de Hono para limitar la tasa de solicitudes de un endpoint.
 */
export function createRateLimitMiddleware(
  options: RateLimitOptions,
  routeKey: string,
): MiddlewareHandler {
  const windowMs = parseWindow(options.window);

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
    let entry = _rateLimitStore.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = {
        count: 0,
        resetAt: now + windowMs,
      };
    }

    entry.count++;
    _rateLimitStore.set(key, entry);

    const remaining = Math.max(0, options.limit - entry.count);
    const resetSeconds = Math.ceil((entry.resetAt - now) / 1000);

    c.header('X-RateLimit-Limit', String(options.limit));
    c.header('X-RateLimit-Remaining', String(remaining));
    c.header('X-RateLimit-Reset', String(resetSeconds));

    if (entry.count > options.limit) {
      throw new TooManyRequestsError(
        'Límite de solicitudes excedido. Por favor intente más tarde.',
      );
    }

    await next();
  };
}
