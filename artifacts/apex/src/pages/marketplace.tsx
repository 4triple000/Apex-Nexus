import { FeatureGate } from "@/components/ui/FeatureGate";
import { FeaturePreview } from "@/components/ui/FeaturePreview";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Search, Play, Heart, GitFork, Sparkles, Zap, Gamepad2,
  Bot, AppWindow, Video, RefreshCw, X, ChevronRight,
  Terminal, CheckCircle2, XCircle, TrendingUp, Star,
} from "lucide-react";
import {
  useStudioMarketplace,
  useRunMarketplaceItem,
  useLikeMarketplaceItem,
  useRemixMarketplaceItem,
  useSeedStudioMarketplace,
  type StudioMarketplaceItem,
  type ExecStep,
} from "@/hooks/useStudioMarketplace";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// ─── Type config ───────────────────────────────────────────────────────────────
const TYPES = [
  { key: "all",        label: "All",      icon: Sparkles  },
  { key: "game",       label: "Games",    icon: Gamepad2  },
  { key: "ai_tool",    label: "AI Tools", icon: Bot       },
  { key: "app",        label: "Apps",     icon: AppWindow },
  { key: "automation", label: "Auto",     icon: Zap       },
  { key: "media",      label: "Media",    icon: Video     },
];

const SORTS = [
  { key: "popular",      label: "Popular"  },
  { key: "most_liked",   label: "Liked"    },
  { key: "most_remixed", label: "Remixed"  },
  { key: "newest",       label: "New"      },
];

const TYPE_GRADIENT: Record<string, string> = {
  game:       "from-violet-600 via-purple-600 to-indigo-700",
  ai_tool:    "from-blue-500 via-cyan-500 to-teal-600",
  app:        "from-emerald-500 via-green-500 to-teal-600",
  automation: "from-yellow-500 via-orange-500 to-red-500",
  media:      "from-pink-500 via-rose-500 to-red-500",
};

const TYPE_ACCENT: Record<string, string> = {
  game:       "#A78BFA",
  ai_tool:    "#38BDF8",
  app:        "#34D399",
  automation: "#FB923C",
  media:      "#F472B6",
};

// ─── Run Modal ─────────────────────────────────────────────────────────────────
function RunModal({ item, onClose }: { item: StudioMarketplaceItem; onClose: () => void }) {
  const runMutation = useRunMarketplaceItem();
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ executionLog: ExecStep[]; finalOutput: string } | null>(null);

  const userInputNodes = (item.nodes as { type: string; data: { label?: string; outputKey?: string; value?: string }; id: string }[])
    .filter((n) => n.type === "user_input");

  const handleRun = async () => {
    const runInputs: Record<string, string> = {};
    userInputNodes.forEach((n) => {
      const key = n.data.outputKey ?? "userInput";
      runInputs[key] = inputs[key] ?? n.data.value ?? "";
      runInputs.userInput = runInputs[key];
    });
    const res = await runMutation.mutateAsync({ id: item.id, inputs: runInputs });
    setResult(res);
  };

  const accent = TYPE_ACCENT[item.type] ?? "#A78BFA";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div
        className="relative w-full max-w-xl rounded-3xl max-h-[85vh] flex flex-col overflow-hidden"
        style={{
          background: "rgba(14,12,32,0.55)",
          border: "1px solid rgba(255,255,255,0.10)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/8">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl"
              style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}
            >
              {item.thumbnail}
            </div>
            <div>
              <h3 className="text-white font-bold text-sm">{item.title}</h3>
              <p className="text-white/40 text-xs mt-0.5">by {item.authorName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!result ? (
            <>
              {userInputNodes.length > 0 && (
                <div className="space-y-3">
                  <p className="text-white/40 text-xs font-medium uppercase tracking-wider">Inputs</p>
                  {userInputNodes.map((n) => {
                    const key = n.data.outputKey ?? "userInput";
                    return (
                      <div key={n.id}>
                        <label className="text-white/50 text-xs mb-1.5 block">{n.data.label ?? key}</label>
                        <input
                          className="w-full rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none placeholder-white/20"
                          style={{
                            background: "rgba(255,255,255,0.06)",
                            border: "1px solid rgba(255,255,255,0.10)",
                          }}
                          placeholder={n.data.value ?? `Enter ${n.data.label ?? key}...`}
                          value={inputs[key] ?? ""}
                          onChange={(e) =>
                            setInputs((prev) => ({ ...prev, [key]: e.target.value, userInput: e.target.value }))
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {userInputNodes.length === 0 && (
                <p className="text-white/35 text-sm text-center py-4">
                  This project runs automatically with no inputs required.
                </p>
              )}

              {/* Pipeline preview */}
              <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-white/30 text-[11px] mb-2 font-medium uppercase tracking-wider">
                  Pipeline — {item.nodes.length} nodes
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(item.nodes as { type: string; id: string }[]).slice(0, 8).map((n, i) => (
                    <span key={n.id} className="flex items-center gap-1">
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-full font-mono"
                        style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.50)" }}
                      >
                        {n.type}
                      </span>
                      {i < Math.min((item.nodes as unknown[]).length, 8) - 1 && (
                        <ChevronRight className="w-2.5 h-2.5 text-white/20 flex-shrink-0" />
                      )}
                    </span>
                  ))}
                  {item.nodes.length > 8 && (
                    <span className="text-[11px] text-white/25">+{item.nodes.length - 8} more</span>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div
                className="rounded-2xl p-4"
                style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.25)" }}
              >
                <p className="text-violet-400 text-[11px] font-medium uppercase tracking-wider mb-2">Final Output</p>
                <p className="text-white text-sm whitespace-pre-wrap leading-relaxed">{result.finalOutput}</p>
              </div>
              <div className="space-y-2">
                <p className="text-white/30 text-[11px] font-medium uppercase tracking-wider">Execution Log</p>
                {result.executionLog.map((step, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-start gap-2.5 p-3 rounded-xl text-xs",
                      step.success
                        ? "bg-white/4"
                        : "bg-red-500/8 border border-red-500/20"
                    )}
                  >
                    {step.success
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-violet-400 mt-0.5 flex-shrink-0" />
                      : <XCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />}
                    <div>
                      <span className="text-white/40 font-mono">{step.label}</span>
                      <p className="text-white/60 mt-0.5 whitespace-pre-wrap">{step.output.slice(0, 200)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-white/8 flex gap-3">
          {!result ? (
            <>
              <button
                onClick={onClose}
                className="flex-1 py-3 rounded-2xl text-white/50 text-sm hover:bg-white/5 transition-colors"
                style={{ border: "1px solid rgba(255,255,255,0.08)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleRun}
                disabled={runMutation.isPending}
                className="haptic-sm flex-1 py-3 rounded-2xl text-white text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                style={{
                  background: "linear-gradient(135deg, #7C3AED, #EC4899)",
                  boxShadow: "0 4px 16px rgba(139,92,246,0.4)",
                }}
              >
                {runMutation.isPending ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Running...</>
                ) : (
                  <><Play className="w-4 h-4 fill-current" /> Run Project</>
                )}
              </button>
            </>
          ) : (
            <button
              onClick={() => setResult(null)}
              className="w-full py-3 rounded-2xl text-white/70 text-sm hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
              style={{ border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <RefreshCw className="w-4 h-4" /> Run Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Premium Pinterest-style Item Card ─────────────────────────────────────────
function ItemCard({ item, onRun }: { item: StudioMarketplaceItem; onRun: (item: StudioMarketplaceItem) => void }) {
  const [, navigate]  = useLocation();
  const likeMutation  = useLikeMarketplaceItem();
  const remixMutation = useRemixMarketplaceItem();
  const { toast }     = useToast();
  const [liked, setLiked]       = useState(false);
  const [hovered, setHovered]   = useState(false);
  const [likeAnim, setLikeAnim] = useState(false);

  const gradient = TYPE_GRADIENT[item.type] ?? "from-violet-600 via-purple-600 to-indigo-700";
  const accent   = TYPE_ACCENT[item.type]   ?? "#A78BFA";

  const EASE_IOS    = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";
  const EASE_SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (liked) return;
    setLiked(true);
    setLikeAnim(true);
    setTimeout(() => setLikeAnim(false), 400);
    await likeMutation.mutateAsync(item.id);
  };

  const handleRemix = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await remixMutation.mutateAsync(item.id);
      toast({ title: "Remixed!", description: `"${res.project.title}" added to your Studio.` });
      setTimeout(() => navigate("/studio"), 1200);
    } catch {
      toast({ title: "Remix failed", variant: "destructive" });
    }
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onRun(item)}
      style={{
        borderRadius: 24,
        overflow: "hidden",
        cursor: "pointer",
        background: "rgba(26,29,36,0.90)",
        border: hovered ? `1px solid ${accent}30` : "1px solid rgba(255,255,255,0.07)",
        boxShadow: hovered
          ? `0 20px 50px rgba(0,0,0,0.55), 0 0 0 1px ${accent}20, 0 8px 20px rgba(0,0,0,0.35)`
          : "0 4px 20px rgba(0,0,0,0.30), 0 1px 4px rgba(0,0,0,0.20)",
        transform: hovered ? "translateY(-5px) scale(1.015)" : "translateY(0) scale(1)",
        transition: [
          `transform 0.28s ${EASE_IOS}`,
          `box-shadow 0.28s ${EASE_IOS}`,
          `border-color 0.25s ${EASE_IOS}`,
        ].join(", "),
        willChange: "transform",
        position: "relative",
      }}
    >
      {/* ── Visual area ────────────────────────────────────── */}
      <div
        className={`relative bg-gradient-to-br ${gradient} overflow-hidden`}
        style={{ height: 148 }}
      >
        {/* Noise texture overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.08,
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
            backgroundSize: "128px 128px",
          }}
        />

        {/* Specular highlight */}
        <div style={{ position: "absolute", top: -30, left: -30, width: 120, height: 120, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%)", pointerEvents: "none" }} />

        {/* Bottom glow orb */}
        <div
          style={{
            position: "absolute",
            bottom: -24,
            right: -24,
            width: 100,
            height: 100,
            borderRadius: "50%",
            background: accent,
            opacity: hovered ? 0.55 : 0.35,
            filter: "blur(32px)",
            transition: `opacity 0.30s ${EASE_IOS}`,
          }}
        />

        {/* Central emoji */}
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span
            style={{
              fontSize: 52,
              userSelect: "none",
              filter: "drop-shadow(0 6px 20px rgba(0,0,0,0.55))",
              transform: hovered ? "scale(1.10) translateY(-4px)" : "scale(1)",
              transition: `transform 0.35s ${EASE_SPRING}`,
              display: "block",
            }}
          >
            {item.thumbnail}
          </span>
        </div>

        {/* Quick run — appears on hover */}
        <button
          onClick={(e) => { e.stopPropagation(); onRun(item); }}
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            width: 34,
            height: 34,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,255,255,0.22)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.35)",
            boxShadow: `0 4px 16px rgba(0,0,0,0.30)`,
            opacity: hovered ? 1 : 0,
            transform: hovered ? "scale(1) translateY(0)" : "scale(0.80) translateY(4px)",
            transition: [
              `opacity 0.22s ${EASE_IOS}`,
              `transform 0.28s ${EASE_SPRING}`,
            ].join(", "),
            cursor: "pointer",
          }}
        >
          <Play style={{ width: 14, height: 14, color: "white", fill: "white" }} />
        </button>

        {/* Type badge */}
        <div style={{ position: "absolute", bottom: 10, left: 10 }}>
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              padding: "3px 8px",
              borderRadius: 99,
              background: "rgba(0,0,0,0.55)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              color: accent,
              border: `1px solid ${accent}35`,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            {item.type.replace("_", " ")}
          </span>
        </div>
      </div>

      {/* ── Content area ───────────────────────────────────── */}
      <div style={{ padding: "12px 12px 14px" }}>
        <h3 style={{ color: "#F0F0F8", fontSize: 13, fontWeight: 700, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>
          {item.title}
        </h3>
        <p style={{ color: "rgba(255,255,255,0.32)", fontSize: 11, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          by {item.authorName}
        </p>

        {/* ── Stats ──────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10 }}>
          {/* Like */}
          <button
            onClick={handleLike}
            disabled={liked}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
              fontWeight: 600,
              color: liked ? "#F87171" : "rgba(255,255,255,0.35)",
              transform: likeAnim ? "scale(1.35)" : "scale(1)",
              transition: [
                `color 0.15s ${EASE_IOS}`,
                `transform 0.30s ${EASE_SPRING}`,
              ].join(", "),
            }}
          >
            <Heart
              style={{
                width: 12,
                height: 12,
                fill: liked ? "#F87171" : "none",
                transition: `fill 0.15s ${EASE_IOS}`,
              }}
            />
            {item.likes + (liked ? 1 : 0)}
          </button>

          {/* Remix */}
          <button
            onClick={handleRemix}
            disabled={remixMutation.isPending}
            style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.32)" }}
          >
            {remixMutation.isPending
              ? <RefreshCw style={{ width: 11, height: 11, animation: "spin 1s linear infinite" }} />
              : <GitFork   style={{ width: 11, height: 11 }} />}
            {item.remixes}
          </button>

          {/* Star rating */}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 3 }}>
            <Star style={{ width: 10, height: 10, color: "#FBBF24", fill: "#FBBF24" }} />
            <span style={{ fontSize: 11, color: "#FBBF24", fontWeight: 700 }}>
              {(item.plays / 10).toFixed(1)}
            </span>
          </div>
        </div>

        {/* ── "Quick Buy" CTA (always visible) ───────────── */}
        <button
          onClick={(e) => { e.stopPropagation(); onRun(item); }}
          style={{
            marginTop: 10,
            width: "100%",
            padding: "8px 0",
            borderRadius: 14,
            background: hovered
              ? `linear-gradient(135deg, ${accent}30, ${accent}18)`
              : "rgba(255,255,255,0.04)",
            border: hovered ? `1px solid ${accent}40` : "1px solid rgba(255,255,255,0.07)",
            color: hovered ? accent : "rgba(255,255,255,0.40)",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.03em",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            transition: [
              `background 0.25s ${EASE_IOS}`,
              `border-color 0.25s ${EASE_IOS}`,
              `color 0.25s ${EASE_IOS}`,
            ].join(", "),
            cursor: "pointer",
          }}
        >
          <Play style={{ width: 10, height: 10, fill: "currentColor", strokeWidth: 0 }} />
          Run
        </button>
      </div>
    </div>
  );
}

// ─── Main Marketplace Page ─────────────────────────────────────────────────────
function MarketplacePageInner() {
  const [typeFilter, setTypeFilter] = useState("all");
  const [sort, setSort] = useState("popular");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [runningItem, setRunningItem] = useState<StudioMarketplaceItem | null>(null);
  const [, navigate] = useLocation();

  const seedMutation = useSeedStudioMarketplace();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, refetch } = useStudioMarketplace({
    type: typeFilter,
    search: debouncedSearch,
    sort,
  });

  useEffect(() => {
    if (!isLoading && data?.items.length === 0 && !seedMutation.isPending) {
      seedMutation.mutate(undefined, { onSuccess: () => void refetch() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, data?.items.length]);

  const items = data?.items ?? [];

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "transparent" }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-4 pt-6 pb-3 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-xl font-bold tracking-tight"
              style={{
                background: "linear-gradient(135deg, #fff 40%, #F472B6)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Marketplace
            </h1>
            <p className="text-[11px] text-white/30 mt-0.5">Discover, run & remix AI projects</p>
          </div>
          <button
            onClick={() => navigate("/studio")}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-semibold text-white"
            style={{
              background: "linear-gradient(135deg, #7C3AED40, #EC489940)",
              border: "1px solid rgba(139,92,246,0.3)",
            }}
          >
            <TrendingUp className="w-3 h-3" />
            Studio
          </button>
        </div>

        {/* Search */}
        <div
          className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <Search className="w-4 h-4 text-white/30 flex-shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search AI projects..."
            className="flex-1 bg-transparent text-white text-sm placeholder-white/25 focus:outline-none"
          />
          {search && (
            <button onClick={() => setSearch("")} className="flex-shrink-0">
              <X className="w-3.5 h-3.5 text-white/30 hover:text-white/60" />
            </button>
          )}
        </div>

        {/* Category chips */}
        <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-4 px-4 scrollbar-none">
          {TYPES.map((t) => {
            const Icon = t.icon;
            const active = typeFilter === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTypeFilter(t.key)}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all duration-200 flex-shrink-0 active:scale-95"
                )}
                style={active ? {
                  background: "linear-gradient(135deg, #7C3AED, #EC4899)",
                  color: "white",
                  boxShadow: "0 4px 12px rgba(139,92,246,0.35)",
                } : {
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.45)",
                }}
              >
                <Icon className="w-3 h-3" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Sort pills */}
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 scrollbar-none">
          {SORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              className={cn(
                "px-3 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all flex-shrink-0 active:scale-95",
                sort === s.key
                  ? "text-violet-300 bg-violet-500/15 border border-violet-500/25"
                  : "text-white/30 hover:text-white/50"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Pinterest grid ─────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 pb-28">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="skeleton-shimmer rounded-3xl"
                style={{ height: 220, animationDelay: `${i * 0.08}s` }}
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-5xl mb-4">🎯</div>
            <p className="text-white/50 text-sm font-medium">No projects found</p>
            <p className="text-white/25 text-xs mt-1">Try a different filter or search</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {items.map((item) => (
              <ItemCard key={item.id} item={item} onRun={setRunningItem} />
            ))}
          </div>
        )}
      </div>

      {/* Run Modal */}
      {runningItem && <RunModal item={runningItem} onClose={() => setRunningItem(null)} />}
    </div>
  );
}

export default function MarketplacePage() {
  return (
    <FeaturePreview feature="marketplace">
      <MarketplacePageInner />
    </FeaturePreview>
  );
}
