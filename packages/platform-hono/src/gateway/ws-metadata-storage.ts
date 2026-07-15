import type { MiddlewareHandler } from 'hono';

export interface WsMessageMetadata {
  event: string;
  propertyKey: string | symbol;
}

export type WsEventType = 'connect' | 'disconnect' | 'error';

export interface WsEventMetadata {
  event: WsEventType;
  propertyKey: string | symbol;
}

export class WsMetadataStorage {
  private static instance: WsMetadataStorage;

  public readonly gateways = new Map<Function, string>();
  public readonly messageHandlers = new Map<Function, WsMessageMetadata[]>();
  public readonly eventHandlers = new Map<Function, WsEventMetadata[]>();
  public readonly controllerMiddlewares = new Map<Function, MiddlewareHandler[]>();

  private constructor() {}

  public static getInstance(): WsMetadataStorage {
    if (!WsMetadataStorage.instance) {
      WsMetadataStorage.instance = new WsMetadataStorage();
    }
    return WsMetadataStorage.instance;
  }

  public registerGateway(target: Function, path: string): void {
    this.gateways.set(target, path);
  }

  public registerMessageHandler(target: Function, metadata: WsMessageMetadata): void {
    const list = this.messageHandlers.get(target) || [];
    list.push(metadata);
    this.messageHandlers.set(target, list);
  }

  public registerEventHandler(target: Function, metadata: WsEventMetadata): void {
    const list = this.eventHandlers.get(target) || [];
    list.push(metadata);
    this.eventHandlers.set(target, list);
  }

  public registerControllerMiddleware(target: Function, middlewares: MiddlewareHandler[]): void {
    const list = this.controllerMiddlewares.get(target) || [];
    list.push(...middlewares);
    this.controllerMiddlewares.set(target, list);
  }

  public reset(): void {
    this.gateways.clear();
    this.messageHandlers.clear();
    this.eventHandlers.clear();
    this.controllerMiddlewares.clear();
  }
}
