import { z } from 'zod';

export const JoinRoomSchema = {
  body: z.object({
    room: z.string().min(1).max(64),
  }),
};

export const LeaveRoomSchema = {
  body: z.object({
    room: z.string().min(1).max(64),
  }),
};

export const SendMessageSchema = {
  body: z.object({
    room: z.string().min(1).max(64),
    text: z.string().min(1).max(1000),
  }),
};

export type JoinRoomInput = z.infer<typeof JoinRoomSchema.body>;
export type LeaveRoomInput = z.infer<typeof LeaveRoomSchema.body>;
export type SendMessageInput = z.infer<typeof SendMessageSchema.body>;
