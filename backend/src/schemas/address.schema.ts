import { z } from "zod";

export const addressSchema = z.object({
  fullName: z.string().min(2).max(191),
  phone: z.string().min(8).max(32).regex(/^[0-9+\-\s]+$/),
  addressLine1: z.string().min(3).max(191),
  addressLine2: z.string().max(191).optional(),
  city: z.string().min(2).max(100),
  state: z.string().min(2).max(100),
  postalCode: z.string().min(3).max(20),
  country: z.string().min(2).max(100).default("India"),
  isDefault: z.boolean().optional()
});

export type AddressInput = z.infer<typeof addressSchema>;
