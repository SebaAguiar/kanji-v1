import { z } from 'zod';

export const CreateProductSchema = z.object({
  name: z.string().min(2),
});

export const ProductResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type ProductResponse = z.infer<typeof ProductResponseSchema>;

export const ProductContracts = {
  create: {
    method: 'POST' as const,
    path: '/' as const,
    body: CreateProductSchema,
    responses: {
      201: ProductResponseSchema,
    },
  },
  findAll: {
    method: 'GET' as const,
    path: '/' as const,
    responses: {
      200: z.array(ProductResponseSchema),
    },
  },
  findOne: {
    method: 'GET' as const,
    path: '/:id' as const,
    responses: {
      200: ProductResponseSchema,
    },
  },
  update: {
    method: 'PATCH' as const,
    path: '/:id' as const,
    body: CreateProductSchema.partial(),
    responses: {
      200: ProductResponseSchema,
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
