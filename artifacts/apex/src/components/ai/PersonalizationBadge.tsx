import { Sparkles } from "lucide-react";
import { usePersonalization } from "@/hooks/useAILearning";

const TONE_COLORS: Record<string, string> = {
  confident: "#ffcc33",
  flirty: "#f472b6",
  humorous: "#34d399",
  professional: "#38bdf8",
  casual: "#a78bfa",
  balanced: "#888",
};

const TONE_EMOJI: Record<string, string> = {
  confident: "💪",
  flirty: "😏",
  humorous: "😄",
  professional: "👔",
  casual: "😎",
  balanced: "⚖️",
};

export function PersonalizationBadge() {
  const { data } = usePersonalization();

  const prefs = data?.prefs;
  const tone = prefs?.preferredTone ?? "balanced";
  const color = TONE_COLORS[tone] ?? "#888";
  const emoji = TONE_EMOJI[tone] ?? "⚖️";
  const interactions = prefs?.totalInteractions ?? 0;

  if (interactions < 3) return null;

  const successRate = data?.successRate ?? 0;

  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold"
      style={{ background: `${color}15`, color, border: `1px solid ${color}25` }}
    >
      <Sparkles size={9} />
      {emoji} AI tuned to {tone}
      {successRate > 0.5 && (
        <span className="opacity-60">· {Math.round(successRate * 100)}% success</span>
      )}
    </div>
  );
}
