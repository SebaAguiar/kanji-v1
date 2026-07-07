import 'reflect-metadata';
import { MetadataStorage } from './metadata-storage';
import type { Token, Constructor, Provider } from './types';

export class Container {
  private readonly instances = new Map<Token<object>, object>();
  private readonly moduleProviders = new Map<Constructor<object>, Set<Token<object>>>();
  private readonly moduleExports = new Map<Constructor<object>, Set<Token<object>>>();
  private readonly globalProviders = new Set<Token<object>>();
  private readonly providerRegistry = new Map<Constructor<object>, Map<Token<object>, Provider<object>>>();
  private readonly initializedModules = new Set<Constructor<object>>();

  constructor() {}

  public bootstrap(rootModule: Constructor<object>): void {
    this.scanModule(rootModule);
  }

  private scanModule(moduleClass: Constructor<object>): void {
    if (this.initializedModules.has(moduleClass)) {
      return;
    }
    this.initializedModules.add(moduleClass);

    const metadata = MetadataStorage.getInstance().modules.get(moduleClass);
    if (!metadata) {
      throw new Error(`Module ${moduleClass.name} is missing @KanjijsModule decorator`);
    }

    const localProviders = new Set<Token<object>>();
    const localExports = new Set<Token<object>>();
    const registry = new Map<Token<object>, Provider<object>>();

    if (metadata.imports) {
      for (const imported of metadata.imports) {
        if ('module' in imported) {
          this.scanModule(imported.module);
          
          if (imported.providers) {
            for (const p of imported.providers) {
              const token = this.getProviderToken(p);
              registry.set(token, p);
              localProviders.add(token);
            }
          }
          if (imported.exports) {
            for (const exp of imported.exports) {
              localExports.add(exp);
            }
          }
        } else {
          this.scanModule(imported);
        }
      }
    }

    if (metadata.providers) {
      for (const provider of metadata.providers) {
        const token = this.getProviderToken(provider);
        registry.set(token, provider);
        localProviders.add(token);

        if (metadata.global) {
          this.globalProviders.add(token);
        }
      }
    }

    if (metadata.exports) {
      for (const exp of metadata.exports) {
        localExports.add(exp);
      }
    }

    this.moduleProviders.set(moduleClass, localProviders);
    this.moduleExports.set(moduleClass, localExports);
    this.providerRegistry.set(moduleClass, registry);
  }

  public resolve<T extends object>(token: Token<T>, contextModule: Constructor<object>): T {
    if (!this.isTokenVisible(token, contextModule)) {
      throw new Error(
        `Dependency injection error: Token "${String(
          token,
        )}" is not visible in module "${contextModule.name}". Make sure it is exported by an imported module or marked global.`
      );
    }

    return this.getInstance(token, contextModule) as T;
  }

  private isTokenVisible(token: Token<object>, contextModule: Constructor<object>): boolean {
    if (this.moduleProviders.get(contextModule)?.has(token)) {
      return true;
    }

    if (this.globalProviders.has(token)) {
      return true;
    }

    const metadata = MetadataStorage.getInstance().modules.get(contextModule);
    if (metadata?.imports) {
      for (const imported of metadata.imports) {
        const importedModuleClass = 'module' in imported ? imported.module : imported;
        if (this.moduleExports.get(importedModuleClass)?.has(token)) {
          return true;
        }
      }
    }

    return false;
  }

  private getInstance<T extends object>(
    token: Token<T>,
    contextModule: Constructor<object>,
    resolutionStack: Token<object>[] = [],
  ): T {
    if (this.instances.has(token)) {
      return this.instances.get(token) as T;
    }

    if (resolutionStack.includes(token)) {
      throw new Error(
        `Circular dependency detected: ${resolutionStack.map(t => String(t)).join(' -> ')} -> ${String(token)}`
      );
    }

    resolutionStack.push(token);

    const providerModule = this.findProviderModule(token, contextModule);
    if (!providerModule) {
      throw new Error(`Provider for token "${String(token)}" not found in visible modules.`);
    }

    const provider = this.providerRegistry.get(providerModule)?.get(token);
    if (!provider) {
      if (typeof token === 'function') {
        const metadataStorage = MetadataStorage.getInstance();
        if (metadataStorage.injectables.has(token as Constructor<object>)) {
          const instance = this.instantiateClass(token as Constructor<object>, providerModule);
          this.instances.set(token, instance);
          return instance as T;
        }
      }
      throw new Error(`No provider registered for token "${String(token)}".`);
    }

    let instance: object;

    if (typeof provider === 'function') {
      instance = this.instantiateClass(provider as Constructor<object>, providerModule);
    } else if ('useValue' in provider) {
      instance = provider.useValue;
    } else if ('useClass' in provider) {
      instance = this.instantiateClass(provider.useClass, providerModule);
    } else if ('useFactory' in provider) {
      const injectTokens = provider.inject || [];
      const injectedDeps = injectTokens.map(depToken => this.resolve(depToken, providerModule));
      const factoryResult = provider.useFactory(...injectedDeps);
      instance = factoryResult as object;
    } else {
      throw new Error(`Invalid provider definition for token "${String(token)}".`);
    }

    this.instances.set(token, instance);
    resolutionStack.pop();
    return instance as T;
  }

  private instantiateClass(
    clazz: Constructor<object>,
    moduleContext: Constructor<object>,
  ): object {
    const paramTypes: Constructor<object>[] = Reflect.getMetadata('design:paramtypes', clazz) || [];
    const customInjections = MetadataStorage.getInstance().customInjections.get(clazz) || [];

    const args = paramTypes.map((paramType, index) => {
      const customInjection = customInjections.find(ci => ci.index === index);
      const tokenToResolve = customInjection ? customInjection.token : paramType;

      if (!tokenToResolve) {
        throw new Error(
          `Cannot resolve parameter at index ${index} for class "${clazz.name}". Ensure that parameter type is a valid class or decorated with @Inject().`
        );
      }

      return this.resolve(tokenToResolve, moduleContext);
    });

    return new clazz(...(args as never[]));
  }

  private findProviderModule(
    token: Token<object>,
    contextModule: Constructor<object>,
  ): Constructor<object> | null {
    if (this.providerRegistry.get(contextModule)?.has(token)) {
      return contextModule;
    }

    const metadata = MetadataStorage.getInstance().modules.get(contextModule);
    if (metadata?.imports) {
      for (const imported of metadata.imports) {
        const importedModuleClass = 'module' in imported ? imported.module : imported;
        if (this.moduleExports.get(importedModuleClass)?.has(token)) {
          return importedModuleClass;
        }
      }
    }

    for (const [moduleClass, registry] of this.providerRegistry.entries()) {
      const moduleMeta = MetadataStorage.getInstance().modules.get(moduleClass);
      if (moduleMeta?.global && registry.has(token)) {
        return moduleClass;
      }
    }

    return null;
  }

  private getProviderToken(provider: Provider<object>): Token<object> {
    if (typeof provider === 'function') {
      return provider;
    }
    return provider.provide;
  }

  public getInstances(): Map<Token<object>, object> {
    return this.instances;
  }

  public getInitializedModules(): Set<Constructor<object>> {
    return this.initializedModules;
  }

  public getControllers(): Array<{ controller: Constructor<object>; module: Constructor<object> }> {
    const controllersList: Array<{ controller: Constructor<object>; module: Constructor<object> }> = [];
    for (const moduleClass of this.initializedModules) {
      const metadata = MetadataStorage.getInstance().modules.get(moduleClass);
      if (metadata && metadata.controllers) {
        for (const controller of metadata.controllers) {
          controllersList.push({ controller, module: moduleClass });
        }
      }
    }
    return controllersList;
  }
}

