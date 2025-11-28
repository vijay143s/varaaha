import crypto from "crypto";
import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";

import { env } from "../config/env.js";

export interface TokenPayload {
  sub: string;
  email: string;
  role: string;
}

export function createAccessToken(payload: TokenPayload): string {
  const options: SignOptions = {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions["expiresIn"]
  };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

export function createRefreshToken(payload: TokenPayload): string {
  // We store a random string in DB rather than the JWT itself for revocation simplicity.
  const random = crypto.randomBytes(64).toString("hex");
  const options: SignOptions = {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions["expiresIn"]
  };
  const token = jwt.sign({ ...payload, jti: random }, env.JWT_REFRESH_SECRET, options);
  return token;
}

export function hashToken(token: string): string {
  return crypto.createHash("sha512").update(token).digest("hex");
}

export function computeRefreshExpiry(): Date {
  const parsed = parseExpiryToSeconds(env.JWT_REFRESH_EXPIRES_IN);
  return new Date(Date.now() + parsed * 1000);
}

export function parseExpiryToSeconds(input = env.JWT_REFRESH_EXPIRES_IN): number {
  const raw = input ?? "7d";
  const regex = /^(\d+)([smhd])$/i;
  const match = regex.exec(raw.trim());
  if (!match) {
    // Fallback to 7 days in seconds
    return 7 * 24 * 60 * 60;
  }

  const amount = Number.parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case "s":
      return amount;
    case "m":
      return amount * 60;
    case "h":
      return amount * 60 * 60;
    case "d":
      return amount * 24 * 60 * 60;
    default:
      return 7 * 24 * 60 * 60;
  }
}

export function verifyAccessToken(token: string): TokenPayload & JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload & JwtPayload;
}

export function verifyRefreshToken(token: string): TokenPayload & JwtPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload & JwtPayload;
}
