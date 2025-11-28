import type { NextFunction, Request, Response } from "express";

import {
  CouponError,
  calculatePricing
} from "../services/pricing.service.js";
import type { ApplyCouponInput } from "../schemas/coupon.schema.js";

export async function validateCoupon(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const payload = req.body as ApplyCouponInput;

  try {
    const pricing = await calculatePricing(payload.items, payload.code);

    if (!pricing.coupon) {
      res.status(404).json({ success: false, error: "Coupon not found" });
      return;
    }

    res.json({
      success: true,
      data: {
        code: pricing.coupon.code,
        description: pricing.coupon.description,
        discountType: pricing.coupon.discountType,
        discountValue: pricing.coupon.discountValue,
        discountAmount: pricing.discount,
        subtotal: pricing.subtotal,
        total: pricing.total
      }
    });
  } catch (error) {
    if (error instanceof CouponError) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }
    next(error);
  }
}
