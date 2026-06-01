/**
 * useReengagement — Reads user memory + streak and decides whether to show
 * the avatar re-engagement message.
 *
 * Returns:
 *   message    — the ReengagementMessage to show (null = nothing to show)
 *   dismiss    — call to mark shown and clear
 */
import { useState, useEffect } from "react";
import { loadUserProfile } from "@/lib/userMemory";
import {
  getReengagementMessage,
  wasReengagementShown,
  markReengagementShown,
  ReengagementMessage,
} from "@/lib/reengagementEngine";

// Delay before showing (lets the home page settle, and doesn't compete with
// the AvatarGreeting which fires at 800ms)
const MOUNT_DELAY = 3400;

export interface UseReengagementResult {
  message: ReengagementMessage | null;
  dismiss: () => void;
}

export function useReengagement(): UseReengagementResult {
  const [message, setMessage] = useState<ReengagementMessage | null>(null);

  useEffect(() => {
    // Already shown this session — skip
    if (wasReengagementShown()) return;

    const t = setTimeout(() => {
      const profile = loadUserProfile();
      const msg     = getReengagementMessage({
        lastVisit: profile.lastVisit ?? undefined,
        streak:    profile.streak,
      });

      if (msg) setMessage(msg);
    }, MOUNT_DELAY);

    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    markReengagementShown();
    setMessage(null);
  };

  return { message, dismiss };
}
