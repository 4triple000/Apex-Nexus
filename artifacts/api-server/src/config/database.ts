/**
 * Database configuration and connection pool settings.
 * The Drizzle ORM instance lives in @workspace/db — this file centralizes
 * query helpers and DB-level configuration.
 */

import { db, pool } from "@workspace/db";
import { logger } from "../lib/logger";

export { db, pool };

// ── Health check ─────────────────────────────────────────────────────────────
export async function checkDatabaseHealth(): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now();
  try {
    await pool.query("SELECT 1");
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    logger.error({ err }, "Database health check failed");
    return { ok: false, latencyMs: Date.now() - start };
  }
}

// ── Transaction helper ────────────────────────────────────────────────────────
export async function withTransaction<T>(
  fn: (tx: typeof db) => Promise<T>
): Promise<T> {
  return db.transaction(fn);
}
