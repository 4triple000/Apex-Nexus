/**
 * Mobile App Router
 * Mounts at /api/mobile/*
 *
 * Auth: register/login return a `sessionId`. Every other endpoint requires it
 * (x-apex-auth or x-session-id header) and acts only on that user's data.
 *
 * Endpoints:
 *   POST /mobile/auth/register  — Email/password signup
 *   POST /mobile/auth/login     — Email/password login
 *   POST /mobile/chat           — AI chat with memory context
 *   GET  /mobile/conversations  — List user's conversations
 *   GET  /mobile/conversations/:id/messages — Get conversation messages
 *   GET  /mobile/memory/:userId — Get user's AI memory (must be the signed-in user)
 *   POST /mobile/extract-memory — AI-powered memory extraction from a message
 */

import { randomBytes } from "node:crypto";
import { Router, type IRouter, type Response } from "express";
import { z } from "zod";
import { and, eq, desc } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import {
  mobileConversationsTable,
  mobileMessagesTable,
  mobileMemoryTable,
} from "@workspace/db";
import { hashPassword, verifyPassword } from "./crypto";
import { openai } from "@workspace/integrations-openai-ai-server";
import { extractMemoryFromMessage, buildMemorySystemPrompt } from "../memory/extractor";
import { success, badRequest, notFound, serverError, unauthorized, forbidden } from "../../shared/utils/response";
import { requireUser } from "../../shared/middleware/requireAuth";
import type { ApexRequest } from "../../shared/types";
import { logger } from "../../lib/logger";

const router: IRouter = Router();

// ── Auth helpers ───────────────────────────────────────────────────────────────
function generateSessionId(): string {
  return `mobile_${randomBytes(32).toString("hex")}`;
}

// requireUser guarantees req.userId is set
function currentUserId(req: ApexRequest): number {
  return req.userId!;
}

async function ownsConversation(userId: number, conversationId: number): Promise<boolean> {
  const [conv] = await db.select({ id: mobileConversationsTable.id })
    .from(mobileConversationsTable)
    .where(and(eq(mobileConversationsTable.id, conversationId), eq(mobileConversationsTable.userId, userId)))
    .limit(1);
  return !!conv;
}

function rejectOtherUser(res: Response): void {
  forbidden(res, "You can only access your own data");
}

function randomUsername(): string {
  const adj = ["swift", "bright", "bold", "keen", "sharp", "neon", "dark", "cyber"];
  const noun = ["apex", "signal", "nexus", "nova", "grid", "flux", "code", "mind"];
  return `${adj[Math.floor(Math.random() * adj.length)]}_${noun[Math.floor(Math.random() * noun.length)]}_${Math.floor(Math.random() * 9999)}`;
}

// ── POST /mobile/auth/register ─────────────────────────────────────────────────
router.post("/mobile/auth/register", async (req, res): Promise<void> => {
  const schema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    username: z.string().min(2).max(32).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { badRequest(res, parsed.error.errors[0]?.message ?? "Invalid body"); return; }

  try {
    // Check if email already taken
    const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, parsed.data.email)).limit(1);
    if (existing) { badRequest(res, "Email already registered. Please log in."); return; }

    const passwordHash = await hashPassword(parsed.data.password);
    const sessionId = generateSessionId();
    const username = parsed.data.username ?? randomUsername();

    const [user] = await db.insert(usersTable).values({
      email: parsed.data.email,
      passwordHash,
      sessionId,
      username,
      avatarEmoji: "🤖",
    }).returning({ id: usersTable.id, email: usersTable.email, username: usersTable.username, avatarEmoji: usersTable.avatarEmoji, createdAt: usersTable.createdAt });

    success(res, {
      userId: user!.id,
      sessionId,
      email: user!.email,
      username: user!.username,
      avatarEmoji: user!.avatarEmoji,
      message: "Account created successfully",
    }, 201);
  } catch (err) {
    logger.error({ err }, "Mobile register error");
    serverError(res, "Registration failed");
  }
});

// ── POST /mobile/auth/login ────────────────────────────────────────────────────
router.post("/mobile/auth/login", async (req, res): Promise<void> => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { badRequest(res, parsed.error.errors[0]?.message ?? "Invalid body"); return; }

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, parsed.data.email)).limit(1);
    if (!user || !user.passwordHash) { unauthorized(res, "Invalid email or password"); return; }

    const valid = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!valid) { unauthorized(res, "Invalid email or password"); return; }

    // Older accounts may predate session IDs — issue one on login
    let sessionId = user.sessionId;
    if (!sessionId) {
      sessionId = generateSessionId();
      await db.update(usersTable).set({ sessionId }).where(eq(usersTable.id, user.id));
    }

    success(res, {
      userId: user.id,
      sessionId,
      email: user.email,
      username: user.username,
      avatarEmoji: user.avatarEmoji,
      bio: user.bio,
      createdAt: user.createdAt,
    });
  } catch (err) {
    logger.error({ err }, "Mobile login error");
    serverError(res, "Login failed");
  }
});

// Regex extraction removed — replaced by AI-powered extraction via extractMemoryFromMessage

// ── POST /mobile/chat ──────────────────────────────────────────────────────────
router.post("/mobile/chat", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const schema = z.object({
    message: z.string().min(1).max(4000),
    conversationId: z.number().int().positive().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { badRequest(res, parsed.error.errors[0]?.message ?? "Invalid body"); return; }

  const userId = currentUserId(req);
  const { message, conversationId: existingConvId } = parsed.data;
  if (existingConvId && !(await ownsConversation(userId, existingConvId))) {
    notFound(res, "Conversation not found");
    return;
  }

  try {
    // 1. Get or create conversation
    let conversationId = existingConvId;
    if (!conversationId) {
      const title = message.slice(0, 40) + (message.length > 40 ? "…" : "");
      const [conv] = await db.insert(mobileConversationsTable).values({ userId, title }).returning({ id: mobileConversationsTable.id });
      conversationId = conv!.id;
    }

    // 2. Fetch last 10 messages
    const recentMessages = await db.select()
      .from(mobileMessagesTable)
      .where(eq(mobileMessagesTable.conversationId, conversationId))
      .orderBy(desc(mobileMessagesTable.createdAt))
      .limit(10);

    const historyMessages = recentMessages.reverse().map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // 3. Build structured memory system prompt (AI-extracted, grouped by category)
    const memorySection = await buildMemorySystemPrompt(userId);

    // 4. Compose system prompt
    const systemPrompt =
      `You are Apex, a personalized AI assistant. You are intelligent, warm, and deeply attuned to the user's context. ` +
      `Be direct, helpful, and conversational. Keep responses focused and clear.` +
      memorySection;

    // 5. Call OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 2048,
      messages: [
        { role: "system", content: systemPrompt },
        ...historyMessages,
        { role: "user", content: message },
      ],
    });

    const aiContent = response.choices[0]?.message?.content ?? "I'm having trouble responding right now. Please try again.";

    // 6. Store both messages
    await db.insert(mobileMessagesTable).values([
      { conversationId, role: "user", content: message },
      { conversationId, role: "assistant", content: aiContent },
    ]);

    // 7. AI memory extraction (async, fire and forget — never blocks response)
    extractMemoryFromMessage(userId, message).catch((err) =>
      logger.warn({ err }, "Background memory extraction failed"),
    );

    success(res, {
      content: aiContent,
      conversationId,
      tokensUsed: response.usage?.total_tokens,
    });
  } catch (err) {
    logger.error({ err }, "Mobile chat error");
    serverError(res, "AI service unavailable");
  }
});

// ── GET /mobile/conversations ──────────────────────────────────────────────────
router.get("/mobile/conversations", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const userId = currentUserId(req);

  const conversations = await db.select()
    .from(mobileConversationsTable)
    .where(eq(mobileConversationsTable.userId, userId))
    .orderBy(desc(mobileConversationsTable.createdAt))
    .limit(50);

  success(res, { conversations });
});

// ── GET /mobile/conversations/:id/messages ─────────────────────────────────────
router.get("/mobile/conversations/:id/messages", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const conversationId = parseInt(String(req.params.id));
  if (isNaN(conversationId)) { badRequest(res, "Invalid conversation ID"); return; }
  if (!(await ownsConversation(currentUserId(req), conversationId))) {
    notFound(res, "Conversation not found");
    return;
  }

  const messages = await db.select()
    .from(mobileMessagesTable)
    .where(eq(mobileMessagesTable.conversationId, conversationId))
    .orderBy(mobileMessagesTable.createdAt)
    .limit(100);

  success(res, { messages });
});

// ── GET /mobile/memory/:userId ─────────────────────────────────────────────────
router.get("/mobile/memory/:userId", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const userId = parseInt(String(req.params.userId));
  if (isNaN(userId)) { badRequest(res, "Invalid user ID"); return; }
  if (userId !== currentUserId(req)) { rejectOtherUser(res); return; }

  const memory = await db.select()
    .from(mobileMemoryTable)
    .where(eq(mobileMemoryTable.userId, userId))
    .orderBy(desc(mobileMemoryTable.updatedAt));

  success(res, { memory, count: memory.length });
});

// ── POST /mobile/extract-memory ────────────────────────────────────────────────
// Standalone endpoint to run AI memory extraction on a single message.
// Useful for batch processing, testing, or manual memory management.
router.post("/mobile/extract-memory", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const schema = z.object({
    user_id: z.number().int().positive("user_id must be a positive integer"),
    message: z.string().min(1, "message is required").max(4000),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, parsed.error.errors[0]?.message ?? "Invalid body");
    return;
  }

  if (parsed.data.user_id !== currentUserId(req)) { rejectOtherUser(res); return; }

  try {
    const result = await extractMemoryFromMessage(parsed.data.user_id, parsed.data.message);
    success(res, {
      extracted: result.extracted,
      stored: result.stored,
      skipped: result.skipped,
      message:
        result.stored > 0
          ? `Extracted ${result.stored} new memory item(s)`
          : "No new memories found in this message",
    });
  } catch (err) {
    logger.error({ err }, "Mobile extract-memory error");
    serverError(res, "Memory extraction failed");
  }
});

export default router;
