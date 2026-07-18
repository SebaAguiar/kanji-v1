import { z } from 'zod';

export const UserMeResponseSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: z.string(),
});

export const UpdateMeInputSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(2).optional(),
});

export const UserContracts = {
  getMe: {
    method: 'GET' as const,
    path: '/me' as const,
    responses: {
      200: UserMeResponseSchema,
    },
  },
  updateMe: {
    method: 'PATCH' as const,
    path: '/me' as const,
    request: {
      body: UpdateMeInputSchema,
    },
    responses: {
      200: UserMeResponseSchema,
    },
  },
};

export type UpdateMeInput = z.infer<typeof UpdateMeInputSchema>;
