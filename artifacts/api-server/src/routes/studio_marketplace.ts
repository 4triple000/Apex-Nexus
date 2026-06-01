import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, studioMarketplaceTable, studioProjectsTable, usersTable } from "@workspace/db";
import { eq, desc, ilike, or, sql } from "drizzle-orm";

import { validateGraph, executeGraph } from "../lib/nodeExecutor";
import { logger } from "../lib/logger";

async function resolveAuthorId(sessionId?: string): Promise<number | undefined> {
  if (!sessionId) return undefined;
  const [u] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.sessionId, sessionId)).limit(1);
  return u?.id;
}

const router: IRouter = Router();

// ─────────────────────────────────────────────────────────────
// LIST — GET /marketplace/studio/items
// ─────────────────────────────────────────────────────────────

router.get("/marketplace/studio/items", async (req, res): Promise<void> => {
  const type = (req.query.type as string) ?? "";
  const search = (req.query.search as string) ?? "";
  const sort = (req.query.sort as string) ?? "popular";

  let q = db
    .select()
    .from(studioMarketplaceTable)
    .where(eq(studioMarketplaceTable.isPublic, true))
    .$dynamic();

  if (type && type !== "all") {
    q = q.where(eq(studioMarketplaceTable.type, type));
  }

  if (search) {
    q = q.where(
      or(
        ilike(studioMarketplaceTable.title, `%${search}%`),
        ilike(studioMarketplaceTable.description ?? sql`''`, `%${search}%`)
      )
    );
  }

  const orderCol =
    sort === "newest" ? desc(studioMarketplaceTable.publishedAt)
    : sort === "most_liked" ? desc(studioMarketplaceTable.likes)
    : sort === "most_remixed" ? desc(studioMarketplaceTable.remixes)
    : desc(studioMarketplaceTable.plays); // default: popular

  const items = await q.orderBy(orderCol).limit(60);
  res.json({ items });
});

// ─────────────────────────────────────────────────────────────
// GET SINGLE — GET /marketplace/studio/items/:id
// ─────────────────────────────────────────────────────────────

router.get("/marketplace/studio/items/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [item] = await db
    .select()
    .from(studioMarketplaceTable)
    .where(eq(studioMarketplaceTable.id, id))
    .limit(1);
  if (!item) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ item });
});

// ─────────────────────────────────────────────────────────────
// PUBLISH — POST /marketplace/studio/publish
// ─────────────────────────────────────────────────────────────

const PublishBody = z.object({
  studioProjectId: z.number().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(["game", "ai_tool", "app", "automation", "media"]).default("automation"),
  thumbnail: z.string().default("⚡"),
  authorName: z.string().default("Apex User"),
  sessionId: z.string().optional(),
  nodes: z.array(z.any()),
  edges: z.array(z.any()),
});

router.post("/marketplace/studio/publish", async (req, res): Promise<void> => {
  const parsed = PublishBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { studioProjectId, title, description, type, thumbnail, authorName, sessionId, nodes, edges } = parsed.data;
  const authorId = await resolveAuthorId(sessionId);

  // Validate the graph before publishing
  const errors = validateGraph(nodes, edges);
  if (errors.length > 0) {
    res.status(400).json({ error: "Graph is invalid and cannot be published", details: errors });
    return;
  }

  if (nodes.length === 0) {
    res.status(400).json({ error: "Cannot publish an empty graph. Add some nodes first." });
    return;
  }

  // If re-publishing an existing studio project, update the marketplace item
  if (studioProjectId) {
    const existing = await db
      .select()
      .from(studioMarketplaceTable)
      .where(eq(studioMarketplaceTable.studioProjectId, studioProjectId))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(studioMarketplaceTable)
        .set({ title, description, type, thumbnail, authorName, authorId, nodes, edges, isPublic: true, updatedAt: new Date() })
        .where(eq(studioMarketplaceTable.studioProjectId, studioProjectId))
        .returning();

      // Mark the source project as published
      await db
        .update(studioProjectsTable)
        .set({ isPublished: true, updatedAt: new Date() })
        .where(eq(studioProjectsTable.id, studioProjectId));

      logger.info({ studioProjectId, marketplaceId: updated.id }, "Studio project re-published");
      res.json({ item: updated, updated: true });
      return;
    }
  }

  // Create new marketplace entry
  const [item] = await db
    .insert(studioMarketplaceTable)
    .values({ studioProjectId, title, description, type, thumbnail, authorName, authorId, nodes, edges })
    .returning();

  // Mark the source studio project as published
  if (studioProjectId) {
    await db
      .update(studioProjectsTable)
      .set({ isPublished: true, updatedAt: new Date() })
      .where(eq(studioProjectsTable.id, studioProjectId));
  }

  logger.info({ studioProjectId, marketplaceId: item.id }, "Studio project published");
  res.status(201).json({ item });
});

// ─────────────────────────────────────────────────────────────
// RUN — POST /marketplace/studio/items/:id/run
// Uses the same execution engine as Studio projects
// ─────────────────────────────────────────────────────────────

router.post("/marketplace/studio/items/:id/run", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [item] = await db
    .select()
    .from(studioMarketplaceTable)
    .where(eq(studioMarketplaceTable.id, id))
    .limit(1);
  if (!item) { res.status(404).json({ error: "Not found" }); return; }
  if (!item.isPublic) { res.status(403).json({ error: "This project is not public" }); return; }

  const nodes = item.nodes as { id: string; type: string; data: Record<string, string | number | boolean> }[];
  const edges = item.edges as { id: string; from: string; to: string; label?: string }[];
  const userInputs: Record<string, string> = {};

  for (const [k, v] of Object.entries((req.body?.inputs ?? {}) as Record<string, unknown>)) {
    userInputs[k] = String(v);
  }

  const errors = validateGraph(nodes, edges);
  if (errors.length > 0) {
    res.status(400).json({ error: "Invalid graph", details: errors });
    return;
  }

  const context: Record<string, string> = { ...userInputs };
  let executionLog: { nodeId: string; nodeType: string; label: string; output: string; success: boolean }[] = [];

  try {
    executionLog = await executeGraph(nodes, edges, context);
  } catch (err) {
    const msg = (err as Error).message;
    logger.error({ marketplaceId: id, error: msg }, "Marketplace graph execution failed");
    executionLog.push({ nodeId: "__error__", nodeType: "error", label: "Execution Error", output: msg, success: false });
  }

  // Increment play count
  await db
    .update(studioMarketplaceTable)
    .set({ plays: sql`${studioMarketplaceTable.plays} + 1`, updatedAt: new Date() })
    .where(eq(studioMarketplaceTable.id, id));

  const finalOutput = [...executionLog].reverse().find((s) => s.success)?.output ?? "Completed";
  res.json({ executionLog, finalOutput, context });
});

// ─────────────────────────────────────────────────────────────
// LIKE — POST /marketplace/studio/items/:id/like
// ─────────────────────────────────────────────────────────────

router.post("/marketplace/studio/items/:id/like", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [item] = await db
    .select()
    .from(studioMarketplaceTable)
    .where(eq(studioMarketplaceTable.id, id))
    .limit(1);
  if (!item) { res.status(404).json({ error: "Not found" }); return; }

  const [updated] = await db
    .update(studioMarketplaceTable)
    .set({ likes: sql`${studioMarketplaceTable.likes} + 1`, updatedAt: new Date() })
    .where(eq(studioMarketplaceTable.id, id))
    .returning();

  res.json({ likes: updated.likes });
});

// ─────────────────────────────────────────────────────────────
// REMIX — POST /marketplace/studio/items/:id/remix
// Clones the marketplace item as a new editable Studio project
// ─────────────────────────────────────────────────────────────

router.post("/marketplace/studio/items/:id/remix", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [item] = await db
    .select()
    .from(studioMarketplaceTable)
    .where(eq(studioMarketplaceTable.id, id))
    .limit(1);
  if (!item) { res.status(404).json({ error: "Not found" }); return; }

  // Clone as a new studio project
  const [newProject] = await db
    .insert(studioProjectsTable)
    .values({
      title: `Remix of ${item.title}`,
      type: item.type as "game" | "ai_tool" | "app" | "automation" | "media",
      description: `Remixed from "${item.title}" by ${item.authorName}`,
      thumbnail: item.thumbnail,
      nodes: item.nodes,
      edges: item.edges,
    })
    .returning();

  // Increment remix count on marketplace item
  await db
    .update(studioMarketplaceTable)
    .set({ remixes: sql`${studioMarketplaceTable.remixes} + 1`, updatedAt: new Date() })
    .where(eq(studioMarketplaceTable.id, id));

  logger.info({ marketplaceId: id, newProjectId: newProject.id }, "Marketplace item remixed");
  res.status(201).json({ project: newProject });
});

// ─────────────────────────────────────────────────────────────
// SEED DEMO ITEMS — POST /marketplace/studio/seed
// ─────────────────────────────────────────────────────────────

router.post("/marketplace/studio/seed", async (_req, res): Promise<void> => {
  const existing = await db.select().from(studioMarketplaceTable);
  if (existing.length >= 4) { res.json({ success: true, message: "Already seeded" }); return; }

  const demos = [
    {
      title: "Text Adventure Game",
      description: "A classic RPG text adventure with an AI dungeon master",
      type: "game" as const,
      thumbnail: "🎮",
      authorName: "Apex Demo",
      plays: 347,
      likes: 82,
      remixes: 23,
      nodes: [
        { id: "n1", type: "start", x: 60, y: 200, data: {} },
        { id: "n2", type: "player_input", x: 320, y: 200, data: { label: "Your Name", default: "Hero" } },
        { id: "n3", type: "scene_switch", x: 580, y: 200, data: { scene: "dungeon_entrance" } },
        { id: "n4", type: "ai_character", x: 840, y: 200, data: { persona: "a mysterious dungeon master", message: "Welcome {{playerInput}} to the dungeon! Choose: explore or flee?", outputKey: "dmResponse" } },
        { id: "n5", type: "score_track", x: 1100, y: 200, data: { operation: "add", amount: 10 } },
        { id: "n6", type: "display_result", x: 1360, y: 200, data: { template: "{{dmResponse}}\n\n🏆 Score: {{score}}" } },
      ],
      edges: [
        { id: "e1", from: "n1", to: "n2" },
        { id: "e2", from: "n2", to: "n3" },
        { id: "e3", from: "n3", to: "n4" },
        { id: "e4", from: "n4", to: "n5" },
        { id: "e5", from: "n5", to: "n6" },
      ],
    },
    {
      title: "AI Blog Post Generator",
      description: "Enter a topic and get a full blog post + category",
      type: "ai_tool" as const,
      thumbnail: "🤖",
      authorName: "ContentLabs",
      plays: 892,
      likes: 201,
      remixes: 67,
      nodes: [
        { id: "n1", type: "start", x: 60, y: 200, data: {} },
        { id: "n2", type: "user_input", x: 320, y: 200, data: { label: "Blog Topic", value: "" } },
        { id: "n3", type: "generate_text", x: 580, y: 200, data: { prompt: "Write a concise 3-paragraph blog post about: {{userInput}}", outputKey: "blogPost" } },
        { id: "n4", type: "summarize", x: 840, y: 200, data: { text: "{{blogPost}}", outputKey: "summary" } },
        { id: "n5", type: "classify", x: 1100, y: 200, data: { text: "{{summary}}", categories: "tech, business, science, lifestyle, finance", outputKey: "category" } },
        { id: "n6", type: "display_result", x: 1360, y: 200, data: { template: "📂 Category: {{category}}\n\n📝 Summary:\n{{summary}}" } },
      ],
      edges: [
        { id: "e1", from: "n1", to: "n2" },
        { id: "e2", from: "n2", to: "n3" },
        { id: "e3", from: "n3", to: "n4" },
        { id: "e4", from: "n4", to: "n5" },
        { id: "e5", from: "n5", to: "n6" },
      ],
    },
    {
      title: "Smart Score Checker",
      description: "IF/ELSE automation — pass or fail based on your score",
      type: "automation" as const,
      thumbnail: "⚡",
      authorName: "AutoFlow",
      plays: 556,
      likes: 134,
      remixes: 34,
      nodes: [
        { id: "n1", type: "start", x: 60, y: 200, data: {} },
        { id: "n2", type: "user_input", x: 320, y: 200, data: { label: "Your Score (0-100)", value: "" } },
        { id: "n3", type: "compare", x: 580, y: 200, data: { a: "{{userInput}}", b: "70", operator: "gt" } },
        { id: "n4", type: "if", x: 840, y: 200, data: { condition: "{{lastCompare}}" } },
        { id: "n5", type: "display_result", x: 1100, y: 100, data: { template: "✅ Score {{userInput}} — PASSED! Well done!" } },
        { id: "n6", type: "display_result", x: 1100, y: 320, data: { template: "❌ Score {{userInput}} — FAILED. Keep trying!" } },
      ],
      edges: [
        { id: "e1", from: "n1", to: "n2" },
        { id: "e2", from: "n2", to: "n3" },
        { id: "e3", from: "n3", to: "n4" },
        { id: "e4", from: "n4", to: "n5", label: "true" },
        { id: "e5", from: "n4", to: "n6", label: "false" },
      ],
    },
    {
      title: "AI Character Chat",
      description: "Talk to a custom AI persona with a unique personality",
      type: "app" as const,
      thumbnail: "🎭",
      authorName: "CharacterAI Labs",
      plays: 1203,
      likes: 412,
      remixes: 112,
      nodes: [
        { id: "n1", type: "start", x: 60, y: 200, data: {} },
        { id: "n2", type: "user_input", x: 320, y: 200, data: { label: "Your message", value: "" } },
        { id: "n3", type: "ai_character", x: 600, y: 200, data: { persona: "a witty and sarcastic AI assistant who always ends with a joke", message: "{{userInput}}", outputKey: "reply" } },
        { id: "n4", type: "display_result", x: 900, y: 200, data: { template: "🎭 {{reply}}" } },
      ],
      edges: [
        { id: "e1", from: "n1", to: "n2" },
        { id: "e2", from: "n2", to: "n3" },
        { id: "e3", from: "n3", to: "n4" },
      ],
    },
  ];

  for (const demo of demos) {
    const { plays, likes, remixes, ...insertData } = demo;
    await db.insert(studioMarketplaceTable).values({
      ...insertData,
      plays,
      likes,
      remixes,
    });
  }

  res.json({ success: true, count: demos.length });
});

export default router;
