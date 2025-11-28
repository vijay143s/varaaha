import type { NextFunction, Request, Response } from "express";

export function requireRole(roles: Array<"admin" | "customer">) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role as "admin" | "customer")) {
      res.status(403).json({ success: false, error: "Forbidden" });
      return;
    }

    next();
  };
}
