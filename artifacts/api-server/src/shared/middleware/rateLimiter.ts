/**
 * Rate limiting middleware for Apex backend.
 *
 * Uses an in-memory sliding window counter keyed by session ID (or IP fallback).
 * Production systems should replace this with Redis-backed rate limiting.
 */

import type { Response, NextFunction } from "express";
import type { ApexRequest } from "../types";
import { tooManyRequests } from "../utils/response";
import { env } from "../../config/env";

interface WindowEntry {
  count: number;
  resetAt: number;
}

const windows = new Map<string, WindowEntry>();

// Clean up old windows every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of windows.entries()) {
    if (entry.resetAt < now) windows.delete(key);
  }
}, 5 * 60_000);

function getRateLimitKey(req: ApexRequest): string {
  return req.sessionId || req.ip || "anonymous";
}

// ── General rate limiter (configurable) ──────────────────────────────────────
export function createRateLimiter(opts?: { windowMs?: number; max?: number; message?: string }) {
  const windowMs = opts?.windowMs ?? env.rateLimitWindowMs;
  const max = opts?.max ?? env.rateLimitMaxRequests;
  const message = opts?.message ?? "Too many requests. Please slow down.";

  return function rateLimiter(req: ApexRequest, res: Response, next: NextFunction): void {
    const key = getRateLimitKey(req);
    const now = Date.now();

    let entry = windows.get(key);
    if (!entry || entry.resetAt < now) {
      entry = { count: 0, resetAt: now + windowMs };
      windows.set(key, entry);
    }

    entry.count++;

    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, max - entry.count));
    res.setHeader("X-RateLimit-Reset", Math.ceil(entry.resetAt / 1000));

    if (entry.count > max) {
      tooManyRequests(res, message);
      return;
    }

    next();
  };
}

// ── Preconfigured limiters ────────────────────────────────────────────────────
export const apiLimiter = createRateLimiter({ windowMs: 60_000, max: 60 });

export const aiLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 20,
  message: "AI request limit reached. Upgrade to Pro for higher limits.",
});

export const authLimiter = createRateLimiter({
  windowMs: 15 * 60_000, // 15 minutes
  max: 10,
  message: "Too many auth attempts. Please wait 15 minutes.",
});
