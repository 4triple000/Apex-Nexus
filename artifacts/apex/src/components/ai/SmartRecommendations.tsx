import { Brain, RefreshCw } from "lucide-react";
import { useInsights, useTriggerLearning } from "@/hooks/useAILearning";
import { InsightCard } from "./InsightCard";
import { useSession } from "@/hooks/use-session";

interface SmartRecommendationsProps {
  compact?: boolean;
  maxItems?: number;
  showTitle?: boolean;
}

export function SmartRecommendations({ compact = true, maxItems = 3, showTitle = true }: SmartRecommendationsProps) {
  const sessionId = useSession();
  const { data, isLoading } = useInsights(maxItems);
  const trigger = useTriggerLearning();

  const insights = data?.insights ?? [];
  if (insights.length === 0 && !isLoading) return null;

  return (
    <div className="mb-4">
      {showTitle && (
        <div className="flex items-center justify-between mb-2 px-4">
          <div className="flex items-center gap-2">
            <Brain size={13} className="text-[#A29BFE]" />
            <span className="text-xs font-bold text-white">AI Recommendations</span>
          </div>
          <button
            onClick={() => trigger.mutate()}
            disabled={trigger.isPending}
            className="text-white/30 hover:text-white/60 transition-colors"
          >
            <RefreshCw size={11} className={trigger.isPending ? "animate-spin" : ""} />
          </button>
        </div>
      )}

      <div className={`space-y-2 ${showTitle ? "px-4" : ""}`}>
        {isLoading && (
          <>
            {[0, 1].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />
            ))}
          </>
        )}
        {insights.map((insight) => (
          <InsightCard key={insight.id} insight={insight} compact={compact} />
        ))}
      </div>
    </div>
  );
}
