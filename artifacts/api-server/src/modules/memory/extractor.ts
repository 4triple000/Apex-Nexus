/**
 * AI Memory Extractor
 *
 * Uses OpenAI to extract long-term, meaningful user memory from chat messages
 * and persists it in a structured, deduplicated format.
 *
 * Extraction schema:
 *   { goals: [], interests: [], personal_info: [] }
 *
 * Storage: mobileMemoryTable (category: "goal" | "interest" | "fact")
 */

import { db, mobileMemoryTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../../lib/logger";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExtractedMemory {
  goals: string[];
  interests: string[];
  personal_info: string[];
}

export interface MemoryExtractionResult {
  extracted: ExtractedMemory;
  stored: number;
  skipped: number;
}

// ── Core extraction function ──────────────────────────────────────────────────

/**
 * Extracts structured memory from a user message using OpenAI,
 * then deduplicates and persists the results for a given userId.
 */
export async function extractMemoryFromMessage(
  userId: number,
  message: string,
): Promise<MemoryExtractionResult> {
  // Fetch existing memories to pass as dedup context to the AI
  const existing = await db
    .select({ category: mobileMemoryTable.category, value: mobileMemoryTable.value })
    .from(mobileMemoryTable)
    .where(eq(mobileMemoryTable.userId, userId))
    .orderBy(desc(mobileMemoryTable.updatedAt))
    .limit(50);

  const existingText =
    existing.length > 0
      ? existing.map((m) => `[${m.category}] ${m.value}`).join("\n")
      : "None";

  // Call OpenAI to extract structured memory
  const extracted = await callOpenAIExtraction(message, existingText);

  // Persist, deduplicating against exact-value matches
  const { stored, skipped } = await storeExtractedMemories(userId, extracted);

  logger.info({ userId, stored, skipped }, "Memory extraction complete");

  return { extracted, stored, skipped };
}

// ── OpenAI extraction ─────────────────────────────────────────────────────────

async function callOpenAIExtraction(
  message: string,
  existingMemories: string,
): Promise<ExtractedMemory> {
  const systemPrompt = `You are a precision memory extraction system for Apex, a personalized AI assistant.

TASK:
Analyze the user message and extract long-term, meaningful personal information.

RULES:
- Only extract durable, meaningful information that reveals who the user is
- Ignore temporary, conversational, or session-specific details
- DO NOT duplicate entries already listed in EXISTING MEMORIES below
- Focus on: life goals, personal dreams, career plans, hobbies, identity, relationships, skills
- Each value must be a clear, concise string (max 100 characters)
- If nothing meaningful can be extracted, return empty arrays

EXISTING MEMORIES (do NOT re-extract):
${existingMemories}

CATEGORIES:
- goals: Long-term objectives, aspirations, career ambitions, life plans, dreams
- interests: Hobbies, topics they love, passions, areas of curiosity, things they enjoy
- personal_info: Name, age, occupation, location, relationships, important personal facts

RETURN ONLY valid JSON (no explanation, no markdown):
{
  "goals": [],
  "interests": [],
  "personal_info": []
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 512,
      temperature: 0.1, // Low temperature for precise, consistent extraction
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Extract memory from this message:\n\n"${message}"`,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return emptyExtraction();

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    return {
      goals: toStringArray(parsed.goals),
      interests: toStringArray(parsed.interests),
      personal_info: toStringArray(parsed.personal_info),
    };
  } catch (err) {
    logger.warn({ err }, "Memory extraction AI call failed, returning empty");
    return emptyExtraction();
  }
}

// ── Storage with deduplication ────────────────────────────────────────────────

async function storeExtractedMemories(
  userId: number,
  extracted: ExtractedMemory,
): Promise<{ stored: number; skipped: number }> {
  type MemCategory = "goal" | "interest" | "fact";

  const entries: Array<{ category: MemCategory; value: string }> = [
    ...extracted.goals.map((v) => ({ category: "goal" as MemCategory, value: v.trim().slice(0, 200) })),
    ...extracted.interests.map((v) => ({ category: "interest" as MemCategory, value: v.trim().slice(0, 200) })),
    ...extracted.personal_info.map((v) => ({ category: "fact" as MemCategory, value: v.trim().slice(0, 200) })),
  ];

  let stored = 0;
  let skipped = 0;

  for (const entry of entries) {
    if (!entry.value) { skipped++; continue; }

    // Exact-value deduplication within the same category
    const [existing] = await db
      .select({ id: mobileMemoryTable.id })
      .from(mobileMemoryTable)
      .where(
        and(
          eq(mobileMemoryTable.userId, userId),
          eq(mobileMemoryTable.category, entry.category),
          eq(mobileMemoryTable.value, entry.value),
        ),
      )
      .limit(1);

    if (existing) {
      // Refresh the updatedAt timestamp to mark this memory as recently confirmed
      await db
        .update(mobileMemoryTable)
        .set({ updatedAt: new Date() })
        .where(eq(mobileMemoryTable.id, existing.id));
      skipped++;
    } else {
      // Generate a deterministic key from the value
      const key = `${entry.category}_${slugify(entry.value)}`;

      // Check if key already exists (handles near-duplicate values)
      const [keyConflict] = await db
        .select({ id: mobileMemoryTable.id, value: mobileMemoryTable.value })
        .from(mobileMemoryTable)
        .where(
          and(
            eq(mobileMemoryTable.userId, userId),
            eq(mobileMemoryTable.key, key),
          ),
        )
        .limit(1);

      if (keyConflict) {
        // Update value (semantic update — AI found a more complete version)
        await db
          .update(mobileMemoryTable)
          .set({ value: entry.value, updatedAt: new Date() })
          .where(eq(mobileMemoryTable.id, keyConflict.id));
        stored++;
      } else {
        await db.insert(mobileMemoryTable).values({
          userId,
          category: entry.category,
          key,
          value: entry.value,
        });
        stored++;
      }
    }
  }

  return { stored, skipped };
}

// ── System prompt builder ─────────────────────────────────────────────────────

/**
 * Fetches all memories for a user and formats them as a structured
 * system prompt addition to personalize AI responses.
 */
export async function buildMemorySystemPrompt(userId: number): Promise<string> {
  const memories = await db
    .select({ category: mobileMemoryTable.category, value: mobileMemoryTable.value })
    .from(mobileMemoryTable)
    .where(eq(mobileMemoryTable.userId, userId))
    .orderBy(desc(mobileMemoryTable.updatedAt))
    .limit(30);

  if (memories.length === 0) return "";

  const grouped: Record<string, string[]> = { goal: [], interest: [], fact: [], preference: [] };
  for (const m of memories) {
    (grouped[m.category] ??= []).push(m.value);
  }

  const sections: string[] = [];

  if (grouped["goal"]?.length)
    sections.push(`Goals & aspirations:\n${grouped["goal"].map((v) => `  - ${v}`).join("\n")}`);
  if (grouped["interest"]?.length)
    sections.push(`Interests & passions:\n${grouped["interest"].map((v) => `  - ${v}`).join("\n")}`);
  if (grouped["fact"]?.length)
    sections.push(`Personal info:\n${grouped["fact"].map((v) => `  - ${v}`).join("\n")}`);
  if (grouped["preference"]?.length)
    sections.push(`Preferences:\n${grouped["preference"].map((v) => `  - ${v}`).join("\n")}`);

  if (sections.length === 0) return "";

  return (
    "\n\n[MEMORY — User profile. Use this to personalize your response naturally. Never mention that you're using stored memory.]\n" +
    sections.join("\n\n")
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function emptyExtraction(): ExtractedMemory {
  return { goals: [], interests: [], personal_info: [] };
}

function toStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
}
