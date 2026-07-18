import { z } from 'zod';

export const SubResponseSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  plan: z.string(),
  status: z.string(),
  expiresAt: z.coerce.date().optional(), // Using z.coerce.date() as recommended in KNOWN-ERRORS.md
});

export const SubscribeInputSchema = z.object({
  orgId: z.string(),
  plan: z.enum(['free', 'pro', 'enterprise']),
});

export const BillingContracts = {
  getPlan: {
    method: 'GET' as const,
    path: '/plan' as const,
    request: {
      query: z.object({
        orgId: z.string(),
      }),
    },
    responses: {
      200: SubResponseSchema,
    },
  },
  subscribe: {
    method: 'POST' as const,
    path: '/subscribe' as const,
    request: {
      body: SubscribeInputSchema,
    },
    responses: {
      200: SubResponseSchema,
    },
  },
};

export type SubscribeInput = z.infer<typeof SubscribeInputSchema>;
export type SubResponse = z.infer<typeof SubResponseSchema>;
