import { useGetUsage, getGetUsageQueryKey, useGetVoteStats } from "@workspace/api-client-react";
import { useSession } from "@/hooks/use-session";
import { Activity, Zap, RefreshCw, Trophy } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

const providerNames: Record<string, string> = {
  openai: "GPT-4",
  claude: "Claude 3",
  perplexity: "Perplexity",
};

const providerBarColors: Record<string, string> = {
  openai: "bg-[#10a37f]",
  claude: "bg-[#d97757]",
  perplexity: "bg-[#228be6]",
};

const providerTextColors: Record<string, string> = {
  openai: "text-[#10a37f]",
  claude: "text-[#d97757]",
  perplexity: "text-[#228be6]",
};

export default function Usage() {
  const sessionId = useSession();

  const { data: usage, isLoading: usageLoading } = useGetUsage(
    { sessionId },
    { query: { enabled: !!sessionId, queryKey: getGetUsageQueryKey({ sessionId }) } }
  );

  const { data: voteStats, isLoading: votesLoading } = useGetVoteStats();

  const isLoading = usageLoading || votesLoading;

  const sortedProviders = voteStats?.providers
    ? [...voteStats.providers].sort((a, b) => b.votes - a.votes)
    : [];

  const winner = sortedProviders[0];

  return (
    <div className="flex flex-col h-full bg-background overflow-y-auto pb-24">
      <div className="p-4 border-b border-border/50 sticky top-0 bg-background/80 backdrop-blur-md z-10 flex justify-between items-center">
        <div>
          <h1 className="font-mono font-bold text-xl tracking-tight flex items-center gap-2">
            <span className="text-primary">/</span>
            <span>SYSTEM</span>
          </h1>
          <p className="text-muted-foreground text-xs mt-1">Usage stats and AI performance leaderboard</p>
        </div>
        {usage && (
          <Badge
            variant={usage.tier === "premium" ? "default" : "secondary"}
            className="uppercase font-mono tracking-widest text-[10px]"
          >
            {usage.tier} Tier
          </Badge>
        )}
      </div>

      <div className="p-4 flex flex-col gap-6 pt-6">
        {isLoading ? (
          <div className="flex justify-center p-8">
            <Activity className="w-8 h-8 text-primary animate-pulse" />
          </div>
        ) : (
          <>
            {/* Usage card */}
            {usage && (
              <div className="bg-card border border-border rounded-2xl p-6 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                  <Zap className="w-24 h-24" />
                </div>

                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-widest mb-6">
                  API Requests
                </h2>

                <div className="flex items-end justify-between mb-2">
                  <div className="font-mono text-4xl font-light">
                    {usage.requestsUsed}
                    <span className="text-muted-foreground text-xl">
                      /{usage.requestsLimit}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {Math.round((usage.requestsUsed / usage.requestsLimit) * 100)}% USED
                  </div>
                </div>

                <Progress
                  value={(usage.requestsUsed / usage.requestsLimit) * 100}
                  className="h-2 bg-muted mb-6"
                />

                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-background/50 rounded-lg p-3">
                  <RefreshCw className="w-4 h-4" />
                  <span>Resets at {new Date(usage.resetAt).toLocaleString()}</span>
                </div>
              </div>
            )}

            {/* AI Leaderboard */}
            <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
              <div className="flex items-center gap-2 mb-1">
                <Trophy className="w-4 h-4 text-yellow-400" />
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
                  AI Battle Leaderboard
                </h2>
              </div>
              <p className="text-[10px] font-mono text-muted-foreground mb-6">
                Votes cast in Battle Mode — based on real performance
              </p>

              {voteStats && voteStats.total === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Trophy className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No votes yet</p>
                  <p className="text-xs mt-1 opacity-60">Use Battle Mode and vote for the best AI response</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {sortedProviders.map((p, idx) => (
                    <div key={p.provider} data-testid={`leaderboard-${p.provider}`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          {idx === 0 && voteStats && voteStats.total > 0 && (
                            <span className="text-yellow-400 text-xs">1st</span>
                          )}
                          {idx === 1 && <span className="text-slate-400 text-xs">2nd</span>}
                          {idx === 2 && <span className="text-amber-600 text-xs">3rd</span>}
                          <span
                            className={`text-xs font-mono font-bold uppercase tracking-widest ${
                              providerTextColors[p.provider] ?? "text-muted-foreground"
                            }`}
                          >
                            {providerNames[p.provider] ?? p.provider}
                          </span>
                          {idx === 0 && winner && winner.votes > 0 && (
                            <Trophy className="w-3 h-3 text-yellow-400" />
                          )}
                        </div>
                        <div className="text-xs font-mono text-muted-foreground">
                          {p.votes} vote{p.votes !== 1 ? "s" : ""} · {p.percentage}%
                        </div>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            providerBarColors[p.provider] ?? "bg-primary"
                          }`}
                          style={{ width: `${p.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}

                  {voteStats && (
                    <p className="text-[10px] font-mono text-muted-foreground text-right mt-2">
                      {voteStats.total} total vote{voteStats.total !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Upgrade prompt */}
            {usage?.tier === "free" && (
              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 text-center">
                <Zap className="w-8 h-8 text-primary mx-auto mb-3" />
                <h3 className="font-bold mb-2">Upgrade to Premium</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Unlock 500 daily requests, battle mode, and priority routing.
                </p>
                <button className="bg-primary text-primary-foreground font-bold py-2.5 px-6 rounded-full text-sm w-full shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all">
                  INITIALIZE UPGRADE
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
