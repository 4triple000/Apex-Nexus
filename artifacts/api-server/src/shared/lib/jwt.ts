/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  APEX JWT LAYER                                                          ║
 * ║  Sign + verify access tokens (15m) and refresh tokens (30d)             ║
 * ║  Uses SESSION_SECRET — no extra env var needed                           ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */
import jwt from "jsonwebtoken";
import { env } from "../../config/env";

// ── Token shapes ──────────────────────────────────────────────────────────────

export interface AccessTokenPayload {
  sub:       string;         // userId (string form)
  userId:    number;
  sessionId: string;
  tier:      "free" | "pro" | "creator_pro" | "enterprise";
  type:      "access";
}

export interface RefreshTokenPayload {
  sub:       string;
  userId:    number;
  sessionId: string;
  type:      "refresh";
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ACCESS_TTL  = "15m";
const REFRESH_TTL = "30d";

function secret(): string {
  return env.sessionSecret;
}

// ── Sign ──────────────────────────────────────────────────────────────────────

export function signAccessToken(
  userId:    number,
  sessionId: string,
  tier:      AccessTokenPayload["tier"] = "free",
): string {
  const payload: Omit<AccessTokenPayload, "sub"> & { sub: string } = {
    sub:       String(userId),
    userId,
    sessionId,
    tier,
    type: "access",
  };
  return jwt.sign(payload, secret(), { expiresIn: ACCESS_TTL, algorithm: "HS256" });
}

export function signRefreshToken(userId: number, sessionId: string): string {
  const payload: Omit<RefreshTokenPayload, "sub"> & { sub: string } = {
    sub: String(userId),
    userId,
    sessionId,
    type: "refresh",
  };
  return jwt.sign(payload, secret(), { expiresIn: REFRESH_TTL, algorithm: "HS256" });
}

// ── Verify ────────────────────────────────────────────────────────────────────

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const payload = jwt.verify(token, secret(), { algorithms: ["HS256"] }) as AccessTokenPayload;
    if (payload.type !== "access") return null;
    return payload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload | null {
  try {
    const payload = jwt.verify(token, secret(), { algorithms: ["HS256"] }) as RefreshTokenPayload;
    if (payload.type !== "refresh") return null;
    return payload;
  } catch {
    return null;
  }
}

// ── Token pair ────────────────────────────────────────────────────────────────

export function issueTokenPair(
  userId:    number,
  sessionId: string,
  tier:      AccessTokenPayload["tier"] = "free",
): { accessToken: string; refreshToken: string; expiresIn: number } {
  return {
    accessToken:  signAccessToken(userId, sessionId, tier),
    refreshToken: signRefreshToken(userId, sessionId),
    expiresIn:    15 * 60, // seconds
  };
}
