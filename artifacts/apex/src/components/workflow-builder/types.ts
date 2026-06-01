/**
 * Shared TypeScript types for the Conversational Workflow Builder.
 */

export type TriggerType =
  | "user_signup"
  | "user_message_received"
  | "api_call_received";

export type ActionType =
  | "send_message"
  | "call_ai_model"
  | "update_user_data"
  | "trigger_webhook"
  | "delay";

export interface WorkflowCondition {
  field: string;
  operator: "eq" | "neq" | "contains" | "gt" | "lt" | "exists";
  value?: string;
}

export interface SendMessageData {
  message: string;
  channel: "email" | "in-app" | "sms";
  subject?: string;
}

export interface CallAiModelData {
  prompt: string;
  model: string;
  outputKey: string;
  temperature?: number;
}

export interface UpdateUserDataData {
  field: string;
  value: string;
}

export interface TriggerWebhookData {
  url: string;
  method: "GET" | "POST" | "PUT" | "PATCH";
  payload?: Record<string, unknown>;
}

export interface DelayData {
  duration: number;
  unit: "seconds" | "minutes" | "hours";
}

export type ActionData =
  | SendMessageData
  | CallAiModelData
  | UpdateUserDataData
  | TriggerWebhookData
  | DelayData;

export interface WorkflowAction {
  type: ActionType;
  data: Record<string, unknown>;
}

export interface WorkflowState {
  name: string;
  description: string;
  trigger: TriggerType;
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
  category: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  kind?: "text" | "workflow_created" | "workflow_updated" | "error" | "loading";
}

export interface WorkflowPreview {
  triggerDescription: string;
  actionsSummary: Array<{ type: ActionType; summary: string }>;
  conditionsSummary: string[];
  estimatedComplexity: "simple" | "medium" | "complex";
}

export interface GenerationResult {
  workflow: WorkflowState;
  valid: boolean;
  autoFixed: boolean;
  issues: string[];
  preview: WorkflowPreview;
}

// Action metadata for UI rendering
export const ACTION_META: Record<
  ActionType,
  { label: string; icon: string; color: string; bgColor: string }
> = {
  send_message: {
    label: "Send Message",
    icon: "💬",
    color: "#3b82f6",
    bgColor: "rgba(59,130,246,0.12)",
  },
  call_ai_model: {
    label: "Call AI Model",
    icon: "🤖",
    color: "#a855f7",
    bgColor: "rgba(168,85,247,0.12)",
  },
  update_user_data: {
    label: "Update User Data",
    icon: "📝",
    color: "#22c55e",
    bgColor: "rgba(34,197,94,0.12)",
  },
  trigger_webhook: {
    label: "Trigger Webhook",
    icon: "🔗",
    color: "#f59e0b",
    bgColor: "rgba(245,158,11,0.12)",
  },
  delay: {
    label: "Delay",
    icon: "⏱",
    color: "#6b7280",
    bgColor: "rgba(107,114,128,0.12)",
  },
};

export const TRIGGER_META: Record<
  TriggerType,
  { label: string; icon: string; description: string }
> = {
  user_signup: {
    label: "User Signup",
    icon: "👤",
    description: "Fires when a new user registers",
  },
  user_message_received: {
    label: "Message Received",
    icon: "💌",
    description: "Fires when a user sends a message",
  },
  api_call_received: {
    label: "API Call",
    icon: "⚡",
    description: "Fires when an external API call is received",
  },
};
