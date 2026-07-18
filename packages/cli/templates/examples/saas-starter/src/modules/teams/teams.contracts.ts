import { z } from 'zod';

export const CreateTeamInputSchema = z.object({
  name: z.string().min(2),
});

export const TeamResponseSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  createdAt: z.date().optional(),
});

export const TeamContracts = {
  create: {
    method: 'POST' as const,
    path: '/:orgId/teams' as const,
    request: {
      body: CreateTeamInputSchema,
    },
    responses: {
      201: TeamResponseSchema,
    },
  },
  findAll: {
    method: 'GET' as const,
    path: '/:orgId/teams' as const,
    responses: {
      200: z.array(TeamResponseSchema),
    },
  },
  findById: {
    method: 'GET' as const,
    path: '/:orgId/teams/:id' as const,
    responses: {
      200: TeamResponseSchema,
    },
  },
  update: {
    method: 'PATCH' as const,
    path: '/:orgId/teams/:id' as const,
    request: {
      body: CreateTeamInputSchema,
    },
    responses: {
      200: TeamResponseSchema,
    },
  },
  delete: {
    method: 'DELETE' as const,
    path: '/:orgId/teams/:id' as const,
    responses: {
      200: z.object({ success: z.boolean() }),
    },
  },
};

export type CreateTeamInput = z.infer<typeof CreateTeamInputSchema>;
