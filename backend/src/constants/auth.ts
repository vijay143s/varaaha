import { isProduction } from "../config/env.js";
import { parseExpiryToSeconds } from "../utils/token.js";

export const REFRESH_TOKEN_COOKIE = "varaaha_refresh_token";

export const refreshTokenCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "strict" : "lax",
  path: "/api/auth",
  maxAge: parseExpiryToSeconds() * 1000
} as const;
