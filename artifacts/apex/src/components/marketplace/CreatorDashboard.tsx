import { useState } from "react";
import { useCreatorStats, usePublishWorkflow } from "../../hooks/useMarketplace";
import { useWorkflows } from "../../hooks/useWorkflows";

const CATEGORY_EMOJIS: Record<string, string> = {
  video: "🎥", game: "🎮", podcast: "🎙️", blog: "✍️", marketing: "📱",
  research: "🔬", productivity: "⚡", creative: "🎨", business: "💼", custom: "⚡",
};

function StatBox({ icon, label, value, color }: { icon: string; label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-white/5 rounded-xl p-3.5 border border-white/8 text-center">
      <div className="text-xl mb-1">{icon}</div>
      <p className="text-xl font-black" style={{ color: color ?? "white" }}>{value}</p>
      <p className="text-white/40 text-[9px] uppercase tracking-wide mt-0.5">{label}</p>
    </div>
  );
}

export function CreatorDashboard() {
  const { data: stats, isLoading } = useCreatorStats();
  const { data: myWorkflows = [] } = useWorkflows();
  const publish = usePublishWorkflow();

  const [publishingId, setPublishingId] = useState<number | null>(null);
  const [publishData, setPublishData] = useState({ title: "", description: "", authorName: "", thumbnailEmoji: "⚡" });
  const [published, setPublished] = useState<Set<number>>(new Set());

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><p className="text-white/30 text-sm">Loading dashboard...</p></div>;
  }

  async function handlePublish() {
    if (!publishingId) return;
    await publish.mutateAsync({ workflowId: publishingId, ...publishData });
    setPublished((p) => new Set([...p, publishingId]));
    setPublishingId(null);
    setPublishData({ title: "", description: "", authorName: "", thumbnailEmoji: "⚡" });
  }

  const unpublishedWorkflows = myWorkflows.filter((w) => !w.isTemplate);
  const emojiOptions = ["⚡", "🎥", "🎮", "🎙️", "✍️", "📱", "🔬", "🎨", "💼", "🔗", "🤖", "🧠", "🌟", "🚀", "💡"];

  return (
    <div className="overflow-y-auto h-full pb-6">
      <div className="p-4 space-y-5">
        {/* Header */}
        <div>
          <h2 className="text-lg font-black text-white tracking-wide">CREATOR DASHBOARD</h2>
          <p className="text-white/40 text-xs">Your marketplace performance</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2">
          <StatBox icon="⚡" label="Workflows" value={stats?.totalWorkflows ?? 0} color="#ffcc33" />
          <StatBox icon="▶" label="Total Plays" value={(stats?.totalPlays ?? 0).toLocaleString()} color="#10b981" />
          <StatBox icon="🔀" label="Remixes" value={stats?.totalRemixes ?? 0} color="#8b5cf6" />
          <StatBox icon="⭐" label="Avg Rating" value={stats?.avgRating ? `${stats.avgRating}/5` : "—"} color="#ffcc33" />
          <StatBox icon="💬" label="Reviews" value={stats?.totalRatings ?? 0} color="#ec4899" />
          <StatBox icon="🌐" label="Published" value={stats?.publishedCount ?? 0} color="#3b82f6" />
        </div>

        {/* Top Workflow */}
        {stats?.topWorkflow && (
          <div className="rounded-xl p-4 border border-[#ffcc33]/20 bg-[#ffcc33]/5">
            <p className="text-[#ffcc33] font-bold text-xs mb-2">🏆 TOP WORKFLOW</p>
            <p className="text-white font-bold text-sm">{stats.topWorkflow.title}</p>
            <div className="flex gap-4 mt-2">
              <span className="text-white/50 text-xs">▶ {stats.topWorkflow.playCount.toLocaleString()} plays</span>
              <span className="text-white/50 text-xs">★ {stats.topWorkflow.ratingAvg?.toFixed(1)}</span>
            </div>
          </div>
        )}

        {/* Publish Workflow Section */}
        <div>
          <p className="text-white font-bold text-sm mb-3">🚀 Publish to Marketplace</p>
          {unpublishedWorkflows.length === 0 ? (
            <p className="text-white/30 text-xs text-center py-4">Create workflows in the My Pipelines tab first</p>
          ) : (
            <div className="space-y-2">
              {unpublishedWorkflows.map((wf) => {
                const isPublished = published.has(wf.id);
                const isSelected = publishingId === wf.id;
                return (
                  <div key={wf.id} className="rounded-xl border border-white/8 overflow-hidden">
                    <button
                      onClick={() => setPublishingId(isSelected ? null : wf.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
                    >
                      <span className="text-lg">{CATEGORY_EMOJIS[wf.category ?? "custom"] ?? "⚡"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{wf.name}</p>
                        <p className="text-white/40 text-xs">{(wf.steps as unknown[])?.length ?? 0} steps</p>
                      </div>
                      {isPublished ? (
                        <span className="text-[10px] text-green-400 font-bold">✅ Published</span>
                      ) : (
                        <span className="text-[10px] text-[#ffcc33]">Publish →</span>
                      )}
                    </button>

                    {isSelected && !isPublished && (
                      <div className="px-4 pb-4 space-y-3 border-t border-white/8">
                        <div className="mt-3 space-y-2">
                          <input
                            value={publishData.title || wf.name}
                            onChange={(e) => setPublishData((p) => ({ ...p, title: e.target.value }))}
                            placeholder="Marketplace title..."
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none"
                          />
                          <textarea
                            value={publishData.description || wf.description || ""}
                            onChange={(e) => setPublishData((p) => ({ ...p, description: e.target.value }))}
                            placeholder="Description for the marketplace..."
                            rows={2}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none resize-none"
                          />
                          <input
                            value={publishData.authorName}
                            onChange={(e) => setPublishData((p) => ({ ...p, authorName: e.target.value }))}
                            placeholder="Your creator name..."
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none"
                          />
                          <div className="flex items-center gap-2">
                            <span className="text-white/50 text-xs">Icon:</span>
                            <div className="flex gap-1 flex-wrap">
                              {emojiOptions.map((e) => (
                                <button
                                  key={e}
                                  onClick={() => setPublishData((p) => ({ ...p, thumbnailEmoji: e }))}
                                  className={`w-8 h-8 rounded-lg text-lg transition-all ${publishData.thumbnailEmoji === e ? "bg-[#ffcc33]/20 border border-[#ffcc33]/40" : "bg-white/5 hover:bg-white/10"}`}
                                >
                                  {e}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={handlePublish}
                          disabled={publish.isPending}
                          className="w-full py-2.5 rounded-xl text-sm font-bold text-black disabled:opacity-50"
                          style={{ background: "#ffcc33" }}
                        >
                          {publish.isPending ? "Publishing..." : "🚀 Publish Now"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Tips */}
        <div className="rounded-xl p-4 border border-white/8 bg-white/3">
          <p className="text-white/50 font-bold text-xs mb-2">💡 CREATOR TIPS</p>
          <ul className="space-y-1.5">
            <li className="text-white/40 text-xs">• Descriptive titles get 3x more plays</li>
            <li className="text-white/40 text-xs">• Workflows with 4+ steps rank higher</li>
            <li className="text-white/40 text-xs">• Higher ratings boost trending position</li>
            <li className="text-white/40 text-xs">• Remixes count as community endorsements</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
