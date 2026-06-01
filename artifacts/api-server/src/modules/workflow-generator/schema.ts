/**
 * Workflow Generator — Canonical schema definitions.
 *
 * These are the "source of truth" types for the AI-generated workflow format.
 * They are intentionally decoupled from the DB schema so the generator can
 * evolve independently and add richer metadata without touching the DB layer.
 */

import { z } from "zod";

// ── Supported Triggers ─────────────────────────────────────────────────────────
export const SUPPORTED_TRIGGERS = [
  "user_signup",
  "user_message_received",
  "api_call_received",
] as const;

export type SupportedTrigger = (typeof SUPPORTED_TRIGGERS)[number];

export const TRIGGER_DESCRIPTIONS: Record<SupportedTrigger, string> = {
  user_signup: "Fires when a new user registers an account",
  user_message_received: "Fires when a user sends a message",
  api_call_received: "Fires when an external API call hits the endpoint",
};

// ── Supported Actions ──────────────────────────────────────────────────────────
export const SUPPORTED_ACTIONS = [
  "send_message",
  "call_ai_model",
  "update_user_data",
  "trigger_webhook",
  "delay",
] as const;

export type SupportedAction = (typeof SUPPORTED_ACTIONS)[number];

export const ACTION_DESCRIPTIONS: Record<SupportedAction, string> = {
  send_message: "Send a message to the user via email, in-app, or SMS",
  call_ai_model: "Invoke an AI model to process or generate content",
  update_user_data: "Update a field on the user's profile",
  trigger_webhook: "Make an HTTP request to an external service",
  delay: "Wait for a specified duration before continuing",
};

// ── Condition Schema ───────────────────────────────────────────────────────────
export const ConditionSchema = z.object({
  field: z.string().min(1),
  operator: z.enum(["eq", "neq", "contains", "gt", "lt", "exists"]),
  value: z.string().optional(),
});

export type Condition = z.infer<typeof ConditionSchema>;

// ── Action Data Schemas (per type) ─────────────────────────────────────────────
export const SendMessageDataSchema = z.object({
  message: z.string().min(1),
  channel: z.enum(["email", "in-app", "sms"]).default("in-app"),
  subject: z.string().optional(),
});

export const CallAiModelDataSchema = z.object({
  prompt: z.string().min(1),
  model: z.string().default("gpt-5.2"),
  outputKey: z.string().default("ai_output"),
  temperature: z.number().min(0).max(2).default(0.7),
});

export const UpdateUserDataSchema = z.object({
  field: z.string().min(1),
  value: z.string(),
});

export const TriggerWebhookDataSchema = z.object({
  url: z.string().url(),
  method: z.enum(["GET", "POST", "PUT", "PATCH"]).default("POST"),
  payload: z.record(z.string(), z.unknown()).default({}),
  headers: z.record(z.string(), z.string()).default({}),
});

export const DelayDataSchema = z.object({
  duration: z.number().min(1).default(5),
  unit: z.enum(["seconds", "minutes", "hours"]).default("minutes"),
});

// ── Action Schema ──────────────────────────────────────────────────────────────
export const ActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("send_message"), data: SendMessageDataSchema }),
  z.object({ type: z.literal("call_ai_model"), data: CallAiModelDataSchema }),
  z.object({ type: z.literal("update_user_data"), data: UpdateUserDataSchema }),
  z.object({ type: z.literal("trigger_webhook"), data: TriggerWebhookDataSchema }),
  z.object({ type: z.literal("delay"), data: DelayDataSchema }),
]);

export type Action = z.infer<typeof ActionSchema>;

// ── Generated Workflow Schema ──────────────────────────────────────────────────
export const GeneratedWorkflowSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).default(""),
  trigger: z.enum(SUPPORTED_TRIGGERS),
  conditions: z.array(ConditionSchema).default([]),
  actions: z.array(ActionSchema).min(1, "At least one action is required"),
  category: z.string().default("ai-generated"),
});

export type GeneratedWorkflow = z.infer<typeof GeneratedWorkflowSchema>;

// ── Preview Types ──────────────────────────────────────────────────────────────
export interface WorkflowPreview {
  triggerDescription: string;
  actionsSummary: Array<{ type: SupportedAction; summary: string }>;
  conditionsSummary: string[];
  estimatedComplexity: "simple" | "medium" | "complex";
}

// ── Generation Response ────────────────────────────────────────────────────────
export interface GenerationResult {
  workflow: GeneratedWorkflow;
  valid: boolean;
  autoFixed: boolean;
  issues: string[];
  preview: WorkflowPreview;
  rawAiOutput: string;
}
