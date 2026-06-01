/**
 * Real-Time Communication Layer
 *
 * Defines all WebSocket event types, payloads, and helper emitters.
 * The Socket.io server is initialized in index.ts and uses setupCollaboration().
 * This module extends it with Apex-specific AI + avatar events.
 */

import type { Server, Socket } from "socket.io";
import type { WsEvent, WsEventType, AvatarAction } from "../../shared/types";
import { logger } from "../../lib/logger";

// ── Event type constants ──────────────────────────────────────────────────────
export const WS_EVENTS = {
  // Client → Server
  USER_MESSAGE: "USER_MESSAGE",
  REQUEST_AI_RESPONSE: "REQUEST_AI_RESPONSE",
  AVATAR_CONTROL: "AVATAR_CONTROL",

  // Server → Client
  AI_RESPONSE_STREAM: "AI_RESPONSE_STREAM",
  AI_RESPONSE_COMPLETE: "AI_RESPONSE_COMPLETE",
  AVATAR_ACTION: "AVATAR_ACTION",
  EMOTION_UPDATE: "EMOTION_UPDATE",
  TOOL_INVOKED: "TOOL_INVOKED",
  MEMORY_UPDATED: "MEMORY_UPDATED",

  // Workflow events
  WORKFLOW_STARTED: "WORKFLOW_STARTED",
  WORKFLOW_PROGRESS: "WORKFLOW_PROGRESS",
  WORKFLOW_COMPLETE: "WORKFLOW_COMPLETE",

  // Collab events (existing)
  COLLAB_JOIN: "apex:join",
  COLLAB_LEAVE: "apex:leave",
  COLLAB_CURSOR: "apex:cursor",
  COLLAB_NODE_UPDATE: "apex:node-update",
  COLLAB_EDGE_UPDATE: "apex:edge-update",
} as const;

// ── Event payload types ───────────────────────────────────────────────────────
export interface UserMessagePayload {
  sessionId: string;
  message: string;
  mode?: string;
}

export interface AiStreamChunkPayload {
  sessionId: string;
  chunk: string;
  isLast: boolean;
  provider?: string;
}

export interface AiCompletePayload {
  sessionId: string;
  content: string;
  provider: string;
  responseTimeMs: number;
  avatarAction?: AvatarAction;
  personalizationActive?: boolean;
}

export interface WorkflowProgressPayload {
  workflowId: number;
  sessionId: string;
  step: string;
  nodeId: string;
  progress: number; // 0-100
  output?: unknown;
}

// ── Room naming conventions ───────────────────────────────────────────────────
export const ROOMS = {
  session: (sessionId: string) => `session:${sessionId}`,
  project: (projectId: number) => `project:${projectId}`,
  global: "global",
};

// ── Event emitter helpers ─────────────────────────────────────────────────────
export function emitToSession(io: Server, sessionId: string, event: string, payload: unknown): void {
  io.to(ROOMS.session(sessionId)).emit(event, {
    type: event,
    sessionId,
    payload,
    timestamp: new Date().toISOString(),
  });
}

export function emitToProject(io: Server, projectId: number, event: string, payload: unknown): void {
  io.to(ROOMS.project(projectId)).emit(event, {
    type: event,
    payload,
    timestamp: new Date().toISOString(),
  });
}

export function broadcastGlobal(io: Server, event: string, payload: unknown): void {
  io.to(ROOMS.global).emit(event, {
    type: event,
    payload,
    timestamp: new Date().toISOString(),
  });
}

// ── Setup Apex real-time handlers ─────────────────────────────────────────────
export function setupApexRealtime(io: Server): void {
  io.on("connection", (socket: Socket) => {
    const sessionId = socket.handshake.query.sessionId as string;

    if (sessionId) {
      void socket.join(ROOMS.session(sessionId));
      logger.debug({ sessionId, socketId: socket.id }, "Client connected to session room");
    }

    // Join global room for broadcast events
    void socket.join(ROOMS.global);

    // Handle project room joins (forwarded from collaboration system)
    socket.on("join_project", (projectId: number) => {
      void socket.join(ROOMS.project(projectId));
    });

    socket.on("leave_project", (projectId: number) => {
      void socket.leave(ROOMS.project(projectId));
    });

    socket.on("disconnect", () => {
      logger.debug({ sessionId, socketId: socket.id }, "Client disconnected");
    });
  });

  logger.info("Apex real-time event system ready");
}

// ── Stream AI response via WebSocket ─────────────────────────────────────────
export async function streamAiResponse(
  io: Server,
  sessionId: string,
  generator: AsyncGenerator<string>
): Promise<string> {
  let fullContent = "";

  for await (const chunk of generator) {
    fullContent += chunk;
    emitToSession(io, sessionId, WS_EVENTS.AI_RESPONSE_STREAM, {
      sessionId,
      chunk,
      isLast: false,
    } satisfies AiStreamChunkPayload);
  }

  emitToSession(io, sessionId, WS_EVENTS.AI_RESPONSE_COMPLETE, {
    sessionId,
    content: fullContent,
    provider: "openai",
    responseTimeMs: 0,
  } satisfies AiCompletePayload);

  return fullContent;
}
