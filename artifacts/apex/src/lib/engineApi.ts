/**
 * Apex Engine projects on the server (saved to the signed-in account).
 */
import { authHeaders } from "@/lib/authSession";
import type { GameConfig } from "@/engine/types";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export type Target = "apex" | "mobile" | "pc";
export type Engine = "apex" | "unity" | "unreal";
export type Template = "fps" | "topdown" | "platformer" | "sports" | "openworld" | "survival";
export type CameraStyle = "First person" | "Third person" | "Top-down" | "Side view";

export interface GamePlan {
  pitch: string;
  genre: string;
  camera: CameraStyle;
  platforms: string[];
  coreLoop: string;
  controls: string[];
  mechanics: string[];
  levels: { name: string; goal: string }[];
  characters: { name: string; role: string }[];
  artStyle: string;
  audio: string;
  checklist: { id: string; label: string; done: boolean }[];
}

export interface GameSettings { multiplayer?: boolean; maxPlayers?: number }

export interface GameProject {
  id: number;
  title: string;
  target: Target;
  engine: Engine;
  template: Template | null;
  prompt: string | null;
  config: GameConfig | null;
  plan: GamePlan | null;
  settings: GameSettings | null;
  updatedAt: string;
}

export interface ProjectSummary {
  id: number;
  title: string;
  target: Target;
  engine: Engine;
  template: Template | null;
  gameMode: string | null;
  progress: { done: number; total: number };
  updatedAt: string;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...init?.headers },
  });
  const json = await res.json().catch(() => null) as { ok?: boolean; data?: T; error?: string } | null;
  if (!res.ok || !json?.ok) throw new Error(json?.error ?? `Something went wrong (${res.status}). Try again.`);
  return json.data as T;
}

export const engineApi = {
  list: () => call<{ projects: ProjectSummary[] }>("/engine/projects").then((d) => d.projects),
  get: (id: number) => call<{ project: GameProject; aiConnected: boolean }>(`/engine/projects/${id}`),
  create: (body: { prompt?: string; title?: string; target: Target; engine?: Engine; template?: Template; config?: GameConfig }) =>
    call<{ project: GameProject; aiPlan: boolean }>("/engine/projects", { method: "POST", body: JSON.stringify(body) }),
  update: (id: number, body: Partial<Pick<GameProject, "title" | "target" | "engine" | "config" | "plan" | "settings">>) =>
    call<{ project: GameProject }>(`/engine/projects/${id}`, { method: "PATCH", body: JSON.stringify(body) }).then((d) => d.project),
  remove: (id: number) => call<{ deleted: boolean }>(`/engine/projects/${id}`, { method: "DELETE" }),
  askPlan: (id: number, message: string) =>
    call<{ project: GameProject; reply: string }>(`/engine/projects/${id}/plan`, { method: "POST", body: JSON.stringify({ message }) }),
  askGame: (id: number, message: string) =>
    call<{ project: GameProject; reply: string }>(`/engine/projects/${id}/edit`, { method: "POST", body: JSON.stringify({ message }) }),

  /** Downloads the Unity / Unreal starter project as a .zip. */
  async download(id: number, title: string, engine: Engine) {
    const res = await fetch(`${BASE}/api/engine/projects/${id}/export`, { method: "POST", headers: authHeaders() });
    if (!res.ok) {
      const json = await res.json().catch(() => null) as { error?: string } | null;
      throw new Error(json?.error ?? "Couldn't make the project. Try again.");
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^A-Za-z0-9]+/g, "") || "ApexGame"}-${engine === "unity" ? "Unity" : "Unreal"}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  },
};

export const TARGETS: { id: Target; label: string; sub: string }[] = [
  { id: "apex", label: "Quick game", sub: "Plays right away on phone and computer" },
  { id: "mobile", label: "Mobile game", sub: "iPhone and Android, built with Unity" },
  { id: "pc", label: "Computer game", sub: "AAA-style for PC and console, built with Unreal or Unity" },
];

export const TEMPLATES: { id: Template; label: string; prompt: string }[] = [
  { id: "fps", label: "3D shooter", prompt: "a 3D first person shooter" },
  { id: "topdown", label: "Top-down", prompt: "a top-down arena shooter" },
  { id: "platformer", label: "Platformer", prompt: "a fast neon platformer" },
  { id: "sports", label: "Sports", prompt: "an arcade basketball game" },
  { id: "openworld", label: "Open world", prompt: "an open world city exploration game" },
  { id: "survival", label: "Survival", prompt: "survive waves of enemies" },
];

export const engineLabel = (e: Engine) => (e === "unity" ? "Unity" : e === "unreal" ? "Unreal" : "Apex");
export const targetLabel = (t: Target) => TARGETS.find((x) => x.id === t)?.label ?? "Game";
