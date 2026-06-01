/**
 * Apex Referral System
 * Earn feature unlocks by sharing Apex with friends.
 *
 * Storage:
 *   apex_referral_code    — user's unique share code
 *   apex_referral_count   — how many friends have joined via their link
 *   apex_referral_unlocks — Set of featureIds unlocked via referrals
 */

const CODE_KEY    = "apex_referral_code";
const COUNT_KEY   = "apex_referral_count";
const UNLOCKS_KEY = "apex_referral_unlocks";

// How many referrals unlock each feature
const UNLOCK_THRESHOLDS: Record<string, number> = {
  battleMode:  2,
  workflows:   3,
  avatarVoice: 2,
  marketplace: 1,
  apexOs:      5,
};

// ── Code generation ────────────────────────────────────────────────────────────

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "APEX";
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function getReferralCode(): string {
  try {
    let code = localStorage.getItem(CODE_KEY);
    if (!code) {
      code = generateCode();
      localStorage.setItem(CODE_KEY, code);
    }
    return code;
  } catch {
    return "APEX00000";
  }
}

// ── Count management ───────────────────────────────────────────────────────────

export function getReferralCount(): number {
  try {
    return parseInt(localStorage.getItem(COUNT_KEY) ?? "0", 10) || 0;
  } catch {
    return 0;
  }
}

/** Simulate receiving a new referral (called when someone joins via your link) */
export function incrementReferralCount(): number {
  const next = getReferralCount() + 1;
  try { localStorage.setItem(COUNT_KEY, String(next)); } catch { /* ignore */ }
  return next;
}

/** Dev helper — add N referrals instantly */
export function addTestReferrals(n: number): void {
  try { localStorage.setItem(COUNT_KEY, String(getReferralCount() + n)); } catch { /* ignore */ }
}

// ── Unlock logic ───────────────────────────────────────────────────────────────

function getUnlockSet(): Set<string> {
  try {
    const raw = localStorage.getItem(UNLOCKS_KEY);
    return new Set<string>(raw ? JSON.parse(raw) as string[] : []);
  } catch {
    return new Set<string>();
  }
}

function saveUnlockSet(set: Set<string>): void {
  try { localStorage.setItem(UNLOCKS_KEY, JSON.stringify([...set])); } catch { /* ignore */ }
}

export function getUnlockThreshold(featureId: string): number {
  return UNLOCK_THRESHOLDS[featureId] ?? 3;
}

/** Returns true if the feature has been unlocked via referrals */
export function isReferralUnlocked(featureId: string): boolean {
  return getUnlockSet().has(featureId);
}

/**
 * Try to unlock a feature using accumulated referral count.
 * Returns `true` if the feature is now unlocked.
 */
export function tryUnlockViaReferral(featureId: string): boolean {
  const count     = getReferralCount();
  const threshold = getUnlockThreshold(featureId);
  if (count >= threshold) {
    const set = getUnlockSet();
    set.add(featureId);
    saveUnlockSet(set);
    return true;
  }
  return false;
}

// ── Referral URL helpers ───────────────────────────────────────────────────────

export function getReferralUrl(featureId?: string): string {
  const code   = getReferralCode();
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const base   = import.meta.env.BASE_URL ?? "/";
  const path   = featureId ? `/${featureId}` : "";
  return `${origin}${base}${path}?ref=${code}`;
}

export function getShareText(featureName: string): string {
  return `I'm using ${featureName} on Apex — the AI hub built different. Join me and we both get early access: `;
}

// ── Incoming referral processing ───────────────────────────────────────────────

/**
 * Call on app load to process incoming ?ref= param.
 * Records that a referral came in (for the referrer's count on the server).
 * In a real system this would call the API; here we just log it.
 */
export function processIncomingReferral(): void {
  try {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const ref    = params.get("ref");
    if (!ref) return;
    // Store which code referred this user
    sessionStorage.setItem("apex_referred_by", ref);
    // Remove from URL without reload
    const url = new URL(window.location.href);
    url.searchParams.delete("ref");
    window.history.replaceState({}, "", url.toString());
  } catch { /* ignore */ }
}
