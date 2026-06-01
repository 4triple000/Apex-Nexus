/**
 * Apex Multiplayer Engine — Room Manager
 *
 * Manages active game room lifecycle: creation, player assignment,
 * state queries, and cleanup. Server-authoritative — all mutations
 * go through here before emitting to clients.
 */

import { randomUUID } from "node:crypto";
import type { Room, PlayerState, GameMode, MapName, QueueEntry } from "./models";
import { logger } from "../../lib/logger";

// ── In-memory store ───────────────────────────────────────────────────────────
const rooms = new Map<string, Room>();
// reverse index: playerId → roomId
const playerRoomIndex = new Map<string, string>();

const MAPS: MapName[] = ['desert', 'urban', 'forest'];
const MAX_PLAYERS_BY_MODE: Record<GameMode, number> = {
  tdm: 10,
  ffa: 8,
  battle: 64,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function randomMap(): MapName {
  return MAPS[Math.floor(Math.random() * MAPS.length)]!;
}

function defaultPlayerState(
  playerId: string,
  name: string,
  socketId: string
): PlayerState {
  return {
    playerId,
    name,
    x: Math.random() * 100 - 50,
    y: 0,
    z: Math.random() * 100 - 50,
    yaw: 0,
    hp: 100,
    alive: true,
    kills: 0,
    deaths: 0,
    socketId,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export function createRoom(
  entries: Array<{ playerId: string; name: string; socketId?: string }>,
  mode: GameMode,
  map?: MapName,
  lobbyId?: string
): Room {
  const roomId = randomUUID();
  const chosenMap = map ?? randomMap();

  const players: Record<string, PlayerState> = {};
  const scoreboard: Record<string, { kills: number; deaths: number }> = {};

  for (const e of entries) {
    const state = defaultPlayerState(e.playerId, e.name, e.socketId ?? '');
    players[e.playerId] = state;
    scoreboard[e.playerId] = { kills: 0, deaths: 0 };
    playerRoomIndex.set(e.playerId, roomId);
  }

  const room: Room = {
    roomId,
    lobbyId,
    players,
    projectiles: [],
    scoreboard,
    map: chosenMap,
    mode,
    status: 'active',
    maxPlayers: MAX_PLAYERS_BY_MODE[mode],
    startedAt: Date.now(),
  };

  rooms.set(roomId, room);
  logger.info({ roomId, mode, map: chosenMap, players: entries.length }, '[AME] Room created');
  return room;
}

export function addPlayerToRoom(
  roomId: string,
  playerId: string,
  name: string,
  socketId: string
): PlayerState | null {
  const room = rooms.get(roomId);
  if (!room || room.status !== 'active') return null;
  if (Object.keys(room.players).length >= room.maxPlayers) return null;

  const state = defaultPlayerState(playerId, name, socketId);
  room.players[playerId] = state;
  room.scoreboard[playerId] = { kills: 0, deaths: 0 };
  playerRoomIndex.set(playerId, roomId);
  return state;
}

export function updatePlayerSocketId(playerId: string, socketId: string): void {
  const roomId = playerRoomIndex.get(playerId);
  if (!roomId) return;
  const room = rooms.get(roomId);
  if (!room) return;
  const p = room.players[playerId];
  if (p) p.socketId = socketId;
}

export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

export function getRoomByPlayer(playerId: string): Room | undefined {
  const roomId = playerRoomIndex.get(playerId);
  return roomId ? rooms.get(roomId) : undefined;
}

export function getAllRooms(): Room[] {
  return Array.from(rooms.values());
}

export function getActiveRooms(): Room[] {
  return getAllRooms().filter(r => r.status === 'active');
}

export function removePlayerFromRoom(playerId: string): void {
  const roomId = playerRoomIndex.get(playerId);
  if (!roomId) return;
  const room = rooms.get(roomId);
  if (!room) return;

  playerRoomIndex.delete(playerId);
  delete room.players[playerId];

  if (Object.keys(room.players).length === 0) {
    endRoom(roomId);
  }
}

export function endRoom(roomId: string): void {
  const room = rooms.get(roomId);
  if (!room) return;
  room.status = 'ended';
  room.endedAt = Date.now();

  for (const playerId of Object.keys(room.players)) {
    playerRoomIndex.delete(playerId);
  }

  // Clean up after 60s
  setTimeout(() => rooms.delete(roomId), 60_000);
  logger.info({ roomId }, '[AME] Room ended');
}

export function createRoomFromQueue(entries: QueueEntry[]): Room {
  const mode = entries[0]?.mode ?? 'tdm';
  return createRoom(
    entries.map(e => ({ playerId: e.playerId, name: e.name, socketId: e.socketId })),
    mode
  );
}
