/**
 * Apex Mobile API service.
 * All API calls go through this module — never use fetch directly in components.
 */

const getBaseUrl = () => {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}` : "http://localhost:8080";
};

async function apexFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${getBaseUrl()}/api${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  const json = (await res.json()) as { ok: boolean; data?: T; error?: string };
  if (!json.ok) throw new Error(json.error ?? "API error");
  return json.data as T;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export interface RegisterInput { email: string; password: string; username?: string }
export interface LoginInput { email: string; password: string }
export interface AuthResponse {
  userId: number;
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
export interface ChatInput { userId: number; message: string; conversationId?: number }
export interface ChatResponse { content: string; conversationId: number; tokensUsed?: number }
export interface ConversationMessage { id: number; role: "user" | "assistant"; content: string; createdAt: string }
export interface Conversation { id: number; userId: number; title: string; createdAt: string }

export const chatApi = {
  send: (data: ChatInput) =>
    apexFetch<ChatResponse>("/mobile/chat", { method: "POST", body: JSON.stringify(data) }),

  getConversations: (userId: number) =>
    apexFetch<{ conversations: Conversation[] }>(`/mobile/conversations?userId=${userId}`),

  getMessages: (conversationId: number) =>
    apexFetch<{ messages: ConversationMessage[] }>(`/mobile/conversations/${conversationId}/messages`),
};

// ── Memory ────────────────────────────────────────────────────────────────────
export interface MemoryItem { id: number; category: string; key: string; value: string; updatedAt: string }

export const memoryApi = {
  get: (userId: number) =>
    apexFetch<{ memory: MemoryItem[]; count: number }>(`/mobile/memory/${userId}`),
};
