import type { NextFunction, Request, Response } from "express";

import { verifyAccessToken } from "../utils/token.js";

export function authenticated(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.get("authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (_error) {
    res.status(401).json({ success: false, error: "Invalid or expired token" });
  }
}
