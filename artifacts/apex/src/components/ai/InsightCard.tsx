import { X, TrendingUp, Zap, User, BarChart2, ChevronRight, Sparkles } from "lucide-react";
import { useDismissInsight, useApplyInsight, type AiInsight } from "@/hooks/useAILearning";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

const TYPE_CONFIG = {
  trend: { icon: <TrendingUp size={13} />, color: "#A29BFE", label: "Trending" },
  optimization: { icon: <Zap size={13} />, color: "#34d399", label: "Optimize" },
  recommendation: { icon: <User size={13} />, color: "#a78bfa", label: "For You" },
  personalization: { icon: <Sparkles size={13} />, color: "#38bdf8", label: "Personalized" },
};

interface InsightCardProps {
  insight: AiInsight;
  compact?: boolean;
}

export function InsightCard({ insight, compact = false }: InsightCardProps) {
  const dismiss = useDismissInsight();
  const apply = useApplyInsight();
  const [, nav] = useLocation();
  const cfg = TYPE_CONFIG[insight.insightType] ?? TYPE_CONFIG.recommendation;

  const handleAction = () => {
    const payload = insight.actionPayload as { route?: string; tags?: string[] } | null;
    apply.mutate(insight.id);
    if (payload?.route) {
      nav(payload.route);
    }
  };

  if (compact) {
    return (
      <div
        className="flex items-start gap-3 p-3 rounded-xl border cursor-pointer hover:opacity-90 transition-opacity"
        style={{ borderColor: `${cfg.color}22`, background: `${cfg.color}08` }}
        onClick={handleAction}
      >
        <div className="mt-0.5 p-1.5 rounded-lg" style={{ background: `${cfg.color}22` }}>
          <span style={{ color: cfg.color }}>{cfg.icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-white truncate">{insight.title}</p>
          {insight.impactEstimate && (
            <p className="text-[10px] font-medium" style={{ color: cfg.color }}>{insight.impactEstimate}</p>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); dismiss.mutate(insight.id); }}
          className="text-white/20 hover:text-white/50 transition-colors flex-shrink-0"
        >
          <X size={12} />
        </button>
      </div>
    );
  }

  return (
    <div
      className="p-4 rounded-2xl border relative"
      style={{ borderColor: `${cfg.color}22`, background: `${cfg.color}08` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg" style={{ background: `${cfg.color}22` }}>
            <span style={{ color: cfg.color }}>{cfg.icon}</span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: cfg.color }}>
            {cfg.label}
          </span>
          {insight.confidence >= 0.8 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/30">High confidence</span>
          )}
        </div>
        <button
          onClick={() => dismiss.mutate(insight.id)}
          className="text-white/20 hover:text-white/50 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      <h4 className="text-sm font-bold text-white mb-1">{insight.title}</h4>
      <p className="text-xs text-white/50 leading-relaxed mb-3">{insight.description}</p>

      {/* Impact + Action */}
      <div className="flex items-center justify-between">
        {insight.impactEstimate && (
          <span className="text-xs font-bold" style={{ color: cfg.color }}>
            {insight.impactEstimate}
          </span>
        )}
        {insight.actionLabel && (
          <button
            onClick={handleAction}
            className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full transition-all"
            style={{ background: `${cfg.color}22`, color: cfg.color }}
          >
            {insight.actionLabel}
            <ChevronRight size={11} />
          </button>
        )}
      </div>
    </div>
  );
}
