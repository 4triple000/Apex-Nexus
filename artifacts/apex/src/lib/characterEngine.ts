/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  APEX CHARACTER ENGINE — Persistent AI Identity System       ║
 * ║  Memory · Mood · Relationship · XP · Proactive Behavior      ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type CharacterMood =
  | 'neutral' | 'focused' | 'energized' | 'calm' | 'curious' | 'supportive';

export interface CharacterState {
  name: string;
  mood: CharacterMood;
  energy: number;             // 0.0–1.0
  relationshipLevel: number;  // float 1.0–10.0, grows with each interaction
  xp: number;                 // total XP earned
  lastInteraction: number | null;
  totalInteractions: number;
}

export interface MemoryStore {
  facts: string[];          // extracted facts about the user
  preferences: string[];    // user likes/dislikes
  goals: string[];          // user goals & intentions
  pastTopics: string[];     // recent conversation topics
  emotionalPatterns: string[]; // notable emotional moments
}

// ── Storage ───────────────────────────────────────────────────────────────────

const KEY_CHARACTER = 'apex_character_state';
const KEY_MEMORY    = 'apex_memory_store';

const DEFAULT_CHARACTER: CharacterState = {
  name: 'Apex',
  mood: 'neutral',
  energy: 0.8,
  relationshipLevel: 1.0,
  xp: 0,
  lastInteraction: null,
  totalInteractions: 0,
};

const DEFAULT_MEMORY: MemoryStore = {
  facts: [],
  preferences: [],
  goals: [],
  pastTopics: [],
  emotionalPatterns: [],
};

export function loadCharacterState(): CharacterState {
  try {
    const stored = localStorage.getItem(KEY_CHARACTER);
    if (stored) return { ...DEFAULT_CHARACTER, ...JSON.parse(stored) };
  } catch {}
  return { ...DEFAULT_CHARACTER };
}

export function saveCharacterState(state: CharacterState): void {
  try { localStorage.setItem(KEY_CHARACTER, JSON.stringify(state)); } catch {}
}

export function loadMemoryStore(): MemoryStore {
  try {
    const stored = localStorage.getItem(KEY_MEMORY);
    if (stored) return { ...DEFAULT_MEMORY, ...JSON.parse(stored) };
  } catch {}
  return { ...DEFAULT_MEMORY };
}

export function saveMemoryStore(store: MemoryStore): void {
  try { localStorage.setItem(KEY_MEMORY, JSON.stringify(store)); } catch {}
}

// ── XP / Level system ─────────────────────────────────────────────────────────

const XP_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2200, 3000, 4200, 6000];

export function getCharacterLevel(xp: number): number {
  for (let i = XP_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= XP_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}

export function getXpForLevel(level: number): number {
  return XP_THRESHOLDS[Math.min(level - 1, XP_THRESHOLDS.length - 1)] ?? 0;
}

export function getXpForNextLevel(level: number): number {
  const next = XP_THRESHOLDS[level]; // level is 1-indexed, so XP_THRESHOLDS[level] is the NEXT threshold
  return next ?? Infinity;
}

export function getLevelProgress(xp: number): number {
  const level   = getCharacterLevel(xp);
  const levelMin = getXpForLevel(level);
  const levelMax = getXpForNextLevel(level);
  if (levelMax === Infinity) return 1;
  return Math.min(1, (xp - levelMin) / (levelMax - levelMin));
}

export const LEVEL_LABELS: Record<number, string> = {
  1:  'Newcomer',
  2:  'Regular',
  3:  'Familiar',
  4:  'Companion',
  5:  'Trusted',
  6:  'Confidant',
  7:  'Partner',
  8:  'Inner Circle',
  9:  'Apex Bond',
  10: 'Legendary',
};

// ── Emotion / mood detection ───────────────────────────────────────────────────

export type UserEmotion = 'stressed' | 'excited' | 'frustrated' | 'curious' | 'neutral';

export function detectUserEmotion(text: string): UserEmotion {
  const l = text.toLowerCase();
  if (/stress|anxious|overwhelm|worried|nervous|panic|scared|afraid/.test(l)) return 'stressed';
  if (/excited|amazing|can't wait|pumped|hyped|fire|let'?s go|so ready/.test(l)) return 'excited';
  if (/frustrat|annoyed|ugh|hate this|terrible|awful|damn it|ridiculous/.test(l)) return 'frustrated';
  if (/why |how |what if|curious|wonder|explain|tell me|can you|what does/.test(l)) return 'curious';
  return 'neutral';
}

export function moodFromUserEmotion(userEmotion: UserEmotion): CharacterMood {
  switch (userEmotion) {
    case 'stressed':    return 'supportive';
    case 'frustrated':  return 'focused';
    case 'excited':     return 'energized';
    case 'curious':     return 'curious';
    default:            return 'neutral';
  }
}

export const MOOD_LABELS: Record<CharacterMood, string> = {
  neutral:    'Balanced',
  focused:    'Focused',
  energized:  'Energized',
  calm:       'Calm',
  curious:    'Curious',
  supportive: 'Supportive',
};

export const MOOD_EMOJI: Record<CharacterMood, string> = {
  neutral:    '😐',
  focused:    '🎯',
  energized:  '⚡',
  calm:       '😌',
  curious:    '🤔',
  supportive: '🤝',
};

// ── Memory extraction ──────────────────────────────────────────────────────────

const FACT_PATTERNS: RegExp[] = [
  /my name is (\w[\w\s]{0,30})/i,
  /i(?:'m| am) (?:a |an )?(\w[\w\s]{0,30})/i,
  /i work (?:at|in|as|for) ([\w\s]{3,40})/i,
  /i(?:'m| am) from ([\w\s]{3,30})/i,
  /i(?:'ve| have) been ([\w\s]{3,30}ing)/i,
  /i(?:'m| am) ([\d]{1,2}) years old/i,
];

const PREF_PATTERNS: RegExp[] = [
  /i (?:love|really like|prefer|enjoy|always use) ([\w\s]{3,40})/i,
  /i (?:hate|dislike|never use|can't stand|avoid) ([\w\s]{3,40})/i,
  /my favorite (?:thing|tool|language|framework|app) is ([\w\s]{2,30})/i,
];

const GOAL_PATTERNS: RegExp[] = [
  /i want to ([\w\s]{5,60})/i,
  /my goal is (?:to )?([\w\s]{5,60})/i,
  /i(?:'m| am) trying to ([\w\s]{5,60})/i,
  /i need to ([\w\s]{5,60})/i,
  /i(?:'d| would) like to ([\w\s]{5,60})/i,
  /i(?:'m| am) working on ([\w\s]{5,60})/i,
  /help me (?:to )?([\w\s]{5,60})/i,
];

function extractFrom(text: string, patterns: RegExp[]): string[] {
  const results: string[] = [];
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m?.[1]) {
      const val = m[1].trim().replace(/[.,!?]+$/, '').slice(0, 60);
      if (val.length > 2) results.push(val);
    }
  }
  return results;
}

export function extractMemory(
  userInput: string,
  _aiResponse: string,
  store: MemoryStore,
): MemoryStore {
  const newFacts = extractFrom(userInput, FACT_PATTERNS);
  const newPrefs = extractFrom(userInput, PREF_PATTERNS);
  const newGoals = extractFrom(userInput, GOAL_PATTERNS);
  const topic    = userInput.trim().split(/\s+/).slice(0, 7).join(' ');

  return {
    facts:            [...new Set([...newFacts,  ...store.facts])].slice(0, 20),
    preferences:      [...new Set([...newPrefs,  ...store.preferences])].slice(0, 20),
    goals:            [...new Set([...newGoals,  ...store.goals])].slice(0, 10),
    pastTopics:       [topic, ...store.pastTopics].slice(0, 20),
    emotionalPatterns: store.emotionalPatterns,
  };
}

// ── Prompt context injection ───────────────────────────────────────────────────

export function buildCharacterContext(
  state: CharacterState,
  memory: MemoryStore,
): string {
  const level     = getCharacterLevel(state.xp);
  const levelName = LEVEL_LABELS[level] ?? 'Regular';
  const parts: string[] = [
    `Current character mood: ${state.mood} — respond with matching emotional tone`,
    `Relationship level: ${levelName} (${state.relationshipLevel.toFixed(1)}/10) — adjust familiarity accordingly`,
  ];

  const memFacts  = memory.facts.slice(0, 4).join('; ');
  const memPrefs  = memory.preferences.slice(0, 3).join('; ');
  const memGoals  = memory.goals.slice(0, 2).join('; ');
  const lastTopic = memory.pastTopics[1]; // index 1 = previous topic (index 0 is current)

  if (memFacts)  parts.push(`Known facts about user: ${memFacts}`);
  if (memPrefs)  parts.push(`User preferences: ${memPrefs}`);
  if (memGoals)  parts.push(`User goals: ${memGoals}`);
  if (lastTopic && level >= 3) parts.push(`Previously discussed: "${lastTopic}"`);

  return `\n\n[Character Memory & Context]\n${parts.join('\n')}\n\nUse this context naturally — do not mention or list it. Let continuity show organically in your response.`;
}

// ── Proactive suggestions ─────────────────────────────────────────────────────

export function getProactiveSuggestions(
  state: CharacterState,
  memory: MemoryStore,
): string[] {
  const suggestions: string[] = [];
  const level     = getCharacterLevel(state.xp);
  const lastTopic = memory.pastTopics[0];

  if (lastTopic && level >= 2) {
    suggestions.push(`Continue: "${lastTopic.slice(0, 35).trim()}…"`);
  }
  if (memory.goals.length > 0 && level >= 2) {
    suggestions.push(`Work on: ${memory.goals[0].slice(0, 35).trim()}`);
  }
  if (level >= 3) {
    suggestions.push('⚔️ Start an AI Battle');
    suggestions.push('🔄 Build a workflow');
  }
  if (memory.preferences.length > 0 && level >= 4) {
    suggestions.push(`Explore: ${memory.preferences[0].slice(0, 30).trim()}`);
  }
  if (level >= 5) {
    suggestions.push('🧠 Deep dive together');
  }

  return suggestions.slice(0, 4);
}

// ── Memory CRUD helpers ───────────────────────────────────────────────────────

export function addMemoryItem(
  store: MemoryStore,
  category: keyof Omit<MemoryStore, 'emotionalPatterns'>,
  value: string,
): MemoryStore {
  const trimmed = value.trim();
  if (!trimmed) return store;
  const existing = store[category] as string[];
  if (existing.includes(trimmed)) return store;
  return { ...store, [category]: [trimmed, ...existing].slice(0, 25) };
}

export function updateMemoryItem(
  store: MemoryStore,
  category: keyof Omit<MemoryStore, 'emotionalPatterns'>,
  index: number,
  value: string,
): MemoryStore {
  const arr = [...(store[category] as string[])];
  arr[index] = value.trim();
  return { ...store, [category]: arr };
}

export function deleteMemoryItem(
  store: MemoryStore,
  category: keyof Omit<MemoryStore, 'emotionalPatterns'>,
  index: number,
): MemoryStore {
  const arr = (store[category] as string[]).filter((_, i) => i !== index);
  return { ...store, [category]: arr };
}

// ── XP gain calculator ────────────────────────────────────────────────────────

export function calculateXpGain(userInput: string): number {
  const base   = 10;
  const length = Math.floor(userInput.split(/\s+/).length / 5); // 1 XP per 5 words
  return Math.min(base + length, 30); // cap at 30 XP per interaction
}
