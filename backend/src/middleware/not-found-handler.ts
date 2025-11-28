import type { Request, Response, NextFunction } from "express";

export function notFoundHandler(
  _req: Request,
  res: Response,
  _next: NextFunction
): Response {
  return res.status(404).json({
    success: false,
    error: "Resource not found"
  });
}
