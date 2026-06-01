/**
 * AI Workflow Generator — Core AI generation logic.
 *
 * Uses OpenAI to convert natural language into structured workflow JSON.
 * The system prompt is carefully engineered to produce consistent output.
 */

import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../../lib/logger";
import {
  SUPPORTED_TRIGGERS,
  SUPPORTED_ACTIONS,
  type GenerationResult,
} from "./schema";
import { parseAiOutput, validateAndFix, buildPreview } from "./validator";

// ── System Prompt ──────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a workflow automation expert. Convert user descriptions into structured workflow JSON.

RULES:
- Output ONLY valid JSON, no explanations, no markdown
- Be creative with action content (e.g., write real welcome messages)
- Always include a descriptive 'name' and 'description'
- Use the exact trigger/action type names from the schema below

SCHEMA:
{
  "name": string,           // Short, descriptive workflow name
  "description": string,    // 1–2 sentence explanation of what this workflow does
  "trigger": one of [${SUPPORTED_TRIGGERS.map((t) => `"${t}"`).join(" | ")}],
  "conditions": [           // Optional. Conditions to check before running actions
    {
      "field": string,      // e.g. "user.email", "user.country", "message.text"
      "operator": "eq" | "neq" | "contains" | "gt" | "lt" | "exists",
      "value": string       // Optional for "exists" operator
    }
  ],
  "actions": [              // One or more actions to execute in order
    {
      "type": "send_message",
      "data": {
        "message": string,  // The actual message text (be detailed and helpful)
        "channel": "email" | "in-app" | "sms",
        "subject": string   // Optional, for email only
      }
    },
    {
      "type": "call_ai_model",
      "data": {
        "prompt": string,   // Full prompt for the AI, can reference {{user.name}}, {{trigger.data}}
        "model": string,    // Optional, default: "gpt-5.2"
        "outputKey": string // Where to store the output, e.g. "welcome_message"
      }
    },
    {
      "type": "update_user_data",
      "data": {
        "field": string,    // e.g. "status", "onboarding_complete", "last_seen"
        "value": string     // The new value
      }
    },
    {
      "type": "trigger_webhook",
      "data": {
        "url": string,      // Full HTTPS URL
        "method": "GET" | "POST" | "PUT" | "PATCH",
        "payload": {}       // Optional request body
      }
    },
    {
      "type": "delay",
      "data": {
        "duration": number, // How long to wait
        "unit": "seconds" | "minutes" | "hours"
      }
    }
  ]
}

EXAMPLES:

User: "When a user signs up, send them a welcome email and update their status"
Output:
{
  "name": "New User Welcome",
  "description": "Sends a personalized welcome email and marks the user as onboarded when they sign up.",
  "trigger": "user_signup",
  "conditions": [],
  "actions": [
    {
      "type": "send_message",
      "data": {
        "message": "Welcome to Apex! We're thrilled to have you. Get started by exploring your AI dashboard — your personal assistant is ready to help.",
        "channel": "email",
        "subject": "Welcome to Apex 🎉"
      }
    },
    {
      "type": "update_user_data",
      "data": { "field": "onboarding_status", "value": "welcomed" }
    }
  ]
}

User: "When someone sends a message, have AI respond and log it to a webhook"
Output:
{
  "name": "AI Auto-Reply",
  "description": "Automatically generates an AI response when a user sends a message, then logs the interaction.",
  "trigger": "user_message_received",
  "conditions": [],
  "actions": [
    {
      "type": "call_ai_model",
      "data": {
        "prompt": "The user sent: {{trigger.data.message}}. Respond helpfully and concisely as Apex AI.",
        "outputKey": "ai_reply"
      }
    },
    {
      "type": "send_message",
      "data": {
        "message": "{{ai_reply}}",
        "channel": "in-app"
      }
    },
    {
      "type": "trigger_webhook",
      "data": {
        "url": "https://your-log-service.com/events",
        "method": "POST",
        "payload": { "event": "message_handled", "source": "apex-ai" }
      }
    }
  ]
}`;

// ── Update system prompt (targeted edits to existing workflow) ─────────────────
const UPDATE_SYSTEM_PROMPT = `You are a workflow automation expert making targeted edits to an existing workflow JSON.

RULES:
- Output ONLY valid JSON, no explanations, no markdown
- Only change what the user's request explicitly asks for
- Preserve all other fields exactly as-is
- Keep the same schema structure as the input

SCHEMA (same as input/output format):
{
  "name": string,
  "description": string,
  "trigger": "user_signup" | "user_message_received" | "api_call_received",
  "conditions": [{ "field": string, "operator": string, "value"?: string }],
  "actions": [
    { "type": "send_message", "data": { "message": string, "channel": "email"|"in-app"|"sms" } },
    { "type": "call_ai_model", "data": { "prompt": string, "model": string, "outputKey": string } },
    { "type": "update_user_data", "data": { "field": string, "value": string } },
    { "type": "trigger_webhook", "data": { "url": string, "method": string } },
    { "type": "delay", "data": { "duration": number, "unit": "seconds"|"minutes"|"hours" } }
  ]
}`;

// ── updateWorkflow function ────────────────────────────────────────────────────
export async function updateWorkflow(
  currentWorkflow: object,
  userRequest: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>
): Promise<GenerationResult> {
  logger.info({ userRequest }, "Updating workflow from request");

  const messages = [
    { role: "system" as const, content: UPDATE_SYSTEM_PROMPT },
    ...conversationHistory.slice(-8).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    {
      role: "user" as const,
      content: `Current workflow:\n${JSON.stringify(currentWorkflow, null, 2)}\n\nChange request: ${userRequest}`,
    },
  ];

  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 1500,
    temperature: 0.2,
    messages,
  });

  const rawAiOutput = response.choices[0]?.message?.content ?? "";
  logger.debug({ rawAiOutput }, "Raw AI update output");

  const { parsed, parseError } = parseAiOutput(rawAiOutput);

  if (parseError || !parsed) {
    logger.warn({ parseError, rawAiOutput }, "AI update parse failed");
    return {
      workflow: null as never,
      valid: false,
      autoFixed: false,
      issues: [parseError ?? "Failed to parse AI update output"],
      preview: {
        triggerDescription: "Unknown",
        actionsSummary: [],
        conditionsSummary: [],
        estimatedComplexity: "simple",
      },
      rawAiOutput,
    };
  }

  const report = validateAndFix(parsed);

  if (!report.valid || !report.workflow) {
    return {
      workflow: null as never,
      valid: false,
      autoFixed: report.autoFixed,
      issues: report.issues,
      preview: {
        triggerDescription: "Unknown",
        actionsSummary: [],
        conditionsSummary: [],
        estimatedComplexity: "simple",
      },
      rawAiOutput,
    };
  }

  const preview = buildPreview(report.workflow);

  logger.info(
    { workflowName: report.workflow.name, autoFixed: report.autoFixed },
    "Workflow updated successfully"
  );

  return {
    workflow: report.workflow,
    valid: true,
    autoFixed: report.autoFixed,
    issues: report.issues,
    preview,
    rawAiOutput,
  };
}

// ── Main generation function ───────────────────────────────────────────────────
export async function generateWorkflow(prompt: string): Promise<GenerationResult> {
  logger.info({ prompt }, "Generating workflow from prompt");

  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 1500,
    temperature: 0.3, // Low temp for structured output consistency
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
  });

  const rawAiOutput = response.choices[0]?.message?.content ?? "";
  logger.debug({ rawAiOutput }, "Raw AI workflow output");

  // Parse the AI output
  const { parsed, parseError } = parseAiOutput(rawAiOutput);

  if (parseError || !parsed) {
    logger.warn({ parseError, rawAiOutput }, "AI output parse failed");
    return {
      workflow: null as never,
      valid: false,
      autoFixed: false,
      issues: [parseError ?? "Failed to parse AI output"],
      preview: {
        triggerDescription: "Unknown",
        actionsSummary: [],
        conditionsSummary: [],
        estimatedComplexity: "simple",
      },
      rawAiOutput,
    };
  }

  // Validate and auto-fix
  const report = validateAndFix(parsed);

  if (!report.valid || !report.workflow) {
    return {
      workflow: null as never,
      valid: false,
      autoFixed: report.autoFixed,
      issues: report.issues,
      preview: {
        triggerDescription: "Unknown",
        actionsSummary: [],
        conditionsSummary: [],
        estimatedComplexity: "simple",
      },
      rawAiOutput,
    };
  }

  const preview = buildPreview(report.workflow);

  logger.info(
    { workflowName: report.workflow.name, autoFixed: report.autoFixed, issues: report.issues.length },
    "Workflow generated successfully"
  );

  return {
    workflow: report.workflow,
    valid: true,
    autoFixed: report.autoFixed,
    issues: report.issues,
    preview,
    rawAiOutput,
  };
}
