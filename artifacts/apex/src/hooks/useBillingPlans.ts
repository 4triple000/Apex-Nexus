/**
 * useBillingPlans — fetches plan data from /api/billing/plans
 * Returns plans enriched with Stripe prices when available,
 * or static data as fallback.
 */
import { useQuery } from "@tanstack/react-query";
import { useSession } from "./use-session";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface BillingPlan {
  tier:          string;
  name:          string;
  description:   string;
  priceMonthly:  number;
  priceYearly:   number;
  currency:      string;
  badgeColor:    string;
  features:      string[];
  limits: {
    aiCallsPerDay:             number;
    buildsPerDay:              number;
    maxProjects:               number;
    deploymentsPerMonth:       number;
    autopilotEnabled:          boolean;
    studioEnabled:             boolean;
    marketplacePublishEnabled: boolean;
    realtimeCollabEnabled:     boolean;
  };
  stripePrices: { id: string; amount: number; currency: string; interval: string }[];
}

export function useBillingPlans() {
  const sessionId = useSession();
  return useQuery<{ plans: BillingPlan[] }>({
    queryKey: ["billing-plans"],
    queryFn: async () => {
      try {
        const r = await fetch(`${BASE}/api/billing/plans`, {
          headers: { "x-session-id": sessionId ?? "" },
        });
        if (!r.ok) throw new Error("billing plans failed");
        const body = await r.json() as { data?: { plans: BillingPlan[] }; plans?: BillingPlan[] };
        const plans = body.data?.plans ?? (body.plans as BillingPlan[] | undefined) ?? [];
        return { plans };
      } catch {
        return { plans: [] };
      }
    },
    staleTime: 5 * 60_000,
  });
}
