import type { ModuleMetadata, Constructor, Token } from './types';

export interface CustomInjectionMetadata {
  index: number;
  token: Token<object>;
}

export class MetadataStorage {
  private static instance: MetadataStorage;

  public readonly modules = new Map<Constructor<object>, ModuleMetadata>();
  public readonly injectables = new Set<Constructor<object>>();
  public readonly customInjections = new Map<Constructor<object>, CustomInjectionMetadata[]>();
  public readonly controllers = new Set<Constructor<object>>();
  public readonly gateways = new Set<Constructor<object>>();

  private constructor() {}

  public static getInstance(): MetadataStorage {
    if (!MetadataStorage.instance) {
      MetadataStorage.instance = new MetadataStorage();
    }
    return MetadataStorage.instance;
  }

  public registerModule(target: Constructor<object>, metadata: ModuleMetadata): void {
    this.modules.set(target, metadata);
  }

  public registerInjectable(target: Constructor<object>): void {
    this.injectables.add(target);
  }

  public registerCustomInjection(
    target: Constructor<object>,
    index: number,
    token: Token<object>,
  ): void {
    const injections = this.customInjections.get(target) || [];
    injections.push({ index, token });
    this.customInjections.set(target, injections);
  }

  public registerController(target: Constructor<object>): void {
    this.controllers.add(target);
  }

  public registerGateway(target: Constructor<object>): void {
    this.gateways.add(target);
  }
}
