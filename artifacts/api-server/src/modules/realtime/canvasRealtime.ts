/**
 * Canvas Real-Time Module
 * Replaces polling with push-based WebSocket events.
 * Clients join canvas:* rooms and receive instant updates.
 *
 * Rooms:
 *   canvas:messages   — new chat messages + AI replies
 *   canvas:products   — stock changes, new purchases
 *   canvas:feed       — new posts, like counts
 *   canvas:leaderboard— score updates
 *   canvas:stats      — aggregated metrics
 *
 * Events emitted:
 *   canvas:message_new        { message }
 *   canvas:ai_reply           { message }
 *   canvas:product_updated    { product }
 *   canvas:order_created      { order }
 *   canvas:feed_post_new      { post }
 *   canvas:feed_post_liked    { postId, likes }
 *   canvas:leaderboard_update { entries }
 *   canvas:stats_update       { stats }
 */
import type { Server } from "socket.io";

export const CANVAS_ROOMS = {
  messages:    "canvas:messages",
  products:    "canvas:products",
  feed:        "canvas:feed",
  leaderboard: "canvas:leaderboard",
  stats:       "canvas:stats",
  all:         "canvas:all",
};

export const CANVAS_EVENTS = {
  // Client → Server
  JOIN:  "canvas:join",
  LEAVE: "canvas:leave",
  SEND_MESSAGE:   "canvas:send_message",
  LIKE_POST:      "canvas:like_post",
  SUBMIT_SCORE:   "canvas:submit_score",

  // Server → Client
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

let _io: Server | null = null;

export function getCanvasIO(): Server | null { return _io; }

// Setup canvas real-time handlers
export function setupCanvasRealtime(io: Server): void {
  _io = io;

  io.on("connection", (socket) => {
    // Let client subscribe to specific canvas data streams
    socket.on(CANVAS_EVENTS.JOIN, (rooms: string | string[]) => {
      const list = Array.isArray(rooms) ? rooms : [rooms];
      for (const room of list) {
        if (Object.values(CANVAS_ROOMS).includes(room)) {
          void socket.join(room);
        }
      }
      // Always join the "all" broadcast room
      void socket.join(CANVAS_ROOMS.all);
    });

    socket.on(CANVAS_EVENTS.LEAVE, (rooms: string | string[]) => {
      const list = Array.isArray(rooms) ? rooms : [rooms];
      for (const room of list) { void socket.leave(room); }
    });
  });
}

// ── Emit helpers (called from canvasData route handlers) ─────────────────────
export function emitMessageNew(message: object): void {
  _io?.to(CANVAS_ROOMS.messages).emit(CANVAS_EVENTS.MESSAGE_NEW, message);
}
export function emitAiReply(message: object): void {
  _io?.to(CANVAS_ROOMS.messages).emit(CANVAS_EVENTS.AI_REPLY, message);
}
export function emitProductUpdated(product: object): void {
  _io?.to(CANVAS_ROOMS.products).emit(CANVAS_EVENTS.PRODUCT_UPDATED, product);
}
export function emitOrderCreated(order: object): void {
  _io?.to(CANVAS_ROOMS.products).emit(CANVAS_EVENTS.ORDER_CREATED, order);
}
export function emitFeedPostNew(post: object): void {
  _io?.to(CANVAS_ROOMS.feed).emit(CANVAS_EVENTS.FEED_POST_NEW, post);
}
export function emitFeedLiked(postId: number, likes: number): void {
  _io?.to(CANVAS_ROOMS.feed).emit(CANVAS_EVENTS.FEED_POST_LIKED, { postId, likes });
}
export function emitLeaderboardUpdate(entries: object[]): void {
  _io?.to(CANVAS_ROOMS.leaderboard).emit(CANVAS_EVENTS.LEADERBOARD_UPDATE, entries);
}
export function emitStatsUpdate(stats: object): void {
  _io?.to(CANVAS_ROOMS.stats).emit(CANVAS_EVENTS.STATS_UPDATE, stats);
}
export function emitUploadComplete(sessionId: string, file: object): void {
  _io?.to(`session:${sessionId}`).emit(CANVAS_EVENTS.UPLOAD_COMPLETE, file);
}
