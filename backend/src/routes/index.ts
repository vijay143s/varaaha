import { Router, type Request, type Response } from "express";

export const router = Router();

router.get("/health", (_req: Request, res: Response) => {
  return res.json({ success: true, message: "API is running" });
});
