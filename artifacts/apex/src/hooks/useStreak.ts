/**
 * useStreak — Reads, updates, and exposes streak state.
 *
 * Returns:
 *   streak          — current day streak count
 *   milestone       — nearest milestone threshold (3 | 7 | 14 | 30 | null)
 *   milestoneLabel  — "Momentum building" / "You're locked in" / etc.
 *   isMilestoneNew  — true if this milestone hasn't been celebrated yet
 *   glowIntensity   — 0–1 value driving the badge glow
 *   dismissMilestone — call to mark the milestone as seen
 */
import { useState, useEffect, useMemo } from "react";
import {
  loadUserProfile,
  saveUserProfile,
  updateStreak,
  getStreakMilestone,
  getStreakGlowIntensity,
  wasMilestoneShown,
  markMilestoneShown,
  MILESTONE_MESSAGES,
} from "@/lib/userMemory";

export interface UseStreakResult {
  streak:           number;
  milestone:        number | null;
  milestoneLabel:   string | null;
  isMilestoneNew:   boolean;
  glowIntensity:    number;
  dismissMilestone: () => void;
}

export function useStreak(): UseStreakResult {
  const [streak, setStreak]           = useState(0);
  const [milestoneNew, setMilestoneNew] = useState(false);

  useEffect(() => {
    const profile  = loadUserProfile();
    const updated  = updateStreak(profile);

    // Persist if changed
    if (updated.streak !== profile.streak) {
      saveUserProfile(updated);
    }

    setStreak(updated.streak);

    // Check for a new milestone
    const m = getStreakMilestone(updated.streak);
    if (m !== null && !wasMilestoneShown(m)) {
      setMilestoneNew(true);
    }
  }, []);

  const milestone      = useMemo(() => getStreakMilestone(streak), [streak]);
  const milestoneLabel = milestone ? MILESTONE_MESSAGES[milestone] ?? null : null;
  const glowIntensity  = useMemo(() => getStreakGlowIntensity(streak), [streak]);

  const dismissMilestone = () => {
    if (milestone !== null) markMilestoneShown(milestone);
    setMilestoneNew(false);
  };

  return {
    streak,
    milestone,
    milestoneLabel,
    isMilestoneNew: milestoneNew,
    glowIntensity,
    dismissMilestone,
  };
}
