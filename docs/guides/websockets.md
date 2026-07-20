# WebSocket Integration Guide

Kanji provides native high-performance WebSocket support powered directly by Bun's fast HTTP/WebSocket engine.

---

## 1. Creating a WebSocket Gateway

A Gateway is a modular class annotated with the `@WebSocketGateway` decorator that defines namespaces or paths.

```typescript
import { WebSocketGateway, SubscribeMessage, type WebSocketContext } from '@kanjijs/platform-hono';
import { Contract } from '@kanjijs/contracts';
import { z } from 'zod';

const MessageContract = z.object({
  room: z.string(),
  text: z.string(),
});

@WebSocketGateway('/chat')
export class ChatGateway {
  /**
   * Called automatically when a client connects.
   */
  handleConnection(ws: any) {
    console.log('Client connected:', ws.id);
  }

  /**
   * Called automatically when a client disconnects.
   */
  handleDisconnect(ws: any) {
    console.log('Client disconnected:', ws.id);
  }

  /**
   * Listens to 'send-message' events.
   * Payloads are strictly validated against the Contract.
   */
  @SubscribeMessage('send-message')
  @Contract(MessageContract)
  async onMessage(ctx: WebSocketContext<z.infer<typeof MessageContract>>) {
    const { room, text } = ctx.data;

    // Send a response back to the client
    ctx.send('message-received', { status: 'delivered' });

    // Or broadcast to a room
    ctx.broadcast(room, 'new-message', { text });
  }
}
```

---

## 2. Gateway Lifecycles

Gateways can implement interface methods to intercept connections and disconnections:

1. **`handleConnection(ws: BunWebSocket)`**: Useful to validate tokens, extract query parameters, and assign clients to specific groups.
2. **`handleDisconnect(ws: BunWebSocket)`**: Clean up active sessions, unsubscribe from rooms, and release resources.

---

## 3. Server Configuration & Boostrapping

WebSockets are automatically enabled when the Hono Adapter starts up if a gateway is registered within your active modules:

```typescript
import { Module } from '@kanjijs/core';
import { ChatGateway } from './chat.gateway.js';

@Module({
  providers: [ChatGateway],
})
export class ChatModule {}
```

No additional server setups are required; Kanji hijacks standard upgrading handshakes under the path specified (e.g. `ws://localhost:3000/chat`).
