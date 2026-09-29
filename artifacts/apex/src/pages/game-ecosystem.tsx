import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const SESSION_ID = (() => {
  const k = "apex-session-id";
  let s = localStorage.getItem(k);
  if (!s) { s = Math.random().toString(36).slice(2); localStorage.setItem(k, s); }
  return s;
})();

function api(path: string) { return `${BASE}${path}`; }

function apiFetch(path: string, opts?: RequestInit) {
  return fetch(api(path), {
    ...opts,
    headers: { "Content-Type": "application/json", "x-session-id": SESSION_ID, ...(opts?.headers ?? {}) },
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface GameEntry {
  id: number;
  name: string;
  creatorName: string;
  createdBy: string;
  gameConfig: Record<string, unknown>;
  likeCount: number;
  playCount: number;
  completionCount: number;
  totalPlayDurationMs: number;
  replayCount: number;
  tags: string[];
  isLiked: boolean;
  isRemix: boolean;
  originalGameId?: number;
  originalGameName?: string;
  remixable: boolean;
  createdAt: string;
  avgPlayDurationMs?: number;
  completionRate?: number;
}

interface Analytics {
  id: number;
  name: string;
  creatorName: string;
  stats: {
    plays: number;
    likes: number;
    completions: number;
    replays: number;
    remixes: number;
    avgPlayDurationMs: number;
    avgPlayDurationSec: number;
    completionRate: number;
    replayRate: number;
    trendScore: number;
    engagementScore: number;
  };
  retentionCurve: { second: number; rate: number }[];
  remixes: { id: number; name: string; creatorName: string; playCount: number; likeCount: number; createdAt: string }[];
}

// ── Static Game Preview Canvas ────────────────────────────────────────────────

function GamePreviewCanvas({ config, size = 200 }: { config: Record<string, unknown>; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cfg = config as {
      background?: string;
      platforms?: { x: number; y: number; width: number; height: number; color?: string }[];
      enemies?: { x: number; y: number; width: number; height: number; color?: string }[];
      coins?: { x: number; y: number; radius?: number; color?: string }[];
      player?: { x: number; y: number; width: number; height: number; color?: string };
      width?: number; height?: number;
    };

    const W = cfg.width || 400;
    const H = cfg.height || 600;
    const scale = size / Math.max(W, H);

    canvas.width  = W * scale;
    canvas.height = H * scale;

    ctx.fillStyle = cfg.background || "#0F1115";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw platforms
    for (const p of cfg.platforms || []) {
      ctx.fillStyle = p.color || "#2d3561";
      ctx.fillRect(p.x * scale, p.y * scale, p.width * scale, p.height * scale);
    }

    // Draw coins
    for (const c of cfg.coins || []) {
      ctx.fillStyle = c.color || "gold";
      ctx.beginPath();
      ctx.arc(c.x * scale, c.y * scale, (c.radius || 8) * scale, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw enemies
    for (const e of cfg.enemies || []) {
      ctx.fillStyle = e.color || "red";
      ctx.fillRect(e.x * scale, e.y * scale, e.width * scale, e.height * scale);
    }

    // Draw player
    if (cfg.player) {
      const p = cfg.player;
      ctx.fillStyle = p.color || "blue";
      ctx.fillRect(p.x * scale, p.y * scale, p.width * scale, p.height * scale);
    }
  }, [config, size]);

  return <canvas ref={canvasRef} style={{ display: "block", borderRadius: 8 }} />;
}

// ── Feed Card ──────────────────────────────────────────────────────────────────

function FeedCard({
  game, onPlay, onLike, onRemix, onAnalytics, index,
}: {
  game: GameEntry;
  onPlay: (g: GameEntry) => void;
  onLike: (g: GameEntry) => void;
  onRemix: (g: GameEntry) => void;
  onAnalytics: (g: GameEntry) => void;
  index: number;
}) {
  const [liked, setLiked] = useState(game.isLiked);
  const [likeCount, setLikeCount] = useState(game.likeCount);
  const [liking, setLiking] = useState(false);

  const handleLike = async () => {
    if (liking) return;
    setLiking(true);
    const prev = liked;
    setLiked(!prev);
    setLikeCount(c => prev ? c - 1 : c + 1);
    await onLike(game);
    setLiking(false);
  };

  const tagColor = (tag: string) => {
    const colors: Record<string, string> = {
      platformer: "#6C5CE7", neon: "#A29BFE", coins: "#ffcc33",
      survival: "#E17055", sky: "#74B9FF", hard: "#D63031",
      boss: "#E17055", speed: "#00CEC9", dodge: "#FD79A8",
      combat: "#D63031", "ai-generated": "#6C5CE7", viral: "#FD79A8",
    };
    return colors[tag] || "#636e72";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.35 }}
      style={{
        background: "linear-gradient(160deg, #1a1a2e 0%, #12121e 100%)",
        borderRadius: 20,
        border: "1px solid rgba(108,92,231,0.18)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Preview */}
      <div style={{ position: "relative", background: "#07080E", display: "flex", justifyContent: "center", padding: "12px 0" }}>
        <GamePreviewCanvas config={game.gameConfig} size={280} />

        {/* Overlay badges */}
        <div style={{ position: "absolute", top: 10, left: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {game.isRemix && (
            <span style={{ background: "rgba(108,92,231,0.8)", color: "#fff", fontSize: 10, fontWeight: 700,
              padding: "2px 7px", borderRadius: 10, backdropFilter: "blur(8px)" }}>
              REMIX
            </span>
          )}
          {game.createdBy === "ai" && (
            <span style={{ background: "rgba(253,121,168,0.8)", color: "#fff", fontSize: 10, fontWeight: 700,
              padding: "2px 7px", borderRadius: 10, backdropFilter: "blur(8px)" }}>
              AI
            </span>
          )}
        </div>

        {/* Play button overlay */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => onPlay(game)}
          style={{
            position: "absolute", bottom: 12, right: 12,
            background: "linear-gradient(135deg, #6C5CE7, #A29BFE)",
            border: "none", borderRadius: 14, padding: "8px 16px",
            color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
            boxShadow: "0 4px 16px rgba(108,92,231,0.4)",
          }}
        >
          ▶ Play
        </motion.button>
      </div>

      {/* Info */}
      <div style={{ padding: "14px 16px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <div>
            <h3 style={{ color: "#fff", fontSize: 15, fontWeight: 700, margin: 0, marginBottom: 2 }}>{game.name}</h3>
            <p style={{ color: "#a0a8b8", fontSize: 12, margin: 0 }}>by {game.creatorName}</p>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {game.tags.slice(0, 2).map(tag => (
              <span key={tag} style={{ background: tagColor(tag) + "22", color: tagColor(tag),
                fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10, border: `1px solid ${tagColor(tag)}44` }}>
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
          {[
            { icon: "▶", val: game.playCount, label: "plays" },
            { icon: "❤", val: likeCount, label: "likes" },
            { icon: "⚡", val: game.completionCount, label: "wins" },
          ].map(({ icon, val, label }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 11 }}>{icon}</span>
              <span style={{ color: "#c8d0e0", fontSize: 12, fontWeight: 600 }}>{val}</span>
              <span style={{ color: "#636e72", fontSize: 11 }}>{label}</span>
            </div>
          ))}
          {(game.completionRate !== undefined && game.completionRate > 0) && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ color: "#00CEC9", fontSize: 12, fontWeight: 700 }}>{game.completionRate}%</span>
              <span style={{ color: "#636e72", fontSize: 11 }}>win rate</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8 }}>
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={handleLike}
            style={{
              flex: 1, background: liked ? "rgba(253,121,168,0.2)" : "rgba(255,255,255,0.06)",
              border: liked ? "1px solid rgba(253,121,168,0.5)" : "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12, padding: "8px 0", color: liked ? "#FD79A8" : "#a0a8b8",
              fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}
          >
            {liked ? "❤ Liked" : "♡ Like"}
          </motion.button>

          {game.remixable && (
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => onRemix(game)}
              style={{
                flex: 1, background: "rgba(108,92,231,0.12)",
                border: "1px solid rgba(108,92,231,0.3)",
                borderRadius: 12, padding: "8px 0",
                color: "#A29BFE", fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}
            >
              🔀 Remix
            </motion.button>
          )}

          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => onAnalytics(game)}
            style={{
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12, padding: "8px 12px",
              color: "#a0a8b8", fontSize: 13, cursor: "pointer",
            }}
          >
            📊
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Remix Studio Modal ─────────────────────────────────────────────────────────

function RemixStudio({ game, onClose, onPublish }: {
  game: GameEntry;
  onClose: () => void;
  onPublish: (entry: GameEntry) => void;
}) {
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [remixedConfig, setRemixedConfig] = useState<Record<string, unknown> | null>(null);
  const [creatorName, setCreatorName] = useState("Player");
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);

  const presets = ["Make Harder", "Add Boss", "Speed x2", "Night Mode", "Add Chaos"];

  const doRemix = async (instr: string) => {
    setInstruction(instr);
    setLoading(true);
    setRemixedConfig(null);
    try {
      const res = await apiFetch("/api/game-feed/remix", {
        method: "POST",
        body: JSON.stringify({ gameConfig: game.gameConfig, instruction: instr }),
      });
      const data = await res.json();
      if (data.config) setRemixedConfig(data.config);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  const doPublish = async () => {
    if (!remixedConfig) return;
    setPublishing(true);
    try {
      const name = (remixedConfig.name as string) || `${game.name} Remix`;
      const res = await apiFetch("/api/game-feed/publish", {
        method: "POST",
        body: JSON.stringify({
          name, creatorName, createdBy: "user",
          gameConfig: remixedConfig,
          tags: [...(game.tags ?? []).slice(0, 2), "remix"],
          isRemix: true,
          originalGameId: game.id,
          originalGameName: game.name,
        }),
      });
      const data = await res.json();
      if (data.entry) {
        setPublished(true);
        onPublish({ ...data.entry, isLiked: false, avgPlayDurationMs: 0, completionRate: 0 });
      }
    } catch {
      /* ignore */
    } finally {
      setPublishing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "flex-end",
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 26, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxHeight: "90vh", overflowY: "auto",
          background: "#0F1115", borderRadius: "24px 24px 0 0",
          padding: 20, border: "1px solid rgba(108,92,231,0.3)",
        }}
      >
        {/* Handle */}
        <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.2)", borderRadius: 2, margin: "0 auto 16px" }} />

        <h2 style={{ color: "#fff", fontSize: 18, fontWeight: 800, margin: "0 0 4px" }}>
          🔀 Remix: {game.name}
        </h2>
        <p style={{ color: "#a0a8b8", fontSize: 13, margin: "0 0 16px" }}>
          Forked from {game.creatorName} · AI will modify it
        </p>

        {/* Presets */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {presets.map(p => (
            <button key={p} onClick={() => doRemix(p)}
              style={{
                background: "rgba(108,92,231,0.12)", border: "1px solid rgba(108,92,231,0.3)",
                borderRadius: 20, padding: "6px 14px", color: "#A29BFE", fontSize: 12,
                fontWeight: 700, cursor: "pointer",
              }}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Custom instruction */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            value={instruction}
            onChange={e => setInstruction(e.target.value)}
            placeholder="Custom instruction…"
            style={{
              flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12, padding: "10px 14px", color: "#fff", fontSize: 14, outline: "none",
            }}
            onKeyDown={e => { if (e.key === "Enter" && instruction.trim()) doRemix(instruction.trim()); }}
          />
          <button onClick={() => instruction.trim() && doRemix(instruction.trim())}
            disabled={loading || !instruction.trim()}
            style={{
              background: "linear-gradient(135deg,#6C5CE7,#A29BFE)", border: "none",
              borderRadius: 12, padding: "0 18px", color: "#fff", fontSize: 14, fontWeight: 700,
              cursor: loading ? "wait" : "pointer",
            }}
          >
            {loading ? "⟳" : "Go"}
          </button>
        </div>

        {/* Preview */}
        {loading && (
          <div style={{ textAlign: "center", padding: 30, color: "#A29BFE" }}>
            <div style={{ fontSize: 28, animation: "spin 1s linear infinite" }}>⟳</div>
            <p style={{ margin: "8px 0 0", fontSize: 13 }}>AI is remixing…</p>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {remixedConfig && !loading && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <p style={{ color: "#636e72", fontSize: 11, margin: "0 0 6px", fontWeight: 700 }}>ORIGINAL</p>
                <GamePreviewCanvas config={game.gameConfig} size={140} />
              </div>
              <div style={{ fontSize: 20, alignSelf: "center", color: "#6C5CE7" }}>→</div>
              <div style={{ flex: 1 }}>
                <p style={{ color: "#A29BFE", fontSize: 11, margin: "0 0 6px", fontWeight: 700 }}>REMIX</p>
                <GamePreviewCanvas config={remixedConfig} size={140} />
              </div>
            </div>

            {published ? (
              <div style={{ textAlign: "center", padding: 16, background: "rgba(0,206,201,0.1)",
                borderRadius: 14, border: "1px solid rgba(0,206,201,0.3)" }}>
                <div style={{ fontSize: 28 }}>🎉</div>
                <p style={{ color: "#00CEC9", fontWeight: 700, margin: "8px 0 0" }}>Published to feed!</p>
              </div>
            ) : (
              <>
                <input value={creatorName} onChange={e => setCreatorName(e.target.value)}
                  placeholder="Your name"
                  style={{
                    width: "100%", background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12,
                    padding: "10px 14px", color: "#fff", fontSize: 14,
                    outline: "none", boxSizing: "border-box", marginBottom: 10,
                  }}
                />
                <button onClick={doPublish} disabled={publishing}
                  style={{
                    width: "100%", background: "linear-gradient(135deg,#6C5CE7,#A29BFE)",
                    border: "none", borderRadius: 14, padding: "14px 0",
                    color: "#fff", fontSize: 15, fontWeight: 800,
                    cursor: publishing ? "wait" : "pointer",
                  }}
                >
                  {publishing ? "Publishing…" : "🚀 Publish Remix to Feed"}
                </button>
              </>
            )}
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ── Analytics Modal ────────────────────────────────────────────────────────────

function AnalyticsModal({ game, onClose }: { game: GameEntry; onClose: () => void }) {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`/api/game-feed/${game.id}/analytics`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [game.id]);

  const Stat = ({ label, value, color }: { label: string; value: string | number; color?: string }) => (
    <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 14, padding: "14px 16px", flex: 1, minWidth: 80 }}>
      <p style={{ color: color || "#A29BFE", fontSize: 20, fontWeight: 800, margin: 0 }}>{value}</p>
      <p style={{ color: "#636e72", fontSize: 11, margin: "4px 0 0" }}>{label}</p>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.85)",
        display: "flex", alignItems: "flex-end" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 26, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
        style={{ width: "100%", maxHeight: "90vh", overflowY: "auto",
          background: "#0F1115", borderRadius: "24px 24px 0 0",
          padding: 20, border: "1px solid rgba(108,92,231,0.3)" }}
      >
        <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.2)", borderRadius: 2, margin: "0 auto 16px" }} />
        <h2 style={{ color: "#fff", fontSize: 18, fontWeight: 800, margin: "0 0 4px" }}>📊 {game.name}</h2>
        <p style={{ color: "#a0a8b8", fontSize: 13, margin: "0 0 20px" }}>Creator Analytics</p>

        {loading && (
          <div style={{ textAlign: "center", padding: 40, color: "#A29BFE" }}>Loading…</div>
        )}

        {data && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Primary stats */}
            <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <Stat label="Plays" value={data.stats.plays} />
              <Stat label="Likes" value={data.stats.likes} color="#FD79A8" />
              <Stat label="Wins" value={data.stats.completions} color="#00CEC9" />
              <Stat label="Remixes" value={data.stats.remixes} color="#ffcc33" />
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
              <Stat label="Win Rate" value={`${data.stats.completionRate}%`} color="#00CEC9" />
              <Stat label="Replay Rate" value={`${data.stats.replayRate}%`} color="#A29BFE" />
              <Stat label="Avg Play" value={`${data.stats.avgPlayDurationSec}s`} color="#74B9FF" />
              <Stat label="Trend Score" value={data.stats.trendScore} color="#ffcc33" />
            </div>

            {/* Engagement Score Bar */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ color: "#a0a8b8", fontSize: 13, fontWeight: 700 }}>Engagement Score</span>
                <span style={{ color: "#6C5CE7", fontSize: 13, fontWeight: 800 }}>{data.stats.engagementScore}/100</span>
              </div>
              <div style={{ height: 10, background: "rgba(255,255,255,0.08)", borderRadius: 5, overflow: "hidden" }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${data.stats.engagementScore}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  style={{ height: "100%", background: "linear-gradient(90deg,#6C5CE7,#A29BFE,#FD79A8)", borderRadius: 5 }}
                />
              </div>
            </div>

            {/* Retention Curve */}
            <div style={{ marginBottom: 20 }}>
              <p style={{ color: "#a0a8b8", fontSize: 13, fontWeight: 700, margin: "0 0 12px" }}>Retention Curve</p>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 80 }}>
                {data.retentionCurve.map((point, i) => (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${point.rate}%` }}
                      transition={{ duration: 0.6, delay: i * 0.1 }}
                      style={{
                        width: "100%", background: `rgba(108,92,231,${0.3 + point.rate / 200})`,
                        borderRadius: "4px 4px 0 0", minHeight: 4,
                        border: "1px solid rgba(108,92,231,0.4)",
                      }}
                    />
                    <span style={{ color: "#636e72", fontSize: 9 }}>{point.second}s</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Remix lineage */}
            {data.remixes.length > 0 && (
              <div>
                <p style={{ color: "#a0a8b8", fontSize: 13, fontWeight: 700, margin: "0 0 10px" }}>
                  🔀 {data.remixes.length} Remix{data.remixes.length !== 1 ? "es" : ""}
                </p>
                {data.remixes.slice(0, 4).map(r => (
                  <div key={r.id} style={{ display: "flex", justifyContent: "space-between",
                    padding: "10px 14px", background: "rgba(255,255,255,0.04)",
                    borderRadius: 12, marginBottom: 6, border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div>
                      <p style={{ color: "#fff", fontSize: 13, fontWeight: 600, margin: 0 }}>{r.name}</p>
                      <p style={{ color: "#636e72", fontSize: 11, margin: "2px 0 0" }}>by {r.creatorName}</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ color: "#A29BFE", fontSize: 13, fontWeight: 700, margin: 0 }}>▶ {r.playCount}</p>
                      <p style={{ color: "#FD79A8", fontSize: 11, margin: "2px 0 0" }}>❤ {r.likeCount}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function GameEcosystemPage() {
  const [tab, setTab] = useState<"discover" | "about">("discover");
  const [games, setGames] = useState<GameEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [trendingTags, setTrendingTags] = useState<{ tag: string; score: number }[]>([]);
  const [remixGame, setRemixGame] = useState<GameEntry | null>(null);
  const [analyticsGame, setAnalyticsGame] = useState<GameEntry | null>(null);
  const [playingGame, setPlayingGame] = useState<GameEntry | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  const loadFeed = useCallback(async (tag?: string | null) => {
    setLoading(true);
    try {
      const url = `/api/game-feed${tag ? `?tag=${encodeURIComponent(tag)}` : ""}`;
      const res = await apiFetch(url);
      const data = await res.json();
      setGames(data.entries || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTags = useCallback(async () => {
    try {
      const res = await apiFetch("/api/game-feed/tags/trending");
      const data = await res.json();
      setTrendingTags(data.tags || []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadFeed(activeTag);
    loadTags();
  }, [activeTag, loadFeed, loadTags]);

  const handleLike = async (game: GameEntry) => {
    await apiFetch(`/api/game-feed/${game.id}/like`, { method: "POST" });
    setGames(gs => gs.map(g => g.id === game.id
      ? { ...g, isLiked: !g.isLiked, likeCount: g.isLiked ? g.likeCount - 1 : g.likeCount + 1 }
      : g
    ));
  };

  const handlePlay = async (game: GameEntry) => {
    await apiFetch(`/api/game-feed/${game.id}/play`, { method: "POST" });
    setPlayingGame(game);
  };

  const tabs = [
    { id: "discover" as const, label: "🏠 Discover" },
    { id: "about"    as const, label: "ℹ About"     },
  ];

  return (
    <div style={{ background: "#07080E", minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(180deg, rgba(108,92,231,0.12) 0%, transparent 100%)",
        padding: "16px 16px 0",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <h1 style={{ color: "#fff", fontSize: 20, fontWeight: 900, margin: 0 }}>
              <span style={{ background: "linear-gradient(135deg,#6C5CE7,#A29BFE,#FD79A8)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Apex
              </span>
              {" "}Games
            </h1>
            <p style={{ color: "#636e72", fontSize: 11, margin: 0 }}>Self-Publishing Game Ecosystem</p>
          </div>
          <div style={{ background: "rgba(108,92,231,0.15)", borderRadius: 12, padding: "6px 12px",
            border: "1px solid rgba(108,92,231,0.3)" }}>
            <span style={{ color: "#A29BFE", fontSize: 12, fontWeight: 700 }}>{games.length} games</span>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: 4, marginBottom: 0 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                flex: 1, background: "none", border: "none",
                borderBottom: tab === t.id ? "2px solid #6C5CE7" : "2px solid transparent",
                padding: "8px 4px 10px", color: tab === t.id ? "#A29BFE" : "#636e72",
                fontSize: 12, fontWeight: tab === t.id ? 700 : 500, cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div ref={feedRef} style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        {/* Discover Tab */}
        {tab === "discover" && (
          <>
            {/* Trending tags filter */}
            {trendingTags.length > 0 && (
              <div style={{ overflowX: "auto", display: "flex", gap: 8, marginBottom: 16,
                paddingBottom: 4, scrollbarWidth: "none" }}>
                <button onClick={() => setActiveTag(null)}
                  style={{
                    flexShrink: 0, background: activeTag === null ? "rgba(108,92,231,0.3)" : "rgba(255,255,255,0.06)",
                    border: activeTag === null ? "1px solid rgba(108,92,231,0.5)" : "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 20, padding: "6px 14px", color: activeTag === null ? "#A29BFE" : "#636e72",
                    fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
                  }}
                >
                  🔥 Trending
                </button>
                {trendingTags.slice(0, 8).map(({ tag }) => (
                  <button key={tag} onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                    style={{
                      flexShrink: 0,
                      background: activeTag === tag ? "rgba(108,92,231,0.3)" : "rgba(255,255,255,0.06)",
                      border: activeTag === tag ? "1px solid rgba(108,92,231,0.5)" : "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 20, padding: "6px 14px", color: activeTag === tag ? "#A29BFE" : "#636e72",
                      fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
                    }}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}

            {/* Feed */}
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {[1,2,3].map(i => (
                  <div key={i} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 20,
                    height: 320, animation: "pulse 1.5s ease-in-out infinite" }} />
                ))}
                <style>{`@keyframes pulse { 0%,100% { opacity:0.5; } 50% { opacity:0.9; } }`}</style>
              </div>
            ) : games.length === 0 ? (
              <div style={{ textAlign: "center", padding: 60, color: "#636e72" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🎮</div>
                <p style={{ fontWeight: 700 }}>No games yet</p>
                <p style={{ fontSize: 13 }}>Check back soon!</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {games.map((game, i) => (
                  <FeedCard key={game.id} game={game} index={i}
                    onPlay={handlePlay}
                    onLike={handleLike}
                    onRemix={setRemixGame}
                    onAnalytics={setAnalyticsGame}
                  />
                ))}
              </div>
            )}
          </>
        )}


        {/* About Tab */}
        {tab === "about" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              { icon: "🏠", title: "Game as Post", desc: "Every game is a social post — playable, likeable, shareable, and remixable." },
              { icon: "🔀", title: "Remix System", desc: "Fork any game with one tap. AI transforms it via your instruction. Your remix inherits the lineage." },
              { icon: "📊", title: "Creator Analytics", desc: "Real-time play count, win rate, retention curves, and remix lineage for every game you publish." },
              { icon: "✨", title: "AI Viral Engine", desc: "Our AI analyzes top trending games and auto-generates new viral variants with fresh themes." },
              { icon: "🔥", title: "Trending Algorithm", desc: "Feed is ranked by plays × 0.5 + likes × 1.5 + completions × 2 + freshness boost." },
              { icon: "🚀", title: "Instant Publishing", desc: "No approval, no wait. Publish your game to the global Apex Games feed instantly." },
            ].map(({ icon, title, desc }) => (
              <div key={title} style={{ background: "rgba(255,255,255,0.04)",
                borderRadius: 16, padding: 16, border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 24, flexShrink: 0 }}>{icon}</span>
                  <div>
                    <h3 style={{ color: "#fff", fontSize: 14, fontWeight: 700, margin: "0 0 4px" }}>{title}</h3>
                    <p style={{ color: "#a0a8b8", fontSize: 13, margin: 0, lineHeight: 1.5 }}>{desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inline game player overlay */}
      <AnimatePresence>
        {playingGame && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 999,
              background: "rgba(0,0,0,0.92)", display: "flex",
              flexDirection: "column", alignItems: "center", justifyContent: "center" }}
          >
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <h2 style={{ color: "#fff", fontWeight: 800, margin: "0 0 4px" }}>{playingGame.name}</h2>
              <p style={{ color: "#636e72", fontSize: 13, margin: 0 }}>by {playingGame.creatorName}</p>
            </div>
            <div style={{ background: "#07080E", borderRadius: 16, padding: 8,
              border: "1px solid rgba(108,92,231,0.3)", marginBottom: 16 }}>
              <GamePreviewCanvas config={playingGame.gameConfig} size={300} />
            </div>
            <p style={{ color: "#A29BFE", fontSize: 13, margin: "0 0 16px" }}>
              Open Game Engine to play this game
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => {
                  const cfg = JSON.stringify(playingGame.gameConfig);
                  localStorage.setItem("apex-launch-game", cfg);
                  window.location.href = `${BASE}/game-engine`;
                }}
                style={{
                  background: "linear-gradient(135deg,#6C5CE7,#A29BFE)",
                  border: "none", borderRadius: 14, padding: "12px 24px",
                  color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
                }}
              >
                ▶ Open Engine
              </button>
              <button onClick={() => setPlayingGame(null)}
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 14, padding: "12px 20px", color: "#a0a8b8",
                  fontSize: 14, cursor: "pointer" }}>
                Close
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {remixGame && (
          <RemixStudio
            game={remixGame}
            onClose={() => setRemixGame(null)}
            onPublish={(entry) => {
              setGames(gs => [entry, ...gs]);
              setRemixGame(null);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {analyticsGame && (
          <AnalyticsModal game={analyticsGame} onClose={() => setAnalyticsGame(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
