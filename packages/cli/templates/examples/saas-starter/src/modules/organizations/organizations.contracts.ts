import { z } from 'zod';

export const CreateOrgInputSchema = z.object({
  name: z.string().min(2),
});

export const OrgResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.date().optional(),
});

export const OrgListResponseSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    role: z.string(), // Member's role in the organization
    createdAt: z.date().optional(),
  })
);

export const OrganizationContracts = {
  create: {
    method: 'POST' as const,
    path: '/' as const,
    request: {
      body: CreateOrgInputSchema,
    },
    responses: {
      201: OrgResponseSchema,
    },
  },
  findAll: {
    method: 'GET' as const,
    path: '/' as const,
    responses: {
      200: OrgListResponseSchema,
    },
  },
  findById: {
    method: 'GET' as const,
    path: '/:id' as const,
    responses: {
      200: OrgResponseSchema,
    },
  },
  update: {
    method: 'PATCH' as const,
    path: '/:id' as const,
    request: {
      body: CreateOrgInputSchema,
    },
    responses: {
      200: OrgResponseSchema,
    },
  },
  delete: {
    method: 'DELETE' as const,
    path: '/:id' as const,
    responses: {
      200: z.object({ success: z.boolean() }),
    },
  },
};

export type CreateOrgInput = z.infer<typeof CreateOrgInputSchema>;
