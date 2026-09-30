import { useQuery } from "@tanstack/react-query";
import { authHeaders, getAuthSessionId } from "@/lib/authSession";

export interface Credits {
  tier: string;
  used: number;
  /** Daily allowance plus today's bonus; -1 = unlimited */
  limit: number;
  bonus: number;
  /** -1 = unlimited */
  remaining: number;
  unlimited: boolean;
  resetsAt: string;
  /** Credits per reply, by model id */
  costs: Record<string, number>;
  isOwner?: boolean;
  /** Models running on the person's own key (free) */
  ownKeys?: string[];
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

/** Today's AI credits for the signed-in person. */
export function useCredits() {
  return useQuery({
    queryKey: ["credits"],
    enabled: !!getAuthSessionId(),
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/credits`, { headers: authHeaders() });
      if (!res.ok) throw new Error("credits check failed");
      const json = (await res.json()) as { data: Credits };
      return json.data;
    },
    staleTime: 20_000,
    refetchInterval: 60_000,
  });
}

/** "in 5h 12m" until the daily reset */
export function resetsIn(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "soon";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h ? `in ${h}h ${m}m` : `in ${m}m`;
}

/** Open the credits sheet from anywhere (e.g. after a chat hits the limit). */
export function openCreditsSheet(reason: "info" | "out" = "info", message?: string) {
  window.dispatchEvent(new CustomEvent("apex:credits-sheet", { detail: { reason, message } }));
}
