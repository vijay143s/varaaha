import { z } from "zod";

const paymentItemSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().positive().max(999)
});

export const createRazorpayPaymentSchema = z.object({
  items: z.array(paymentItemSchema).nonempty(),
  couponCode: z
    .string()
    .trim()
    .min(3)
    .max(50)
    .optional()
});

export const confirmRazorpayPaymentSchema = z.object({
  transactionId: z.number().int().positive(),
  razorpayOrderId: z.string().min(10),
  razorpayPaymentId: z.string().min(10),
  razorpaySignature: z.string().min(10)
});

export const cancelRazorpayPaymentSchema = z.object({
  transactionId: z.number().int().positive(),
  reason: z
    .string()
    .trim()
    .min(3)
    .max(200)
    .optional()
});

export type CreateRazorpayPaymentInput = z.infer<typeof createRazorpayPaymentSchema>;
export type ConfirmRazorpayPaymentInput = z.infer<typeof confirmRazorpayPaymentSchema>;
export type CancelRazorpayPaymentInput = z.infer<typeof cancelRazorpayPaymentSchema>;
