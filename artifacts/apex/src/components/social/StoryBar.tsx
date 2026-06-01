import { useRef } from "react";
import { Plus } from "lucide-react";
import type { SocialProject } from "@/hooks/useSocial";

const EASE_SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const EASE_IOS    = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";

// ── Gradient ring presets ───────────────────────────────────────────────────────
const RING_CONFIGS = [
  { gFrom: "#8B5CF6", gMid: "#EC4899", gTo: "#F97316", glow: "rgba(139,92,246,0.60)" },
  { gFrom: "#06B6D4", gMid: "#3B82F6", gTo: "#8B5CF6", glow: "rgba(59,130,246,0.55)" },
  { gFrom: "#EC4899", gMid: "#EF4444", gTo: "#F97316", glow: "rgba(236,72,153,0.55)" },
  { gFrom: "#F59E0B", gMid: "#EF4444", gTo: "#EC4899", glow: "rgba(245,158,11,0.50)" },
  { gFrom: "#8B5CF6", gMid: "#6366F1", gTo: "#06B6D4", glow: "rgba(99,102,241,0.55)" },
  { gFrom: "#10B981", gMid: "#06B6D4", gTo: "#3B82F6", glow: "rgba(16,185,129,0.50)" },
];

const PLACEHOLDER_STORIES = [
  { id: -1, emoji: "🚀", name: "NexusBuild" },
  { id: -2, emoji: "🤖", name: "GPTForge"   },
  { id: -3, emoji: "🎮", name: "PixelCraft" },
  { id: -4, emoji: "⚡", name: "AutoFlow"   },
  { id: -5, emoji: "🦄", name: "Dreamer"    },
  { id: -6, emoji: "🔥", name: "HeatMap"    },
];

interface StoryBarProps {
  projects?: SocialProject[];
  onStoryClick?: (authorId: number) => void;
  onAddStory?: () => void;
}

export function StoryBar({ projects = [], onStoryClick, onAddStory }: StoryBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const stories = projects.length > 0
    ? projects.slice(0, 10).map((p, i) => ({
        id: p.id,
        authorId: p.authorId,
        emoji: p.thumbnail,
        name: (p.authorName ?? "Creator").split(" ")[0],
        ring: RING_CONFIGS[i % RING_CONFIGS.length],
        live: i < 2,
      }))
    : PLACEHOLDER_STORIES.map((s, i) => ({
        ...s,
        authorId: undefined,
        ring: RING_CONFIGS[i % RING_CONFIGS.length],
        live: i < 2,
      }));

  return (
    <div
      ref={scrollRef}
      style={{
        display: "flex",
        gap: 18,
        overflowX: "auto",
        padding: "10px 16px 14px",
        scrollSnapType: "x mandatory",
        msOverflowStyle: "none",
        scrollbarWidth: "none",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {/* ── Add Story ──────────────────────────────────────────────────── */}
      <button
        onClick={onAddStory}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
          flexShrink: 0,
          scrollSnapAlign: "start",
          transition: `transform 0.25s ${EASE_SPRING}`,
          cursor: "pointer",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,255,255,0.04)",
            border: "1.5px dashed rgba(255,255,255,0.22)",
            transition: `border-color 0.20s ${EASE_IOS}, background 0.20s ${EASE_IOS}`,
          }}
        >
          <Plus style={{ width: 20, height: 20, color: "rgba(255,255,255,0.45)", strokeWidth: 2 }} />
        </div>
        <span
          style={{
            fontSize: 10,
            color: "rgba(255,255,255,0.35)",
            fontWeight: 500,
            letterSpacing: "0.02em",
            whiteSpace: "nowrap",
          }}
        >
          Add
        </span>
      </button>

      {/* ── Story bubbles ─────────────────────────────────────────────── */}
      {stories.map((story, i) => {
        const ring = story.ring;
        return (
          <button
            key={story.id}
            onClick={() => story.authorId && onStoryClick?.(story.authorId)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              flexShrink: 0,
              scrollSnapAlign: "start",
              cursor: "pointer",
              /* stagger fade-in on mount */
              animation: `story-appear 0.45s ${EASE_SPRING} ${0.05 + i * 0.06}s both`,
            }}
          >
            <div style={{ position: "relative" }}>
              {/* Outer glow ring */}
              <div
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: "50%",
                  padding: "2.5px",
                  background: `conic-gradient(from 0deg, ${ring.gFrom}, ${ring.gMid}, ${ring.gTo}, ${ring.gFrom})`,
                  boxShadow: `0 0 14px ${ring.glow}, 0 0 28px ${ring.glow}60`,
                  animation: "ring-spin 6s linear infinite",
                  willChange: "transform",
                }}
              >
                {/* Inner circle */}
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: "50%",
                    background: "linear-gradient(145deg, #1a1a22, #101018)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "2px solid #0A0A0F",
                  }}
                >
                  <span
                    style={{
                      fontSize: 24,
                      userSelect: "none",
                      filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.5))",
                    }}
                  >
                    {story.emoji}
                  </span>
                </div>
              </div>

              {/* Live indicator with pulse */}
              {story.live && (
                <div
                  style={{
                    position: "absolute",
                    bottom: 2,
                    right: 2,
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #4ADE80, #22D3EE)",
                    border: "2.5px solid #0A0A0F",
                    boxShadow: "0 0 8px rgba(74,222,128,0.70), 0 0 16px rgba(74,222,128,0.35)",
                    animation: "live-dot-pulse 2.2s ease-in-out infinite",
                  }}
                />
              )}
            </div>

            <span
              style={{
                fontSize: 10,
                color: "rgba(255,255,255,0.55)",
                fontWeight: 500,
                letterSpacing: "0.02em",
                whiteSpace: "nowrap",
                maxWidth: 62,
                overflow: "hidden",
                textOverflow: "ellipsis",
                textAlign: "center",
              }}
            >
              {story.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
