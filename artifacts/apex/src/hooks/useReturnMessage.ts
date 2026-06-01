/**
 * useReturnMessage — detects when a returning user should see a personalized
 * "welcome back" message based on their last visit and last topic.
 *
 * - Reads from userMemory + characterEngine
 * - Sets up a beforeunload listener to update lastVisit on tab close
 * - Returns ReturnContext (message, topic, days away, CTA label)
 * - Tracks dismissal so it's only shown once per session
 */
import { useState, useEffect, useMemo } from "react";
import {
  loadUserProfile,
  updateLastVisit,
  updateStreak,
  saveUserProfile,
  getReturnMessage,
  type ReturnContext,
} from "@/lib/userMemory";
import { loadMemoryStore } from "@/lib/characterEngine";

const SESSION_KEY = "apex_return_msg_shown";

function wasShownThisSession(): boolean {
  try { return sessionStorage.getItem(SESSION_KEY) === "1"; } catch { return false; }
}
function markShownThisSession() {
  try { sessionStorage.setItem(SESSION_KEY, "1"); } catch {}
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export interface UseReturnMessageResult {
  context:  ReturnContext | null;
  visible:  boolean;
  dismiss:  () => void;
}

export function useReturnMessage(): UseReturnMessageResult {
  const [dismissed, setDismissed] = useState(false);

  // Compute return context once on mount, cross-referencing characterEngine pastTopics
  const context = useMemo(() => {
    if (wasShownThisSession()) return null;

    const profile = loadUserProfile();
    const memory  = loadMemoryStore();

    // Sync lastTopic from characterEngine if userMemory doesn't have one
    if (!profile.lastTopic && memory.pastTopics.length > 0) {
      profile.lastTopic = memory.pastTopics[0];
      saveUserProfile(profile);
    }

    const ctx = getReturnMessage(profile);
    return ctx;
  }, []); // stable on mount

  // Update streak on mount (new visit)
  useEffect(() => {
    const profile  = loadUserProfile();
    const updated  = updateStreak(profile);
    saveUserProfile(updated);
  }, []);

  // Save lastVisit on page hide / tab close
  useEffect(() => {
    const handleHide = () => {
      // Try to capture the most recent topic from characterEngine
      const memory = loadMemoryStore();
      const topic  = memory.pastTopics[0] ?? null;
      updateLastVisit(topic);
    };

    window.addEventListener("beforeunload", handleHide);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") handleHide();
    });

    return () => {
      window.removeEventListener("beforeunload", handleHide);
    };
  }, []);

  const dismiss = () => {
    markShownThisSession();
    setDismissed(true);
  };

  const visible = !!context && !dismissed;

  return { context, visible, dismiss };
}
