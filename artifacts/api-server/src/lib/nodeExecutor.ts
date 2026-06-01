/**
 * Shared node execution engine — used by both Studio project runner
 * and Studio Marketplace runner. Do not add Express-specific logic here.
 */
import { openai } from "@workspace/integrations-openai-ai-server";

export interface NodeDef {
  id: string;
  type: string;
  data: Record<string, string | number | boolean>;
}

export interface EdgeDef {
  id: string;
  from: string;
  to: string;
  label?: string;
}

export interface ExecStep {
  nodeId: string;
  nodeType: string;
  label: string;
  output: string;
  success: boolean;
}

export const NODE_LABELS: Record<string, string> = {
  start: "Start",
  user_input: "User Input",
  set_variable: "Set Variable",
  compare: "Compare",
  if: "IF Condition",
  generate_text: "Generate Text",
  ai_character: "AI Character",
  summarize: "Summarize",
  classify: "Classify",
  generate_image: "Generate Image",
  generate_video: "Generate Video",
  play_audio: "Play Audio",
  player_input: "Player Input",
  scene_switch: "Scene Switch",
  score_track: "Score Tracker",
  win_loss: "Win/Loss",
  display_result: "Display Result",
  save_data: "Save Data",
  publish_project: "Publish",
};

// ─── Graph Validation ────────────────────────────────────────
export function validateGraph(nodes: NodeDef[], edges: EdgeDef[]): string[] {
  const errors: string[] = [];
  const nodeIds = new Set(nodes.map((n) => n.id));

  for (const edge of edges) {
    if (!nodeIds.has(edge.from))
      errors.push(`Edge "${edge.id}" references unknown source node "${edge.from}"`);
    if (!nodeIds.has(edge.to))
      errors.push(`Edge "${edge.id}" references unknown target node "${edge.to}"`);
  }

  const seenNodes = new Set<string>();
  for (const n of nodes) {
    if (seenNodes.has(n.id)) errors.push(`Duplicate node ID: "${n.id}"`);
    seenNodes.add(n.id);
  }

  const seenEdges = new Set<string>();
  for (const e of edges) {
    if (seenEdges.has(e.id)) errors.push(`Duplicate edge ID: "${e.id}"`);
    seenEdges.add(e.id);
  }

  return errors;
}

// ─── Individual Node Execution ───────────────────────────────
export async function executeNode(
  node: NodeDef,
  context: Record<string, string>,
): Promise<{ output: string; branch?: string }> {
  const interp = (s: string) =>
    String(s).replace(/\{\{(\w+)\}\}/g, (_, k) => context[k] ?? `{{${k}}}`);

  switch (node.type) {
    case "start":
      return { output: "▶ Pipeline started" };

    case "user_input": {
      const outputKey = String(node.data.outputKey || "userInput");
      const value = String(
        context[outputKey] ?? context.userInput ?? node.data.value ?? "(no input)"
      );
      context[outputKey] = value;
      context.userInput = value;
      return { output: value };
    }

    case "set_variable": {
      const key = String(node.data.key ?? "var");
      const val = interp(String(node.data.value ?? ""));
      context[key] = val;
      return { output: `Set ${key} = "${val}"` };
    }

    case "compare": {
      const a = interp(String(node.data.a ?? ""));
      const b = interp(String(node.data.b ?? ""));
      const op = String(node.data.operator ?? "eq");
      const na = Number(a); const nb = Number(b);
      let result = false;
      if (op === "eq") result = a === b;
      else if (op === "neq") result = a !== b;
      else if (op === "gt") result = !isNaN(na) && !isNaN(nb) ? na > nb : a > b;
      else if (op === "lt") result = !isNaN(na) && !isNaN(nb) ? na < nb : a < b;
      else if (op === "gte") result = !isNaN(na) && !isNaN(nb) ? na >= nb : a >= b;
      else if (op === "lte") result = !isNaN(na) && !isNaN(nb) ? na <= nb : a <= b;
      else if (op === "contains") result = a.includes(b);
      const branch = result ? "true" : "false";
      context.lastCompare = branch;
      const outputKey = String(node.data.outputKey || "compareResult");
      context[outputKey] = branch;
      return { output: `Compare: ${a} ${op} ${b} → ${result}`, branch };
    }

    case "if": {
      const condition = interp(String(node.data.condition ?? ""));
      const result = condition === "true" || condition === "1" || condition.toLowerCase() === "yes";
      context.lastIf = result ? "true" : "false";
      return { output: `IF ${condition} → ${result ? "TRUE" : "FALSE"}`, branch: result ? "true" : "false" };
    }

    case "generate_text": {
      const prompt = interp(String(node.data.prompt ?? "Say hello"));
      const outputKey = String(node.data.outputKey || "generated");
      try {
        const resp = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 400,
          temperature: 0.7,
        });
        const text = resp.choices[0]?.message?.content ?? "(no response)";
        context[outputKey] = text;
        return { output: text };
      } catch {
        const fallback = `[AI] Generated text for: "${prompt.slice(0, 60)}..."`;
        context[outputKey] = fallback;
        return { output: fallback };
      }
    }

    case "ai_character": {
      const persona = interp(String(node.data.persona ?? "a helpful assistant"));
      const message = interp(String(node.data.message ?? "Hello"));
      const outputKey = String(node.data.outputKey || "characterResponse");
      try {
        const resp = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: `You are ${persona}. Stay in character. Be concise (2-3 sentences).` },
            { role: "user", content: message },
          ],
          max_tokens: 200,
          temperature: 0.8,
        });
        const text = resp.choices[0]?.message?.content ?? "(no response)";
        context[outputKey] = text;
        return { output: text };
      } catch {
        const fallback = `[${persona}]: Response to "${message.slice(0, 40)}"`;
        context[outputKey] = fallback;
        return { output: fallback };
      }
    }

    case "summarize": {
      const text = interp(String(node.data.text ?? context.lastOutput ?? ""));
      const outputKey = String(node.data.outputKey || "summary");
      try {
        const resp = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: `Summarize in 2-3 sentences:\n\n${text}` }],
          max_tokens: 150,
        });
        const summary = resp.choices[0]?.message?.content ?? text.slice(0, 100);
        context[outputKey] = summary;
        return { output: summary };
      } catch {
        const fallback = text.slice(0, 100) + (text.length > 100 ? "..." : "");
        context[outputKey] = fallback;
        return { output: fallback };
      }
    }

    case "classify": {
      const text = interp(String(node.data.text ?? context.lastOutput ?? ""));
      const categories = interp(String(node.data.categories ?? "positive, negative, neutral"));
      const outputKey = String(node.data.outputKey || "classification");
      try {
        const resp = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: `Classify the input into ONE category from: ${categories}. Output only the category name.` },
            { role: "user", content: text },
          ],
          max_tokens: 20,
          temperature: 0.1,
        });
        const cls = resp.choices[0]?.message?.content?.trim() ?? "unknown";
        context[outputKey] = cls;
        return { output: `Classified as: ${cls}` };
      } catch {
        context[outputKey] = "unknown";
        return { output: "Classified as: unknown" };
      }
    }

    case "generate_image": {
      const url = `https://picsum.photos/seed/${Date.now()}/512/512`;
      context.imageUrl = url;
      return { output: `🎨 Image generated: ${url}` };
    }

    case "generate_video":
      return { output: "🎬 Video generation queued (mock: 1920×1080, 15s)" };

    case "play_audio":
      return { output: `🎙️ Audio: "${interp(String(node.data.text ?? "Hello"))}"` };

    case "player_input": {
      const value = context.playerInput ?? String(node.data.default ?? "(waiting for player)");
      context.playerInput = value;
      return { output: value };
    }

    case "scene_switch": {
      const scene = interp(String(node.data.scene ?? "scene_1"));
      context.currentScene = scene;
      return { output: `🎬 Scene → ${scene}` };
    }

    case "score_track": {
      const op = String(node.data.operation ?? "add");
      const amount = Number(node.data.amount ?? 1);
      const current = Number(context.score ?? 0);
      let next = current;
      if (op === "add") next = current + amount;
      else if (op === "subtract") next = Math.max(0, current - amount);
      else if (op === "set") next = amount;
      else if (op === "reset") next = 0;
      context.score = String(next);
      return { output: `🏆 Score: ${next}` };
    }

    case "win_loss": {
      const score = Number(context.score ?? 0);
      const threshold = Number(node.data.threshold ?? 10);
      const result = score >= threshold ? "win" : "loss";
      context.gameResult = result;
      return {
        output: `${result === "win" ? "🏆" : "💀"} Game Over — ${result.toUpperCase()}! (Score: ${score} / ${threshold})`,
        branch: result,
      };
    }

    case "display_result":
      return { output: interp(String(node.data.template ?? context.lastOutput ?? "Done")) };

    case "save_data": {
      const key = interp(String(node.data.key ?? "result"));
      const value = interp(String(node.data.value ?? context.lastOutput ?? ""));
      context[key] = value;
      return { output: `💾 Saved "${key}" = "${value.slice(0, 60)}"` };
    }

    case "publish_project":
      return { output: "🚀 Project published to marketplace" };

    default:
      return { output: `[${node.type}] executed` };
  }
}

// ─── Graph Execution Engine ──────────────────────────────────
const NODE_TIMEOUT_MS = 20_000;
const MAX_NODES_PER_RUN = 100;

export async function executeGraph(
  nodes: NodeDef[],
  edges: EdgeDef[],
  context: Record<string, string>,
): Promise<ExecStep[]> {
  const nodeMap = new Map<string, NodeDef>(nodes.map((n) => [n.id, n]));

  const adj = new Map<string, EdgeDef[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) {
    const list = adj.get(e.from);
    if (list) list.push(e);
  }

  const log: ExecStep[] = [];
  const executed = new Set<string>();
  let executionCount = 0;

  async function runNode(nodeId: string): Promise<void> {
    if (executed.has(nodeId)) return;
    if (executionCount >= MAX_NODES_PER_RUN)
      throw new Error(`Execution limit reached (${MAX_NODES_PER_RUN} nodes). Check for unintended loops.`);

    executed.add(nodeId);
    executionCount++;

    const node = nodeMap.get(nodeId);
    if (!node) return;

    let result: { output: string; branch?: string };

    try {
      result = await Promise.race<{ output: string; branch?: string }>([
        executeNode(node, context),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Node "${node.type}" (${nodeId}) timed out after ${NODE_TIMEOUT_MS / 1000}s`)),
            NODE_TIMEOUT_MS,
          ),
        ),
      ]);
    } catch (err) {
      log.push({
        nodeId,
        nodeType: node.type,
        label: NODE_LABELS[node.type] ?? node.type,
        output: `Error: ${(err as Error).message}`,
        success: false,
      });
      return;
    }

    context.lastOutput = result.output;
    log.push({
      nodeId,
      nodeType: node.type,
      label: NODE_LABELS[node.type] ?? node.type,
      output: result.output,
      success: true,
    });

    const outEdges = adj.get(nodeId) ?? [];
    const branchTaken = result.branch;

    for (const edge of outEdges) {
      if (edge.label && (!branchTaken || edge.label !== branchTaken)) continue;
      await runNode(edge.to);
    }
  }

  const hasIncoming = new Set(edges.map((e) => e.to));
  const startNodes = nodes.filter((n) => n.type === "start");
  const roots = startNodes.length > 0 ? startNodes : nodes.filter((n) => !hasIncoming.has(n.id));

  for (const root of roots) await runNode(root.id);

  return log;
}
