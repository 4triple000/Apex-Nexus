/**
 * Redis cache layer with graceful in-memory fallback.
 *
 * If REDIS_URL is set, uses Redis (ioredis).
 * Otherwise, falls back to a simple in-process LRU-style Map.
 */

import { logger } from "../lib/logger.js";

const TTL_SECONDS = {
  conversations: 60,
  messages: 30,
} as const;

// ─── In-process fallback cache ────────────────────────────────────────────────

const memCache = new Map<string, { value: string; expiresAt: number }>();

function memGet(key: string): string | null {
  const entry = memCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memCache.delete(key);
    return null;
  }
  return entry.value;
}

function memSet(key: string, value: string, ttlSeconds: number): void {
  memCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  if (memCache.size > 1000) {
    const firstKey = memCache.keys().next().value;
    if (firstKey) memCache.delete(firstKey);
  }
}

function memDel(key: string): void {
  memCache.delete(key);
}

// ─── Redis client (optional) ──────────────────────────────────────────────────

let redis: import("ioredis").Redis | null = null;

async function getRedis(): Promise<import("ioredis").Redis | null> {
  if (redis) return redis;
  if (!process.env.REDIS_URL) return null;

  try {
    const { default: Redis } = await import("ioredis");
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      lazyConnect: true,
    });
    await redis.connect();
    logger.info("[cache] Redis connected");
    return redis;
  } catch (err) {
    logger.warn({ err }, "[cache] Redis unavailable — using in-memory cache");
    redis = null;
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const r = await getRedis();
    const raw = r ? await r.get(key) : memGet(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number = TTL_SECONDS.conversations
): Promise<void> {
  try {
    const serialized = JSON.stringify(value);
    const r = await getRedis();
    if (r) {
      await r.set(key, serialized, "EX", ttlSeconds);
    } else {
      memSet(key, serialized, ttlSeconds);
    }
  } catch {
    // Cache failures are non-fatal
  }
}

export async function cacheDel(key: string): Promise<void> {
  try {
    const r = await getRedis();
    if (r) {
      await r.del(key);
    } else {
      memDel(key);
    }
  } catch {
    // Non-fatal
  }
}

export const CacheKeys = {
  conversations: (userId: string) => `apex:convos:${userId}`,
  messages: (conversationId: number) => `apex:msgs:${conversationId}`,
  suggestions: (conversationId: number) => `apex:sug:${conversationId}`,
} as const;

export { TTL_SECONDS };
