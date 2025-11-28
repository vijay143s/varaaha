import { Router } from "express";

import { validateCoupon } from "../controllers/coupon.controller.js";
import { authenticated } from "../middleware/authenticated.js";
import { validateRequest } from "../middleware/validate-request.js";
import { applyCouponSchema } from "../schemas/coupon.schema.js";

export const couponRouter = Router();

couponRouter.use(authenticated);

couponRouter.post(
  "/validate",
  validateRequest(applyCouponSchema),
  validateCoupon
);
