import { Router } from "express";

import {
  cancelRazorpayPayment,
  confirmRazorpayPayment,
  initiateRazorpayPayment
} from "../controllers/payment.controller.js";
import { authenticated } from "../middleware/authenticated.js";
import { validateRequest } from "../middleware/validate-request.js";
import {
  cancelRazorpayPaymentSchema,
  confirmRazorpayPaymentSchema,
  createRazorpayPaymentSchema
} from "../schemas/payment.schema.js";

export const paymentRouter = Router();

paymentRouter.use(authenticated);

paymentRouter.post(
  "/razorpay/order",
  validateRequest(createRazorpayPaymentSchema),
  initiateRazorpayPayment
);
paymentRouter.post(
  "/razorpay/confirm",
  validateRequest(confirmRazorpayPaymentSchema),
  confirmRazorpayPayment
);
paymentRouter.post(
  "/razorpay/cancel",
  validateRequest(cancelRazorpayPaymentSchema),
  cancelRazorpayPayment
);
