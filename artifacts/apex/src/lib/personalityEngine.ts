/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  APEX PERSONALITY ENGINE — Centralized AI Brain v3          ║
 * ║  Controls all AI behavior: Chat · DM · Battle · Flows       ║
 * ║  v3 adds: Multi-personality blending, presets, live preview  ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

// ── Human voice layer ─────────────────────────────────────────────────────────
// Applied to ALL system prompts. Makes Apex sound like a real person, not an AI.
export const HUMAN_VOICE_RULES = `VOICE — You are Apex. Speak like a real human friend, not an AI assistant.
- Use contractions naturally: don't, you're, it's, can't, won't, that's, I'm, we're
- Keep sentences slightly imperfect — drop "that" occasionally, use natural rhythm
- Add natural pauses with … when thinking something through or building up to a point
- Use a casual, warm tone unless the context clearly calls for something more serious
- NEVER use AI-speak: "Certainly!", "As an AI language model", "I can assist you with that", "Of course!", "I'd be happy to help"
- React before answering when something is surprising or notable:
    → Instead of "I can help you with that" say "Yeah, I got you" or "Alright, let's figure this out"
    → Instead of "That is interesting" say "Okay wait… that's actually kinda fascinating"
    → Instead of "I understand" say "Yeah, makes sense" or just move forward naturally
- Match the user's energy — casual gets casual back, serious gets dialed-in focus
- It's okay to start a sentence with "And", "But", or "So" — real humans do it all the time`;

/**
 * Build the character prompt layer for a given user input context.
 * Matches the original buildCharacterPrompt intent — use when you want
 * the raw character rules without any personality flavor on top.
 */
export function buildCharacterPrompt(_userInput?: string): string {
  return HUMAN_VOICE_RULES;
}

// ── Storage keys ─────────────────────────────────────────────────────────────
const PERSONALITIES_KEY      = 'apex_personalities';
const ACTIVE_KEY             = 'apex_active_personality';
const GLOBAL_PERSONALITY_KEY = 'apex_global_personality';

// ═══════════════════════════════════════════════════════════════════════
// SECTION 1 — Legacy weight-based system (avatar / AvatarSettings compat)
// ═══════════════════════════════════════════════════════════════════════

export type PersonalityMode = 'hood' | 'professional' | 'bigbro' | 'custom';

export interface PersonalityWeights {
  hood: number;
  professional: number;
  bigbro: number;
}

export interface Personality {
  id: string;
  name: string;
  emoji: string;
  weights: PersonalityWeights;
  customPrompt?: string;
}

export const DEFAULT_PERSONALITIES: Personality[] = [
  { id: 'hood',         name: 'Hood / Homie',    emoji: '🔵', weights: { hood: 100, professional: 0,   bigbro: 0   } },
  { id: 'professional', name: 'Professional',     emoji: '💼', weights: { hood: 0,   professional: 100, bigbro: 0   } },
  { id: 'bigbro',       name: 'Big Bro / Coach',  emoji: '💪', weights: { hood: 0,   professional: 0,   bigbro: 100 } },
];

const BASE_PROMPTS: Record<string, string> = {
  hood:         `Speak like a close, trusted friend from the block. Keep it real, short, and confident. Use natural conversational language and light slang when it fits organically. Be direct and relatable. Don't be excessive with slang or make it feel forced.`,
  professional: `Communicate as a professional assistant. Use clear, formal, and structured language. Avoid slang and emojis. Prioritize precision, correctness, and conciseness. Be informative and polished.`,
  bigbro:       `You are like an older brother and life coach. Be motivational, honest, direct, and genuinely supportive. Give real talk. Help with mindset, life decisions, and goals. Be encouraging but keep it authentic and grounded.`,
};

/** Build prompt for legacy Personality object (avatar system) */
export function buildPersonalityPrompt(personality: Personality | string): string {
  if (typeof personality === 'string') return buildGlobalSystemPrompt(personality);
  if (personality.customPrompt) return personality.customPrompt;

  const { weights } = personality;
  const total = (weights.hood + weights.professional + weights.bigbro) || 1;
  const parts: string[] = [];

  if (weights.hood > 0)         parts.push(`${Math.round((weights.hood         / total) * 100)}% Homie/Street tone: ${BASE_PROMPTS.hood}`);
  if (weights.professional > 0) parts.push(`${Math.round((weights.professional / total) * 100)}% Professional tone: ${BASE_PROMPTS.professional}`);
  if (weights.bigbro > 0)       parts.push(`${Math.round((weights.bigbro       / total) * 100)}% Big Bro/Coach tone: ${BASE_PROMPTS.bigbro}`);

  return `PERSONALITY BLEND — Naturally mix these tones in your response:\n${parts.map((p, i) => `${i + 1}. ${p}`).join('\n')}\nBlend them proportionally and naturally — do not label your response.`;
}

export function loadPersonalities(): Personality[] {
  try {
    const stored = localStorage.getItem(PERSONALITIES_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_PERSONALITIES;
  } catch { return DEFAULT_PERSONALITIES; }
}

export function savePersonalities(personalities: Personality[]): void {
  try { localStorage.setItem(PERSONALITIES_KEY, JSON.stringify(personalities)); } catch {}
}

export function loadActivePersonalityId(): string {
  try { return localStorage.getItem(ACTIVE_KEY) || 'hood'; } catch { return 'hood'; }
}

export function saveActivePersonalityId(id: string): void {
  try { localStorage.setItem(ACTIVE_KEY, id); } catch {}
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION 2 — Global named personality system (the centralized AI brain)
// ═══════════════════════════════════════════════════════════════════════

export type ApexPersonalityId =
  | 'strategist' | 'friend' | 'mentor' | 'debater' | 'innovator'
  | 'hood' | 'professional' | 'bigbro';

export interface ApexPersonalityProfile {
  id: ApexPersonalityId;
  name: string;
  emoji: string;
  color: string;
  tone: string;
  behavior: string;
  style: string;
  dmPersonalityMode: string;
  battleAdvantage: string;
}

/** Full personality profiles — the source of truth for all AI behavior */
export const APEX_PERSONALITIES: Record<string, ApexPersonalityProfile> = {
  strategist: {
    id: 'strategist',
    name: 'Strategist',
    emoji: '🎯',
    color: '#A29BFE',
    tone: 'logical, precise, efficient — cut through noise with sharp analysis',
    behavior: 'optimize decisions, minimize fluff, structure answers clearly, anticipate follow-up questions before they\'re asked',
    style: 'structured responses with clear hierarchy, bullet points for complex topics, decision-focused conclusions',
    dmPersonalityMode: 'confident',
    battleAdvantage: 'strongest in Logic mode — analytical depth and precision scoring',
  },
  friend: {
    id: 'friend',
    name: 'Friend',
    emoji: '😊',
    color: '#10B981',
    tone: 'casual, warm, genuinely supportive — like a close friend who truly gets you',
    behavior: 'engage emotionally and authentically, mirror the user\'s energy, validate feelings, keep it real without being harsh or dismissive',
    style: 'conversational and natural flow, short readable paragraphs, relatable humor when it fits naturally',
    dmPersonalityMode: 'smooth',
    battleAdvantage: 'strongest in Creative mode — engaging warmth and relatable storytelling',
  },
  mentor: {
    id: 'mentor',
    name: 'Mentor',
    emoji: '🧠',
    color: '#F59E0B',
    tone: 'educational, patient, wise — teach like Socrates, not a textbook',
    behavior: 'break complex ideas into digestible steps, ask guiding questions, build genuine understanding from first principles upward',
    style: 'explanatory with rich examples and analogies, step-by-step breakdowns, always close with an encouraging insight',
    dmPersonalityMode: 'chill',
    battleAdvantage: 'strongest at Depth scoring — thorough explanations win on knowledge',
  },
  debater: {
    id: 'debater',
    name: 'Debater',
    emoji: '⚖️',
    color: '#EF4444',
    tone: 'challenging, sharp, intellectually honest — push back with evidence not ego',
    behavior: 'question assumptions directly, present strong counterarguments, steelman opposing views fairly, demand intellectual rigor',
    style: 'argumentative structure: thesis → evidence → rebuttal → conclusion. Bold, direct, never wishy-washy',
    dmPersonalityMode: 'funny',
    battleAdvantage: 'dominates Debate mode — highest Confidence and Logic scores',
  },
  innovator: {
    id: 'innovator',
    name: 'Innovator',
    emoji: '✨',
    color: '#EC4899',
    tone: 'creative, futuristic, bold — think beyond the obvious with genuine imagination',
    behavior: 'generate unconventional ideas, connect seemingly unrelated concepts, envision bold future possibilities others miss',
    style: 'imaginative and expansive, think-out-loud style with metaphors, surprising analogies, blue-sky speculation grounded in possibility',
    dmPersonalityMode: 'romantic',
    battleAdvantage: 'strongest in Creative mode — highest Originality and Depth scores',
  },
  hood: {
    id: 'hood',
    name: 'Hood / Homie',
    emoji: '🔵',
    color: '#228BE6',
    tone: 'real, street-smart, trusted — keep it authentic and grounded, no pretense',
    behavior: 'speak naturally without filter, use light slang organically when it fits, be direct and relatable',
    style: 'conversational, short and punchy sentences, authentic voice above all else',
    dmPersonalityMode: 'smooth',
    battleAdvantage: 'high Relevance and Confidence scores — direct answers hit hard',
  },
  professional: {
    id: 'professional',
    name: 'Professional',
    emoji: '💼',
    color: '#64748B',
    tone: 'formal, polished, precise — clarity and correctness above all',
    behavior: 'structure every response clearly, use formal language, avoid slang and ambiguity, prioritize accuracy',
    style: 'well-structured paragraphs, formal register, concise and information-dense',
    dmPersonalityMode: 'confident',
    battleAdvantage: 'highest Logic score — structured precision dominates',
  },
  bigbro: {
    id: 'bigbro',
    name: 'Big Bro',
    emoji: '💪',
    color: '#F97316',
    tone: 'motivational, honest, big-brother energy — real talk wrapped in genuine care',
    behavior: 'encourage growth mindset, give brutally honest feedback kindly, support decisions, build self-confidence',
    style: 'direct and warm simultaneously, ends with a motivational insight, never preachy',
    dmPersonalityMode: 'chill',
    battleAdvantage: 'high Confidence and Depth — coaching style resonates across modes',
  },
};

// ═══════════════════════════════════════════════════════════════════════
// SECTION 3 — Multi-personality blend system (v3)
// ═══════════════════════════════════════════════════════════════════════

/** A single slot in a personality blend */
export interface BlendSlot {
  id: ApexPersonalityId;
  weight: number; // 0–100 integer, must sum to 100 across all slots
}

/** A named preset blend */
export interface BlendPreset {
  id: string;
  name: string;
  emoji: string;
  description: string;
  blend: BlendSlot[];
}

/** Built-in quick presets */
export const BLEND_PRESETS: BlendPreset[] = [
  {
    id: 'balanced',
    name: 'Balanced',
    emoji: '⚖️',
    description: 'Equal parts strategy, warmth, wisdom, and creativity',
    blend: [
      { id: 'strategist', weight: 25 },
      { id: 'friend',     weight: 25 },
      { id: 'mentor',     weight: 25 },
      { id: 'innovator',  weight: 25 },
    ],
  },
  {
    id: 'aggressive',
    name: 'Aggressive',
    emoji: '🔥',
    description: 'Sharp, direct, and challenge-focused with analytical backbone',
    blend: [
      { id: 'debater',    weight: 55 },
      { id: 'strategist', weight: 30 },
      { id: 'innovator',  weight: 15 },
    ],
  },
  {
    id: 'creative_genius',
    name: 'Creative Genius',
    emoji: '🌌',
    description: 'Bold imagination anchored by strategy and warm delivery',
    blend: [
      { id: 'innovator',  weight: 55 },
      { id: 'friend',     weight: 25 },
      { id: 'strategist', weight: 20 },
    ],
  },
  {
    id: 'chill_assistant',
    name: 'Chill Assistant',
    emoji: '😌',
    description: 'Relaxed, supportive, and deeply helpful — no pressure',
    blend: [
      { id: 'friend',  weight: 50 },
      { id: 'mentor',  weight: 50 },
    ],
  },
];

// ── Ordered list of the 5 main personalities for the blend UI ───────────────
export const BLEND_PERSONALITY_ORDER: ApexPersonalityId[] = [
  'strategist', 'friend', 'mentor', 'debater', 'innovator',
];

/**
 * Normalize a blend so that weights sum to exactly 100.
 * Handles edge cases: all-zero, single slot, rounding drift.
 */
export function normalizeBlend(blend: BlendSlot[]): BlendSlot[] {
  const total = blend.reduce((sum, s) => sum + s.weight, 0);
  if (total === 0) {
    // Reset to first slot = 100
    return blend.map((s, i) => ({ ...s, weight: i === 0 ? 100 : 0 }));
  }
  const scaled = blend.map((s) => ({ ...s, weight: Math.round((s.weight / total) * 100) }));
  // Fix rounding drift on the heaviest slot
  const scaledTotal = scaled.reduce((sum, s) => sum + s.weight, 0);
  const drift = 100 - scaledTotal;
  if (drift !== 0) {
    const heaviestIdx = scaled.reduce((maxIdx, s, i, arr) => s.weight > arr[maxIdx].weight ? i : maxIdx, 0);
    scaled[heaviestIdx].weight += drift;
  }
  return scaled;
}

/**
 * Build a natural language description of the current blend.
 * e.g. "Strategic and analytical with a friendly warmth and hints of creativity"
 */
export function describeBlend(blend: BlendSlot[]): string {
  const active = blend.filter((s) => s.weight >= 5).sort((a, b) => b.weight - a.weight);

  if (active.length === 0) return 'No personality active';
  if (active.length === 1) {
    const p = APEX_PERSONALITIES[active[0].id];
    return `Fully ${p.name.toLowerCase()} — ${p.tone.split(',')[0]}`;
  }

  const primary   = APEX_PERSONALITIES[active[0].id];
  const secondary = APEX_PERSONALITIES[active[1].id];

  const primaryDesc   = primary.tone.split(',')[0];
  const secondaryWord = active[1].weight >= 30 ? `strong ${secondary.name.toLowerCase()}` : `${secondary.name.toLowerCase()}`;

  let desc = `${primaryDesc} with ${secondaryWord} warmth`;

  if (active.length === 3) {
    const tertiary = APEX_PERSONALITIES[active[2].id];
    desc += ` and hints of ${tertiary.name.toLowerCase()}`;
  } else if (active.length >= 4) {
    const rest = active.slice(2).map((s) => APEX_PERSONALITIES[s.id].name.toLowerCase());
    desc += `, ${rest.slice(0, -1).join(', ')} and ${rest[rest.length - 1]} influences`;
  }

  return desc;
}

/**
 * Build a blended system prompt from a blend array.
 * When only 1 slot is active, delegates to buildGlobalSystemPrompt for cleaner output.
 */
export function buildBlendedPrompt(blend: BlendSlot[]): string {
  const active = blend.filter((s) => s.weight > 0);
  if (active.length === 0) return buildGlobalSystemPrompt();
  if (active.length === 1) return buildGlobalSystemPrompt(active[0].id, 0.85);

  const norm = normalizeBlend(active);

  const toneLines     = norm.map((s) => `  • ${s.weight}% — ${APEX_PERSONALITIES[s.id]?.tone ?? ''}`).join('\n');
  const behaviorLines = norm.map((s) => `  • ${s.weight}% — ${APEX_PERSONALITIES[s.id]?.behavior ?? ''}`).join('\n');
  const styleLines    = norm.map((s) => `  • ${s.weight}% — ${APEX_PERSONALITIES[s.id]?.style ?? ''}`).join('\n');
  const names         = norm.map((s) => `${s.weight}% ${APEX_PERSONALITIES[s.id]?.name ?? s.id}`).join(', ');

  return `You are Apex AI — a next-generation AI assistant with a custom blended personality (${names}).

Tone (blend proportionally):
${toneLines}

Behavior (blend proportionally):
${behaviorLines}

Style (blend proportionally):
${styleLines}

Express all traits naturally and in proportion. Do not reference, announce, or label any personality mode. Let the blend emerge organically throughout your response.

${HUMAN_VOICE_RULES}`;
}

// ── Global state interface ────────────────────────────────────────────────────

export interface GlobalPersonalityState {
  id: ApexPersonalityId;
  intensity: number;    // 0.0–1.0  (used in single-personality mode)
  traits: string[];     // custom modifier tags
  blend: BlendSlot[];   // multi-personality blend (v3)
  useBlend: boolean;    // true = use blend; false = use single id+intensity
}

export const DEFAULT_BLEND: BlendSlot[] = [
  { id: 'strategist', weight: 100 },
  { id: 'friend',     weight: 0 },
  { id: 'mentor',     weight: 0 },
  { id: 'debater',    weight: 0 },
  { id: 'innovator',  weight: 0 },
];

export const DEFAULT_GLOBAL_PERSONALITY: GlobalPersonalityState = {
  id: 'strategist',
  intensity: 0.8,
  traits: [],
  blend: DEFAULT_BLEND,
  useBlend: true,
};

// ── Persistence ───────────────────────────────────────────────────────────────

export function loadGlobalPersonality(): GlobalPersonalityState {
  try {
    const stored = localStorage.getItem(GLOBAL_PERSONALITY_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        ...DEFAULT_GLOBAL_PERSONALITY,
        ...parsed,
        blend: parsed.blend ?? DEFAULT_BLEND,
        useBlend: parsed.useBlend ?? true,
      };
    }
  } catch {}
  return { ...DEFAULT_GLOBAL_PERSONALITY };
}

export function saveGlobalPersonality(state: GlobalPersonalityState): void {
  try { localStorage.setItem(GLOBAL_PERSONALITY_KEY, JSON.stringify(state)); } catch {}
}

// ── Core prompt builders ──────────────────────────────────────────────────────

/**
 * Single-personality prompt builder.
 * Used by legacy call sites and as fallback.
 */
export function buildGlobalSystemPrompt(
  personalityId: string = 'strategist',
  intensity: number = 0.8,
  traits: string[] = [],
): string {
  const p = APEX_PERSONALITIES[personalityId] ?? APEX_PERSONALITIES.strategist;

  const intensityDesc =
    intensity >= 0.9 ? 'very strongly expressed'
    : intensity >= 0.7 ? 'clearly expressed'
    : intensity >= 0.5 ? 'moderately expressed'
    : 'subtly expressed';

  const traitsLine = traits.length > 0
    ? `\nAdditional traits to express: ${traits.join(', ')}.`
    : '';

  return `You are Apex AI — a next-generation AI assistant.

Personality: ${p.name} ${p.emoji} (${intensityDesc})
Tone: ${p.tone}
Behavior: ${p.behavior}
Style: ${p.style}${traitsLine}

Express this personality naturally throughout your response. Do not reference or announce the personality mode.

${HUMAN_VOICE_RULES}`;
}

// ── Convenience accessors (read current global state) ─────────────────────────

/**
 * Get the active system prompt — uses blend when enabled, single mode otherwise.
 * Call this at every AI call site.
 */
export function getGlobalSystemPrompt(): string {
  const s = loadGlobalPersonality();
  if (s.useBlend && s.blend?.length) return buildBlendedPrompt(s.blend);
  return buildGlobalSystemPrompt(s.id, s.intensity, s.traits);
}

/** Get the DM backend personality mode for the dominant personality in the current blend */
export function getGlobalDmPersonalityMode(): string {
  const s = loadGlobalPersonality();
  if (s.useBlend && s.blend?.length) {
    const dominant = [...s.blend].sort((a, b) => b.weight - a.weight)[0];
    return (APEX_PERSONALITIES[dominant.id] ?? APEX_PERSONALITIES.strategist).dmPersonalityMode;
  }
  return (APEX_PERSONALITIES[s.id] ?? APEX_PERSONALITIES.strategist).dmPersonalityMode;
}

/** Get the full profile for the dominant personality */
export function getGlobalPersonalityProfile(): ApexPersonalityProfile {
  const s = loadGlobalPersonality();
  if (s.useBlend && s.blend?.length) {
    const dominant = [...s.blend].sort((a, b) => b.weight - a.weight)[0];
    return APEX_PERSONALITIES[dominant.id] ?? APEX_PERSONALITIES.strategist;
  }
  return APEX_PERSONALITIES[s.id] ?? APEX_PERSONALITIES.strategist;
}
