import type { MiddlewareHandler } from 'hono';

export type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch' | 'options' | 'head';

export interface RouteMetadata {
  propertyKey: string | symbol;
  method: HttpMethod;
  path: string;
}

export class HttpMetadataStorage {
  private static instance: HttpMetadataStorage;

  public readonly controllers = new Map<Function, string>();
  public readonly routes = new Map<Function, RouteMetadata[]>();
  public readonly controllerMiddlewares = new Map<Function, MiddlewareHandler[]>();
  public readonly routeMiddlewares = new Map<string, MiddlewareHandler[]>();

  private constructor() {}

  public static getInstance(): HttpMetadataStorage {
    if (!HttpMetadataStorage.instance) {
      HttpMetadataStorage.instance = new HttpMetadataStorage();
    }
    return HttpMetadataStorage.instance;
  }

  public registerController(target: Function, path: string): void {
    this.controllers.set(target, path);
  }

  public registerRoute(target: Function, route: RouteMetadata): void {
    const list = this.routes.get(target) || [];
    list.push(route);
    this.routes.set(target, list);
  }

  public registerControllerMiddleware(target: Function, middlewares: MiddlewareHandler[]): void {
    const list = this.controllerMiddlewares.get(target) || [];
    list.push(...middlewares);
    this.controllerMiddlewares.set(target, list);
  }

  public registerRouteMiddleware(
    target: Function,
    propertyKey: string | symbol,
    middlewares: MiddlewareHandler[],
  ): void {
    const key = `${target.name}:${String(propertyKey)}`;
    const list = this.routeMiddlewares.get(key) || [];
    list.push(...middlewares);
    this.routeMiddlewares.set(key, list);
  }

  public reset(): void {
    this.controllers.clear();
    this.routes.clear();
    this.controllerMiddlewares.clear();
    this.routeMiddlewares.clear();
  }
}
