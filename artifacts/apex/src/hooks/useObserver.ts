/**
 * useObserver — Apex Autonomous System Observer Hook
 *
 * Tracks user actions, game events, FPS, and session metrics.
 * Batches events and flushes to /api/autonomous/event every 30 seconds.
 *
 * Usage:
 *   const { track, trackGame, trackFps } = useObserver();
 */
import { useEffect, useRef, useCallback } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const api  = (p: string) => `${BASE}${p}`;

const FLUSH_INTERVAL = 30_000;   // 30s
const MAX_QUEUE      = 100;       // max events to hold before force-flush

type EventType =
  | "session_start" | "session_end"
  | "page_view"     | "tab_switch"
  | "feature_used"  | "click"
  | "game_start"    | "game_end"   | "game_fail"
  | "fps_sample"    | "error";

interface RawEvent {
  type:      EventType;
  sessionId: string;
  userId?:   string;
  ts?:       number;
  data:      Record<string, unknown>;
}

// ── Session singleton ─────────────────────────────────────────────────────────
let _sessionId: string | null = null;

function getSessionId(): string {
  if (!_sessionId) {
    _sessionId = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
  return _sessionId;
}

// ── Flush queue to server ─────────────────────────────────────────────────────
async function flush(queue: RawEvent[]) {
  if (!queue.length) return;
  try {
    await fetch(api("/api/autonomous/event"), {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ events: queue }),
      // Use keepalive so flush survives page unload
      keepalive: true,
    });
  } catch {
    // Non-fatal — events will be lost but app won't break
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useObserver(userId?: string) {
  const queueRef = useRef<RawEvent[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Enqueue an event
  const track = useCallback(
    (type: EventType, data: Record<string, unknown> = {}) => {
      queueRef.current.push({
        type,
        sessionId: getSessionId(),
        userId,
        ts:        Date.now(),
        data,
      });
      // Force flush if queue is getting large
      if (queueRef.current.length >= MAX_QUEUE) {
        const batch = [...queueRef.current];
        queueRef.current = [];
        flush(batch).catch(() => {});
      }
    },
    [userId],
  );

  // Convenience: track game start
  const trackGame = useCallback(
    (event: "start" | "end" | "fail", gameMode: string, extra: Record<string, unknown> = {}) => {
      track(`game_${event}` as EventType, { gameMode, ...extra });
    },
    [track],
  );

  // Convenience: sample FPS during gameplay
  const trackFps = useCallback(
    (fps: number, gameMode: string) => {
      track("fps_sample", { fps: Math.round(fps), gameMode });
    },
    [track],
  );

  // Convenience: track feature usage
  const trackFeature = useCallback(
    (feature: string, detail: Record<string, unknown> = {}) => {
      track("feature_used", { feature, ...detail });
    },
    [track],
  );

  // Convenience: track an error
  const trackError = useCallback(
    (message: string, context: Record<string, unknown> = {}) => {
      track("error", { message, ...context });
    },
    [track],
  );

  // Setup: session_start, periodic flush, unload flush
  useEffect(() => {
    track("session_start", { referrer: document.referrer, ua: navigator.userAgent.slice(0, 80) });

    timerRef.current = setInterval(() => {
      if (!queueRef.current.length) return;
      const batch = [...queueRef.current];
      queueRef.current = [];
      flush(batch).catch(() => {});
    }, FLUSH_INTERVAL);

    const onUnload = () => {
      track("session_end", { duration: Date.now() });
      flush(queueRef.current).catch(() => {});
    };
    window.addEventListener("beforeunload", onUnload);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      window.removeEventListener("beforeunload", onUnload);
      // Final flush on unmount
      flush(queueRef.current).catch(() => {});
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { track, trackGame, trackFps, trackFeature, trackError, sessionId: getSessionId() };
}
