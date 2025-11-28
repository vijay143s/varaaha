import type { NextFunction, Request, Response } from "express";
import { ZodError, type ZodTypeAny } from "zod";

export function validateRequest(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(422).json({
          success: false,
          error: "Validation failed",
          details: error.errors.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message
          }))
        });
        return;
      }

      next(error);
    }
  };
}
