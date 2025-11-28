import type { NextFunction, Request, Response } from "express";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { pool } from "../config/database.js";
import { REFRESH_TOKEN_COOKIE, refreshTokenCookieOptions } from "../constants/auth.js";
import type { SigninInput, SignupInput } from "../schemas/auth.schema.js";
import { comparePasswords, hashPassword } from "../utils/password.js";
import {
  computeRefreshExpiry,
  createAccessToken,
  createRefreshToken,
  hashToken,
  verifyRefreshToken
} from "../utils/token.js";

interface UserRow extends RowDataPacket {
  id: number;
  email: string;
  password_hash: string;
  full_name: string;
  phone: string | null;
  role: "customer" | "admin";
}

interface UserSessionRow extends RowDataPacket {
  id: number;
  user_id: number;
  refresh_token_hash: string;
  expires_at: Date;
}

function setRefreshTokenCookie(res: Response, token: string): void {
  res.cookie(REFRESH_TOKEN_COOKIE, token, refreshTokenCookieOptions);
}

function clearRefreshTokenCookie(res: Response): void {
  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    httpOnly: refreshTokenCookieOptions.httpOnly,
    secure: refreshTokenCookieOptions.secure,
    sameSite: refreshTokenCookieOptions.sameSite,
    path: refreshTokenCookieOptions.path
  });
}

function extractRefreshToken(req: Request): string | null {
  const fromCookie = req.cookies?.[REFRESH_TOKEN_COOKIE];
  if (typeof fromCookie === "string" && fromCookie.length > 0) {
    return fromCookie;
  }

  const fromBody = req.body?.refreshToken;
  if (typeof fromBody === "string" && fromBody.length > 0) {
    return fromBody;
  }

  return null;
}

export async function signup(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const payload = req.body as SignupInput;
  try {
    const [existing] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [payload.email]
    );

    if (existing.length > 0) {
      res.status(409).json({
        success: false,
        error: "Email already registered"
      });
      return;
    }

    const passwordHash = await hashPassword(payload.password);
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO users (email, password_hash, full_name, phone)
       VALUES (?, ?, ?, ?)`,
      [payload.email, passwordHash, payload.fullName, payload.phone ?? null]
    );

    const userId = result.insertId;

    const tokens = await issueTokens({
      userId,
      email: payload.email,
      role: "customer",
      userAgent: req.get("user-agent") ?? null,
      ipAddress: req.ip
    });

    setRefreshTokenCookie(res, tokens.refreshToken);

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: userId,
          email: payload.email,
          fullName: payload.fullName,
          phone: payload.phone ?? null,
          role: "customer"
        },
        tokens: {
          accessToken: tokens.accessToken,
          expiresAt: tokens.expiresAt
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function signin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const payload = req.body as SigninInput;
  try {
    const [rows] = await pool.query<UserRow[]>(
      `SELECT id, email, password_hash, full_name, phone, role
       FROM users WHERE email = ? LIMIT 1`,
      [payload.email]
    );

    if (rows.length === 0) {
      res.status(401).json({ success: false, error: "Invalid credentials" });
      return;
    }

    const user = rows[0];
    const isValid = await comparePasswords(payload.password, user.password_hash);
    if (!isValid) {
      res.status(401).json({ success: false, error: "Invalid credentials" });
      return;
    }

    const tokens = await issueTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
      userAgent: req.get("user-agent") ?? null,
      ipAddress: req.ip
    });

    setRefreshTokenCookie(res, tokens.refreshToken);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          phone: user.phone,
          role: user.role
        },
        tokens: {
          accessToken: tokens.accessToken,
          expiresAt: tokens.expiresAt
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function refreshSession(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractRefreshToken(req);
  if (!token) {
    clearRefreshTokenCookie(res);
    res.status(401).json({ success: false, error: "Refresh token missing" });
    return;
  }

  try {
    const payload = verifyRefreshToken(token);
    const userIdFromToken = Number.parseInt(payload.sub ?? "", 10);
    if (Number.isNaN(userIdFromToken)) {
      clearRefreshTokenCookie(res);
      res.status(401).json({ success: false, error: "Invalid refresh token subject" });
      return;
    }
    const hashed = hashToken(token);

    const [sessions] = await pool.query<UserSessionRow[]>(
      `SELECT id, user_id, refresh_token_hash, expires_at
       FROM user_sessions
       WHERE refresh_token_hash = ?
       LIMIT 1`,
      [hashed]
    );

    if (sessions.length === 0) {
      clearRefreshTokenCookie(res);
      res.status(401).json({ success: false, error: "Refresh session not found" });
      return;
    }

    const session = sessions[0];

    if (session.user_id !== userIdFromToken) {
      await pool.execute("DELETE FROM user_sessions WHERE id = ?", [session.id]);
      clearRefreshTokenCookie(res);
      res.status(401).json({ success: false, error: "Refresh token mismatch" });
      return;
    }

    if (new Date(session.expires_at).getTime() < Date.now()) {
      await pool.execute("DELETE FROM user_sessions WHERE id = ?", [session.id]);
      clearRefreshTokenCookie(res);
      res.status(401).json({ success: false, error: "Refresh token expired" });
      return;
    }

    const [users] = await pool.query<UserRow[]>(
      `SELECT id, email, full_name, phone, role
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userIdFromToken]
    );

    if (users.length === 0) {
      await pool.execute("DELETE FROM user_sessions WHERE id = ?", [session.id]);
      clearRefreshTokenCookie(res);
      res.status(401).json({ success: false, error: "User no longer exists" });
      return;
    }

    const user = users[0];

    const tokens = await issueTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
      userAgent: req.get("user-agent") ?? null,
      ipAddress: req.ip,
      sessionId: session.id
    });

    setRefreshTokenCookie(res, tokens.refreshToken);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          phone: user.phone,
          role: user.role
        },
        tokens: {
          accessToken: tokens.accessToken,
          expiresAt: tokens.expiresAt
        }
      }
    });
  } catch (_error) {
    clearRefreshTokenCookie(res);
    res.status(401).json({ success: false, error: "Invalid refresh token" });
  }
}

export async function logout(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractRefreshToken(req);
  if (!token) {
    clearRefreshTokenCookie(res);
    res.status(204).send();
    return;
  }

  try {
    const hashed = hashToken(token);
    await pool.execute("DELETE FROM user_sessions WHERE refresh_token_hash = ?", [hashed]);
    clearRefreshTokenCookie(res);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

interface IssueTokenInput {
  userId: number;
  email: string;
  role: string;
  userAgent: string | null;
  ipAddress: string | undefined;
  sessionId?: number;
}

async function issueTokens(
  input: IssueTokenInput
): Promise<{ accessToken: string; refreshToken: string; expiresAt: string }> {
  const payload = {
    sub: String(input.userId),
    email: input.email,
    role: input.role
  };

  const accessToken = createAccessToken(payload);
  const refreshToken = createRefreshToken(payload);
  const refreshTokenHash = hashToken(refreshToken);
  const expiresAt = computeRefreshExpiry();

  if (input.sessionId) {
    await pool.execute(
      `UPDATE user_sessions
       SET refresh_token_hash = ?, user_agent = ?, ip_address = ?, expires_at = ?
       WHERE id = ?`,
      [
        refreshTokenHash,
        input.userAgent,
        input.ipAddress ?? null,
        expiresAt,
        input.sessionId
      ]
    );
  } else {
    await pool.execute(
      `INSERT INTO user_sessions (user_id, refresh_token_hash, user_agent, ip_address, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        input.userId,
        refreshTokenHash,
        input.userAgent,
        input.ipAddress ?? null,
        expiresAt
      ]
    );
  }

  return {
    accessToken,
    refreshToken,
    expiresAt: expiresAt.toISOString()
  };
}
