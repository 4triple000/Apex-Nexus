/**
 * useWaitlist — hooks for the waitlist / notification system.
 * Backend: POST /api/waitlist/join, GET /api/waitlist/check/:featureId
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "./use-session";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
function api(path: string) { return `${BASE}/api${path}`; }

async function req<T>(url: string, opts?: RequestInit): Promise<T> {
  const { headers: extraHeaders, ...rest } = opts ?? {};
  const r = await fetch(url, {
    ...rest,
    headers: { "Content-Type": "application/json", ...(extraHeaders ?? {}) },
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<T>;
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface WaitlistStatus {
  joined:            boolean;
  email:             string | null;
  notifyEarlyAccess: boolean;
}

export interface JoinWaitlistInput {
  featureId:         string;
  email:             string;
  notifyEarlyAccess?: boolean;
}

// ── Check if user is on waitlist for a feature ─────────────────────────────

export function useWaitlistStatus(featureId: string) {
  const sessionId = useSession();
  return useQuery<WaitlistStatus>({
    queryKey: ["waitlist-status", featureId, sessionId],
    queryFn:  () => req<WaitlistStatus>(api(`/waitlist/check/${featureId}`), {
      headers: { "x-session-id": sessionId },
    }),
    enabled:  !!sessionId && !!featureId,
    staleTime: 60_000,
  });
}

// ── Join the waitlist ──────────────────────────────────────────────────────

export function useJoinWaitlist() {
  const sessionId   = useSession();
  const queryClient = useQueryClient();

  return useMutation<WaitlistStatus, Error, JoinWaitlistInput>({
    mutationFn: ({ featureId, email, notifyEarlyAccess = false }) =>
      req<WaitlistStatus>(api("/waitlist/join"), {
        method: "POST",
        headers: { "x-session-id": sessionId },
        body:   JSON.stringify({ featureId, email, notifyEarlyAccess, sessionId }),
      }),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(
        ["waitlist-status", variables.featureId, sessionId],
        data,
      );
    },
  });
}
