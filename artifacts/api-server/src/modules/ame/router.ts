/**
 * Apex Multiplayer Engine — REST API Router
 *
 * POST /api/ame/create-lobby         — create a new lobby
 * POST /api/ame/join-lobby           — join an existing lobby
 * POST /api/ame/ready                — toggle ready state
 * POST /api/ame/start-matchmaking    — enter matchmaking queue
 * POST /api/ame/leave-matchmaking    — leave queue
 * GET  /api/ame/status/:playerId     — queue/room/lobby status
 * GET  /api/ame/rooms                — active room list (debug dashboard)
 * GET  /api/ame/lobbies              — active lobby list (debug dashboard)
 * GET  /api/ame/queue-stats          — matchmaking queue sizes
 */

import { Router } from "express";
import type { GameMode } from "./models";
import {
  createLobby,
  joinLobby,
  setReady,
  getLobby,
  getLobbyByPlayerId,
  getAllLobbies,
} from "./lobby";
import {
  enqueuePlayer,
  dequeuePlayer,
  getQueueStatus,
  getQueueStats,
} from "./matchmaker";
import {
  getRoom,
  getRoomByPlayer,
  getActiveRooms,
} from "./roomManager";

const router = Router();

// ── POST /api/ame/create-lobby ────────────────────────────────────────────────
router.post('/ame/create-lobby', (req, res) => {
  const { hostId, hostName, mode, region } = req.body as {
    hostId?: string;
    hostName?: string;
    mode?: GameMode;
    region?: string;
  };

  if (!hostId || !hostName) {
    res.status(400).json({ ok: false, error: 'hostId and hostName are required' });
    return;
  }

  const lobby = createLobby(hostId, hostName, mode ?? 'tdm', region ?? 'us-east');
  res.status(201).json({ ok: true, lobby });
});

// ── POST /api/ame/join-lobby ──────────────────────────────────────────────────
router.post('/ame/join-lobby', (req, res) => {
  const { lobbyId, playerId, playerName } = req.body as {
    lobbyId?: string;
    playerId?: string;
    playerName?: string;
  };

  if (!lobbyId || !playerId || !playerName) {
    res.status(400).json({ ok: false, error: 'lobbyId, playerId, and playerName are required' });
    return;
  }

  const result = joinLobby(lobbyId, playerId, playerName);
  if (!result.ok) {
    res.status(400).json(result);
    return;
  }
  res.json(result);
});

// ── POST /api/ame/ready ───────────────────────────────────────────────────────
router.post('/ame/ready', (req, res) => {
  const { lobbyId, playerId, ready = true } = req.body as {
    lobbyId?: string;
    playerId?: string;
    ready?: boolean;
  };

  if (!lobbyId || !playerId) {
    res.status(400).json({ ok: false, error: 'lobbyId and playerId are required' });
    return;
  }

  const result = setReady(lobbyId, playerId, ready);
  if (!result.ok) {
    res.status(400).json(result);
    return;
  }
  res.json(result);
});

// ── POST /api/ame/start-matchmaking ──────────────────────────────────────────
router.post('/ame/start-matchmaking', (req, res) => {
  const { playerId, playerName, mode, region } = req.body as {
    playerId?: string;
    playerName?: string;
    mode?: GameMode;
    region?: string;
  };

  if (!playerId || !playerName) {
    res.status(400).json({ ok: false, error: 'playerId and playerName are required' });
    return;
  }

  const result = enqueuePlayer(
    playerId,
    playerName,
    mode ?? 'tdm',
    region ?? 'us-east'
  );
  res.status(202).json({ ok: true, ...result, message: 'Added to matchmaking queue' });
});

// ── POST /api/ame/leave-matchmaking ──────────────────────────────────────────
router.post('/ame/leave-matchmaking', (req, res) => {
  const { playerId } = req.body as { playerId?: string };
  if (!playerId) {
    res.status(400).json({ ok: false, error: 'playerId is required' });
    return;
  }
  const removed = dequeuePlayer(playerId);
  res.json({ ok: true, removed });
});

// ── GET /api/ame/status/:playerId ─────────────────────────────────────────────
router.get('/ame/status/:playerId', (req, res) => {
  const { playerId } = req.params;
  if (!playerId) {
    res.status(400).json({ ok: false, error: 'playerId required' });
    return;
  }

  const lobby = getLobbyByPlayerId(playerId);
  const room = getRoomByPlayer(playerId);
  const queue = getQueueStatus(playerId);

  let status: 'idle' | 'in_lobby' | 'in_queue' | 'in_game' = 'idle';
  if (room?.status === 'active') status = 'in_game';
  else if (lobby) status = 'in_lobby';
  else if (queue) status = 'in_queue';

  res.json({
    ok: true,
    playerId,
    status,
    lobby: lobby ?? null,
    room: room
      ? {
          roomId: room.roomId,
          mode: room.mode,
          map: room.map,
          playerCount: Object.keys(room.players).length,
          status: room.status,
          scoreboard: room.scoreboard,
        }
      : null,
    queue: queue ?? null,
  });
});

// ── GET /api/ame/rooms ────────────────────────────────────────────────────────
router.get('/ame/rooms', (_req, res) => {
  const rooms = getActiveRooms().map(r => ({
    roomId: r.roomId,
    mode: r.mode,
    map: r.map,
    playerCount: Object.keys(r.players).length,
    maxPlayers: r.maxPlayers,
    status: r.status,
    startedAt: r.startedAt,
    scoreboard: r.scoreboard,
  }));
  res.json({ ok: true, count: rooms.length, rooms });
});

// ── GET /api/ame/lobbies ──────────────────────────────────────────────────────
router.get('/ame/lobbies', (_req, res) => {
  const lobbies = getAllLobbies();
  res.json({ ok: true, count: lobbies.length, lobbies });
});

// ── GET /api/ame/queue-stats ──────────────────────────────────────────────────
router.get('/ame/queue-stats', (_req, res) => {
  const stats = getQueueStats();
  res.json({ ok: true, queues: stats });
});

// ── GET /api/ame/lobby/:lobbyId ───────────────────────────────────────────────
router.get('/ame/lobby/:lobbyId', (req, res) => {
  const lobby = getLobby(req.params.lobbyId!);
  if (!lobby) {
    res.status(404).json({ ok: false, error: 'Lobby not found' });
    return;
  }
  res.json({ ok: true, lobby });
});

// ── GET /api/ame/room/:roomId ─────────────────────────────────────────────────
router.get('/ame/room/:roomId', (req, res) => {
  const room = getRoom(req.params.roomId!);
  if (!room) {
    res.status(404).json({ ok: false, error: 'Room not found' });
    return;
  }
  res.json({ ok: true, room });
});

export default router;
