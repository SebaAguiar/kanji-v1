import { Hono, type Context, type Handler, type MiddlewareHandler } from 'hono';
import { Container, type Constructor } from '@kanjijs/core';
import { HttpMetadataStorage } from './http-metadata-storage';
import type { KanjijsAdapterOptions } from './types';
import { KanjiLogger, DefaultConsoleLogger, KanjiError, ValidationError } from '@kanjijs/common';
import type { ValidationResult } from '@kanjijs/contracts';
import { requestIdMiddleware } from './middleware/request-id.js';

interface AuthModuleExport {
  createAuthMiddleware: (sessionProvider: object) => MiddlewareHandler;
}

export class KanjijsAdapter {
  public static async create(
    rootModule: Constructor<object>,
    options: KanjijsAdapterOptions = {},
  ): Promise<{ app: Hono; container: Container; shutdown: () => Promise<void> }> {
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

    const app = new Hono();

    // Request ID — always enabled, first middleware
    app.use('*', requestIdMiddleware);

    // Global exception filter
    app.onError((err, c) => {
      if (err instanceof ValidationError) {
        return c.json(
          { error: err.code, message: err.message, issues: err.issues },
          err.statusCode as 422,
        );
      }

      if (err instanceof KanjiError) {
        return c.json(
          { error: err.code, message: err.message, issues: [] },
          err.statusCode as 400 | 401 | 403 | 404 | 409 | 500,
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

    // Inject DI Container globally into Hono Context
    app.use('*', async (c, next) => {
      c.set('kanji.container', container);
      await next();
    });

    // Auto-wire session authentication middleware if AuthModule is present in DI container
    const sessionProviderToken = Symbol.for('kanji:session_provider');
    if (container.hasProvider(sessionProviderToken, rootModule)) {
      const sessionProvider = await container.resolve(sessionProviderToken, rootModule);
      const authModule = await import('@kanjijs/auth') as AuthModuleExport;
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
    const { ContractValidator, getControllerContract, ValidationSeverity } = await import('@kanjijs/contracts');
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
        'Fix the inconsistencies before running the application.'
      );
    }

    for (const { controller, module: moduleClass } of controllers) {
      const controllerPath = httpMetadata.controllers.get(controller);
      if (controllerPath === undefined) {
        throw new Error(
          `Controller "${controller.name}" registered in module "${moduleClass.name}" is missing @Controller() decorator`
        );
      }

      if (activeLogger) {
        activeLogger.log(`${controller.name} {${controllerPath}}`, 'RoutesResolver');
      }

      const controllerInstance = await container.resolve(controller, moduleClass) as Record<
        string | symbol,
        (c: Context) => Promise<Response> | Response
      >;

      const routes = httpMetadata.routes.get(controller) || [];
      const controllerMiddlewares = httpMetadata.controllerMiddlewares.get(controller) || [];

      for (const route of routes) {
        const fullPath = `${controllerPath}${route.path}`.replace(/\/+/g, '/');
        const routeKey = `${controller.name}:${String(route.propertyKey)}`;
        const routeMiddlewares = [...(httpMetadata.routeMiddlewares.get(routeKey) || [])];
        const contract = Reflect.getMetadata('kanji:contract', controller.prototype, route.propertyKey);
        const middlewaresToApply = [...controllerMiddlewares];

        if (contract) {
          const validator = options.validator ?? new (await import('@kanjijs/contracts')).ZodValidator();
          middlewaresToApply.push(validator.validate(contract));
        }

        middlewaresToApply.push(...routeMiddlewares);

        const handler: Handler = async (c) => {
          return controllerInstance[route.propertyKey](c);
        };

        const method = route.method.toUpperCase() as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';
        app.on(method, [fullPath], ...middlewaresToApply, handler);

        if (activeLogger) {
          activeLogger.log(`Mapped {${fullPath}, ${method}} route`, 'Router');
        }
      }
    }

    if (activeLogger) {
      const duration = performance.now() - bootstrapStart;
      activeLogger.log(`Kanji application successfully started (+${duration.toFixed(2)}ms)`, 'Kanji');
    }

    const shutdown = async () => {
      if (activeLogger) {
        activeLogger.log('Stopping Kanji application...', 'Kanji');
      }
      await container.shutdown();
    };

    return { app, container, shutdown };
  }

}
