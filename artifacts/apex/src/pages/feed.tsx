/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  APEX GAME FEED — TikTok-style vertical game discovery  ║
 * ║  Snap scroll · inline play · like/remix/share/save      ║
 * ╚══════════════════════════════════════════════════════════╝
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Heart, RefreshCw, Share2, Bookmark, BookmarkCheck, Play, X, Users, TrendingUp, Clock, Search, Wand2, ChevronRight, RotateCcw, Zap } from "lucide-react";
import { GameCanvas } from "@/components/game/GameCanvas";
import { FeedCard }   from "@/components/social/FeedCard";
import { StoryBar }   from "@/components/social/StoryBar";
import { NotificationBell } from "@/components/social/NotificationBell";
import { ApexLogo } from "@/components/ui/ApexLogo";
import { useFeed, useLike, useLikedIds } from "@/hooks/useSocial";
import {
  saveUserGameEntry, queueGameForEdit, getUserGamesList, GAME_CREATED_EVENT,
} from "@/data/gameRegistry";
import type { GameConfig } from "@/engine/types";

// ── Constants ─────────────────────────────────────────────────────────────────

const BASE      = import.meta.env.BASE_URL.replace(/\/$/, "");
const api = (p: string) => `${BASE}${p}`;
const IOS       = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";
const SPRING    = "cubic-bezier(0.34, 1.56, 0.64, 1)";

const COLOR_MAP: Record<string, string> = {
  blue: "#4a9eff", red: "#ff4444", green: "#44ff88",
  yellow: "#ffdd44", purple: "#a855f7", orange: "#ff8c00",
  cyan: "#00cfff", pink: "#ff79a8", gold: "#ffcc33", gray: "#888",
};
function rc(c: string) { return COLOR_MAP[c?.toLowerCase()] ?? c ?? "#888"; }

// ── Session ID for like/save attribution ─────────────────────────────────────

function getSessionId(): string {
  let id = sessionStorage.getItem("apex_session_id");
  if (!id) { id = `sess_${Math.random().toString(36).slice(2, 14)}`; sessionStorage.setItem("apex_session_id", id); }
  return id;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface FeedEntry {
  id: number;
  name: string;
  creatorName: string;
  createdBy: "ai" | "user";
  gameConfig: GameConfig;
  likeCount: number;
  playCount: number;
  tags: string[];
  createdAt: string;
  isLiked?: boolean;
  remixable: boolean;
  isRemix: boolean;
  originalGameId?: number | null;
  originalGameName?: string | null;
}

// ── RemixModal ────────────────────────────────────────────────────────────────

type RemixPhase = "idle" | "loading" | "preview";

const REMIX_PRESETS = [
  { emoji: "💀", label: "Make Harder",  instruction: "Make Harder" },
  { emoji: "🌪️", label: "Add Chaos",   instruction: "Add Chaos" },
  { emoji: "⚡", label: "Speed x2",    instruction: "Speed x2" },
  { emoji: "👾", label: "Add Boss",     instruction: "Add Boss" },
  { emoji: "🌙", label: "Night Mode",   instruction: "Night Mode" },
];

function RemixModal({ entry, onClose }: { entry: FeedEntry; onClose: () => void }) {
  const [phase,        setPhase]        = useState<RemixPhase>("idle");
  const [instruction,  setInstruction]  = useState("");
  const [remixedConfig, setRemixedConfig] = useState<GameConfig | null>(null);
  const [error,        setError]        = useState("");
  const [saved,        setSaved]        = useState(false);
  const [playing,      setPlaying]      = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { textRef.current?.focus(); }, []);

  const runRemix = async (ins: string) => {
    if (!ins.trim()) return;
    setPhase("loading");
    setError("");
    try {
      const res = await fetch(api("/api/game-feed/remix"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameConfig: entry.gameConfig, instruction: ins.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "AI failed");
      setRemixedConfig(data.config as GameConfig);
      setPhase("preview");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setPhase("idle");
    }
  };

  const handleSave = () => {
    if (!remixedConfig || saved) return;
    const config: GameConfig = {
      ...remixedConfig,
      name: `Remix of ${entry.name}`,
    };
    saveUserGameEntry(config, "user", `Remixed with AI: "${instruction}"`);
    setSaved(true);
  };

  const handleEditAgain = () => {
    setPhase("idle");
    setRemixedConfig(null);
    setSaved(false);
    setPlaying(false);
    setTimeout(() => textRef.current?.focus(), 100);
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "rgba(0,0,0,0.88)", backdropFilter: "blur(16px)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 480,
          background: "linear-gradient(180deg, #13141A 0%, #0F1015 100%)",
          borderRadius: "28px 28px 0 0",
          border: "1px solid rgba(255,255,255,0.10)",
          borderBottom: "none",
          padding: "0 0 env(safe-area-inset-bottom, 0)",
          animation: `slide-up 0.32s ${IOS} both`,
          maxHeight: "90vh",
          overflowY: "auto",
          display: "flex", flexDirection: "column",
        }}
      >
        {/* Drag handle */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 12, paddingBottom: 4, flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)" }} />
        </div>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 20px 14px", flexShrink: 0 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: "linear-gradient(135deg, #6C5CE7, #FD79A8)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Wand2 size={14} style={{ color: "white" }} />
              </div>
              <div style={{ fontSize: 16, fontWeight: 900, color: "white" }}>Remix with AI</div>
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 3, paddingLeft: 35 }}>
              🔁 Remixing "{entry.name}"
            </div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.07)", border: "none", borderRadius: 20, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "rgba(255,255,255,0.6)" }}>
            <X size={13} />
          </button>
        </div>

        {/* ── IDLE / LOADING phase ─────────────────────────────────── */}
        {(phase === "idle" || phase === "loading") && (
          <div style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Mini preview of original */}
            <div style={{ borderRadius: 16, overflow: "hidden", height: 160, position: "relative", border: "1px solid rgba(255,255,255,0.08)" }}>
              <GamePreviewCanvas config={entry.gameConfig} width={440} height={160} />
              <div style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.70) 100%)",
                display: "flex", alignItems: "flex-end", padding: "10px 12px",
              }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.70)" }}>Original · {entry.name}</span>
              </div>
            </div>

            {/* Preset quick buttons */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.35)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>Quick presets</div>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                {REMIX_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => { setInstruction(p.instruction); runRemix(p.instruction); }}
                    disabled={phase === "loading"}
                    style={{
                      display: "flex", alignItems: "center", gap: 5,
                      padding: "7px 13px", borderRadius: 999, cursor: "pointer", fontSize: 11, fontWeight: 700,
                      background: "rgba(108,92,231,0.12)", border: "1px solid rgba(108,92,231,0.30)",
                      color: "#A29BFE", transition: `all 0.18s ${IOS}`,
                      opacity: phase === "loading" ? 0.5 : 1,
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(108,92,231,0.25)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(108,92,231,0.12)"; }}
                  >
                    <span style={{ fontSize: 13 }}>{p.emoji}</span>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom instruction */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.35)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>Or describe your changes</div>
              <div style={{ position: "relative" }}>
                <textarea
                  ref={textRef}
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); runRemix(instruction); } }}
                  placeholder="e.g. make it faster, add more enemies, turn it into a space theme, add a boss fight..."
                  disabled={phase === "loading"}
                  rows={3}
                  style={{
                    width: "100%", padding: "12px 52px 12px 16px",
                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)",
                    borderRadius: 16, color: "white", fontSize: 13, resize: "none",
                    outline: "none", fontFamily: "inherit", boxSizing: "border-box",
                    transition: `border-color 0.18s ${IOS}`,
                  }}
                  onFocus={(e) => { e.target.style.borderColor = "rgba(108,92,231,0.60)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.10)"; }}
                />
                <button
                  onClick={() => runRemix(instruction)}
                  disabled={!instruction.trim() || phase === "loading"}
                  style={{
                    position: "absolute", right: 10, bottom: 10,
                    width: 34, height: 34, borderRadius: 10, border: "none",
                    background: instruction.trim() ? "linear-gradient(135deg,#6C5CE7,#A29BFE)" : "rgba(255,255,255,0.08)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: instruction.trim() ? "pointer" : "default",
                    transition: `all 0.20s ${IOS}`,
                    boxShadow: instruction.trim() ? "0 4px 12px rgba(108,92,231,0.45)" : "none",
                  }}
                >
                  <ChevronRight size={16} style={{ color: instruction.trim() ? "white" : "rgba(255,255,255,0.25)" }} />
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{ padding: "10px 14px", borderRadius: 12, background: "rgba(255,79,79,0.10)", border: "1px solid rgba(255,79,79,0.25)", fontSize: 11, color: "#FF6B6B" }}>
                ⚠️ {error}
              </div>
            )}

            {/* Loading state */}
            {phase === "loading" && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0" }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: "linear-gradient(135deg,#6C5CE7,#FD79A8)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  animation: "spin 1s linear infinite",
                  flexShrink: 0,
                }}>
                  <Wand2 size={13} style={{ color: "white" }} />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "white" }}>AI is remixing your game…</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.40)", marginTop: 2 }}>Modifying game config, preserving playability</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── PREVIEW phase ────────────────────────────────────────── */}
        {phase === "preview" && remixedConfig && (
          <div style={{ padding: "0 20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Attribution badge */}
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 12px", borderRadius: 20, width: "fit-content",
              background: "rgba(108,92,231,0.14)", border: "1px solid rgba(108,92,231,0.28)",
            }}>
              <RefreshCw size={11} style={{ color: "#A29BFE" }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: "#A29BFE" }}>Remixed from "{entry.name}"</span>
            </div>

            {/* Preview or Play area */}
            {!playing ? (
              <div style={{ borderRadius: 18, overflow: "hidden", height: 260, position: "relative", border: "1px solid rgba(108,92,231,0.25)", boxShadow: "0 0 32px rgba(108,92,231,0.20)" }}>
                <GamePreviewCanvas config={remixedConfig} width={440} height={260} />
                <div style={{
                  position: "absolute", inset: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <button
                    onClick={() => setPlaying(true)}
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                      background: "rgba(0,0,0,0.55)", backdropFilter: "blur(10px)",
                      border: "1.5px solid rgba(255,255,255,0.20)", borderRadius: 22,
                      padding: "14px 26px", cursor: "pointer",
                      boxShadow: "0 0 24px rgba(108,92,231,0.40)",
                    }}
                  >
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#6C5CE7,#A29BFE)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 20px rgba(108,92,231,0.70)" }}>
                      <Play size={18} style={{ color: "white", marginLeft: 2 }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "white" }}>Play Remix</span>
                  </button>
                </div>
                {/* Live indicator */}
                <div style={{ position: "absolute", top: 10, right: 10, display: "flex", alignItems: "center", gap: 5, background: "rgba(0,0,0,0.60)", borderRadius: 20, padding: "4px 10px" }}>
                  <Zap size={10} style={{ color: "#ffcc33" }} />
                  <span style={{ fontSize: 9, fontWeight: 700, color: "#ffcc33" }}>AI Remix</span>
                </div>
              </div>
            ) : (
              <div style={{ borderRadius: 18, overflow: "hidden", height: 340, position: "relative" }}>
                <GameCanvas
                  config={{ ...remixedConfig, name: `Remix of ${entry.name}` }}
                  onGameEnd={() => setPlaying(false)}
                  onBack={() => setPlaying(false)}
                />
                <button onClick={() => setPlaying(false)} style={{ position: "absolute", top: 10, right: 10, width: 28, height: 28, borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "rgba(255,255,255,0.8)", zIndex: 50 }}>
                  <X size={12} />
                </button>
              </div>
            )}

            {/* Instruction used */}
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontStyle: "italic", paddingLeft: 4 }}>
              "{instruction}"
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleEditAgain}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  padding: "12px", borderRadius: 14, cursor: "pointer", fontSize: 12, fontWeight: 700,
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.65)",
                  transition: `all 0.18s ${IOS}`,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.09)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; }}
              >
                <RotateCcw size={13} /> Edit Again
              </button>
              <button
                onClick={handleSave}
                disabled={saved}
                style={{
                  flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  padding: "12px", borderRadius: 14, cursor: saved ? "default" : "pointer", fontSize: 12, fontWeight: 800,
                  background: saved ? "rgba(16,185,129,0.18)" : "linear-gradient(135deg,#6C5CE7,#A29BFE)",
                  border: saved ? "1px solid rgba(16,185,129,0.35)" : "none",
                  color: saved ? "#10B981" : "white",
                  boxShadow: saved ? "none" : "0 4px 16px rgba(108,92,231,0.45)",
                  transition: `all 0.22s ${IOS}`,
                }}
              >
                {saved ? (
                  <><BookmarkCheck size={14} /> Saved to My Games</>
                ) : (
                  <><Bookmark size={13} /> Save Remix</>
                )}
              </button>
            </div>
          </div>
        )}

        <style>{`
          @keyframes slide-up { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </div>
  );
}

// ── useFeedEntries hook ───────────────────────────────────────────────────────

function useFeedEntries() {
  const [entries, setEntries] = useState<FeedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const sessionId             = getSessionId();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(api("/api/game-feed"), {
        headers: { "x-session-id": sessionId },
      });
      // Note: Vite proxies /api/... → backend:8080, Express mounts at /api → backend sees /game-feed
      const data = await res.json();
      setEntries(data.entries ?? []);
    } catch (e) {
      console.error("[GameFeed] load error", e);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => { load(); }, [load]);

  const toggleLike = useCallback(async (id: number) => {
    setEntries((prev) => prev.map((e) =>
      e.id === id
        ? { ...e, isLiked: !e.isLiked, likeCount: e.likeCount + (e.isLiked ? -1 : 1) }
        : e
    ));
    try {
      await fetch(api(`/api/game-feed/${id}/like`), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-session-id": sessionId },
      });
    } catch {/* optimistic — ignore */ }
  }, [sessionId]);

  const recordPlay = useCallback(async (id: number) => {
    setEntries((prev) => prev.map((e) =>
      e.id === id ? { ...e, playCount: e.playCount + 1 } : e
    ));
    try {
      await fetch(api(`/api/game-feed/${id}/play`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch { /* ignore */ }
  }, []);

  return { entries, loading, reload: load, toggleLike, recordPlay };
}

// ── GamePreviewCanvas — static snapshot render ───────────────────────────────

function GamePreviewCanvas({ config, width = 400, height = 600 }: {
  config: GameConfig; width?: number; height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Background
    ctx.fillStyle = config.background ?? "#07080E";
    ctx.fillRect(0, 0, width, height);

    // Subtle grid scanlines
    ctx.strokeStyle = "rgba(255,255,255,0.02)";
    ctx.lineWidth = 1;
    for (let y = 0; y < height; y += 20) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }

    // Platforms with neon glow
    for (const plat of config.platforms) {
      const color = rc(plat.color);
      ctx.shadowBlur = 8;
      ctx.shadowColor = color;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(plat.x, plat.y, plat.width, plat.height, 4);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Coins
    for (const coin of (config.coins ?? [])) {
      const coinColor = rc(coin.color);
      ctx.shadowBlur = 12;
      ctx.shadowColor = coinColor;
      ctx.fillStyle = coinColor;
      ctx.beginPath();
      ctx.arc(coin.x, coin.y, coin.radius, 0, Math.PI * 2);
      ctx.fill();

      // Shine dot
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.beginPath();
      ctx.arc(coin.x - coin.radius * 0.25, coin.y - coin.radius * 0.25, coin.radius * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Enemies
    for (const enemy of config.enemies) {
      const color = rc(enemy.color);
      ctx.shadowBlur = 10;
      ctx.shadowColor = color;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(enemy.x, enemy.y, enemy.width, enemy.height, 6);
      ctx.fill();

      // Evil eyes
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      const ew = enemy.width * 0.22, eh = enemy.height * 0.22;
      ctx.fillRect(enemy.x + enemy.width * 0.2,  enemy.y + enemy.height * 0.25, ew, eh);
      ctx.fillRect(enemy.x + enemy.width * 0.55, enemy.y + enemy.height * 0.25, ew, eh);
      ctx.shadowBlur = 0;
    }

    // Player
    const pColor = rc(config.player.color);
    const px = config.player.x + config.player.width / 2;
    const py = config.player.y + config.player.height / 2;
    const pr = Math.min(config.player.width, config.player.height) / 2;

    ctx.shadowBlur = 18;
    ctx.shadowColor = pColor;
    ctx.fillStyle = pColor;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();

    // Player highlight
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.arc(px - pr * 0.3, py - pr * 0.3, pr * 0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // End flag if reach_end
    if (config.winCondition === "reach_end" && config.endX != null) {
      const flagX = Math.min(config.endX, width - 20);
      const flagY = 80;
      ctx.strokeStyle = "#44ff88";
      ctx.lineWidth   = 3;
      ctx.shadowBlur  = 10; ctx.shadowColor = "#44ff88";
      ctx.beginPath(); ctx.moveTo(flagX, flagY); ctx.lineTo(flagX, flagY + 60); ctx.stroke();
      ctx.fillStyle = "#44ff88";
      ctx.beginPath();
      ctx.moveTo(flagX, flagY); ctx.lineTo(flagX + 28, flagY + 10); ctx.lineTo(flagX, flagY + 20);
      ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Vignette overlay
    const vignette = ctx.createRadialGradient(width / 2, height / 2, height * 0.25, width / 2, height / 2, height * 0.75);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  }, [config, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
    />
  );
}

// ── Share modal ───────────────────────────────────────────────────────────────

function ShareModal({ entry, onClose }: { entry: FeedEntry; onClose: () => void }) {
  const url   = `https://apex.app/play/${entry.id}`;
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); }
    catch { /* fallback */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 480, background: "#13141A",
          borderRadius: "24px 24px 0 0", padding: "28px 24px 36px",
          border: "1px solid rgba(255,255,255,0.10)",
          animation: `slide-up 0.30s ${IOS} both`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "white" }}>Share Game</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{entry.name}</div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.07)", border: "none", borderRadius: 20, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "white" }}>
            <X size={14} />
          </button>
        </div>

        {/* URL box */}
        <div style={{
          background: "rgba(108,92,231,0.08)", border: "1px solid rgba(108,92,231,0.22)",
          borderRadius: 14, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.50)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{url}</span>
          <button onClick={copy} style={{
            background: copied ? "rgba(16,185,129,0.20)" : "rgba(108,92,231,0.20)",
            border: `1px solid ${copied ? "rgba(16,185,129,0.35)" : "rgba(108,92,231,0.35)"}`,
            borderRadius: 10, padding: "6px 14px", cursor: "pointer",
            color: copied ? "#10B981" : "#A29BFE", fontSize: 11, fontWeight: 700, flexShrink: 0,
            transition: `all 0.20s ${IOS}`,
          }}>
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>

        {/* Share actions */}
        <div style={{ display: "flex", gap: 10 }}>
          {[
            { emoji: "📱", label: "Messages",  action: () => {} },
            { emoji: "📲", label: "WhatsApp",  action: () => {} },
            { emoji: "🐦", label: "Twitter/X", action: () => {} },
            { emoji: "📋", label: "Copy Link", action: copy  },
          ].map(({ emoji, label, action }) => (
            <button key={label} onClick={action} style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
              padding: "12px 8px", borderRadius: 14, cursor: "pointer",
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            }}>
              <span style={{ fontSize: 22 }}>{emoji}</span>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", fontWeight: 600 }}>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <style>{`@keyframes slide-up { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
    </div>
  );
}

// ── GameFeedCard ──────────────────────────────────────────────────────────────

type CardState = "preview" | "playing" | "ended";

function GameFeedCard({
  entry,
  isVisible,
  onLike,
  onRecordPlay,
}: {
  entry:         FeedEntry;
  isVisible:     boolean;
  onLike:        (id: number) => void;
  onRecordPlay:  (id: number) => void;
}) {
  const [, nav]        = useLocation();
  const [state,       setState]       = useState<CardState>("preview");
  const [saved,       setSaved]       = useState(false);
  const [saveAnim,    setSaveAnim]    = useState(false);
  const [likeAnim,    setLikeAnim]    = useState(false);
  const [showShare,   setShowShare]   = useState(false);
  const [showRemix,   setShowRemix]   = useState(false);
  const [gameResult,  setGameResult]  = useState<{ phase: "won"|"lost"; score: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Measure card size for proper canvas scaling
  const [cardSize, setCardSize] = useState({ w: 390, h: 680 });
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setCardSize({ w: el.offsetWidth, h: el.offsetHeight });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Reset to preview state when scrolled off screen
  useEffect(() => {
    if (!isVisible && state === "playing") {
      setState("preview");
      setGameResult(null);
    }
  }, [isVisible, state]);

  // Also check if already saved in registry
  useEffect(() => {
    setSaved(getUserGamesList().some((g: GameConfig) => g.name === entry.gameConfig.name));
    const onCreated = () => {
      setSaved(getUserGamesList().some((g: GameConfig) => g.name === entry.gameConfig.name));
    };
    window.addEventListener(GAME_CREATED_EVENT, onCreated);
    return () => window.removeEventListener(GAME_CREATED_EVENT, onCreated);
  }, [entry.gameConfig.name]);

  const handleLaunch = () => {
    setState("playing");
    onRecordPlay(entry.id);
  };

  const handleSave = () => {
    if (saved) return;
    saveUserGameEntry(
      entry.gameConfig,
      entry.createdBy,
      `From Game Feed · ${entry.creatorName}`
    );
    setSaved(true);
    setSaveAnim(true);
    setTimeout(() => setSaveAnim(false), 600);
  };

  const handleLike = () => {
    setLikeAnim(true);
    setTimeout(() => setLikeAnim(false), 500);
    onLike(entry.id);
  };

  const handleRemix = () => {
    if (entry.remixable) {
      setShowRemix(true);
    } else {
      const remixed: GameConfig = {
        ...entry.gameConfig,
        name: `Remix of ${entry.gameConfig.name}`,
      };
      queueGameForEdit(remixed);
      nav("/game-engine");
    }
  };

  const handleGameEnd = (phase: "won" | "lost", score: number) => {
    setGameResult({ phase, score });
    setState("ended");
  };

  // Tags to display
  const modeBadge =
    entry.gameConfig.winCondition === "collect_all" ? { emoji: "🪙", label: "Collect" }
    : entry.gameConfig.winCondition === "reach_end"  ? { emoji: "🏁", label: "Reach End" }
    : entry.gameConfig.winCondition === "survive"    ? { emoji: "⏱", label: "Survive" }
    : { emoji: "⚔️", label: "Combat" };

  const isAi = entry.createdBy === "ai";

  return (
    <>
      <div
        ref={containerRef}
        style={{
          position:  "relative",
          height:    "100%",
          flexShrink: 0,
          scrollSnapAlign: "start",
          scrollSnapStop: "always",
          overflow:  "hidden",
          background: entry.gameConfig.background ?? "#07080E",
        }}
      >

        {/* ── Game area ──────────────────────────────────────────── */}
        {state === "playing" ? (
          <div style={{ position: "absolute", inset: 0, zIndex: 10 }}>
            <GameCanvas
              config={entry.gameConfig}
              onGameEnd={handleGameEnd}
              onBack={() => { setState("preview"); setGameResult(null); }}
            />
          </div>
        ) : (
          <div style={{ position: "absolute", inset: 0 }}>
            <GamePreviewCanvas
              config={entry.gameConfig}
              width={entry.gameConfig.width ?? 400}
              height={entry.gameConfig.height ?? 600}
            />
          </div>
        )}

        {/* ── Ended overlay ─────────────────────────────────────── */}
        {state === "ended" && gameResult && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 20,
            background: "rgba(0,0,0,0.82)", backdropFilter: "blur(6px)",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 16,
          }}>
            <div style={{ fontSize: 52 }}>{gameResult.phase === "won" ? "🏆" : "💀"}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "white" }}>
              {gameResult.phase === "won" ? "You Won!" : "Game Over"}
            </div>
            {gameResult.score > 0 && (
              <div style={{ fontSize: 15, color: "#ffcc33", fontWeight: 700 }}>
                Score: {gameResult.score}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button onClick={handleLaunch} style={{
                padding: "12px 24px", borderRadius: 14, border: "none",
                background: "linear-gradient(135deg,#6C5CE7,#A29BFE)", color: "white",
                fontWeight: 800, fontSize: 13, cursor: "pointer",
              }}>▶ Play Again</button>
              <button onClick={() => setState("preview")} style={{
                padding: "12px 24px", borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.7)",
                fontWeight: 700, fontSize: 13, cursor: "pointer",
              }}>← Back</button>
            </div>
          </div>
        )}

        {/* ── Preview overlays (only when NOT playing) ──────────── */}
        {state === "preview" && (
          <>
            {/* Apex watermark — bottom-right corner */}
            <div style={{
              position: "absolute", bottom: 16, right: 12, zIndex: 20,
              display: "flex", alignItems: "center", gap: 5,
              background: "rgba(0,0,0,0.38)",
              backdropFilter: "blur(8px)",
              borderRadius: 10, padding: "4px 8px 4px 5px",
              border: "1px solid rgba(162,155,254,0.15)",
              pointerEvents: "none",
            }}>
              <ApexLogo size={14} state="idle" radius={4} />
              <span style={{
                fontSize: 9, fontWeight: 800, letterSpacing: "0.08em",
                color: "rgba(162,155,254,0.80)",
                textTransform: "uppercase",
              }}>
                APEX
              </span>
            </div>

            {/* Top gradient + info */}
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0,
              background: "linear-gradient(to bottom, rgba(0,0,0,0.72) 0%, transparent 100%)",
              padding: "16px 16px 32px",
              zIndex: 15,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                  background: "linear-gradient(135deg, #6C5CE7, #A29BFE)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16,
                }}>🎮</div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "white", lineHeight: 1.2 }}>{entry.name}</div>
                    {entry.isRemix && (
                      <span style={{
                        fontSize: 8, fontWeight: 800, padding: "1px 6px", borderRadius: 20, flexShrink: 0,
                        background: "rgba(108,92,231,0.22)", border: "1px solid rgba(108,92,231,0.40)", color: "#A29BFE",
                      }}>🔁 Remix</span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.55)" }}>by {entry.creatorName}</span>
                    {isAi && <span style={{
                      fontSize: 8, fontWeight: 800, padding: "1px 5px", borderRadius: 20,
                      background: "rgba(162,155,254,0.18)", border: "1px solid rgba(162,155,254,0.30)", color: "#A29BFE",
                    }}>🤖 AI</span>}
                    {entry.isRemix && entry.originalGameName && (
                      <span style={{ fontSize: 9, color: "rgba(162,155,254,0.70)" }}>← {entry.originalGameName}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Center "Launch Game" button */}
            <div style={{
              position: "absolute", inset: 0, zIndex: 14,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <button
                onClick={handleLaunch}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                  background: "rgba(255,255,255,0.09)", backdropFilter: "blur(12px)",
                  border: "1.5px solid rgba(255,255,255,0.22)", borderRadius: 28,
                  padding: "18px 32px", cursor: "pointer",
                  transform: "scale(1)", transition: `all 0.22s ${SPRING}`,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.06)"; e.currentTarget.style.background = "rgba(108,92,231,0.22)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.background = "rgba(255,255,255,0.09)"; }}
              >
                <div style={{
                  width: 56, height: 56, borderRadius: "50%",
                  background: "linear-gradient(135deg,#6C5CE7,#A29BFE)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 0 24px rgba(108,92,231,0.70), 0 4px 16px rgba(0,0,0,0.4)",
                }}>
                  <Play size={22} style={{ color: "white", marginLeft: 3 }} />
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "white", letterSpacing: "-0.01em" }}>Launch Game</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.50)", marginTop: 2 }}>Tap to play instantly</div>
                </div>
              </button>
            </div>

            {/* Bottom gradient + stats */}
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 72,
              background: "linear-gradient(to top, rgba(0,0,0,0.90) 0%, transparent 100%)",
              padding: "40px 16px 20px",
              zIndex: 15,
            }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: "rgba(108,92,231,0.25)", border: "1px solid rgba(108,92,231,0.35)", color: "#A29BFE" }}>
                  {modeBadge.emoji} {modeBadge.label}
                </span>
                {entry.tags.slice(0, 2).map((tag) => (
                  <span key={tag} style={{ fontSize: 9, fontWeight: 600, padding: "3px 8px", borderRadius: 20, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.55)" }}>
                    #{tag}
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>▶ {entry.playCount.toLocaleString()} plays</span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>❤️ {entry.likeCount} likes</span>
              </div>
            </div>
          </>
        )}

        {/* ── Right action rail ──────────────────────────────────── */}
        <div style={{
          position: "absolute", right: 12, bottom: 80, zIndex: 20,
          display: "flex", flexDirection: "column", gap: 16, alignItems: "center",
        }}>
          {/* Like */}
          <ActionButton
            onClick={handleLike}
            icon={
              <Heart
                size={20}
                style={{
                  color: entry.isLiked ? "#FD79A8" : "white",
                  fill: entry.isLiked ? "#FD79A8" : "transparent",
                  transform: likeAnim ? "scale(1.5)" : "scale(1)",
                  transition: `transform 0.30s ${SPRING}`,
                }}
              />
            }
            label={String(entry.likeCount)}
            labelColor={entry.isLiked ? "#FD79A8" : "rgba(255,255,255,0.70)"}
          />

          {/* Remix */}
          <ActionButton
            onClick={handleRemix}
            icon={entry.remixable
              ? <Wand2 size={20} style={{ color: "#A29BFE" }} />
              : <RefreshCw size={20} style={{ color: "white" }} />
            }
            label={entry.remixable ? "AI Remix" : "Remix"}
            labelColor={entry.remixable ? "#A29BFE" : "rgba(255,255,255,0.70)"}
          />

          {/* Share */}
          <ActionButton
            onClick={() => setShowShare(true)}
            icon={<Share2 size={20} style={{ color: "white" }} />}
            label="Share"
          />

          {/* Save */}
          <ActionButton
            onClick={handleSave}
            icon={saved
              ? <BookmarkCheck size={20} style={{ color: "#10B981", transform: saveAnim ? "scale(1.4)" : "scale(1)", transition: `transform 0.30s ${SPRING}` }} />
              : <Bookmark size={20} style={{ color: "white" }} />
            }
            label={saved ? "Saved" : "Save"}
            labelColor={saved ? "#10B981" : "rgba(255,255,255,0.70)"}
          />
        </div>

        {/* ── Playing: exit button ───────────────────────────────── */}
        {state === "playing" && (
          <button
            onClick={() => { setState("preview"); setGameResult(null); }}
            style={{
              position: "absolute", top: 12, right: 12, zIndex: 50,
              width: 32, height: 32, borderRadius: "50%", border: "none",
              background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "rgba(255,255,255,0.80)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.40)",
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Share modal */}
      {showShare && <ShareModal entry={entry} onClose={() => setShowShare(false)} />}

      {/* Remix modal */}
      {showRemix && <RemixModal entry={entry} onClose={() => setShowRemix(false)} />}
    </>
  );
}

// ── ActionButton helper ───────────────────────────────────────────────────────

function ActionButton({
  onClick, icon, label, labelColor = "rgba(255,255,255,0.70)",
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label?: string;
  labelColor?: string;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
        background: "rgba(0,0,0,0.40)", backdropFilter: "blur(10px)",
        border: "1px solid rgba(255,255,255,0.10)", borderRadius: 20,
        padding: "10px 10px 6px", cursor: "pointer",
        transform: pressed ? "scale(0.88)" : "scale(1)",
        transition: pressed ? "transform 0.10s ease" : `transform 0.30s ${SPRING}`,
        minWidth: 48,
      }}
    >
      {icon}
      {label && <span style={{ fontSize: 9, fontWeight: 700, color: labelColor }}>{label}</span>}
    </button>
  );
}

// ── Social feed sub-tabs (preserved from original feed) ──────────────────────

const SOCIAL_TABS = [
  { id: "following", label: "Following", icon: Users    },
  { id: "trending",  label: "Trending",  icon: TrendingUp },
  { id: "recent",    label: "Recent",    icon: Clock     },
] as const;
type SocialTab = (typeof SOCIAL_TABS)[number]["id"];

function SocialFeedView() {
  const [, nav]   = useLocation();
  const [tab, setTab] = useState<SocialTab>("trending");
  const { data, isLoading } = useFeed();

  const projects =
    tab === "following" ? (data?.following ?? [])
    : tab === "trending" ? (data?.trending   ?? [])
    : (data?.recent  ?? []);

  const { data: likedData } = useLikedIds(projects.map((p) => p.id));
  const likedSet = new Set(likedData?.likedIds ?? []);
  const like     = useLike();
  const empty    = !isLoading && projects.length === 0;

  return (
    <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {/* Story Bar */}
      <div style={{ flexShrink: 0 }}>
        <StoryBar projects={data?.trending ?? []} onStoryClick={(id) => nav(`/profile/${id}`)} onAddStory={() => nav("/studio")} />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, padding: "0 16px 12px", flexShrink: 0 }}>
        {SOCIAL_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              display: "flex", alignItems: "center", gap: 5, padding: "7px 14px",
              borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: "pointer",
              ...(tab === id
                ? { background: "linear-gradient(135deg,#7C3AED,#EC4899)", color: "white", border: "none", boxShadow: "0 4px 12px rgba(139,92,246,0.35)" }
                : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.40)" }),
            }}
          >
            <Icon size={11} />
            {label}
          </button>
        ))}
      </div>

      {/* Posts */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
        {isLoading && [0,1,2].map((i) => (
          <div key={i} className="skeleton-shimmer" style={{ height: 340, borderRadius: 24 }} />
        ))}
        {empty && tab === "following" && (
          <div style={{ textAlign: "center", paddingTop: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 14 }}>👥</div>
            <p style={{ color: "rgba(255,255,255,0.55)", fontWeight: 600, fontSize: 14 }}>No posts yet</p>
            <p style={{ color: "rgba(255,255,255,0.28)", fontSize: 11, marginTop: 6 }}>Follow creators to see their work here</p>
            <button onClick={() => nav("/explore")} style={{ marginTop: 20, padding: "10px 24px", borderRadius: 999, fontSize: 12, fontWeight: 700, color: "white", border: "none", cursor: "pointer", background: "linear-gradient(135deg,#7C3AED,#EC4899)" }}>Discover Creators</button>
          </div>
        )}
        {empty && tab !== "following" && (
          <div style={{ textAlign: "center", paddingTop: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 14 }}>🚀</div>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>Nothing here yet</p>
          </div>
        )}
        {projects.map((p, i) => (
          <div key={p.id} style={{ animation: `card-enter 0.45s cubic-bezier(0.25,0.46,0.45,0.94) ${i * 0.08}s both` }}>
            <FeedCard project={p} liked={likedSet.has(p.id)} onLike={(id) => like.mutate({ projectId: id })} onRun={(id) => nav(`/marketplace?run=${id}`)} onRemix={(id) => nav(`/marketplace?remix=${id}`)} onCreatorClick={(id) => nav(`/profile/${id}`)} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main FeedPage ─────────────────────────────────────────────────────────────

type FeedMode = "games" | "social";

export default function FeedPage() {
  const [, nav]   = useLocation();
  const [mode, setMode] = useState<FeedMode>("games");

  const { entries, loading, toggleLike, recordPlay } = useFeedEntries();

  // Track which card is currently visible via IntersectionObserver
  const [visibleIndex, setVisibleIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;

    const observer = new IntersectionObserver(
      (entries_io) => {
        entries_io.forEach((entry_io) => {
          if (entry_io.isIntersecting) {
            const idx = parseInt((entry_io.target as HTMLElement).dataset.idx ?? "0");
            setVisibleIndex(idx);
          }
        });
      },
      { root: scroller, threshold: 0.55 }
    );

    const cards = scroller.querySelectorAll("[data-idx]");
    cards.forEach((c) => observer.observe(c));
    return () => observer.disconnect();
  }, [entries]);

  return (
    <div style={{
      height: "100%", display: "flex", flexDirection: "column",
      background: "#0A0A0F", overflow: "hidden",
    }}>

      {/* ── Header ──────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 16px 10px", flexShrink: 0, position: "relative", zIndex: 20,
      }}>
        <div>
          <h1 style={{
            fontSize: 20, fontWeight: 900, letterSpacing: "-0.02em",
            background: "linear-gradient(135deg, #fff 40%, #A78BFA)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            margin: 0,
          }}>
            {mode === "games" ? "Game Feed" : "Discover"}
          </h1>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.28)", marginTop: 2 }}>
            {mode === "games" ? "Swipe to discover · tap to play" : "See what's being built"}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => nav("/explore")} style={{ width: 34, height: 34, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer" }}>
            <Search size={14} style={{ color: "rgba(255,255,255,0.50)" }} />
          </button>
          <NotificationBell />
        </div>
      </div>

      {/* ── Mode toggle ─────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 6, padding: "0 16px 10px", flexShrink: 0 }}>
        {([
          { id: "games",  emoji: "🎮", label: "Games" },
          { id: "social", emoji: "👥", label: "Social" },
        ] as { id: FeedMode; emoji: string; label: string }[]).map(({ id, emoji, label }) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            style={{
              display: "flex", alignItems: "center", gap: 5, padding: "7px 16px",
              borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: "pointer",
              transition: `all 0.20s ${IOS}`,
              ...(mode === id
                ? { background: "linear-gradient(135deg,#6C5CE7,#A29BFE)", color: "white", border: "none", boxShadow: "0 4px 14px rgba(108,92,231,0.40)" }
                : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.40)" }),
            }}
          >
            {emoji} {label}
          </button>
        ))}
      </div>

      {/* ── Content area ─────────────────────────────────────────── */}
      {mode === "social" ? (
        <SocialFeedView />
      ) : (
        /* ── TikTok-style Game Feed ─────────────────────────────── */
        <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          {loading ? (
            /* Loading skeleton */
            <div style={{ padding: "20px 16px" }}>
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton-shimmer" style={{ height: 300, borderRadius: 24, marginBottom: 12 }} />
              ))}
            </div>
          ) : entries.length === 0 ? (
            /* Empty state */
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12, padding: 32 }}>
              <div style={{ fontSize: 52 }}>🎮</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "white" }}>No games yet</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", textAlign: "center" }}>Generate games in the Studio and they'll appear here</div>
              <button onClick={() => nav("/game-engine")} style={{ marginTop: 10, padding: "12px 28px", borderRadius: 14, border: "none", background: "linear-gradient(135deg,#6C5CE7,#A29BFE)", color: "white", fontWeight: 800, fontSize: 13, cursor: "pointer", boxShadow: "0 4px 16px rgba(108,92,231,0.40)" }}>
                Open Game Studio
              </button>
            </div>
          ) : (
            /* Snap scroll container */
            <div
              ref={scrollRef}
              style={{
                height: "100%", overflowY: "scroll",
                scrollSnapType: "y mandatory",
                scrollBehavior: "smooth",
                WebkitOverflowScrolling: "touch",
              } as React.CSSProperties}
            >
              {entries.map((entry, idx) => (
                <div
                  key={entry.id}
                  data-idx={idx}
                  style={{ height: "100%", scrollSnapAlign: "start", scrollSnapStop: "always" }}
                >
                  <GameFeedCard
                    entry={entry}
                    isVisible={visibleIndex === idx}
                    onLike={toggleLike}
                    onRecordPlay={recordPlay}
                  />
                </div>
              ))}

              {/* Progress dots */}
              {entries.length > 1 && (
                <div style={{
                  position: "fixed", right: 8, top: "50%", transform: "translateY(-50%)",
                  display: "flex", flexDirection: "column", gap: 5, zIndex: 30,
                  pointerEvents: "none",
                }}>
                  {entries.map((_, i) => (
                    <div
                      key={i}
                      style={{
                        width: i === visibleIndex ? 3 : 2,
                        height: i === visibleIndex ? 14 : 6,
                        borderRadius: 2,
                        background: i === visibleIndex ? "#A29BFE" : "rgba(255,255,255,0.20)",
                        transition: `all 0.25s ${SPRING}`,
                        boxShadow: i === visibleIndex ? "0 0 6px rgba(162,155,254,0.70)" : "none",
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
