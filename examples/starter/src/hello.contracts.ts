import { z } from 'zod';

export const HelloResponseSchema = z.object({
  message: z.string().describe('The greeting message'),
});

export const HelloContracts = {
  greet: {
    method: 'GET' as const,
    path: '/hello' as const,
    request: {
      query: z.object({
        name: z.string().default('World').describe('Name to greet'),
      }),
    },
    responses: {
      200: HelloResponseSchema,
    },
  },
};
