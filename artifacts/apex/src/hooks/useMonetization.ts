import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "./use-session";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
function api(path: string) { return `${BASE}/api${path}`; }

async function req<T>(url: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(url, { headers: { "Content-Type": "application/json", ...((opts?.headers) || {}) }, ...opts });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<T>;
}

// ── Types ──────────────────────────────────────────────────────────────────

export type SubscriptionTier = "free" | "pro" | "creator_pro" | "enterprise";

export interface Plan {
  id: string;
  name: string;
  description: string | null;
  tier: SubscriptionTier;
  features: string[];
  prices: { id: string; amount: number; currency: string; interval: string }[];
}

export interface Purchase {
  id: number;
  userId: number;
  projectId: number;
  amount: number;
  createdAt: string;
}

export interface AccessCheckResult {
  hasAccess: boolean;
  reason: string;
  price?: number;
  accessType?: string;
  title?: string;
}

export interface EarningsSummary {
  earnings: { id: number; creatorId: number; sourceProjectId: number; grossAmount: number; platformFee: number; netAmount: number; createdAt: string }[];
  totalNet: number;
  totalGross: number;
  byProject: { projectId: number; net: number; gross: number; sales: number }[];
}

// ── Subscription status ────────────────────────────────────────────────────

export function useSubscriptionStatus() {
  const sessionId = useSession();
  return useQuery({
    queryKey: ["subscription-status", sessionId],
    queryFn: () => req<{ tier: SubscriptionTier; status: string }>(api("/stripe/subscription-status"), {
      headers: { "x-session-id": sessionId },
    }),
    enabled: !!sessionId,
    staleTime: 60_000,
  });
}

// ── Plans ──────────────────────────────────────────────────────────────────

export function usePlans() {
  return useQuery({
    queryKey: ["stripe-plans"],
    queryFn: () => req<{ plans: Plan[] }>(api("/stripe/products")),
    staleTime: 5 * 60_000,
  });
}

// ── Checkout ───────────────────────────────────────────────────────────────

export function useCheckout() {
  const sessionId = useSession();
  return useMutation({
    mutationFn: async (data: { priceId: string; projectId?: number; successPath?: string; cancelPath?: string }) => {
      const result = await req<{ url: string }>(api("/stripe/checkout"), {
        method: "POST",
        body: JSON.stringify({ sessionId, ...data }),
      });
      if (result.url) window.location.href = result.url;
      return result;
    },
  });
}

// ── Customer portal ────────────────────────────────────────────────────────

export function useCustomerPortal() {
  const sessionId = useSession();
  return useMutation({
    mutationFn: async () => {
      const result = await req<{ url: string }>(api("/stripe/portal"), {
        method: "POST",
        body: JSON.stringify({ sessionId }),
      });
      if (result.url) window.location.href = result.url;
    },
  });
}

// ── Access check ───────────────────────────────────────────────────────────

export function useAccessCheck(projectId: number | null) {
  const sessionId = useSession();
  return useQuery({
    queryKey: ["access-check", projectId, sessionId],
    queryFn: () => req<AccessCheckResult>(api(`/stripe/access-check?projectId=${projectId}&sessionId=${sessionId}`), {
      headers: { "x-session-id": sessionId },
    }),
    enabled: !!projectId && !!sessionId,
    staleTime: 30_000,
  });
}

// ── My purchases ───────────────────────────────────────────────────────────

export function useMyPurchases() {
  const sessionId = useSession();
  return useQuery({
    queryKey: ["my-purchases", sessionId],
    queryFn: () => req<{ purchases: Purchase[] }>(api("/stripe/my-purchases"), {
      headers: { "x-session-id": sessionId },
    }),
    enabled: !!sessionId,
    staleTime: 60_000,
  });
}

// ── Creator earnings ───────────────────────────────────────────────────────

export function useCreatorEarnings() {
  const sessionId = useSession();
  return useQuery({
    queryKey: ["creator-earnings", sessionId],
    queryFn: () => req<EarningsSummary>(api("/stripe/creator-earnings"), {
      headers: { "x-session-id": sessionId },
    }),
    enabled: !!sessionId,
    staleTime: 60_000,
  });
}
