import type { Context, MiddlewareHandler } from 'hono';
import type { KanjiLogger } from '@kanjijs/common';
import { WsMetadataStorage } from './ws-metadata-storage.js';
import { WebSocketContext } from './ws-context.js';

export class WsGatewayHandler {
  constructor(private readonly logger?: KanjiLogger) {}

  createUpgradeHandler(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    instance: Record<string | symbol, (...args: any[]) => unknown>,
    gatewayClass: Function,
  ): MiddlewareHandler {
    const ws = WsMetadataStorage.getInstance();
    const messageHandlers = ws.messageHandlers.get(gatewayClass) || [];
    const eventHandlers = ws.eventHandlers.get(gatewayClass) || [];
    const connectHandler = eventHandlers.find(e => e.event === 'connect');
    const disconnectHandler = eventHandlers.find(e => e.event === 'disconnect');
    const errorHandler = eventHandlers.find(e => e.event === 'error');

    const messageMap = new Map<string, string | symbol>();
    for (const mh of messageHandlers) {
      messageMap.set(mh.event, mh.propertyKey);
    }

    const self = this;

    // Lazy import hono/bun for the upgradeWebSocket helper
    let upgradeHandler: MiddlewareHandler | null = null;

    return async (c: Context, next: () => Promise<void>) => {
      if (!upgradeHandler) {
        const { upgradeWebSocket } = await import('hono/bun');

        upgradeHandler = upgradeWebSocket((c) => ({
          onOpen(_evt, wsRaw) {
            if (!connectHandler) return;
            const ctx = new WebSocketContext(c, wsRaw);
            const method = instance[connectHandler.propertyKey];
            if (typeof method === 'function') {
              method(ctx);
            }
          },

          onMessage(evt, wsRaw) {
            let parsed: Record<string, unknown> | null = null;
            try {
              const rawData = JSON.parse(evt.data as string);
              if (rawData && typeof rawData === 'object' && !Array.isArray(rawData)) {
                parsed = rawData as Record<string, unknown>;
              }
            } catch {
              wsRaw.send(JSON.stringify({
                event: 'error',
                data: { code: 'PARSE_ERROR', message: 'Invalid JSON' },
              }));
              return;
            }

            if (!parsed) {
              wsRaw.send(JSON.stringify({
                event: 'error',
                data: { code: 'INVALID_FORMAT', message: 'Payload must be a JSON object' },
              }));
              return;
            }

            const eventName = parsed.event || parsed.type;
            if (typeof eventName !== 'string') return;

            const propertyKey = messageMap.get(eventName);
            if (!propertyKey) return;

            const rawPayload = parsed.data ?? parsed.payload ?? parsed;

            // Contract validation (if @Contract is present on the method)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const contract: { body?: import('zod').ZodTypeAny } | undefined =
              Reflect.getMetadata('kanji:contract', Object.getPrototypeOf(instance), propertyKey);

            const method = instance[propertyKey];
            if (typeof method !== 'function') return;

            let ctx: WebSocketContext;

            if (contract?.body) {
              const result = contract.body.safeParse(rawPayload);
              if (!result.success) {
                wsRaw.send(JSON.stringify({
                  event: 'error',
                  data: {
                    code: 'VALIDATION_ERROR',
                    issues: result.error.issues.map(i => ({
                      path: i.path.join('.'),
                      message: i.message,
                      code: i.code,
                    })),
                  },
                }));
                return;
              }
              ctx = new WebSocketContext(c, wsRaw, result.data);
            } else {
              ctx = new WebSocketContext(c, wsRaw);
            }

            self.invokeHandler(method as (ctx: WebSocketContext) => void | Promise<void>, ctx, wsRaw);
          },

          onClose(_evt, wsRaw) {
            if (!disconnectHandler) return;
            const ctx = new WebSocketContext(c, wsRaw);
            const method = instance[disconnectHandler.propertyKey];
            if (typeof method === 'function') {
              method(ctx);
            }
          },

          onError(_evt, wsRaw) {
            if (!errorHandler) return;
            const ctx = new WebSocketContext(c, wsRaw);
            const method = instance[errorHandler.propertyKey];
            if (typeof method === 'function') {
              method(ctx);
            }
          },
        }));
      }

      return upgradeHandler(c, next);
    };
  }

  private invokeHandler(
    method: (ctx: WebSocketContext) => void | Promise<void>,
    ctx: WebSocketContext,
    ws: { send: (data: string) => void },
  ): void {
    try {
      const result = method(ctx);
      if (result instanceof Promise) {
        result.catch((err: Error) => {
          this.handleWsError(err, ws);
        });
      }
    } catch (err) {
      this.handleWsError(err as Error, ws);
    }
  }

  private handleWsError(err: Error, ws: { send: (data: string) => void }): void {
    if (this.logger) {
      this.logger.error(err.message, err.stack, 'WsGatewayHandler');
    }
    ws.send(JSON.stringify({
      event: 'error',
      data: { code: 'INTERNAL_ERROR', message: err.message },
    }));
  }
}
