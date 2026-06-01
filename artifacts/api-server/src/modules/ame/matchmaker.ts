/**
 * Apex Multiplayer Engine — Matchmaking System
 *
 * Players join a queue per mode+region.
 * Every 3 seconds the matchmaker groups ready players into matches.
 * Swap the in-memory queues for Redis sorted-sets for production.
 */

import type { QueueEntry, GameMode } from "./models";
import { createRoomFromQueue } from "./roomManager";
import { logger } from "../../lib/logger";

// ── Queue store: mode:region → entries ────────────────────────────────────────
const queues = new Map<string, QueueEntry[]>();
// reverse index: playerId → queue key
const playerQueueIndex = new Map<string, string>();

const MATCH_SIZES: Record<GameMode, number> = {
  tdm: 4,    // MVP: 4 players for a quick match (configurable up to 10)
  ffa: 3,
  battle: 2, // MVP: 2 players minimum
};

function queueKey(mode: GameMode, region: string): string {
  return `${mode}:${region}`;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function enqueuePlayer(
  playerId: string,
  name: string,
  mode: GameMode,
  region = 'us-east',
  socketId?: string
): { position: number; key: string } {
  // Remove from any existing queue first
  dequeuePlayer(playerId);

  const key = queueKey(mode, region);
  if (!queues.has(key)) queues.set(key, []);

  const queue = queues.get(key)!;
  const entry: QueueEntry = {
    playerId,
    name,
    mode,
    region,
    enqueuedAt: Date.now(),
    socketId,
  };
  queue.push(entry);
  playerQueueIndex.set(playerId, key);

  logger.info({ playerId, mode, region, position: queue.length }, '[AME] Player enqueued');
  return { position: queue.length, key };
}

export function dequeuePlayer(playerId: string): boolean {
  const key = playerQueueIndex.get(playerId);
  if (!key) return false;

  const queue = queues.get(key);
  if (queue) {
    const idx = queue.findIndex(e => e.playerId === playerId);
    if (idx !== -1) queue.splice(idx, 1);
  }
  playerQueueIndex.delete(playerId);
  return true;
}

export function getQueueStatus(
  playerId: string
): { position: number; mode: GameMode; region: string; waitMs: number } | null {
  const key = playerQueueIndex.get(playerId);
  if (!key) return null;

  const queue = queues.get(key);
  if (!queue) return null;

  const idx = queue.findIndex(e => e.playerId === playerId);
  if (idx === -1) return null;

  const entry = queue[idx]!;
  return {
    position: idx + 1,
    mode: entry.mode,
    region: entry.region,
    waitMs: Date.now() - entry.enqueuedAt,
  };
}

export function updateQueueSocketId(playerId: string, socketId: string): void {
  const key = playerQueueIndex.get(playerId);
  if (!key) return;
  const queue = queues.get(key);
  const entry = queue?.find(e => e.playerId === playerId);
  if (entry) entry.socketId = socketId;
}

// ── Match-making loop ─────────────────────────────────────────────────────────

type MatchCreatedCallback = (roomId: string, players: QueueEntry[]) => void;

let loopInterval: ReturnType<typeof setInterval> | null = null;

export function startMatchmakerLoop(onMatchCreated: MatchCreatedCallback): void {
  if (loopInterval) return; // already running

  loopInterval = setInterval(() => {
    runMatchmakerTick(onMatchCreated);
  }, 3_000);

  logger.info('[AME] Matchmaker loop started (3s interval)');
}

export function stopMatchmakerLoop(): void {
  if (loopInterval) {
    clearInterval(loopInterval);
    loopInterval = null;
    logger.info('[AME] Matchmaker loop stopped');
  }
}

function runMatchmakerTick(onMatchCreated: MatchCreatedCallback): void {
  for (const [key, queue] of queues.entries()) {
    const parts = key.split(':');
    const mode = parts[0] as GameMode;
    const minSize = MATCH_SIZES[mode] ?? 2;

    while (queue.length >= minSize) {
      // Pull minSize players (up to 10)
      const batchSize = Math.min(queue.length, 10);
      const batch = queue.splice(0, batchSize);

      // Clean reverse index
      for (const entry of batch) {
        playerQueueIndex.delete(entry.playerId);
      }

      const room = createRoomFromQueue(batch);
      logger.info({ roomId: room.roomId, mode, players: batch.length }, '[AME] Match created from queue');
      onMatchCreated(room.roomId, batch);
    }
  }
}

export function getQueueStats(): Record<string, number> {
  const stats: Record<string, number> = {};
  for (const [key, queue] of queues.entries()) {
    stats[key] = queue.length;
  }
  return stats;
}
