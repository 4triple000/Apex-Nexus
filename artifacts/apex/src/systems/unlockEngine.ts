/**
 * Apex Unlock Engine
 * Watches for referral changes and emits unlock events with toast notifications.
 * Integrates with featureAccess.ts state resolution.
 */

import { APEX_FEATURES } from "@/data/features";
import { getFeatureState, type FeatureState } from "@/systems/featureAccess";

type UnlockListener = (featureId: string, newState: FeatureState, oldState: FeatureState) => void;

const listeners: UnlockListener[] = [];
let previousStates: Record<string, FeatureState> = {};
let engineStarted = false;

/** Snapshot current feature states */
function snapshotStates(): Record<string, FeatureState> {
  const snap: Record<string, FeatureState> = {};
  for (const feature of APEX_FEATURES) {
    snap[feature.id] = getFeatureState(feature.id);
  }
  return snap;
}

/** Diff states and fire listeners for any upgrades */
function checkTransitions(): void {
  const current = snapshotStates();
  const ORDER: FeatureState[] = ["locked", "preview", "early", "live"];

  for (const [id, state] of Object.entries(current)) {
    const prev = previousStates[id];
    if (prev && prev !== state) {
      const prevIdx = ORDER.indexOf(prev);
      const nextIdx = ORDER.indexOf(state);
      if (nextIdx > prevIdx) {
        // Upgrade detected
        for (const cb of listeners) cb(id, state, prev);
      }
    }
  }
  previousStates = current;
}

/** Subscribe to unlock events. Returns an unsubscribe function. */
export function onFeatureUnlock(cb: UnlockListener): () => void {
  listeners.push(cb);
  return () => {
    const idx = listeners.indexOf(cb);
    if (idx > -1) listeners.splice(idx, 1);
  };
}

/**
 * Start the unlock engine.
 * - Takes an initial snapshot.
 * - Listens for apex:statechange events (from dev panel).
 * - Polls every 10s for organic referral-based unlocks.
 */
export function startUnlockEngine(): () => void {
  if (engineStarted) return () => {};
  engineStarted = true;

  previousStates = snapshotStates();

  // Listen for dev panel overrides
  const handleStateChange = () => checkTransitions();
  window.addEventListener("apex:statechange", handleStateChange);

  // Poll for referral-based unlocks every 10s
  const interval = setInterval(checkTransitions, 10_000);

  return () => {
    window.removeEventListener("apex:statechange", handleStateChange);
    clearInterval(interval);
    engineStarted = false;
  };
}

/**
 * Force-check all features immediately.
 * Call this after the user gains new referrals.
 */
export function checkUnlocksNow(): void {
  checkTransitions();
}

/** Human-readable state name for toast messages */
export function stateLabel(state: FeatureState): string {
  return {
    locked:  "Locked",
    preview: "Preview",
    early:   "Early Access",
    live:    "Live",
  }[state];
}
