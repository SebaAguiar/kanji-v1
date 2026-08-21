import type { ClassConstructor } from '@kanjijs/common';
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

  public readonly gateways = new Map<ClassConstructor, string>();
  public readonly messageHandlers = new Map<ClassConstructor, WsMessageMetadata[]>();
  public readonly eventHandlers = new Map<ClassConstructor, WsEventMetadata[]>();
  public readonly controllerMiddlewares = new Map<ClassConstructor, MiddlewareHandler[]>();

  private constructor() {}

  public static getInstance(): WsMetadataStorage {
    if (!WsMetadataStorage.instance) {
      WsMetadataStorage.instance = new WsMetadataStorage();
    }
    return WsMetadataStorage.instance;
  }

  public registerGateway(target: ClassConstructor, path: string): void {
    this.gateways.set(target, path);
  }

  public registerMessageHandler(target: ClassConstructor, metadata: WsMessageMetadata): void {
    const list = this.messageHandlers.get(target) || [];
    list.push(metadata);
    this.messageHandlers.set(target, list);
  }

  public registerEventHandler(target: ClassConstructor, metadata: WsEventMetadata): void {
    const list = this.eventHandlers.get(target) || [];
    list.push(metadata);
    this.eventHandlers.set(target, list);
  }

  public registerControllerMiddleware(target: ClassConstructor, middlewares: MiddlewareHandler[]): void {
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
