/**
 * Apex Multiplayer Engine — Lobby System
 *
 * In-memory lobby store with Redis-compatible interface.
 * Swap the Map for a Redis client in production for horizontal scaling.
 */

import { randomUUID } from "node:crypto";
import type { Lobby, LobbyPlayer, GameMode } from "./models";
import { logger } from "../../lib/logger";

// ── In-memory store (Redis-ready interface) ───────────────────────────────────
const lobbies = new Map<string, Lobby>();
// reverse index: playerId → lobbyId
const playerLobbyIndex = new Map<string, string>();

// ── Helpers ───────────────────────────────────────────────────────────────────
function getLobby(lobbyId: string): Lobby | undefined {
  return lobbies.get(lobbyId);
}

function getLobbyByPlayerId(playerId: string): Lobby | undefined {
  const id = playerLobbyIndex.get(playerId);
  return id ? lobbies.get(id) : undefined;
}

function saveLobby(lobby: Lobby): void {
  lobbies.set(lobby.lobbyId, lobby);
  for (const p of lobby.players) {
    playerLobbyIndex.set(p.playerId, lobby.lobbyId);
  }
}

function removeLobby(lobbyId: string): void {
  const lobby = lobbies.get(lobbyId);
  if (lobby) {
    for (const p of lobby.players) {
      playerLobbyIndex.delete(p.playerId);
    }
    lobbies.delete(lobbyId);
  }
}

function getAllLobbies(): Lobby[] {
  return Array.from(lobbies.values());
}

// ── Public API ────────────────────────────────────────────────────────────────

export function createLobby(
  hostId: string,
  hostName: string,
  mode: GameMode = 'tdm',
  region = 'us-east'
): Lobby {
  const lobby: Lobby = {
    lobbyId: randomUUID(),
    hostId,
    players: [{ playerId: hostId, name: hostName, ready: false }],
    mode,
    region,
    status: 'waiting',
    createdAt: Date.now(),
  };
  saveLobby(lobby);
  logger.info({ lobbyId: lobby.lobbyId, hostId, mode }, '[AME] Lobby created');
  return lobby;
}

export function joinLobby(
  lobbyId: string,
  playerId: string,
  playerName: string
): { ok: true; lobby: Lobby } | { ok: false; error: string } {
  const lobby = getLobby(lobbyId);
  if (!lobby) return { ok: false, error: 'Lobby not found' };
  if (lobby.status !== 'waiting') return { ok: false, error: 'Lobby already started' };
  if (lobby.players.length >= 10) return { ok: false, error: 'Lobby full' };
  if (lobby.players.some(p => p.playerId === playerId)) {
    return { ok: true, lobby };
  }

  lobby.players.push({ playerId, name: playerName, ready: false });
  saveLobby(lobby);
  logger.info({ lobbyId, playerId }, '[AME] Player joined lobby');
  return { ok: true, lobby };
}

export function setReady(
  lobbyId: string,
  playerId: string,
  ready: boolean
): { ok: true; lobby: Lobby; allReady: boolean } | { ok: false; error: string } {
  const lobby = getLobby(lobbyId);
  if (!lobby) return { ok: false, error: 'Lobby not found' };

  const player = lobby.players.find(p => p.playerId === playerId);
  if (!player) return { ok: false, error: 'Player not in lobby' };

  player.ready = ready;
  saveLobby(lobby);

  const allReady = lobby.players.length >= 2 && lobby.players.every(p => p.ready);
  if (allReady) {
    lobby.status = 'starting';
    saveLobby(lobby);
    logger.info({ lobbyId }, '[AME] All players ready — lobby starting');
  }

  return { ok: true, lobby, allReady };
}

export function invitePlayer(
  lobbyId: string,
  targetPlayerId: string
): { ok: true; lobbyId: string } | { ok: false; error: string } {
  const lobby = getLobby(lobbyId);
  if (!lobby) return { ok: false, error: 'Lobby not found' };
  return { ok: true, lobbyId };
}

export function leaveLobby(lobbyId: string, playerId: string): void {
  const lobby = getLobby(lobbyId);
  if (!lobby) return;

  lobby.players = lobby.players.filter(p => p.playerId !== playerId);
  playerLobbyIndex.delete(playerId);

  if (lobby.players.length === 0 || lobby.hostId === playerId) {
    removeLobby(lobbyId);
    logger.info({ lobbyId }, '[AME] Lobby disbanded (host left or empty)');
  } else {
    saveLobby(lobby);
  }
}

export function deleteLobby(lobbyId: string): void {
  removeLobby(lobbyId);
}

export function markLobbyInGame(lobbyId: string): void {
  const lobby = getLobby(lobbyId);
  if (lobby) {
    lobby.status = 'in_game';
    saveLobby(lobby);
  }
}

export { getLobby, getLobbyByPlayerId, getAllLobbies };
