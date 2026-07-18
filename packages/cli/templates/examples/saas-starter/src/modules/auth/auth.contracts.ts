import { z } from 'zod';

export const RegisterInputSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(6),
});

export const LoginInputSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const AuthUserResponseSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: z.string(),
});

export const AuthSuccessResponseSchema = z.object({
  token: z.string(),
  user: AuthUserResponseSchema,
});

export const AuthContracts = {
  register: {
    method: 'POST' as const,
    path: '/register' as const,
    request: {
      body: RegisterInputSchema,
    },
    responses: {
      201: AuthSuccessResponseSchema,
    },
  },
  login: {
    method: 'POST' as const,
    path: '/login' as const,
    request: {
      body: LoginInputSchema,
    },
    responses: {
      200: AuthSuccessResponseSchema,
    },
  },
};

export type RegisterInput = z.infer<typeof RegisterInputSchema>;
export type LoginInput = z.infer<typeof LoginInputSchema>;
