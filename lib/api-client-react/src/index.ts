/**
 * React Query hooks for the Apex API (chat, usage, votes, screenshot analysis).
 */
import {
  useMutation,
  useQuery,
  type QueryKey,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";
import type {
  AnalyzeScreenshotBody,
  AnalyzeScreenshotResponse,
  CastVoteBody,
  GetUsageQueryParams,
  SendChatBody,
  SendChatResponse,
  UsageResponse,
  VoteStatsResponse,
} from "@workspace/api-zod";

export type * from "@workspace/api-zod";

const API_BASE = "/api";

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(body?.error ?? `Request failed (${res.status})`, res.status, body?.code);
  }
  return body as T;
}

function post<T>(path: string, data: unknown): Promise<T> {
  return request<T>(path, { method: "POST", body: JSON.stringify(data) });
}

type MutationOptions<TData, TBody> = {
  mutation?: Omit<UseMutationOptions<TData, ApiError, { data: TBody }>, "mutationFn">;
};

type QueryOptions<TData> = {
  query?: Partial<UseQueryOptions<TData, ApiError>> & { queryKey?: QueryKey };
};

// ── Chat ──────────────────────────────────────────────────────────────────────
export function useSendChat(options?: MutationOptions<SendChatResponse, SendChatBody>) {
  return useMutation({
    ...options?.mutation,
    mutationFn: ({ data }) => post<SendChatResponse>("/chat", data),
  });
}

export function useAnalyzeScreenshot(
  options?: MutationOptions<AnalyzeScreenshotResponse, AnalyzeScreenshotBody>,
) {
  return useMutation({
    ...options?.mutation,
    mutationFn: ({ data }) => post<AnalyzeScreenshotResponse>("/chat/analyze-screenshot", data),
  });
}

// ── Usage ─────────────────────────────────────────────────────────────────────
export function getGetUsageQueryKey(params?: GetUsageQueryParams): QueryKey {
  return ["/api/usage", ...(params ? [params] : [])];
}

export function useGetUsage(params?: GetUsageQueryParams, options?: QueryOptions<UsageResponse>) {
  const search = params?.sessionId ? `?sessionId=${encodeURIComponent(params.sessionId)}` : "";
  return useQuery({
    queryKey: getGetUsageQueryKey(params),
    ...options?.query,
    queryFn: () => request<UsageResponse>(`/usage${search}`),
  });
}

// ── Votes ─────────────────────────────────────────────────────────────────────
export function useCastVote(options?: MutationOptions<{ success: boolean; provider: string }, CastVoteBody>) {
  return useMutation({
    ...options?.mutation,
    mutationFn: ({ data }) => post<{ success: boolean; provider: string }>("/votes", data),
  });
}

export function getGetVoteStatsQueryKey(): QueryKey {
  return ["/api/votes/stats"];
}

export function useGetVoteStats(options?: QueryOptions<VoteStatsResponse>) {
  return useQuery({
    queryKey: getGetVoteStatsQueryKey(),
    ...options?.query,
    queryFn: () => request<VoteStatsResponse>("/votes/stats"),
  });
}
