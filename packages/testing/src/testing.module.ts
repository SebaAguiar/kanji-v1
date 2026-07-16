import { Hono, type Context } from 'hono';
import { Container, type Token, type Constructor } from '@kanjijs/core';
import type { HttpMetadataStorage as HttpMetadataStorageType } from '@kanjijs/platform-hono';

export class TestingModule {
  constructor(
    public readonly app: Hono,
    public readonly container: Container,
  ) {}

  public async get<T extends object>(token: Token<T>): Promise<T> {
    const instances = this.container.getInstances();
    if (instances.has(token)) {
      return instances.get(token) as T;
    }

    let lastError: Error | null = null;
    const initializedModules = this.container.getInitializedModules();

    for (const mod of initializedModules) {
      try {
        return await this.container.resolve(token, mod);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    throw new Error(
      `TestingModule: Provider for token "${String(token)}" could not be resolved from any initialized module.` +
        (lastError ? ` Last resolution error: ${lastError.message}` : ''),
    );
  }
}

export class TestingModuleBuilder {
  private readonly imports: Constructor<object>[] = [];
  private readonly overrides = new Map<Token<object>, object>();

  constructor(metadata: { imports: Constructor<object>[] }) {
    this.imports = metadata.imports;
  }

  public overrideProvider<T extends object>(
    token: Token<T>,
  ): { useValue: (value: T) => TestingModuleBuilder } {
    return {
      useValue: (value: T): TestingModuleBuilder => {
        this.overrides.set(token, value);
        return this;
      },
    };
  }

  public async compile(): Promise<TestingModule> {
    const container = new Container({ logger: false });

    const instancesMap = container.getInstances();
    for (const [token, mockValue] of this.overrides.entries()) {
      instancesMap.set(token, mockValue);
      container.exposeGlobal(token);
    }

    const rootModule = this.imports[0];
    if (!rootModule) {
      throw new Error('TestingModuleBuilder: No root module provided in imports.');
    }

    await container.bootstrap(rootModule);

    const app = new Hono();
    const { HttpMetadataStorage } = await import('@kanjijs/platform-hono');
    const httpMetadata: HttpMetadataStorageType = HttpMetadataStorage.getInstance();

    const controllers = container.getControllers();

    for (const { controller, module: moduleClass } of controllers) {
      const controllerPath = httpMetadata.controllers.get(controller);
      if (controllerPath === undefined) {
        continue;
      }

      const controllerInstance = (await container.resolve(controller, moduleClass)) as Record<
        string | symbol,
        (c: Context) => Promise<Response | void>
      >;

      const routes = httpMetadata.routes.get(controller) || [];
      const controllerMiddlewares = httpMetadata.controllerMiddlewares.get(controller) || [];

      for (const route of routes) {
        const fullPath = `${controllerPath}${route.path}`.replace(/\/+/g, '/');
        const routeKey = `${controller.name}:${String(route.propertyKey)}`;
        const routeMiddlewares = [...(httpMetadata.routeMiddlewares.get(routeKey) || [])];

        const middlewaresToApply = [...controllerMiddlewares, ...routeMiddlewares];

        const handler = async (c: Context) => {
          return controllerInstance[route.propertyKey](c);
        };

        const handlers = [...middlewaresToApply, handler] as import('hono').Handler[];
        const appRef = app as unknown as Record<
          string,
          (path: string, ...h: import('hono').Handler[]) => void
        >;
        appRef[route.method.toLowerCase()](fullPath, ...handlers);
      }
    }

    return new TestingModule(app, container);
  }
}

export const Test = {
  createTestingModule(metadata: { imports: Constructor<object>[] }): TestingModuleBuilder {
    return new TestingModuleBuilder(metadata);
  },
};
