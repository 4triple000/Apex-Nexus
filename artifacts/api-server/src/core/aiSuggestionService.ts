/**
 * AI Suggestion Service — Platform Agnostic
 *
 * Fetches the last 10 messages from any conversation, generates 3 reply
 * suggestions via OpenAI, and stores them in the ai_suggestions table.
 * This service has zero knowledge of which platform the messages came from.
 */

import { db, dmMessagesTable, aiSuggestionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../lib/logger.js";
import { cacheSet, cacheDel, CacheKeys } from "./cache.js";
import type { AiSuggestionJob } from "./jobQueue.js";

export interface ReplySuggestion {
  text: string;
  style: "direct" | "playful" | "warm";
  score?: number;
}

export async function generateAiSuggestions(job: AiSuggestionJob): Promise<ReplySuggestion[]> {
  const { conversationId, platform, triggerMessageId } = job;

  // Fetch last 10 messages from the conversation
  const recentMessages = await db
    .select()
    .from(dmMessagesTable)
    .where(eq(dmMessagesTable.conversationId, conversationId))
    .orderBy(desc(dmMessagesTable.sentAt))
    .limit(10);

  if (!recentMessages.length) {
    logger.warn({ conversationId }, "[ai-sug] No messages to analyze");
    return [];
  }

  const messages = recentMessages.reverse();
  const transcript = messages
    .map((m) => `${m.direction === "outbound" ? "You" : "Them"}: ${m.content}`)
    .join("\n");

  const lastInbound = [...messages].reverse().find((m) => m.direction === "inbound");

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a messaging assistant. Generate exactly 3 reply suggestions in different styles.

Output valid JSON only:
{
  "suggestions": [
    {"text": "...", "style": "direct"},
    {"text": "...", "style": "playful"},
    {"text": "...", "style": "warm"}
  ]
}

Each reply: max 2 sentences, natural and conversational. No explanations. ONLY JSON.`,
        },
        {
          role: "user",
          content: `Conversation:\n${transcript}\n\n${lastInbound ? `Their latest: "${lastInbound.content}"\n\n` : ""}Generate 3 reply suggestions:`,
        },
      ],
      max_tokens: 300,
      temperature: 0.85,
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as { suggestions?: ReplySuggestion[] };
    const suggestions: ReplySuggestion[] = parsed.suggestions ?? [];

    // Store in DB
    await db.insert(aiSuggestionsTable).values({
      conversationId,
      platform,
      suggestions,
      triggerMessageId,
      model: "gpt-4o-mini",
    });

    // Invalidate cache so next fetch picks up fresh suggestions
    await cacheDel(CacheKeys.suggestions(conversationId));
    await cacheSet(CacheKeys.suggestions(conversationId), suggestions, 120);

    logger.info({ conversationId, count: suggestions.length }, "[ai-sug] Suggestions generated");
    return suggestions;
  } catch (err) {
    logger.error({ err, conversationId }, "[ai-sug] Failed to generate suggestions");
    return [];
  }
}
