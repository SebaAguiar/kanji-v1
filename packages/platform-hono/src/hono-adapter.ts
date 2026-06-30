import { Hono } from 'hono';
import { Container } from '@kanjijs/core';
import { HttpMetadataStorage } from './http-metadata-storage';
import type { KanjijsAdapterOptions } from './types';

export class KanjijsAdapter {
  public static async create(
    rootModule: any,
    options: KanjijsAdapterOptions = {},
  ): Promise<{ app: Hono; container: Container }> {
    const container = new Container();
    container.bootstrap(rootModule);

    const app = new Hono();
    const httpMetadata = HttpMetadataStorage.getInstance();

    // 1. Obtener la lista de controladores registrados en el árbol de módulos bootstrap
    const controllers = container.getControllers();

    // 2. Mapear cada controlador a Hono
    for (const { controller, module: moduleClass } of controllers) {
      const controllerPath = httpMetadata.controllers.get(controller);
      if (controllerPath === undefined) {
        throw new Error(
          `Controller "${controller.name}" registered in module "${moduleClass.name}" is missing @Controller() decorator`
        );
      }

      // Resolver instancia del controlador (Errors caught at bootstrap)
      const controllerInstance = container.resolve<any>(controller, moduleClass);

      const routes = httpMetadata.routes.get(controller) || [];
      const controllerMiddlewares = httpMetadata.controllerMiddlewares.get(controller) || [];

      for (const route of routes) {
        const fullPath = `${controllerPath}${route.path}`.replace(/\/+/g, '/');
        
        // Cargar middlewares a nivel de ruta
        const routeKey = `${controller.name}:${String(route.propertyKey)}`;
        const routeMiddlewares = [...(httpMetadata.routeMiddlewares.get(routeKey) || [])];

        // Resolver contrato mediante Metadata de Reflect (si existe en @kanjijs/contracts)
        const contract = Reflect.getMetadata('kanji:contract', controller.prototype, route.propertyKey);
        
        const middlewaresToApply = [...controllerMiddlewares];

        if (contract && options.validator) {
          middlewaresToApply.push(options.validator.validate(contract));
        }

        middlewaresToApply.push(...routeMiddlewares);

        // Registrar ruta en Hono delegando en la instancia del controlador
        const handler = async (c: any) => {
          return controllerInstance[route.propertyKey](c);
        };

        (app as any)[route.method](fullPath, ...middlewaresToApply, handler);
      }
    }

    return { app, container };
  }
}
