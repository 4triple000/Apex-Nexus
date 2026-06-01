/**
 * useGreeting — React hook wrapping greetingEngine.
 *
 * Returns the greeting text, category, animation state, and a
 * `triggerGreeting()` function that fires voice + avatar animation.
 *
 * Usage:
 *   const { text, category, animState, isPlaying, triggerGreeting } = useGreeting()
 *
 * Rules:
 *   • Skipped entirely for first-time users (FTUE handles them)
 *   • Shows once per browser session (sessionStorage guard)
 *   • Never repeats the same greeting twice in a row
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { greetingEngine, type AvatarAnimState, type GreetingResult } from "./greetingEngine";
import { loadCharacterState, loadMemoryStore } from "@/lib/characterEngine";

const SESSION_SHOWN_KEY = "apex_greeting_shown_v2";

function wasShownThisSession(): boolean {
  try { return sessionStorage.getItem(SESSION_SHOWN_KEY) === "1"; } catch { return false; }
}
function markShownThisSession() {
  try { sessionStorage.setItem(SESSION_SHOWN_KEY, "1"); } catch {}
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export interface UseGreetingResult {
  text:             string | null;
  category:         string | null;
  animState:        AvatarAnimState | null;
  isPlaying:        boolean;
  shouldShow:       boolean;
  triggerGreeting:  () => void;
  dismiss:          () => void;
}

export function useGreeting(): UseGreetingResult {
  const [greeting, setGreeting]   = useState<GreetingResult | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [animState, setAnimState] = useState<AvatarAnimState | null>(null);

  // Build the GreetingUser payload once from characterEngine data
  const user = useMemo(() => {
    const char   = loadCharacterState();
    const memory = loadMemoryStore();
    return {
      lastVisit:         char.lastInteraction ?? undefined,
      totalInteractions: char.totalInteractions,
      pastTopics:        memory.pastTopics ?? [],
      isFirstTime:       !localStorage.getItem("apex_onboarded"),
    };
  }, []);

  // On mount: skip first-timers and repeat sessions; pick greeting
  useEffect(() => {
    if (user.isFirstTime)       return;
    if (wasShownThisSession())  return;
    const result = greetingEngine.getGreeting(user);
    setGreeting(result);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // triggerGreeting — plays voice + drives anim state
  const triggerGreeting = useCallback(() => {
    if (!greeting) return;
    markShownThisSession();
    setIsPlaying(true);
    greetingEngine.triggerGreeting(user, {
      onAnimate: (state) => setAnimState(state),
      onDone:    () => setIsPlaying(false),
    });
    greeting.markSeen();
  }, [greeting, user]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    window.speechSynthesis?.cancel();
    setIsPlaying(false);
  }, []);

  const shouldShow = !!greeting && !dismissed && !wasShownThisSession();

  return {
    text:     greeting?.text    ?? null,
    category: greeting?.category ?? null,
    animState: animState ?? greeting?.animState ?? null,
    isPlaying,
    shouldShow,
    triggerGreeting,
    dismiss,
  };
}
