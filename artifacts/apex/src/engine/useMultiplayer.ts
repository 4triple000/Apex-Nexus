/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  APEX — Multiplayer Hook                                    ║
 * ║                                                             ║
 * ║  Connects the engine to the AME backend (Socket.io /ame).  ║
 * ║                                                             ║
 * ║  Usage:                                                     ║
 * ║    const {                                                  ║
 * ║      status, players, ping,                                ║
 * ║      joinRoom, leaveRoom, syncPlayers                      ║
 * ║    } = useMultiplayer();                                    ║
 * ║                                                             ║
 * ║  Built on top of the existing AME Socket.io namespace.     ║
 * ║  Uses NetworkManager primitives (ClientPredictor,          ║
 * ║  RemotePlayerInterpolator, PingTracker) internally.        ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { io, type Socket }               from "socket.io-client";
import {
  ClientPredictor,
  RemotePlayerInterpolator,
  PingTracker,
  DeltaCompressor,
  type NetworkPlayerState,
  type InputRecord,
} from "@/engine3d/NetworkManager";

// ── AME event constants (mirrors server-side AME_EVENTS) ─────────────────────

const AME = {
  JOIN_ROOM:        "join_room",
  PLAYER_MOVE:      "player_move",
  PLAYER_SHOOT:     "player_shoot",
  PLAYER_RESPAWN:   "player_respawn",
  PING:             "ame_ping",
  PONG:             "ame_pong",
  STATE_UPDATE:     "state_update",
  PLAYER_JOINED:    "player_joined",
  PLAYER_LEFT:      "player_left",
  PLAYER_KILLED:    "player_killed",
  MATCH_END:        "match_end",
  HIT_CONFIRMED:    "hit_confirmed",
  RESPAWN_OK:       "respawn_ok",
  MATCH_ASSIGNED:   "match_assigned",
  POSITION_CORRECT: "position_correct",
} as const;

// ── Public types ──────────────────────────────────────────────────────────────

export type MultiplayerStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "joining"
  | "in-room"
  | "error";

export interface MultiplayerPlayer {
  id:    string;
  name:  string;
  x:     number;
  y:     number;
  z:     number;
  yaw:   number;
  hp:    number;
  alive: boolean;
  kills: number;
  deaths: number;
}

export interface UseMultiplayerReturn {
  /** Connection state. */
  status:   MultiplayerStatus;
  /** All remote players currently in room (excludes local). */
  players:  MultiplayerPlayer[];
  /** Rolling average RTT in ms. */
  ping:     number;
  /** Jitter in ms. */
  jitter:   number;
  /** ID of the currently joined room. */
  roomId:   string | null;
  /** Error message if status === "error". */
  error:    string | null;

  /** Connect to the given room. Resolves when joined or rejects on failure. */
  joinRoom:    (roomId: string, playerId?: string, playerName?: string) => Promise<void>;
  /** Leave the current room and disconnect from AME. */
  leaveRoom:   () => void;
  /** Returns the latest interpolated snapshot of remote players. */
  syncPlayers: () => MultiplayerPlayer[];

  /** Send local player movement to the server. */
  sendMove: (input: Omit<InputRecord, "seq" | "ts">, pos: { x: number; y: number; z: number; yaw: number }) => void;
  /** Report a hit to the server (server validates + applies lag-compensation). */
  sendShoot: (targetId: string, rttMs: number) => void;
  /** Request respawn after death. */
  sendRespawn: () => void;
}

// ── Player identity helpers ───────────────────────────────────────────────────

function getStoredIdentity() {
  try {
    const s = localStorage.getItem("apex_game_identity");
    if (s) return JSON.parse(s) as { id: string; name: string };
  } catch { /* ignore */ }
  const NAMES = ["Phantom","Vortex","Shadow","Nova","Cipher","Ghost","Blaze","Storm"];
  const id   = { id: `p_${Date.now().toString(36)}`, name: NAMES[Math.floor(Math.random()*NAMES.length)]! + Math.floor(Math.random()*99) };
  localStorage.setItem("apex_game_identity", JSON.stringify(id));
  return id;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useMultiplayer(): UseMultiplayerReturn {
  const [status,  setStatus]  = useState<MultiplayerStatus>("disconnected");
  const [players, setPlayers] = useState<MultiplayerPlayer[]>([]);
  const [ping,    setPing]    = useState(0);
  const [jitter,  setJitter]  = useState(0);
  const [roomId,  setRoomId]  = useState<string | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  // Network primitives (stable refs — never re-instantiate)
  const socketRef      = useRef<Socket | null>(null);
  const predictorRef   = useRef(new ClientPredictor());
  const interpolRef    = useRef(new RemotePlayerInterpolator());
  const pingRef        = useRef(new PingTracker());
  const compressorRef  = useRef(new DeltaCompressor());
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animRef         = useRef<number | null>(null);
  const localIdRef      = useRef<string>("");

  // ── Interpolation tick (rAF) ──────────────────────────────────────────────

  const startInterpolation = useCallback(() => {
    const tick = () => {
      interpolRef.current.tick(Date.now());
      const raw = interpolRef.current.players as NetworkPlayerState[];
      setPlayers(raw.filter(p => p.playerId !== localIdRef.current).map(p => ({
        id:     p.playerId,
        name:   p.name,
        x:      p.x,
        y:      p.y,
        z:      p.z,
        yaw:    p.yaw,
        hp:     p.hp,
        alive:  p.alive,
        kills:  p.kills,
        deaths: p.deaths,
      })));
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
  }, []);

  const stopInterpolation = useCallback(() => {
    if (animRef.current !== null) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
  }, []);

  // ── Disconnect helpers ────────────────────────────────────────────────────

  const disconnect = useCallback(() => {
    stopInterpolation();
    if (pingIntervalRef.current) { clearInterval(pingIntervalRef.current); pingIntervalRef.current = null; }
    if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; }
    setStatus("disconnected");
    setPlayers([]);
    setRoomId(null);
    setPing(0);
    setJitter(0);
    interpolRef.current = new RemotePlayerInterpolator();
    predictorRef.current = new ClientPredictor();
    compressorRef.current = new DeltaCompressor();
  }, [stopInterpolation]);

  // ── joinRoom ─────────────────────────────────────────────────────────────

  const joinRoom = useCallback((
    targetRoomId: string,
    playerId?: string,
    playerName?: string,
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      // Reuse existing socket or create a new one
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      const BASE = (import.meta as any).env?.BASE_URL?.replace(/\/$/, "") ?? "";
      const identity = getStoredIdentity();
      const pid  = playerId   || identity.id;
      const name = playerName || identity.name;
      localIdRef.current = pid;

      setStatus("connecting");
      setError(null);

      const socket = io(`${BASE}/ame`, {
        path:              `${BASE}/api/socket.io`,
        transports:        ["websocket"],
        reconnection:      true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
      });

      socketRef.current = socket;

      // ── Socket event handlers ─────────────────────────────────────────────

      socket.on("connect", () => {
        setStatus("joining");
        socket.emit(AME.JOIN_ROOM, { roomId: targetRoomId, playerId: pid, name });
      });

      socket.on(AME.PLAYER_JOINED, () => {
        setStatus("in-room");
        setRoomId(targetRoomId);
        startInterpolation();

        // Ping loop
        pingIntervalRef.current = setInterval(() => {
          const payload = pingRef.current.sendPing();
          socket.emit(AME.PING, payload);
        }, 2000);

        resolve();
      });

      socket.on(AME.STATE_UPDATE, (data: {
        players: NetworkPlayerState[];
        ts:      number;
      }) => {
        for (const p of data.players) {
          interpolRef.current.pushState(p, data.ts);
        }
      });

      socket.on(AME.PONG, () => {
        pingRef.current.receivePong();
        setPing(pingRef.current.rttMs);
        setJitter(pingRef.current.jitter);
      });

      socket.on(AME.PLAYER_LEFT, (data: { playerId: string }) => {
        interpolRef.current.remove(data.playerId);
      });

      socket.on(AME.POSITION_CORRECT, (data: {
        pos: { x: number; y: number; z: number };
        seq: number;
      }) => {
        predictorRef.current.reconcile(data.pos, data.seq);
      });

      socket.on("connect_error", (err) => {
        setStatus("error");
        setError(err.message);
        reject(err);
      });

      socket.on("disconnect", () => {
        stopInterpolation();
        setStatus("disconnected");
        setPlayers([]);
        if (pingIntervalRef.current) { clearInterval(pingIntervalRef.current); pingIntervalRef.current = null; }
      });

      socket.on(AME.MATCH_ASSIGNED, (data: { roomId: string }) => {
        setRoomId(data.roomId);
      });
    });
  }, [startInterpolation, stopInterpolation]);

  // ── leaveRoom ─────────────────────────────────────────────────────────────

  const leaveRoom = useCallback(() => { disconnect(); }, [disconnect]);

  // ── syncPlayers (snapshot getter) ────────────────────────────────────────

  const syncPlayers = useCallback((): MultiplayerPlayer[] => {
    return (interpolRef.current.players as NetworkPlayerState[])
      .filter(p => p.playerId !== localIdRef.current)
      .map(p => ({
        id:     p.playerId,
        name:   p.name,
        x:      p.x, y: p.y, z: p.z,
        yaw:    p.yaw,
        hp:     p.hp,
        alive:  p.alive,
        kills:  p.kills,
        deaths: p.deaths,
      }));
  }, []);

  // ── sendMove ──────────────────────────────────────────────────────────────

  const sendMove = useCallback((
    input:  Omit<InputRecord, "seq" | "ts">,
    pos:    { x: number; y: number; z: number; yaw: number },
  ) => {
    const socket = socketRef.current;
    if (!socket || status !== "in-room") return;
    const seq   = predictorRef.current.applyInput(input);
    const delta = compressorRef.current.compress(pos, pos.yaw);
    if (Object.keys(delta).length > 0) {
      socket.emit(AME.PLAYER_MOVE, { seq, ...delta, yaw: pos.yaw });
    }
  }, [status]);

  // ── sendShoot ─────────────────────────────────────────────────────────────

  const sendShoot = useCallback((targetId: string, rttMs: number) => {
    const socket = socketRef.current;
    if (!socket || status !== "in-room") return;
    socket.emit(AME.PLAYER_SHOOT, { targetId, rttMs });
  }, [status]);

  // ── sendRespawn ───────────────────────────────────────────────────────────

  const sendRespawn = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || status !== "in-room") return;
    socket.emit(AME.PLAYER_RESPAWN, {});
  }, [status]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────

  useEffect(() => () => { disconnect(); }, [disconnect]);

  return {
    status, players, ping, jitter, roomId, error,
    joinRoom, leaveRoom, syncPlayers,
    sendMove, sendShoot, sendRespawn,
  };
}
