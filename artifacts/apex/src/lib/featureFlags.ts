/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  APEX LAUNCH PHASE CONTROL SYSTEM                                ║
 * ║  Controls feature rollout across phases without code changes.    ║
 * ║                                                                  ║
 * ║  Admin overrides (browser console):                              ║
 * ║    window.setPhase("phase_2")   — advance to phase 2            ║
 * ║    window.getPhase()            — see current phase             ║
 * ║    window.resetPhase()          — clear override, use default   ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

// ── Phase types ────────────────────────────────────────────────────────────────

export type LaunchPhase = 'phase_1' | 'phase_2' | 'phase_3';

/**
 * 🚀 DEFAULT PHASE — change this single value to advance the base rollout.
 *   phase_1:  Core only  — Chat, DMs, Feed, Profile, Studio
 *   phase_2:  + Battle Arena, Avatar Voice Studio
 *   phase_3:  + AI Workflows, Marketplace, Apex OS
 *
 *   Runtime override: window.setPhase("phase_2")  (persisted to localStorage)
 */
const DEFAULT_PHASE: LaunchPhase = 'phase_1';

// ── Feature access map ─────────────────────────────────────────────────────────
// Cumulative: features enabled in phase_1 remain enabled in phase_2 & phase_3.
// Later phases only need to list features being ADDED (set true) or REMOVED (set false).

export const FEATURE_ACCESS: Record<LaunchPhase, Partial<Record<string, boolean>>> = {
  phase_1: {
    // Core features — always on
    chat:        true,
    dm:          true,
    feed:        true,
    profile:     true,
    studio:      true,
    marketplace: true,   // unlocked — users can browse & run AI projects
    // Gated features — off at launch
    battleMode:  false,
    avatarVoice: false,
    workflows:   false,
    apexOs:      false,
  },
  phase_2: {
    // Unlocked in phase 2
    battleMode:  true,
    avatarVoice: true,
  },
  phase_3: {
    // Unlocked in phase 3
    workflows:   true,
    marketplace: true,
    apexOs:      true,
  },
};

// ── Phase ordering ─────────────────────────────────────────────────────────────

const PHASE_ORDER: LaunchPhase[] = ['phase_1', 'phase_2', 'phase_3'];
const STORAGE_KEY = 'apex_launch_phase';

// ── Active phase resolution ────────────────────────────────────────────────────

function getActivePhase(): LaunchPhase {
  try {
    const override = localStorage.getItem(STORAGE_KEY) as LaunchPhase | null;
    if (override && PHASE_ORDER.includes(override)) return override;
  } catch { /* SSR or no localStorage */ }
  return DEFAULT_PHASE;
}

/**
 * Returns true when the feature is enabled in the current launch phase.
 * Folds cumulative access: a feature enabled in phase_1 stays enabled in phase_2+.
 * Unknown feature IDs default to OPEN (new features don't get accidentally locked).
 */
export function isFeatureEnabled(featureId: string): boolean {
  const phase      = getActivePhase();
  const phaseIndex = PHASE_ORDER.indexOf(phase);

  let enabled: boolean | undefined;
  for (let i = 0; i <= phaseIndex; i++) {
    const val = FEATURE_ACCESS[PHASE_ORDER[i]][featureId];
    if (val !== undefined) enabled = val;
  }

  return enabled ?? true;
}

/** Backward-compatible alias — prefer isFeatureEnabled() for new code. */
export function isFeatureUnlocked(featureId: string): boolean {
  return isFeatureEnabled(featureId);
}

// ── Exported current phase (reactive-ish — reads localStorage) ─────────────────

export function getCurrentPhase(): LaunchPhase {
  return getActivePhase();
}

/**
 * Legacy alias.  Reading CURRENT_LAUNCH_PHASE at module import time won't
 * reflect runtime overrides; prefer getCurrentPhase() instead.
 */
export const CURRENT_LAUNCH_PHASE: LaunchPhase = DEFAULT_PHASE;

// ── Admin console override ─────────────────────────────────────────────────────

if (typeof window !== 'undefined') {
  const consoleApi = window as unknown as Record<string, unknown>;

  consoleApi.setPhase = (phase: string) => {
    if (!PHASE_ORDER.includes(phase as LaunchPhase)) {
      console.warn(
        `[Apex] Unknown phase: "${phase}". Valid values: ${PHASE_ORDER.join(', ')}`
      );
      return;
    }
    localStorage.setItem(STORAGE_KEY, phase);
    console.info(`%c[Apex] Phase → "${phase}" ✓  Reloading...`, 'color:#A29BFE;font-weight:bold');
    window.location.reload();
  };

  consoleApi.getPhase = () => {
    const p = getActivePhase();
    console.info(`%c[Apex] Current phase: "${p}"`, 'color:#A29BFE;font-weight:bold');
    return p;
  };

  consoleApi.resetPhase = () => {
    localStorage.removeItem(STORAGE_KEY);
    console.info(`%c[Apex] Phase reset to default: "${DEFAULT_PHASE}". Reloading...`, 'color:#4ADE80;font-weight:bold');
    window.location.reload();
  };
}

// ── Feature visibility phases (for ComingSoon overlays) ───────────────────────

export type FeaturePhase = 'coming_soon' | 'rolling_out' | 'early_access' | 'beta' | 'live';

export interface FeatureConfig {
  id:           string;
  name:         string;
  tagline:      string;
  hype:         string;
  description:  string;
  icon:         string;
  gradient:     [string, string];
  borderColors: [string, string, string];
  accentColor:  string;
  phase:        FeaturePhase;
  readiness:    number;
  launchDate:   Date;
  /** Which launch phase unlocks this feature */
  unlocksAt:    LaunchPhase;
}

// ── Feature definitions ───────────────────────────────────────────────────────

export const FEATURES: Record<string, FeatureConfig> = {

  battleMode: {
    id:           'battleMode',
    name:         'AI Battle Arena',
    tagline:      'Early Access',
    hype:         'Battle Arena is almost ready',
    description:  'Pit GPT-4, Claude, and Perplexity against each other in real-time head-to-head battles. Vote on the best response and shape your personal AI rankings.',
    icon:         '⚔️',
    gradient:     ['#EF4444', '#DC2626'],
    borderColors: ['#EF4444', '#F97316', '#A855F7'],
    accentColor:  '#EF4444',
    phase:        'early_access',
    readiness:    78,
    launchDate:   new Date('2026-05-15'),
    unlocksAt:    'phase_2',
  },

  workflows: {
    id:           'workflows',
    name:         'AI Workflows',
    tagline:      'Unlocking Soon',
    hype:         'Workflows are launching soon',
    description:  'Build powerful automated pipelines that chain AI models, triggers, and actions together — no code required. Ship automations in minutes.',
    icon:         '⚡',
    gradient:     ['#F59E0B', '#D97706'],
    borderColors: ['#F59E0B', '#EF4444', '#8B5CF6'],
    accentColor:  '#F59E0B',
    phase:        'coming_soon',
    readiness:    51,
    launchDate:   new Date('2026-06-20'),
    unlocksAt:    'phase_3',
  },

  marketplace: {
    id:           'marketplace',
    name:         'AI Marketplace',
    tagline:      'Rolling Out',
    hype:         'Marketplace is almost open',
    description:  'Discover, download, and publish community-built AI tools, characters, and workflows. The App Store for AI — curated and ready to use.',
    icon:         '🏪',
    gradient:     ['#10B981', '#059669'],
    borderColors: ['#10B981', '#06B6D4', '#6C5CE7'],
    accentColor:  '#10B981',
    phase:        'rolling_out',
    readiness:    88,
    launchDate:   new Date('2026-05-28'),
    unlocksAt:    'phase_3',
  },

  avatarVoice: {
    id:           'avatarVoice',
    name:         'Avatar Voice Studio',
    tagline:      'Early Access',
    hype:         'Your AI voice is nearly ready',
    description:  'Customize your AI avatar\'s voice, personality expression, and 3D animation style. Make Apex truly yours.',
    icon:         '🎭',
    gradient:     ['#EC4899', '#BE185D'],
    borderColors: ['#EC4899', '#A855F7', '#06B6D4'],
    accentColor:  '#EC4899',
    phase:        'early_access',
    readiness:    63,
    launchDate:   new Date('2026-05-20'),
    unlocksAt:    'phase_2',
  },

  apexOs: {
    id:           'apexOs',
    name:         'Apex OS',
    tagline:      'Coming Soon',
    hype:         'A new AI OS is taking shape',
    description:  'A full AI-native operating interface — widgets, multi-window chat, and a personalized AI dashboard that lives on your home screen.',
    icon:         '🖥️',
    gradient:     ['#6C5CE7', '#4C51BF'],
    borderColors: ['#6C5CE7', '#A29BFE', '#FD79A8'],
    accentColor:  '#6C5CE7',
    phase:        'coming_soon',
    readiness:    34,
    launchDate:   new Date('2026-07-01'),
    unlocksAt:    'phase_3',
  },

};

// ── Display helpers ───────────────────────────────────────────────────────────

export const PHASE_LABELS: Record<FeaturePhase, string> = {
  coming_soon:  'Coming Soon',
  rolling_out:  'Rolling Out',
  early_access: 'Early Access',
  beta:         'Now in Beta',
  live:         'Live',
};

export const PHASE_COLORS: Record<FeaturePhase, { bg: string; border: string; text: string }> = {
  coming_soon:  { bg: 'rgba(108,92,231,0.15)', border: 'rgba(108,92,231,0.30)', text: '#A29BFE' },
  rolling_out:  { bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.30)', text: '#10B981' },
  early_access: { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.30)', text: '#F59E0B' },
  beta:         { bg: 'rgba(59,130,246,0.15)',  border: 'rgba(59,130,246,0.30)',  text: '#60A5FA' },
  live:         { bg: 'rgba(74,222,128,0.15)',  border: 'rgba(74,222,128,0.30)',  text: '#4ADE80' },
};

// ── Phase display info ────────────────────────────────────────────────────────

export const LAUNCH_PHASE_INFO: Record<LaunchPhase, { label: string; description: string; color: string }> = {
  phase_1: {
    label:       'Phase 1 — Core',
    description: 'Chat, DMs, Feed, Profile, Studio',
    color:       '#6C5CE7',
  },
  phase_2: {
    label:       'Phase 2 — Arena',
    description: '+ Battle Arena, Avatar Voice Studio',
    color:       '#EF4444',
  },
  phase_3: {
    label:       'Phase 3 — Full Launch',
    description: '+ Workflows, Marketplace, Apex OS',
    color:       '#10B981',
  },
};
