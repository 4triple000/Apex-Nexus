/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  UNIFIED USERS API                                                       ║
 * ║  /api/users/me  — profile, usage quota, projects, deployments           ║
 * ║  requireAuth applied per-route (not globally) to avoid middleware order ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */
import { Router, type IRouter } from "express";
import { z }                    from "zod";
import { db, usersTable, devosProjectsTable, apexDeploymentsTable } from "@workspace/db";
import { eq, desc }             from "drizzle-orm";
import { requireAuth }          from "../shared/middleware/requireAuth";
import { getUsageStats }        from "../shared/middleware/dailyRateLimit";
import {
  success, badRequest, notFound, serverError,
} from "../shared/utils/response";
import type { ApexRequest }     from "../shared/types";
import { logger }               from "../lib/logger";

const router: IRouter = Router();
const auth            = requireAuth as any;

// ── GET /users/me — full profile + quota ─────────────────────────────────────

router.get("/users/me", auth, async (req: ApexRequest, res): Promise<void> => {
  const sessionId = req.sessionId!;

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.sessionId, sessionId))
      .limit(1);

    const usage = await getUsageStats(
      sessionId,
      req.subscriptionTier ?? user?.subscriptionTier ?? "free",
    );

    const safeUser = user
      ? sanitize(user)
      : { sessionId, username: "Guest", subscriptionTier: "free" };

    success(res, {
      user:  safeUser,
      usage,
      plan: {
        tier:        usage.tier,
        isUnlimited: usage.isUnlimited,
        aiLimit:     usage.requestsLimit,
        aiUsed:      usage.requestsUsed,
        resetAt:     usage.resetAt,
      },
    });
  } catch (err) {
    logger.error({ err }, "[users] GET /me error");
    serverError(res);
  }
});

// ── PUT /users/me — update profile ───────────────────────────────────────────

router.put("/users/me", auth, async (req: ApexRequest, res): Promise<void> => {
  const sessionId = req.sessionId!;
  const schema = z.object({
    username:    z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers, underscores only").optional(),
    bio:         z.string().max(500).optional(),
    avatarEmoji: z.string().max(8).optional(),
    avatarUrl:   z.string().url().max(1000).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, parsed.error.errors[0]?.message ?? "Validation failed");
    return;
  }

  try {
    const updates: Partial<typeof usersTable.$inferInsert> = {};
    if (parsed.data.username    !== undefined) updates.username    = parsed.data.username;
    if (parsed.data.bio         !== undefined) updates.bio         = parsed.data.bio;
    if (parsed.data.avatarEmoji !== undefined) updates.avatarEmoji = parsed.data.avatarEmoji;
    if (parsed.data.avatarUrl   !== undefined) updates.avatarUrl   = parsed.data.avatarUrl;

    if (Object.keys(updates).length === 0) {
      badRequest(res, "No fields provided to update");
      return;
    }

    if (updates.username) {
      const [taken] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.username, updates.username))
        .limit(1);
      if (taken) { badRequest(res, "Username is already taken"); return; }
    }

    const [updated] = await db
      .update(usersTable)
      .set(updates)
      .where(eq(usersTable.sessionId, sessionId))
      .returning();

    if (!updated) { notFound(res, "User not found"); return; }

    success(res, { user: sanitize(updated), message: "Profile updated" });
  } catch (err) {
    logger.error({ err }, "[users] PUT /me error");
    serverError(res);
  }
});

// ── GET /users/me/usage — detailed quota breakdown ────────────────────────────

router.get("/users/me/usage", auth, async (req: ApexRequest, res): Promise<void> => {
  const sessionId = req.sessionId!;
  const tier      = req.subscriptionTier ?? "free";

  try {
    const usage = await getUsageStats(sessionId, tier);
    success(res, {
      usage,
      limits:  { aiRequestsPerDay: usage.requestsLimit, isUnlimited: usage.isUnlimited },
      status:  usage.isAtLimit ? "exceeded" : usage.isNearLimit ? "near_limit" : "ok",
    });
  } catch (err) {
    logger.error({ err }, "[users] GET /me/usage error");
    serverError(res);
  }
});

// ── GET /users/me/projects — all projects for this user ───────────────────────

router.get("/users/me/projects", auth, async (req: ApexRequest, res): Promise<void> => {
  const sessionId = req.sessionId!;
  const limit     = Math.min(parseInt((req.query["limit"] as string) ?? "50"), 100);
  const offset    = parseInt((req.query["offset"] as string) ?? "0");

  try {
    const projects = await db
      .select()
      .from(devosProjectsTable)
      .where(eq(devosProjectsTable.sessionId, sessionId))
      .orderBy(desc(devosProjectsTable.updatedAt))
      .limit(limit)
      .offset(offset);

    const deployments = projects.length > 0
      ? await db
          .select({
            projectId: apexDeploymentsTable.projectId,
            id:        apexDeploymentsTable.id,
            slug:      apexDeploymentsTable.slug,
            status:    apexDeploymentsTable.status,
            url:       apexDeploymentsTable.url,
            version:   apexDeploymentsTable.version,
          })
          .from(apexDeploymentsTable)
          .where(eq(apexDeploymentsTable.sessionId, sessionId))
          .orderBy(desc(apexDeploymentsTable.version))
      : [];

    const deployMap = new Map<number, typeof deployments[0]>();
    for (const dep of deployments) {
      if (!deployMap.has(dep.projectId)) deployMap.set(dep.projectId, dep);
    }

    const enriched = projects.map(p => ({
      ...p,
      deployment: deployMap.get(p.id) ?? null,
    }));

    success(res, { projects: enriched, total: enriched.length, offset, limit });
  } catch (err) {
    logger.error({ err }, "[users] GET /me/projects error");
    serverError(res);
  }
});

// ── GET /users/me/deployments — all live deployed apps ────────────────────────

router.get("/users/me/deployments", auth, async (req: ApexRequest, res): Promise<void> => {
  const sessionId = req.sessionId!;
  const limit     = Math.min(parseInt((req.query["limit"] as string) ?? "20"), 100);

  try {
    const deployments = await db
      .select({
        id:        apexDeploymentsTable.id,
        projectId: apexDeploymentsTable.projectId,
        slug:      apexDeploymentsTable.slug,
        name:      apexDeploymentsTable.name,
        status:    apexDeploymentsTable.status,
        url:       apexDeploymentsTable.url,
        version:   apexDeploymentsTable.version,
        language:  apexDeploymentsTable.language,
        createdAt: apexDeploymentsTable.createdAt,
        updatedAt: apexDeploymentsTable.updatedAt,
      })
      .from(apexDeploymentsTable)
      .where(eq(apexDeploymentsTable.sessionId, sessionId))
      .orderBy(desc(apexDeploymentsTable.updatedAt))
      .limit(limit);

    const liveCount     = deployments.filter(d => d.status === "live").length;
    const buildingCount = deployments.filter(d => d.status === "building").length;

    success(res, {
      deployments,
      stats: { total: deployments.length, live: liveCount, building: buildingCount },
    });
  } catch (err) {
    logger.error({ err }, "[users] GET /me/deployments error");
    serverError(res);
  }
});

// ── GET /users/:id — public profile (no auth needed) ─────────────────────────

router.get("/users/:id", async (req, res): Promise<void> => {
  const userId = parseInt(req.params["id"] ?? "");
  if (isNaN(userId)) { badRequest(res, "Invalid user ID"); return; }

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user) { notFound(res, "User not found"); return; }
    success(res, { user: publicProfile(user) });
  } catch (err) {
    serverError(res);
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function sanitize(user: typeof usersTable.$inferSelect) {
  const {
    passwordHash: _pw, sessionId: _sid,
    stripeCustomerId: _sc, stripeSubscriptionId: _ss, googleId: _gi,
    ...safe
  } = user;
  return safe;
}

function publicProfile(user: typeof usersTable.$inferSelect) {
  return {
    id:          user.id,
    username:    user.username,
    avatarEmoji: user.avatarEmoji,
    avatarUrl:   user.avatarUrl,
    bio:         user.bio,
    createdAt:   user.createdAt,
  };
}

export default router;
