import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, workflowsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { fireEvent, executePipeline } from "../lib/workflowEngine";
import { randomBytes } from "crypto";

const router: IRouter = Router();

const PipelineStepBody = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.string(),
  prompt: z.string(),
  outputKey: z.string().optional(),
  config: z.record(z.string(), z.unknown()).default({}),
});

const CreateWorkflowBody = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  trigger: z.string().default("manual"),
  conditions: z.array(z.object({
    field: z.string(),
    operator: z.enum(["eq", "neq", "contains", "gt", "lt", "exists"]),
    value: z.string().optional(),
  })).default([]),
  actions: z.array(z.object({
    type: z.enum(["send_message", "call_ai_model", "update_user_data", "trigger_webhook"]),
    config: z.record(z.string(), z.unknown()).default({}),
  })).default([]),
  steps: z.array(PipelineStepBody).default([]),
  enabled: z.boolean().default(true),
  isTemplate: z.boolean().default(false),
  authorName: z.string().optional(),
});

const TriggerBody = z.object({
  trigger: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).default({}),
});

const RunPipelineBody = z.object({
  workflowId: z.number(),
  inputs: z.record(z.string(), z.string()).default({}),
});

router.get("/workflows", async (_req, res): Promise<void> => {
  const workflows = await db.select().from(workflowsTable).orderBy(workflowsTable.createdAt);
  res.json({ workflows });
});

router.get("/workflows/share/:code", async (req, res): Promise<void> => {
  const [wf] = await db
    .select()
    .from(workflowsTable)
    .where(eq(workflowsTable.shareCode, req.params.code));
  if (!wf) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ workflow: wf });
});

router.post("/workflows", async (req, res): Promise<void> => {
  const parsed = CreateWorkflowBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data;
  const shareCode = data.isTemplate ? randomBytes(5).toString("hex") : undefined;

  const [created] = await db
    .insert(workflowsTable)
    .values({ ...data, shareCode })
    .returning();

  res.status(201).json({ workflow: created });
});

router.post("/workflows/:id/copy", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [source] = await db.select().from(workflowsTable).where(eq(workflowsTable.id, id));
  if (!source) { res.status(404).json({ error: "Not found" }); return; }

  const [copy] = await db
    .insert(workflowsTable)
    .values({
      name: `${source.name} (copy)`,
      description: source.description,
      category: source.category,
      trigger: source.trigger,
      conditions: source.conditions,
      actions: source.actions,
      steps: source.steps,
      isTemplate: false,
      enabled: true,
      authorName: req.body.authorName ?? null,
    })
    .returning();

  res.status(201).json({ workflow: copy });
});

router.post("/workflows/:id/share", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const shareCode = randomBytes(5).toString("hex");
  const [updated] = await db
    .update(workflowsTable)
    .set({ shareCode, isTemplate: true, updatedAt: new Date() })
    .where(eq(workflowsTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ workflow: updated, shareCode });
});

router.put("/workflows/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = CreateWorkflowBody.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [updated] = await db
    .update(workflowsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(workflowsTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ workflow: updated });
});

router.patch("/workflows/:id/toggle", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [current] = await db.select().from(workflowsTable).where(eq(workflowsTable.id, id));
  if (!current) { res.status(404).json({ error: "Not found" }); return; }

  const [toggled] = await db
    .update(workflowsTable)
    .set({ enabled: !current.enabled, updatedAt: new Date() })
    .where(eq(workflowsTable.id, id))
    .returning();

  res.json({ workflow: toggled });
});

router.delete("/workflows/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  await db.delete(workflowsTable).where(eq(workflowsTable.id, id));
  res.status(204).send();
});

router.post("/workflows/trigger", async (req, res): Promise<void> => {
  const parsed = TriggerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const results = await fireEvent(parsed.data);
  res.json({ results, matchedWorkflows: results.length });
});

router.post("/workflows/run", async (req, res): Promise<void> => {
  const parsed = RunPipelineBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [wf] = await db
    .select()
    .from(workflowsTable)
    .where(eq(workflowsTable.id, parsed.data.workflowId));

  if (!wf) { res.status(404).json({ error: "Workflow not found" }); return; }

  const results = await executePipeline(wf, parsed.data.inputs);
  res.json(results);
});

export default router;
