/**
 * useAutopilot hook — calls the AI Autopilot API endpoint to generate
 * Studio node graphs from natural language prompts.
 */
import { useMutation } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface AutopilotResult {
  title: string;
  type: string;
  description: string;
  thumbnail: string;
  nodes: unknown[];
  edges: unknown[];
}

export interface AutopilotStep {
  id: string;
  label: string;
  done: boolean;
}

export const AUTOPILOT_STEPS: AutopilotStep[] = [
  { id: "understand", label: "Understanding your request…", done: false },
  { id: "design", label: "Designing the logic flow…", done: false },
  { id: "build", label: "Building nodes and edges…", done: false },
  { id: "validate", label: "Validating and optimizing…", done: false },
];

async function runAutopilot(prompt: string): Promise<AutopilotResult> {
  const resp = await fetch(`${BASE}/api/studio/autopilot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  if (!resp.ok) throw new Error(`Autopilot failed: ${resp.status}`);
  return resp.json() as Promise<AutopilotResult>;
}

export function useAutopilot() {
  return useMutation({
    mutationFn: runAutopilot,
  });
}
