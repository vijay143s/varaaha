import { z } from "zod";

const productImageSchema = z.object({
  imageUrl: z.string().min(1),
  altText: z.string().max(191).optional(),
  isPrimary: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional()
});

export const createProductSchema = z.object({
  name: z.string().min(2).max(191),
  slug: z
    .string()
    .min(2)
    .max(191)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  shortDescription: z.string().max(255).optional(),
  description: z.string().optional(),
  price: z.number().positive(),
  unit: z.string().min(1).max(32).default("liter"),
  isActive: z.boolean().optional(),
  images: z.array(productImageSchema).optional()
});

export const updateProductSchema = createProductSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
    path: []
  });

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
