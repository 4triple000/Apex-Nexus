/**
 * useBillingStatus — unified hook for the current user's subscription tier + limits.
 * Hits the existing /api/billing/status endpoint.
 * Returns sensible defaults if unauthenticated or Stripe unavailable.
 */

import { useQuery } from "@tanstack/react-query";
import { useSession } from "./use-session";
import { normalizeTierClient, tierCanAccessFeature, type ApexBillingTier } from "@/systems/tierAccess";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface BillingStatusResponse {
  tier:                 string;
  name:                 string;
  status:               string;
  hasActiveSubscription: boolean;
  periodEnd:            string | null;
  stripeCustomerId:     string | null;
  stripeSubscriptionId: string | null;
  limits: {
    aiCallsPerDay:             number;
    buildsPerDay:              number;
    maxProjects:               number;
    deploymentsPerMonth:       number;
    autopilotEnabled:          boolean;
    agentPipelinesEnabled:     boolean;
    studioEnabled:             boolean;
    marketplacePublishEnabled: boolean;
    realtimeCollabEnabled:     boolean;
    selfImprovementEnabled:    boolean;
    prioritySupport:           boolean;
  };
  badgeColor: string;
}

export interface BillingStatus {
  tier:                 ApexBillingTier;
  rawTier:              string;
  name:                 string;
  status:               string;
  isActive:             boolean;
  periodEnd:            string | null;
  limits:               BillingStatusResponse["limits"];
  badgeColor:           string;
  canAccess:            (featureId: string) => boolean;
}

const FREE_DEFAULTS: BillingStatus = {
  tier:       "free",
  rawTier:    "free",
  name:       "Free",
  status:     "inactive",
  isActive:   false,
  periodEnd:  null,
  badgeColor: "#6B7280",
  limits: {
    aiCallsPerDay: 50, buildsPerDay: 5, maxProjects: 3, deploymentsPerMonth: 2,
    autopilotEnabled: false, agentPipelinesEnabled: false, studioEnabled: true,
    marketplacePublishEnabled: false, realtimeCollabEnabled: false,
    selfImprovementEnabled: false, prioritySupport: false,
  },
  canAccess: (featureId) => tierCanAccessFeature("free", featureId),
};

export function useBillingStatus() {
  const sessionId = useSession();

  return useQuery<BillingStatus>({
    queryKey: ["billing-status", sessionId],
    queryFn: async () => {
      if (!sessionId) return FREE_DEFAULTS;
      try {
        const r = await fetch(`${BASE}/api/billing/status`, {
          headers: { "x-session-id": sessionId, "Content-Type": "application/json" },
        });
        if (!r.ok) return FREE_DEFAULTS;
        const raw = (await r.json()) as { data?: BillingStatusResponse } | BillingStatusResponse;
        // Handle both { data: {...} } and flat response shapes
        const d: BillingStatusResponse = ("data" in raw && raw.data) ? raw.data : raw as BillingStatusResponse;
        const tier = normalizeTierClient(d.tier);
        return {
          tier,
          rawTier:    d.tier,
          name:       d.name,
          status:     d.status,
          isActive:   d.hasActiveSubscription,
          periodEnd:  d.periodEnd,
          limits:     d.limits,
          badgeColor: d.badgeColor,
          canAccess:  (featureId) => tierCanAccessFeature(tier, featureId),
        };
      } catch {
        return FREE_DEFAULTS;
      }
    },
    staleTime: 60_000,
    enabled: true,
  });
}

/** Convenience hook — returns true if the user's current tier can access `featureId`. */
export function useTierCanAccess(featureId: string): boolean {
  const { data } = useBillingStatus();
  return data?.canAccess(featureId) ?? false;
}

/** Returns the current tier string. Defaults to "free". */
export function useCurrentTier(): ApexBillingTier {
  const { data } = useBillingStatus();
  return data?.tier ?? "free";
}
