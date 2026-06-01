/**
 * Workflow Validator + Auto-Fixer
 *
 * Takes potentially malformed AI output and:
 * 1. Validates against the schema
 * 2. Auto-fixes common issues (wrong field names, invalid enum values, missing defaults)
 * 3. Reports what was fixed vs. what is unfixable
 */

import {
  GeneratedWorkflowSchema,
  SUPPORTED_TRIGGERS,
  SUPPORTED_ACTIONS,
  type GeneratedWorkflow,
  type WorkflowPreview,
  TRIGGER_DESCRIPTIONS,
  ACTION_DESCRIPTIONS,
  type SupportedTrigger,
  type SupportedAction,
} from "./schema";

export interface ValidationReport {
  workflow: GeneratedWorkflow | null;
  valid: boolean;
  autoFixed: boolean;
  issues: string[];
}

// ── Trigger normalization — map common synonyms to canonical trigger names ─────
const TRIGGER_ALIASES: Record<string, SupportedTrigger> = {
  "signup": "user_signup",
  "user_register": "user_signup",
  "new_user": "user_signup",
  "registration": "user_signup",
  "on_signup": "user_signup",
  "message": "user_message_received",
  "on_message": "user_message_received",
  "new_message": "user_message_received",
  "incoming_message": "user_message_received",
  "api_call": "api_call_received",
  "http_request": "api_call_received",
  "webhook_received": "api_call_received",
  "incoming_request": "api_call_received",
};

// ── Action type normalization ──────────────────────────────────────────────────
const ACTION_ALIASES: Record<string, SupportedAction> = {
  "message": "send_message",
  "send": "send_message",
  "notify": "send_message",
  "email": "send_message",
  "ai": "call_ai_model",
  "llm": "call_ai_model",
  "gpt": "call_ai_model",
  "openai": "call_ai_model",
  "ai_call": "call_ai_model",
  "update_user": "update_user_data",
  "set_field": "update_user_data",
  "update_profile": "update_user_data",
  "webhook": "trigger_webhook",
  "http": "trigger_webhook",
  "request": "trigger_webhook",
  "wait": "delay",
  "sleep": "delay",
  "pause": "delay",
  "timer": "delay",
};

function normalizeTrigger(raw: string): { value: SupportedTrigger; fixed: boolean } {
  const lower = raw?.toLowerCase?.().trim() ?? "";
  if (SUPPORTED_TRIGGERS.includes(lower as SupportedTrigger)) {
    return { value: lower as SupportedTrigger, fixed: false };
  }
  if (TRIGGER_ALIASES[lower]) {
    return { value: TRIGGER_ALIASES[lower]!, fixed: true };
  }
  return { value: "api_call_received", fixed: true };
}

function normalizeActionType(raw: string): { value: SupportedAction; fixed: boolean } {
  const lower = raw?.toLowerCase?.().trim() ?? "";
  if (SUPPORTED_ACTIONS.includes(lower as SupportedAction)) {
    return { value: lower as SupportedAction, fixed: false };
  }
  if (ACTION_ALIASES[lower]) {
    return { value: ACTION_ALIASES[lower]!, fixed: true };
  }
  return { value: "send_message", fixed: true };
}

function normalizeActionData(type: SupportedAction, raw: unknown): Record<string, unknown> {
  const data = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  switch (type) {
    case "send_message":
      return {
        message: String(data.message ?? data.content ?? data.text ?? "Hello!"),
        channel: ["email", "in-app", "sms"].includes(String(data.channel)) ? data.channel : "in-app",
        ...(data.subject ? { subject: String(data.subject) } : {}),
      };
    case "call_ai_model":
      return {
        prompt: String(data.prompt ?? data.instruction ?? data.message ?? "Process this request"),
        model: String(data.model ?? "gpt-5.2"),
        outputKey: String(data.outputKey ?? data.output_key ?? "ai_output"),
        temperature: typeof data.temperature === "number" ? data.temperature : 0.7,
      };
    case "update_user_data":
      return {
        field: String(data.field ?? data.key ?? "status"),
        value: String(data.value ?? ""),
      };
    case "trigger_webhook":
      return {
        url: String(data.url ?? data.endpoint ?? "https://example.com/webhook"),
        method: ["GET", "POST", "PUT", "PATCH"].includes(String(data.method)) ? data.method : "POST",
        payload: typeof data.payload === "object" && data.payload ? data.payload : {},
        headers: typeof data.headers === "object" && data.headers ? data.headers : {},
      };
    case "delay":
      return {
        duration: typeof data.duration === "number" && data.duration > 0 ? data.duration : 5,
        unit: ["seconds", "minutes", "hours"].includes(String(data.unit)) ? data.unit : "minutes",
      };
    default:
      return {};
  }
}

// ── Parse raw AI JSON output ───────────────────────────────────────────────────
export function parseAiOutput(raw: string): { parsed: unknown; parseError: string | null } {
  // Strip markdown code fences if present
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    return { parsed: JSON.parse(cleaned), parseError: null };
  } catch {
    // Try to extract JSON object from surrounding text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return { parsed: JSON.parse(jsonMatch[0]), parseError: null };
      } catch {}
    }
    return { parsed: null, parseError: "AI output was not valid JSON" };
  }
}

// ── Main validator + auto-fixer ────────────────────────────────────────────────
export function validateAndFix(raw: unknown): ValidationReport {
  const issues: string[] = [];
  let autoFixed = false;

  if (!raw || typeof raw !== "object") {
    return {
      workflow: null,
      valid: false,
      autoFixed: false,
      issues: ["AI output was not a valid JSON object"],
    };
  }

  const obj = raw as Record<string, unknown>;

  // ── Fix: name ──────────────────────────────────────────────────────────────
  let name = String(obj.name ?? obj.workflow_name ?? obj.title ?? "").trim();
  if (!name) {
    name = "AI Generated Workflow";
    issues.push("Missing 'name' — defaulted to 'AI Generated Workflow'");
    autoFixed = true;
  }

  // ── Fix: description ───────────────────────────────────────────────────────
  const description = String(obj.description ?? obj.summary ?? "").trim();

  // ── Fix: trigger ───────────────────────────────────────────────────────────
  const rawTrigger = String(obj.trigger ?? obj.event ?? obj.on ?? "").trim();
  const triggerResult = normalizeTrigger(rawTrigger);
  if (triggerResult.fixed) {
    issues.push(`Unknown trigger '${rawTrigger}' → mapped to '${triggerResult.value}'`);
    autoFixed = true;
  }

  // ── Fix: conditions ────────────────────────────────────────────────────────
  const rawConditions = Array.isArray(obj.conditions) ? obj.conditions : [];
  const conditions = rawConditions
    .filter((c): c is Record<string, unknown> => c && typeof c === "object")
    .map((c) => {
      const VALID_OPS = ["eq", "neq", "contains", "gt", "lt", "exists"] as const;
      return {
        field: String(c.field ?? c.key ?? ""),
        operator: VALID_OPS.includes(c.operator as typeof VALID_OPS[number]) ? c.operator as typeof VALID_OPS[number] : "eq" as const,
        ...(c.value !== undefined ? { value: String(c.value) } : {}),
      };
    })
    .filter((c) => c.field.length > 0);

  // ── Fix: actions ───────────────────────────────────────────────────────────
  const rawActions = Array.isArray(obj.actions) ? obj.actions : [];
  if (!Array.isArray(obj.actions) || obj.actions.length === 0) {
    issues.push("No actions found — added a default 'send_message' action");
    autoFixed = true;
  }

  const actions = rawActions
    .filter((a): a is Record<string, unknown> => a && typeof a === "object")
    .map((a) => {
      const typeResult = normalizeActionType(String(a.type ?? ""));
      if (typeResult.fixed) {
        issues.push(`Unknown action type '${a.type}' → mapped to '${typeResult.value}'`);
        autoFixed = true;
      }

      // Accept both 'data' and 'config' field names from AI output
      const rawData = a.data ?? a.config ?? a.params ?? a.options ?? {};
      const normalizedData = normalizeActionData(typeResult.value, rawData);

      return { type: typeResult.value, data: normalizedData };
    });

  // Default action if none were parseable
  if (actions.length === 0) {
    actions.push({
      type: "send_message" as const,
      data: {
        message: "Workflow triggered successfully",
        channel: "in-app",
      },
    });
    autoFixed = true;
  }

  // ── Assemble and validate with Zod ─────────────────────────────────────────
  const candidate = {
    name,
    description,
    trigger: triggerResult.value,
    conditions,
    actions,
    category: String(obj.category ?? "ai-generated"),
  };

  const result = GeneratedWorkflowSchema.safeParse(candidate);
  if (result.success) {
    return { workflow: result.data, valid: true, autoFixed, issues };
  }

  // If Zod still fails, report the remaining errors
  const zodIssues = result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`);
  return {
    workflow: null,
    valid: false,
    autoFixed,
    issues: [...issues, ...zodIssues],
  };
}

// ── Preview builder ────────────────────────────────────────────────────────────
export function buildPreview(workflow: GeneratedWorkflow): WorkflowPreview {
  const actionsSummary = workflow.actions.map((action) => {
    let summary = ACTION_DESCRIPTIONS[action.type as SupportedAction] ?? action.type;

    if (action.type === "send_message" && "message" in action.data) {
      const msg = String(action.data.message).slice(0, 60);
      summary = `Send "${msg}${msg.length === 60 ? "…" : ""}" via ${action.data.channel ?? "in-app"}`;
    } else if (action.type === "call_ai_model" && "prompt" in action.data) {
      const p = String(action.data.prompt).slice(0, 60);
      summary = `AI: "${p}${p.length === 60 ? "…" : ""}"`;
    } else if (action.type === "update_user_data" && "field" in action.data) {
      summary = `Set user.${action.data.field} = "${action.data.value}"`;
    } else if (action.type === "trigger_webhook" && "url" in action.data) {
      summary = `${action.data.method ?? "POST"} ${action.data.url}`;
    } else if (action.type === "delay" && "duration" in action.data) {
      summary = `Wait ${action.data.duration} ${action.data.unit}`;
    }

    return { type: action.type as SupportedAction, summary };
  });

  const conditionsSummary = workflow.conditions.map(
    (c) => `${c.field} ${c.operator} ${c.value ?? "(exists)"}`
  );

  const complexity: WorkflowPreview["estimatedComplexity"] =
    workflow.actions.length >= 4 || workflow.conditions.length >= 3
      ? "complex"
      : workflow.actions.length >= 2 || workflow.conditions.length >= 1
        ? "medium"
        : "simple";

  return {
    triggerDescription: TRIGGER_DESCRIPTIONS[workflow.trigger as SupportedTrigger] ?? workflow.trigger,
    actionsSummary,
    conditionsSummary,
    estimatedComplexity: complexity,
  };
}
