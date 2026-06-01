/**
 * AI Autopilot — converts natural language prompts into fully working
 * Studio node graphs using GPT-4o-mini.
 *
 * Pipeline:
 *   parseUserIntent(prompt) → generateNodeGraph(intent) → validateAndFix(graph)
 */
import { Router, type IRouter } from "express";
import { z } from "zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { validateGraph } from "../lib/nodeExecutor";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ─── Node schema reference given to the AI ────────────────────
const NODE_SCHEMA_DOC = `
AVAILABLE NODE TYPES (use ONLY these):

TRIGGER NODES:
- start: Entry point, 0 inputs, 1 output. fields: {} 
- user_input: Capture input, 1 in, 1 out. fields: { label, value }

LOGIC NODES:
- if: Condition branch, 1 in, 2 out (labels: "true"/"false"). fields: { condition }
- compare: Compare values, 1 in, 1 out. fields: { a, operator (eq|neq|gt|lt|contains), b }
- set_variable: Store data, 1 in, 1 out. fields: { key, value }

AI NODES:
- generate_text: AI text generation, 1 in, 1 out. fields: { prompt, outputKey }
- ai_character: Persona-based AI, 1 in, 1 out. fields: { persona, message, outputKey }
- summarize: Summarize text, 1 in, 1 out. fields: { text, outputKey }
- classify: Classify text, 1 in, 1 out. fields: { text, categories, outputKey }

MEDIA NODES:
- image_gen: Generate image, 1 in, 1 out. fields: { prompt }
- video_gen: Generate video, 1 in, 1 out. fields: { script }
- play_audio: Text-to-speech, 1 in, 1 out. fields: { text, voice (alloy|echo|fable|onyx) }

GAME NODES:
- player_input: Player action, 1 in, 1 out. fields: { label, default }
- scene_switch: Switch scene, 1 in, 1 out. fields: { scene }
- score_track: Track score, 1 in, 1 out. fields: { operation (add|subtract|reset), amount }
- win_loss: Win/loss check, 1 in, 2 out (labels: "win"/"loss"). fields: { threshold }

OUTPUT NODES:
- display_result: Show output to user (terminal node), 1 in, 0 out. fields: { template }
- save_data: Save data, 1 in, 0 out. fields: { key, value }

NODE FORMAT:
{ "id": "n1", "type": "<node_type>", "x": <number>, "y": <number>, "data": { <fields> } }

EDGE FORMAT:
{ "id": "e1", "from": "<source_node_id>", "to": "<target_node_id>", "label": "<optional: true|false|win|loss>" }

LAYOUT RULES:
- Place nodes left-to-right in execution order
- x positions: 80, 320, 560, 800, 1040, 1280 (gap of 240)
- y positions: center main path at y=200; branches diverge ±180 (y=20 for true, y=380 for false)
- Maximum 12 nodes per graph
- Every graph MUST start with a "start" node
- Every path MUST end with a "display_result" node (no dangling branches)
- Do NOT connect a node to itself

EXAMPLES:

DM Bot:
nodes: [
  {"id":"n1","type":"start","x":80,"y":200,"data":{}},
  {"id":"n2","type":"user_input","x":320,"y":200,"data":{"label":"Enter message","value":""}},
  {"id":"n3","type":"ai_character","x":560,"y":200,"data":{"persona":"a flirty but respectful assistant","message":"{{userInput}}","outputKey":"reply"}},
  {"id":"n4","type":"display_result","x":800,"y":200,"data":{"template":"💬 {{reply}}"}}
]
edges: [
  {"id":"e1","from":"n1","to":"n2"},
  {"id":"e2","from":"n2","to":"n3"},
  {"id":"e3","from":"n3","to":"n4"}
]

Simple Game:
nodes: [
  {"id":"n1","type":"start","x":80,"y":200,"data":{}},
  {"id":"n2","type":"player_input","x":320,"y":200,"data":{"label":"What do you do? (fight/run)","default":"fight"}},
  {"id":"n3","type":"if","x":560,"y":200,"data":{"condition":"{{playerInput}} == fight"}},
  {"id":"n4","type":"score_track","x":800,"y":20,"data":{"operation":"add","amount":10}},
  {"id":"n5","type":"display_result","x":1040,"y":20,"data":{"template":"⚔️ You fought! +10 points"}},
  {"id":"n6","type":"display_result","x":800,"y":380,"data":{"template":"🏃 You ran away safely."}}
]
edges: [
  {"id":"e1","from":"n1","to":"n2"},
  {"id":"e2","from":"n2","to":"n3"},
  {"id":"e3","from":"n3","to":"n4","label":"true"},
  {"id":"e4","from":"n4","to":"n5"},
  {"id":"e5","from":"n3","to":"n6","label":"false"}
]
`;

// ─── Predefined fallback templates ───────────────────────────
const FALLBACK_TEMPLATES: Record<string, { title: string; type: string; description: string; thumbnail: string; nodes: unknown[]; edges: unknown[] }> = {
  dm_bot: {
    title: "DM Bot",
    type: "ai_tool",
    description: "An AI-powered conversation bot",
    thumbnail: "💬",
    nodes: [
      { id: "n1", type: "start", x: 80, y: 200, data: {} },
      { id: "n2", type: "user_input", x: 320, y: 200, data: { label: "Your message", value: "" } },
      { id: "n3", type: "ai_character", x: 560, y: 200, data: { persona: "a friendly and engaging conversationalist", message: "{{userInput}}", outputKey: "reply" } },
      { id: "n4", type: "display_result", x: 800, y: 200, data: { template: "💬 {{reply}}" } },
    ],
    edges: [
      { id: "e1", from: "n1", to: "n2" },
      { id: "e2", from: "n2", to: "n3" },
      { id: "e3", from: "n3", to: "n4" },
    ],
  },
  game: {
    title: "Adventure Game",
    type: "game",
    description: "A text adventure game",
    thumbnail: "🎮",
    nodes: [
      { id: "n1", type: "start", x: 80, y: 200, data: {} },
      { id: "n2", type: "player_input", x: 320, y: 200, data: { label: "What do you do? (fight/run/explore)", default: "explore" } },
      { id: "n3", type: "generate_text", x: 560, y: 200, data: { prompt: "You are a dungeon master. The player chose: {{playerInput}}. Describe what happens next in 2 sentences.", outputKey: "scene" } },
      { id: "n4", type: "score_track", x: 800, y: 200, data: { operation: "add", amount: 5 } },
      { id: "n5", type: "display_result", x: 1040, y: 200, data: { template: "🎮 {{scene}}\n\n+5 XP" } },
    ],
    edges: [
      { id: "e1", from: "n1", to: "n2" },
      { id: "e2", from: "n2", to: "n3" },
      { id: "e3", from: "n3", to: "n4" },
      { id: "e4", from: "n4", to: "n5" },
    ],
  },
  automation: {
    title: "Smart Automation",
    type: "automation",
    description: "Automated workflow",
    thumbnail: "⚡",
    nodes: [
      { id: "n1", type: "start", x: 80, y: 200, data: {} },
      { id: "n2", type: "user_input", x: 320, y: 200, data: { label: "Input", value: "" } },
      { id: "n3", type: "generate_text", x: 560, y: 200, data: { prompt: "Process this: {{userInput}}", outputKey: "result" } },
      { id: "n4", type: "display_result", x: 800, y: 200, data: { template: "✅ {{result}}" } },
    ],
    edges: [
      { id: "e1", from: "n1", to: "n2" },
      { id: "e2", from: "n2", to: "n3" },
      { id: "e3", from: "n3", to: "n4" },
    ],
  },
};

// ─── Request schema ───────────────────────────────────────────
const AutopilotBody = z.object({
  prompt: z.string().min(3).max(500),
});

// ─── Main endpoint ────────────────────────────────────────────
router.post("/studio/autopilot", async (req, res): Promise<void> => {
  const parsed = AutopilotBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid prompt" });
    return;
  }

  const { prompt } = parsed.data;
  logger.info({ prompt }, "Autopilot: generating project from prompt");

  try {
    const result = await generateProjectFromPrompt(prompt);
    res.json(result);
  } catch (err) {
    logger.error({ err }, "Autopilot: generation failed, using fallback");
    // Fallback to closest template
    const fallback = selectFallback(prompt);
    res.json(fallback);
  }
});

// ─── AI Generation Pipeline ────────────────────────────────────

async function generateProjectFromPrompt(prompt: string) {
  // Step 1: Parse intent
  const intent = await parseUserIntent(prompt);
  logger.info({ intent }, "Autopilot: parsed intent");

  // Step 2: Generate graph
  const graph = await generateNodeGraph(prompt, intent);
  logger.info({ nodeCount: graph.nodes.length, edgeCount: graph.edges.length }, "Autopilot: generated graph");

  // Step 3: Validate + auto-fix
  const fixed = validateAndFix(graph, intent);

  return {
    title: fixed.title,
    type: fixed.type,
    description: fixed.description,
    thumbnail: fixed.thumbnail,
    nodes: fixed.nodes,
    edges: fixed.edges,
  };
}

async function parseUserIntent(prompt: string): Promise<{
  type: "game" | "ai_tool" | "app" | "automation" | "media";
  style: string;
  features: string[];
  templateKey?: string;
}> {
  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    max_tokens: 200,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `Classify the user's prompt into a project type. Respond with JSON only.
Types: game, ai_tool, app, automation, media
Return: { "type": "<type>", "style": "<brief style descriptor>", "features": ["<feature1>", ...], "templateKey": "<dm_bot|game|automation|null>" }
templateKey should be "dm_bot" for chat/DM/conversation bots, "game" for games/adventures, "automation" for workflows/automations, null otherwise.`,
      },
      { role: "user", content: prompt },
    ],
  });

  const raw = resp.choices[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(raw) as { type: "game" | "ai_tool" | "app" | "automation" | "media"; style: string; features: string[]; templateKey?: string };
  } catch {
    return { type: "automation", style: "general", features: [] };
  }
}

async function generateNodeGraph(prompt: string, intent: { type: string; style: string; features: string[] }): Promise<{
  title: string;
  type: string;
  description: string;
  thumbnail: string;
  nodes: unknown[];
  edges: unknown[];
}> {
  const THUMBNAILS: Record<string, string> = { game: "🎮", ai_tool: "🤖", app: "📱", automation: "⚡", media: "🎬" };

  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.7,
    max_tokens: 1800,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are an expert at building Studio node graphs. Build a complete, functional node graph from the user's request.

${NODE_SCHEMA_DOC}

CRITICAL RULES:
1. Every graph MUST start with exactly ONE "start" node
2. Every terminal path MUST end with "display_result" — NO dangling nodes
3. Only use node types listed above
4. Data flows via {{variableName}} in field values
5. Use "userInput" for user_input output, "playerInput" for player_input output
6. Keep graphs between 4-10 nodes — focused and executable
7. For branching (if/win_loss), BOTH branches must have a display_result

Respond with JSON only, matching this schema exactly:
{
  "title": "<catchy project title>",
  "description": "<one sentence description>",
  "nodes": [...],
  "edges": [...]
}`,
      },
      {
        role: "user",
        content: `Build a Studio project for: "${prompt}"
Project type: ${intent.type}
Style: ${intent.style}
Features needed: ${intent.features.join(", ") || "basic flow"}`,
      },
    ],
  });

  const raw = resp.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as {
    title?: string;
    description?: string;
    nodes?: unknown[];
    edges?: unknown[];
  };

  return {
    title: parsed.title ?? "AI Generated Project",
    type: intent.type,
    description: parsed.description ?? `Generated from: ${prompt}`,
    thumbnail: THUMBNAILS[intent.type] ?? "⚡",
    nodes: parsed.nodes ?? [],
    edges: parsed.edges ?? [],
  };
}

function validateAndFix(graph: {
  title: string;
  type: string;
  description: string;
  thumbnail: string;
  nodes: unknown[];
  edges: unknown[];
}, intent: { type: string }): {
  title: string;
  type: string;
  description: string;
  thumbnail: string;
  nodes: unknown[];
  edges: unknown[];
} {
  const nodes = (graph.nodes ?? []) as { id: string; type: string; x: number; y: number; data: Record<string, string | number | boolean> }[];
  const edges = (graph.edges ?? []) as { id: string; from: string; to: string; label?: string }[];

  // Validate with the engine
  const errors = validateGraph(nodes, edges);

  if (errors.length > 0) {
    logger.warn({ errors }, "Autopilot: graph has validation issues, attempting auto-fix");

    // Auto-fix: ensure there's a start node
    if (!nodes.find((n) => n.type === "start")) {
      nodes.unshift({ id: "n_start_fix", type: "start", x: 80, y: 200, data: {} });
    }

    // Auto-fix: ensure all nodes are connected (find orphans)
    const connectedIds = new Set<string>();
    for (const e of edges) { connectedIds.add(e.from); connectedIds.add(e.to); }

    // If there are orphaned nodes (except start), try to chain them
    const startNode = nodes.find((n) => n.type === "start");
    if (startNode) {
      const orphans = nodes.filter((n) => n.id !== startNode.id && !connectedIds.has(n.id));
      if (orphans.length > 0 && edges.length === 0) {
        // Build a linear chain
        let prev = startNode.id;
        for (const orphan of orphans) {
          edges.push({ id: `e_fix_${orphan.id}`, from: prev, to: orphan.id });
          prev = orphan.id;
        }
      }
    }
  }

  // Final check: if still invalid, use fallback
  const finalErrors = validateGraph(nodes, edges);
  if (finalErrors.length > 5 || nodes.length === 0) {
    const fallback = selectFallback(intent.type);
    return { ...fallback, title: graph.title || fallback.title };
  }

  return { ...graph, nodes, edges };
}

function selectFallback(promptOrType: string): typeof FALLBACK_TEMPLATES[string] {
  const lower = promptOrType.toLowerCase();
  if (lower.includes("game") || lower.includes("adventure") || lower.includes("rpg") || lower.includes("quest")) {
    return FALLBACK_TEMPLATES["game"]!;
  }
  if (lower.includes("dm") || lower.includes("chat") || lower.includes("flirt") || lower.includes("bot") || lower.includes("conversation")) {
    return FALLBACK_TEMPLATES["dm_bot"]!;
  }
  return FALLBACK_TEMPLATES["automation"]!;
}

export default router;
