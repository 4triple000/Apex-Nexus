import { Router, type IRouter } from "express";
import { chatSingle, hasOwnKey } from "../lib/aiRouter";
import { requireUser } from "../shared/middleware/requireAuth";
import type { ApexRequest } from "../shared/types";
import { creditUserFor, canSpend, outOfCredits, recordUsage, creditCost } from "../lib/credits";
import { getUserKeys } from "../lib/connectors";
import { z } from "zod";

const router: IRouter = Router();

// ── Battle mode system prompts ────────────────────────────────────────────────
const BATTLE_SYSTEM_PROMPTS: Record<string, string> = {
  logic: "You are competing in a LOGIC BATTLE. Present the most logically coherent, well-structured argument possible. Use clear reasoning chains, evidence-based assertions, and rigorous thinking. Avoid emotional appeals — rely on pure intellectual force. Be thorough and precise.",
  debate: "You are in a DEBATE BATTLE. Your goal is to be maximally persuasive and compelling. Use rhetorical techniques, confident assertions, emotional resonance, and powerful framing. Your opponent is another AI — convince the reader that your position is definitively correct.",
  creative: "You are in a CREATIVE BATTLE. Express your response with exceptional originality, vivid imagery, and artistic flair. Use metaphors, storytelling, unique perspectives, and expressive language. Show the full range of creative power. Stand out from a conventional AI response.",
  speed: "You are in a SPEED BATTLE. Respond swiftly and accurately. Be concise, crisp, and correct. Every single word must earn its place — cut all filler, padding, and unnecessary elaboration. Maximum information density.",
};

// ── Scoring engine ────────────────────────────────────────────────────────────
function scoreResponse(
  content: string,
  prompt: string,
  responseTimeMs: number,
  battleMode: string,
): {
  total: number;
  logic: number;
  relevance: number;
  confidence: number;
  depth: number;
  speed: number;
} {
  const words = content.toLowerCase().split(/\s+/).filter(Boolean);
  const wordCount = Math.max(words.length, 1);

  // Logic: logical connectors, reasoning markers
  const logicMarkers = [
    "because","therefore","thus","hence","consequently","however","although",
    "whereas","since","given","implies","conclude","evidence","demonstrates",
    "shows","proves","according","reasoning","argument","furthermore","moreover",
    "nevertheless","notwithstanding","specifically","particularly","analysis",
  ];
  const logicHits = words.filter((w) => logicMarkers.some((m) => w.includes(m))).length;
  const logic = Math.round(Math.min(100, 38 + (logicHits / wordCount) * 2800));

  // Relevance: keyword overlap with original prompt
  const promptWords = new Set(
    prompt.toLowerCase().split(/\s+/).filter((w) => w.length > 3),
  );
  const overlap =
    promptWords.size > 0
      ? words.filter((w) => promptWords.has(w)).length / promptWords.size
      : 0;
  const relevance = Math.round(Math.min(100, 28 + overlap * 130));

  // Confidence: assertive, declarative language
  const confMarkers = [
    "clearly","certainly","definitely","absolutely","undoubtedly","proves",
    "demonstrates","shows","must","without","obviously","strongly","evidence",
    "proven","established","undeniable","essential","fundamental","critical",
  ];
  const confHits = words.filter((w) => confMarkers.some((c) => w.includes(c))).length;
  const confidence = Math.round(Math.min(100, 32 + (confHits / wordCount) * 3200));

  // Depth: word count proxy for thoroughness
  const depth = Math.round(Math.min(100, (wordCount / 380) * 100));

  // Speed: lower response time = better score (max 8s for 0 points)
  const speed = Math.round(Math.max(0, Math.min(100, 100 - (responseTimeMs / 8000) * 100)));

  // Mode-weighted final total
  let total: number;
  switch (battleMode) {
    case "debate":
      total = confidence * 0.35 + logic * 0.30 + relevance * 0.25 + speed * 0.10;
      break;
    case "creative":
      total = depth * 0.35 + relevance * 0.30 + confidence * 0.20 + speed * 0.15;
      break;
    case "speed":
      total = speed * 0.50 + relevance * 0.25 + logic * 0.15 + depth * 0.10;
      break;
    default: // logic
      total = logic * 0.40 + relevance * 0.25 + depth * 0.20 + speed * 0.15;
  }

  return {
    total: Math.round(total),
    logic,
    relevance,
    confidence,
    depth,
    speed,
  };
}

// ── Validation schema ─────────────────────────────────────────────────────────
const BattleRoundBody = z.object({
  prompt: z.string().min(1).max(2000),
  sessionId: z.string().optional(),
  providerA: z.enum(["openai", "claude", "perplexity"]).default("openai"),
  providerB: z.enum(["openai", "claude", "perplexity"]).default("claude"),
  battleMode: z.enum(["logic", "debate", "creative", "speed"]).default("logic"),
});

// ── POST /battle/round ────────────────────────────────────────────────────────
router.post("/battle/round", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const parsed = BattleRoundBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { prompt, providerA, providerB, battleMode } = parsed.data;
  const sysPrompt = BATTLE_SYSTEM_PROMPTS[battleMode] ?? BATTLE_SYSTEM_PROMPTS.logic;
  const enhancedPrompt = `${sysPrompt}\n\n--- BATTLE TOPIC ---\n${prompt}`;

  const who = await creditUserFor(req.userId!);
  if (!who) { res.status(401).json({ error: "Please sign in." }); return; }
  const keys = await getUserKeys(who.userId);
  const needed = [providerA, providerB].reduce((sum, p) => sum + (hasOwnKey(keys, p) ? 0 : creditCost(p)), 0);
  const check = await canSpend(who, needed);
  if (!check.ok) { res.status(429).json(outOfCredits(check.balance, needed)); return; }

  try {
    // Call both AIs in parallel for the round
    const [responsesA, responsesB] = await Promise.all([
      chatSingle(enhancedPrompt, providerA, undefined, keys),
      chatSingle(enhancedPrompt, providerB, undefined, keys),
    ]);

    const a = responsesA[0];
    const b = responsesB[0];
    for (const r of [a, b]) {
      if (r && !r.error && r.content && r.provider !== "hive") {
        await recordUsage(who, { provider: r.provider, ownKey: r.ownKey, inputTokens: r.inputTokens, outputTokens: r.outputTokens }).catch(() => undefined);
      }
    }

    const scoreA = scoreResponse(a.content, prompt, a.responseTime, battleMode);
    const scoreB = scoreResponse(b.content, prompt, b.responseTime, battleMode);

    const winner =
      scoreA.total > scoreB.total ? "a" : scoreB.total > scoreA.total ? "b" : "tie";

    // HP damage: loser loses proportional HP, capped at 45 per round
    const scoreDiff = Math.abs(scoreA.total - scoreB.total);
    const hpDamage = Math.min(45, Math.max(5, Math.round(scoreDiff * 0.6)));

    res.json({
      responseA: {
        provider: a.provider,
        content: a.content,
        responseTime: a.responseTime,
        error: a.error,
        score: scoreA,
      },
      responseB: {
        provider: b.provider,
        content: b.content,
        responseTime: b.responseTime,
        error: b.error,
        score: scoreB,
      },
      winner,
      hpDamage,
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Battle round failed",
    });
  }
});

export default router;
