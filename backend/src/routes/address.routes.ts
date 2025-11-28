import { Router } from "express";

import {
  createAddress,
  deleteAddress,
  listAddresses,
  updateAddress
} from "../controllers/address.controller.js";
import { authenticated } from "../middleware/authenticated.js";
import { validateRequest } from "../middleware/validate-request.js";
import { addressSchema } from "../schemas/address.schema.js";

export const addressRouter = Router();

addressRouter.use(authenticated);

addressRouter.get("/", listAddresses);
addressRouter.post("/", validateRequest(addressSchema), createAddress);
addressRouter.put("/:id", validateRequest(addressSchema), updateAddress);
addressRouter.delete("/:id", deleteAddress);
