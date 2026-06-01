/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  APEX CORE PIPELINE ENGINE v3                                            ║
 * ║  Intent → Features → Mapping → Assembly → Generation                    ║
 * ║  + AI Enhancement Layer (tone/scale/audience/style/palette)              ║
 * ║  + Auto-Upgrade System (smart post-generation suggestions)               ║
 * ║  + Memory-aware personalization (recent build context)                   ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */
import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  BLUEPRINTS,
  BLOCK_REGISTRY,
  FEATURE_MAP,
  UI_BLOCK_TO_SCREEN,
  UPGRADE_PATHS,
  type Blueprint,
  type BlockDef,
  type DetectedIntent,
  type AIEnhancement,
  type UpgradeSuggestion,
  type GeneratedScreen,
  type PipelineResult,
  type BuildMemoryEntry,
} from "../../../apex/src/data/blockSystem";

const router = Router();

// ─── Unified AI Analysis Prompt (Stages 1 + 2 + Enhancement in ONE call) ─────
const AI_PIPELINE_PROMPT = `You are the Apex Core Pipeline Engine with AI Enhancement Layer. Analyze the user's app idea and return a JSON object covering three stages simultaneously.

STAGE 1 — Intent Detection:
Classify app type, subtype, complexity and builder mode.

STAGE 2 — Feature Extraction:
Pick ONLY from these feature names:
user_accounts, chat_system, payment_processing, product_listings, social_feed,
multiplayer, ai_assistant, push_notifications, analytics, content_upload,
game_engine, enemy_ai, recommendations, automation_bot, voice_interface,
image_generation, search, booking_system, reviews_ratings, admin_dashboard,
webhooks, content_moderation, caching, leaderboard, video_streaming, crm,
inventory, reporting, npc_ai, decision_engine, file_storage

STAGE 2b — AI Enhancement Layer:
Detect deeper signals in the prompt:
- tone: "fun" | "serious" | "professional" | "playful"
- scale: "hobby" | "startup" | "enterprise"
- audience: specific target user group (string, e.g. "teens", "gamers", "finance professionals", "kids 8-12")
- uiStyle: "minimal" | "bold" | "elegant" | "playful" | "dark"
- colorPalette: array of 4 hex color strings that fit the app's personality (e.g. bright for fun youth apps, muted for business tools)
- tagline: a punchy 5-8 word tagline for the app
- emoji: single emoji that represents the app

IF previous builds are provided, subtly adjust colorPalette and uiStyle to match the user's demonstrated style preferences.

Respond with this EXACT JSON (no markdown, no extra text):
{
  "intent": {
    "category": "<social_app|game|ecommerce|ai_tool|productivity|media_platform|marketplace|dashboard|automation|general_app>",
    "subtype": "<specific subtype>",
    "complexity": "<simple|medium|complex>",
    "mode": "<app|game|ai|business|custom>"
  },
  "features": ["<feature_name>", ...],
  "enhancement": {
    "tone": "<fun|serious|professional|playful>",
    "scale": "<hobby|startup|enterprise>",
    "audience": "<target audience description>",
    "uiStyle": "<minimal|bold|elegant|playful|dark>",
    "colorPalette": ["#hex1","#hex2","#hex3","#hex4"],
    "tagline": "<5-8 word tagline>",
    "emoji": "<single emoji>"
  },
  "appName": "<catchy app name>",
  "confidence": <0.0-1.0>
}`;

// ─── Stage 3: Deterministic feature → block mapping ──────────────────────────
function runBlueprintMapping(features: string[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const f of features) {
    if (FEATURE_MAP[f]) map[f] = FEATURE_MAP[f];
    else map[f] = [];
  }
  return map;
}

// ─── Stage 4: Block assembly (dedup) ─────────────────────────────────────────
function runBlockAssembly(featureBlockMap: Record<string, string[]>): string[] {
  const all: string[] = [];
  for (const blocks of Object.values(featureBlockMap)) all.push(...blocks);
  return Array.from(new Set(all)).filter((id) => BLOCK_REGISTRY[id]);
}

// ─── Stage 5: Project generation (screens + nav + blueprint match) ────────────
function runProjectGeneration(blockIds: string[], intent: DetectedIntent) {
  const screens: GeneratedScreen[] = [];
  const seenRoutes = new Set<string>();
  const supportBlocks = blockIds.filter((id) => BLOCK_REGISTRY[id]?.category !== "ui");

  for (const blockId of blockIds) {
    const screenDef = UI_BLOCK_TO_SCREEN[blockId];
    if (screenDef && !seenRoutes.has(screenDef.route)) {
      seenRoutes.add(screenDef.route);
      screens.push({ ...screenDef, blocks: [blockId, ...supportBlocks.slice(0, 3)] });
    }
  }
  if (screens.length === 0) {
    screens.push({ name: "Home", icon: "🏠", route: "/", description: "Main screen", blocks: blockIds.slice(0, 3) });
  }

  const navigation = screens.map((s) => s.route);

  const blueprint = BLUEPRINTS.reduce<{ bp: Blueprint | null; score: number }>(
    (best, bp) => {
      const score = bp.blocks.filter((id) => blockIds.includes(id)).length /
        Math.max(bp.blocks.length, blockIds.length);
      return score > best.score ? { bp, score } : best;
    },
    { bp: null, score: 0 },
  ).bp;

  return { screens, navigation, blueprint };
}

// ─── Auto-Upgrade System ──────────────────────────────────────────────────────
function computeUpgrades(
  assembledFeatures: string[],
  assembledBlockIds: string[],
): UpgradeSuggestion[] {
  const featureSet = new Set(assembledFeatures);
  const suggestions: UpgradeSuggestion[] = [];

  for (const [id, path] of Object.entries(UPGRADE_PATHS)) {
    const newFeatures = path.features.filter((f) => !featureSet.has(f));
    if (newFeatures.length === 0) continue;
    const newBlockIds = newFeatures
      .flatMap((f) => FEATURE_MAP[f] ?? [])
      .filter((blockId) => !assembledBlockIds.includes(blockId) && BLOCK_REGISTRY[blockId]);
    const blockCount = new Set(newBlockIds).size;
    if (blockCount > 0) {
      suggestions.push({ id, ...path, features: newFeatures, blockCount });
    }
  }

  // Score: prioritize upgrades that add fewer overlapping blocks (clean additions)
  return suggestions
    .sort((a, b) => a.blockCount - b.blockCount)
    .slice(0, 4);
}

// ─── POST /pipeline — full 5-stage pipeline ───────────────────────────────────
router.post("/pipeline", async (req, res) => {
  const t0 = Date.now();
  try {
    const { prompt, recentBuilds } = req.body as {
      prompt?: string;
      recentBuilds?: Pick<BuildMemoryEntry, "appName" | "features" | "enhancement">[];
    };

    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 3) {
      return res.status(400).json({ error: "prompt required" });
    }

    let userContent = `Build me: "${prompt.trim()}"`;
    if (recentBuilds?.length) {
      const memory = recentBuilds.slice(0, 2).map((b) =>
        `- ${b.appName}: ${b.features.join(", ")} | tone=${b.enhancement?.tone} style=${b.enhancement?.uiStyle}`
      ).join("\n");
      userContent += `\n\nUser's recent builds (use for style personalization):\n${memory}`;
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.25,
      messages: [
        { role: "system", content: AI_PIPELINE_PROMPT },
        { role: "user", content: userContent },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    let aiResult: {
      intent: DetectedIntent;
      features: string[];
      enhancement: AIEnhancement;
      appName: string;
      confidence: number;
    };

    try {
      aiResult = JSON.parse(raw);
    } catch {
      return res.status(500).json({ error: "AI parse failed", raw });
    }

    const validFeatures = aiResult.features.filter((f) => FEATURE_MAP[f] !== undefined);
    const featureBlockMap = runBlueprintMapping(validFeatures);
    const assembledBlockIds = runBlockAssembly(featureBlockMap);
    const blocks: BlockDef[] = assembledBlockIds.map((id) => BLOCK_REGISTRY[id]).filter(Boolean);
    const { screens, navigation, blueprint } = runProjectGeneration(assembledBlockIds, aiResult.intent);
    const upgrades = computeUpgrades(validFeatures, assembledBlockIds);

    const result: PipelineResult = {
      prompt: prompt.trim(),
      durationMs: Date.now() - t0,
      intent: aiResult.intent,
      enhancement: aiResult.enhancement,
      features: validFeatures,
      featureBlockMap,
      assembledBlockIds,
      blocks,
      screens,
      navigation,
      appName: aiResult.appName || "My App",
      blueprint: blueprint ?? null,
      confidence: aiResult.confidence,
      upgrades,
    };

    return res.json(result);
  } catch (err) {
    console.error("[blockBuilder] pipeline error:", err);
    return res.status(500).json({ error: "Pipeline error" });
  }
});

// ─── POST /upgrade — apply one upgrade to an existing result ─────────────────
router.post("/upgrade", async (req, res) => {
  try {
    const {
      upgradeId,
      currentFeatures,
      currentBlockIds,
    } = req.body as {
      upgradeId?: string;
      currentFeatures?: string[];
      currentBlockIds?: string[];
    };

    const path = upgradeId ? UPGRADE_PATHS[upgradeId] : null;
    if (!path || !currentFeatures || !currentBlockIds) {
      return res.status(400).json({ error: "upgradeId, currentFeatures, currentBlockIds required" });
    }

    const newFeatures = [...new Set([...currentFeatures, ...path.features])];
    const featureBlockMap = runBlueprintMapping(newFeatures);
    const assembledBlockIds = runBlockAssembly(featureBlockMap);
    const blocks: BlockDef[] = assembledBlockIds.map((id) => BLOCK_REGISTRY[id]).filter(Boolean);
    const addedBlockIds = assembledBlockIds.filter((id) => !currentBlockIds.includes(id));
    const addedBlocks: BlockDef[] = addedBlockIds.map((id) => BLOCK_REGISTRY[id]).filter(Boolean);
    const upgrades = computeUpgrades(newFeatures, assembledBlockIds);

    return res.json({
      features: newFeatures,
      featureBlockMap,
      assembledBlockIds,
      blocks,
      addedBlocks,
      upgrades,
    });
  } catch (err) {
    console.error("[blockBuilder] upgrade error:", err);
    return res.status(500).json({ error: "Upgrade error" });
  }
});

// ─── Legacy /generate — backward compat ──────────────────────────────────────
router.post("/generate", async (req, res) => {
  try {
    const { prompt } = req.body as { prompt?: string };
    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 3) {
      return res.status(400).json({ error: "prompt required" });
    }
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.25,
      messages: [
        { role: "system", content: AI_PIPELINE_PROMPT },
        { role: "user", content: `Build me: "${prompt.trim()}"` },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "";
    let aiResult: { intent: DetectedIntent; features: string[]; enhancement: AIEnhancement; appName: string; confidence: number };
    try { aiResult = JSON.parse(raw); } catch { return res.status(500).json({ error: "AI parse failed" }); }

    const validFeatures = aiResult.features.filter((f) => FEATURE_MAP[f] !== undefined);
    const featureBlockMap = runBlueprintMapping(validFeatures);
    const assembledBlockIds = runBlockAssembly(featureBlockMap);
    const blocks = assembledBlockIds.map((id) => BLOCK_REGISTRY[id]).filter(Boolean);
    const { blueprint } = runProjectGeneration(assembledBlockIds, aiResult.intent);

    return res.json({ blueprint: blueprint ?? BLUEPRINTS[0], blocks, suggestedName: aiResult.appName, confidence: aiResult.confidence, reasoning: `${aiResult.intent.category} · ${aiResult.intent.subtype}`, mode: aiResult.intent.mode });
  } catch {
    return res.status(500).json({ error: "Internal error" });
  }
});

router.get("/blueprints", (_req, res) => res.json({ blueprints: BLUEPRINTS }));
router.get("/blocks",     (_req, res) => res.json({ blocks: Object.values(BLOCK_REGISTRY) }));
router.get("/features",   (_req, res) => res.json({ features: Object.keys(FEATURE_MAP), map: FEATURE_MAP }));
router.get("/upgrades",   (_req, res) => res.json({ upgrades: Object.entries(UPGRADE_PATHS).map(([id, p]) => ({ id, ...p })) }));

export default router;
