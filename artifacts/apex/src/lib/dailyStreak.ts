/**
 * The 7-day streak, kept on the server per account.
 * A day counts the first time the signed-in user interacts with the app (tap, click or key) that day.
 */
import { useEffect, useSyncExternalStore } from "react";
import { authHeaders, getAuthSessionId } from "@/lib/authSession";

export interface StreakState {
  streak: number;
  best: number;
  cycleDay: number;
  checkedInToday: boolean;
  rewards: { bonus: { day: number; messages: number; earned: boolean }; avatar: { day: number; earned: boolean } };
  earned: "bonus" | "avatar" | null;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const AVATAR_KEY = "apex_streak_avatar_look";

let state: StreakState | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Local calendar date, so the day rolls over at the user's own midnight. */
export function localDay(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function set(next: StreakState) {
  state = next;
  if (next.rewards.avatar.earned) {
    try { localStorage.setItem(AVATAR_KEY, "1"); } catch { /* private mode */ }
  }
  emit();
}

/** True once the Day 7 reward outfit has been earned on this device's account. */
export function hasStreakAvatarLook() {
  try { return localStorage.getItem(AVATAR_KEY) === "1"; } catch { return false; }
}

async function call(method: "GET" | "POST") {
  if (!getAuthSessionId()) return;
  const today = localDay();
  const res = await fetch(method === "GET" ? `${BASE}/api/streak?today=${today}` : `${BASE}/api/streak/checkin`, {
    method,
    headers: { ...authHeaders(), ...(method === "POST" ? { "Content-Type": "application/json" } : {}) },
    body: method === "POST" ? JSON.stringify({ today }) : undefined,
  }).catch(() => null);
  const json = await res?.json().catch(() => null);
  // A check-in that finished first has the newer state (and any reward just earned)
  if (res?.ok && json?.ok && (method === "POST" || !state)) set(json.data as StreakState);
}

let loaded = false;
let checkedDay = "";

/** Loads the streak once and counts today on the first interaction. Mount once near the app root. */
export function useStreakCheckin() {
  useEffect(() => {
    if (!loaded) { loaded = true; void call("GET"); }
    const onUse = () => {
      const today = localDay();
      if (checkedDay === today || !getAuthSessionId()) return;
      checkedDay = today;
      void call("POST");
    };
    window.addEventListener("pointerdown", onUse, true);
    window.addEventListener("keydown", onUse, true);
    return () => {
      window.removeEventListener("pointerdown", onUse, true);
      window.removeEventListener("keydown", onUse, true);
    };
  }, []);
}

export function useDailyStreak(): StreakState | null {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => state,
    () => state,
  );
}

/** Marks the "just earned" reward as seen. */
export function clearEarned() {
  if (state?.earned) set({ ...state, earned: null });
}
