/**
 * Standardized JSON response utilities.
 * Every route handler should use these to ensure consistent API responses.
 */

import type { Response } from "express";
import type { ApiResponse } from "../types";

const API_VERSION = "2.0.0";

function buildMeta() {
  return {
    timestamp: new Date().toISOString(),
    version: API_VERSION,
  };
}

export function success<T>(res: Response, data: T, status = 200): void {
  const body: ApiResponse<T> = {
    ok: true,
    data,
    meta: buildMeta(),
  };
  res.status(status).json(body);
}

export function created<T>(res: Response, data: T): void {
  success(res, data, 201);
}

export function badRequest(res: Response, error: string): void {
  const body: ApiResponse = { ok: false, error, meta: buildMeta() };
  res.status(400).json(body);
}

export function unauthorized(res: Response, error = "Unauthorized"): void {
  const body: ApiResponse = { ok: false, error, meta: buildMeta() };
  res.status(401).json(body);
}

export function forbidden(res: Response, error = "Forbidden"): void {
  const body: ApiResponse = { ok: false, error, meta: buildMeta() };
  res.status(403).json(body);
}

export function notFound(res: Response, error = "Not found"): void {
  const body: ApiResponse = { ok: false, error, meta: buildMeta() };
  res.status(404).json(body);
}

export function tooManyRequests(res: Response, error = "Rate limit exceeded. Upgrade your plan for higher limits."): void {
  const body: ApiResponse = { ok: false, error, meta: buildMeta() };
  res.status(429).json(body);
}

export function serverError(res: Response, error = "Internal server error"): void {
  const body: ApiResponse = { ok: false, error, meta: buildMeta() };
  res.status(500).json(body);
}

// ── Streaming helpers ─────────────────────────────────────────────────────────
export function startStream(res: Response): void {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
}

export function sendChunk(res: Response, data: unknown): void {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function endStream(res: Response): void {
  res.write("data: [DONE]\n\n");
  res.end();
}
