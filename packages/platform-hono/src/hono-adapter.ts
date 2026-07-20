import { Hono, type Context, type Handler, type MiddlewareHandler } from 'hono';
import { Container, type Constructor } from '@kanjijs/core';
import { HttpMetadataStorage } from './http-metadata-storage.js';
import type { KanjijsAdapterOptions } from './types.js';
import {
  KanjiLogger,
  DefaultConsoleLogger,
  KanjiError,
  ValidationError,
  getExceptionFilterTargets,
  type ExceptionFilter,
} from '@kanjijs/common';
import type { ValidationResult } from '@kanjijs/contracts';
import { requestIdMiddleware } from './middleware/request-id.js';
import { ExceptionFilterService } from './exception-filter.service.js';

interface AuthModuleExport {
  createAuthMiddleware: (sessionProvider: object) => MiddlewareHandler;
}

export class KanjijsAdapter {
  public static async create(
    rootModule: Constructor<object>,
    options: KanjijsAdapterOptions = {},
  ): Promise<{
    app: Hono;
    container: Container;
    serve: (options?: {
      port?: number;
      hostname?: string;
      tls?: import('bun').TLSOptions;
    }) => ReturnType<typeof Bun.serve>;
    shutdown: (options?: { force?: boolean }) => Promise<void>;
    websocket?: import('hono/bun').BunWebSocketHandler<import('hono/bun').BunWebSocketData>;
  }> {
    const bootstrapStart = performance.now();

    let activeLogger: KanjiLogger | undefined;
    if (options.logger === true || options.logger === undefined) {
      activeLogger = new DefaultConsoleLogger();
    } else if (options.logger !== false) {
      activeLogger = options.logger;
    }

    if (activeLogger) {
      activeLogger.log('Starting Kanji application...', 'Kanji');
    }

    const container = new Container({ logger: options.logger });
    await container.bootstrap(rootModule);

    const filterService = new ExceptionFilterService();
    if (options.exceptionFilters) {
      for (const filterClass of options.exceptionFilters) {
        container.registerProvider(rootModule, filterClass);
        const instance = await container.resolve(filterClass, rootModule);
        const targets = getExceptionFilterTargets(filterClass);
        if (targets && instance) {
          filterService.register(instance as ExceptionFilter, targets);
        }
      }
    }

    const app = new Hono();

    // Request ID — always enabled, first middleware
    app.use('*', requestIdMiddleware);

    // Global exception filter
    app.onError(async (err, c) => {
      const filterResponse = await filterService.handle(err, c);
      if (filterResponse) {
        return filterResponse;
      }

      if (err instanceof ValidationError) {
        return c.json(
          { error: err.code, message: err.message, issues: err.issues },
          err.statusCode as 422,
        );
      }

      if (err instanceof KanjiError) {
        return c.json(
          { error: err.code, message: err.message, issues: [] },
          err.statusCode as 400 | 401 | 403 | 404 | 409 | 429 | 500,
        );
      }

      if (activeLogger) {
        activeLogger.error(err.message, err.stack, 'ExceptionFilter');
      }

      return c.json(
        { error: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred', issues: [] },
        500,
      );
    });

    // CORS
    if (options.cors) {
      const { cors } = await import('hono/cors');
      const corsConfig = typeof options.cors === 'boolean' ? {} : options.cors;
      app.use('*', cors(corsConfig));
    }

    // Security Headers
    if (options.securityHeaders !== false) {
      const { securityHeadersMiddleware } = await import('./middleware/security-headers.js');
      const securityHeadersConfig =
        typeof options.securityHeaders === 'object' ? options.securityHeaders : {};
      app.use('*', securityHeadersMiddleware(securityHeadersConfig));
    }

    // Inject DI Container globally into Hono Context
    app.use('*', async (c, next) => {
      c.set('kanji.container', container);
      await next();
    });

    // Auto-wire session authentication middleware if AuthModule is present in DI container
    const sessionProviderToken = Symbol.for('kanji:session_provider');
    if (container.hasProvider(sessionProviderToken, rootModule)) {
      const sessionProvider = await container.resolve(sessionProviderToken, rootModule);
      const authModule = (await import('@kanjijs/auth')) as AuthModuleExport;
      app.use('*', authModule.createAuthMiddleware(sessionProvider));
      if (activeLogger) {
        activeLogger.log('Session authentication middleware auto-wired', 'InstanceLoader');
      }
    }

    // Register opt-in request logger middleware
    if (options.requestLogger) {
      const { requestLoggerMiddleware } = await import('./middleware/request-logger.js');
      app.use('*', requestLoggerMiddleware(container));
    }

    const httpMetadata = HttpMetadataStorage.getInstance();
    const controllers = container.getControllers();

    // Run granular contract validation checks
    const { ContractValidator, getControllerContract, ValidationSeverity } =
      await import('@kanjijs/contracts');
    const validationResults: ValidationResult[] = [];
    let hasErrors = false;

    for (const { controller } of controllers) {
      const declaredContract = getControllerContract(controller);
      const results = ContractValidator.validate(controller, declaredContract);
      validationResults.push(...results);
    }

    if (validationResults.length > 0) {
      if (activeLogger) {
        activeLogger.log('\n📋 Contract Validation Results:\n', 'ContractValidator');
      }

      for (const result of validationResults) {
        const prefix = result.severity === ValidationSeverity.ERROR ? '❌' : '⚠️';
        const locationName = result.location.method
          ? `${result.location.controller}.${result.location.method}`
          : result.location.controller;

        const fileLoc = result.location.file ? ` (${result.location.file})` : '';
        const message = `${prefix} [${locationName}]${fileLoc} ${result.message}`;
        const suggestionLine = result.suggestion ? `   → ${result.suggestion}` : undefined;

        if (result.severity === ValidationSeverity.ERROR) {
          if (activeLogger) {
            activeLogger.error(message, undefined, 'ContractValidator');
            if (suggestionLine) {
              activeLogger.error(suggestionLine, undefined, 'ContractValidator');
            }
          }
          hasErrors = true;
        } else {
          if (activeLogger) {
            activeLogger.warn(message, 'ContractValidator');
            if (suggestionLine) {
              activeLogger.warn(suggestionLine, 'ContractValidator');
            }
          }
        }
      }
    }

    if (hasErrors) {
      throw new Error(
        '[Kanji] Contract validation failed with errors (see above). ' +
          'Fix the inconsistencies before running the application.',
      );
    }

    for (const { controller, module: moduleClass } of controllers) {
      const controllerPath = httpMetadata.controllers.get(controller);
      if (controllerPath === undefined) {
        throw new Error(
          `Controller "${controller.name}" registered in module "${moduleClass.name}" is missing @Controller() decorator`,
        );
      }

      if (activeLogger) {
        activeLogger.log(`${controller.name} {${controllerPath}}`, 'RoutesResolver');
      }

      const controllerInstance = (await container.resolve(controller, moduleClass)) as Record<
        string | symbol,
        (c: Context) => Promise<Response> | Response
      >;

      const routes = httpMetadata.routes.get(controller) || [];
      const controllerMiddlewares = httpMetadata.controllerMiddlewares.get(controller) || [];

      for (const route of routes) {
        const fullPath = `${controllerPath}${route.path}`.replace(/\/+/g, '/');
        const routeKey = `${controller.name}:${String(route.propertyKey)}`;
        const routeMiddlewares = [...(httpMetadata.routeMiddlewares.get(routeKey) || [])];
        const contract = Reflect.getMetadata(
          'kanji:contract',
          controller.prototype,
          route.propertyKey,
        );
        const middlewaresToApply = [...controllerMiddlewares];

        const rateLimitOptions = Reflect.getMetadata(
          'kanji:rate-limit',
          controller.prototype,
          route.propertyKey,
        );
        if (rateLimitOptions) {
          const { createRateLimitMiddleware } = await import('./middleware/rate-limit.js');
          middlewaresToApply.push(createRateLimitMiddleware(rateLimitOptions, routeKey));
        }

        if (contract) {
          const validator =
            options.validator ?? new (await import('@kanjijs/contracts')).ZodValidator();
          middlewaresToApply.push(validator.validate(contract));
        }

        middlewaresToApply.push(...routeMiddlewares);

        const handler: Handler = async (c) => {
          return controllerInstance[route.propertyKey](c);
        };

        const method = route.method.toUpperCase() as
          'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';
        app.on(method, [fullPath], ...middlewaresToApply, handler);

        if (activeLogger) {
          activeLogger.log(`Mapped {${fullPath}, ${method}} route`, 'Router');
        }
      }
    }

    // ============================================================
    // WebSocket Gateway registration
    // ============================================================
    const gateways = container.getGateways();
    let websocketHandler:
      import('hono/bun').BunWebSocketHandler<import('hono/bun').BunWebSocketData> | undefined =
      undefined;

    if (gateways.length > 0) {
      const { WsMetadataStorage, WsGatewayHandler } = await import('./gateway/index.js');
      const wsMetadata = WsMetadataStorage.getInstance();
      const wsHandler = new WsGatewayHandler(activeLogger);

      for (const { gateway, module: moduleClass } of gateways) {
        const wsPath = wsMetadata.gateways.get(gateway);
        if (!wsPath) {
          throw new Error(
            `Gateway "${gateway.name}" registered in module "${moduleClass.name}" is missing @WebSocketGateway() decorator`,
          );
        }

        if (activeLogger) {
          activeLogger.log(`${gateway.name} {${wsPath}}`, 'WsGatewayResolver');
        }

        const instance = (await container.resolve(gateway, moduleClass)) as Record<
          string | symbol,
          Function
        >;
        const upgradeHandler = wsHandler.createUpgradeHandler(instance, gateway);

        // Apply controller-level middlewares before upgrade:
        // - @UseGuards(AuthGuard) registers in HttpMetadataStorage
        // - @UseWsGuards(...) registers in WsMetadataStorage
        // Merge both so either decorator works for WS gateways
        const httpGuards = httpMetadata.controllerMiddlewares.get(gateway) || [];
        const wsGuards = wsMetadata.controllerMiddlewares.get(gateway) || [];
        const controllerMiddlewares = [...httpGuards, ...wsGuards];
        app.on('GET', [wsPath], ...controllerMiddlewares, upgradeHandler);

        if (activeLogger) {
          activeLogger.log(`Mapped WS gateway {${wsPath}}`, 'WsGatewayRouter');
        }
      }

      const { websocket } = await import('hono/bun');
      websocketHandler = websocket as import('hono/bun').BunWebSocketHandler<
        import('hono/bun').BunWebSocketData
      >;
    }

    if (activeLogger) {
      const duration = performance.now() - bootstrapStart;
      activeLogger.log(
        `Kanji application successfully started (+${duration.toFixed(2)}ms)`,
        'Kanji',
      );
    }

    // Track the server instance for graceful shutdown
    let serverInstance: ReturnType<typeof Bun.serve> | null = null;

    // Start the Bun HTTP/WS server manually
    const serve = (serveOptions?: {
      port?: number;
      hostname?: string;
      tls?: import('bun').TLSOptions;
    }): ReturnType<typeof Bun.serve> => {
      const port = serveOptions?.port ?? 3000;
      const hostname = serveOptions?.hostname;
      const tls = serveOptions?.tls;

      if (websocketHandler) {
        serverInstance = Bun.serve({
          fetch: app.fetch,
          port,
          ...(hostname ? { hostname } : {}),
          ...(tls ? { tls } : {}),
          websocket: websocketHandler,
        });
      } else {
        serverInstance = Bun.serve({
          fetch: app.fetch,
          port,
          ...(hostname ? { hostname } : {}),
          ...(tls ? { tls } : {}),
        });
      }

      if (activeLogger) {
        activeLogger.log(`Server listening on http://${hostname ?? 'localhost'}:${port}`, 'Kanji');
      }

      return serverInstance;
    };

    const shutdown = async (shutdownOptions?: { force?: boolean }): Promise<void> => {
      if (activeLogger) {
        activeLogger.log(
          `Stopping Kanji application${shutdownOptions?.force ? ' (forced)' : ''}...`,
          'Kanji',
        );
      }
      if (serverInstance) {
        serverInstance.stop(shutdownOptions?.force ?? false);
      }
      await container.shutdown();
    };

    return {
      app,
      container,
      serve,
      shutdown,
      ...(websocketHandler ? { websocket: websocketHandler } : {}),
    };
  }
}
