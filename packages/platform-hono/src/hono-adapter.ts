import { Hono, type Context, type Handler } from 'hono';
import { Container, type Constructor } from '@kanjijs/core';
import { HttpMetadataStorage } from './http-metadata-storage';
import type { KanjijsAdapterOptions, ContractMetadata } from './types';
import { KanjiLogger, DefaultConsoleLogger } from '@kanjijs/common';

export class KanjijsAdapter {
  public static async create(
    rootModule: Constructor<object>,
    options: KanjijsAdapterOptions = {},
  ): Promise<{ app: Hono; container: Container }> {
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
    container.bootstrap(rootModule);

    const app = new Hono();

    // Auto-wire session authentication middleware if AuthModule is present in DI container
    const sessionProviderToken = Symbol.for('kanji:session_provider');
    if (container.hasProvider(sessionProviderToken, rootModule)) {
      const sessionProvider = container.resolve(sessionProviderToken, rootModule);
      const { createAuthMiddleware } = await import('@kanjijs/auth' as any);
      app.use('*', createAuthMiddleware(sessionProvider as any));
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

    KanjijsAdapter.validateContracts(controllers, httpMetadata, activeLogger);

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

      const controllerInstance = container.resolve(controller, moduleClass) as Record<
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

        if (contract && options.validator) {
          middlewaresToApply.push(options.validator.validate(contract));
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

    return { app, container };
  }

  private static validateContracts(
    controllers: Array<{ controller: Constructor<object>; module: Constructor<object> }>,
    httpMetadata: HttpMetadataStorage,
    logger?: KanjiLogger,
  ): void {
    for (const { controller } of controllers) {
      const prototype = controller.prototype;
      const methods = Object.getOwnPropertyNames(prototype).filter(
        (name) => name !== 'constructor' && typeof prototype[name] === 'function'
      );
      const registeredRoutes = httpMetadata.routes.get(controller) || [];
      for (const methodName of methods) {
        // Obtenemos los metadatos estructurales del contrato si el decorador @Contract fue aplicado
        const contract: ContractMetadata | undefined = Reflect.getMetadata(
          'kanji:contract',
          prototype,
          methodName
        );
        // Buscamos si el método tiene una ruta HTTP registrada en el storage
        const httpRoute = registeredRoutes.find((route) => route.propertyKey === methodName);
        // 1. Escenario A (Fatal Error): Tiene @Contract pero no decorador HTTP
        if (contract && !httpRoute) {
          throw new Error(
            `[Kanji] Fatal Error in ${controller.name}.${methodName}: ` +
            `Declared @Contract(${contract.method} "${contract.path}") but is missing an HTTP method decorator (@Get, @Post, etc.).`
          );
        }
        // 2. Escenario B (Warning): Tiene decorador HTTP pero no tiene @Contract
        if (httpRoute && !contract) {
          if (logger) {
            logger.warn(
              `${controller.name}.${methodName} has no @Contract definition. It won't be documented in OpenAPI/SDK.`,
              'ContractValidator'
            );
          }
        }
        // 3. Escenario C (Fatal Error): Mismatch de método o path
        if (contract && httpRoute) {
          const contractMethod = contract.method.toUpperCase();
          const routeMethod = httpRoute.method.toUpperCase();
          const contractPath = contract.path.replace(/\/+/g, '/');
          const routePath = httpRoute.path.replace(/\/+/g, '/');
          if (contractMethod !== routeMethod || contractPath !== routePath) {
            throw new Error(
              `[Kanji] Fatal Error: Mismatch detected in ${controller.name}.${methodName}.\n` +
              `  -> @Contract expects: [${contractMethod}] "${contractPath}"\n` +
              `  -> Decorator defines: [${routeMethod}] "${routePath}"\n` +
              `Please correct the decorator or the contract definition to match.`
            );
          }
          if (logger) {
            logger.log(
              `Validated ${controller.name}.${methodName}: ${routeMethod} ${routePath} [match]`,
              'ContractValidator'
            );
          }
        }
      }
    }
  }
}
