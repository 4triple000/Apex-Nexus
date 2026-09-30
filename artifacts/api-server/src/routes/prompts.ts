/**
 * Prompt history and saved prompts for the signed-in user.
 * The apps keep a local copy and sync it here so it follows the user between devices.
 */
import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, promptLibraryTable } from "@workspace/db";
import { requireUser } from "../shared/middleware/requireAuth";
import type { ApexRequest } from "../shared/types";

const router: IRouter = Router();

const Entry = z.object({
  text: z.string().min(1).max(2000),
  kind: z.enum(["chat", "build"]),
  at: z.number().int().nonnegative(),
});
const Body = z.object({
  history: z.array(Entry).max(200),
  saved: z.array(Entry).max(200),
});

router.get("/prompts", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const [row] = await db.select().from(promptLibraryTable).where(eq(promptLibraryTable.userId, req.userId!)).limit(1);
  res.json({ ok: true, data: { history: row?.history ?? [], saved: row?.saved ?? [] } });
});

router.put("/prompts", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: parsed.error.errors[0]?.message ?? "Invalid prompt list" });
    return;
  }
  const { history, saved } = parsed.data;
  await db.insert(promptLibraryTable)
    .values({ userId: req.userId!, history, saved, updatedAt: new Date() })
    .onConflictDoUpdate({ target: promptLibraryTable.userId, set: { history, saved, updatedAt: new Date() } });
  res.json({ ok: true, data: { saved: true } });
});

export default router;
