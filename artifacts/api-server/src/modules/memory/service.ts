/**
 * Memory Service
 *
 * Persistent AI memory system that stores:
 * - Chat history (via ai_interactions table)
 * - Long-term preferences (via user_ai_prefs table)
 * - Structured facts and context (via ai_insights table with type=personalization)
 *
 * This wraps the learning engine with a clean memory-oriented API.
 */

import { db, aiInteractionsTable, userAiPrefsTable, aiInsightsTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { logger } from "../../lib/logger";
import type { UserMemory, MemoryEntry } from "../../shared/types";

// ── Get chat history ──────────────────────────────────────────────────────────
export async function getChatHistory(sessionId: string, limit = 50): Promise<{
  messages: { role: "user" | "assistant"; content: string; timestamp: string; provider?: string }[];
  total: number;
}> {
  const interactions = await db
    .select()
    .from(aiInteractionsTable)
    .where(eq(aiInteractionsTable.sessionId, sessionId))
    .orderBy(desc(aiInteractionsTable.createdAt))
    .limit(limit);

  const messages = interactions.map((i) => ({
    role: "assistant" as const,
    content: i.aiOutput,
    timestamp: i.createdAt.toISOString(),
    provider: i.provider ?? undefined,
    context: i.context ?? undefined,
  }));

  return { messages, total: messages.length };
}

// ── Get user memory/preferences ───────────────────────────────────────────────
export async function getUserMemory(sessionId: string): Promise<UserMemory> {
  const [prefs] = await db
    .select()
    .from(userAiPrefsTable)
    .where(eq(userAiPrefsTable.sessionId, sessionId))
    .limit(1);

  const insights = await db
    .select()
    .from(aiInsightsTable)
    .where(
      and(
        eq(aiInsightsTable.scope, "user"),
        eq(aiInsightsTable.sessionId, sessionId),
        eq(aiInsightsTable.insightType, "personalization")
      )
    )
    .limit(20);

  return {
    facts: insights.map((i) => i.title),
    preferences: (prefs?.toneSuccessRates ?? {}) as Record<string, unknown>,
    context: prefs ? `Preferred tone: ${prefs.preferredTone ?? "balanced"}` : "",
    avatarPersonality: "friendly",
    workflowHistory: [],
  };
}

// ── Store a memory entry ──────────────────────────────────────────────────────
export async function storeMemory(entry: Omit<MemoryEntry, "id" | "createdAt">): Promise<void> {
  await db.insert(aiInsightsTable).values({
    insightType: "personalization",
    scope: "user",
    sessionId: entry.sessionId,
    userId: entry.userId,
    title: `${entry.key}: ${typeof entry.value === "string" ? entry.value : JSON.stringify(entry.value)}`,
    description: `Memory type: ${entry.type}. Importance: ${entry.importance}/10`,
    confidence: entry.importance / 10,
    expiresAt: entry.expiresAt,
  });
}

// ── Recall relevant memories ──────────────────────────────────────────────────
export async function recallMemory(sessionId: string, query?: string): Promise<{
  memories: { title: string; description: string; confidence: number; createdAt: string }[];
  userPreferences: Record<string, unknown>;
  preferredTone: string;
}> {
  const memories = await db
    .select()
    .from(aiInsightsTable)
    .where(
      and(
        eq(aiInsightsTable.sessionId, sessionId),
        eq(aiInsightsTable.insightType, "personalization"),
        eq(aiInsightsTable.isDismissed, false)
      )
    )
    .orderBy(desc(aiInsightsTable.confidence))
    .limit(10);

  const [prefs] = await db
    .select()
    .from(userAiPrefsTable)
    .where(eq(userAiPrefsTable.sessionId, sessionId))
    .limit(1);

  return {
    memories: memories.map((m) => ({
      title: m.title,
      description: m.description,
      confidence: m.confidence,
      createdAt: m.createdAt.toISOString(),
    })),
    userPreferences: (prefs?.toneSuccessRates ?? {}) as Record<string, unknown>,
    preferredTone: prefs?.preferredTone ?? "balanced",
  };
}

// ── Clear session memory ──────────────────────────────────────────────────────
export async function clearMemory(sessionId: string): Promise<{ cleared: number }> {
  const result = await db
    .delete(aiInsightsTable)
    .where(
      and(
        eq(aiInsightsTable.sessionId, sessionId),
        eq(aiInsightsTable.insightType, "personalization")
      )
    );
  return { cleared: 0 }; // Drizzle doesn't return count for delete by default
}
