import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, studioProjectsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { validateGraph, executeGraph, type NodeDef, type EdgeDef, type ExecStep } from "../lib/nodeExecutor";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ─────────────────────────────────────────────────────────────
// CRUD
// ─────────────────────────────────────────────────────────────

router.get("/studio/projects", async (_req, res): Promise<void> => {
  const projects = await db.select().from(studioProjectsTable).orderBy(desc(studioProjectsTable.updatedAt));
  res.json({ projects });
});

router.get("/studio/projects/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [p] = await db.select().from(studioProjectsTable).where(eq(studioProjectsTable.id, id)).limit(1);
  if (!p) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ project: p });
});

const CreateBody = z.object({
  title: z.string().min(1),
  type: z.enum(["game", "ai_tool", "app", "automation", "media"]).default("automation"),
  description: z.string().optional(),
  thumbnail: z.string().optional().default("⚡"),
  nodes: z.array(z.any()).optional().default([]),
  edges: z.array(z.any()).optional().default([]),
  viewport: z.object({ x: z.number(), y: z.number(), zoom: z.number() }).optional(),
});

router.post("/studio/projects", async (req, res): Promise<void> => {
  const parsed = CreateBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [p] = await db.insert(studioProjectsTable).values(parsed.data).returning();
  res.status(201).json({ project: p });
});

router.put("/studio/projects/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { title, description, nodes, edges, thumbnail, type, viewport } = req.body as {
    title: string;
    description?: string;
    nodes: NodeDef[];
    edges: EdgeDef[];
    thumbnail?: string;
    type?: string;
    viewport?: { x: number; y: number; zoom: number };
  };

  const graphErrors = validateGraph(nodes ?? [], edges ?? []);
  if (graphErrors.length > 0) {
    logger.warn({ graphErrors }, "Saving project with graph warnings");
  }

  const [p] = await db.update(studioProjectsTable)
    .set({ title, description, nodes, edges, thumbnail, type, viewport: viewport ?? null, updatedAt: new Date() })
    .where(eq(studioProjectsTable.id, id))
    .returning();
  if (!p) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ project: p, graphWarnings: graphErrors });
});

router.delete("/studio/projects/:id", async (req, res): Promise<void> => {
  await db.delete(studioProjectsTable).where(eq(studioProjectsTable.id, Number(req.params.id)));
  res.status(204).end();
});

// ─────────────────────────────────────────────────────────────
// RUN ENDPOINT
// ─────────────────────────────────────────────────────────────

router.post("/studio/projects/:id/run", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [project] = await db.select().from(studioProjectsTable).where(eq(studioProjectsTable.id, id)).limit(1);
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  const nodes = (project.nodes as NodeDef[]) ?? [];
  const edges = (project.edges as EdgeDef[]) ?? [];
  const userInputs: Record<string, string> = {};

  for (const [k, v] of Object.entries((req.body?.inputs ?? {}) as Record<string, unknown>)) {
    userInputs[k] = String(v);
  }

  const graphErrors = validateGraph(nodes, edges);
  if (graphErrors.length > 0) {
    res.status(400).json({ error: "Invalid graph", details: graphErrors });
    return;
  }

  if (nodes.length === 0) {
    res.json({ executionLog: [], finalOutput: "No nodes to execute", context: {} });
    return;
  }

  logger.info({ projectId: id, nodeCount: nodes.length, edgeCount: edges.length }, "Executing graph");

  const context: Record<string, string> = { ...userInputs };
  let executionLog: ExecStep[] = [];

  try {
    executionLog = await executeGraph(nodes, edges, context);
  } catch (err) {
    const msg = (err as Error).message;
    logger.error({ projectId: id, error: msg }, "Graph execution failed");
    executionLog.push({ nodeId: "__error__", nodeType: "error", label: "Execution Error", output: msg, success: false });
  }

  await db.update(studioProjectsTable)
    .set({ runCount: project.runCount + 1, updatedAt: new Date() })
    .where(eq(studioProjectsTable.id, id));

  const finalOutput = [...executionLog].reverse().find((s) => s.success)?.output ?? "Completed";
  res.json({ executionLog, finalOutput, context });
});

// ─────────────────────────────────────────────────────────────
// SEED STARTER PROJECTS
// ─────────────────────────────────────────────────────────────

router.post("/studio/seed", async (_req, res): Promise<void> => {
  const existing = await db.select().from(studioProjectsTable);
  if (existing.length >= 3) { res.json({ success: true, message: "Already seeded" }); return; }

  const starters = [
    {
      title: "Text Adventure Game",
      type: "game" as const,
      description: "A simple RPG text adventure with scenes, choices, and score",
      thumbnail: "🎮",
      nodes: [
        { id: "n1", type: "start", x: 60, y: 200, data: {} },
        { id: "n2", type: "player_input", x: 320, y: 200, data: { label: "Player Name", default: "Hero" } },
        { id: "n3", type: "scene_switch", x: 580, y: 200, data: { scene: "dungeon_entrance" } },
        { id: "n4", type: "ai_character", x: 840, y: 200, data: { persona: "a dungeon master", message: "Welcome {{playerInput}} to the dungeon! Choose: explore or flee?", outputKey: "dmResponse" } },
        { id: "n5", type: "score_track", x: 1100, y: 200, data: { operation: "add", amount: 10 } },
        { id: "n6", type: "display_result", x: 1360, y: 200, data: { template: "{{dmResponse}}\nScore: {{score}}" } },
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
      title: "AI Content Pipeline",
      type: "ai_tool" as const,
      description: "Research → Generate → Summarize → Publish",
      thumbnail: "🤖",
      nodes: [
        { id: "n1", type: "start", x: 60, y: 200, data: {} },
        { id: "n2", type: "user_input", x: 320, y: 200, data: { label: "Topic", value: "" } },
        { id: "n3", type: "generate_text", x: 580, y: 200, data: { prompt: "Write a 3-paragraph blog post about: {{userInput}}", outputKey: "content" } },
        { id: "n4", type: "summarize", x: 840, y: 200, data: { text: "{{content}}", outputKey: "summary" } },
        { id: "n5", type: "display_result", x: 1100, y: 200, data: { template: "📝 Summary:\n{{summary}}" } },
      ],
      edges: [
        { id: "e1", from: "n1", to: "n2" },
        { id: "e2", from: "n2", to: "n3" },
        { id: "e3", from: "n3", to: "n4" },
        { id: "e4", from: "n4", to: "n5" },
      ],
    },
    {
      title: "Smart Automation",
      type: "automation" as const,
      description: "Classify → Branch → Act with IF/ELSE logic",
      thumbnail: "⚡",
      nodes: [
        { id: "n1", type: "start", x: 60, y: 200, data: {} },
        { id: "n2", type: "user_input", x: 320, y: 200, data: { label: "Your Score", value: "" } },
        { id: "n3", type: "compare", x: 580, y: 200, data: { a: "{{userInput}}", b: "70", operator: "gt" } },
        { id: "n4", type: "if", x: 840, y: 200, data: { condition: "{{lastCompare}}" } },
        { id: "n5", type: "display_result", x: 1100, y: 80, data: { template: "✅ PASSED! Score: {{userInput}}" } },
        { id: "n6", type: "display_result", x: 1100, y: 340, data: { template: "❌ FAILED. Score: {{userInput}}" } },
      ],
      edges: [
        { id: "e1", from: "n1", to: "n2" },
        { id: "e2", from: "n2", to: "n3" },
        { id: "e3", from: "n3", to: "n4" },
        { id: "e4", from: "n4", to: "n5", label: "true" },
        { id: "e5", from: "n4", to: "n6", label: "false" },
      ],
    },
  ];

  for (const starter of starters) {
    await db.insert(studioProjectsTable).values(starter);
  }

  res.json({ success: true });
});

export default router;
