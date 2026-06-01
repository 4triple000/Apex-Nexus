/**
 * Apex Multiplayer Engine — Core Types
 * Shared data models for lobbies, rooms, players, and projectiles.
 */

export type GameMode = 'tdm' | 'ffa' | 'battle';
export type LobbyStatus = 'waiting' | 'starting' | 'in_game';
export type RoomStatus = 'active' | 'ended';
export type MapName = 'desert' | 'urban' | 'forest';

// ── Lobby ─────────────────────────────────────────────────────────────────────
export interface LobbyPlayer {
  playerId: string;
  name: string;
  ready: boolean;
}

export interface Lobby {
  lobbyId: string;
  hostId: string;
  players: LobbyPlayer[];
  mode: GameMode;
  region: string;
  status: LobbyStatus;
  createdAt: number;
}

// ── Room / Game State ─────────────────────────────────────────────────────────
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface PlayerState extends Vec3 {
  playerId: string;
  name: string;
  yaw: number;
  hp: number;
  alive: boolean;
  kills: number;
  deaths: number;
  socketId: string;
  respawnAt?: number;
}

export interface Projectile {
  id: string;
  ownerId: string;
  origin: Vec3;
  direction: Vec3;
  speed: number;
  damage: number;
  range: number;
  createdAt: number;
}

export interface ScoreEntry {
  kills: number;
  deaths: number;
}

export interface Room {
  roomId: string;
  lobbyId?: string;
  players: Record<string, PlayerState>;
  projectiles: Projectile[];
  scoreboard: Record<string, ScoreEntry>;
  map: MapName;
  mode: GameMode;
  status: RoomStatus;
  maxPlayers: number;
  startedAt: number;
  endedAt?: number;
}

// ── Matchmaking ───────────────────────────────────────────────────────────────
export interface QueueEntry {
  playerId: string;
  name: string;
  mode: GameMode;
  region: string;
  enqueuedAt: number;
  socketId?: string;
}

// ── Socket Event Payloads (Client → Server) ───────────────────────────────────

export interface JoinRoomPayload {
  roomId: string;
  playerId: string;
  name: string;
}

/**
 * Client sends position + input sequence on every frame tick.
 * Server uses seq for reconciliation (sends back corrected position when needed).
 */
export interface PlayerMovePayload {
  roomId:   string;
  playerId: string;
  x:        number;
  y:        number;
  z:        number;
  yaw:      number;
  seq:      number;   // monotonic input sequence number
  ts:       number;   // client-side timestamp (ms) — used as snapshot key
}

/**
 * Client reports a shoot event with lag-compensation metadata.
 * Server rewinds enemy positions based on shooterRttMs before validating.
 */
export interface PlayerShootPayload {
  roomId:        string;
  shooterId:     string;
  targetId:      string;
  distance:      number;
  isHead:        boolean;   // client-side head detection hint
  /** Shooter's measured RTT in ms — used to rewind snapshot history */
  shooterRttMs:  number;
  /** Client timestamp when the shot was fired */
  shotTs:        number;
}

export interface PlayerHitPayload {
  roomId:     string;
  playerId:   string;
  damage:     number;
  attackerId: string;
}

export interface PlayerRespawnPayload {
  roomId:    string;
  playerId:  string;
}

/** Server → Client: reconciliation correction */
export interface PositionCorrectionPayload {
  roomId:  string;
  seq:     number;   // last acknowledged input sequence
  x:       number;
  y:       number;
  z:       number;
}

// ── Hit result ────────────────────────────────────────────────────────────────
export interface HitResult {
  valid: boolean;
  targetId: string;
  damage: number;
  targetHp: number;
  killed: boolean;
  reason?: string;
}
