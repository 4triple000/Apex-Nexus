/**
 * Unified Messaging Routes
 *
 * POST /api/messages/send              — Send a message to any platform
 * GET  /api/connected-accounts         — List connected platform accounts
 * POST /api/connected-accounts         — Link a new platform account
 * DELETE /api/connected-accounts/:id   — Unlink an account
 * GET  /api/ai-suggestions/:id         — Get AI reply suggestions for a conversation
 * POST /api/ai-suggestions/:id/refresh — Force-regenerate suggestions
 */

import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, connectedAccountsTable, aiSuggestionsTable, dmConversationsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { sendPlatformMessage } from "../platforms/index.js";
import { generateAiSuggestions } from "../core/aiSuggestionService.js";
import { cacheGet, cacheSet, CacheKeys, TTL_SECONDS } from "../core/cache.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

// ─── Schema ───────────────────────────────────────────────────────────────────

const SendMessageSchema = z.object({
  platform: z.string().min(1),
  conversation_id: z.string().min(1),
  message_text: z.string().min(1).max(2000),
  user_id: z.string().optional().default("default"),
});

const ConnectAccountSchema = z.object({
  platform: z.string().min(1),
  platform_user_id: z.string().min(1),
  platform_username: z.string().optional(),
  access_token: z.string().min(1),
  refresh_token: z.string().optional(),
  page_id: z.string().optional(),
  user_id: z.string().optional().default("default"),
});

// ─── POST /api/messages/send ──────────────────────────────────────────────────

router.post("/messages/send", async (req, res): Promise<void> => {
  const parsed = SendMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { platform, conversation_id, message_text, user_id } = parsed.data;

  // Fetch the connected account for this user + platform
  const accounts = await db
    .select()
    .from(connectedAccountsTable)
    .where(
      and(
        eq(connectedAccountsTable.userId, user_id),
        eq(connectedAccountsTable.platform, platform),
        eq(connectedAccountsTable.isActive, true)
      )
    )
    .limit(1);

  if (!accounts.length) {
    res.status(400).json({
      error: `No active ${platform} account connected. Please link your account first.`,
    });
    return;
  }

  const account = accounts[0];

  // Extract recipient from conversation_id (format: {platform}_{pageId}_{userId})
  const parts = conversation_id.split("_");
  const recipientId = parts[parts.length - 1];

  try {
    const externalMessageId = await sendPlatformMessage(platform, {
      recipientId,
      messageText: message_text,
      account,
    });

    logger.info({ platform, recipientId, externalMessageId }, "[messaging] Message sent");
    res.status(200).json({ success: true, external_message_id: externalMessageId });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error({ err, platform }, "[messaging] Send failed");
    res.status(502).json({ error: errorMsg });
  }
});

// ─── GET /api/connected-accounts ─────────────────────────────────────────────

router.get("/connected-accounts", async (req, res): Promise<void> => {
  const userId = (req.query.user_id as string) ?? "default";

  const accounts = await db
    .select({
      id: connectedAccountsTable.id,
      platform: connectedAccountsTable.platform,
      platformUserId: connectedAccountsTable.platformUserId,
      platformUsername: connectedAccountsTable.platformUsername,
      platformIcon: connectedAccountsTable.platformIcon,
      isActive: connectedAccountsTable.isActive,
      metadata: connectedAccountsTable.metadata,
      createdAt: connectedAccountsTable.createdAt,
    })
    .from(connectedAccountsTable)
    .where(eq(connectedAccountsTable.userId, userId))
    .orderBy(desc(connectedAccountsTable.createdAt));

  res.json({ accounts });
});

// ─── POST /api/connected-accounts ────────────────────────────────────────────

router.post("/connected-accounts", async (req, res): Promise<void> => {
  const parsed = ConnectAccountSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { platform, platform_user_id, platform_username, access_token, refresh_token, page_id, user_id } = parsed.data;

  const PLATFORM_ICONS: Record<string, string> = {
    instagram: "instagram",
    messenger: "messenger",
    tiktok: "tiktok",
    twitter: "twitter",
  };

  const [account] = await db
    .insert(connectedAccountsTable)
    .values({
      userId: user_id,
      platform,
      platformUserId: platform_user_id,
      platformUsername: platform_username,
      platformIcon: PLATFORM_ICONS[platform] ?? platform,
      accessToken: access_token,
      refreshToken: refresh_token,
      metadata: page_id ? { page_id } : {},
      isActive: true,
    })
    .onConflictDoNothing()
    .returning();

  if (!account) {
    res.status(409).json({ error: "Account already connected" });
    return;
  }

  res.status(201).json({ account: { ...account, accessToken: undefined } });
});

// ─── DELETE /api/connected-accounts/:id ──────────────────────────────────────

router.delete("/connected-accounts/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  await db
    .update(connectedAccountsTable)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(connectedAccountsTable.id, id));

  res.json({ success: true });
});

// ─── GET /api/ai-suggestions/:conversationId ──────────────────────────────────

router.get("/ai-suggestions/:conversationId", async (req, res): Promise<void> => {
  const conversationId = Number(req.params.conversationId);
  if (isNaN(conversationId)) {
    res.status(400).json({ error: "Invalid conversationId" });
    return;
  }

  // Try cache first
  const cached = await cacheGet(CacheKeys.suggestions(conversationId));
  if (cached) {
    res.json({ suggestions: cached, source: "cache" });
    return;
  }

  // Fetch latest from DB
  const rows = await db
    .select()
    .from(aiSuggestionsTable)
    .where(eq(aiSuggestionsTable.conversationId, conversationId))
    .orderBy(desc(aiSuggestionsTable.generatedAt))
    .limit(1);

  if (!rows.length) {
    res.json({ suggestions: [], source: "none" });
    return;
  }

  const suggestions = rows[0].suggestions;
  await cacheSet(CacheKeys.suggestions(conversationId), suggestions, TTL_SECONDS.messages);

  res.json({ suggestions, source: "db", generatedAt: rows[0].generatedAt });
});

// ─── POST /api/ai-suggestions/:conversationId/refresh ────────────────────────

router.post("/ai-suggestions/:conversationId/refresh", async (req, res): Promise<void> => {
  const conversationId = Number(req.params.conversationId);
  if (isNaN(conversationId)) {
    res.status(400).json({ error: "Invalid conversationId" });
    return;
  }

  // Detect platform from conversation
  const convRows = await db
    .select({ platform: dmConversationsTable.platform })
    .from(dmConversationsTable)
    .where(eq(dmConversationsTable.id, conversationId))
    .limit(1);

  const platform = convRows[0]?.platform ?? "demo";

  const suggestions = await generateAiSuggestions({ conversationId, platform });
  res.json({ suggestions, source: "fresh" });
});

export default router;
