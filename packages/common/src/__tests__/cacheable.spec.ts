import { describe, it, expect, beforeEach } from 'bun:test';
import { Cacheable, _cacheStore } from '../utils/cacheable.js';

describe('@Cacheable', () => {
  beforeEach(() => {
    _cacheStore.clear();
  });

  it('should cache synchronous method results', () => {
    let callCount = 0;

    class TestService {
      @Cacheable({ ttl: 1 })
      getData(id: number): string {
        callCount++;
        return `data-${id}`;
      }
    }

    const service = new TestService();

    // Primera llamada - ejecuta original
    expect(service.getData(1)).toBe('data-1');
    expect(callCount).toBe(1);

    // Segunda llamada - obtiene del cache
    expect(service.getData(1)).toBe('data-1');
    expect(callCount).toBe(1);

    // Llamada con diferente argumento - ejecuta original
    expect(service.getData(2)).toBe('data-2');
    expect(callCount).toBe(2);
  });

  it('should preserve "this" context', () => {
    class TestService {
      private prefix = 'prefix';

      @Cacheable({ ttl: 1 })
      getData(id: number): string {
        return `${this.prefix}-${id}`;
      }
    }

    const service = new TestService();
    expect(service.getData(1)).toBe('prefix-1');
  });

  it('should handle async methods and cache resolved values', async () => {
    let callCount = 0;

    class TestService {
      @Cacheable({ ttl: 1 })
      async getData(id: number): Promise<string> {
        callCount++;
        return `async-data-${id}`;
      }
    }

    const service = new TestService();

    // Primera llamada - asíncrona
    const result1 = await service.getData(1);
    expect(result1).toBe('async-data-1');
    expect(callCount).toBe(1);

    // Segunda llamada - asíncrona, desde cache
    const result2 = await service.getData(1);
    expect(result2).toBe('async-data-1');
    expect(callCount).toBe(1);
  });

  it('should respect custom cache key generator', () => {
    let callCount = 0;

    class TestService {
      @Cacheable({
        ttl: 1,
        // Generar clave custom omitiendo el segundo argumento
        key: (id: number) => `custom-key:${id}`,
      })
      getData(id: number, _ignored: string): string {
        callCount++;
        return `val-${id}`;
      }
    }

    const service = new TestService();

    expect(service.getData(1, 'foo')).toBe('val-1');
    expect(callCount).toBe(1);

    // Segunda llamada con diferente segundo argumento, pero misma key generada
    expect(service.getData(1, 'bar')).toBe('val-1');
    expect(callCount).toBe(1);
  });

  it('should bypass cache if ttl is 0 or less', () => {
    let callCount = 0;

    class TestService {
      @Cacheable({ ttl: 0 })
      getData(id: number): string {
        callCount++;
        return `data-${id}`;
      }
    }

    const service = new TestService();

    expect(service.getData(1)).toBe('data-1');
    expect(callCount).toBe(1);

    expect(service.getData(1)).toBe('data-1');
    expect(callCount).toBe(2); // no cacheado
  });

  it('should expire cache entries after ttl', async () => {
    let callCount = 0;

    class TestService {
      // 50ms TTL para el test
      @Cacheable({ ttl: 0.05 })
      getData(id: number): string {
        callCount++;
        return `data-${id}`;
      }
    }

    const service = new TestService();

    expect(service.getData(1)).toBe('data-1');
    expect(callCount).toBe(1);

    // Esperar 100ms
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(service.getData(1)).toBe('data-1');
    expect(callCount).toBe(2); // expirado y re-ejecutado
  });
});
