import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, marketplaceItemsTable, workflowRatingsTable, workflowPlaysTable, workflowRemixesTable, workflowsTable } from "@workspace/db";
import { eq, desc, asc, ilike, or, sql, and } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ─────────────────────────────────────────────────────────────
// RANKING SCORE: plays*1 + rating*20 + remixes*15 + recency_boost
// ─────────────────────────────────────────────────────────────
function computeScore(playCount: number, ratingAvg: number, remixCount: number, publishedAt: Date): number {
  const ageHours = (Date.now() - publishedAt.getTime()) / 3600000;
  const recencyBoost = Math.max(0, 50 - ageHours * 0.5);
  return playCount * 1.0 + ratingAvg * 20 + remixCount * 15 + recencyBoost;
}

async function refreshScore(itemId: number): Promise<void> {
  const [item] = await db.select().from(marketplaceItemsTable).where(eq(marketplaceItemsTable.id, itemId)).limit(1);
  if (!item) return;
  const score = computeScore(item.playCount, item.ratingAvg ?? 0, item.remixCount, item.publishedAt);
  await db.update(marketplaceItemsTable).set({ rankingScore: score, updatedAt: new Date() }).where(eq(marketplaceItemsTable.id, itemId));
}

// ─────────────────────────────────────────────────────────────
// PUBLISH WORKFLOW → MARKETPLACE
// ─────────────────────────────────────────────────────────────

const PublishBody = z.object({
  workflowId: z.number(),
  title: z.string().min(1),
  description: z.string().optional(),
  tags: z.array(z.string()).optional().default([]),
  category: z.string().optional().default("custom"),
  thumbnailEmoji: z.string().optional().default("⚡"),
  authorName: z.string().optional().default("Apex User"),
});

router.post("/marketplace/publish", async (req, res): Promise<void> => {
  const parsed = PublishBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { workflowId, title, description, tags, category, thumbnailEmoji, authorName } = parsed.data;

  // Verify workflow exists
  const [workflow] = await db.select().from(workflowsTable).where(eq(workflowsTable.id, workflowId)).limit(1);
  if (!workflow) { res.status(404).json({ error: "Workflow not found" }); return; }

  // Check if already published
  const existing = await db.select().from(marketplaceItemsTable).where(eq(marketplaceItemsTable.workflowId, workflowId)).limit(1);
  if (existing.length > 0) {
    // Update existing
    const [updated] = await db.update(marketplaceItemsTable)
      .set({ title, description, tags, category, thumbnailEmoji, authorName, isPublic: true, updatedAt: new Date() })
      .where(eq(marketplaceItemsTable.workflowId, workflowId))
      .returning();
    res.json({ item: updated, updated: true });
    return;
  }

  // Auto-detect category with AI if not specified
  let finalCategory = category;
  if (category === "custom" && workflow.steps) {
    try {
      const steps = (workflow.steps as { provider?: string; name?: string }[]);
      const stepSummary = steps.map((s) => `${s.name} (${s.provider})`).join(", ");
      const aiResp = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Categorize this AI workflow into ONE word from: video, game, podcast, blog, marketing, productivity, creative, business, research, social. Output only the word." },
          { role: "user", content: `Title: ${title}\nSteps: ${stepSummary}` },
        ],
        max_tokens: 10,
        temperature: 0.2,
      });
      finalCategory = aiResp.choices[0]?.message?.content?.trim().toLowerCase() ?? category;
    } catch { /* use default */ }
  }

  // Auto-generate tags if none provided
  let finalTags = tags.length > 0 ? tags : [];
  if (finalTags.length === 0) {
    try {
      const aiTagResp = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Generate 3-5 short tags for this AI workflow. Output as JSON array of strings. Example: [\"video\", \"youtube\", \"ai-generated\"]" },
          { role: "user", content: `Title: ${title}\nDescription: ${description ?? ""}` },
        ],
        max_tokens: 60,
        temperature: 0.5,
      });
      finalTags = JSON.parse(aiTagResp.choices[0]?.message?.content ?? "[]");
    } catch { finalTags = [finalCategory]; }
  }

  const initScore = computeScore(0, 0, 0, new Date());
  const [item] = await db.insert(marketplaceItemsTable).values({
    workflowId,
    title,
    description,
    tags: finalTags,
    category: finalCategory,
    thumbnailEmoji,
    authorName,
    rankingScore: initScore,
  }).returning();

  res.status(201).json({ item });
});

// ─────────────────────────────────────────────────────────────
// MARKETPLACE FEED
// ─────────────────────────────────────────────────────────────

router.get("/marketplace/feed", async (req, res): Promise<void> => {
  const sort = (req.query.sort as string) ?? "trending";
  const search = (req.query.search as string) ?? "";
  const category = (req.query.category as string) ?? "";

  let query = db
    .select({
      marketplace: marketplaceItemsTable,
      steps: workflowsTable.steps,
    })
    .from(marketplaceItemsTable)
    .leftJoin(workflowsTable, eq(marketplaceItemsTable.workflowId, workflowsTable.id))
    .where(eq(marketplaceItemsTable.isPublic, true))
    .$dynamic();

  if (search) {
    query = query.where(
      and(
        eq(marketplaceItemsTable.isPublic, true),
        or(
          ilike(marketplaceItemsTable.title, `%${search}%`),
          ilike(marketplaceItemsTable.description ?? sql`''`, `%${search}%`)
        )
      )
    );
  }

  if (category && category !== "all") {
    query = query.where(
      and(
        eq(marketplaceItemsTable.isPublic, true),
        eq(marketplaceItemsTable.category, category)
      )
    );
  }

  const orderMap: Record<string, ReturnType<typeof desc>> = {
    trending: desc(marketplaceItemsTable.rankingScore),
    newest: desc(marketplaceItemsTable.publishedAt),
    top_rated: desc(marketplaceItemsTable.ratingAvg),
    most_played: desc(marketplaceItemsTable.playCount),
  };

  const rows = await query.orderBy(orderMap[sort] ?? desc(marketplaceItemsTable.rankingScore)).limit(50);

  const items = rows.map(({ marketplace, steps }) => ({
    ...marketplace,
    tags: (marketplace.tags ?? []) as string[],
    steps: steps ?? [],
  }));

  res.json({ items });
});

// ─────────────────────────────────────────────────────────────
// TRACK PLAY
// ─────────────────────────────────────────────────────────────

router.post("/marketplace/track-play", async (req, res): Promise<void> => {
  const { marketplaceItemId, workflowId, sessionDurationMs, completed } = req.body;
  if (!marketplaceItemId) { res.status(400).json({ error: "marketplaceItemId required" }); return; }

  await db.insert(workflowPlaysTable).values({ marketplaceItemId, workflowId, sessionDurationMs, completed });
  await db.update(marketplaceItemsTable)
    .set({ playCount: sql`${marketplaceItemsTable.playCount} + 1`, updatedAt: new Date() })
    .where(eq(marketplaceItemsTable.id, marketplaceItemId));

  await refreshScore(marketplaceItemId);
  res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────
// RATE WORKFLOW
// ─────────────────────────────────────────────────────────────

router.post("/marketplace/rate", async (req, res): Promise<void> => {
  const { marketplaceItemId, workflowId, rating, review } = req.body;
  if (!marketplaceItemId || !rating || rating < 1 || rating > 5) {
    res.status(400).json({ error: "marketplaceItemId and rating (1-5) required" });
    return;
  }

  await db.insert(workflowRatingsTable).values({ marketplaceItemId, workflowId, rating, review });

  // Recalculate average
  const ratings = await db.select().from(workflowRatingsTable).where(eq(workflowRatingsTable.marketplaceItemId, marketplaceItemId));
  const avg = ratings.reduce((s, r) => s + r.rating, 0) / ratings.length;

  await db.update(marketplaceItemsTable)
    .set({ ratingAvg: avg, ratingCount: ratings.length, updatedAt: new Date() })
    .where(eq(marketplaceItemsTable.id, marketplaceItemId));

  await refreshScore(marketplaceItemId);
  res.json({ success: true, ratingAvg: avg, ratingCount: ratings.length });
});

// ─────────────────────────────────────────────────────────────
// REMIX WORKFLOW
// ─────────────────────────────────────────────────────────────

router.post("/marketplace/:id/remix", async (req, res): Promise<void> => {
  const workflowId = Number(req.params.id);
  const [source] = await db.select().from(workflowsTable).where(eq(workflowsTable.id, workflowId)).limit(1);
  if (!source) { res.status(404).json({ error: "Workflow not found" }); return; }

  const [remixed] = await db.insert(workflowsTable).values({
    name: `Remix of ${source.name}`,
    description: source.description ? `Remixed from: ${source.description}` : `Remix of ${source.name}`,
    category: source.category ?? "custom",
    trigger: source.trigger,
    steps: source.steps,
    actions: source.actions,
    conditions: source.conditions,
    isTemplate: false,
    authorName: "You",
  }).returning();

  await db.insert(workflowRemixesTable).values({ sourceWorkflowId: workflowId, remixedWorkflowId: remixed.id });

  // Update remix count on marketplace item
  await db.update(marketplaceItemsTable)
    .set({ remixCount: sql`${marketplaceItemsTable.remixCount} + 1`, updatedAt: new Date() })
    .where(eq(marketplaceItemsTable.workflowId, workflowId));

  // Find and refresh score
  const [item] = await db.select().from(marketplaceItemsTable).where(eq(marketplaceItemsTable.workflowId, workflowId)).limit(1);
  if (item) await refreshScore(item.id);

  logger.info({ sourceId: workflowId, remixedId: remixed.id }, "Workflow remixed");
  res.status(201).json({ workflowId: remixed.id, message: `Remixed to your collection as "${remixed.name}"` });
});

// ─────────────────────────────────────────────────────────────
// CREATOR DASHBOARD
// ─────────────────────────────────────────────────────────────

router.get("/marketplace/creator-dashboard", async (_req, res): Promise<void> => {
  const [items, plays, ratings, remixes] = await Promise.all([
    db.select().from(marketplaceItemsTable),
    db.select().from(workflowPlaysTable),
    db.select().from(workflowRatingsTable),
    db.select().from(workflowRemixesTable),
  ]);

  const totalWorkflows = await db.select().from(workflowsTable);
  const totalPlays = items.reduce((s, i) => s + i.playCount, 0);
  const totalRatings = items.reduce((s, i) => s + i.ratingCount, 0);
  const totalRemixes = items.reduce((s, i) => s + i.remixCount, 0);
  const avgRating = items.length > 0
    ? items.reduce((s, i) => s + (i.ratingAvg ?? 0), 0) / items.length
    : 0;

  const topItem = items.sort((a, b) => b.rankingScore - a.rankingScore)[0];

  res.json({
    totalWorkflows: totalWorkflows.length,
    publishedCount: items.filter((i) => i.isPublic).length,
    totalPlays,
    totalRatings,
    totalRemixes,
    avgRating: Math.round(avgRating * 10) / 10,
    topWorkflow: topItem
      ? { title: topItem.title, playCount: topItem.playCount, ratingAvg: topItem.ratingAvg ?? 0 }
      : null,
  });
});

// ─────────────────────────────────────────────────────────────
// SEED MARKETPLACE DEMOS
// ─────────────────────────────────────────────────────────────

router.post("/marketplace/seed", async (_req, res): Promise<void> => {
  const existing = await db.select().from(marketplaceItemsTable);
  if (existing.length >= 6) { res.json({ success: true, message: "Already seeded" }); return; }

  const demoWorkflows = [
    { name: "YouTube Video Creator", description: "Full pipeline from idea to published YouTube video", category: "video", steps: [{ id: "s1", name: "Research", provider: "perplexity", prompt: "Research trending topics in {{topic}}", outputKey: "research", config: {} }, { id: "s2", name: "Script", provider: "claude", prompt: "Write a 5-min YouTube script about {{research}}", outputKey: "script", config: {} }, { id: "s3", name: "Voice", provider: "elevenlabs", prompt: "Narrate: {{script}}", outputKey: "audio", config: {} }] },
    { name: "Game Concept Creator", description: "Generate full game design documents with mechanics", category: "game", steps: [{ id: "s1", name: "Concept", provider: "openai", prompt: "Invent a game concept for {{genre}}", outputKey: "concept", config: {} }, { id: "s2", name: "GDD", provider: "claude", prompt: "Write a game design doc for: {{concept}}", outputKey: "gdd", config: {} }] },
    { name: "Podcast Episode Builder", description: "Research, script, and produce a full podcast", category: "podcast", steps: [{ id: "s1", name: "Topic Research", provider: "perplexity", prompt: "Deep research on {{topic}}", outputKey: "research", config: {} }, { id: "s2", name: "Script", provider: "openai", prompt: "Write podcast script from {{research}}", outputKey: "script", config: {} }] },
    { name: "Blog Post Machine", description: "SEO-optimized blog posts from a single keyword", category: "blog", steps: [{ id: "s1", name: "SEO Research", provider: "perplexity", prompt: "Find top keywords for {{topic}}", outputKey: "keywords", config: {} }, { id: "s2", name: "Outline", provider: "openai", prompt: "Outline a blog post for {{keywords}}", outputKey: "outline", config: {} }, { id: "s3", name: "Write", provider: "claude", prompt: "Write full post from outline: {{outline}}", outputKey: "post", config: {} }] },
    { name: "Social Campaign Generator", description: "Full social media campaign across all platforms", category: "marketing", steps: [{ id: "s1", name: "Strategy", provider: "openai", prompt: "Create a social media strategy for {{brand}}", outputKey: "strategy", config: {} }, { id: "s2", name: "Content", provider: "claude", prompt: "Write 10 posts from: {{strategy}}", outputKey: "content", config: {} }] },
    { name: "AI Startup Analyzer", description: "Deep competitive analysis and market research", category: "research", steps: [{ id: "s1", name: "Market Research", provider: "perplexity", prompt: "Research the {{industry}} market in 2025", outputKey: "market", config: {} }, { id: "s2", name: "Analysis", provider: "claude", prompt: "Competitive analysis from: {{market}}", outputKey: "analysis", config: {} }] },
  ];

  const emojis = { video: "🎥", game: "🎮", podcast: "🎙️", blog: "✍️", marketing: "📱", research: "🔬" };
  const tagMap: Record<string, string[]> = { video: ["youtube", "video", "ai"], game: ["game", "design", "gdd"], podcast: ["podcast", "audio", "content"], blog: ["blog", "seo", "writing"], marketing: ["social", "campaign", "marketing"], research: ["startup", "analysis", "research"] };
  const authorNames = ["Alex Studio", "Creator Labs", "Workflow Pro", "Apex Builder", "AI Factory", "Dev Hub"];

  for (let i = 0; i < demoWorkflows.length; i++) {
    const wf = demoWorkflows[i]!;
    const [workflow] = await db.insert(workflowsTable).values({
      name: wf.name,
      description: wf.description,
      category: wf.category,
      trigger: "manual",
      steps: wf.steps,
      actions: [],
      conditions: [],
      isTemplate: false,
    }).returning();

    const fakeAge = (i + 1) * 3600000;
    const fakePublishedAt = new Date(Date.now() - fakeAge);
    const fakePlays = [347, 892, 124, 556, 1203, 78][i] ?? 100;
    const fakeRating = [4.7, 4.9, 4.2, 4.5, 4.8, 4.3][i] ?? 4.5;
    const fakeRemixes = [23, 67, 8, 34, 112, 5][i] ?? 10;
    const tags = tagMap[wf.category] ?? [wf.category];

    const score = computeScore(fakePlays, fakeRating, fakeRemixes, fakePublishedAt);

    await db.insert(marketplaceItemsTable).values({
      workflowId: workflow.id,
      title: wf.name,
      description: wf.description,
      tags,
      category: wf.category,
      thumbnailEmoji: emojis[wf.category as keyof typeof emojis] ?? "⚡",
      authorName: authorNames[i] ?? "Creator",
      playCount: fakePlays,
      ratingAvg: fakeRating,
      ratingCount: Math.floor(fakePlays / 5),
      remixCount: fakeRemixes,
      rankingScore: score,
      isFeatured: [1, 3].includes(i),
      publishedAt: fakePublishedAt,
    });
  }

  res.json({ success: true });
});

export default router;
