import type { NextFunction, Request, Response } from "express";

// Centralized error handler keeps response format consistent
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): Response {
  const status = err instanceof Error && "status" in err ? (err as { status?: number }).status ?? 500 : 500;
  const message = err instanceof Error ? err.message : "Internal server error";

  if (process.env.NODE_ENV !== "production") {
    console.error(err);
  }

  return res.status(status).json({
    success: false,
    error: message
  });
}
