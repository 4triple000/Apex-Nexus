/**
 * Connectors and credits.
 *
 *   GET    /connectors                   — every connector, whether it's available and linked (signed in)
 *   POST   /connectors/:id/key           — link your own AI key (checked with the provider first)
 *   POST   /connectors/:id/authorize     — start linking an app; returns the URL to open
 *   GET    /connectors/oauth/callback    — the app sends people back here
 *   DELETE /connectors/:id               — unlink
 *   GET    /credits                      — today's credits (signed in)
 *   GET    /credits/admin?days=30        — what the AI keys are costing, by day / model / user (owner)
 */
import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireUser, requireOwner } from "../shared/middleware/requireAuth";
import type { ApexRequest } from "../shared/types";
import { isOwnerEmail } from "../shared/lib/owner";
import {
  CONNECTORS, connectorById, isAvailable, oauthEnvKeys, authorizeUrl, completeOAuth,
  saveConnector, removeConnector, listLinked, checkKey, maskKey, oauthCallbackUrl,
} from "../lib/connectors";
import { creditUserFor, getBalance, spendingReport } from "../lib/credits";
import { signState, verifyState, isAllowedReturn, defaultReturnUrl } from "../lib/secureLinks";
import { logger } from "../lib/logger";

const router: IRouter = Router();

async function isOwner(userId: number): Promise<boolean> {
  const [u] = await db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  return isOwnerEmail(u?.email);
}

router.get("/connectors", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const userId = req.userId!;
  const [linked, owner] = await Promise.all([listLinked(userId), isOwner(userId)]);
  const byId = new Map(linked.map((l) => [l.connectorId, l]));
  res.json({
    ok: true,
    data: {
      connectors: CONNECTORS.map((c) => ({
        ...c,
        available: isAvailable(c.id),
        linked: byId.has(c.id),
        accountLabel: byId.get(c.id)?.accountLabel ?? null,
        linkedAt: byId.get(c.id)?.createdAt ?? null,
        // Only the owner sees setup details
        ...(owner && c.kind === "oauth" ? { setup: { envKeys: oauthEnvKeys(c.id), callbackUrl: oauthCallbackUrl() } } : {}),
      })),
    },
  });
});

const KeyBody = z.object({ key: z.string().trim().min(10).max(400) });

router.post("/connectors/:id/key", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const connector = connectorById(String(req.params.id));
  if (!connector || connector.kind !== "key") { res.status(404).json({ ok: false, error: "Unknown connector." }); return; }
  const parsed = KeyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ ok: false, error: "Paste the whole API key." }); return; }
  const check = await checkKey(connector.id, parsed.data.key);
  if (!check.ok) { res.status(400).json({ ok: false, error: check.error }); return; }
  await saveConnector(req.userId!, connector.id, "key", parsed.data.key, { label: maskKey(parsed.data.key) });
  res.json({ ok: true, data: { linked: true, accountLabel: maskKey(parsed.data.key) } });
});

const AuthorizeBody = z.object({ returnTo: z.string().url().optional() });

router.post("/connectors/:id/authorize", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const connector = connectorById(String(req.params.id));
  if (!connector || connector.kind !== "oauth") { res.status(404).json({ ok: false, error: "Unknown connector." }); return; }
  if (!isAvailable(connector.id)) { res.status(503).json({ ok: false, error: `${connector.name} isn't available yet. The app owner needs to finish setting it up.` }); return; }
  const parsed = AuthorizeBody.safeParse(req.body ?? {});
  const returnTo = parsed.success && parsed.data.returnTo && isAllowedReturn(parsed.data.returnTo) ? parsed.data.returnTo : `${defaultReturnUrl()}/connectors`;
  const state = signState({ u: req.userId!, c: connector.id, r: returnTo });
  res.json({ ok: true, data: { url: authorizeUrl(connector.id, state) } });
});

function backTo(returnTo: string, params: Record<string, string>): string {
  const url = new URL(returnTo);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

router.get("/connectors/oauth/callback", async (req, res): Promise<void> => {
  const { code, state, error } = req.query as Record<string, string | undefined>;
  const data = verifyState<{ u: number; c: string; r: string }>(state);
  if (!data || !isAllowedReturn(data.r)) {
    res.status(400).send("This link expired. Go back to Apex and try connecting again.");
    return;
  }
  if (error || !code) {
    res.redirect(backTo(data.r, { connect_error: error === "access_denied" ? "cancelled" : "failed", connector: data.c }));
    return;
  }
  try {
    await completeOAuth(data.c, data.u, code);
    res.redirect(backTo(data.r, { connected: data.c }));
  } catch (err) {
    logger.warn({ err, connector: data.c }, "Connector OAuth failed");
    res.redirect(backTo(data.r, { connect_error: "failed", connector: data.c }));
  }
});

router.delete("/connectors/:id", requireUser, async (req: ApexRequest, res): Promise<void> => {
  if (!connectorById(String(req.params.id))) { res.status(404).json({ ok: false, error: "Unknown connector." }); return; }
  await removeConnector(req.userId!, String(req.params.id));
  res.json({ ok: true, data: { linked: false } });
});

// ── Credits ───────────────────────────────────────────────────────────────────

router.get("/credits", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const who = await creditUserFor(req.userId!);
  if (!who) { res.status(401).json({ ok: false, error: "Please sign in." }); return; }
  const [balance, linked] = await Promise.all([getBalance(who), listLinked(who.userId)]);
  const ownKeys = linked.map((l) => connectorById(l.connectorId)?.provider).filter(Boolean);
  res.json({ ok: true, data: { ...balance, isOwner: who.isOwner, ownKeys } });
});

router.get("/credits/admin", requireOwner, async (req, res): Promise<void> => {
  const days = Math.min(90, Math.max(1, parseInt(String(req.query.days ?? "30"), 10) || 30));
  res.json({ ok: true, data: await spendingReport(days) });
});

export default router;
