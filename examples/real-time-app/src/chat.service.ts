import { Injectable } from '@kanjijs/core';
import { WebSocketContext } from '@kanjijs/platform-hono';

interface RoomMember {
  ctx: WebSocketContext<any>;
  userId: string;
  name: string;
}

interface Room {
  name: string;
  members: Map<string, RoomMember>;
}

@Injectable()
export class ChatService {
  private rooms = new Map<string, Room>();

  getRoomNames(): string[] {
    return Array.from(this.rooms.keys());
  }

  joinRoom(roomName: string, ctx: WebSocketContext<any>, userId: string, userName: string): void {
    let room = this.rooms.get(roomName);
    if (!room) {
      room = { name: roomName, members: new Map() };
      this.rooms.set(roomName, room);
    }

    room.members.set(userId, { ctx, userId, name: userName });

    // Notify others in the room
    this.broadcastToRoom(roomName, 'user_joined', { userId, name: userName }, userId);

    // Notify the joining user of current members
    const members = Array.from(room.members.values()).map((m) => ({
      userId: m.userId,
      name: m.name,
    }));
    ctx.send('room_joined', { room: roomName, members });
  }

  leaveRoom(roomName: string, userId: string): void {
    const room = this.rooms.get(roomName);
    if (!room) return;

    room.members.delete(userId);

    this.broadcastToRoom(roomName, 'user_left', { userId });

    if (room.members.size === 0) {
      this.rooms.delete(roomName);
    }
  }

  leaveAllRooms(userId: string): void {
    for (const [roomName, room] of this.rooms) {
      if (room.members.has(userId)) {
        room.members.delete(userId);
        this.broadcastToRoom(roomName, 'user_left', { userId });

        if (room.members.size === 0) {
          this.rooms.delete(roomName);
        }
      }
    }
  }

  sendMessage(roomName: string, userId: string, userName: string, text: string): void {
    const message = {
      userId,
      name: userName,
      text,
      timestamp: Date.now(),
    };

    this.broadcastToRoom(roomName, 'new_message', message);
  }

  private broadcastToRoom(
    roomName: string,
    event: string,
    data: Record<string, unknown>,
    excludeUserId?: string,
  ): void {
    const room = this.rooms.get(roomName);
    if (!room) return;

    for (const [memberId, member] of room.members) {
      if (memberId !== excludeUserId) {
        try {
          member.ctx.send(event, data);
        } catch {
          // Connection may be closed; cleanup will happen on disconnect
          room.members.delete(memberId);
        }
      }
    }
  }
}
