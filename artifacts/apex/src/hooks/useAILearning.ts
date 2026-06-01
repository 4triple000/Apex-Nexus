import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "./use-session";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
function api(path: string) { return `${BASE}/api${path}`; }

async function req<T>(url: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(url, {
    headers: { "Content-Type": "application/json", ...((opts?.headers) || {}) },
    ...opts,
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<T>;
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface AiInsight {
  id: number;
  insightType: "trend" | "optimization" | "recommendation" | "personalization";
  scope: "global" | "user" | "project";
  title: string;
  description: string;
  actionLabel?: string;
  actionPayload?: Record<string, unknown>;
  confidence: number;
  impactEstimate?: string;
  isApplied: boolean;
  isDismissed: boolean;
  createdAt: string;
}

export interface UserPersonalization {
  prefs: {
    preferredTone: string;
    preferredLength: string;
    totalInteractions: number;
    successfulInteractions: number;
    toneSuccessRates: Record<string, number>;
    topTopics: string[];
    lastLearnedAt: string | null;
  } | null;
  personalization: {
    systemPromptAddition: string;
    preferredTone: string;
    successRate: number;
  } | null;
  successRate: number;
}

// ── Track an interaction ───────────────────────────────────────────────────

export function useTrackInteraction() {
  const sessionId = useSession();
  return useMutation({
    mutationFn: async (data: {
      interactionType?: "chat" | "dm_reply" | "studio_output" | "autopilot";
      context?: string;
      aiOutput: string;
      provider?: string;
      projectId?: number;
      wasAccepted?: boolean;
      gotReply?: boolean;
      responseTimeMs?: number;
    }) => req<{ ok: boolean; tone: string }>(api("/learning/track"), {
      method: "POST",
      body: JSON.stringify({ sessionId, ...data }),
    }),
  });
}

// ── Mark outcome of a tracked interaction ──────────────────────────────────

export function useUpdateInteractionOutcome() {
  return useMutation({
    mutationFn: (data: { id: number; wasAccepted?: boolean; gotReply?: boolean }) =>
      req<{ ok: boolean }>(api(`/learning/track/${data.id}`), {
        method: "PATCH",
        body: JSON.stringify({ wasAccepted: data.wasAccepted, gotReply: data.gotReply }),
      }),
  });
}

// ── Insights for the current user ─────────────────────────────────────────

export function useInsights(limit = 8) {
  const sessionId = useSession();
  return useQuery({
    queryKey: ["ai-insights", sessionId, limit],
    queryFn: () => req<{ insights: AiInsight[] }>(api(`/learning/insights?limit=${limit}`), {
      headers: { "x-session-id": sessionId },
    }),
    enabled: !!sessionId,
    staleTime: 2 * 60_000,
    refetchInterval: 5 * 60_000,
  });
}

// ── Project-level optimization insights ───────────────────────────────────

export function useProjectInsights(projectId: number | null) {
  return useQuery({
    queryKey: ["project-insights", projectId],
    queryFn: () => req<{ insights: AiInsight[] }>(api(`/learning/insights/project/${projectId}`)),
    enabled: !!projectId,
    staleTime: 5 * 60_000,
  });
}

// ── User personalization profile ──────────────────────────────────────────

export function usePersonalization() {
  const sessionId = useSession();
  return useQuery({
    queryKey: ["ai-personalization", sessionId],
    queryFn: () => req<UserPersonalization>(api("/learning/personalization"), {
      headers: { "x-session-id": sessionId },
    }),
    enabled: !!sessionId,
    staleTime: 5 * 60_000,
  });
}

// ── Global trends ─────────────────────────────────────────────────────────

export function useTrends() {
  return useQuery({
    queryKey: ["ai-trends"],
    queryFn: () => req<{ trends: AiInsight[] }>(api("/learning/trends")),
    staleTime: 10 * 60_000,
  });
}

// ── Dismiss / Apply insight ───────────────────────────────────────────────

export function useDismissInsight() {
  const qc = useQueryClient();
  const sessionId = useSession();
  return useMutation({
    mutationFn: (id: number) => req<{ ok: boolean }>(api(`/learning/insights/${id}/dismiss`), { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-insights", sessionId] }),
  });
}

export function useApplyInsight() {
  const qc = useQueryClient();
  const sessionId = useSession();
  return useMutation({
    mutationFn: (id: number) => req<{ ok: boolean }>(api(`/learning/insights/${id}/apply`), { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-insights", sessionId] }),
  });
}

// ── Trigger manual learning cycle ─────────────────────────────────────────

export function useTriggerLearning() {
  const qc = useQueryClient();
  const sessionId = useSession();
  return useMutation({
    mutationFn: () => req<{ ok: boolean; insightsGenerated: number; usersUpdated: number }>(api("/learning/learn"), { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-insights", sessionId] });
      qc.invalidateQueries({ queryKey: ["ai-trends"] });
      qc.invalidateQueries({ queryKey: ["ai-personalization", sessionId] });
    },
  });
}
