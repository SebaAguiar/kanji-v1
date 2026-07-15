import type { MiddlewareHandler } from 'hono';
import { WsMetadataStorage, type WsEventType } from './ws-metadata-storage.js';

export function WebSocketGateway(path: string = '/ws'): ClassDecorator {
  return (target: Function) => {
    WsMetadataStorage.getInstance().registerGateway(target, path);
  };
}

export function WebSocketMessage(event: string): MethodDecorator {
  return (target: object, propertyKey: string | symbol) => {
    WsMetadataStorage.getInstance().registerMessageHandler(
      target.constructor,
      { event, propertyKey },
    );
  };
}

export function WebSocketEvent(event: WsEventType): MethodDecorator {
  return (target: object, propertyKey: string | symbol) => {
    WsMetadataStorage.getInstance().registerEventHandler(
      target.constructor,
      { event, propertyKey },
    );
  };
}

export function UseWsGuards(...guards: MiddlewareHandler[]): ClassDecorator {
  return (target: Function) => {
    WsMetadataStorage.getInstance().registerControllerMiddleware(target, guards);
  };
}
