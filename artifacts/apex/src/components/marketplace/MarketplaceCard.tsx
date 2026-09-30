import { useState } from "react";
import type { MarketplaceItem } from "../../hooks/useMarketplace";
import { useRateWorkflow, useRemixWorkflow, useTrackPlay } from "../../hooks/useMarketplace";

const CATEGORY_COLORS: Record<string, string> = {
  video: "#ef4444", game: "#8b5cf6", podcast: "#f59e0b",
  blog: "#10b981", marketing: "#ec4899", research: "#3b82f6",
  productivity: "#14b8a6", creative: "#f97316", business: "#6366f1",
  social: "#a855f7", custom: "#A29BFE",
};

function StarRating({ value, count, onRate }: { value: number; count: number; onRate?: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onMouseEnter={() => onRate && setHover(star)}
          onMouseLeave={() => onRate && setHover(0)}
          onClick={() => onRate?.(star)}
          className={`text-sm transition-transform ${onRate ? "hover:scale-125 cursor-pointer" : "cursor-default"}`}
        >
          <span style={{ color: star <= (hover || value) ? "#A29BFE" : "rgba(255,255,255,0.2)" }}>★</span>
        </button>
      ))}
      <span className="text-[10px] text-white/40 ml-1">({count})</span>
    </div>
  );
}

interface MarketplaceCardProps {
  item: MarketplaceItem;
  onPlay: () => void;
  featured?: boolean;
}

export function MarketplaceCard({ item, onPlay, featured }: MarketplaceCardProps) {
  const [userRating, setUserRating] = useState(0);
  const [showRatePanel, setShowRatePanel] = useState(false);
  const [review, setReview] = useState("");
  const [remixed, setRemixed] = useState(false);
  const [localPlayCount, setLocalPlayCount] = useState(item.playCount);
  const [localRating, setLocalRating] = useState(item.ratingAvg);
  const [localRemixes, setLocalRemixes] = useState(item.remixCount);

  const rateMutation = useRateWorkflow();
  const remixMutation = useRemixWorkflow();
  const trackPlay = useTrackPlay();

  const catColor = CATEGORY_COLORS[item.category] ?? "#A29BFE";

  async function handlePlay() {
    setLocalPlayCount((p) => p + 1);
    await trackPlay.mutateAsync({ marketplaceItemId: item.id, workflowId: item.workflowId });
    onPlay();
  }

  async function handleRemix() {
    const result = await remixMutation.mutateAsync(item.workflowId);
    setRemixed(true);
    setLocalRemixes((r) => r + 1);
  }

  async function handleRate(rating: number) {
    setUserRating(rating);
    setShowRatePanel(true);
  }

  async function submitRating() {
    await rateMutation.mutateAsync({ marketplaceItemId: item.id, workflowId: item.workflowId, rating: userRating, review });
    setLocalRating((prev) => ((prev * item.ratingCount) + userRating) / (item.ratingCount + 1));
    setShowRatePanel(false);
    setReview("");
  }

  const tags = Array.isArray(item.tags) ? item.tags.slice(0, 3) : [];

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all hover:border-white/20 ${featured ? "border-[#A29BFE]/30 bg-gradient-to-br from-[#A29BFE]/5 to-transparent" : "border-white/8 bg-white/3"}`}>
      {/* Header / Thumbnail */}
      <div className="relative p-4 pb-3">
        {featured && (
          <div className="absolute top-3 right-3 text-[9px] px-1.5 py-0.5 rounded-full font-bold text-black" style={{ background: "#A29BFE" }}>
            ⭐ FEATURED
          </div>
        )}
        <div className="flex items-start gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
            style={{ background: `${catColor}15`, border: `1px solid ${catColor}25` }}
          >
            {item.thumbnailEmoji}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-bold text-sm leading-tight truncate">{item.title}</h3>
            <p className="text-white/40 text-[10px] mt-0.5">by {item.authorName}</p>
            <div className="flex items-center gap-1 mt-1">
              <span
                className="text-[9px] px-1.5 py-0.5 rounded-full font-bold capitalize"
                style={{ background: `${catColor}20`, color: catColor }}
              >
                {item.category}
              </span>
              {tags.map((tag) => (
                <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/30">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {item.description && (
          <p className="text-white/50 text-xs mt-2.5 leading-relaxed line-clamp-2">{item.description}</p>
        )}
      </div>

      {/* Stats Row */}
      <div className="px-4 py-2 border-t border-white/5 flex items-center gap-4">
        <div className="flex items-center gap-1">
          <StarRating value={localRating} count={item.ratingCount} onRate={handleRate} />
        </div>
        <div className="flex items-center gap-3 ml-auto">
          <span className="text-[10px] text-white/30 flex items-center gap-1">
            <span>▶</span> {localPlayCount.toLocaleString()}
          </span>
          <span className="text-[10px] text-white/30 flex items-center gap-1">
            <span>🔀</span> {localRemixes}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-4 py-3 flex gap-2">
        <button
          onClick={handlePlay}
          className="flex-1 py-2.5 rounded-xl text-sm font-bold text-black transition-all hover:brightness-110 active:scale-95"
          style={{ background: "#A29BFE" }}
        >
          ▶ Play
        </button>
        <button
          onClick={handleRemix}
          disabled={remixed || remixMutation.isPending}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
            remixed
              ? "bg-green-500/15 text-green-400 border border-green-500/25"
              : "bg-white/8 text-white/60 hover:bg-white/12 border border-white/10"
          }`}
        >
          {remixMutation.isPending ? "⏳" : remixed ? "✅" : "🔀"} {remixed ? "Added" : "Remix"}
        </button>
      </div>

      {/* Rate Panel */}
      {showRatePanel && (
        <div className="mx-4 mb-4 p-3 rounded-xl bg-white/5 border border-[#A29BFE]/20">
          <p className="text-[#A29BFE] text-xs font-bold mb-2">Rate this workflow</p>
          <StarRating value={userRating} count={0} />
          <textarea
            value={review}
            onChange={(e) => setReview(e.target.value)}
            placeholder="Write a review (optional)..."
            className="w-full mt-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none resize-none"
            rows={2}
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={submitRating}
              disabled={rateMutation.isPending || !userRating}
              className="flex-1 py-1.5 rounded-lg text-xs font-bold text-black disabled:opacity-50"
              style={{ background: "#A29BFE" }}
            >
              {rateMutation.isPending ? "Submitting..." : "Submit Rating"}
            </button>
            <button onClick={() => setShowRatePanel(false)} className="px-3 py-1.5 rounded-lg text-xs text-white/40 bg-white/5">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
