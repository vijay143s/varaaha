import { Router, type Request, type Response } from "express";

import { authRouter } from "./auth.routes.js";
import { addressRouter } from "./address.routes.js";
import { productRouter } from "./product.routes.js";
import { orderRouter } from "./order.routes.js";
import { couponRouter } from "./coupon.routes.js";
import { paymentRouter } from "./payment.routes.js";

export const router = Router();

router.get("/health", (_req: Request, res: Response) => {
  return res.json({ success: true, message: "API is running" });
});

router.use("/auth", authRouter);
router.use("/products", productRouter);
router.use("/account/addresses", addressRouter);
router.use("/orders", orderRouter);
router.use("/coupons", couponRouter);
router.use("/payments", paymentRouter);
