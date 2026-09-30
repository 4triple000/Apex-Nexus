import { useState } from "react";
import { useDMAnalytics } from "../../hooks/useDM";
import { SocialGraph } from "./SocialGraph";

type StatsTab = "overview" | "contacts" | "graph";

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
      <p className="text-white/40 text-xs uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-black" style={{ color: color ?? "white" }}>{value}</p>
      {sub && <p className="text-white/30 text-xs mt-0.5">{sub}</p>}
    </div>
  );
}

function BarChart({ data }: { data: { label: string; value: number; color?: string }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-2">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-xs text-white/50 w-16 truncate flex-shrink-0">{d.label}</span>
          <div className="flex-1 h-5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.round((d.value / max) * 100)}%`, background: d.color ?? "#A29BFE" }}
            />
          </div>
          <span className="text-xs text-white/40 w-8 text-right">{d.value}%</span>
        </div>
      ))}
    </div>
  );
}

export function AnalyticsPanel() {
  const [tab, setTab] = useState<StatsTab>("overview");
  const { data, isLoading } = useDMAnalytics();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-white/30 text-sm">Loading analytics...</div>
      </div>
    );
  }

  if (!data || data.summary.totalContacts === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center">
        <div className="text-4xl">📊</div>
        <p className="text-white/60 text-sm">No data yet</p>
        <p className="text-white/30 text-xs">Start some conversations to see analytics here</p>
      </div>
    );
  }

  const { summary, perContact } = data;

  const chartData = perContact
    .filter((c) => c.totalMessages > 0)
    .sort((a, b) => b.responseRate - a.responseRate)
    .slice(0, 5)
    .map((c) => ({
      label: (c.displayName ?? c.username).split(" ")[0]!,
      value: c.responseRate,
      color: c.responseRate >= 70 ? "#10b981" : c.responseRate >= 40 ? "#A29BFE" : "#ef4444",
    }));

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Sub-tabs */}
      <div className="flex-shrink-0 flex bg-white/5 m-4 rounded-xl p-1">
        {(["overview", "contacts", "graph"] as StatsTab[]).map((t) => {
          const labels: Record<StatsTab, string> = { overview: "📊 Overview", contacts: "🏆 Rankings", graph: "🌐 Graph" };
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${tab === t ? "bg-[#A29BFE] text-black" : "text-white/50"}`}
            >
              {labels[t]}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {/* Overview Tab */}
        {tab === "overview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Total Messages" value={summary.totalMessages} sub="all conversations" color="#A29BFE" />
              <StatCard label="Contacts" value={summary.totalContacts} sub="active threads" color="#8b5cf6" />
              <StatCard label="AI Replies" value={summary.aiGenerated} sub="messages generated" color="#10b981" />
              <StatCard
                label="Avg Score"
                value={summary.avgScore > 0 ? `${summary.avgScore}%` : "—"}
                sub="reply quality"
                color={summary.avgScore >= 80 ? "#10b981" : summary.avgScore >= 60 ? "#A29BFE" : "#ef4444"}
              />
            </div>

            {chartData.length > 0 && (
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <h3 className="text-white font-bold text-sm mb-3">📈 Response Rates</h3>
                <BarChart data={chartData} />
              </div>
            )}

            <div className="rounded-xl p-4 border border-[#A29BFE]/20 bg-[#A29BFE]/5">
              <p className="text-[#A29BFE] font-bold text-xs mb-2">💡 PRO TIPS</p>
              <ul className="space-y-1.5">
                <li className="text-white/60 text-xs">• Use "Confident" mode for high-response contacts</li>
                <li className="text-white/60 text-xs">• Score your drafts before sending — aim for 80+</li>
                <li className="text-white/60 text-xs">• Run 🧠 Intelligence (in chat) after 5+ messages</li>
                <li className="text-white/60 text-xs">• Cold opens with context outperform generics 3x</li>
              </ul>
            </div>
          </div>
        )}

        {/* Rankings Tab */}
        {tab === "contacts" && (
          <div className="space-y-3">
            <p className="text-white/40 text-xs">Ranked by total engagement</p>
            <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
              {perContact
                .filter((c) => c.totalMessages > 0)
                .sort((a, b) => b.totalMessages - a.totalMessages)
                .map((c, i) => {
                  const closeness = Math.min(100, Math.round(c.responseRate * 0.6 + Math.min(c.totalMessages * 2, 40)));
                  const closenessLabel = closeness >= 75 ? "🟢 Close" : closeness >= 50 ? "🟡 Connected" : closeness >= 25 ? "🟠 Warming" : "⚪ New";
                  return (
                    <div key={c.contactId} className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-b-0">
                      <span className="text-white/20 text-sm font-black w-5">#{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{c.displayName ?? c.username}</p>
                        <p className="text-white/40 text-xs">{c.totalMessages} msgs · {closenessLabel}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold" style={{ color: c.responseRate >= 70 ? "#10b981" : c.responseRate >= 40 ? "#A29BFE" : "#ef4444" }}>
                          {c.responseRate}%
                        </p>
                        <p className="text-white/30 text-[10px]">response</p>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Social Graph Tab */}
        {tab === "graph" && (
          <div className="space-y-3">
            <div>
              <p className="text-white font-bold text-sm">🌐 Social Intelligence Graph</p>
              <p className="text-white/40 text-xs">Your relationship map — tap a node to see details</p>
            </div>
            <SocialGraph />
          </div>
        )}
      </div>
    </div>
  );
}
