import type { Context } from 'hono';

export interface WsConnection {
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export interface WebSocketContextVariables {
  'kanji.auth.user': { id: string; email: string; name: string; roles: string[] };
  'kanji.auth.session': Record<string, string>;
  'kanji.auth.roles': string[];
  'kanji.auth.scopes': string[];
  'kanji.requestId': string;
}

export class WebSocketContext<TBody = Record<string, never>> {
  constructor(
    private readonly ctx: Context,
    private readonly ws: WsConnection,
    private readonly validatedData?: TBody,
  ) {}

  get<K extends keyof WebSocketContextVariables>(key: K): WebSocketContextVariables[K] | undefined {
    return this.ctx.get(key as string) as WebSocketContextVariables[K] | undefined;
  }

  getCustomVar<T>(key: string): T | undefined {
    return this.ctx.get(key);
  }

  get validatedBody(): TBody | undefined {
    return this.validatedData;
  }

  send(event: string, data: object | string | number | boolean): void {
    this.ws.send(JSON.stringify({ event, data }));
  }

  close(code?: number, reason?: string): void {
    this.ws.close(code, reason);
  }

  get rawWs(): WsConnection {
    return this.ws;
  }

  get rawCtx(): Context {
    return this.ctx;
  }
}
