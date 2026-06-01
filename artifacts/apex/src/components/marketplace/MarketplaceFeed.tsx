import { useState } from "react";
import type { FeedSort } from "../../hooks/useMarketplace";
import { useMarketplaceFeed } from "../../hooks/useMarketplace";
import { MarketplaceCard } from "./MarketplaceCard";
import { WorkflowPlayer } from "./WorkflowPlayer";
import type { MarketplaceItem } from "../../hooks/useMarketplace";

const SORT_OPTIONS: { value: FeedSort; label: string; icon: string }[] = [
  { value: "trending", label: "Trending", icon: "🔥" },
  { value: "newest", label: "Newest", icon: "🆕" },
  { value: "top_rated", label: "Top Rated", icon: "⭐" },
  { value: "most_played", label: "Most Played", icon: "▶" },
];

const CATEGORY_FILTERS = [
  { value: "", label: "All" },
  { value: "video", label: "🎥 Video" },
  { value: "game", label: "🎮 Game" },
  { value: "podcast", label: "🎙️ Podcast" },
  { value: "blog", label: "✍️ Blog" },
  { value: "marketing", label: "📱 Marketing" },
  { value: "research", label: "🔬 Research" },
];

export function MarketplaceFeed() {
  const [sort, setSort] = useState<FeedSort>("trending");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [category, setCategory] = useState("");
  const [playingItem, setPlayingItem] = useState<MarketplaceItem | null>(null);
  const [seeded, setSeeded] = useState(false);

  const { data: items = [], isLoading, refetch } = useMarketplaceFeed(sort, search, category);

  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

  async function handleSeed() {
    await fetch(`${BASE}api/marketplace/seed`, { method: "POST" });
    setSeeded(true);
    refetch();
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
  }

  const featured = items.filter((i) => i.isFeatured);
  const regular = items.filter((i) => !i.isFeatured);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Search Bar */}
      <div className="flex-shrink-0 px-4 pt-3 pb-2">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              if (!e.target.value) { setSearch(""); }
            }}
            placeholder="Search workflows..."
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#ffcc33]/40"
          />
          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl text-sm font-bold text-black"
            style={{ background: "#ffcc33" }}
          >
            🔍
          </button>
        </form>
      </div>

      {/* Sort Tabs */}
      <div className="flex-shrink-0 px-4 pb-2 overflow-x-auto scrollbar-hide">
        <div className="flex gap-1.5">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSort(opt.value)}
              className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                sort === opt.value
                  ? "bg-[#ffcc33] text-black"
                  : "bg-white/5 text-white/50 hover:bg-white/10"
              }`}
            >
              {opt.icon} {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Category Filters */}
      <div className="flex-shrink-0 px-4 pb-3 overflow-x-auto scrollbar-hide">
        <div className="flex gap-1.5">
          {CATEGORY_FILTERS.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-[10px] font-medium transition-all ${
                category === cat.value
                  ? "bg-white/20 text-white border border-white/20"
                  : "bg-white/5 text-white/40 hover:bg-white/8"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <p className="text-white/30 text-sm">Loading marketplace...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-56 gap-4 text-center">
            <div className="text-5xl">🛒</div>
            <div>
              <p className="text-white/60 text-sm font-bold">Marketplace is empty</p>
              <p className="text-white/30 text-xs mt-1">Load featured workflows to get started</p>
            </div>
            <button
              onClick={handleSeed}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-black"
              style={{ background: "#ffcc33" }}
            >
              🚀 Load Featured Workflows
            </button>
          </div>
        ) : (
          <>
            {/* Featured banner */}
            {featured.length > 0 && (
              <div className="mb-1">
                <p className="text-white/30 text-[10px] uppercase tracking-widest mb-2">⭐ Featured</p>
                {featured.map((item) => (
                  <MarketplaceCard key={item.id} item={item} onPlay={() => setPlayingItem(item)} featured />
                ))}
              </div>
            )}

            {regular.length > 0 && featured.length > 0 && (
              <p className="text-white/30 text-[10px] uppercase tracking-widest mb-2">
                {sort === "trending" ? "🔥 Trending" : sort === "newest" ? "🆕 Newest" : sort === "top_rated" ? "⭐ Top Rated" : "▶ Most Played"}
              </p>
            )}

            {regular.map((item) => (
              <MarketplaceCard key={item.id} item={item} onPlay={() => setPlayingItem(item)} />
            ))}
          </>
        )}
      </div>

      {/* Full-screen Player */}
      {playingItem && (
        <WorkflowPlayer item={playingItem} onClose={() => setPlayingItem(null)} />
      )}
    </div>
  );
}
