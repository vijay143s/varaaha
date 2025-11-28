import { Router } from "express";

import { logout, refreshSession, signin, signup } from "../controllers/auth.controller.js";
import { validateRequest } from "../middleware/validate-request.js";
import { signinSchema, signupSchema } from "../schemas/auth.schema.js";

export const authRouter = Router();

authRouter.post("/signup", validateRequest(signupSchema), signup);
authRouter.post("/signin", validateRequest(signinSchema), signin);
authRouter.post("/refresh", refreshSession);
authRouter.post("/logout", logout);
