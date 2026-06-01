/**
 * Real-time collaboration engine for Apex Studio.
 * Uses Socket.io rooms keyed by projectId.
 *
 * Strategy: last-write-wins for nodes/edges.
 * Cursors and selections are relayed without storage (ephemeral).
 */
import { Server, Socket } from "socket.io";
import { logger } from "./logger";

// ─── Types ────────────────────────────────────────────────────

export interface CollabUser {
  socketId: string;
  userId: string;
  name: string;
  color: string;
  cursor: { x: number; y: number } | null;
  selectedNodeId: string | null;
}

interface RoomState {
  users: Map<string, CollabUser>; // key = socketId
  nodes: unknown[];
  edges: unknown[];
}

// ─── Collaborator color palette ───────────────────────────────

const COLLAB_COLORS = [
  "#ff6b6b", // coral red
  "#4ecdc4", // teal
  "#45b7d1", // sky blue
  "#96ceb4", // sage
  "#feca57", // yellow
  "#ff9ff3", // pink
  "#a55eea", // purple
  "#26de81", // green
];

function pickColor(room: RoomState): string {
  const usedColors = new Set([...room.users.values()].map((u) => u.color));
  return (
    COLLAB_COLORS.find((c) => !usedColors.has(c)) ??
    COLLAB_COLORS[Math.floor(Math.random() * COLLAB_COLORS.length)]!
  );
}

// ─── In-memory room registry ──────────────────────────────────

const rooms = new Map<string, RoomState>();

function getOrCreateRoom(projectId: string): RoomState {
  if (!rooms.has(projectId)) {
    rooms.set(projectId, { users: new Map(), nodes: [], edges: [] });
  }
  return rooms.get(projectId)!;
}

function usersArray(room: RoomState): CollabUser[] {
  return [...room.users.values()];
}

// ─── Setup ───────────────────────────────────────────────────

export function setupCollaboration(io: Server): void {
  io.on("connection", (socket: Socket) => {
    let currentRoom: string | null = null;
    let currentUser: CollabUser | null = null;

    // ── Join a project room ────────────────────────────────────
    socket.on(
      "studio:join",
      (payload: {
        projectId: string;
        userId: string;
        name: string;
        initialNodes?: unknown[];
        initialEdges?: unknown[];
      }) => {
        const { projectId, userId, name, initialNodes, initialEdges } = payload;
        const roomId = `project:${projectId}`;

        // Leave any previous room
        if (currentRoom) {
          socket.leave(currentRoom);
          const prevRoom = rooms.get(currentRoom);
          if (prevRoom) {
            prevRoom.users.delete(socket.id);
            socket.to(currentRoom).emit("studio:user:left", { socketId: socket.id });
          }
        }

        socket.join(roomId);
        currentRoom = roomId;

        const room = getOrCreateRoom(roomId);

        // Seed room with initial state if first user
        if (room.users.size === 0 && initialNodes && initialEdges) {
          room.nodes = initialNodes;
          room.edges = initialEdges;
        }

        const color = pickColor(room);
        currentUser = {
          socketId: socket.id,
          userId,
          name,
          color,
          cursor: null,
          selectedNodeId: null,
        };

        room.users.set(socket.id, currentUser);

        // Send current room state to the joiner
        socket.emit("studio:joined", {
          me: currentUser,
          users: usersArray(room),
          nodes: room.nodes,
          edges: room.edges,
        });

        // Notify others
        socket.to(roomId).emit("studio:user:joined", currentUser);

        logger.info({ projectId, userId, name, color }, "User joined collab session");
      }
    );

    // ── Leave ──────────────────────────────────────────────────
    socket.on("studio:leave", () => {
      if (currentRoom) {
        const room = rooms.get(currentRoom);
        if (room) {
          room.users.delete(socket.id);
          socket.to(currentRoom).emit("studio:user:left", { socketId: socket.id });
          if (room.users.size === 0) rooms.delete(currentRoom);
        }
        socket.leave(currentRoom);
        currentRoom = null;
        currentUser = null;
      }
    });

    // ── Nodes + edges change (full state sync) ─────────────────
    socket.on(
      "studio:nodes:change",
      (payload: { nodes: unknown[]; edges: unknown[] }) => {
        if (!currentRoom) return;
        const room = rooms.get(currentRoom);
        if (!room) return;

        // Last-write-wins: store and broadcast
        room.nodes = payload.nodes;
        room.edges = payload.edges;

        socket.to(currentRoom).emit("studio:nodes:updated", {
          nodes: payload.nodes,
          edges: payload.edges,
          fromSocketId: socket.id,
        });
      }
    );

    // ── Cursor movement (flow-space coords, debounced on client) ─
    socket.on("studio:cursor", (payload: { x: number; y: number }) => {
      if (!currentRoom || !currentUser) return;
      currentUser.cursor = payload;

      socket.to(currentRoom).emit("studio:cursor:moved", {
        socketId: socket.id,
        cursor: payload,
      });
    });

    // ── Node selection ─────────────────────────────────────────
    socket.on("studio:selection", (payload: { nodeId: string | null }) => {
      if (!currentRoom || !currentUser) return;
      currentUser.selectedNodeId = payload.nodeId;

      socket.to(currentRoom).emit("studio:selection:changed", {
        socketId: socket.id,
        nodeId: payload.nodeId,
      });
    });

    // ── Disconnect ─────────────────────────────────────────────
    socket.on("disconnect", () => {
      if (currentRoom) {
        const room = rooms.get(currentRoom);
        if (room) {
          room.users.delete(socket.id);
          socket.to(currentRoom).emit("studio:user:left", { socketId: socket.id });
          if (room.users.size === 0) rooms.delete(currentRoom);
        }
        logger.info({ socketId: socket.id }, "User disconnected from collab session");
      }
    });
  });
}
