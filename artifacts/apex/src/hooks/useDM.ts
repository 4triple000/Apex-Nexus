import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authHeaders } from "@/lib/authSession";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
function apiUrl(path: string) { return `${BASE}/api${path}`; }

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    // Messages are private: the server only returns the signed-in user's inbox
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(options?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as T;
}

export type PersonalityMode = "smooth" | "funny" | "confident" | "chill" | "romantic" | "custom";
export type SituationMode = "first_message" | "after_ghosted" | "late_night" | "setting_up_date" | "recovery";

export interface DmContact {
  id: number;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  platform: string;
  bio?: string | null;
  personaTraits?: Record<string, unknown> | null;
  responseSpeed?: string | null;
  totalInteractions: number;
}

export interface DmConversation {
  id: number;
  contactId: number;
  platform: string;
  autoReplyEnabled: boolean;
  personalityMode: PersonalityMode;
  customPersonalityPrompt?: string | null;
  situationMode?: string | null;
  unreadCount: number;
  lastMessageAt?: string | null;
}

export interface DmMessage {
  id: number;
  conversationId: number;
  direction: "inbound" | "outbound";
  content: string;
  aiGenerated: boolean;
  replyScore?: number | null;
  sentAt: string;
}

export interface ConversationWithContact {
  dm_conversations: DmConversation;
  dm_contacts: DmContact | null;
}

export interface ScoreBreakdown {
  engagement: number;
  toneMatch: number;
  originality: number;
  confidence: number;
}

export interface ReplyScore {
  score: number;
  breakdown: ScoreBreakdown;
  feedback: string;
  verdict: "excellent" | "good" | "okay" | "risky";
}

export interface CoachAnalysis {
  didWell: string[];
  couldImprove: string[];
  nextMove: string;
  overallRating: number;
  verdict: string;
}

export interface VoiceCoachResult {
  advice: string;
  suggestedReply: string;
  vibeCheck: string;
}

// ── Queries ──────────────────────────────────────────────────

export function useConversations() {
  return useQuery({
    queryKey: ["dm-conversations"],
    queryFn: () =>
      request<{ conversations: ConversationWithContact[] }>(apiUrl("/dm/conversations"))
        .then((d) => d.conversations),
    refetchInterval: 8000,
  });
}

export function useMessages(conversationId: number | null) {
  return useQuery({
    queryKey: ["dm-messages", conversationId],
    queryFn: () =>
      request<{ messages: DmMessage[] }>(apiUrl(`/dm/conversations/${conversationId}/messages`))
        .then((d) => d.messages),
    enabled: !!conversationId,
    refetchInterval: 5000,
  });
}

export function useDMAnalytics() {
  return useQuery({
    queryKey: ["dm-analytics"],
    queryFn: () => request<{
      summary: { totalMessages: number; outbound: number; aiGenerated: number; avgScore: number; totalContacts: number };
      perContact: { contactId: number; username: string; displayName?: string | null; responseRate: number; totalMessages: number }[];
      conversations: number;
    }>(apiUrl("/dm/analytics")),
  });
}

export function useMetaStatus() {
  return useQuery({
    queryKey: ["meta-status"],
    queryFn: () => request<{ configured: boolean; message: string }>(apiUrl("/dm/meta/status")),
  });
}

// ── Mutations ────────────────────────────────────────────────

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, content, aiGenerated = false }: { conversationId: number; content: string; aiGenerated?: boolean }) =>
      request<{ message: DmMessage }>(apiUrl(`/dm/conversations/${conversationId}/messages`), {
        method: "POST",
        body: JSON.stringify({ content, direction: "outbound", aiGenerated }),
      }).then((d) => d.message),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["dm-messages", vars.conversationId] }),
  });
}

export function useUpdateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number; autoReplyEnabled?: boolean; personalityMode?: PersonalityMode; customPersonalityPrompt?: string; situationMode?: string | null }) =>
      request<{ conversation: DmConversation }>(apiUrl(`/dm/conversations/${id}`), {
        method: "PATCH",
        body: JSON.stringify(data),
      }).then((d) => d.conversation),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dm-conversations"] }),
  });
}

export function useGenerateReply() {
  return useMutation({
    mutationFn: (data: { conversationId: number; lastMessage: string; personalityMode: string; customPrompt?: string; situationMode?: string; contextMessages: { direction: string; content: string }[] }) =>
      request<{ reply: string; score: number }>(apiUrl("/dm/reply/generate"), {
        method: "POST",
        body: JSON.stringify(data),
      }),
  });
}

export function useFlirtyReplies() {
  return useMutation({
    mutationFn: (data: { lastMessage: string; contextMessages: { direction: string; content: string }[] }) =>
      request<{ variations: { safe: string; bold: string; playful: string } }>(apiUrl("/dm/reply/flirty"), {
        method: "POST",
        body: JSON.stringify(data),
      }),
  });
}

export function useScoreReply() {
  return useMutation({
    mutationFn: (data: { message: string; lastMessage: string; contextMessages?: { direction: string; content: string }[] }) =>
      request<ReplyScore>(apiUrl("/dm/reply/score"), { method: "POST", body: JSON.stringify(data) }),
  });
}

export function useTypingAssist() {
  return useMutation({
    mutationFn: (data: { draft: string; lastMessage: string; personalityMode: string; customPrompt?: string | null }) =>
      request<{ suggestions: string[] }>(apiUrl("/dm/typing-assist"), { method: "POST", body: JSON.stringify(data) }),
  });
}

export function useColdOpen() {
  return useMutation({
    mutationFn: (data: { profileContext: string; personalityMode: string; tone?: string }) =>
      request<{ openers: { text: string; style: string }[] }>(apiUrl("/dm/cold-open"), { method: "POST", body: JSON.stringify(data) }),
  });
}

export function useCoachAnalyze() {
  return useMutation({
    mutationFn: (data: { messages: { direction: string; content: string }[] }) =>
      request<CoachAnalysis>(apiUrl("/dm/coach/analyze"), { method: "POST", body: JSON.stringify(data) }),
  });
}

export function useVoiceCoach() {
  return useMutation({
    mutationFn: (data: { transcript: string; lastMessage?: string; contextMessages?: { direction: string; content: string }[] }) =>
      request<VoiceCoachResult>(apiUrl("/dm/coach/voice"), { method: "POST", body: JSON.stringify(data) }),
  });
}

export function useAnalyzePersona() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (contactId: number) =>
      request<{ traits: Record<string, unknown> }>(apiUrl(`/dm/contacts/${contactId}/analyze`), { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dm-conversations"] }),
  });
}
