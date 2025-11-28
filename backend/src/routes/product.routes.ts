import { Router } from "express";

import {
  createProduct,
  deleteProduct,
  getProductBySlug,
  listProducts,
  updateProduct
} from "../controllers/product.controller.js";
import { authenticated } from "../middleware/authenticated.js";
import { requireRole } from "../middleware/require-role.js";
import { validateRequest } from "../middleware/validate-request.js";
import {
  createProductSchema,
  updateProductSchema
} from "../schemas/product.schema.js";

export const productRouter = Router();

productRouter.get("/", listProducts);
productRouter.get("/:slug", getProductBySlug);
productRouter.post(
  "/",
  authenticated,
  requireRole(["admin"]),
  validateRequest(createProductSchema),
  createProduct
);
productRouter.put(
  "/:id",
  authenticated,
  requireRole(["admin"]),
  validateRequest(updateProductSchema),
  updateProduct
);
productRouter.delete(
  "/:id",
  authenticated,
  requireRole(["admin"]),
  deleteProduct
);
