import 'reflect-metadata';
import { describe, it, expect, afterEach } from 'bun:test';
import { KanjijsAdapter } from '@kanjijs/platform-hono';
import { ZodValidator } from '@kanjijs/contracts';
import { ChatModule } from '../chat.module.js';
import { JWT_SECRET } from '../chat.gateway.js';
import jwt from 'jsonwebtoken';

function generateToken(overrides?: Record<string, unknown>): string {
  return jwt.sign(
    {
      userId: 'test-user',
      email: 'test@example.com',
      name: 'Test User',
      roles: ['user'],
      scopes: [],
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      ...overrides,
    },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
}

function createWsClient(url: string) {
  const queue: Array<{ event: string; data: unknown }> = [];
  const listeners = new Set<(msg: { event: string; data: unknown }) => void>();

  const ws = new WebSocket(url);
  ws.onmessage = (event: MessageEvent) => {
    try {
      const parsed = JSON.parse(event.data as string);
      queue.push(parsed);
      const notified = new Set(listeners);
      for (const listener of notified) {
        listener(parsed);
      }
    } catch {
      // ignore malformed messages
    }
  };

  return {
    ws,
    waitFor(
      eventName: string,
      timeoutMs = 5000,
    ): Promise<{ event: string; data: unknown }> {
      return this.waitForPredicate((m) => m.event === eventName, timeoutMs);
    },
    waitForPredicate(
      predicate: (msg: { event: string; data: unknown }) => boolean,
      timeoutMs = 5000,
    ): Promise<{ event: string; data: unknown }> {
      const existing = queue.find(predicate);
      if (existing) return Promise.resolve(existing);

      return new Promise((resolve, reject) => {
        let timer: any;
        const handler = (msg: { event: string; data: unknown }) => {
          if (predicate(msg)) {
            listeners.delete(handler);
            if (timer) clearTimeout(timer);
            resolve(msg);
          }
        };
        listeners.add(handler);
        timer = setTimeout(() => {
          listeners.delete(handler);
          reject(new Error(`Timeout waiting for event matching predicate`));
        }, timeoutMs);
      });
    },
    close() {
      ws.close();
    },
  };
}

describe('Real-time Chat App', () => {
  let appInstance: any;
  let port: number;

  afterEach(async () => {
    if (appInstance) {
      await appInstance.shutdown({ force: true });
      appInstance = null;
    }
  });

  it('should reject WebSocket connection without a token', async () => {
    appInstance = await KanjijsAdapter.create(ChatModule, {
      validator: new ZodValidator(),
      logger: false,
    });
    port = 11000 + Math.floor(Math.random() * 1000);
    appInstance.serve({ port });

    const result = await new Promise<string>((resolve) => {
      const client = new WebSocket(`ws://localhost:${port}/chat`);
      client.onerror = () => resolve('error');
      client.onopen = () => {
        resolve('open');
        client.close();
      };
      setTimeout(() => resolve('timeout'), 5000);
    });

    expect(result).toBe('error');
  });

  it('should connect with a valid token and receive connected event', async () => {
    appInstance = await KanjijsAdapter.create(ChatModule, {
      validator: new ZodValidator(),
      logger: false,
    });
    port = 12000 + Math.floor(Math.random() * 1000);
    appInstance.serve({ port });

    const token = generateToken();
    const client = createWsClient(`ws://localhost:${port}/chat?token=${token}`);

    const connected = await client.waitFor('connected');
    const data = connected.data as { userId: string; name: string; rooms: string[] };
    expect(data.userId).toBe('test-user');
    expect(data.name).toBe('Test User');
    expect(data.rooms).toContain('general');

    client.close();
  });

  it('should broadcast messages to all members in the same room', async () => {
    appInstance = await KanjijsAdapter.create(ChatModule, {
      validator: new ZodValidator(),
      logger: false,
    });
    port = 13000 + Math.floor(Math.random() * 1000);
    appInstance.serve({ port });

    const token1 = generateToken({ userId: 'user-1', name: 'Alice' });
    const token2 = generateToken({ userId: 'user-2', name: 'Bob' });

    const client1 = createWsClient(`ws://localhost:${port}/chat?token=${token1}`);
    const client2 = createWsClient(`ws://localhost:${port}/chat?token=${token2}`);

    // Wait for both to connect
    await Promise.all([client1.waitFor('connected'), client2.waitFor('connected')]);

    // Small delay for room registration
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Send message from client1
    client1.ws.send(
      JSON.stringify({ event: 'message', data: { room: 'general', text: 'Hello everyone!' } }),
    );

    // Client2 should receive it
    const msg = await client2.waitFor('new_message');
    const payload = msg.data as { userId: string; name: string; text: string };
    expect(payload.userId).toBe('user-1');
    expect(payload.name).toBe('Alice');
    expect(payload.text).toBe('Hello everyone!');

    client1.close();
    client2.close();
  });

  it('should allow joining a custom room and receiving room_joined with members', async () => {
    appInstance = await KanjijsAdapter.create(ChatModule, {
      validator: new ZodValidator(),
      logger: false,
    });
    port = 14000 + Math.floor(Math.random() * 1000);
    appInstance.serve({ port });

    const token = generateToken({ userId: 'user-1', name: 'Alice' });
    const client = createWsClient(`ws://localhost:${port}/chat?token=${token}`);

    // Wait for connected
    await client.waitFor('connected');

    // Join a custom room
    client.ws.send(JSON.stringify({ event: 'join', data: { room: 'room-alpha' } }));

    // Wait for room_joined for the CUSTOM room (not "general" from connect)
    const joined = await client.waitForPredicate(
      (m) => m.event === 'room_joined' && (m.data as { room: string }).room === 'room-alpha',
    );
    const data = joined.data as { room: string; members: Array<{ userId: string; name: string }> };
    expect(data.room).toBe('room-alpha');
    expect(data.members.some((m) => m.userId === 'user-1')).toBe(true);

    client.close();
  });

  it('should notify room members when a user disconnects', async () => {
    appInstance = await KanjijsAdapter.create(ChatModule, {
      validator: new ZodValidator(),
      logger: false,
    });
    port = 15000 + Math.floor(Math.random() * 1000);
    appInstance.serve({ port });

    const token1 = generateToken({ userId: 'user-1', name: 'Alice' });
    const token2 = generateToken({ userId: 'user-2', name: 'Bob' });

    const client1 = createWsClient(`ws://localhost:${port}/chat?token=${token1}`);
    const client2 = createWsClient(`ws://localhost:${port}/chat?token=${token2}`);

    // Wait for both to connect
    await Promise.all([client1.waitFor('connected'), client2.waitFor('connected')]);

    // Small delay for room registration
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Disconnect client1
    client1.close();

    // Client2 should get user_left notification
    const left = await client2.waitFor('user_left');
    const data = left.data as { userId: string };
    expect(data.userId).toBe('user-1');

    client2.close();
  });
});
