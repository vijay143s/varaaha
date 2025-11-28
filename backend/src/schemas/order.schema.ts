import { z } from "zod";

import { addressSchema } from "./address.schema.js";

const orderItemSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().positive().max(999)
});

const weekdayEnum = z.enum([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday"
]);

export const createOrderSchema = z
  .object({
    items: z.array(orderItemSchema).nonempty(),
    paymentMethod: z.string().max(50).default("cash_on_delivery"),
    couponCode: z
      .string()
      .trim()
      .min(3)
      .max(50)
      .optional(),
    shippingAddressId: z.number().int().positive().optional(),
    billingAddressId: z.number().int().positive().optional(),
    shippingAddress: addressSchema.optional(),
    billingAddress: addressSchema.optional(),
    notes: z.string().max(500).optional(),
    orderType: z.enum(["one_time", "scheduled"]).default("one_time"),
    scheduleStartDate: z.coerce.date().optional(),
    scheduleEndDate: z.coerce.date().optional(),
    scheduleExceptDays: z.array(weekdayEnum).max(7).optional().default([]),
    schedulePause: z.boolean().optional().default(false)
  })
  .refine((data) => data.shippingAddressId || data.shippingAddress, {
    message: "Shipping address is required",
    path: ["shippingAddress"]
  })
  .refine((data) => {
    if (data.orderType === "scheduled") {
      return Boolean(data.scheduleStartDate);
    }
    return true;
  }, {
    message: "Schedule start date is required for scheduled deliveries",
    path: ["scheduleStartDate"]
  })
  .refine((data) => {
    if (data.orderType === "scheduled" && data.scheduleStartDate && data.scheduleEndDate) {
      return data.scheduleEndDate >= data.scheduleStartDate;
    }
    return true;
  }, {
    message: "Schedule end date must be after the start date",
    path: ["scheduleEndDate"]
  });

export const updateOrderStatusSchema = z.object({
  status: z.enum([
    "pending",
    "confirmed",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
    "refunded"
  ]),
  paymentStatus: z
    .enum(["pending", "paid", "failed", "refunded"])
    .optional()
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
