import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Brain, TrendingUp, Zap, User, Sparkles, RefreshCw, BarChart3 } from "lucide-react";
import { NotificationBell } from "@/components/social/NotificationBell";
import { InsightCard } from "@/components/ai/InsightCard";
import { PersonalizationBadge } from "@/components/ai/PersonalizationBadge";
import { useInsights, usePersonalization, useTrends, useTriggerLearning } from "@/hooks/useAILearning";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type InsightFilter = "all" | "trend" | "optimization" | "recommendation";

const FILTER_CONFIG: { id: InsightFilter; label: string; icon: React.ReactNode }[] = [
  { id: "all", label: "All", icon: <Brain size={11} /> },
  { id: "trend", label: "Trends", icon: <TrendingUp size={11} /> },
  { id: "optimization", label: "Optimize", icon: <Zap size={11} /> },
  { id: "recommendation", label: "For You", icon: <User size={11} /> },
];

const TONE_LABELS: Record<string, { emoji: string; desc: string; color: string }> = {
  confident: { emoji: "💪", desc: "You communicate with authority. Direct, certain, impactful.", color: "#ffcc33" },
  flirty: { emoji: "😏", desc: "Playful and charming. Your messages draw people in naturally.", color: "#f472b6" },
  humorous: { emoji: "😄", desc: "Wit and lightness. You make conversations fun.", color: "#34d399" },
  professional: { emoji: "👔", desc: "Clear, structured, polished. You command respect.", color: "#38bdf8" },
  casual: { emoji: "😎", desc: "Relaxed and real. People feel comfortable around you.", color: "#a78bfa" },
  balanced: { emoji: "⚖️", desc: "Adaptable and natural. You read the room well.", color: "#888" },
};

export default function InsightsPage() {
  const [, nav] = useLocation();
  const [filter, setFilter] = useState<InsightFilter>("all");
  const { data: insightsData, isLoading } = useInsights(20);
  const { data: personData } = usePersonalization();
  const { data: trendsData } = useTrends();
  const trigger = useTriggerLearning();

  const allInsights = insightsData?.insights ?? [];
  const filtered = filter === "all" ? allInsights : allInsights.filter((i) => i.insightType === filter);

  const prefs = personData?.prefs;
  const tone = prefs?.preferredTone ?? "balanced";
  const toneInfo = TONE_LABELS[tone] ?? TONE_LABELS.balanced;
  const successRate = personData?.successRate ?? 0;
  const totalInteractions = prefs?.totalInteractions ?? 0;

  const trends = trendsData?.trends ?? [];

  return (
    <div className="flex flex-col h-full bg-background overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => window.history.length > 1 ? window.history.back() : nav('/')} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-white">AI Insights</h1>
            <p className="text-xs text-white/40">Learning from your behavior</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <Button
            size="sm"
            className="h-7 px-2 bg-white/5 text-white/50 hover:bg-white/10 text-xs"
            onClick={() => trigger.mutate()}
            disabled={trigger.isPending}
          >
            <RefreshCw size={11} className={cn("mr-1", trigger.isPending && "animate-spin")} />
            {trigger.isPending ? "Learning…" : "Learn Now"}
          </Button>
        </div>
      </div>

      {/* Learning feedback banner */}
      {trigger.data && (
        <div className="mx-4 mb-3 p-3 rounded-xl bg-green-500/15 border border-green-500/30 text-green-400 text-xs text-center">
          ✓ Learning cycle complete — {trigger.data.insightsGenerated} insights generated, {trigger.data.usersUpdated} users updated
        </div>
      )}

      {/* Personalization profile card */}
      {totalInteractions >= 3 && (
        <div
          className="mx-4 mb-4 p-4 rounded-2xl border"
          style={{ borderColor: `${toneInfo.color}22`, background: `${toneInfo.color}08` }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="text-2xl">{toneInfo.emoji}</div>
            <div>
              <p className="text-xs text-white/40 uppercase tracking-wider font-medium">Your AI Personality</p>
              <p className="text-sm font-bold text-white capitalize">{tone} Style</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-lg font-bold" style={{ color: toneInfo.color }}>{Math.round(successRate * 100)}%</p>
              <p className="text-[10px] text-white/30">success rate</p>
            </div>
          </div>
          <p className="text-xs text-white/50 leading-relaxed mb-3">{toneInfo.desc}</p>

          {/* Tone success rates bar */}
          {prefs?.toneSuccessRates && Object.keys(prefs.toneSuccessRates).length > 0 && (
            <div className="space-y-1.5">
              {Object.entries(prefs.toneSuccessRates as Record<string, number>)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 4)
                .map(([t, rate]) => (
                  <div key={t} className="flex items-center gap-2">
                    <span className="text-[10px] text-white/40 w-20 capitalize">{t}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${Math.round((rate as number) * 100)}%`, background: TONE_LABELS[t]?.color ?? "#ffcc33" }}
                      />
                    </div>
                    <span className="text-[10px] text-white/30 w-8 text-right">{Math.round((rate as number) * 100)}%</span>
                  </div>
                ))}
            </div>
          )}

          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/5">
            <div className="text-center flex-1">
              <p className="text-sm font-bold text-white">{totalInteractions}</p>
              <p className="text-[10px] text-white/30">interactions</p>
            </div>
            <div className="text-center flex-1">
              <p className="text-sm font-bold text-white">{prefs?.successfulInteractions ?? 0}</p>
              <p className="text-[10px] text-white/30">successes</p>
            </div>
            <div className="text-center flex-1">
              <p className="text-sm font-bold" style={{ color: toneInfo.color }}>Active</p>
              <p className="text-[10px] text-white/30">AI tuned</p>
            </div>
          </div>
        </div>
      )}

      {totalInteractions < 3 && (
        <div className="mx-4 mb-4 p-4 rounded-2xl bg-white/3 border border-white/5 text-center">
          <Brain size={24} className="text-white/20 mx-auto mb-2" />
          <p className="text-sm font-bold text-white mb-1">AI is still learning</p>
          <p className="text-xs text-white/40 leading-relaxed">
            Use Chat, DMs, and Studio to generate data. After a few interactions, the AI will start personalizing itself to you automatically.
          </p>
        </div>
      )}

      {/* Trend chips */}
      {trends.length > 0 && (
        <div className="px-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={12} className="text-[#ffcc33]" />
            <span className="text-xs font-bold text-white">Trending Now</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {trends.map((t) => {
              const payload = t.actionPayload as { tags?: string[] } | null;
              return (payload?.tags ?? []).map((tag) => (
                <button
                  key={tag}
                  onClick={() => nav("/marketplace")}
                  className="px-3 py-1 rounded-full text-xs font-medium"
                  style={{ background: "#ffcc3322", color: "#ffcc33" }}
                >
                  {tag.charAt(0).toUpperCase() + tag.slice(1)} ↗
                </button>
              ));
            }).flat()}
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 px-4 mb-4 overflow-x-auto no-scrollbar">
        {FILTER_CONFIG.map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
              filter === id ? "font-bold text-black" : "bg-white/5 text-white/50 hover:text-white/80"
            )}
            style={filter === id ? { background: "#ffcc33", color: "#000" } : undefined}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* Insights list */}
      <div className="px-4 space-y-3 pb-6">
        {isLoading && (
          <>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 rounded-2xl bg-white/5 animate-pulse" />
            ))}
          </>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-12">
            <Sparkles size={28} className="text-white/15 mx-auto mb-3" />
            <p className="text-sm font-bold text-white/40">No insights yet</p>
            <p className="text-xs text-white/25 mt-1">
              Use the platform and hit "Learn Now" to generate your first AI insights.
            </p>
          </div>
        )}

        {filtered.map((insight) => (
          <InsightCard key={insight.id} insight={insight} compact={false} />
        ))}
      </div>
    </div>
  );
}
