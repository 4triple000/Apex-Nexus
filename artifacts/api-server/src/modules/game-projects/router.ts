/**
 * Apex Engine projects: games people make, saved to their account.
 * Plan on the phone, then download a Unity or Unreal project on the computer.
 *
 *   GET    /engine/projects              — your projects
 *   POST   /engine/projects              — start a game (plan written by AI when connected)
 *   GET    /engine/projects/:id
 *   PATCH  /engine/projects/:id          — save title, target, config, plan, settings
 *   DELETE /engine/projects/:id
 *   POST   /engine/projects/:id/plan     — AI changes the plan    { message }
 *   POST   /engine/projects/:id/edit     — AI changes the Apex game { message }
 *   POST   /engine/projects/:id/export   — download the Unity / Unreal project (.zip)
 */
import { Router, type IRouter, type Response } from "express";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import archiver from "archiver";
import { isOpenAIConfigured } from "@workspace/integrations-openai-ai-server";
import { db, gameProjectsTable, type GameProject } from "@workspace/db";
import { requireUser } from "../../shared/middleware/requireAuth";
import { success, badRequest, notFound, serverError } from "../../shared/utils/response";
import type { ApexRequest } from "../../shared/types";
import { logger } from "../../lib/logger";
import {
  ENGINES, TARGETS, TEMPLATES, GamePlan, aiPlan, aiEditPlan, aiEditConfig, checklistFor, detectTemplate, platformsFor,
  type Engine, type Target,
} from "./plan";
import { unityProject } from "./unity";
import { unrealProject } from "./unreal";

const router: IRouter = Router();
router.use("/engine", requireUser);

const NO_AI = "The AI helper isn't connected yet. Add OPENAI_API_KEY on the server.";

/** Mobile games use Unity; computer games use Unreal or Unity; quick games use Apex. */
function engineFor(target: Target, engine?: Engine): Engine {
  if (target === "apex") return "apex";
  if (target === "mobile") return "unity";
  return engine === "unity" ? "unity" : "unreal";
}

const Config = z.record(z.string(), z.unknown());
const Settings = z.object({ multiplayer: z.boolean().optional(), maxPlayers: z.number().int().min(2).max(64).optional() }).partial();

const CreateBody = z.object({
  title: z.string().max(80).optional(),
  prompt: z.string().max(2000).optional(),
  target: z.enum(TARGETS),
  engine: z.enum(ENGINES).optional(),
  template: z.enum(TEMPLATES).optional(),
  config: Config.optional(),
});

const PatchBody = z.object({
  title: z.string().min(1).max(80).optional(),
  target: z.enum(TARGETS).optional(),
  engine: z.enum(ENGINES).optional(),
  config: Config.optional(),
  plan: GamePlan.optional(),
  settings: Settings.optional(),
});

const MessageBody = z.object({ message: z.string().min(1).max(1500) });

const idOf = (req: ApexRequest) => Number(req.params.id);

async function load(req: ApexRequest): Promise<GameProject | undefined> {
  const id = idOf(req);
  if (!Number.isInteger(id)) return undefined;
  const [row] = await db.select().from(gameProjectsTable)
    .where(and(eq(gameProjectsTable.id, id), eq(gameProjectsTable.userId, req.userId!))).limit(1);
  return row;
}

async function save(id: number, values: Partial<typeof gameProjectsTable.$inferInsert>) {
  const [row] = await db.update(gameProjectsTable).set({ ...values, updatedAt: new Date() })
    .where(eq(gameProjectsTable.id, id)).returning();
  return row!;
}

// Words skipped when naming a game from its description ("a rooftop shooter at night" → "Rooftop Shooter Night")
const FILLER = new Set("a an the for with at of in on and or to my me i you your want make build create game games like that where which is are through into".split(" "));

function titleFrom(target: Target, prompt?: string, config?: Record<string, unknown>) {
  // Quick games keep the generated game's name; planned games are named after the idea
  const fromConfig = typeof config?.name === "string" && config.name.trim() ? config.name.trim().slice(0, 80) : "";
  if (fromConfig && (target === "apex" || !prompt?.trim())) return fromConfig;
  const words = (prompt ?? "").replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/)
    .filter((w) => w && !FILLER.has(w.toLowerCase())).slice(0, 3);
  return words.length ? words.map((w) => w[0]!.toUpperCase() + w.slice(1)).join(" ") : fromConfig || "Untitled game";
}

function summary(p: GameProject) {
  const checklist = (p.plan as GamePlan | null)?.checklist ?? [];
  return {
    id: p.id, title: p.title, target: p.target, engine: p.engine, template: p.template,
    gameMode: (p.config as { gameMode?: string } | null)?.gameMode ?? null,
    progress: { done: checklist.filter((c) => c.done).length, total: checklist.length },
    updatedAt: p.updatedAt,
  };
}

router.get("/engine/projects", async (req: ApexRequest, res): Promise<void> => {
  const rows = await db.select().from(gameProjectsTable)
    .where(eq(gameProjectsTable.userId, req.userId!)).orderBy(desc(gameProjectsTable.updatedAt)).limit(100);
  success(res, { projects: rows.map(summary) });
});

router.post("/engine/projects", async (req: ApexRequest, res): Promise<void> => {
  const parsed = CreateBody.safeParse(req.body);
  if (!parsed.success) { badRequest(res, "Pick what you're making and describe it."); return; }
  const { prompt = "", target, config } = parsed.data;
  const engine = engineFor(target, parsed.data.engine);
  const template = parsed.data.template ?? detectTemplate(prompt);
  try {
    const { plan, ai } = await aiPlan(prompt, template, target, engine);
    const [row] = await db.insert(gameProjectsTable).values({
      userId: req.userId!,
      title: parsed.data.title?.trim() || titleFrom(target, prompt, config),
      target, engine, template, prompt,
      config: config ?? null,
      plan,
      settings: { multiplayer: false, maxPlayers: 8 },
    }).returning();
    success(res, { project: row, aiPlan: ai }, 201);
  } catch (err) {
    logger.error({ err }, "Engine: create failed");
    serverError(res, "Couldn't create the game. Try again.");
  }
});

router.get("/engine/projects/:id", async (req: ApexRequest, res): Promise<void> => {
  const row = await load(req);
  if (!row) { notFound(res, "Game not found"); return; }
  success(res, { project: row, aiConnected: isOpenAIConfigured() });
});

router.patch("/engine/projects/:id", async (req: ApexRequest, res): Promise<void> => {
  const row = await load(req);
  if (!row) { notFound(res, "Game not found"); return; }
  const parsed = PatchBody.safeParse(req.body);
  if (!parsed.success) { badRequest(res, "Some of those changes weren't valid."); return; }
  const next: Partial<typeof gameProjectsTable.$inferInsert> = {};
  const d = parsed.data;
  if (d.title) next.title = d.title;
  if (d.config) next.config = d.config;
  if (d.settings) next.settings = { ...(row.settings as object | null ?? {}), ...d.settings };
  let plan = (d.plan ?? row.plan) as GamePlan | null;
  if (d.target) {
    // Switching where the game runs updates the engine, platforms and the "get it running" steps
    const target = d.target;
    const engine = engineFor(target, d.engine ?? (row.engine as Engine));
    next.target = target;
    next.engine = engine;
    if (plan) {
      const doneIds = new Set(plan.checklist.filter((c) => c.done).map((c) => c.id));
      plan = { ...plan, platforms: platformsFor(target), checklist: checklistFor(target, engine).map((c) => ({ ...c, done: doneIds.has(c.id) })) };
    }
  } else if (d.engine && row.target === "pc") {
    const engine = engineFor("pc", d.engine);
    next.engine = engine;
    if (plan) {
      const doneIds = new Set(plan.checklist.filter((c) => c.done).map((c) => c.id));
      plan = { ...plan, checklist: checklistFor("pc", engine).map((c) => ({ ...c, done: doneIds.has(c.id) })) };
    }
  }
  if (plan) next.plan = plan;
  success(res, { project: await save(row.id, next) });
});

router.delete("/engine/projects/:id", async (req: ApexRequest, res): Promise<void> => {
  const row = await load(req);
  if (!row) { notFound(res, "Game not found"); return; }
  await db.delete(gameProjectsTable).where(eq(gameProjectsTable.id, row.id));
  success(res, { deleted: true });
});

router.post("/engine/projects/:id/plan", async (req: ApexRequest, res): Promise<void> => {
  const row = await load(req);
  if (!row) { notFound(res, "Game not found"); return; }
  const parsed = MessageBody.safeParse(req.body);
  if (!parsed.success) { badRequest(res, "Tell the AI what to change."); return; }
  if (!isOpenAIConfigured()) { res.status(503).json({ ok: false, error: NO_AI }); return; }
  try {
    const { plan, reply } = await aiEditPlan(row.plan as GamePlan, parsed.data.message);
    success(res, { project: await save(row.id, { plan }), reply });
  } catch (err) {
    logger.warn({ err }, "Engine: plan edit failed");
    serverError(res, err instanceof Error ? err.message : "The AI couldn't change the plan. Try again.");
  }
});

router.post("/engine/projects/:id/edit", async (req: ApexRequest, res): Promise<void> => {
  const row = await load(req);
  if (!row) { notFound(res, "Game not found"); return; }
  const parsed = MessageBody.safeParse(req.body);
  if (!parsed.success) { badRequest(res, "Tell the AI what to change."); return; }
  if (!row.config) { badRequest(res, "This game has nothing to edit yet."); return; }
  if (!isOpenAIConfigured()) { res.status(503).json({ ok: false, error: NO_AI }); return; }
  try {
    const { config, reply } = await aiEditConfig(row.config, parsed.data.message);
    success(res, { project: await save(row.id, { config }), reply });
  } catch (err) {
    logger.warn({ err }, "Engine: game edit failed");
    serverError(res, err instanceof Error ? err.message : "The AI couldn't change the game. Try again.");
  }
});

/** A valid C#/C++ identifier from the game's title, e.g. "Neon Warzone" → "NeonWarzone". */
function codeName(title: string) {
  const n = title.replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1)).join("").slice(0, 28);
  return /^[A-Za-z]/.test(n) ? n : `Apex${n || "Game"}`;
}

function sendZip(res: Response, filename: string, files: { path: string; content: string }[]) {
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("error", (err) => { logger.error({ err }, "Engine: zip failed"); res.destroy(err); });
  archive.pipe(res);
  for (const f of files) archive.append(f.content, { name: f.path });
  void archive.finalize();
}

router.post("/engine/projects/:id/export", async (req: ApexRequest, res): Promise<void> => {
  const row = await load(req);
  if (!row) { notFound(res, "Game not found"); return; }
  const plan = GamePlan.safeParse(row.plan);
  if (!plan.success) { badRequest(res, "This game doesn't have a plan yet."); return; }
  const name = codeName(row.title);
  if (row.engine === "unity") {
    sendZip(res, `${name}-Unity.zip`, unityProject(name, row.title, plan.data, row.target as Target));
  } else if (row.engine === "unreal") {
    sendZip(res, `${name}-Unreal.zip`, unrealProject(name, row.title, plan.data));
  } else {
    badRequest(res, "Quick games play in Apex. Switch it to a mobile or computer game to download a project.");
  }
});

export default router;
