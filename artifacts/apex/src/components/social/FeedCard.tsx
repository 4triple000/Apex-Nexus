import { useState, useCallback } from "react";
import { Heart, MessageCircle, Share2, Bookmark, Play, GitFork, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SocialProject } from "@/hooks/useSocial";

// ── Design tokens ──────────────────────────────────────────────────────────────
const EASE_IOS    = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";
const EASE_SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

const TYPE_STOP1: Record<string, string> = {
  game:       "#7C3AED", ai_tool: "#0EA5E9",
  app:        "#059669", automation: "#D97706",
  media:      "#DB2777",
};
const TYPE_STOP2: Record<string, string> = {
  game:       "#4F46E5", ai_tool: "#0284C7",
  app:        "#047857", automation: "#B45309",
  media:      "#BE185D",
};
const TYPE_ACCENT: Record<string, string> = {
  game:       "#A78BFA", ai_tool: "#38BDF8",
  app:        "#34D399", automation: "#FCD34D",
  media:      "#F9A8D4",
};
const TYPE_LABELS: Record<string, string> = {
  game: "Game", ai_tool: "AI Tool", app: "App", automation: "Auto", media: "Media",
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

interface FeedCardProps {
  project: SocialProject;
  liked?: boolean;
  onLike?: (id: number) => void;
  onRun?: (id: number) => void;
  onRemix?: (id: number) => void;
  onCreatorClick?: (authorId: number) => void;
  compact?: boolean;
}

export function FeedCard({
  project,
  liked = false,
  onLike,
  onRun,
  onRemix,
  onCreatorClick,
}: FeedCardProps) {
  const [optimisticLiked, setOptimisticLiked] = useState(liked);
  const [optimisticLikes, setOptimisticLikes] = useState(project.likes);
  const [saved, setSaved] = useState(false);
  const [likeAnimating, setLikeAnimating] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const stop1  = TYPE_STOP1[project.type]  ?? "#7C3AED";
  const stop2  = TYPE_STOP2[project.type]  ?? "#4F46E5";
  const accent = TYPE_ACCENT[project.type] ?? "#A78BFA";

  const handleLike = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !optimisticLiked;
    setOptimisticLiked(next);
    setOptimisticLikes((c) => c + (next ? 1 : -1));
    if (next) { setLikeAnimating(true); setTimeout(() => setLikeAnimating(false), 350); }
    onLike?.(project.id);
  }, [optimisticLiked, onLike, project.id]);

  return (
    <article
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        borderRadius: 24,
        overflow: "hidden",
        background: "rgba(255,255,255,0.038)",
        border: "1px solid rgba(255,255,255,0.072)",
        boxShadow: isHovered
          ? [
              `0 16px 48px rgba(0,0,0,0.55)`,
              `0 6px 20px rgba(0,0,0,0.35)`,
              `0 0 0 1px rgba(${accent === "#A78BFA" ? "139,92,246" : "255,255,255"},0.06)`,
            ].join(", ")
          : [
              "0 4px 20px rgba(0,0,0,0.32)",
              "0 1px 4px rgba(0,0,0,0.20)",
            ].join(", "),
        transform: isHovered ? "translateY(-3px) scale(1.004)" : "translateY(0) scale(1)",
        transition: [
          `transform 0.28s ${EASE_IOS}`,
          `box-shadow 0.28s ${EASE_IOS}`,
        ].join(", "),
        willChange: "transform",
      }}
    >
      {/* ── Author header ─────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 16px 12px",
        }}
      >
        <button
          onClick={() => project.authorId && onCreatorClick?.(project.authorId)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            transition: `opacity 0.15s ${EASE_IOS}`,
          }}
        >
          {/* Avatar with gradient ring + inner glow */}
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              padding: "1.5px",
              background: `linear-gradient(135deg, ${accent}, #EC4899)`,
              boxShadow: `0 0 12px ${accent}40`,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: "50%",
                background: "linear-gradient(145deg, #1c1c24, #111118)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
              }}
            >
              {project.thumbnail}
            </div>
          </div>

          <div style={{ textAlign: "left" }}>
            <p style={{ color: "#F8F8FF", fontSize: 13, fontWeight: 600, lineHeight: 1.3, letterSpacing: "-0.01em" }}>
              {project.authorName ?? "Creator"}
            </p>
            <p style={{ color: "rgba(255,255,255,0.38)", fontSize: 11, marginTop: 1 }}>
              {timeAgo(project.publishedAt)} ago
            </p>
          </div>
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Type badge */}
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: "3px 10px",
              borderRadius: 99,
              background: `${accent}16`,
              color: accent,
              border: `1px solid ${accent}28`,
              letterSpacing: "0.03em",
              textTransform: "uppercase",
            }}
          >
            {TYPE_LABELS[project.type] ?? project.type}
          </span>
          <button
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.07)",
              transition: `background 0.15s ${EASE_IOS}`,
            }}
          >
            <MoreHorizontal style={{ width: 14, height: 14, color: "rgba(255,255,255,0.36)" }} />
          </button>
        </div>
      </div>

      {/* ── Visual image area ─────────────────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          margin: "0 12px",
          borderRadius: 18,
          overflow: "hidden",
          height: 210,
        }}
      >
        {/* Deep gradient bg */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(145deg, ${stop1}CC 0%, ${stop2}AA 50%, ${stop2}88 100%)`,
          }}
        />

        {/* Subtle noise texture overlay — adds tactility */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.06,
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
            backgroundSize: "128px 128px",
          }}
        />

        {/* Top-left specular highlight */}
        <div
          style={{
            position: "absolute",
            top: -40,
            left: -40,
            width: 160,
            height: 160,
            borderRadius: "50%",
            background: `radial-gradient(circle, rgba(255,255,255,0.14) 0%, transparent 70%)`,
            pointerEvents: "none",
          }}
        />

        {/* Central emoji */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontSize: 76,
              userSelect: "none",
              filter: [
                "drop-shadow(0 12px 28px rgba(0,0,0,0.55))",
                "drop-shadow(0 4px 8px rgba(0,0,0,0.30))",
              ].join(" "),
              transition: `transform 0.35s ${EASE_SPRING}`,
              transform: isHovered ? "scale(1.06) translateY(-3px)" : "scale(1)",
            }}
          >
            {project.thumbnail}
          </span>
        </div>

        {/* Bottom gradient + title */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "40px 14px 12px",
            background: "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.20) 65%, transparent 100%)",
          }}
        >
          <p
            style={{
              color: "#FFFFFF",
              fontWeight: 700,
              fontSize: 14,
              letterSpacing: "-0.01em",
              textShadow: "0 1px 8px rgba(0,0,0,0.8)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {project.title}
          </p>
        </div>

        {/* ── Floating side interaction buttons ───────────────────────── */}
        <div
          style={{
            position: "absolute",
            right: 10,
            bottom: 48,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            alignItems: "center",
          }}
        >
          {/* Like */}
          <button
            onClick={handleLike}
            className="haptic"
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: optimisticLiked
                  ? "rgba(239,68,68,0.28)"
                  : "rgba(255,255,255,0.14)",
                border: optimisticLiked
                  ? "1px solid rgba(239,68,68,0.55)"
                  : "1px solid rgba(255,255,255,0.18)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                boxShadow: optimisticLiked
                  ? "0 0 16px rgba(239,68,68,0.35), 0 4px 8px rgba(0,0,0,0.3)"
                  : "0 4px 8px rgba(0,0,0,0.25)",
                transform: likeAnimating ? "scale(1.30)" : "scale(1.00)",
                transition: [
                  `transform 0.30s ${EASE_SPRING}`,
                  `background 0.20s ${EASE_IOS}`,
                  `border-color 0.20s ${EASE_IOS}`,
                  `box-shadow 0.20s ${EASE_IOS}`,
                ].join(", "),
              }}
            >
              <Heart
                style={{
                  width: 15,
                  height: 15,
                  color: optimisticLiked ? "#F87171" : "white",
                  fill: optimisticLiked ? "#F87171" : "none",
                  transition: `color 0.15s ${EASE_IOS}, fill 0.15s ${EASE_IOS}`,
                }}
              />
            </div>
            <span style={{ color: "rgba(255,255,255,0.90)", fontSize: 9, fontWeight: 600, textShadow: "0 1px 4px rgba(0,0,0,0.7)" }}>
              {optimisticLikes}
            </span>
          </button>

          {/* Remix / Fork */}
          <button
            onClick={() => onRemix?.(project.id)}
            className="haptic"
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(255,255,255,0.14)",
                border: "1px solid rgba(255,255,255,0.18)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                boxShadow: "0 4px 8px rgba(0,0,0,0.25)",
                transition: `transform 0.20s ${EASE_SPRING}, background 0.15s ${EASE_IOS}`,
              }}
            >
              <GitFork style={{ width: 15, height: 15, color: "white" }} />
            </div>
            <span style={{ color: "rgba(255,255,255,0.90)", fontSize: 9, fontWeight: 600, textShadow: "0 1px 4px rgba(0,0,0,0.7)" }}>
              {project.remixes}
            </span>
          </button>

          {/* Bookmark */}
          <button onClick={() => setSaved((s) => !s)}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: saved ? "rgba(139,92,246,0.28)" : "rgba(255,255,255,0.14)",
                border: saved ? "1px solid rgba(139,92,246,0.55)" : "1px solid rgba(255,255,255,0.18)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                boxShadow: saved
                  ? "0 0 14px rgba(139,92,246,0.35), 0 4px 8px rgba(0,0,0,0.3)"
                  : "0 4px 8px rgba(0,0,0,0.25)",
                transition: [
                  `transform 0.28s ${EASE_SPRING}`,
                  `background 0.20s ${EASE_IOS}`,
                  `border-color 0.20s ${EASE_IOS}`,
                  `box-shadow 0.20s ${EASE_IOS}`,
                ].join(", "),
              }}
            >
              <Bookmark
                style={{
                  width: 15,
                  height: 15,
                  color: saved ? "#C4B5FD" : "white",
                  fill: saved ? "#C4B5FD" : "none",
                  transition: `color 0.15s ${EASE_IOS}, fill 0.15s ${EASE_IOS}`,
                }}
              />
            </div>
          </button>
        </div>
      </div>

      {/* ── Caption + action row ───────────────────────────────────────────── */}
      <div style={{ padding: "12px 16px 16px" }}>
        {project.description && (
          <p
            style={{
              color: "rgba(255,255,255,0.52)",
              fontSize: 12.5,
              lineHeight: 1.55,
              marginBottom: 12,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              letterSpacing: "0.005em",
            }}
          >
            {project.description}
          </p>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {/* Like count */}
          <button
            onClick={handleLike}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "5px 8px",
              borderRadius: 99,
              background: optimisticLiked ? "rgba(239,68,68,0.10)" : "transparent",
              transition: `background 0.20s ${EASE_IOS}`,
            }}
          >
            <Heart
              style={{
                width: 13,
                height: 13,
                color: optimisticLiked ? "#F87171" : "rgba(255,255,255,0.38)",
                fill: optimisticLiked ? "#F87171" : "none",
                transition: `color 0.15s ${EASE_IOS}`,
              }}
            />
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              color: optimisticLiked ? "#F87171" : "rgba(255,255,255,0.38)",
              transition: `color 0.15s ${EASE_IOS}`,
            }}>
              {optimisticLikes.toLocaleString()}
            </span>
          </button>

          {/* Comments */}
          <button
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "5px 8px",
              borderRadius: 99,
            }}
          >
            <MessageCircle style={{ width: 13, height: 13, color: "rgba(255,255,255,0.30)" }} />
            <span style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.30)" }}>
              {project.plays}
            </span>
          </button>

          {/* Share */}
          <button
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "5px 8px",
              borderRadius: 99,
            }}
          >
            <Share2 style={{ width: 13, height: 13, color: "rgba(255,255,255,0.30)" }} />
          </button>

          {/* Run CTA */}
          <button
            onClick={() => onRun?.(project.id)}
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 16px",
              borderRadius: 99,
              background: "linear-gradient(135deg, #7C3AED 0%, #9333EA 50%, #DB2777 100%)",
              color: "white",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.02em",
              boxShadow: [
                "0 4px 14px rgba(124,58,237,0.45)",
                "0 2px 6px rgba(219,39,119,0.25)",
                "0 1px 2px rgba(0,0,0,0.30)",
                "inset 0 1px 0 rgba(255,255,255,0.18)",
              ].join(", "),
              transition: [
                `transform 0.20s ${EASE_SPRING}`,
                `box-shadow 0.20s ${EASE_IOS}`,
              ].join(", "),
              borderTop: "1px solid rgba(255,255,255,0.20)",
            }}
            onMouseEnter={(e) => {
              const btn = e.currentTarget;
              btn.style.transform = "scale(1.04)";
              btn.style.boxShadow = [
                "0 6px 20px rgba(124,58,237,0.60)",
                "0 3px 8px rgba(219,39,119,0.35)",
                "0 1px 2px rgba(0,0,0,0.30)",
                "inset 0 1px 0 rgba(255,255,255,0.20)",
              ].join(", ");
            }}
            onMouseLeave={(e) => {
              const btn = e.currentTarget;
              btn.style.transform = "scale(1.00)";
              btn.style.boxShadow = [
                "0 4px 14px rgba(124,58,237,0.45)",
                "0 2px 6px rgba(219,39,119,0.25)",
                "0 1px 2px rgba(0,0,0,0.30)",
                "inset 0 1px 0 rgba(255,255,255,0.18)",
              ].join(", ");
            }}
          >
            <Play style={{ width: 10, height: 10, fill: "white", strokeWidth: 0 }} />
            Run
          </button>
        </div>
      </div>
    </article>
  );
}
