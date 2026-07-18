import 'reflect-metadata';
import { MetadataStorage } from './metadata-storage.js';
import type { Token, Constructor, Provider } from './types.js';
import { KanjiLogger, DefaultConsoleLogger, LOGGER } from '@kanjijs/common';

export class Container {
  private readonly instances = new Map<Token<object>, object>();
  private readonly moduleProviders = new Map<Constructor<object>, Set<Token<object>>>();
  private readonly moduleExports = new Map<Constructor<object>, Set<Token<object>>>();
  private readonly globalProviders = new Set<Token<object>>();
  private readonly providerRegistry = new Map<
    Constructor<object>,
    Map<Token<object>, Provider<object>>
  >();
  private readonly initializedModules = new Set<Constructor<object>>();
  private readonly moduleControllers = new Map<Constructor<object>, Set<Constructor<object>>>();
  private readonly moduleGateways = new Map<Constructor<object>, Set<Constructor<object>>>();
  private readonly logger?: KanjiLogger;

  constructor(opts?: { logger?: KanjiLogger | boolean }) {
    if (opts?.logger === true || opts?.logger === undefined) {
      this.logger = new DefaultConsoleLogger();
    } else if (opts?.logger !== false) {
      this.logger = opts.logger;
    }
    if (this.logger) {
      this.instances.set(LOGGER, this.logger);
    }
  }

  public async bootstrap(rootModule: Constructor<object>): Promise<void> {
    this.scanModule(rootModule);

    // Eagerly resolve all registered providers across all modules
    for (const [moduleClass, registry] of this.providerRegistry.entries()) {
      for (const token of registry.keys()) {
        await this.resolve(token, moduleClass);
      }
    }

    // Call lifecycle hooks
    await this.callLifecycleHooks('onModuleInit');
    await this.callLifecycleHooks('onApplicationBootstrap');
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
    const localControllers = new Set<Constructor<object>>();
    const localGateways = new Set<Constructor<object>>();

    if (metadata.imports) {
      for (const imported of metadata.imports) {
        if ('module' in imported) {
          this.scanModule(imported.module);

          if (imported.providers) {
            for (const p of imported.providers) {
              const token = this.getProviderToken(p);
              registry.set(token, p);
              localProviders.add(token);
              if (imported.global) {
                this.globalProviders.add(token);
              }
            }
          }
          if (imported.controllers) {
            for (const controller of imported.controllers) {
              registry.set(controller, controller);
              localProviders.add(controller);
              localControllers.add(controller);
            }
          }
          if (imported.gateways) {
            for (const gateway of imported.gateways) {
              registry.set(gateway, gateway);
              localProviders.add(gateway);
              localGateways.add(gateway);
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

    if (metadata.controllers) {
      for (const controller of metadata.controllers) {
        registry.set(controller, controller);
        localProviders.add(controller);
        localControllers.add(controller);
      }
    }

    if (metadata.gateways) {
      for (const gateway of metadata.gateways) {
        registry.set(gateway, gateway);
        localProviders.add(gateway);
        localGateways.add(gateway);
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
    this.moduleControllers.set(moduleClass, localControllers);
    this.moduleGateways.set(moduleClass, localGateways);

    if (this.logger) {
      this.logger.log(`${moduleClass.name} dependencies initialized`, 'InstanceLoader');
    }
  }

  public async resolve<T extends object>(
    token: Token<T>,
    contextModule: Constructor<object>,
    resolutionStack: Token<object>[] = [],
  ): Promise<T> {
    if (!this.isTokenVisible(token, contextModule)) {
      throw new Error(
        `Dependency injection error: Token "${String(
          token,
        )}" is not visible in module "${contextModule.name}". Make sure it is exported by an imported module or marked global.`,
      );
    }

    return this.getInstance(token, contextModule, resolutionStack);
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

  private async getInstance<T extends object>(
    token: Token<T>,
    contextModule: Constructor<object>,
    resolutionStack: Token<object>[] = [],
  ): Promise<T> {
    if (this.instances.has(token)) {
      return this.instances.get(token) as T;
    }

    if (resolutionStack.includes(token)) {
      throw new Error(
        `Circular dependency detected: ${resolutionStack.map((t) => String(t)).join(' -> ')} -> ${String(token)}`,
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
          const instance = await this.instantiateClass(
            token as Constructor<object>,
            providerModule,
            resolutionStack,
          );
          this.instances.set(token, instance);
          return instance as T;
        }
      }
      throw new Error(`No provider registered for token "${String(token)}".`);
    }

    let instance: object;

    if (typeof provider === 'function') {
      instance = await this.instantiateClass(
        provider as Constructor<object>,
        providerModule,
        resolutionStack,
      );
    } else if ('useValue' in provider) {
      instance = provider.useValue;
    } else if ('useClass' in provider) {
      instance = await this.instantiateClass(provider.useClass, providerModule, resolutionStack);
    } else if ('useFactory' in provider) {
      const injectTokens = provider.inject || [];
      const injectedDeps = await Promise.all(
        injectTokens.map((depToken) => this.resolve(depToken, providerModule, resolutionStack)),
      );
      const factoryResult = provider.useFactory(...injectedDeps);
      instance = (await factoryResult) as object;
    } else {
      throw new Error(`Invalid provider definition for token "${String(token)}".`);
    }

    this.instances.set(token, instance);
    resolutionStack.pop();
    return instance as T;
  }

  private async instantiateClass(
    clazz: Constructor<object>,
    moduleContext: Constructor<object>,
    resolutionStack: Token<object>[],
  ): Promise<object> {
    const paramTypes: Constructor<object>[] = Reflect.getMetadata('design:paramtypes', clazz) || [];
    const customInjections = MetadataStorage.getInstance().customInjections.get(clazz) || [];

    const args = await Promise.all(
      paramTypes.map(async (paramType, index) => {
        const customInjection = customInjections.find((ci) => ci.index === index);
        const tokenToResolve = customInjection ? customInjection.token : paramType;

        if (!tokenToResolve) {
          throw new Error(
            `Cannot resolve parameter at index ${index} for class "${clazz.name}". Ensure that parameter type is a valid class or decorated with @Inject().`,
          );
        }

        return this.resolve(tokenToResolve, moduleContext, resolutionStack);
      }),
    );

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

    if (this.globalProviders.has(token)) {
      for (const [moduleClass, registry] of this.providerRegistry.entries()) {
        if (registry.has(token)) {
          return moduleClass;
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
    const controllersList: Array<{ controller: Constructor<object>; module: Constructor<object> }> =
      [];
    for (const [moduleClass, controllers] of this.moduleControllers.entries()) {
      for (const controller of controllers) {
        controllersList.push({ controller, module: moduleClass });
      }
    }
    return controllersList;
  }

  public getGateways(): Array<{ gateway: Constructor<object>; module: Constructor<object> }> {
    const gatewaysList: Array<{ gateway: Constructor<object>; module: Constructor<object> }> = [];
    for (const [moduleClass, gateways] of this.moduleGateways.entries()) {
      for (const gateway of gateways) {
        gatewaysList.push({ gateway, module: moduleClass });
      }
    }
    return gatewaysList;
  }

  public hasProvider(token: Token<object>, contextModule: Constructor<object>): boolean {
    return this.findProviderModule(token, contextModule) !== null;
  }

  public exposeGlobal(token: Token<object>): void {
    this.globalProviders.add(token);
  }

  public registerProvider(moduleClass: Constructor<object>, provider: Provider<object>): void {
    const token = typeof provider === 'function' ? provider : provider.provide;
    let registry = this.providerRegistry.get(moduleClass);
    if (!registry) {
      registry = new Map<Token<object>, Provider<object>>();
      this.providerRegistry.set(moduleClass, registry);
    }
    registry.set(token, provider);

    let localProviders = this.moduleProviders.get(moduleClass);
    if (!localProviders) {
      localProviders = new Set<Token<object>>();
      this.moduleProviders.set(moduleClass, localProviders);
    }
    localProviders.add(token);
  }

  public async shutdown(): Promise<void> {
    if (this.logger) {
      this.logger.log('Executing OnDestroy lifecycle hooks...', 'InstanceLoader');
    }
    const instancesArray = Array.from(this.instances.values()).reverse();
    for (const instance of instancesArray) {
      if (instance && typeof (instance as any).onDestroy === 'function') {
        await (instance as any).onDestroy();
      }
    }
  }

  private async callLifecycleHooks(hook: 'onModuleInit' | 'onApplicationBootstrap'): Promise<void> {
    if (this.logger) {
      this.logger.log(`Executing ${hook} lifecycle hooks...`, 'InstanceLoader');
    }
    for (const [, instance] of this.instances) {
      if (instance && typeof (instance as any)[hook] === 'function') {
        await (instance as any)[hook]();
      }
    }
  }
}
