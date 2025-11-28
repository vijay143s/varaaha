import { z } from "zod";

const couponItemSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().positive().max(999)
});

export const applyCouponSchema = z.object({
  code: z.string().trim().min(3).max(50),
  items: z.array(couponItemSchema).nonempty()
});

export type ApplyCouponInput = z.infer<typeof applyCouponSchema>;
