import type { ClassConstructor } from '@kanjijs/common';
import type { MiddlewareHandler } from 'hono';
import { WsMetadataStorage, type WsEventType } from './ws-metadata-storage.js';

export function WebSocketGateway(path: string = '/ws'): (target: ClassConstructor) => void {
  return (target) => {
    WsMetadataStorage.getInstance().registerGateway(target, path);
  };
}

export function WebSocketMessage(event: string): MethodDecorator {
  return (target: object, propertyKey: string | symbol) => {
    WsMetadataStorage.getInstance().registerMessageHandler(target.constructor as ClassConstructor, {
      event,
      propertyKey,
    });
  };
}

export function WebSocketEvent(event: WsEventType): MethodDecorator {
  return (target: object, propertyKey: string | symbol) => {
    WsMetadataStorage.getInstance().registerEventHandler(target.constructor as ClassConstructor, {
      event,
      propertyKey,
    });
  };
}

export function UseWsGuards(...guards: MiddlewareHandler[]): (target: ClassConstructor) => void {
  return (target) => {
    WsMetadataStorage.getInstance().registerControllerMiddleware(target, guards);
  };
}
