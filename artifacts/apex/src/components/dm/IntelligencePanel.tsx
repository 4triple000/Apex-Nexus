import { useState } from "react";
import type { DmMessage } from "../../hooks/useDM";
import { authHeaders } from "@/lib/authSession";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
async function analyzeConversation(conversationId: number) {
  const res = await fetch(`${BASE}/api/dm/conversations/${conversationId}/intelligence`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
  });
  return res.json() as Promise<IntelligenceResult>;
}

interface IntelligenceResult {
  ghostingRisk: number;
  engagementLevel: number;
  closenessScore: number;
  interestSignals: string[];
  redFlags: string[];
  suggestedAction: string;
  actionLabel: string;
  actionUrgency: "low" | "medium" | "high";
  communicationPattern: string;
  bestTimeToReply: string;
  toneRecommendation: string;
}

function RiskGauge({ value, label, low, high }: { value: number; label: string; low: string; high: string }) {
  const color = value >= 70 ? "#ef4444" : value >= 40 ? "#A29BFE" : "#10b981";
  const circumference = 2 * Math.PI * 28;
  const offset = circumference * (1 - value / 100);
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-16 h-16">
        <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
          <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
          <circle
            cx="32" cy="32" r="28"
            fill="none"
            stroke={color}
            strokeWidth="5"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.8s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-black" style={{ color }}>{value}</span>
        </div>
      </div>
      <span className="text-[9px] text-white/50">{label}</span>
    </div>
  );
}

interface IntelligencePanelProps {
  conversationId: number;
  messages: DmMessage[];
}

export function IntelligencePanel({ conversationId, messages }: IntelligencePanelProps) {
  const [result, setResult] = useState<IntelligenceResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function runAnalysis() {
    setLoading(true);
    try {
      const data = await analyzeConversation(conversationId);
      setResult(data);
    } finally {
      setLoading(false);
    }
  }

  const urgencyColors = { low: "#10b981", medium: "#A29BFE", high: "#ef4444" };
  const urgencyLabels = { low: "When ready", medium: "Soon", high: "URGENT" };

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white font-bold text-sm">🧠 Conversation Intelligence</p>
          <p className="text-white/40 text-xs">{messages.length} messages analyzed</p>
        </div>
        <button
          onClick={runAnalysis}
          disabled={loading || messages.length < 2}
          className="px-3 py-1.5 rounded-lg text-xs font-bold text-black disabled:opacity-40 transition-opacity"
          style={{ background: "#A29BFE" }}
        >
          {loading ? "Analyzing..." : "Analyze"}
        </button>
      </div>

      {messages.length < 2 && (
        <p className="text-white/30 text-xs text-center py-3">Need at least 2 messages to analyze</p>
      )}

      {result && (
        <>
          {/* Gauges */}
          <div className="flex justify-around bg-white/5 rounded-xl p-3 border border-white/10">
            <RiskGauge value={result.ghostingRisk} label="Ghost Risk" low="Safe" high="Risk" />
            <RiskGauge value={result.engagementLevel} label="Engagement" low="Low" high="High" />
            <RiskGauge value={result.closenessScore} label="Closeness" low="New" high="Close" />
          </div>

          {/* Suggested Action */}
          <div
            className="rounded-xl p-3 border"
            style={{
              background: `${urgencyColors[result.actionUrgency]}10`,
              borderColor: `${urgencyColors[result.actionUrgency]}30`,
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-bold" style={{ color: urgencyColors[result.actionUrgency] }}>
                👉 SUGGESTED ACTION
              </p>
              <span
                className="text-[9px] px-2 py-0.5 rounded-full font-bold"
                style={{ background: `${urgencyColors[result.actionUrgency]}25`, color: urgencyColors[result.actionUrgency] }}
              >
                {urgencyLabels[result.actionUrgency]}
              </span>
            </div>
            <p className="text-white font-semibold text-sm">{result.actionLabel}</p>
            <p className="text-white/60 text-xs mt-1">{result.suggestedAction}</p>
          </div>

          {/* Signals */}
          <div className="grid grid-cols-2 gap-2">
            {result.interestSignals.length > 0 && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3">
                <p className="text-green-400 text-[10px] font-bold mb-1.5">✅ GOOD SIGNALS</p>
                {result.interestSignals.slice(0, 3).map((s, i) => (
                  <p key={i} className="text-white/70 text-[10px]">• {s}</p>
                ))}
              </div>
            )}
            {result.redFlags.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                <p className="text-red-400 text-[10px] font-bold mb-1.5">⚠️ RED FLAGS</p>
                {result.redFlags.slice(0, 3).map((s, i) => (
                  <p key={i} className="text-white/70 text-[10px]">• {s}</p>
                ))}
              </div>
            )}
          </div>

          {/* Insights */}
          <div className="bg-white/5 rounded-xl p-3 border border-white/10 space-y-2">
            {[
              { icon: "💬", label: "Pattern", value: result.communicationPattern },
              { icon: "⏰", label: "Best Time", value: result.bestTimeToReply },
              { icon: "🎯", label: "Tone", value: result.toneRecommendation },
            ].map(({ icon, label, value }) => (
              <div key={label} className="flex items-start gap-2">
                <span className="text-sm flex-shrink-0">{icon}</span>
                <div>
                  <span className="text-white/40 text-[10px]">{label}: </span>
                  <span className="text-white/80 text-[10px]">{value}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
