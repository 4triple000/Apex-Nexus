import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

export interface StudioMarketplaceItem {
  id: number;
  studioProjectId: number | null;
  title: string;
  description: string | null;
  type: "game" | "ai_tool" | "app" | "automation" | "media";
  thumbnail: string;
  authorName: string;
  nodes: unknown[];
  edges: unknown[];
  isPublic: boolean;
  likes: number;
  plays: number;
  remixes: number;
  publishedAt: string;
  updatedAt: string;
}

export interface ExecStep {
  nodeId: string;
  nodeType: string;
  label: string;
  output: string;
  success: boolean;
}

export interface RunResult {
  executionLog: ExecStep[];
  finalOutput: string;
  context: Record<string, string>;
}

// ─────────────────────────────────────────────────────────────
// LIST
// ─────────────────────────────────────────────────────────────

export function useStudioMarketplace(opts?: { type?: string; search?: string; sort?: string }) {
  const params = new URLSearchParams();
  if (opts?.type && opts.type !== "all") params.set("type", opts.type);
  if (opts?.search) params.set("search", opts.search);
  if (opts?.sort) params.set("sort", opts.sort);
  const qs = params.toString() ? `?${params.toString()}` : "";

  return useQuery<{ items: StudioMarketplaceItem[] }>({
    queryKey: ["studio-marketplace", opts?.type, opts?.search, opts?.sort],
    queryFn: async () => {
      const res = await fetch(`${API}/marketplace/studio/items${qs}`);
      if (!res.ok) throw new Error("Failed to load marketplace");
      return res.json() as Promise<{ items: StudioMarketplaceItem[] }>;
    },
    staleTime: 30_000,
  });
}

// ─────────────────────────────────────────────────────────────
// SINGLE ITEM
// ─────────────────────────────────────────────────────────────

export function useStudioMarketplaceItem(id: number | null) {
  return useQuery<{ item: StudioMarketplaceItem }>({
    queryKey: ["studio-marketplace-item", id],
    queryFn: async () => {
      const res = await fetch(`${API}/marketplace/studio/items/${id}`);
      if (!res.ok) throw new Error("Not found");
      return res.json() as Promise<{ item: StudioMarketplaceItem }>;
    },
    enabled: id !== null,
  });
}

// ─────────────────────────────────────────────────────────────
// PUBLISH
// ─────────────────────────────────────────────────────────────

export interface PublishPayload {
  studioProjectId?: number;
  title: string;
  description?: string;
  type: "game" | "ai_tool" | "app" | "automation" | "media";
  thumbnail: string;
  authorName?: string;
  sessionId?: string;
  nodes: unknown[];
  edges: unknown[];
}

export function usePublishToMarketplace() {
  const qc = useQueryClient();
  return useMutation<{ item: StudioMarketplaceItem; updated?: boolean }, Error, PublishPayload>({
    mutationFn: async (payload) => {
      const res = await fetch(`${API}/marketplace/studio/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error: string };
        throw new Error(err.error);
      }
      return res.json() as Promise<{ item: StudioMarketplaceItem; updated?: boolean }>;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["studio-marketplace"] });
      void qc.invalidateQueries({ queryKey: ["studio-projects"] });
    },
  });
}

// ─────────────────────────────────────────────────────────────
// RUN
// ─────────────────────────────────────────────────────────────

export function useRunMarketplaceItem() {
  return useMutation<RunResult, Error, { id: number; inputs: Record<string, string> }>({
    mutationFn: async ({ id, inputs }) => {
      const res = await fetch(`${API}/marketplace/studio/items/${id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error: string };
        throw new Error(err.error);
      }
      return res.json() as Promise<RunResult>;
    },
  });
}

// ─────────────────────────────────────────────────────────────
// LIKE
// ─────────────────────────────────────────────────────────────

export function useLikeMarketplaceItem() {
  const qc = useQueryClient();
  return useMutation<{ likes: number }, Error, number>({
    mutationFn: async (id) => {
      const res = await fetch(`${API}/marketplace/studio/items/${id}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to like");
      return res.json() as Promise<{ likes: number }>;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["studio-marketplace"] });
    },
  });
}

// ─────────────────────────────────────────────────────────────
// REMIX
// ─────────────────────────────────────────────────────────────

export function useRemixMarketplaceItem() {
  const qc = useQueryClient();
  return useMutation<{ project: { id: number; title: string } }, Error, number>({
    mutationFn: async (id) => {
      const res = await fetch(`${API}/marketplace/studio/items/${id}/remix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const err = (await res.json()) as { error: string };
        throw new Error(err.error);
      }
      return res.json() as Promise<{ project: { id: number; title: string } }>;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["studio-marketplace"] });
      void qc.invalidateQueries({ queryKey: ["studio-projects"] });
    },
  });
}

// ─────────────────────────────────────────────────────────────
// SEED
// ─────────────────────────────────────────────────────────────

export function useSeedStudioMarketplace() {
  const qc = useQueryClient();
  return useMutation<{ success: boolean }, Error, void>({
    mutationFn: async () => {
      const res = await fetch(`${API}/marketplace/studio/seed`, { method: "POST" });
      if (!res.ok) throw new Error("Seed failed");
      return res.json() as Promise<{ success: boolean }>;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["studio-marketplace"] });
    },
  });
}
