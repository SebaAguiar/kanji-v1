import { z } from 'zod';

export const UserStatusSchema = z
  .enum(['active', 'inactive', 'pending'])
  .describe('The status of the user account');

export const CreateUserSchema = z.object({
  email: z.string().email().describe("The user's primary email address"),
  name: z.string().min(2).describe("The user's full name"),
});

export const UserResponseSchema = z.object({
  id: z.string().uuid().describe('Unique identifier for the user'),
  email: z.string().email().describe('Email address'),
  name: z.string().describe('Full name'),
  status: UserStatusSchema.optional(),
  createdAt: z.date().optional().describe('Timestamp when the user was created'),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UserResponse = z.infer<typeof UserResponseSchema>;

export const UserContracts = {
  create: {
    method: 'POST' as const,
    path: '/' as const,
    request: {
      body: CreateUserSchema,
    },
    responses: {
      201: UserResponseSchema,
    },
  },
  findAll: {
    method: 'GET' as const,
    path: '/' as const,
    responses: {
      200: z.array(UserResponseSchema),
    },
  },
  getMe: {
    method: 'GET' as const,
    path: '/me' as const,
    responses: {
      200: z.object({
        id: z.string().uuid(),
        email: z.string().email(),
        name: z.string(),
      }),
    },
  },
};
