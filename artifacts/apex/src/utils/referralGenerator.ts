/**
 * Viral Launch System — Referral Generator & Waitlist Store
 * All data stored in localStorage. Zero backend required.
 */

const KEY_WAITLIST  = "apex_viral_waitlist";   // { [featureId]: WaitlistEntry }
const KEY_JOINED    = "apex_viral_joined";     // string[] — featureIds user has joined
const KEY_REFERRALS = "apex_viral_refs";       // { [featureId]: number } — referral count

export interface WaitlistEntry {
  featureId:     string;
  name:          string;
  email:         string;
  joinedAt:      number;
  referralCode:  string;
  referralCount: number;
  position:      number;  // raw position number
  totalSize:     number;  // total waitlist size at time of joining
}

// ── Deterministic base sizes per feature ──────────────────────────────────────
const BASE_SIZES: Record<string, number> = {
  "autopilot":        15_840,
  "workflows":        12_291,
  "game-studio":       9_402,
  "multiplayer-fps":  11_037,
  "mobile-fps":        8_614,
  "unity-gen":         7_288,
  "marketplace":      18_553,
  "monetization":      6_990,
  "social":           14_225,
  "referral":         13_108,
  "self-improve":      8_472,
  "plugins":           7_631,
  "privacy":          10_887,
  "memory-control":   11_340,
  "personality-reset": 6_819,
  "analytics":         9_066,
  "game-publish":      7_904,
};

// Growth rates: people-per-hour added to the counter
const GROWTH_RATES: Record<string, number> = {
  "autopilot":        38,
  "workflows":        29,
  "marketplace":      47,
  "social":           35,
  "referral":         32,
  "multiplayer-fps":  28,
  "game-studio":      22,
  "privacy":          26,
  "memory-control":   24,
  "analytics":        20,
  "mobile-fps":       18,
  "unity-gen":        16,
  "monetization":     15,
  "self-improve":     14,
  "plugins":          12,
  "personality-reset":11,
  "game-publish":     17,
};

// Epoch start (April 1 2026 00:00 UTC)
const EPOCH = 1743465600_000;

export function getTotalWaitlist(featureId: string): number {
  const base = BASE_SIZES[featureId] ?? 8_000;
  const rate = GROWTH_RATES[featureId] ?? 15;
  const hoursElapsed = Math.max(0, (Date.now() - EPOCH) / 3_600_000);
  return Math.floor(base + hoursElapsed * rate);
}

// ── Referral code generation ──────────────────────────────────────────────────

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateReferralCode(): string {
  let code = "APX-";
  for (let i = 0; i < 6; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

// ── Position helpers ──────────────────────────────────────────────────────────

function randomPosition(total: number): number {
  // Put user somewhere in top 15–55% of the waitlist (feels good but not too easy)
  const percentile = 0.15 + Math.random() * 0.40;
  return Math.max(1, Math.floor(total * percentile));
}

export function getPercentileAhead(position: number, total: number): number {
  // % of people this user is ahead of
  return Math.min(99, Math.round(((total - position) / total) * 100));
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

function loadStore(): Record<string, WaitlistEntry> {
  try { return JSON.parse(localStorage.getItem(KEY_WAITLIST) ?? "{}"); }
  catch { return {}; }
}

function saveStore(store: Record<string, WaitlistEntry>): void {
  localStorage.setItem(KEY_WAITLIST, JSON.stringify(store));
}

export function getWaitlistEntry(featureId: string): WaitlistEntry | null {
  return loadStore()[featureId] ?? null;
}

export function hasJoined(featureId: string): boolean {
  try {
    const joined: string[] = JSON.parse(localStorage.getItem(KEY_JOINED) ?? "[]");
    return joined.includes(featureId);
  } catch { return false; }
}

export function joinWaitlist(
  featureId: string,
  email: string,
  name: string,
): WaitlistEntry {
  const total    = getTotalWaitlist(featureId);
  const position = randomPosition(total);
  const entry: WaitlistEntry = {
    featureId,
    name,
    email,
    joinedAt:      Date.now(),
    referralCode:  generateReferralCode(),
    referralCount: 0,
    position,
    totalSize:     total,
  };

  const store = loadStore();
  store[featureId] = entry;
  saveStore(store);

  try {
    const joined: string[] = JSON.parse(localStorage.getItem(KEY_JOINED) ?? "[]");
    if (!joined.includes(featureId)) {
      localStorage.setItem(KEY_JOINED, JSON.stringify([...joined, featureId]));
    }
  } catch { /* noop */ }

  return entry;
}

export function addReferral(featureId: string): WaitlistEntry | null {
  const store = loadStore();
  const entry  = store[featureId];
  if (!entry) return null;

  entry.referralCount += 1;
  // Each referral moves the user up by 3–8% of remaining gap to position 1
  const gap   = entry.position - 1;
  const boost = Math.max(50, Math.floor(gap * (0.03 + Math.random() * 0.05)));
  entry.position = Math.max(1, entry.position - boost);

  saveStore(store);
  return entry;
}

export function getShareUrl(): string {
  const base = typeof window !== "undefined"
    ? window.location.origin + window.location.pathname.replace(/\/$/, "")
    : "https://apex.app";
  return `${base}/apex-features`;
}

export function buildShareText(referralCode: string): string {
  return `Apex is dropping insane AI features soon. I just got early access 🔥\n\nUse my code ${referralCode} to move up the list:\n${getShareUrl()}`;
}
