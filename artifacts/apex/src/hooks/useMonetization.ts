import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "./use-session";
import { authHeaders } from "@/lib/authSession";

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

/** Starts Pro checkout (monthly). Older callers still pass a priceId; Apex's own prices are used instead. */
export function useCheckout() {
  return useMutation({
    mutationFn: async (data: { priceId?: string; projectId?: number; successPath?: string; cancelPath?: string; interval?: "month" | "year" }) => {
      const res = await fetch(api("/store/pro/checkout"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ interval: data.interval ?? "month", returnTo: `${window.location.origin}${BASE}${data.successPath?.split("?")[0] ?? "/pricing"}` }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: { url: string }; error?: string } | null;
      if (!res.ok || !json?.data?.url) throw new Error(json?.error ?? "Couldn't start checkout");
      window.location.href = json.data.url;
      return { url: json.data.url };
    },
  });
}

// ── Customer portal ────────────────────────────────────────────────────────

export function useCustomerPortal() {
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(api("/store/portal"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ returnTo: `${window.location.origin}${BASE}/pricing` }),
      });
      const json = (await res.json().catch(() => null)) as { data?: { url: string }; error?: string } | null;
      if (!res.ok || !json?.data?.url) throw new Error(json?.error ?? "Couldn't open subscription settings");
      window.location.href = json.data.url;
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
