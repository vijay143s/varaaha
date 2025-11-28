import { Router } from "express";

import {
  adminListOrders,
  createOrder,
  getOrderByNumber,
  listMyOrders,
  updateOrderStatus
} from "../controllers/order.controller.js";
import { authenticated } from "../middleware/authenticated.js";
import { requireRole } from "../middleware/require-role.js";
import { validateRequest } from "../middleware/validate-request.js";
import {
  createOrderSchema,
  updateOrderStatusSchema
} from "../schemas/order.schema.js";

export const orderRouter = Router();

orderRouter.use(authenticated);

orderRouter.get("/me", listMyOrders);
orderRouter.post("/", validateRequest(createOrderSchema), createOrder);
orderRouter.get("/:orderNumber", getOrderByNumber);

orderRouter.get("/", requireRole(["admin"]), adminListOrders);
orderRouter.patch(
  "/:orderNumber/status",
  requireRole(["admin"]),
  validateRequest(updateOrderStatusSchema),
  updateOrderStatus
);
