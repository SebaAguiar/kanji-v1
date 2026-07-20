import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { z } from 'zod';
import { KanjijsModule, Injectable } from '@kanjijs/core';
import { KanjijsAdapter } from '../hono-adapter.js';
import { WebSocketGateway, WebSocketMessage, WebSocketEvent, UseWsGuards } from '../gateway/decorators.js';
import { WebSocketContext } from '../gateway/ws-context.js';
import { WsMetadataStorage } from '../gateway/ws-metadata-storage.js';
import { Contract } from '@kanjijs/contracts';
import type { MiddlewareHandler } from 'hono';
import { KANJI_CTX } from '../types.js';

// Mock auth guard and middleware
const mockAuthGuard: MiddlewareHandler = async (c, next) => {
  const token = c.req.query('token');
  if (!token || token !== 'valid-token') {
    c.status(401);
    return c.json({ error: 'Unauthorized' }, 401);
  }
  c.set(KANJI_CTX.AUTH_USER as string, { id: 'user-1', email: 'test@test.com', name: 'Test', roles: ['user'] });
  await next();
};

@WebSocketGateway('/ws-test')
class TestGateway {
  public static messagesReceived: any[] = [];
  public static eventsReceived: string[] = [];

  @WebSocketEvent('connect')
  onConnect(ctx: WebSocketContext) {
    TestGateway.eventsReceived.push('connect');
    ctx.send('welcome', { msg: 'hello' });
  }

  @WebSocketMessage('ping')
  @Contract({
    body: z.object({
      seq: z.number(),
    }),
  })
  onPing(ctx: WebSocketContext<{ seq: number }>) {
    const payload = ctx.validatedBody;
    TestGateway.messagesReceived.push(payload);
    ctx.send('pong', { seq: payload?.seq });
  }

  @WebSocketEvent('disconnect')
  onDisconnect(ctx: WebSocketContext) {
    TestGateway.eventsReceived.push('disconnect');
  }
}

@WebSocketGateway('/ws-auth')
class AuthGateway {
  public static eventsReceived: string[] = [];
  public static userInfo: any = null;

  @WebSocketEvent('connect')
  onConnect(ctx: WebSocketContext) {
    AuthGateway.eventsReceived.push('connect');
    const user = ctx.get(KANJI_CTX.AUTH_USER as any);
    AuthGateway.userInfo = user;
    ctx.send('auth_status', { authenticated: !!user });
  }

  @WebSocketMessage('ping')
  onPing(ctx: WebSocketContext) {
    ctx.send('pong', {});
  }

  @WebSocketEvent('disconnect')
  onDisconnect(ctx: WebSocketContext) {
    AuthGateway.eventsReceived.push('disconnect');
  }
}

@WebSocketGateway('/ws-error')
class ErrorGateway {
  public static errorReceived: string | null = null;

  @WebSocketEvent('connect')
  onConnect(ctx: WebSocketContext) {
    ctx.send('welcome', {});
  }

  @WebSocketMessage('crash')
  onCrash(ctx: WebSocketContext) {
    throw new Error('Simulated handler crash');
  }

  @WebSocketEvent('disconnect')
  onDisconnect(ctx: WebSocketContext) {
    ErrorGateway.errorReceived = 'disconnected';
  }
}

@KanjijsModule({
  gateways: [TestGateway, AuthGateway, ErrorGateway],
})
class TestAppModule {}

describe('WebSocket Support', () => {
  let appInstance: any;
  let port: number;

  beforeEach(() => {
    TestGateway.messagesReceived = [];
    TestGateway.eventsReceived = [];
    AuthGateway.eventsReceived = [];
    AuthGateway.userInfo = null;
    ErrorGateway.errorReceived = null;
  });

  afterEach(async () => {
    if (appInstance) {
      await appInstance.shutdown({ force: true });
      appInstance = null;
    }
  });

  it('should resolve and bootstrap WebSocket gateway correctly', async () => {
    appInstance = await KanjijsAdapter.create(TestAppModule, { logger: false });
    expect(appInstance.websocket).toBeDefined();

    port = 3000 + Math.floor(Math.random() * 1000);
    appInstance.serve({ port });

    const client = new WebSocket(`ws://localhost:${port}/ws-test`);

    const connectionPromise = new Promise<void>((resolve, reject) => {
      client.onopen = () => resolve();
      client.onerror = (e) => reject(e);
    });

    await connectionPromise;
    expect(TestGateway.eventsReceived).toContain('connect');

    client.close();
  });

  it('should route messages, parse JSON, execute @Contract and reply', async () => {
    appInstance = await KanjijsAdapter.create(TestAppModule, { logger: false });
    port = 4000 + Math.floor(Math.random() * 1000);
    appInstance.serve({ port });

    const client = new WebSocket(`ws://localhost:${port}/ws-test`);

    let responsePayload: any = null;
    const messagePromise = new Promise<void>((resolve) => {
      client.onmessage = (event) => {
        const parsed = JSON.parse(event.data);
        if (parsed.event === 'pong') {
          responsePayload = parsed.data;
          resolve();
        }
      };
    });

    await new Promise<void>((resolve) => {
      client.onopen = () => resolve();
    });

    // Send valid message
    client.send(
      JSON.stringify({
        event: 'ping',
        data: { seq: 42 },
      }),
    );

    await messagePromise;

    expect(TestGateway.messagesReceived).toHaveLength(1);
    expect(TestGateway.messagesReceived[0]).toEqual({ seq: 42 });
    expect(responsePayload).toEqual({ seq: 42 });

    client.close();
  });

  it('should return VALIDATION_ERROR if contract validation fails', async () => {
    appInstance = await KanjijsAdapter.create(TestAppModule, { logger: false });
    port = 5000 + Math.floor(Math.random() * 1000);
    appInstance.serve({ port });

    const client = new WebSocket(`ws://localhost:${port}/ws-test`);

    let errorResponse: any = null;
    const errorPromise = new Promise<void>((resolve) => {
      client.onmessage = (event) => {
        const parsed = JSON.parse(event.data);
        if (parsed.event === 'error') {
          errorResponse = parsed.data;
          resolve();
        }
      };
    });

    await new Promise<void>((resolve) => {
      client.onopen = () => resolve();
    });

    // Send invalid payload (seq must be a number)
    client.send(
      JSON.stringify({
        event: 'ping',
        data: { seq: 'not-a-number' },
      }),
    );

    await errorPromise;

    expect(errorResponse.code).toBe('VALIDATION_ERROR');
    expect(errorResponse.issues).toBeDefined();

    client.close();
  });

  // ============================================================
  // New Server Lifecycle Tests
  // ============================================================

  it('should start listening when serve() is called and stop when shutdown() is called', async () => {
    appInstance = await KanjijsAdapter.create(TestAppModule, { logger: false });
    port = 6000 + Math.floor(Math.random() * 1000);

    // Register a simple HTTP test route to verify server state
    appInstance.app.get('/http-test', (c: any) => c.text('ok'));

    appInstance.serve({ port });

    // Verify it is responding to HTTP requests
    const res = await fetch(`http://localhost:${port}/http-test`, {
      headers: { Connection: 'close' },
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');

    // Graceful shutdown
    await appInstance.shutdown();

    // Give a small margin for the OS TCP port to be fully released
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify it is no longer accepting requests
    expect(fetch(`http://localhost:${port}/http-test`)).rejects.toThrow();
  });

  it('should disconnect active WebSocket clients immediately when shutdown({ force: true }) is called', async () => {
    appInstance = await KanjijsAdapter.create(TestAppModule, { logger: false });
    port = 7000 + Math.floor(Math.random() * 1000);
    appInstance.serve({ port });

    const client = new WebSocket(`ws://localhost:${port}/ws-test`);

    await new Promise<void>((resolve) => {
      client.onopen = () => resolve();
    });

    let disconnected = false;
    client.onclose = () => {
      disconnected = true;
    };

    // Call hard shutdown to force immediate disconnect
    await appInstance.shutdown({ force: true });

    // Give a very small margin for the client socket event loop to register the close event
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(disconnected).toBe(true);
  });

  it('should reject WebSocket upgrade when @UseWsGuards denies access', async () => {
    @WebSocketGateway('/ws-guard-test')
    @UseWsGuards(mockAuthGuard)
    class GuardedGateway {
      public static connected = false;

      @WebSocketEvent('connect')
      onConnect(ctx: WebSocketContext) {
        GuardedGateway.connected = true;
      }

      @WebSocketEvent('disconnect')
      onDisconnect(ctx: WebSocketContext) {
        // noop
      }
    }

    @KanjijsModule({ gateways: [GuardedGateway] })
    class GuardedModule {}

    const guardedApp = await KanjijsAdapter.create(GuardedModule, { logger: false });
    const guardPort = 8000 + Math.floor(Math.random() * 1000);
    guardedApp.serve({ port: guardPort });

    // Connect without token — should be rejected
    const connectionResult = await new Promise<string>((resolve) => {
      const client = new WebSocket(`ws://localhost:${guardPort}/ws-guard-test`);
      client.onerror = () => {
        resolve('error');
      };
      client.onopen = () => {
        resolve('open');
        client.close();
      };
      // Timeout safeguard
      setTimeout(() => resolve('timeout'), 5000);
    });

    expect(connectionResult).toBe('error');

    await guardedApp.shutdown({ force: true });
  });

  it('should return INTERNAL_ERROR when a handler throws', async () => {
    appInstance = await KanjijsAdapter.create(TestAppModule, { logger: false });
    port = 9000 + Math.floor(Math.random() * 1000);
    appInstance.serve({ port });

    const client = new WebSocket(`ws://localhost:${port}/ws-error`);

    await new Promise<void>((resolve) => {
      client.onopen = () => resolve();
    });

    // Send a message that triggers a crash
    const errorPromise = new Promise<{ code: string; message: string }>((resolve) => {
      client.onmessage = (event) => {
        const parsed = JSON.parse(event.data as string);
        if (parsed.event === 'error' && parsed.data?.code === 'INTERNAL_ERROR') {
          resolve(parsed.data);
        }
      };
    });

    client.send(JSON.stringify({ event: 'crash', data: {} }));

    const errorData = await errorPromise;

    expect(errorData.code).toBe('INTERNAL_ERROR');
    expect(errorData.message).toBe('Simulated handler crash');

    client.close();
  });

  it('should support multiple WebSocket gateways in the same app', async () => {
    appInstance = await KanjijsAdapter.create(TestAppModule, { logger: false });
    port = 10000 + Math.floor(Math.random() * 1000);
    appInstance.serve({ port });

    // Connect to first gateway
    const client1 = new WebSocket(`ws://localhost:${port}/ws-test`);
    let client1Connected = false;
    await new Promise<void>((resolve) => {
      client1.onopen = () => {
        client1Connected = true;
        resolve();
      };
    });
    expect(client1Connected).toBe(true);

    // Connect to second gateway
    const client2 = new WebSocket(`ws://localhost:${port}/ws-error`);
    let client2Connected = false;
    await new Promise<void>((resolve) => {
      client2.onopen = () => {
        client2Connected = true;
        resolve();
      };
    });
    expect(client2Connected).toBe(true);

    client1.close();
    client2.close();
  });
});
