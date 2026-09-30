/**
 * Apex Mobile API service.
 * All API calls go through this module — never use fetch directly in components.
 */

const getBaseUrl = () => {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (!domain) return "http://localhost:8080";
  // A full URL (e.g. http://localhost:8080 for local testing) is used as-is
  return /^https?:\/\//.test(domain) ? domain.replace(/\/$/, "") : `https://${domain}`;
};

// Session credential from login/register; set by AuthContext
let authSessionId: string | null = null;

export function setAuthSession(sessionId: string | null): void {
  authSessionId = sessionId;
}

// ── Apex Engine projects (plan on the phone, build on the computer) ─────────
export type EngineTarget = "apex" | "mobile" | "pc";
export type EngineKind = "apex" | "unity" | "unreal";
export type EngineTemplate = "fps" | "topdown" | "platformer" | "sports" | "openworld" | "survival";
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

export interface GameProject {
  id: number;
  title: string;
  target: EngineTarget;
  engine: EngineKind;
  template: EngineTemplate | null;
  prompt: string | null;
  plan: GamePlan | null;
  updatedAt: string;
}

export interface ProjectSummary {
  id: number;
  title: string;
  target: EngineTarget;
  engine: EngineKind;
  progress: { done: number; total: number };
  updatedAt: string;
}

export const engineApi = {
  list: () => apexFetch<{ projects: ProjectSummary[] }>("/engine/projects").then((d) => d.projects),
  get: (id: number) => apexFetch<{ project: GameProject; aiConnected: boolean }>(`/engine/projects/${id}`),
  create: (body: { prompt?: string; target: EngineTarget; engine?: EngineKind; template?: EngineTemplate }) =>
    apexFetch<{ project: GameProject; aiPlan: boolean }>("/engine/projects", { method: "POST", body: JSON.stringify(body) }),
  update: (id: number, body: Partial<Pick<GameProject, "title" | "target" | "engine" | "plan">>) =>
    apexFetch<{ project: GameProject }>(`/engine/projects/${id}`, { method: "PATCH", body: JSON.stringify(body) }).then((d) => d.project),
  remove: (id: number) => apexFetch<{ deleted: boolean }>(`/engine/projects/${id}`, { method: "DELETE" }),
  askPlan: (id: number, message: string) =>
    apexFetch<{ project: GameProject; reply: string }>(`/engine/projects/${id}/plan`, { method: "POST", body: JSON.stringify({ message }) }),
};

// ── 7-day streak ──────────────────────────────────────────────────────────────
export interface StreakState {
  streak: number;
  best: number;
  cycleDay: number;
  checkedInToday: boolean;
  rewards: { bonus: { day: number; messages: number; earned: boolean }; avatar: { day: number; earned: boolean } };
  earned: "bonus" | "avatar" | null;
}

export const streakApi = {
  signedIn: () => !!authSessionId,
  get: (today: string) => apexFetch<StreakState>(`/streak?today=${today}`),
  checkin: (today: string) => apexFetch<StreakState>("/streak/checkin", { method: "POST", body: JSON.stringify({ today }) }),
};

// ── Prompt library sync ───────────────────────────────────────────────────────
export interface SyncedPrompt { text: string; kind: "chat" | "build"; at: number }

export const promptsApi = {
  get: () => apexFetch<{ history: SyncedPrompt[]; saved: SyncedPrompt[] }>("/prompts"),
  put: (history: SyncedPrompt[], saved: SyncedPrompt[]) =>
    apexFetch<{ saved: boolean }>("/prompts", { method: "PUT", body: JSON.stringify({ history, saved }) }),
  signedIn: () => !!authSessionId,
};

async function apexFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${getBaseUrl()}/api${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(authSessionId ? { "x-apex-auth": authSessionId } : {}),
      ...options?.headers,
    },
  });

  let json: { ok: boolean; data?: T; error?: string };
  try {
    json = (await res.json()) as typeof json;
  } catch {
    throw new Error(`Server error (${res.status})`);
  }
  if (!json.ok) throw new Error(json.error ?? "API error");
  return json.data as T;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export interface RegisterInput { email: string; password: string; username?: string }
export interface LoginInput { email: string; password: string }
export interface AuthResponse {
  userId: number;
  sessionId: string;
  email: string;
  username: string;
  avatarEmoji: string;
  bio?: string | null;
}

export const authApi = {
  register: (data: RegisterInput) =>
    apexFetch<AuthResponse>("/mobile/auth/register", { method: "POST", body: JSON.stringify(data) }),

  login: (data: LoginInput) =>
    apexFetch<AuthResponse>("/mobile/auth/login", { method: "POST", body: JSON.stringify(data) }),
};

// ── Chat ──────────────────────────────────────────────────────────────────────
export type ProviderId = "auto" | "openai" | "claude" | "perplexity";
export interface ChatInput { message: string; conversationId?: number; provider?: ProviderId; tone?: string; memory?: boolean }
export interface ChatResponse { content: string; conversationId: number; provider?: string }

export interface ModelAnswer { provider: string; content: string; responseTime: number; error?: string }
export interface GroupChatResponse { mode: string; messages: ModelAnswer[]; combinedAnswer?: string }
export interface ConversationMessage { id: number; role: "user" | "assistant"; content: string; createdAt: string }
export interface Conversation { id: number; userId: number; title: string; createdAt: string }

export const chatApi = {
  send: (data: ChatInput) =>
    apexFetch<ChatResponse>("/mobile/chat", { method: "POST", body: JSON.stringify(data) }),

  getConversations: () =>
    apexFetch<{ conversations: Conversation[] }>("/mobile/conversations"),

  getMessages: (conversationId: number) =>
    apexFetch<{ messages: ConversationMessage[] }>(`/mobile/conversations/${conversationId}/messages`),

  /** Battle (every model answers) or Hive (models combine one answer). */
  group: async (message: string, mode: "battle" | "hive", sessionId?: string): Promise<GroupChatResponse> => {
    const res = await fetch(`${getBaseUrl()}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, mode, sessionId }),
    });
    const json = (await res.json().catch(() => null)) as (GroupChatResponse & { error?: string }) | null;
    if (!res.ok || !json) throw new Error(json?.error ?? `Server error (${res.status})`);
    return json;
  },

  /** Which models have keys on the server. */
  providers: async (): Promise<Record<Exclude<ProviderId, "auto">, boolean>> => {
    const res = await fetch(`${getBaseUrl()}/api/chat/providers`);
    if (!res.ok) throw new Error(`Server error (${res.status})`);
    return ((await res.json()) as { providers: Record<Exclude<ProviderId, "auto">, boolean> }).providers;
  },
};

// ── Memory ────────────────────────────────────────────────────────────────────
export interface MemoryItem { id: number; category: string; key: string; value: string; updatedAt: string }

export const memoryApi = {
  get: (userId: number) =>
    apexFetch<{ memory: MemoryItem[]; count: number }>(`/mobile/memory/${userId}`),
};

// ── Messages (Instagram / Messenger inbox) ────────────────────────────────────
export interface DmConversation {
  dm_conversations: { id: number; lastMessageAt?: string | null; unreadCount?: number | null };
  dm_contacts: { id: number; displayName?: string | null; username: string; platform: string } | null;
}

export const messagesApi = {
  conversations: async (): Promise<DmConversation[]> => {
    const res = await fetch(`${getBaseUrl()}/api/dm/conversations`, {
      headers: authSessionId ? { "x-apex-auth": authSessionId } : {},
    });
    if (!res.ok) throw new Error(`Server error (${res.status})`);
    return ((await res.json()) as { conversations: DmConversation[] }).conversations ?? [];
  },
  metaStatus: async (): Promise<{ configured: boolean }> => {
    const res = await fetch(`${getBaseUrl()}/api/dm/meta/status`);
    if (!res.ok) throw new Error(`Server error (${res.status})`);
    return (await res.json()) as { configured: boolean };
  },
};

// ── Games ─────────────────────────────────────────────────────────────────────
export interface GameEntry {
  id: number;
  name: string;
  creatorName: string;
  likeCount: number;
  playCount: number;
  tags: string[];
  isRemix: boolean;
}

export const gamesApi = {
  feed: async (): Promise<GameEntry[]> => {
    const res = await fetch(`${getBaseUrl()}/api/game-feed?limit=30`);
    if (!res.ok) throw new Error(`Server error (${res.status})`);
    return ((await res.json()) as { entries: GameEntry[] }).entries ?? [];
  },
};

/** The Apex website, where games are played. */
export const WEB_APP_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? "https://apex-nexus-apex.vercel.app").replace(/\/$/, "");

// ── Daily usage ───────────────────────────────────────────────────────────────
export interface DailyUsage { requestsUsed: number; requestsLimit: number; tier: string; resetAt: string }

export const usageApi = {
  today: async (sessionId: string): Promise<DailyUsage> => {
    const res = await fetch(`${getBaseUrl()}/api/usage?sessionId=${encodeURIComponent(sessionId)}`);
    if (!res.ok) throw new Error(`Server error (${res.status})`);
    return (await res.json()) as DailyUsage;
  },
};

// ── Builder (AI Studio) ───────────────────────────────────────────────────────
export interface StudioProject { id: number; title: string; appType?: string | null; updatedAt: string }
export interface StudioBuild {
  projectId: number;
  plan: { project_name: string; description?: string };
  files: { path: string }[];
  previewHtml: string;
  summary: string;
}

async function studioFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getBaseUrl()}/api${path}`, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const json = (await res.json().catch(() => null)) as { ok: boolean; data?: T; error?: string } | null;
  if (!res.ok || !json?.ok) throw new Error(json?.error ?? `Server error (${res.status})`);
  return json.data as T;
}

export const studioApi = {
  generate: (prompt: string, sessionId: string) =>
    studioFetch<StudioBuild>("/studio/ai/generate", { method: "POST", body: JSON.stringify({ prompt, sessionId }) }),
  edit: (projectId: number, request: string, sessionId: string) =>
    studioFetch<{ summary: string; changedFiles: string[]; previewHtml: string }>("/studio/ai/edit", { method: "POST", body: JSON.stringify({ projectId, request, sessionId }) }),
  project: async (id: number, sessionId: string): Promise<StudioBuild> => {
    const { project } = await studioFetch<{ project: { id: number; title: string; plan: StudioBuild["plan"] | null; files: { path: string }[]; previewHtml: string | null } }>(
      `/studio/ai/projects/${id}?sessionId=${encodeURIComponent(sessionId)}`,
    );
    return { projectId: project.id, plan: project.plan ?? { project_name: project.title }, files: project.files ?? [], previewHtml: project.previewHtml ?? "", summary: "" };
  },
  projects: (sessionId: string) =>
    studioFetch<{ projects: StudioProject[] }>(`/studio/ai/projects?sessionId=${encodeURIComponent(sessionId)}`).then((d) => d.projects),
};

// ── Screenshot analysis ───────────────────────────────────────────────────────
export const screenshotApi = {
  analyze: async (imageBase64: string): Promise<{ analysis: string; suggestions: string[] }> => {
    const res = await fetch(`${getBaseUrl()}/api/chat/analyze-screenshot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64 }),
    });
    const json = (await res.json().catch(() => null)) as { analysis?: string; suggestions?: string[]; error?: string } | null;
    if (!res.ok || !json) throw new Error(json?.error ?? `Server error (${res.status})`);
    return { analysis: json.analysis ?? "", suggestions: json.suggestions ?? [] };
  },
};
