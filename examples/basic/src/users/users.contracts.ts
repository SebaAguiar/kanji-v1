import { z } from 'zod';

export const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
});

export const UserResponseSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
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
        id: z.string(),
        email: z.string().email(),
        name: z.string(),
      }),
    },
  },
};
