import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/hooks/use-session";

export interface DailyUsage { requestsUsed: number; requestsLimit: number; tier: string; resetAt: string }

/** Today's AI message count against the plan's daily limit. */
export function useDailyUsage() {
  const sessionId = useSession();
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return useQuery({
    queryKey: ["daily-usage", sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const res = await fetch(`${base}/api/usage?sessionId=${encodeURIComponent(sessionId)}`);
      if (!res.ok) throw new Error("usage check failed");
      return (await res.json()) as DailyUsage;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
