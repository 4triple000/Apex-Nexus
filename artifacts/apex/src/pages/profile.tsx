import { useState, useEffect, useRef, Component, type ReactNode } from "react";
import { useParams, useLocation } from "wouter";
import {
  Users, Heart, Play, Star, Edit3, Check, X,
  Zap, Crown, DollarSign, Brain, Sparkles, Mic, Wrench,
  ChevronRight, Trash2, Swords, Flame, TrendingUp, LogOut,
  ShieldOff, Shield, Gamepad2,
} from "lucide-react";
import {
  getUserGamesList, queueGameForPlay, queueGameForEdit,
  GAME_ICONS, GAME_DESCRIPTIONS, getGameMeta,
  GAME_CREATED_EVENT, GAME_DELETED_EVENT,
  DEMO_GAMES,
} from "@/data/gameRegistry";
import type { GameConfig } from "@/engine/types";
import { FeedCard } from "@/components/social/FeedCard";
import { NotificationBell } from "@/components/social/NotificationBell";
import {
  useMyProfile, useProfile, useFollow, useUnfollow,
  useUpdateProfile, useLike, useLikedIds,
} from "@/hooks/useSocial";
import { useSubscriptionStatus } from "@/hooks/useMonetization";
import { useSession } from "@/hooks/use-session";
import { useToast } from "@/hooks/use-toast";
import { PersonalityBlender } from "@/components/personality/PersonalityBlender";
import { usePersonality } from "@/contexts/PersonalityContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePrivacy } from "@/contexts/PrivacyContext";
import { CharacterPanel } from "@/components/character/CharacterPanel";
import { MemoryManager } from "@/components/character/MemoryManager";
import { CharacterSwitcher } from "@/components/character/CharacterSwitcher";
import { useDailyStreak } from "@/lib/dailyStreak";

const IOS    = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";
const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

// ── Error boundary for safe rendering ─────────────────────────────────────────
class ProfileErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", height: "100%", background: "transparent",
          gap: 16, padding: 32,
        }}>
          <div style={{ fontSize: 40 }}>⚠️</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "white" }}>Something went wrong</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.40)", textAlign: "center" }}>
            Couldn't load this profile. Tap below to try again.
          </div>
          <button
            onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
            style={{
              padding: "10px 24px", borderRadius: 99, fontSize: 12, fontWeight: 700,
              background: "linear-gradient(135deg, #6C5CE7, #A29BFE)", color: "white",
              border: "none", cursor: "pointer",
            }}
          >Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Tier system ──────────────────────────────────────────────────────────────
const TIERS = [
  { name: "Bronze",  min: 0,     max: 99,    color: "#CD7F32", glow: "rgba(205,127,50,0.40)",   icon: "🥉" },
  { name: "Silver",  min: 100,   max: 499,   color: "#C0C0C0", glow: "rgba(192,192,192,0.35)",  icon: "🥈" },
  { name: "Gold",    min: 500,   max: 1999,  color: "#FFD700", glow: "rgba(255,215,0,0.40)",    icon: "🥇" },
  { name: "Elite",   min: 2000,  max: 9999,  color: "#A29BFE", glow: "rgba(162,155,254,0.45)", icon: "💎" },
  { name: "Apex",    min: 10000, max: Infinity, color: "#FD79A8", glow: "rgba(253,121,168,0.50)", icon: "👑" },
];

function getTier(pts: number) {
  return TIERS.find((t) => pts >= t.min && pts <= t.max) ?? TIERS[0];
}

function getXpProgress(pts: number) {
  const tier = getTier(pts);
  const idx   = TIERS.indexOf(tier);
  if (idx >= TIERS.length - 1) return 100;
  const range = TIERS[idx + 1].min - tier.min;
  return Math.round(((pts - tier.min) / range) * 100);
}

// ── Default memory items ─────────────────────────────────────────────────────
const DEFAULT_MEMORY = [
  { id: "1", icon: "💬", label: "Prefers concise, direct responses",       category: "Style"    },
  { id: "2", icon: "🤖", label: "Interested in AI, tech & future systems", category: "Topics"   },
  { id: "3", icon: "🌙", label: "Most active late night (10PM–2AM)",       category: "Behavior" },
  { id: "4", icon: "⚡", label: "Enjoys Battle Mode & competitive queries", category: "Features" },
  { id: "5", icon: "🎯", label: "Prefers analytical thinking depth",        category: "Thinking" },
];

// ── Personalization config ───────────────────────────────────────────────────
const PERSONALITIES = [
  { id: "strategist", label: "Strategist", emoji: "🎯", desc: "Sharp & calculated" },
  { id: "friend",     label: "Friend",     emoji: "😊", desc: "Warm & supportive"  },
  { id: "mentor",     label: "Mentor",     emoji: "🧠", desc: "Wise & guiding"     },
  { id: "innovator",  label: "Innovator",  emoji: "✨", desc: "Creative & bold"    },
  { id: "debater",    label: "Debater",    emoji: "⚖️", desc: "Direct & persuasive" },
];

const RESPONSE_STYLES = [
  { id: "concise",   label: "Concise",    emoji: "⚡", desc: "Short & punchy"   },
  { id: "balanced",  label: "Balanced",   emoji: "⚖️", desc: "Clear & thorough"  },
  { id: "detailed",  label: "Detailed",   emoji: "📖", desc: "Deep & exhaustive" },
];

const THINK_DEPTHS = [
  { id: "fast",      label: "Fast",       emoji: "🚀", desc: "Quick answers"    },
  { id: "standard",  label: "Standard",   emoji: "⚙️", desc: "Balanced depth"   },
  { id: "deep",      label: "Deep Think", emoji: "🔬", desc: "Thorough analysis" },
];

const VOICE_OPTIONS = [
  { id: "samantha",  label: "Samantha",   emoji: "🎤", desc: "Warm & clear"     },
  { id: "nova",      label: "Nova",        emoji: "🌟", desc: "Energetic & crisp" },
  { id: "alex",      label: "Alex",        emoji: "🎙️", desc: "Deep & authoritative" },
];

const TOOL_OPTIONS = [
  { id: "search",  label: "Web Search",      icon: "🔍", enabled: true  },
  { id: "code",    label: "Code Generation", icon: "💻", enabled: true  },
  { id: "images",  label: "Image Analysis",  icon: "🖼️", enabled: false },
  { id: "memory",  label: "Long Memory",     icon: "🧠", enabled: true  },
  { id: "voice",   label: "Voice Output",    icon: "🔊", enabled: false },
];

// ── Upgrade feature cards ────────────────────────────────────────────────────
const FEATURE_CARDS: { icon: string; label: string; desc: string; color: string; available: boolean; route: string | null; phase: "early_access" | "rolling_out" | "coming_soon" | null }[] = [
  { icon: "⚔️", label: "AI Battle Arena",    desc: "Challenge AIs head-to-head in real-time battles",    color: "#EF4444", available: true,  route: "/arena",        phase: null },
  { icon: "🎨", label: "AI Studio",          desc: "Build apps and automations with visual AI tools",     color: "#A29BFE", available: true,  route: "/ai-studio",    phase: null                    },
  { icon: "🏪", label: "Marketplace",        desc: "Discover and deploy community-built AI tools",        color: "#10B981", available: true,  route: "/marketplace",  phase: null },
  { icon: "🔄", label: "Workflow Engine",    desc: "Chain AI agents into automated pipelines",            color: "#F59E0B", available: true,  route: "/workflows",    phase: null },
  { icon: "🧬", label: "AI Avatar System",   desc: "3D avatar that reacts to your conversations",         color: "#EC4899", available: true,  route: "/apex-avatar",  phase: null },
  { icon: "🎮", label: "Multiplayer Arena",  desc: "Real-time AI-powered multiplayer battles and lobbies",color: "#6C5CE7", available: true,  route: "/multiplayer",  phase: null },
  { icon: "🌐", label: "Multi-Agent Hub",    desc: "Coordinate multiple AI specialists in one task",      color: "#228BE6", available: true,  route: "/studio",       phase: null },
];

// ── Glowing toggle ───────────────────────────────────────────────────────────
function GlowToggle({ on, onChange, color = "#6C5CE7" }: { on: boolean; onChange: () => void; color?: string }) {
  return (
    <div
      onClick={onChange}
      style={{
        width: 38, height: 22, borderRadius: 99, cursor: "pointer",
        background: on ? color : "rgba(255,255,255,0.10)",
        position: "relative",
        boxShadow: on ? `0 0 10px ${color}70` : "none",
        transition: `all 0.25s ${IOS}`,
        flexShrink: 0,
      }}
    >
      <div style={{
        position: "absolute", top: 3, left: on ? 19 : 3,
        width: 16, height: 16, borderRadius: "50%",
        background: "white", boxShadow: "0 1px 4px rgba(0,0,0,0.40)",
        transition: `left 0.25s ${SPRING}`,
      }} />
    </div>
  );
}

// ── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ icon, label, sub }: { icon: React.ReactNode; label: string; sub?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
      <div style={{
        width: 30, height: 30, borderRadius: 10,
        background: "rgba(108,92,231,0.20)",
        border: "1px solid rgba(108,92,231,0.30)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#A29BFE",
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 800, color: "white", letterSpacing: "-0.01em" }}>{label}</div>
        {sub && <div style={{ fontSize: 9, color: "rgba(255,255,255,0.30)", marginTop: 1, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ── MY GAMES SECTION ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

function ModeTag({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 20, fontSize: 9, fontWeight: 700,
      background: `${color}14`, border: `1px solid ${color}28`, color,
    }}>{children}</span>
  );
}

function modeTagLabel(m: string) {
  return m === "collect_all" ? "🪙 Collect"
    :    m === "reach_end"   ? "🏁 Reach End"
    :    m === "survive"     ? "⏱ Survive"
    :    m;
}

function GameMiniCard({
  game, onPlay, onEdit,
}: { game: GameConfig; onPlay: () => void; onEdit: () => void }) {
  const icon = GAME_ICONS[game.name] ?? "🎮";
  const desc = GAME_DESCRIPTIONS[game.name] ?? `${modeTagLabel(game.winCondition)} · gravity ${game.gravity}`;
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 18,
        background: hovered ? "rgba(108,92,231,0.10)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${hovered ? "rgba(108,92,231,0.35)" : "rgba(255,255,255,0.07)"}`,
        padding: "13px 14px",
        display: "flex", flexDirection: "column", gap: 10,
        transition: `all 0.22s ${IOS}`,
        boxShadow: hovered ? "0 0 22px rgba(108,92,231,0.18)" : "none",
      }}
    >
      {/* Top row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 13, flexShrink: 0,
          background: "rgba(108,92,231,0.14)",
          border: "1px solid rgba(108,92,231,0.22)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22,
        }}>{icon}</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "white", marginBottom: 3, letterSpacing: "-0.01em" }}>
            {game.name}
          </div>
          <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.38)", lineHeight: 1.45 }}>
            {desc}
          </p>
        </div>
      </div>

      {/* Tags */}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        <ModeTag color="#A29BFE">{modeTagLabel(game.winCondition)}</ModeTag>
        <ModeTag color="#6C5CE7">⚖️ {game.gravity}g</ModeTag>
        {(game.coins?.length ?? 0) > 0 && <ModeTag color="#A29BFE">🪙 {game.coins!.length}</ModeTag>}
        {game.enemies.length > 0 && <ModeTag color="#EF4444">👹 {game.enemies.length}</ModeTag>}
        {game.surviveSecs && <ModeTag color="#10B981">⏱ {game.surviveSecs}s</ModeTag>}
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 7 }}>
        <button
          onClick={onPlay}
          style={{
            flex: 1, padding: "9px 10px", borderRadius: 10, border: "none",
            background: "linear-gradient(135deg, #6C5CE7, #A29BFE)",
            color: "white", fontWeight: 700, fontSize: 11, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
            boxShadow: "0 3px 12px rgba(108,92,231,0.40)",
            transition: `transform 0.15s ${IOS}`,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.03)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
        >
          ▶ Play
        </button>
        <button
          onClick={onEdit}
          style={{
            flex: 1, padding: "9px 10px", borderRadius: 10,
            border: "1px solid rgba(108,92,231,0.30)",
            background: "rgba(108,92,231,0.08)",
            color: "#A29BFE", fontWeight: 700, fontSize: 11, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
            transition: `all 0.15s ${IOS}`,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(108,92,231,0.14)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(108,92,231,0.08)"; }}
        >
          📝 Edit
        </button>
      </div>
    </div>
  );
}

function relativeTime(iso: string): string {
  try {
    const ms   = Date.now() - new Date(iso).getTime();
    const secs = Math.floor(ms / 1000);
    if (secs < 60)   return "just now";
    const mins = Math.floor(secs / 60);
    if (mins < 60)   return `${mins}m ago`;
    const hrs  = Math.floor(mins / 60);
    if (hrs  < 24)   return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch {
    return "";
  }
}

function AiBadge() {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      padding: "2px 7px", borderRadius: 20, fontSize: 9, fontWeight: 800,
      background: "rgba(162,155,254,0.15)", border: "1px solid rgba(162,155,254,0.28)",
      color: "#A29BFE", letterSpacing: "0.04em",
    }}>🤖 AI</span>
  );
}

function MyGamesSection({ nav }: { nav: (path: string) => void }) {
  // Live-synced user games state
  const [userGames, setUserGames] = useState<GameConfig[]>(() => getUserGamesList());

  // Listen for real-time registry events
  useEffect(() => {
    const refresh = () => {
      setUserGames(getUserGamesList());
      console.log(`%c[Profile] ME TAB UPDATED — game list refreshed`, "color:#10B981;font-weight:bold");
    };
    window.addEventListener(GAME_CREATED_EVENT, refresh);
    window.addEventListener(GAME_DELETED_EVENT, refresh);
    return () => {
      window.removeEventListener(GAME_CREATED_EVENT, refresh);
      window.removeEventListener(GAME_DELETED_EVENT, refresh);
    };
  }, []);

  function handlePlay(cfg: GameConfig) {
    queueGameForPlay(cfg);
    nav("/games");
  }

  function handleEdit(cfg: GameConfig) {
    queueGameForEdit(cfg);
    nav("/game-engine");
  }

  const totalCount = DEMO_GAMES.length + userGames.length;

  return (
    <div>
      {/* Section header */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 10,
            background: "rgba(108,92,231,0.20)", border: "1px solid rgba(108,92,231,0.30)",
            display: "flex", alignItems: "center", justifyContent: "center", color: "#A29BFE",
          }}>
            <Gamepad2 size={14} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "white", letterSpacing: "-0.01em" }}>
              My Games
            </div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.30)", marginTop: 1, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
              {totalCount} game{totalCount !== 1 ? "s" : ""} · tap to play instantly
            </div>
          </div>
        </div>
      </div>

      {/* ── 🔥 AI Created Games ──────────────────────────────── */}
      {userGames.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 6, marginBottom: 8,
            padding: "5px 10px 5px 12px", borderRadius: 12,
            background: "rgba(162,155,254,0.07)", border: "1px solid rgba(162,155,254,0.16)",
          }}>
            <span style={{ fontSize: 13 }}>🔥</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#A29BFE" }}>AI Created Games</span>
            <span style={{
              marginLeft: "auto", fontSize: 9, fontWeight: 700,
              background: "rgba(162,155,254,0.15)", border: "1px solid rgba(162,155,254,0.25)",
              color: "#A29BFE", padding: "1px 7px", borderRadius: 99,
            }}>{userGames.length}</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {userGames.map((game, i) => {
              const meta = getGameMeta(game.name);
              return (
                <div
                  key={`user-${game.name}-${i}`}
                  style={{
                    borderRadius: 18,
                    background: "rgba(108,92,231,0.07)",
                    border: "1px solid rgba(108,92,231,0.20)",
                    padding: "13px 14px",
                    display: "flex", flexDirection: "column", gap: 10,
                    transition: `all 0.22s ${IOS}`,
                  }}
                >
                  {/* Top row */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 13, flexShrink: 0,
                      background: "rgba(108,92,231,0.14)",
                      border: "1px solid rgba(108,92,231,0.22)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 22,
                    }}>🤖</div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: "white", letterSpacing: "-0.01em" }}>
                          {game.name}
                        </span>
                        <AiBadge />
                      </div>
                      {meta?.description && (
                        <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.38)", lineHeight: 1.45, marginBottom: 4 }}>
                          {meta.description}
                        </p>
                      )}
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
                        <ModeTag color="#A29BFE">{
                          game.winCondition === "collect_all" ? "🪙 Collect"
                          : game.winCondition === "reach_end"  ? "🏁 Reach End"
                          : game.winCondition === "defeat_all" ? "⚔️ Defeat All"
                          : "⏱ Survive"
                        }</ModeTag>
                        <ModeTag color="#6C5CE7">⚖️ {game.gravity}g</ModeTag>
                        {(game.coins?.length ?? 0) > 0 && <ModeTag color="#A29BFE">🪙 {game.coins!.length}</ModeTag>}
                        {game.enemies.length > 0 && <ModeTag color="#EF4444">👹 {game.enemies.length}</ModeTag>}
                        {meta?.createdAt && (
                          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", marginLeft: "auto" }}>
                            {relativeTime(meta.createdAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: "flex", gap: 7 }}>
                    <button onClick={() => handlePlay(game)} style={{
                      flex: 1, padding: "9px 10px", borderRadius: 10, border: "none",
                      background: "linear-gradient(135deg, #6C5CE7, #A29BFE)",
                      color: "white", fontWeight: 700, fontSize: 11, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                      boxShadow: "0 3px 12px rgba(108,92,231,0.40)",
                    }}>▶ Play</button>
                    <button onClick={() => handleEdit(game)} style={{
                      flex: 1, padding: "9px 10px", borderRadius: 10,
                      border: "1px solid rgba(108,92,231,0.30)",
                      background: "rgba(108,92,231,0.08)",
                      color: "#A29BFE", fontWeight: 700, fontSize: 11, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                    }}>📝 Edit</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 🎮 Demo Games ─────────────────────────────────────── */}
      <div>
        <div style={{
          display: "flex", alignItems: "center", gap: 6, marginBottom: 8,
          padding: "5px 10px 5px 12px", borderRadius: 12,
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
        }}>
          <span style={{ fontSize: 13 }}>🎮</span>
          <span style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.60)" }}>Demo Games</span>
          <span style={{
            marginLeft: "auto", fontSize: 9, fontWeight: 700,
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)",
            color: "rgba(255,255,255,0.35)", padding: "1px 7px", borderRadius: 99,
          }}>{DEMO_GAMES.length}</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {DEMO_GAMES.map((game, i) => (
            <GameMiniCard
              key={`demo-${game.name}-${i}`}
              game={game}
              onPlay={() => handlePlay(game)}
              onEdit={() => handleEdit(game)}
            />
          ))}
        </div>
      </div>

      {/* Quick-access CTA */}
      <button
        onClick={() => nav("/game-engine")}
        style={{
          width: "100%", marginTop: 12, padding: "11px 16px",
          borderRadius: 14, cursor: "pointer",
          background: "rgba(108,92,231,0.07)",
          border: "1px solid rgba(108,92,231,0.22)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          transition: `all 0.20s ${IOS}`,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(108,92,231,0.12)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(108,92,231,0.07)"; }}
      >
        <div style={{ textAlign: "left" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#A29BFE" }}>
            🛠 Open Game Studio
          </div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.28)", marginTop: 2 }}>
            AI generator · multiplayer · create new games
          </div>
        </div>
        <ChevronRight size={14} style={{ color: "#A29BFE", flexShrink: 0 }} />
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ── ME DASHBOARD ────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
function MeDashboard({
  profile, stats, subData, onEdit, editing, editUsername, editBio, editEmoji,
  setEditUsername, setEditBio, onSave, onCancelEdit,
}: {
  profile: any; stats: any; subData: any; onEdit: () => void; editing: boolean;
  editUsername: string; editBio: string; editEmoji: string;
  setEditUsername: (v: string) => void; setEditBio: (v: string) => void;
  onSave: () => void; onCancelEdit: () => void;
}) {
  const [, nav] = useLocation();
  const [openPanel, setOpenPanel] = useState<string | null>(null);
  const [responseStyle, setResponseStyle] = useState("balanced");
  const [thinkDepth, setThinkDepth]     = useState("standard");
  const [voiceChoice, setVoiceChoice]   = useState("samantha");
  const [tools, setTools]               = useState(TOOL_OPTIONS);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const EMOJIS = ["🎮", "🚀", "🤖", "⚡", "🎯", "🦊", "🐉", "🌙", "🔥", "💫", "🎨", "🦄"];

  const { personality: globalPersonality } = usePersonality();
  const personalityId = globalPersonality?.id ?? "strategist";
  const { logout } = useAuth();
  const { privacyMode, togglePrivacyMode } = usePrivacy();

  // Voice tone analysis privacy controls (persisted to localStorage)
  const [voiceAnalysis, setVoiceAnalysis] = useState(() => {
    try { return localStorage.getItem("apex_voice_tone_enabled") !== "false"; } catch { return true; }
  });
  const [voiceHistoryStore, setVoiceHistoryStore] = useState(() => {
    try { return localStorage.getItem("apex_voice_tone_store_history") !== "false"; } catch { return true; }
  });
  function toggleVoiceAnalysis() {
    setVoiceAnalysis((v) => {
      const next = !v;
      try { localStorage.setItem("apex_voice_tone_enabled", String(next)); } catch {}
      return next;
    });
  }
  function toggleVoiceHistoryStore() {
    setVoiceHistoryStore((v) => {
      const next = !v;
      try { localStorage.setItem("apex_voice_tone_store_history", String(next)); } catch {}
      return next;
    });
  }

  const reputation = stats.reputation ?? 0;
  const streak = useDailyStreak()?.streak ?? 0;
  const tier        = getTier(reputation);
  const xpProgress  = getXpProgress(reputation);
  const nextTier    = TIERS[Math.min(TIERS.indexOf(tier) + 1, TIERS.length - 1)];
  const isProUser   = subData?.status === "active";
  const tierLabel   = subData?.tier === "creator_pro" ? "Creator Pro" : "Pro";

  function toggleTool(id: string) {
    setTools((prev) => prev.map((t) => t.id === id ? { ...t, enabled: !t.enabled } : t));
  }

  const panelItems = [
    { id: "personality", icon: <Sparkles size={14} />, label: "Personality",    current: PERSONALITIES.find((p) => p.id === personalityId)?.label ?? "Strategist", color: "#A29BFE" },
    { id: "response",    icon: <Zap size={14} />,      label: "Response Style", current: RESPONSE_STYLES.find((r) => r.id === responseStyle)?.label ?? "Balanced", color: "#10B981" },
    { id: "thinking",    icon: <Brain size={14} />,    label: "Thinking Depth", current: THINK_DEPTHS.find((t) => t.id === thinkDepth)?.label ?? "Standard",      color: "#F59E0B" },
    { id: "voice",       icon: <Mic size={14} />,      label: "Voice",          current: VOICE_OPTIONS.find((v) => v.id === voiceChoice)?.label ?? "Samantha",    color: "#EC4899" },
    { id: "tools",       icon: <Wrench size={14} />,   label: "Tools",          current: `${tools.filter((t) => t.enabled).length} active`,                       color: "#228BE6" },
  ];

  return (
    <div style={{ padding: "0 14px 100px", display: "flex", flexDirection: "column", gap: 14 }}>

      {/* ── 1. Identity Hero Card ─────────────────────────── */}
      <div style={{
        borderRadius: 26,
        background: "linear-gradient(135deg, rgba(108,92,231,0.18) 0%, rgba(162,155,254,0.08) 45%, rgba(253,121,168,0.12) 100%)",
        border: `1px solid ${tier.color}30`,
        padding: "22px 20px 18px",
        position: "relative", overflow: "hidden",
        boxShadow: `0 0 40px ${tier.glow}, 0 8px 32px rgba(0,0,0,0.40)`,
        animation: "identity-card-in 0.4s ease-out both",
      }}>
        {/* Ambient orb */}
        <div style={{
          position: "absolute", top: -50, right: -30, width: 160, height: 160,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${tier.glow}, transparent 70%)`,
          pointerEvents: "none",
        }} />
        {/* Scanline texture */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px, transparent 1px, transparent 3px)",
        }} />

        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, position: "relative" }}>
          {/* Avatar */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <button
              onClick={() => editing && setShowEmojiPicker((v) => !v)}
              style={{
                fontSize: 42, width: 76, height: 76, borderRadius: 24,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: `linear-gradient(135deg, ${tier.color}30, ${tier.color}12)`,
                border: `2px solid ${tier.color}50`,
                boxShadow: `0 0 20px ${tier.glow}, 0 8px 24px rgba(0,0,0,0.35)`,
                cursor: editing ? "pointer" : "default",
                transition: `all 0.22s ${SPRING}`,
              }}
            >{editing ? editEmoji : profile.avatarEmoji}</button>

            {/* Tier icon */}
            <div style={{
              position: "absolute", bottom: -6, right: -6,
              fontSize: 18, width: 26, height: 26,
              display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: 9, background: "transparent",
              border: `1px solid ${tier.color}50`,
            }}>{tier.icon}</div>

            {/* Emoji picker */}
            {showEmojiPicker && editing && (
              <div style={{
                position: "absolute", top: "100%", left: 0, marginTop: 8, zIndex: 50,
                padding: 10, borderRadius: 16,
                background: "rgba(14,12,32,0.55)", backdropFilter: "blur(24px)",
                border: "1px solid rgba(108,92,231,0.30)",
                display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 4,
                boxShadow: "0 20px 60px rgba(0,0,0,0.70)",
                animation: "dm-drawer-enter 0.22s ease-out both",
              }}>
                {EMOJIS.map((e) => (
                  <button key={e} style={{
                    fontSize: 20, width: 36, height: 36, borderRadius: 10, cursor: "pointer",
                    background: "rgba(255,255,255,0.04)", border: "1px solid transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: `background 0.15s ease`,
                  }}
                  onClick={() => { setShowEmojiPicker(false); }}
                  >{e}</button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {editing ? (
              <input
                autoFocus
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                maxLength={30}
                placeholder="Username"
                style={{
                  width: "100%", fontSize: 18, fontWeight: 900,
                  background: "rgba(108,92,231,0.12)", border: "1px solid rgba(108,92,231,0.35)",
                  borderRadius: 12, padding: "7px 12px", color: "white", outline: "none",
                  marginBottom: 8, boxSizing: "border-box", caretColor: "#A29BFE",
                }}
              />
            ) : (
              <h2 style={{ fontSize: 22, fontWeight: 900, color: "white", margin: "0 0 4px", letterSpacing: "-0.01em" }}>
                {profile.username}
              </h2>
            )}

            {/* Tier + Pro badges */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 4,
                padding: "3px 9px", borderRadius: 99,
                background: `${tier.color}18`,
                border: `1px solid ${tier.color}35`,
              }}>
                <span style={{ fontSize: 9 }}>{tier.icon}</span>
                <span style={{ fontSize: 9, fontWeight: 800, color: tier.color, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                  {tier.name} Tier
                </span>
              </div>
              {isProUser && (
                <div style={{
                  padding: "3px 9px", borderRadius: 99,
                  background: "rgba(162,155,254,0.15)", border: "1px solid rgba(162,155,254,0.30)",
                  fontSize: 9, fontWeight: 800, color: "#A29BFE", letterSpacing: "0.04em",
                }}>👑 {tierLabel}</div>
              )}
            </div>

            {/* XP bar */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>
                  {reputation.toLocaleString()} XP
                </span>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)" }}>
                  {tier.name !== "Apex" ? `→ ${nextTier.name} at ${nextTier.min.toLocaleString()}` : "MAX TIER"}
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 99, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${xpProgress}%`, borderRadius: 99,
                  background: `linear-gradient(90deg, ${tier.color}aa, ${tier.color})`,
                  boxShadow: `0 0 8px ${tier.glow}`,
                  transition: `width 0.6s ${IOS}`,
                }} />
              </div>
            </div>

            {editing && (
              <textarea
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                maxLength={200}
                rows={2}
                placeholder="Short bio…"
                style={{
                  width: "100%", marginTop: 10,
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 12, padding: "8px 12px",
                  fontSize: 11, color: "rgba(255,255,255,0.80)", outline: "none",
                  resize: "none", boxSizing: "border-box", caretColor: "#A29BFE", lineHeight: 1.5,
                  fontFamily: "inherit",
                }}
              />
            )}
          </div>

          {/* Edit controls */}
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {editing ? (
              <>
                <button onClick={onSave} style={{
                  width: 32, height: 32, borderRadius: "50%", cursor: "pointer",
                  background: "rgba(16,185,129,0.20)", border: "1px solid rgba(16,185,129,0.35)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Check size={13} style={{ color: "#10B981" }} />
                </button>
                <button onClick={onCancelEdit} style={{
                  width: 32, height: 32, borderRadius: "50%", cursor: "pointer",
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <X size={13} style={{ color: "rgba(255,255,255,0.50)" }} />
                </button>
              </>
            ) : (
              <button onClick={onEdit} style={{
                width: 32, height: 32, borderRadius: "50%", cursor: "pointer",
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: `all 0.18s ${IOS}`,
              }}>
                <Edit3 size={13} style={{ color: "rgba(255,255,255,0.55)" }} />
              </button>
            )}
          </div>
        </div>

        {/* Bio (non-editing) */}
        {!editing && profile.bio && (
          <p style={{
            fontSize: 12, color: "rgba(255,255,255,0.50)", lineHeight: 1.55,
            margin: "12px 0 0", position: "relative",
          }}>{profile.bio}</p>
        )}
      </div>

      {/* ── 2. Interaction Stats ──────────────────────────── */}
      <div>
        <SectionHeader icon={<TrendingUp size={14} />} label="Your Stats" sub="Activity overview" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            { icon: "🎮", label: "Game Plays",    value: stats.totalPlays ?? 0,                 color: "#A29BFE",  suffix: "" },
            { icon: "⭐", label: "Reputation",    value: reputation,                            color: "#A29BFE", suffix: " pts" },
            { icon: "❤️", label: "Likes",          value: stats.totalLikes ?? 0,                color: "#EC4899", suffix: "" },
            { icon: "🔥", label: "Day Streak",     value: streak,                                color: "#F59E0B", suffix: streak === 1 ? " day" : " days" },
          ].map(({ icon, label, value, color, suffix }) => (
            <div key={label} style={{
              padding: "14px 16px", borderRadius: 20,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.07)",
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <div style={{
                fontSize: 22, width: 40, height: 40,
                borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center",
                background: `${color}12`, border: `1px solid ${color}25`,
              }}>{icon}</div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 900, color, letterSpacing: "-0.01em", lineHeight: 1 }}>
                  {value.toLocaleString()}{suffix}
                </div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.30)", marginTop: 3, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                  {label}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => nav("/pricing")} style={{
          flex: 1, padding: "12px", borderRadius: 16, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
          background: isProUser
            ? "rgba(162,155,254,0.12)" : "linear-gradient(135deg, #6C5CE7, #A29BFE)",
          border: isProUser ? "1px solid rgba(162,155,254,0.30)" : "none",
          fontSize: 12, fontWeight: 800,
          color: isProUser ? "#A29BFE" : "white",
          boxShadow: isProUser ? "none" : "0 4px 16px rgba(108,92,231,0.45)",
        }}>
          {isProUser ? <Crown size={13} /> : <Zap size={13} />}
          {isProUser ? tierLabel : "Upgrade to Pro"}
        </button>
        <button onClick={() => nav("/creator-dashboard")} style={{
          flex: 1, padding: "12px", borderRadius: 16, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)",
          fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.60)",
        }}>
          <DollarSign size={13} />Creator Hub
        </button>
      </div>

      {/* ── My Games ──────────────────────────────────────── */}
      <MyGamesSection nav={nav} />

      {/* ── Privacy Mode ──────────────────────────────────── */}
      <div>
        <SectionHeader icon={privacyMode ? <ShieldOff size={14} /> : <Shield size={14} />} label="Privacy" sub="Control what Apex remembers" />
        <button
          onClick={togglePrivacyMode}
          style={{
            width: "100%", textAlign: "left", cursor: "pointer",
            padding: "16px 18px", borderRadius: 20,
            background: privacyMode ? "rgba(16,185,129,0.09)" : "rgba(255,255,255,0.03)",
            border: `1px solid ${privacyMode ? "rgba(16,185,129,0.30)" : "rgba(255,255,255,0.08)"}`,
            transition: `all 0.25s ${IOS}`,
            display: "flex", alignItems: "center", gap: 14,
          }}
          onMouseEnter={(e) => { if (!privacyMode) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
          onMouseLeave={(e) => { if (!privacyMode) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
        >
          {/* Icon */}
          <div style={{
            width: 44, height: 44, borderRadius: 14, flexShrink: 0,
            background: privacyMode ? "rgba(16,185,129,0.18)" : "rgba(255,255,255,0.05)",
            border: `1px solid ${privacyMode ? "rgba(16,185,129,0.35)" : "rgba(255,255,255,0.09)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: privacyMode ? "#10B981" : "rgba(255,255,255,0.40)",
            transition: `all 0.25s ${IOS}`,
          }}>
            {privacyMode ? <ShieldOff size={20} /> : <Shield size={20} />}
          </div>
          {/* Text */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: privacyMode ? "#10B981" : "rgba(255,255,255,0.85)" }}>
              Privacy Mode
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.38)", marginTop: 3, lineHeight: 1.45 }}>
              {privacyMode
                ? "Apex will not remember anything this session"
                : "Enable to stop Apex from storing conversations"}
            </div>
            {privacyMode && (
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                marginTop: 6, padding: "2px 8px", borderRadius: 99,
                background: "rgba(16,185,129,0.15)",
                border: "1px solid rgba(16,185,129,0.25)",
                fontSize: 9, fontWeight: 700, color: "#10B981",
                letterSpacing: "0.05em",
              }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#10B981", display: "inline-block" }} />
                ACTIVE
              </div>
            )}
          </div>
          {/* Toggle */}
          <GlowToggle on={privacyMode} onChange={togglePrivacyMode} color="#10B981" />
        </button>
        {privacyMode && (
          <div style={{
            marginTop: 8, padding: "10px 14px", borderRadius: 12,
            background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.12)",
            fontSize: 10, color: "rgba(255,255,255,0.42)", lineHeight: 1.6,
            animation: "pm-badge-in 0.25s ease-out both",
          }}>
            While Privacy Mode is on: memory extraction is paused, no conversation context is sent to AI, and voice tone patterns won't be saved.
            You can still use Apex normally — nothing is stored.
          </div>
        )}
      </div>

      {/* ── 3. Apex Bond & Memory ─────────────────────────── */}
      <div>
        <SectionHeader icon={<Brain size={14} />} label="Apex Bond" sub="Your relationship with Apex · live memory" />
        <CharacterPanel />
        <div style={{ marginTop: 10 }}>
          <MemoryManager />
        </div>
      </div>

      {/* ── 4. AI Characters ──────────────────────────────── */}
      <div>
        <SectionHeader icon={<Swords size={14} />} label="AI Characters" sub="Choose your Apex identity" />
        <CharacterSwitcher />
      </div>

      {/* ── 5. Personalization Hub ───────────────────────── */}
      <div>
        <SectionHeader icon={<Sparkles size={14} />} label="Personalization Hub" sub="Tune your AI experience" />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {panelItems.map(({ id, icon, label, current, color }) => (
            <div key={id}>
              {/* Card trigger */}
              <button
                onClick={() => setOpenPanel(openPanel === id ? null : id)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 12,
                  padding: "13px 16px", borderRadius: openPanel === id ? "16px 16px 0 0" : 16,
                  background: openPanel === id ? `${color}14` : "rgba(255,255,255,0.04)",
                  border: openPanel === id ? `1px solid ${color}35` : "1px solid rgba(255,255,255,0.07)",
                  borderBottom: openPanel === id ? "none" : undefined,
                  cursor: "pointer",
                  transition: `all 0.22s ${IOS}`,
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 11, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: openPanel === id ? `${color}20` : "rgba(255,255,255,0.05)",
                  border: openPanel === id ? `1px solid ${color}35` : "1px solid rgba(255,255,255,0.08)",
                  color: openPanel === id ? color : "rgba(255,255,255,0.50)",
                  transition: `all 0.22s ${IOS}`,
                }}>
                  {icon}
                </div>
                <div style={{ flex: 1, textAlign: "left" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: openPanel === id ? color : "rgba(255,255,255,0.80)", marginBottom: 1 }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{current}</div>
                </div>
                <ChevronRight
                  size={14}
                  style={{
                    color: "rgba(255,255,255,0.25)",
                    transform: openPanel === id ? "rotate(90deg)" : "rotate(0deg)",
                    transition: `transform 0.22s ${IOS}`,
                  }}
                />
              </button>

              {/* Expanded panel */}
              {openPanel === id && (
                <div style={{
                  padding: "14px 14px 16px",
                  borderRadius: "0 0 16px 16px",
                  background: `${color}0a`,
                  border: `1px solid ${color}25`,
                  borderTop: "none",
                  animation: "dm-drawer-enter 0.22s ease-out both",
                }}>

                  {id === "personality" && (
                    <PersonalityBlender compact />
                  )}

                  {id === "response" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {RESPONSE_STYLES.map((r) => (
                        <button key={r.id}
                          onClick={() => setResponseStyle(r.id)}
                          style={{
                            display: "flex", alignItems: "center", gap: 10,
                            padding: "10px 12px", borderRadius: 12, cursor: "pointer",
                            background: responseStyle === r.id ? "rgba(16,185,129,0.14)" : "rgba(255,255,255,0.03)",
                            border: responseStyle === r.id ? "1px solid rgba(16,185,129,0.35)" : "1px solid rgba(255,255,255,0.07)",
                            transition: `all 0.18s ${IOS}`,
                          }}
                        >
                          <span style={{ fontSize: 20 }}>{r.emoji}</span>
                          <div style={{ flex: 1, textAlign: "left" }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: responseStyle === r.id ? "#10B981" : "rgba(255,255,255,0.70)" }}>{r.label}</div>
                            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.30)" }}>{r.desc}</div>
                          </div>
                          {responseStyle === r.id && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#10B981", boxShadow: "0 0 8px #10B981" }} />}
                        </button>
                      ))}
                    </div>
                  )}

                  {id === "thinking" && (
                    <div style={{ display: "flex", gap: 8 }}>
                      {THINK_DEPTHS.map((t) => (
                        <button key={t.id}
                          onClick={() => setThinkDepth(t.id)}
                          style={{
                            flex: 1, padding: "12px 8px", borderRadius: 13, cursor: "pointer", textAlign: "center",
                            background: thinkDepth === t.id ? "rgba(245,158,11,0.16)" : "rgba(255,255,255,0.03)",
                            border: thinkDepth === t.id ? "1px solid rgba(245,158,11,0.40)" : "1px solid rgba(255,255,255,0.07)",
                            transition: `all 0.18s ${SPRING}`,
                          }}
                        >
                          <div style={{ fontSize: 22, marginBottom: 5, filter: thinkDepth === t.id ? "drop-shadow(0 0 8px rgba(245,158,11,0.80))" : "none" }}>{t.emoji}</div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: thinkDepth === t.id ? "#F59E0B" : "rgba(255,255,255,0.55)", marginBottom: 2 }}>{t.label}</div>
                          <div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)" }}>{t.desc}</div>
                        </button>
                      ))}
                    </div>
                  )}

                  {id === "voice" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {VOICE_OPTIONS.map((v) => (
                        <button key={v.id}
                          onClick={() => setVoiceChoice(v.id)}
                          style={{
                            display: "flex", alignItems: "center", gap: 10,
                            padding: "10px 12px", borderRadius: 12, cursor: "pointer",
                            background: voiceChoice === v.id ? "rgba(236,72,153,0.14)" : "rgba(255,255,255,0.03)",
                            border: voiceChoice === v.id ? "1px solid rgba(236,72,153,0.35)" : "1px solid rgba(255,255,255,0.07)",
                            transition: `all 0.18s ${IOS}`,
                          }}
                        >
                          <span style={{ fontSize: 18 }}>{v.emoji}</span>
                          <div style={{ flex: 1, textAlign: "left" }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: voiceChoice === v.id ? "#EC4899" : "rgba(255,255,255,0.70)" }}>{v.label}</div>
                            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.30)" }}>{v.desc}</div>
                          </div>
                          {/* Mini waveform preview */}
                          <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
                            {[0.5, 1, 0.7, 0.9, 0.6].map((h, i) => (
                              <div key={i} style={{
                                width: 3, borderRadius: 99,
                                height: voiceChoice === v.id ? `${h * 16}px` : "6px",
                                background: voiceChoice === v.id ? "#EC4899" : "rgba(255,255,255,0.15)",
                                transition: `height 0.30s ${IOS} ${i * 0.04}s`,
                              }} />
                            ))}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {id === "tools" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {tools.map((t) => (
                        <div key={t.id} style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "9px 12px", borderRadius: 12,
                          background: "rgba(255,255,255,0.03)",
                          border: `1px solid ${t.enabled ? "rgba(34,139,230,0.25)" : "rgba(255,255,255,0.06)"}`,
                          transition: `border 0.20s ${IOS}`,
                        }}>
                          <span style={{ fontSize: 18 }}>{t.icon}</span>
                          <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: t.enabled ? "rgba(255,255,255,0.80)" : "rgba(255,255,255,0.35)" }}>{t.label}</span>
                          <GlowToggle on={t.enabled} onChange={() => toggleTool(t.id)} color="#228BE6" />
                        </div>
                      ))}

                      {/* ── Voice Tone Privacy Controls ────────────────────── */}
                      <div style={{
                        marginTop: 4, padding: "10px 12px", borderRadius: 12,
                        background: "rgba(108,92,231,0.06)", border: "1px solid rgba(108,92,231,0.18)",
                      }}>
                        <div style={{ fontSize: 9, fontWeight: 800, color: "rgba(108,92,231,0.80)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                          🔒 Voice Tone Privacy
                        </div>
                        {[
                          {
                            label: "Voice Tone Analysis",
                            desc:  "Detect emotional state from your voice in real-time",
                            on:    voiceAnalysis,
                            onChange: toggleVoiceAnalysis,
                          },
                          {
                            label: "Store Emotional History",
                            desc:  "Save voice emotion patterns to improve personalization",
                            on:    voiceHistoryStore,
                            onChange: toggleVoiceHistoryStore,
                          },
                        ].map((ctrl) => (
                          <div key={ctrl.label} style={{
                            display: "flex", alignItems: "flex-start", gap: 10,
                            padding: "7px 0",
                            borderBottom: "1px solid rgba(255,255,255,0.05)",
                          }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.75)" }}>{ctrl.label}</div>
                              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.28)", marginTop: 2 }}>{ctrl.desc}</div>
                            </div>
                            <GlowToggle on={ctrl.on} onChange={ctrl.onChange} color="#6C5CE7" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── 5. Apex Upgrade Section ──────────────────────── */}
      <div>
        <SectionHeader icon={<Flame size={14} />} label="Apex Features" sub="Explore & unlock" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {FEATURE_CARDS.map((f, idx) => (
            <button
              key={f.label}
              onClick={() => { if (f.available && f.route) nav(f.route); }}
              disabled={!f.available}
              style={{
                padding: "14px 14px 12px", borderRadius: 20, cursor: f.available ? "pointer" : "default",
                textAlign: "left", position: "relative", overflow: "hidden",
                background: f.available ? `${f.color}10` : "rgba(255,255,255,0.03)",
                border: `1px solid ${f.available ? f.color + "30" : "rgba(255,255,255,0.06)"}`,
                opacity: f.available ? 1 : 0.60,
                transition: `all 0.22s ${IOS}`,
                animation: `dm-msg-enter 0.30s ${idx * 0.06}s ease-out both`,
              }}
              onMouseEnter={(e) => { if (f.available) e.currentTarget.style.boxShadow = `0 0 18px ${f.color}30`; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
            >
              {/* Phase badge */}
              {f.phase && (
                <div style={{
                  position: "absolute", top: 8, right: 8,
                  fontSize: 7, padding: "2px 7px", borderRadius: 99,
                  background: f.phase === "early_access"  ? "rgba(245,158,11,0.15)"
                            : f.phase === "rolling_out"   ? "rgba(16,185,129,0.15)"
                            : "rgba(108,92,231,0.15)",
                  border: `1px solid ${
                    f.phase === "early_access"  ? "rgba(245,158,11,0.30)"
                  : f.phase === "rolling_out"   ? "rgba(16,185,129,0.30)"
                  : "rgba(108,92,231,0.30)"}`,
                  color: f.phase === "early_access"  ? "#F59E0B"
                       : f.phase === "rolling_out"   ? "#10B981"
                       : "#A29BFE",
                  fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" as const,
                }}>
                  {f.phase === "early_access"  ? "Early Access"
                 : f.phase === "rolling_out"   ? "Rolling Out"
                 : "Coming Soon"}
                </div>
              )}
              {!f.phase && f.available && (
                <div style={{
                  position: "absolute", top: 8, right: 8,
                  width: 7, height: 7, borderRadius: "50%",
                  background: f.color, boxShadow: `0 0 6px ${f.color}`,
                }} />
              )}

              <div style={{ fontSize: 26, marginBottom: 8 }}>{f.icon}</div>
              <div style={{ fontSize: 11, fontWeight: 800, color: f.available ? "white" : "rgba(255,255,255,0.50)", marginBottom: 4, lineHeight: 1.2 }}>
                {f.label}
              </div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.30)", lineHeight: 1.4 }}>
                {f.desc}
              </div>
              {f.available && (
                <div style={{
                  marginTop: 10, fontSize: 8, fontWeight: 800, color: f.color,
                  letterSpacing: "0.06em", textTransform: "uppercase",
                  display: "flex", alignItems: "center", gap: 3,
                }}>
                  Open <ChevronRight size={9} />
                </div>
              )}
            </button>
          ))}
        </div>


      </div>

      {/* ── 6. Sign Out ──────────────────────────────────── */}
      <button
        onClick={logout}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          width: "100%", padding: "13px 0", borderRadius: 16,
          background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.18)",
          fontSize: 13, fontWeight: 700, color: "rgba(239,68,68,0.75)",
          cursor: "pointer", letterSpacing: "0.01em",
          transition: `all 0.22s ${IOS}`,
          marginBottom: 8,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(239,68,68,0.12)";
          e.currentTarget.style.borderColor = "rgba(239,68,68,0.30)";
          e.currentTarget.style.color = "#EF4444";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(239,68,68,0.06)";
          e.currentTarget.style.borderColor = "rgba(239,68,68,0.18)";
          e.currentTarget.style.color = "rgba(239,68,68,0.75)";
        }}
      >
        <LogOut size={14} />
        Sign Out
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ── OTHER USER PROFILE (simple view) ────────────────────────────
// ═══════════════════════════════════════════════════════════════
function StatCard({ icon, label, value, color = "rgba(255,255,255,0.70)" }: {
  icon: React.ReactNode; label: string; value: number; color?: string;
}) {
  return (
    <div style={{
      flex: 1, textAlign: "center", padding: "12px 8px", borderRadius: 16,
      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
    }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 4, color: "rgba(255,255,255,0.35)" }}>{icon}</div>
      <p style={{ fontSize: 16, fontWeight: 900, color, margin: "0 0 2px", letterSpacing: "-0.01em" }}>{(value as number).toLocaleString()}</p>
      <p style={{ fontSize: 9, color: "rgba(255,255,255,0.28)", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{label}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ── PROFILE PAGE ENTRY ───────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
const TABS = [
  { id: "projects", label: "Projects" },
  { id: "popular",  label: "Popular"  },
  { id: "recent",   label: "Recent"   },
] as const;
type Tab = (typeof TABS)[number]["id"];

function ProfilePageInner() {
  const params     = useParams<{ userId?: string }>();
  const [, nav]    = useLocation();
  const { data: meData } = useMyProfile();
  const me         = meData?.user;

  const targetId   = params.userId ? parseInt(params.userId) : me?.id ?? null;
  const isMe       = !!me && targetId === me.id;
  const { data: subData } = useSubscriptionStatus();

  const { data, isLoading }  = useProfile(targetId);
  const follow               = useFollow();
  const unfollow             = useUnfollow();
  const updateProfile        = useUpdateProfile();
  const like                 = useLike();
  const { toast }            = useToast();

  const [tab, setTab]                   = useState<Tab>("projects");
  const [editing, setEditing]           = useState(false);
  const [editUsername, setEditUsername] = useState("");
  const [editBio, setEditBio]           = useState("");
  const [editEmoji, setEditEmoji]       = useState("");

  function startEdit() {
    setEditUsername(data?.profile.username ?? "");
    setEditBio(data?.profile.bio ?? "");
    setEditEmoji(data?.profile.avatarEmoji ?? "🎮");
    setEditing(true);
  }

  async function saveEdit() {
    if (!editUsername.trim()) return;
    await updateProfile.mutateAsync({
      username: editUsername.trim(),
      bio: editBio.trim() || undefined,
      avatarEmoji: editEmoji,
    });
    setEditing(false);
    toast({ description: "Profile updated!" });
  }

  function handleFollowToggle() {
    if (!targetId) return;
    if (data?.isFollowing) unfollow.mutate({ targetUserId: targetId });
    else                   follow.mutate({ targetUserId: targetId });
  }

  const profile       = data?.profile;
  const stats         = data?.stats ?? {};
  const allProjects   = data?.projects ?? [];
  const displayProjects =
    tab === "popular" ? [...allProjects].sort((a, b) => (b.likes + b.plays) - (a.likes + a.plays))
    : tab === "recent" ? [...allProjects].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    : allProjects;

  const { data: likedData } = useLikedIds(displayProjects.map((p) => p.id));
  const likedSet = new Set(likedData?.likedIds ?? []);

  if (isLoading || !profile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "transparent" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "20px 16px 14px" }}>
          <div style={{ height: 16, width: 120, borderRadius: 8, background: "rgba(255,255,255,0.08)", animation: "skeleton-shimmer 1.4s ease-in-out infinite alternate" }} />
        </div>
        <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          {[140, 90, 60].map((h, i) => (
            <div key={i} style={{ height: h, borderRadius: 20, background: "rgba(255,255,255,0.04)", animation: `skeleton-shimmer 1.4s ${i * 0.15}s ease-in-out infinite alternate` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "transparent", overflowY: "auto" }}>

      {/* Header */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 16px 12px",
        background: "rgba(14,12,32,0.55)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: isMe ? "white" : "rgba(255,255,255,0.65)" }}>
          {isMe ? "My Identity" : profile.username}
        </div>
        <NotificationBell />
      </div>

      {/* ── MY DASHBOARD ──────────────────────────────────── */}
      {isMe && (
        <MeDashboard
          profile={profile} stats={stats} subData={subData}
          onEdit={startEdit} editing={editing}
          editUsername={editUsername} editBio={editBio} editEmoji={editEmoji}
          setEditUsername={setEditUsername} setEditBio={setEditBio}
          onSave={saveEdit} onCancelEdit={() => setEditing(false)}
        />
      )}

      {/* ── OTHER USER PROFILE ────────────────────────────── */}
      {!isMe && (
        <div style={{ padding: "0 14px", overflowY: "auto", paddingBottom: 80 }}>
          {/* Profile card */}
          <div style={{
            borderRadius: 24,
            background: "linear-gradient(135deg, rgba(108,92,231,0.10), rgba(253,121,168,0.06))",
            border: "1px solid rgba(108,92,231,0.18)", padding: "20px 18px 16px", marginBottom: 12,
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div style={{
                fontSize: 40, width: 70, height: 70, borderRadius: 22, flexShrink: 0,
                background: "rgba(108,92,231,0.18)", border: "2px solid rgba(108,92,231,0.30)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 6px 20px rgba(108,92,231,0.20)",
              }}>{profile.avatarEmoji}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ fontSize: 20, fontWeight: 900, color: "white", margin: "0 0 6px", letterSpacing: "-0.01em" }}>{profile.username}</h2>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8 }}>
                  <Star size={11} style={{ color: "#A29BFE", fill: "#A29BFE" }} />
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#A29BFE" }}>{(stats.reputation ?? 0).toLocaleString()} pts</span>
                  <span style={{ marginLeft: 4, fontSize: 10, color: tier_label(stats.reputation ?? 0).color, fontWeight: 700 }}>{tier_label(stats.reputation ?? 0).label}</span>
                </div>
                {profile.bio && <p style={{ fontSize: 12, color: "rgba(255,255,255,0.50)", margin: 0, lineHeight: 1.5 }}>{profile.bio}</p>}
              </div>
              <button
                onClick={handleFollowToggle}
                style={{
                  flexShrink: 0, padding: "8px 16px", borderRadius: 99,
                  fontSize: 11, fontWeight: 800, cursor: "pointer", border: "none",
                  background: data?.isFollowing ? "rgba(255,255,255,0.08)" : "linear-gradient(135deg, #6C5CE7, #A29BFE)",
                  color: data?.isFollowing ? "rgba(255,255,255,0.55)" : "white",
                  boxShadow: data?.isFollowing ? "none" : "0 4px 14px rgba(108,92,231,0.45)",
                }}
              >{data?.isFollowing ? "Following" : "Follow"}</button>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <StatCard icon={<Users size={13} />} label="Followers" value={profile.followersCount} />
            <StatCard icon={<Users size={13} />} label="Following" value={profile.followingCount} />
            <StatCard icon={<Heart size={13} />} label="Likes"     value={stats.totalLikes ?? 0}  color="#EC4899" />
            <StatCard icon={<Play  size={13} />} label="Plays"     value={stats.totalPlays ?? 0}  color="#10B981" />
          </div>

          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            {TABS.map(({ id, label }) => (
              <button key={id} onClick={() => setTab(id)} style={{
                padding: "7px 16px", borderRadius: 99, fontSize: 11, fontWeight: 700, cursor: "pointer",
                background: tab === id ? "linear-gradient(135deg, #6C5CE7, #A29BFE)" : "rgba(255,255,255,0.05)",
                border: tab === id ? "none" : "1px solid rgba(255,255,255,0.07)",
                color: tab === id ? "white" : "rgba(255,255,255,0.45)",
                boxShadow: tab === id ? "0 4px 14px rgba(108,92,231,0.40)" : "none",
              }}>{label}</button>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {displayProjects.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
                <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 14, margin: 0 }}>No published projects yet</p>
              </div>
            )}
            {displayProjects.map((p) => (
              <FeedCard key={p.id} project={p} liked={likedSet.has(p.id)}
                onLike={(id) => like.mutate({ projectId: id })}
                onRun={(id) => nav(`/marketplace?run=${id}`)} compact />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helper: tier label for other-user view ────────────────────────────────────
function tier_label(pts: number) {
  const t = getTier(pts);
  return { label: `${t.icon} ${t.name}`, color: t.color };
}

// ── Wrapped export with error boundary ────────────────────────────────────────
export default function ProfilePage() {
  return (
    <ProfileErrorBoundary>
      <ProfilePageInner />
    </ProfileErrorBoundary>
  );
}
