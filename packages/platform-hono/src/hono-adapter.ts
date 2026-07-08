import { Hono, type Context, type Handler } from 'hono';
import { Container, type Constructor } from '@kanjijs/core';
import { HttpMetadataStorage } from './http-metadata-storage';
import type { KanjijsAdapterOptions } from './types';
import { KanjiLogger, DefaultConsoleLogger } from '@kanjijs/common';

export class KanjijsAdapter {
  public static async create(
    rootModule: Constructor<object>,
    options: KanjijsAdapterOptions = {},
  ): Promise<{ app: Hono; container: Container }> {
    const bootstrapStart = performance.now();

    // 1. Resolve active logger
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

    // Register opt-in request logger middleware
    if (options.requestLogger) {
      const { requestLoggerMiddleware } = await import('./middleware/request-logger.js');
      app.use('*', requestLoggerMiddleware(container));
    }

    const httpMetadata = HttpMetadataStorage.getInstance();
    const controllers = container.getControllers();

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
}
