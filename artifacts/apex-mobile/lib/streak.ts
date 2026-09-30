/**
 * The 7-day streak (kept on the server per account).
 * A day counts the first time the signed-in user touches the app that day.
 */
import { useSyncExternalStore } from "react";
import { streakApi, type StreakState } from "@/services/api";

let state: StreakState | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Local calendar date, so the day rolls over at the user's own midnight. */
export function localDay(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

let checkedDay = "";
let loading = false;

/** Fetches the streak the first time something shows it. */
export function loadStreak() {
  if (loading || state || !streakApi.signedIn()) return;
  loading = true;
  // A check-in that finished first has the newer state (and any reward just earned)
  streakApi.get(localDay()).then((s) => { if (!state) { state = s; emit(); } }).catch(() => undefined).finally(() => { loading = false; });
}

/** Call on any touch; only the first one each day reaches the server. */
export function checkInToday() {
  const today = localDay();
  if (checkedDay === today || !streakApi.signedIn()) return;
  checkedDay = today;
  streakApi.checkin(today).then((s) => { state = s; emit(); }).catch(() => { checkedDay = ""; });
}

export function clearEarned() {
  if (state?.earned) { state = { ...state, earned: null }; emit(); }
}

export function useStreak(): StreakState | null {
  return useSyncExternalStore(
    (l) => { listeners.add(l); loadStreak(); return () => listeners.delete(l); },
    () => state,
    () => state,
  );
}
