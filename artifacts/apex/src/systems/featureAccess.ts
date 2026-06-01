/**
 * Apex Feature Access System
 * Manages the LOCKED → PREVIEW → EARLY ACCESS → LIVE state machine.
 * Everything runs from localStorage. Zero backend required.
 *
 * State priority:
 *   1. Developer panel overrides (highest)
 *   2. Computed state from referrals + waitlist percentile
 *   3. Default state for each feature
 */

export type FeatureState = "locked" | "preview" | "early" | "live";

export interface FeatureConfig {
  defaultState:       FeatureState;
  route:              string | null;    // navigation target for early/live
  refsForPreview:     number;           // referrals to go locked → preview
  refsForEarly:       number;           // referrals to go preview → early
  refsForLive:        number;           // referrals to go early → live
  waitlistForEarly:   number;           // top X% of waitlist needed for early
  waitlistForLive:    number;           // top X% for live
  nextAction:         string;           // human-readable unlock hint
}

const STORAGE_OVERRIDES = "apex_feature_overrides"; // { [id]: FeatureState }

// ── Per-feature config ────────────────────────────────────────────────────────

export const FEATURE_CONFIGS: Record<string, FeatureConfig> = {
  marketplace: {
    defaultState: "live",   route: "/marketplace",
    refsForPreview: 0, refsForEarly: 0, refsForLive: 0,
    waitlistForEarly: 0, waitlistForLive: 0,
    nextAction: "Already live. Open it now!",
  },
  social: {
    defaultState: "early",  route: "/feed",
    refsForPreview: 0, refsForEarly: 0, refsForLive: 5,
    waitlistForEarly: 0, waitlistForLive: 88,
    nextAction: "Invite 5 friends to unlock full social features",
  },
  workflows: {
    defaultState: "early",  route: "/workflows",
    refsForPreview: 0, refsForEarly: 0, refsForLive: 5,
    waitlistForEarly: 0, waitlistForLive: 88,
    nextAction: "Invite 5 friends to unlock the full workflow builder",
  },
  referral: {
    defaultState: "early",  route: null,
    refsForPreview: 0, refsForEarly: 0, refsForLive: 8,
    waitlistForEarly: 0, waitlistForLive: 90,
    nextAction: "Invite 8 friends to unlock the full referral suite",
  },
  autopilot: {
    defaultState: "preview", route: null,
    refsForPreview: 0, refsForEarly: 3, refsForLive: 8,
    waitlistForEarly: 68, waitlistForLive: 90,
    nextAction: "Invite 3 friends OR reach top 32% of waitlist",
  },
  "game-studio": {
    defaultState: "preview", route: null,
    refsForPreview: 0, refsForEarly: 3, refsForLive: 10,
    waitlistForEarly: 68, waitlistForLive: 92,
    nextAction: "Invite 3 friends to get early access to Game Studio",
  },
  privacy: {
    defaultState: "preview", route: null,
    refsForPreview: 0, refsForEarly: 2, refsForLive: 6,
    waitlistForEarly: 62, waitlistForLive: 85,
    nextAction: "Invite 2 friends to unlock Privacy Mode early",
  },
  "memory-control": {
    defaultState: "preview", route: null,
    refsForPreview: 0, refsForEarly: 2, refsForLive: 6,
    waitlistForEarly: 62, waitlistForLive: 85,
    nextAction: "Invite 2 friends to unlock Memory Control early",
  },
  "multiplayer-fps": {
    defaultState: "locked", route: null,
    refsForPreview: 2, refsForEarly: 7, refsForLive: 15,
    waitlistForEarly: 78, waitlistForLive: 94,
    nextAction: "Invite 2 friends to preview the Multiplayer FPS system",
  },
  "mobile-fps": {
    defaultState: "locked", route: null,
    refsForPreview: 2, refsForEarly: 7, refsForLive: 15,
    waitlistForEarly: 78, waitlistForLive: 94,
    nextAction: "Invite 2 friends to unlock the Mobile FPS Client preview",
  },
  "unity-gen": {
    defaultState: "locked", route: null,
    refsForPreview: 1, refsForEarly: 5, refsForLive: 12,
    waitlistForEarly: 73, waitlistForLive: 91,
    nextAction: "Invite 1 friend to preview Unity Game Generation",
  },
  monetization: {
    defaultState: "locked", route: null,
    refsForPreview: 1, refsForEarly: 5, refsForLive: 12,
    waitlistForEarly: 73, waitlistForLive: 91,
    nextAction: "Invite 1 friend to preview the Monetization System",
  },
  "self-improve": {
    defaultState: "locked", route: null,
    refsForPreview: 1, refsForEarly: 5, refsForLive: 12,
    waitlistForEarly: 73, waitlistForLive: 91,
    nextAction: "Invite 1 friend to preview AI Self-Improvement",
  },
  plugins: {
    defaultState: "locked", route: null,
    refsForPreview: 2, refsForEarly: 6, refsForLive: 14,
    waitlistForEarly: 76, waitlistForLive: 92,
    nextAction: "Invite 2 friends to preview the Plugin system",
  },
  "personality-reset": {
    defaultState: "locked", route: null,
    refsForPreview: 1, refsForEarly: 4, refsForLive: 10,
    waitlistForEarly: 70, waitlistForLive: 90,
    nextAction: "Invite 1 friend to preview Personality Reset",
  },
  analytics: {
    defaultState: "locked", route: null,
    refsForPreview: 1, refsForEarly: 4, refsForLive: 10,
    waitlistForEarly: 70, waitlistForLive: 90,
    nextAction: "Invite 1 friend to preview the Analytics Dashboard",
  },
  "game-publish": {
    defaultState: "locked", route: null,
    refsForPreview: 1, refsForEarly: 5, refsForLive: 12,
    waitlistForEarly: 73, waitlistForLive: 91,
    nextAction: "Invite 1 friend to preview Game Publishing",
  },
};

// ── State helpers ─────────────────────────────────────────────────────────────

function loadOverrides(): Record<string, FeatureState> {
  try { return JSON.parse(localStorage.getItem(STORAGE_OVERRIDES) ?? "{}"); }
  catch { return {}; }
}

export function setDevOverride(featureId: string, state: FeatureState): void {
  const overrides = loadOverrides();
  overrides[featureId] = state;
  localStorage.setItem(STORAGE_OVERRIDES, JSON.stringify(overrides));
  // Notify listeners
  window.dispatchEvent(new CustomEvent("apex:statechange", { detail: { featureId, state } }));
}

export function clearDevOverrides(): void {
  localStorage.removeItem(STORAGE_OVERRIDES);
  window.dispatchEvent(new CustomEvent("apex:statechange", { detail: { featureId: "all", state: null } }));
}

export function getDevOverride(featureId: string): FeatureState | null {
  return loadOverrides()[featureId] ?? null;
}

// ── Referral data reader ──────────────────────────────────────────────────────

function getTotalReferrals(): number {
  try {
    const store: Record<string, { referralCount?: number }> =
      JSON.parse(localStorage.getItem("apex_viral_waitlist") ?? "{}");
    return Object.values(store).reduce((s, e) => s + (e.referralCount ?? 0), 0);
  } catch { return 0; }
}

function getBestWaitlistPercentile(featureId: string): number {
  try {
    const store: Record<string, { position?: number; totalSize?: number }> =
      JSON.parse(localStorage.getItem("apex_viral_waitlist") ?? "{}");
    const entry = store[featureId];
    if (!entry || !entry.position || !entry.totalSize) return 0;
    return Math.round(((entry.totalSize - entry.position) / entry.totalSize) * 100);
  } catch { return 0; }
}

// ── Main state resolver ───────────────────────────────────────────────────────

export function getFeatureState(featureId: string): FeatureState {
  // 1. Dev override wins
  const override = getDevOverride(featureId);
  if (override) return override;

  const cfg = FEATURE_CONFIGS[featureId];
  if (!cfg) return "locked";

  const totalRefs  = getTotalReferrals();
  const pctAhead   = getBestWaitlistPercentile(featureId);

  // Compute best possible state from earned access
  let earned: FeatureState = cfg.defaultState;

  if (
    (cfg.refsForPreview > 0 && totalRefs >= cfg.refsForPreview)
  ) {
    if (earned === "locked") earned = "preview";
  }
  if (
    totalRefs >= cfg.refsForEarly  ||
    (cfg.waitlistForEarly > 0 && pctAhead >= cfg.waitlistForEarly)
  ) {
    if (earned === "locked" || earned === "preview") earned = "early";
  }
  if (
    cfg.refsForLive > 0 &&
    (totalRefs >= cfg.refsForLive ||
      (cfg.waitlistForLive > 0 && pctAhead >= cfg.waitlistForLive))
  ) {
    earned = "live";
  }

  // Never downgrade past the feature's default state
  const ORDER: FeatureState[] = ["locked", "preview", "early", "live"];
  const dfIdx = ORDER.indexOf(cfg.defaultState);
  const erIdx = ORDER.indexOf(earned);
  return ORDER[Math.max(dfIdx, erIdx)] as FeatureState;
}

/** Returns 0–100 progress toward the next unlock state. */
export function getUnlockProgress(featureId: string): {
  progress:   number;
  label:      string;
  nextState:  FeatureState | null;
  hint:       string;
} {
  const cfg       = FEATURE_CONFIGS[featureId];
  if (!cfg) return { progress: 0, label: "0%", nextState: null, hint: "" };

  const current   = getFeatureState(featureId);
  const totalRefs = getTotalReferrals();
  const pctAhead  = getBestWaitlistPercentile(featureId);

  let targetRefs  = 0;
  let nextState: FeatureState | null = null;

  switch (current) {
    case "locked":
      nextState  = "preview";
      targetRefs = cfg.refsForPreview || cfg.refsForEarly;
      break;
    case "preview":
      nextState  = "early";
      targetRefs = cfg.refsForEarly;
      break;
    case "early":
      nextState  = "live";
      targetRefs = cfg.refsForLive;
      break;
    case "live":
      return { progress: 100, label: "100%", nextState: null, hint: "Fully live!" };
  }

  if (!targetRefs) return { progress: 100, label: "100%", nextState, hint: cfg.nextAction };

  const refProgress     = Math.min(100, (totalRefs / targetRefs) * 100);
  const waitlistNeeded  = current === "preview" ? cfg.waitlistForEarly : cfg.waitlistForLive;
  const waitProgress    = waitlistNeeded > 0 ? Math.min(100, (pctAhead / waitlistNeeded) * 100) : 0;
  const progress        = Math.round(Math.max(refProgress, waitProgress));

  const remaining       = Math.max(0, targetRefs - totalRefs);
  const hint            = remaining > 0
    ? `Invite ${remaining} more friend${remaining !== 1 ? "s" : ""} to unlock ${nextState === "early" ? "Early Access" : nextState === "live" ? "full release" : "preview"}`
    : cfg.nextAction;

  return { progress, label: `${progress}%`, nextState, hint };
}

// ── State metadata ────────────────────────────────────────────────────────────

export interface StateMeta {
  label:   string;
  icon:    string;
  color:   string;
  bg:      string;
  border:  string;
  glow:    string;
  btnLabel: string;
}

export const STATE_META: Record<FeatureState, StateMeta> = {
  locked: {
    label:    "Locked",
    icon:     "🔒",
    color:    "rgba(255,255,255,0.35)",
    bg:       "rgba(255,255,255,0.06)",
    border:   "rgba(255,255,255,0.12)",
    glow:     "transparent",
    btnLabel: "Coming Soon",
  },
  preview: {
    label:    "Preview",
    icon:     "👁",
    color:    "#F59E0B",
    bg:       "rgba(245,158,11,0.12)",
    border:   "rgba(245,158,11,0.30)",
    glow:     "rgba(245,158,11,0.20)",
    btnLabel: "Preview",
  },
  early: {
    label:    "Early Access",
    icon:     "⚡",
    color:    "#A29BFE",
    bg:       "rgba(162,155,254,0.14)",
    border:   "rgba(162,155,254,0.35)",
    glow:     "rgba(162,155,254,0.25)",
    btnLabel: "Try Now",
  },
  live: {
    label:    "Live",
    icon:     "✅",
    color:    "#4ADE80",
    bg:       "rgba(74,222,128,0.12)",
    border:   "rgba(74,222,128,0.35)",
    glow:     "rgba(74,222,128,0.22)",
    btnLabel: "Open",
  },
};
