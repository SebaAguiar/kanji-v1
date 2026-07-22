import { Injectable, Inject } from '@kanjijs/core';
import { WebSocketGateway, WebSocketMessage, WebSocketEvent, UseWsGuards, WebSocketContext } from '@kanjijs/platform-hono';
import { Contract } from '@kanjijs/contracts';
import { env } from '@kanjijs/common';
import { z } from 'zod';
import { createWsAuthGuard } from './auth/ws-auth.guard.js';
import { ChatService } from './chat.service.js';
import { JoinRoomSchema, LeaveRoomSchema, SendMessageSchema } from './dto/schemas.js';

export const JWT_SECRET = env('JWT_SECRET', z.string().default('dev-secret-for-example'));

@Injectable()
@WebSocketGateway('/chat')
@UseWsGuards(createWsAuthGuard(JWT_SECRET))
export class ChatGateway {
  constructor(
    @Inject(ChatService)
    private chatService: ChatService,
  ) {}

  @WebSocketEvent('connect')
  onConnect(ctx: WebSocketContext): void {
    const user = ctx.get('kanji.auth.user');
    if (!user) {
      ctx.close(4001, 'Unauthorized');
      return;
    }

    // Join the default "general" room on connect
    this.chatService.joinRoom('general', ctx, user.id, user.name);

    ctx.send('connected', {
      userId: user.id,
      name: user.name,
      rooms: this.chatService.getRoomNames(),
    });
  }

  @WebSocketMessage('join')
  @Contract(JoinRoomSchema)
  onJoin(ctx: WebSocketContext<{ room: string }>): void {
    const user = ctx.get('kanji.auth.user');
    if (!user) return;
    const { room } = ctx.validatedBody!;
    this.chatService.joinRoom(room, ctx, user.id, user.name);
  }

  @WebSocketMessage('leave')
  @Contract(LeaveRoomSchema)
  onLeave(ctx: WebSocketContext<{ room: string }>): void {
    const user = ctx.get('kanji.auth.user');
    if (!user) return;
    const { room } = ctx.validatedBody!;
    this.chatService.leaveRoom(room, user.id);
    ctx.send('room_left', { room });
  }

  @WebSocketMessage('message')
  @Contract(SendMessageSchema)
  onMessage(ctx: WebSocketContext<{ room: string; text: string }>): void {
    const user = ctx.get('kanji.auth.user');
    if (!user) return;
    const { room, text } = ctx.validatedBody!;
    this.chatService.sendMessage(room, user.id, user.name, text);
  }

  @WebSocketEvent('disconnect')
  onDisconnect(ctx: WebSocketContext): void {
    const user = ctx.get('kanji.auth.user');
    if (user) {
      this.chatService.leaveAllRooms(user.id);
    }
  }
}
