/**
 * Shared TypeScript types across all Apex backend modules.
 */

import type { Request } from "express";

// ── Authenticated request ─────────────────────────────────────────────────────
export interface ApexRequest extends Request {
  sessionId?: string;
  userId?: number;
  subscriptionTier?: "free" | "pro" | "creator_pro" | "enterprise";
}

// ── Standard API response ────────────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  meta?: {
    timestamp: string;
    requestId?: string;
    version: string;
  };
}

// ── AI orchestration types ────────────────────────────────────────────────────
export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiOrchestrationRequest {
  sessionId: string;
  message: string;
  context?: AiMessage[];
  mode?: "chat" | "think" | "tool-router" | "memory";
  provider?: "openai" | "claude" | "perplexity" | "auto";
  temperature?: number;
  maxTokens?: number;
  injectMemory?: boolean;
  injectPersonalization?: boolean;
}

export interface AiOrchestrationResponse {
  content: string;
  provider: string;
  responseTimeMs: number;
  tokensUsed?: number;
  toolInvoked?: string;
  avatarAction?: AvatarAction;
  personalizationActive?: boolean;
  preferredTone?: string;
}

// ── Avatar types ──────────────────────────────────────────────────────────────
export type AvatarExpression = "happy" | "sad" | "thinking" | "excited" | "neutral" | "surprised" | "angry" | "confident";
export type AvatarGesture = "nod" | "wave" | "point" | "shrug" | "thumbsup" | "none";
export type AvatarVoiceSyncMode = "lipsync" | "expression" | "both" | "none";

export interface AvatarAction {
  expression?: AvatarExpression;
  gesture?: AvatarGesture;
  intensity?: number; // 0.0 – 1.0
  durationMs?: number;
  voiceSync?: AvatarVoiceSyncMode;
  message?: string; // optional text for lip sync
}

export interface AvatarState {
  sessionId: string;
  currentExpression: AvatarExpression;
  currentGesture: AvatarGesture;
  isAnimating: boolean;
  isSpeaking: boolean;
  personalityMode: string;
  lastUpdated: string;
}

// ── Memory types ──────────────────────────────────────────────────────────────
export interface MemoryEntry {
  id?: number;
  sessionId: string;
  userId?: number;
  type: "fact" | "preference" | "context" | "workflow_history" | "avatar_personality";
  key: string;
  value: unknown;
  importance: number; // 1-10
  expiresAt?: Date;
  createdAt?: Date;
}

export interface UserMemory {
  facts: string[];
  preferences: Record<string, unknown>;
  context: string;
  avatarPersonality: string;
  workflowHistory: string[];
}

// ── WebSocket event types ─────────────────────────────────────────────────────
export type WsEventType =
  | "USER_MESSAGE"
  | "AI_RESPONSE_STREAM"
  | "AI_RESPONSE_COMPLETE"
  | "AVATAR_ACTION"
  | "EMOTION_UPDATE"
  | "TOOL_INVOKED"
  | "MEMORY_UPDATED"
  | "WORKFLOW_STARTED"
  | "WORKFLOW_PROGRESS"
  | "WORKFLOW_COMPLETE"
  | "COLLAB_JOIN"
  | "COLLAB_LEAVE"
  | "COLLAB_CURSOR"
  | "COLLAB_NODE_UPDATE"
  | "COLLAB_EDGE_UPDATE";

export interface WsEvent<T = unknown> {
  type: WsEventType;
  sessionId: string;
  payload: T;
  timestamp: string;
}

// ── Billing types ─────────────────────────────────────────────────────────────
export type SubscriptionTier = "free" | "pro" | "creator_pro" | "enterprise";
export type SubscriptionStatus = "active" | "inactive" | "trialing" | "past_due" | "cancelled" | "unpaid";

export interface UsageStats {
  sessionId: string;
  tier: SubscriptionTier;
  requestsUsed: number;
  requestsLimit: number;
  creditsUsed: number;
  creditsLimit: number;
  periodEnds?: string;
}
