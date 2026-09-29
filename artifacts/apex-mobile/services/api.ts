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
export interface ChatInput { message: string; conversationId?: number; provider?: ProviderId }
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
