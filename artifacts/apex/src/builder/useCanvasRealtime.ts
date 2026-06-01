/**
 * useCanvasRealtime
 * Wraps Socket.io to provide real-time push updates for canvas components.
 * Replaces polling for: messages, products, feed, leaderboard, stats.
 *
 * Usage:
 *   const { on, off, emit, connected } = useCanvasRealtime(["canvas:messages", "canvas:feed"]);
 *   useEffect(() => { on("canvas:ai_reply", handler); return () => off("canvas:ai_reply", handler); }, []);
 */
import { useEffect, useRef, useCallback, useState } from "react";
import { io, type Socket } from "socket.io-client";

export const CANVAS_ROOMS = {
  messages:    "canvas:messages",
  products:    "canvas:products",
  feed:        "canvas:feed",
  leaderboard: "canvas:leaderboard",
  stats:       "canvas:stats",
} as const;

export const CANVAS_EVENTS = {
  MESSAGE_NEW:        "canvas:message_new",
  AI_REPLY:           "canvas:ai_reply",
  PRODUCT_UPDATED:    "canvas:product_updated",
  ORDER_CREATED:      "canvas:order_created",
  FEED_POST_NEW:      "canvas:feed_post_new",
  FEED_POST_LIKED:    "canvas:feed_post_liked",
  LEADERBOARD_UPDATE: "canvas:leaderboard_update",
  STATS_UPDATE:       "canvas:stats_update",
  UPLOAD_COMPLETE:    "canvas:upload_complete",
} as const;

let _sharedSocket: Socket | null = null;
let _refCount = 0;

function getSocket(sessionId?: string | null): Socket {
  if (!_sharedSocket || !_sharedSocket.connected) {
    _sharedSocket = io(window.location.origin, {
      path: "/api/socket.io",
      transports: ["websocket", "polling"],
      query: sessionId ? { sessionId } : {},
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }
  return _sharedSocket;
}

export function useCanvasRealtime(
  rooms: (keyof typeof CANVAS_ROOMS | string)[],
  sessionId?: string | null,
) {
  const socketRef  = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    _refCount++;
    const socket = getSocket(sessionId);
    socketRef.current = socket;

    const onConnect    = () => { setConnected(true);  socket.emit("canvas:join", rooms); };
    const onDisconnect = () => setConnected(false);

    socket.on("connect",    onConnect);
    socket.on("disconnect", onDisconnect);

    if (socket.connected) {
      setConnected(true);
      socket.emit("canvas:join", rooms);
    }

    return () => {
      socket.off("connect",    onConnect);
      socket.off("disconnect", onDisconnect);
      socket.emit("canvas:leave", rooms);
      _refCount--;
      if (_refCount <= 0) {
        socket.disconnect();
        _sharedSocket = null;
        _refCount = 0;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const on = useCallback((event: string, handler: (data: unknown) => void) => {
    socketRef.current?.on(event, handler);
  }, []);

  const off = useCallback((event: string, handler: (data: unknown) => void) => {
    socketRef.current?.off(event, handler);
  }, []);

  const emit = useCallback((event: string, data?: unknown) => {
    socketRef.current?.emit(event, data);
  }, []);

  return { connected, on, off, emit };
}

/** Simpler hook: subscribe to one event, returns latest value */
export function useCanvasEvent<T>(
  rooms: string[],
  event: string,
  initialValue: T,
  sessionId?: string | null,
): T {
  const [value, setValue] = useState<T>(initialValue);
  const { on, off } = useCanvasRealtime(rooms, sessionId);

  useEffect(() => {
    const handler = (data: unknown) => setValue(data as T);
    on(event, handler);
    return () => off(event, handler);
  }, [event, on, off]);

  return value;
}
