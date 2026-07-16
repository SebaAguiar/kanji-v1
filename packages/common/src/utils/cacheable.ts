import 'reflect-metadata';

export interface CacheableOptions {
  ttl: number; // TTL en segundos
  key?: (...args: readonly never[]) => string;
}

interface CacheEntry<T = unknown> {
  value: T;
  expiresAt: number;
}

// Almacenamiento en caché en memoria
const cacheStore = new Map<string, CacheEntry>();

// Cleanup periódico para evitar memory leaks
const CLEANUP_INTERVAL_MS = 60000; // 1 minuto
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cacheStore.entries()) {
    if (entry.expiresAt <= now) {
      cacheStore.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS);

// Permitir que el proceso de Bun termine de manera limpia sin esperar a que finalice el timer
if (typeof cleanupTimer.unref === 'function') {
  cleanupTimer.unref();
}

/**
 * Decorador para cachear el retorno de un método.
 * Evita ejecuciones duplicadas de computaciones pesadas o consultas repetidas a la base de datos.
 */
export function Cacheable(options: CacheableOptions): MethodDecorator {
  return <T>(
    target: object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<T>,
  ): TypedPropertyDescriptor<T> | void => {
    const originalMethod = descriptor.value;
    if (typeof originalMethod !== 'function') {
      throw new Error('@Cacheable solo se puede aplicar a métodos de clase.');
    }

    descriptor.value = function (this: unknown, ...args: never[]) {
      // Si el TTL es menor o igual a 0, ejecutar el método original sin pasar por la caché
      if (options.ttl <= 0) {
        return originalMethod.apply(this, args);
      }

      // Generar clave única para el método
      const cacheKey = options.key
        ? options.key.apply(this, args)
        : `${target.constructor.name}:${String(propertyKey)}:${JSON.stringify(args)}`;

      const now = Date.now();
      const cached = cacheStore.get(cacheKey);

      if (cached && cached.expiresAt > now) {
        return cached.value;
      }

      const result = originalMethod.apply(this, args);

      if (result instanceof Promise) {
        return result.then((resolvedValue) => {
          cacheStore.set(cacheKey, {
            value: resolvedValue,
            expiresAt: Date.now() + options.ttl * 1000,
          });
          return resolvedValue;
        });
      }

      cacheStore.set(cacheKey, {
        value: result,
        expiresAt: Date.now() + options.ttl * 1000,
      });

      return result;
    } as unknown as T;
  };
}

// Exportar store para propósitos de testing si es necesario
export const _cacheStore = cacheStore;
