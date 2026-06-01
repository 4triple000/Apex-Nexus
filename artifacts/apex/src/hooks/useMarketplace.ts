import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
function apiUrl(path: string) { return `${BASE}api${path}`; }

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as T;
}

export type FeedSort = "trending" | "newest" | "top_rated" | "most_played";

export interface MarketplaceItem {
  id: number;
  workflowId: number;
  title: string;
  description?: string | null;
  tags: string[];
  category: string;
  thumbnailEmoji: string;
  authorName: string;
  playCount: number;
  ratingAvg: number;
  ratingCount: number;
  remixCount: number;
  rankingScore: number;
  isFeatured: boolean;
  publishedAt: string;
  steps?: unknown[];
}

export interface CreatorStats {
  totalWorkflows: number;
  totalPlays: number;
  totalRatings: number;
  totalRemixes: number;
  avgRating: number;
  topWorkflow: { title: string; playCount: number; ratingAvg: number } | null;
  publishedCount: number;
}

export function useMarketplaceFeed(sort: FeedSort = "trending", search = "", category = "") {
  return useQuery({
    queryKey: ["marketplace-feed", sort, search, category],
    queryFn: () =>
      request<{ items: MarketplaceItem[] }>(
        apiUrl(`/marketplace/feed?sort=${sort}&search=${encodeURIComponent(search)}&category=${category}`)
      ).then((d) => d.items),
    refetchInterval: 30000,
  });
}

export function useCreatorStats() {
  return useQuery({
    queryKey: ["creator-stats"],
    queryFn: () => request<CreatorStats>(apiUrl("/marketplace/creator-dashboard")),
  });
}

export function usePublishWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      workflowId: number;
      title: string;
      description?: string;
      tags?: string[];
      category?: string;
      thumbnailEmoji?: string;
      authorName?: string;
    }) =>
      request<{ item: MarketplaceItem }>(apiUrl("/marketplace/publish"), {
        method: "POST",
        body: JSON.stringify(data),
      }).then((d) => d.item),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketplace-feed"] });
      qc.invalidateQueries({ queryKey: ["creator-stats"] });
    },
  });
}

export function useRemixWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (workflowId: number) =>
      request<{ workflowId: number; message: string }>(apiUrl(`/marketplace/${workflowId}/remix`), {
        method: "POST",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketplace-feed"] });
      qc.invalidateQueries({ queryKey: ["workflows"] });
    },
  });
}

export function useRateWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { marketplaceItemId: number; workflowId: number; rating: number; review?: string }) =>
      request<{ success: boolean }>(apiUrl("/marketplace/rate"), {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marketplace-feed"] }),
  });
}

export function useTrackPlay() {
  return useMutation({
    mutationFn: (data: { marketplaceItemId: number; workflowId: number; sessionDurationMs?: number; completed?: boolean }) =>
      request<{ success: boolean }>(apiUrl("/marketplace/track-play"), {
        method: "POST",
        body: JSON.stringify(data),
      }),
  });
}

export function useRunMarketplaceWorkflow() {
  return useMutation({
    mutationFn: (data: { workflowId: number; inputs: Record<string, string> }) =>
      request<{ steps: { stepName: string; output: string; success: boolean }[]; finalOutput: string }>(
        apiUrl("/workflows/run"),
        { method: "POST", body: JSON.stringify(data) }
      ),
  });
}
