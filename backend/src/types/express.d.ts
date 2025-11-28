import type { JwtPayload } from "jsonwebtoken";
import type { TokenPayload } from "../utils/token.js";

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload & JwtPayload;
    }
  }
}

export {};
