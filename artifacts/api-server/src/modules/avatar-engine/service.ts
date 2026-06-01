/**
 * Avatar Engine Service
 *
 * Controls the 3D avatar system state server-side.
 * The client (React + Three.js) receives state updates via REST or WebSocket.
 * WebSocket events: AVATAR_ACTION, EMOTION_UPDATE
 */

import { EMOTION_AVATAR_MAP } from "../../config/aiModels";
import { logger } from "../../lib/logger";
import type { AvatarState, AvatarAction, AvatarExpression, AvatarGesture } from "../../shared/types";

// In-memory avatar state per session (production: use Redis)
const avatarStates = new Map<string, AvatarState>();

// ── Get or create avatar state ────────────────────────────────────────────────
export function getAvatarState(sessionId: string): AvatarState {
  let state = avatarStates.get(sessionId);
  if (!state) {
    state = {
      sessionId,
      currentExpression: "neutral",
      currentGesture: "none",
      isAnimating: false,
      isSpeaking: false,
      personalityMode: "friendly",
      lastUpdated: new Date().toISOString(),
    };
    avatarStates.set(sessionId, state);
  }
  return state;
}

// ── Update avatar state ───────────────────────────────────────────────────────
export function updateAvatarState(sessionId: string, updates: Partial<AvatarState>): AvatarState {
  const current = getAvatarState(sessionId);
  const updated: AvatarState = {
    ...current,
    ...updates,
    lastUpdated: new Date().toISOString(),
  };
  avatarStates.set(sessionId, updated);
  return updated;
}

// ── Trigger animation ─────────────────────────────────────────────────────────
export interface AnimationResult {
  sessionId: string;
  action: AvatarAction;
  state: AvatarState;
  durationMs: number;
  startsAt: string;
  endsAt: string;
}

export function triggerAnimation(sessionId: string, action: AvatarAction): AnimationResult {
  const durationMs = action.durationMs ?? 2000;
  const now = new Date();

  const state = updateAvatarState(sessionId, {
    currentExpression: action.expression ?? "neutral",
    currentGesture: action.gesture ?? "none",
    isAnimating: true,
  });

  // Auto-clear animation after duration
  setTimeout(() => {
    updateAvatarState(sessionId, { isAnimating: false, currentGesture: "none" });
  }, durationMs);

  return {
    sessionId,
    action,
    state,
    durationMs,
    startsAt: now.toISOString(),
    endsAt: new Date(now.getTime() + durationMs).toISOString(),
  };
}

// ── Set expression ────────────────────────────────────────────────────────────
export function setExpression(sessionId: string, expression: AvatarExpression, intensity = 0.8): AvatarState {
  return updateAvatarState(sessionId, { currentExpression: expression });
}

// ── Voice sync ────────────────────────────────────────────────────────────────
export interface VoiceSyncResult {
  sessionId: string;
  text: string;
  estimatedDurationMs: number;
  phonemes: string[]; // for lip sync
  isSpeaking: boolean;
}

export function prepareVoiceSync(sessionId: string, text: string): VoiceSyncResult {
  // Estimate speech duration: ~150 words/min
  const words = text.split(" ").length;
  const estimatedDurationMs = (words / 150) * 60_000;

  // Simple phoneme extraction (production: use proper TTS phoneme API)
  const phonemes = text
    .toLowerCase()
    .replace(/[^a-z ]/g, "")
    .split("")
    .filter((c, i, arr) => arr[i - 1] !== c) // deduplicate consecutive
    .slice(0, 50); // max 50 phoneme events

  updateAvatarState(sessionId, { isSpeaking: true });

  // Auto-clear speaking state
  setTimeout(() => {
    updateAvatarState(sessionId, { isSpeaking: false });
  }, estimatedDurationMs);

  return {
    sessionId,
    text,
    estimatedDurationMs,
    phonemes,
    isSpeaking: true,
  };
}

// ── Map AI emotion text → avatar action ──────────────────────────────────────
export function emotionToAvatarAction(emotionText: string): AvatarAction {
  const lower = emotionText.toLowerCase();
  for (const [emotion, action] of Object.entries(EMOTION_AVATAR_MAP)) {
    if (lower.includes(emotion)) return action;
  }
  return EMOTION_AVATAR_MAP.neutral;
}
