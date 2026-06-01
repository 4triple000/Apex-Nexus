/**
 * Real-time collaboration hook for Apex Studio.
 * Manages Socket.io connection, room membership, and collaborator state.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { io, type Socket } from "socket.io-client";
import type { StudioNode, StudioEdge } from "./useStudio";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ─── Types ────────────────────────────────────────────────────

export interface Collaborator {
  socketId: string;
  userId: string;
  name: string;
  color: string;
  cursor: { x: number; y: number } | null;
  selectedNodeId: string | null;
}

export interface MyCollabInfo {
  userId: string;
  name: string;
  color: string;
  socketId: string;
}

// ─── Adjective + noun pairs for random display names ──────────
const ADJ = ["Swift", "Bold", "Bright", "Sharp", "Keen", "Cool", "Fast", "Smart"];
const NON = ["Panda", "Eagle", "Shark", "Tiger", "Hawk", "Fox", "Wolf", "Bear"];
function randomName() {
  return `${ADJ[Math.floor(Math.random() * ADJ.length)]} ${NON[Math.floor(Math.random() * NON.length)]}`;
}

function getOrCreateIdentity(): { userId: string; name: string } {
  const stored = sessionStorage.getItem("apex_collab_identity");
  if (stored) {
    try {
      return JSON.parse(stored) as { userId: string; name: string };
    } catch { /* fall through */ }
  }
  const identity = {
    userId: `u_${Math.random().toString(36).slice(2, 10)}`,
    name: randomName(),
  };
  sessionStorage.setItem("apex_collab_identity", JSON.stringify(identity));
  return identity;
}

// ─── Hook ─────────────────────────────────────────────────────

export interface UseCollaborationReturn {
  collaborators: Collaborator[];
  myInfo: MyCollabInfo | null;
  isConnected: boolean;
  emitNodesChange: (nodes: StudioNode[], edges: StudioEdge[]) => void;
  emitCursor: (x: number, y: number) => void;
  emitCursorLeave: () => void;
  emitSelection: (nodeId: string | null) => void;
  onRemoteNodesChange: ((nodes: StudioNode[], edges: StudioEdge[]) => void) | null;
  setRemoteChangeHandler: (
    fn: ((nodes: StudioNode[], edges: StudioEdge[]) => void) | null
  ) => void;
}

export function useCollaboration(
  projectId: number | null,
  initialNodes: StudioNode[],
  initialEdges: StudioEdge[]
): UseCollaborationReturn {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [myInfo, setMyInfo] = useState<MyCollabInfo | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const cursorDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remoteHandlerRef = useRef<((nodes: StudioNode[], edges: StudioEdge[]) => void) | null>(null);
  const identityRef = useRef(getOrCreateIdentity());

  const setRemoteChangeHandler = useCallback(
    (fn: ((nodes: StudioNode[], edges: StudioEdge[]) => void) | null) => {
      remoteHandlerRef.current = fn;
    },
    []
  );

  useEffect(() => {
    if (projectId === null) return;

    const { userId, name } = identityRef.current;

    // Connect to the API server's Socket.io endpoint
    const socket = io(window.location.origin, {
      path: `${BASE}/api/socket.io`,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);

      // Join the project room
      socket.emit("studio:join", {
        projectId: String(projectId),
        userId,
        name,
        initialNodes,
        initialEdges,
      });
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
      setCollaborators([]);
    });

    // Server confirms join — get room state + assign my color
    socket.on("studio:joined", (data: {
      me: { socketId: string; userId: string; name: string; color: string };
      users: Collaborator[];
      nodes: StudioNode[];
      edges: StudioEdge[];
    }) => {
      setMyInfo({ userId: data.me.userId, name: data.me.name, color: data.me.color, socketId: data.me.socketId });
      setCollaborators(data.users.filter((u) => u.socketId !== socket.id));

      // If room already has state, sync it
      if (data.nodes.length > 0 && remoteHandlerRef.current) {
        remoteHandlerRef.current(data.nodes as StudioNode[], data.edges as StudioEdge[]);
      }
    });

    socket.on("studio:user:joined", (user: Collaborator) => {
      setCollaborators((prev) => {
        if (prev.find((u) => u.socketId === user.socketId)) return prev;
        return [...prev, user];
      });
    });

    socket.on("studio:user:left", ({ socketId }: { socketId: string }) => {
      setCollaborators((prev) => prev.filter((u) => u.socketId !== socketId));
    });

    // Remote nodes/edges change
    socket.on("studio:nodes:updated", (data: { nodes: StudioNode[]; edges: StudioEdge[] }) => {
      if (remoteHandlerRef.current) {
        remoteHandlerRef.current(data.nodes, data.edges);
      }
    });

    // Remote cursor movement
    socket.on("studio:cursor:moved", ({ socketId, cursor }: { socketId: string; cursor: { x: number; y: number } }) => {
      setCollaborators((prev) =>
        prev.map((u) => (u.socketId === socketId ? { ...u, cursor } : u))
      );
    });

    // Remote selection change
    socket.on("studio:selection:changed", ({ socketId, nodeId }: { socketId: string; nodeId: string | null }) => {
      setCollaborators((prev) =>
        prev.map((u) => (u.socketId === socketId ? { ...u, selectedNodeId: nodeId } : u))
      );
    });

    return () => {
      socket.emit("studio:leave");
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      setCollaborators([]);
      setMyInfo(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // ─── Emit helpers ─────────────────────────────────────────────

  const emitNodesChange = useCallback((nodes: StudioNode[], edges: StudioEdge[]) => {
    socketRef.current?.emit("studio:nodes:change", { nodes, edges });
  }, []);

  const emitCursor = useCallback((x: number, y: number) => {
    if (cursorDebounceRef.current) clearTimeout(cursorDebounceRef.current);
    cursorDebounceRef.current = setTimeout(() => {
      socketRef.current?.emit("studio:cursor", { x, y });
    }, 30); // 30ms debounce — ~33fps max
  }, []);

  const emitCursorLeave = useCallback(() => {
    // Signal cursor is gone (leave canvas)
    socketRef.current?.emit("studio:cursor", null);
  }, []);

  const emitSelection = useCallback((nodeId: string | null) => {
    socketRef.current?.emit("studio:selection", { nodeId });
  }, []);

  return {
    collaborators,
    myInfo,
    isConnected,
    emitNodesChange,
    emitCursor,
    emitCursorLeave,
    emitSelection,
    onRemoteNodesChange: remoteHandlerRef.current,
    setRemoteChangeHandler,
  };
}
