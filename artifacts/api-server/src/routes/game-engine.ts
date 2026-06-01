/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  APEX GAME ENGINE — Backend Routes + Socket namespace   ║
 * ║  GET  /api/game/demos                                   ║
 * ║  POST /api/game/generate                                ║
 * ║  Socket: /game  (multiplayer room sync)                 ║
 * ╚══════════════════════════════════════════════════════════╝
 */
import { Router, type IRouter } from "express";
import type { Server as SocketIO } from "socket.io";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

// ── Demo games (same 3 configs as frontend demoGames.ts) ─────────────────────

const DEMOS = [
  {
    id: "neon-platformer",
    name: "Neon Platformer",
    description: "Collect all coins and defeat enemies across neon platforms.",
    thumbnail: "🟣",
    config: {
      name: "Neon Platformer",
      gravity: 0.55, winCondition: "collect_all",
      background: "#07080E", width: 400, height: 600,
      player:    { x: 40, y: 480, width: 32, height: 32, color: "blue",  jumpForce: 12, speed: 4.5 },
      platforms: [
        { x: 0,   y: 560, width: 400, height: 16, color: "#2d3561" },
        { x: 60,  y: 480, width: 90,  height: 12, color: "#3d2561" },
        { x: 200, y: 400, width: 80,  height: 12, color: "#252d61" },
        { x: 80,  y: 330, width: 100, height: 12, color: "#3d2561" },
        { x: 240, y: 260, width: 100, height: 12, color: "#252d61" },
        { x: 100, y: 190, width: 80,  height: 12, color: "#3d2561" },
        { x: 250, y: 130, width: 120, height: 12, color: "#252d61" },
      ],
      enemies: [
        { x: 80,  y: 460, width: 28, height: 28, color: "red",    speed: 1.2, patrol: { minX: 60,  maxX: 150 } },
        { x: 200, y: 380, width: 28, height: 28, color: "orange", speed: 1.5, patrol: { minX: 200, maxX: 280 } },
      ],
      coins: [
        { x: 110, y: 455, radius: 8, color: "gold", value: 10 },
        { x: 220, y: 375, radius: 8, color: "gold", value: 10 },
        { x: 290, y: 105, radius: 10, color: "#ffcc33", value: 50 },
      ],
    },
  },
  {
    id: "sky-jumper",
    name: "Sky Jumper",
    description: "Reach the end platform by leaping across floating islands.",
    thumbnail: "🔵",
    config: {
      name: "Sky Jumper", gravity: 0.4, winCondition: "reach_end",
      background: "#0a1628", width: 400, height: 600, endX: 740,
      player: { x: 30, y: 520, width: 30, height: 30, color: "cyan", jumpForce: 13, speed: 4 },
      platforms: [
        { x: 0,   y: 570, width: 120, height: 16, color: "#1a3a5c" },
        { x: 150, y: 520, width: 80,  height: 12, color: "#1a3a5c" },
        { x: 240, y: 440, width: 90,  height: 12, color: "#1a3a5c" },
        { x: 360, y: 360, width: 80,  height: 12, color: "#1a3a5c" },
        { x: 480, y: 280, width: 90,  height: 12, color: "#1a3a5c" },
        { x: 610, y: 200, width: 80,  height: 12, color: "#1a3a5c" },
        { x: 680, y: 120, width: 110, height: 16, color: "#2a5a8c" },
      ],
      enemies: [
        { x: 365, y: 340, width: 26, height: 26, color: "purple", speed: 1.8, patrol: { minX: 360, maxX: 440 } },
      ],
      coins: [
        { x: 190, y: 495, radius: 7, color: "gold", value: 10 },
        { x: 720, y: 95,  radius: 12, color: "#ffcc33", value: 50 },
      ],
    },
  },
  {
    id: "dodge-blitz",
    name: "Dodge Blitz",
    description: "Survive 30 seconds as enemies rain from above.",
    thumbnail: "🟢",
    config: {
      name: "Dodge Blitz", gravity: 0, winCondition: "survive", surviveSecs: 30,
      background: "#0d0a1e", width: 400, height: 600,
      player: { x: 184, y: 500, width: 32, height: 32, color: "green", jumpForce: 0, speed: 5.5 },
      platforms: [{ x: 0, y: 580, width: 400, height: 20, color: "#1a1a2e" }],
      enemies: [
        { x: 50,  y: -40, width: 30, height: 30, color: "red",    speed: 3   },
        { x: 150, y: -80, width: 30, height: 30, color: "orange", speed: 3.5 },
        { x: 250, y: -120,width: 30, height: 30, color: "red",    speed: 4   },
        { x: 330, y: -60, width: 30, height: 30, color: "orange", speed: 3.2 },
      ],
      coins: [],
    },
  },
];

// ── GET /api/game/demos ───────────────────────────────────────────────────────

router.get("/api/game/demos", (_req, res) => {
  res.json({ demos: DEMOS.map(({ config: _, ...meta }) => meta) });
});

router.get("/api/game/demos/:id", (req, res) => {
  const demo = DEMOS.find((d) => d.id === req.params["id"]);
  if (!demo) { res.status(404).json({ error: "Demo not found" }); return; }
  res.json(demo);
});

// ── POST /api/game/generate (AI mock) ────────────────────────────────────────

router.post("/api/game/generate", async (req, res): Promise<void> => {
  const { prompt } = req.body as { prompt?: string };
  if (!prompt) { res.status(400).json({ error: "prompt required" }); return; }

  const p = prompt.toLowerCase();

  // Try OpenAI via Replit integration
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are an Apex Game Engine game designer. Given a description, output a valid GameConfig JSON.
Schema: { name, gravity(0.1-1.2), winCondition("reach_end"|"collect_all"|"survive"), background(hex),
width:400, height:600, player:{x,y,width,height,color,jumpForce,speed},
platforms:[{x,y,width,height,color}], enemies:[{x,y,width,height,color,speed,patrol:{minX,maxX}}],
coins:[{x,y,radius,color,value}], surviveSecs(optional int) }.
Rules: Always include a ground platform at y:560 width:400. Player starts at x<100, y>400.
Make it fun, balanced, playable. Respond with ONLY the JSON object.`,
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 1200,
      temperature: 0.8,
    });
    const raw = completion.choices[0]?.message?.content;
    if (raw) {
      const config = JSON.parse(raw) as object;
      res.json({ config, generated: true });
      return;
    }
  } catch { /* fall through to template fallback */ }

  // ── Template-based mock fallback ──────────────────────────────────────────
  let config: object;

  if (p.includes("dodge") || p.includes("avoid") || p.includes("survive")) {
    config = { ...DEMOS[2]!.config, name: "AI Dodge Game" };
  } else if (p.includes("sky") || p.includes("float")) {
    config = { ...DEMOS[1]!.config, name: "AI Sky Game" };
  } else {
    const base = { ...DEMOS[0]!.config, name: "AI Platformer" };
    if (p.includes("fast")) (base as { player: { speed: number } }).player.speed = 7;
    if (p.includes("hard")) (base as { gravity: number }).gravity = 0.85;
    config = base;
  }

  res.json({ config, generated: false });
});

// ── GET /api/game/stats — real room/player counts ────────────────────────────

router.get("/game/stats", (req, res) => {
  let totalPlayers = 0;
  let activeRooms  = 0;
  for (const room of rooms.values()) {
    if (room.size > 0) {
      totalPlayers += room.size;
      activeRooms++;
    }
  }
  res.json({ ok: true, playersOnline: totalPlayers, activeRooms });
});

// ── Socket.io /game namespace — multiplayer room sync ────────────────────────

interface RoomPlayer {
  id:       string;
  name:     string;
  x:        number;
  y:        number;
  vx:       number;
  vy:       number;
  width:    number;
  height:   number;
  color:    string;
  roomId:   string;
}

const rooms = new Map<string, Map<string, RoomPlayer>>();

export function setupGameSockets(io: SocketIO) {
  const ns = io.of("/game");

  ns.on("connection", (socket) => {
    let currentRoom: string | null = null;
    let playerId = socket.id;

    socket.on("joinRoom", ({
      roomId, playerName, color = "#6C5CE7",
      width = 32, height = 32,
    }: {
      roomId: string; playerName: string; color?: string;
      width?: number; height?: number;
    }) => {
      currentRoom = roomId;
      socket.join(roomId);

      if (!rooms.has(roomId)) rooms.set(roomId, new Map());
      const room = rooms.get(roomId)!;

      const player: RoomPlayer = {
        id: playerId, name: playerName, x: 40, y: 480,
        vx: 0, vy: 0, width, height, color, roomId,
      };
      room.set(playerId, player);

      // Send existing players to newcomer
      const others = Array.from(room.values()).filter((p) => p.id !== playerId);
      socket.emit("roomState", { players: others, roomId });

      // Announce to room
      socket.to(roomId).emit("playerJoined", player);
    });

    socket.on("playerMove", ({
      x, y, vx, vy,
    }: { x: number; y: number; vx: number; vy: number }) => {
      if (!currentRoom) return;
      const room = rooms.get(currentRoom);
      if (!room) return;
      const p = room.get(playerId);
      if (p) { p.x = x; p.y = y; p.vx = vx; p.vy = vy; }
      socket.to(currentRoom).emit("playerMoved", { id: playerId, x, y, vx, vy });
    });

    socket.on("listRooms", () => {
      const list = Array.from(rooms.entries()).map(([id, members]) => ({
        id, playerCount: members.size,
      }));
      socket.emit("roomList", list);
    });

    socket.on("disconnect", () => {
      if (!currentRoom) return;
      const room = rooms.get(currentRoom);
      if (room) {
        room.delete(playerId);
        if (room.size === 0) rooms.delete(currentRoom);
      }
      ns.to(currentRoom).emit("playerLeft", { id: playerId });
    });
  });
}

export default router;
