/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  APEX GAME FEED — REST API  (Self-Publishing Game Ecosystem v1)     ║
 * ║  GET  /api/game-feed                 — trending feed                ║
 * ║  POST /api/game-feed/publish         — publish a game               ║
 * ║  POST /api/game-feed/remix           — AI remix a game              ║
 * ║  POST /api/game-feed/viral-generate  — AI create viral variant      ║
 * ║  POST /api/game-feed/:id/like        — toggle like                  ║
 * ║  POST /api/game-feed/:id/play        — increment plays              ║
 * ║  POST /api/game-feed/:id/complete    — track completion             ║
 * ║  POST /api/game-feed/:id/playtime    — track play duration          ║
 * ║  GET  /api/game-feed/:id/analytics   — creator analytics            ║
 * ║  GET  /api/game-feed/:id/lineage     — remix lineage tree           ║
 * ║  GET  /api/game-feed/tags/trending   — top trending tags            ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */
import { Router, type IRouter } from "express";
import { db, gameFeedTable, gameFeedLikesTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

// ── Demo seed data ────────────────────────────────────────────────────────────

const SEED_GAMES = [
  {
    name: "Neon Platformer",
    creatorName: "Apex AI",
    createdBy: "ai" as const,
    tags: ["platformer", "neon", "coins"],
    gameConfig: {
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
    name: "Sky Jumper",
    creatorName: "Apex AI",
    createdBy: "ai" as const,
    tags: ["platformer", "sky", "reach"],
    gameConfig: {
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
    name: "Dodge Blitz",
    creatorName: "Apex AI",
    createdBy: "ai" as const,
    tags: ["survival", "dodge", "intense"],
    gameConfig: {
      name: "Dodge Blitz", gravity: 0, winCondition: "survive", surviveSecs: 30,
      background: "#0d0a1e", width: 400, height: 600,
      player: { x: 184, y: 500, width: 32, height: 32, color: "green", jumpForce: 0, speed: 5.5 },
      platforms: [{ x: 0, y: 580, width: 400, height: 20, color: "#1a1a2e" }],
      enemies: [
        { x: 50,  y: -40,  width: 30, height: 30, color: "red",    speed: 3   },
        { x: 150, y: -80,  width: 30, height: 30, color: "orange", speed: 3.5 },
        { x: 250, y: -120, width: 30, height: 30, color: "red",    speed: 4   },
        { x: 330, y: -60,  width: 30, height: 30, color: "orange", speed: 3.2 },
      ],
      coins: [],
    },
  },
  {
    name: "Coin Rush",
    creatorName: "Apex AI",
    createdBy: "ai" as const,
    tags: ["coins", "speed", "platformer"],
    gameConfig: {
      name: "Coin Rush", gravity: 0.5, winCondition: "collect_all",
      background: "#0a0f08", width: 400, height: 600,
      player: { x: 30, y: 500, width: 28, height: 28, color: "yellow", jumpForce: 11, speed: 5.2 },
      platforms: [
        { x: 0,   y: 560, width: 400, height: 16, color: "#1a2a0a" },
        { x: 40,  y: 470, width: 70,  height: 12, color: "#1a2a0a" },
        { x: 160, y: 400, width: 80,  height: 12, color: "#1a2a0a" },
        { x: 60,  y: 330, width: 90,  height: 12, color: "#1a2a0a" },
        { x: 200, y: 260, width: 70,  height: 12, color: "#1a2a0a" },
        { x: 100, y: 190, width: 80,  height: 12, color: "#1a2a0a" },
        { x: 240, y: 120, width: 100, height: 12, color: "#1a2a0a" },
        { x: 50,  y: 60,  width: 70,  height: 12, color: "#1a2a0a" },
      ],
      enemies: [
        { x: 170, y: 375, width: 24, height: 24, color: "red", speed: 1.8, patrol: { minX: 160, maxX: 240 } },
      ],
      coins: [
        { x: 55,  y: 445, radius: 8, color: "gold", value: 10 },
        { x: 195, y: 375, radius: 8, color: "gold", value: 10 },
        { x: 90,  y: 305, radius: 8, color: "gold", value: 10 },
        { x: 230, y: 235, radius: 8, color: "gold", value: 10 },
        { x: 140, y: 165, radius: 8, color: "gold", value: 15 },
        { x: 270, y: 95,  radius: 10, color: "#ffcc33", value: 25 },
        { x: 75,  y: 35,  radius: 10, color: "#ffcc33", value: 30 },
      ],
    },
  },
  {
    name: "Boss Rush",
    creatorName: "Apex AI",
    createdBy: "ai" as const,
    tags: ["boss", "hard", "combat"],
    gameConfig: {
      name: "Boss Rush", gravity: 0.6, winCondition: "defeat_all",
      background: "#150010", width: 400, height: 600,
      player: { x: 30, y: 500, width: 32, height: 32, color: "cyan", jumpForce: 13, speed: 5.0 },
      platforms: [
        { x: 0,   y: 560, width: 400, height: 16, color: "#2a0020" },
        { x: 60,  y: 460, width: 100, height: 12, color: "#2a0020" },
        { x: 240, y: 460, width: 100, height: 12, color: "#2a0020" },
        { x: 140, y: 370, width: 120, height: 12, color: "#2a0020" },
        { x: 40,  y: 280, width: 80,  height: 12, color: "#2a0020" },
        { x: 280, y: 280, width: 80,  height: 12, color: "#2a0020" },
        { x: 130, y: 200, width: 140, height: 12, color: "#3a0030" },
      ],
      enemies: [
        { x: 170, y: 490, width: 54, height: 54, color: "red",    speed: 0.8, patrol: { minX: 60, maxX: 340 } },
        { x: 80,  y: 440, width: 28, height: 28, color: "orange", speed: 2.2, patrol: { minX: 60, maxX: 160 } },
        { x: 260, y: 440, width: 28, height: 28, color: "orange", speed: 2.2, patrol: { minX: 240, maxX: 340 } },
      ],
      coins: [
        { x: 200, y: 340, radius: 10, color: "#ffcc33", value: 50 },
        { x: 150, y: 170, radius: 14, color: "#ffcc33", value: 100 },
      ],
    },
  },
];

// ── Auto-seed helper ──────────────────────────────────────────────────────────

let seeded = false;

async function seedIfEmpty() {
  if (seeded) return;
  const existing = await db.select({ id: gameFeedTable.id }).from(gameFeedTable).limit(1);
  if (existing.length === 0) {
    for (const game of SEED_GAMES) {
      await db.insert(gameFeedTable).values(game).onConflictDoNothing();
    }
    console.log("[GameFeed] Seeded feed with", SEED_GAMES.length, "demo games");
  }
  seeded = true;
}

// ── Trending score formula ────────────────────────────────────────────────────
// score = plays×0.5 + likes×1.5 + completions×2 + 10/(hours+2)

// ── GET /api/game-feed ─────────────────────────────────────────────────────────

router.get("/game-feed", async (req, res): Promise<void> => {
  try {
    await seedIfEmpty();

    const sessionId = req.headers["x-session-id"] as string || "";
    const limit  = Math.min(Number(req.query.limit) || 20, 50);
    const offset = Number(req.query.offset) || 0;
    const tag    = req.query.tag as string | undefined;

    let query = db
      .select()
      .from(gameFeedTable)
      .orderBy(
        desc(
          sql`${gameFeedTable.playCount} * 0.5 + ${gameFeedTable.likeCount} * 1.5 +
              ${gameFeedTable.completionCount} * 2.0 +
              10.0 / (EXTRACT(EPOCH FROM (NOW() - ${gameFeedTable.createdAt})) / 3600.0 + 2)`
        )
      )
      .limit(limit)
      .offset(offset);

    const entries = tag
      ? await db
          .select()
          .from(gameFeedTable)
          .where(sql`${gameFeedTable.tags} @> ARRAY[${tag}]::text[]`)
          .orderBy(desc(gameFeedTable.createdAt))
          .limit(limit)
          .offset(offset)
      : await query;

    let likedSet = new Set<number>();
    if (sessionId) {
      const likes = await db
        .select({ entryId: gameFeedLikesTable.entryId })
        .from(gameFeedLikesTable)
        .where(eq(gameFeedLikesTable.sessionId, sessionId));
      likedSet = new Set(likes.map((l) => l.entryId));
    }

    const result = entries.map((e) => ({
      ...e,
      isLiked: likedSet.has(e.id),
      avgPlayDurationMs: e.playCount > 0 ? Math.round(e.totalPlayDurationMs / e.playCount) : 0,
      completionRate: e.playCount > 0 ? Math.round((e.completionCount / e.playCount) * 100) : 0,
    }));

    res.json({ entries: result, total: result.length, offset });
  } catch (err) {
    console.error("[GameFeed] GET error:", err);
    res.status(500).json({ error: "Failed to load feed" });
  }
});

// ── GET /api/game-feed/tags/trending ───────────────────────────────────────────

router.get("/game-feed/tags/trending", async (req, res): Promise<void> => {
  try {
    await seedIfEmpty();

    const rows = await db.select({ tags: gameFeedTable.tags, plays: gameFeedTable.playCount })
      .from(gameFeedTable);

    const tagScore: Record<string, number> = {};
    for (const row of rows) {
      for (const tag of row.tags ?? []) {
        tagScore[tag] = (tagScore[tag] ?? 0) + row.plays;
      }
    }

    const sorted = Object.entries(tagScore)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([tag, score]) => ({ tag, score }));

    res.json({ tags: sorted });
  } catch (err) {
    console.error("[GameFeed] Tags error:", err);
    res.status(500).json({ error: "Failed to load tags" });
  }
});

// ── POST /api/game-feed/publish ────────────────────────────────────────────────

router.post("/game-feed/publish", async (req, res): Promise<void> => {
  try {
    const { name, creatorName = "Player", createdBy = "user", gameConfig, tags = [],
            remixable = true, isRemix = false, originalGameId, originalGameName } =
      req.body as {
        name?: string;
        creatorName?: string;
        createdBy?: "ai" | "user";
        gameConfig?: object;
        tags?: string[];
        remixable?: boolean;
        isRemix?: boolean;
        originalGameId?: number;
        originalGameName?: string;
      };

    if (!name || !gameConfig) {
      res.status(400).json({ error: "name and gameConfig required" });
      return;
    }

    const [entry] = await db
      .insert(gameFeedTable)
      .values({ name, creatorName, createdBy, gameConfig, tags, remixable, isRemix, originalGameId, originalGameName })
      .returning();

    res.json({ entry });
  } catch (err) {
    console.error("[GameFeed] Publish error:", err);
    res.status(500).json({ error: "Failed to publish game" });
  }
});

// ── POST /api/game-feed/remix ──────────────────────────────────────────────────

const REMIX_SYSTEM_PROMPT = `You are an expert game designer and JSON transformer for a 2D platformer game engine.
You will receive a game config JSON and a user instruction. Your job is to modify the game config according to the instruction.

Rules:
- Output ONLY valid raw JSON — no markdown, no code fences, no explanation
- Preserve the exact same JSON structure and field names
- Modify ONLY what is necessary to fulfill the instruction
- ALWAYS ensure the win condition is achievable:
  - collect_all: coins must be reachable by the player (on or near platforms)
  - reach_end: endX must be reachable
  - survive: time must be reasonable (15-60 seconds)
- ALWAYS ensure platforms form a connected path the player can traverse
- Keep player.x and player.y on or near the first platform
- Numeric values: gravity 0.3-1.0, jumpForce 8-18, speed 2-8
- Enemy speed 0.5-4.0, patrol range must stay within platform bounds
- coin radius 6-14, value 5-100
- platform height 10-16, no platform should be unreachable (max vertical gap ~120px)
- When changing theme/color: use hex or CSS color names (blue, red, green, cyan, purple, gold, orange, pink, white)

Preset interpretations:
- "Make Harder": increase enemy count/speed, reduce platform width, add more gaps
- "Add Chaos": add 3-5 fast enemies, randomize platform positions slightly, add coins in risky spots
- "Speed x2": double player.speed and jumpForce (cap at 8 and 16), double all enemy speeds (cap at 4)
- "Add Boss": add one large enemy (width 60-80, height 60-80, speed 0.4) at center-top area
- "Night Mode": change background to #010208, all platforms to dark blue/purple tones, player to cyan`;

router.post("/game-feed/remix", async (req, res): Promise<void> => {
  try {
    const { gameConfig, instruction } = req.body as {
      gameConfig?: unknown;
      instruction?: string;
    };

    if (!gameConfig || !instruction?.trim()) {
      res.status(400).json({ error: "gameConfig and instruction are required" });
      return;
    }

    const userMessage = `Original game config:\n${JSON.stringify(gameConfig, null, 2)}\n\nInstruction: "${instruction.trim()}"`;

    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 4096,
      messages: [
        { role: "system", content: REMIX_SYSTEM_PROMPT },
        { role: "user",   content: userMessage },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim() ?? "";
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    let modifiedConfig: unknown;
    try {
      modifiedConfig = JSON.parse(cleaned);
    } catch {
      console.error("[GameFeed Remix] JSON parse failed:", cleaned.slice(0, 200));
      res.status(422).json({ error: "AI returned invalid JSON. Try a simpler instruction." });
      return;
    }

    res.json({ config: modifiedConfig });
  } catch (err) {
    console.error("[GameFeed Remix] error:", err);
    res.status(500).json({ error: "Remix failed. Please try again." });
  }
});

// ── POST /api/game-feed/viral-generate ────────────────────────────────────────
// AI generates a fresh viral variant based on top trending game

const VIRAL_SYSTEM_PROMPT = `You are an expert game designer creating viral mobile game configs for a 2D platformer engine.
Given an existing game config as inspiration, create a fresh, exciting new game with a different name, theme, and gameplay twist.

Rules:
- Output ONLY valid raw JSON — no markdown, no code fences, no explanation
- Use the EXACT same JSON structure as the input
- Give it a catchy viral name (2-3 words, exciting)
- Choose a fresh visual theme (space, lava world, candy, underwater, cyberpunk, etc.)
- The game must be fun, challenging but winnable
- Win conditions: collect_all, reach_end, survive, or defeat_all
- Numeric values: gravity 0.3-1.0, jumpForce 8-18, speed 2-8, enemy speed 0.5-3.5
- Include 5-8 platforms, 2-4 enemies, 3-8 coins
- All elements must be reachable by the player`;

router.post("/game-feed/viral-generate", async (req, res): Promise<void> => {
  try {
    // Get top trending game to use as template
    const topGames = await db
      .select()
      .from(gameFeedTable)
      .orderBy(
        desc(sql`${gameFeedTable.playCount} * 0.5 + ${gameFeedTable.likeCount} * 1.5`)
      )
      .limit(3);

    if (topGames.length === 0) {
      res.status(400).json({ error: "No games in feed yet" });
      return;
    }

    const template = topGames[Math.floor(Math.random() * topGames.length)];
    const inspiration = req.body?.inspiration as string | undefined;

    const userMessage = `Template game config:\n${JSON.stringify(template!.gameConfig, null, 2)}${
      inspiration ? `\n\nCreative direction: ${inspiration}` : ""
    }`;

    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 4096,
      messages: [
        { role: "system", content: VIRAL_SYSTEM_PROMPT },
        { role: "user",   content: userMessage },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim() ?? "";
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    let newConfig: Record<string, unknown>;
    try {
      newConfig = JSON.parse(cleaned);
    } catch {
      res.status(422).json({ error: "AI returned invalid JSON" });
      return;
    }

    const newName = (newConfig.name as string) || `Viral Game ${Date.now()}`;
    const suggestedTags = ["viral", "trending", "ai-generated"];

    // Auto-publish if requested
    if (req.body?.autoPublish === true) {
      const [entry] = await db
        .insert(gameFeedTable)
        .values({
          name: newName,
          creatorName: "Viral Engine",
          createdBy: "ai",
          gameConfig: newConfig,
          tags: suggestedTags,
          isRemix: true,
          originalGameId: template!.id,
          originalGameName: template!.name,
        })
        .returning();
      res.json({ config: newConfig, entry, published: true });
    } else {
      res.json({ config: newConfig, published: false, suggestedName: newName, suggestedTags });
    }
  } catch (err) {
    console.error("[GameFeed] Viral generate error:", err);
    res.status(500).json({ error: "Failed to generate viral game" });
  }
});

// ── POST /api/game-feed/:id/like ───────────────────────────────────────────────

router.post("/game-feed/:id/like", async (req, res): Promise<void> => {
  try {
    const id        = parseInt(req.params["id"]!);
    const sessionId = req.headers["x-session-id"] as string || req.body?.sessionId;

    if (!sessionId) { res.status(400).json({ error: "sessionId required" }); return; }

    const existing = await db
      .select()
      .from(gameFeedLikesTable)
      .where(and(eq(gameFeedLikesTable.entryId, id), eq(gameFeedLikesTable.sessionId, sessionId)))
      .limit(1);

    if (existing.length > 0) {
      await db.delete(gameFeedLikesTable)
        .where(and(eq(gameFeedLikesTable.entryId, id), eq(gameFeedLikesTable.sessionId, sessionId)));
      await db.update(gameFeedTable)
        .set({ likeCount: sql`GREATEST(0, ${gameFeedTable.likeCount} - 1)` })
        .where(eq(gameFeedTable.id, id));
      res.json({ liked: false });
    } else {
      await db.insert(gameFeedLikesTable).values({ entryId: id, sessionId }).onConflictDoNothing();
      await db.update(gameFeedTable)
        .set({ likeCount: sql`${gameFeedTable.likeCount} + 1` })
        .where(eq(gameFeedTable.id, id));
      res.json({ liked: true });
    }
  } catch (err) {
    console.error("[GameFeed] Like error:", err);
    res.status(500).json({ error: "Failed to toggle like" });
  }
});

// ── POST /api/game-feed/:id/play ───────────────────────────────────────────────

router.post("/game-feed/:id/play", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params["id"]!);
    await db.update(gameFeedTable)
      .set({ playCount: sql`${gameFeedTable.playCount} + 1` })
      .where(eq(gameFeedTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    console.error("[GameFeed] Play count error:", err);
    res.status(500).json({ error: "Failed to update play count" });
  }
});

// ── POST /api/game-feed/:id/complete ──────────────────────────────────────────

router.post("/game-feed/:id/complete", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params["id"]!);
    await db.update(gameFeedTable)
      .set({ completionCount: sql`${gameFeedTable.completionCount} + 1` })
      .where(eq(gameFeedTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    console.error("[GameFeed] Complete error:", err);
    res.status(500).json({ error: "Failed to track completion" });
  }
});

// ── POST /api/game-feed/:id/playtime ──────────────────────────────────────────

router.post("/game-feed/:id/playtime", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params["id"]!);
    const { durationMs } = req.body as { durationMs?: number };

    if (!durationMs || durationMs < 0) {
      res.status(400).json({ error: "durationMs required" });
      return;
    }

    await db.update(gameFeedTable)
      .set({ totalPlayDurationMs: sql`${gameFeedTable.totalPlayDurationMs} + ${durationMs}` })
      .where(eq(gameFeedTable.id, id));

    res.json({ ok: true });
  } catch (err) {
    console.error("[GameFeed] Playtime error:", err);
    res.status(500).json({ error: "Failed to track playtime" });
  }
});

// ── GET /api/game-feed/:id/analytics ──────────────────────────────────────────

router.get("/game-feed/:id/analytics", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params["id"]!);

    const [entry] = await db.select().from(gameFeedTable).where(eq(gameFeedTable.id, id)).limit(1);
    if (!entry) { res.status(404).json({ error: "Game not found" }); return; }

    const remixes = await db.select({ id: gameFeedTable.id, name: gameFeedTable.name,
        creatorName: gameFeedTable.creatorName, playCount: gameFeedTable.playCount,
        likeCount: gameFeedTable.likeCount, createdAt: gameFeedTable.createdAt })
      .from(gameFeedTable)
      .where(eq(gameFeedTable.originalGameId, id));

    const trendScore = entry.playCount * 0.5 + entry.likeCount * 1.5 + entry.completionCount * 2;
    const avgPlayMs  = entry.playCount > 0 ? Math.round(entry.totalPlayDurationMs / entry.playCount) : 0;
    const completionRate = entry.playCount > 0
      ? Math.round((entry.completionCount / entry.playCount) * 100)
      : 0;
    const replayRate = entry.playCount > 0
      ? Math.round((entry.replayCount / entry.playCount) * 100)
      : 0;

    // Retention curve — synthesized from available data
    const retentionCurve = [
      { second: 0,  rate: 100 },
      { second: 5,  rate: Math.min(100, completionRate + 40) },
      { second: 15, rate: Math.min(100, completionRate + 20) },
      { second: 30, rate: Math.min(100, completionRate + 10) },
      { second: 60, rate: completionRate },
    ];

    res.json({
      id: entry.id,
      name: entry.name,
      creatorName: entry.creatorName,
      stats: {
        plays: entry.playCount,
        likes: entry.likeCount,
        completions: entry.completionCount,
        replays: entry.replayCount,
        remixes: remixes.length,
        avgPlayDurationMs: avgPlayMs,
        avgPlayDurationSec: Math.round(avgPlayMs / 1000),
        completionRate,
        replayRate,
        trendScore: Math.round(trendScore),
        engagementScore: Math.round((completionRate * 0.4 + replayRate * 0.3 + Math.min(100, entry.likeCount * 2) * 0.3)),
      },
      retentionCurve,
      remixes,
      createdAt: entry.createdAt,
    });
  } catch (err) {
    console.error("[GameFeed] Analytics error:", err);
    res.status(500).json({ error: "Failed to load analytics" });
  }
});

// ── GET /api/game-feed/:id/lineage ────────────────────────────────────────────

router.get("/game-feed/:id/lineage", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params["id"]!);

    const [game] = await db.select().from(gameFeedTable).where(eq(gameFeedTable.id, id)).limit(1);
    if (!game) { res.status(404).json({ error: "Game not found" }); return; }

    // Find root
    let root = game;
    if (game.originalGameId) {
      const [orig] = await db.select().from(gameFeedTable)
        .where(eq(gameFeedTable.id, game.originalGameId)).limit(1);
      if (orig) root = orig;
    }

    // Find all remixes of root
    const remixes = await db.select({ id: gameFeedTable.id, name: gameFeedTable.name,
        creatorName: gameFeedTable.creatorName, playCount: gameFeedTable.playCount,
        likeCount: gameFeedTable.likeCount, isRemix: gameFeedTable.isRemix,
        originalGameId: gameFeedTable.originalGameId, createdAt: gameFeedTable.createdAt })
      .from(gameFeedTable)
      .where(eq(gameFeedTable.originalGameId, root.id));

    res.json({
      root: { id: root.id, name: root.name, creatorName: root.creatorName,
               playCount: root.playCount, likeCount: root.likeCount },
      remixes,
      totalForks: remixes.length,
    });
  } catch (err) {
    console.error("[GameFeed] Lineage error:", err);
    res.status(500).json({ error: "Failed to load lineage" });
  }
});

export default router;
