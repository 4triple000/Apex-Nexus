/**
 * Apex Autonomous Game Studio Dashboard
 * Full pipeline: idea → design → build → test → optimize → publish
 */
import { useState, useEffect, useRef, useCallback } from "react";
import type { GameConfig } from "@/engine/types";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const api  = (p: string) => `${BASE}${p}`;

// ── Types ─────────────────────────────────────────────────────────────────────
type PipelineStage =
  | "idle" | "generating_idea" | "designing" | "building"
  | "testing" | "optimizing" | "publishing" | "complete" | "failed";

interface GameIdea {
  id: string; title: string; genre: string; concept: string;
  uniqueMechanic: string; estimatedEngagement: number; suggestedMode: string;
}
interface GameDesign {
  title: string; mechanics: string[]; difficulty: string;
  enemyCount: number; colorTheme: string;
}
interface TestReport {
  overallScore: number; engagementScore: number; balanceScore: number;
  performanceScore: number; bugs: string[]; recommendations: string[];
  passesThreshold: boolean;
}
interface PublishedGame {
  id: string; title: string; genre: string; concept: string;
  config: GameConfig; version: number; publishedAt: number;
  remixEnabled: boolean; multiplayerEnabled: boolean;
  qualityScore: number; optimizationPasses: number;
  testReport: TestReport; idea: GameIdea;
}
interface StudioRun {
  id: string; stage: PipelineStage;
  idea?: GameIdea; design?: GameDesign; config?: GameConfig;
  testReport?: TestReport; optimizationCount: number;
  publishedGame?: PublishedGame;
  startedAt: number; completedAt?: number; durationMs?: number;
  error?: string; qualityScore?: number;
}
interface StudioStatus {
  running: boolean; autoLoop: boolean; stage: PipelineStage;
  currentRun: StudioRun | null; runsCompleted: number;
  gamesPublished: number; publishThisHour: number;
  maxPublishPerHour: number; minQualityScore: number;
  maxOptimizationIterations: number; lastRun: StudioRun | null;
  intervalMin: number;
}

// ── Stage meta ────────────────────────────────────────────────────────────────
const STAGE_META: Record<PipelineStage, { icon: string; label: string; color: string; step: number }> = {
  idle:            { icon: "◉",  label: "Idle",          color: "#636e72", step: 0 },
  generating_idea: { icon: "💡", label: "Idea Engine",   color: "#A29BFE", step: 1 },
  designing:       { icon: "🧠", label: "Design Engine", color: "#6C5CE7", step: 2 },
  building:        { icon: "🛠", label: "Build Engine",  color: "#fdcb6e", step: 3 },
  testing:         { icon: "🧪", label: "Test Engine",   color: "#e17055", step: 4 },
  optimizing:      { icon: "🚀", label: "Optimize",      color: "#fd79a8", step: 5 },
  publishing:      { icon: "🌐", label: "Publishing",    color: "#00b894", step: 6 },
  complete:        { icon: "✅", label: "Complete",      color: "#00b894", step: 7 },
  failed:          { icon: "❌", label: "Failed",        color: "#ff4757", step: 0 },
};

const PIPELINE_STEPS = [
  "generating_idea", "designing", "building", "testing", "optimizing", "publishing"
] as const;

const MODE_LABELS: Record<string, string> = {
  platformer: "🏃 Platformer",
  shooter:    "🔫 Shooter",
  topdown:    "🎯 Top-Down",
  basketball: "🏀 Basketball",
  fps:        "🎮 FPS",
};

const scoreColor = (v: number) => v >= 0.8 ? "#00b894" : v >= 0.65 ? "#fdcb6e" : "#e17055";

// ── Component ─────────────────────────────────────────────────────────────────
interface GameStudioPanelProps {
  onPlay?: (config: GameConfig) => void;
}

export default function GameStudioPanel({ onPlay }: GameStudioPanelProps) {
  const [status,   setStatus]   = useState<StudioStatus | null>(null);
  const [games,    setGames]    = useState<PublishedGame[]>([]);
  const [runs,     setRuns]     = useState<StudioRun[]>([]);
  const [tab,      setTab]      = useState<"studio" | "games" | "history" | "control">("studio");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [log,      setLog]      = useState<string[]>([]);
  const [autoLoop, setAutoLoop] = useState(false);
  const [intervalMin, setIntervalMin] = useState(30);
  const logRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addLog = useCallback((msg: string) => {
    setLog((p) => [...p.slice(-49), `${new Date().toLocaleTimeString()} ${msg}`]);
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const [sRes, gRes, rRes] = await Promise.all([
        fetch(api("/api/game-studio/status")),
        fetch(api("/api/game-studio/games?limit=20")),
        fetch(api("/api/game-studio/history")),
      ]);
      if (sRes.ok) setStatus(await sRes.json() as StudioStatus);
      if (gRes.ok) { const d = await gRes.json() as { games: PublishedGame[] }; setGames(d.games ?? []); }
      if (rRes.ok) { const d = await rRes.json() as { runs: StudioRun[] }; setRuns(d.runs ?? []); }
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => {
    fetchAll();
    pollRef.current = setInterval(fetchAll, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchAll]);

  useEffect(() => { logRef.current?.scrollIntoView({ behavior: "smooth" }); }, [log]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const startStudio = async () => {
    setLoading(true);
    try {
      await fetch(api("/api/game-studio/start"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoLoop, intervalMs: intervalMin * 60_000 }),
      });
      addLog("✅ Game Studio started");
      await fetchAll();
    } finally { setLoading(false); }
  };

  const pauseStudio = async () => {
    await fetch(api("/api/game-studio/pause"), { method: "POST" });
    addLog("⏸ Studio paused");
    await fetchAll();
  };

  const generateGame = async () => {
    setLoading(true);
    addLog("🎮 Generating new game… (this takes ~2-3 min)");
    try {
      const res  = await fetch(api("/api/game-studio/generate"), { method: "POST" });
      const data = await res.json() as { run?: StudioRun; error?: string };
      if (data.run) {
        if (data.run.publishedGame) {
          addLog(`🌐 Published: "${data.run.publishedGame.title}" (${Math.round(data.run.publishedGame.qualityScore * 100)}% quality)`);
        } else if (data.run.error) {
          addLog(`⚠ Cycle done but not published: ${data.run.error}`);
        } else {
          addLog(`✅ Cycle done — game ready (${Math.round((data.run.qualityScore ?? 0) * 100)}% quality)`);
        }
      } else {
        addLog(`❌ ${data.error ?? "Generation error"}`);
      }
      await fetchAll();
    } finally { setLoading(false); }
  };

  const unpublish = async (id: string) => {
    await fetch(api(`/api/game-studio/unpublish/${id}`), { method: "POST" });
    addLog("🗑 Game unpublished");
    await fetchAll();
  };

  const handlePlay = (game: PublishedGame) => {
    addLog(`🎮 Launching: "${game.title}"`);
    onPlay?.(game.config);
  };

  // ── Score bar ─────────────────────────────────────────────────────────────
  const ScoreBar = ({ value, label }: { value: number; label: string }) => (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
        <span style={{ fontSize: 10, color: "#636e72" }}>{label}</span>
        <span style={{ fontSize: 10, color: scoreColor(value), fontWeight: 700 }}>{Math.round(value * 100)}%</span>
      </div>
      <div style={{ height: 4, background: "rgba(30,26,62,0.62)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${Math.round(value * 100)}%`,
          background: scoreColor(value), borderRadius: 3, transition: "width 0.5s",
        }} />
      </div>
    </div>
  );

  // ── Pipeline step indicator ───────────────────────────────────────────────
  const currentStep = STAGE_META[status?.stage ?? "idle"]?.step ?? 0;
  const currentMeta = STAGE_META[status?.stage ?? "idle"];

  return (
    <div style={{
      fontFamily: "'SF Pro Display', -apple-system, sans-serif",
      background: "transparent", borderRadius: 16,
      border: "1px solid #1a1b2e", overflow: "hidden",
    }}>
      {/* ── Header ── */}
      <div style={{
        background: "linear-gradient(180deg, rgba(34,29,70,0.94), rgba(16,13,38,0.95))",
        borderBottom: "1px solid #1a1b2e", padding: "16px 18px",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 14,
              background: "linear-gradient(135deg, #6C5CE7, #A29BFE, #FD79A8)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
            }}>🎮</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", letterSpacing: -0.3 }}>
                AI Game Studio
                <span style={{ marginLeft: 8, fontSize: 9, background: "rgba(30,26,62,0.62)", color: "#6C5CE7", padding: "2px 7px", borderRadius: 10, fontWeight: 700, letterSpacing: 1 }}>v1</span>
              </div>
              <div style={{ fontSize: 11, color: "#636e72" }}>Autonomous · idea→design→build→test→optimize→publish</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {[
              { v: status?.gamesPublished ?? 0, l: "Published", c: "#00b894" },
              { v: status?.runsCompleted   ?? 0, l: "Cycles",    c: "#A29BFE" },
              { v: status?.publishThisHour ?? 0, l: `/${status?.maxPublishPerHour ?? 5}h`, c: "#fdcb6e" },
            ].map(({ v, l, c }) => (
              <div key={l} style={{
                background: "rgba(30,26,62,0.62)", border: "1px solid #1a1b2e",
                borderRadius: 20, padding: "4px 10px", textAlign: "center",
              }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: c }}>{v}</div>
                <div style={{ fontSize: 9, color: "#636e72", letterSpacing: 0.5 }}>{l}</div>
              </div>
            ))}
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "rgba(30,26,62,0.62)", border: "1px solid #1a1b2e",
              borderRadius: 20, padding: "6px 12px",
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: "50%",
                background: currentMeta.color,
                boxShadow: status?.stage !== "idle" ? `0 0 8px ${currentMeta.color}` : "none",
              }} />
              <span style={{ fontSize: 11, color: currentMeta.color, fontWeight: 700 }}>
                {currentMeta.icon} {currentMeta.label}
              </span>
            </div>
          </div>
        </div>

        {/* Pipeline progress bar */}
        <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
          {PIPELINE_STEPS.map((step, i) => {
            const sm     = STAGE_META[step];
            const active = status?.stage === step;
            const done   = currentStep > sm.step;
            return (
              <div key={step} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                <div style={{
                  flex: 1, padding: "5px 2px", borderRadius: 7, textAlign: "center",
                  background: done ? "#00b89420" : active ? `${sm.color}20` : "#0f1020",
                  border: `1px solid ${done ? "#00b89444" : active ? sm.color : "#1a1b2e"}`,
                  transition: "all 0.4s",
                }}>
                  <div style={{ fontSize: 12 }}>{sm.icon}</div>
                  <div style={{ fontSize: 8, color: done ? "#00b894" : active ? sm.color : "#2d3436", fontWeight: 700, marginTop: 1, letterSpacing: 0.2 }}>
                    {sm.label.toUpperCase()}
                  </div>
                </div>
                {i < PIPELINE_STEPS.length - 1 && (
                  <div style={{ fontSize: 10, color: done ? "#00b89466" : "#1a1b2e", flexShrink: 0, margin: "0 1px" }}>›</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div style={{ display: "flex", borderBottom: "1px solid #1a1b2e", background: "transparent" }}>
        {([
          { id: "studio",  label: "🎯 Studio"                                           },
          { id: "games",   label: `🎮 Games${games.length ? ` (${games.length})` : ""}` },
          { id: "history", label: "📜 History"                                          },
          { id: "control", label: "⚙ Control"                                           },
        ] as const).map(({ id, label }) => (
          <button key={id} onClick={() => setTab(id)} style={{
            flex: 1, padding: "10px 0", background: "none", border: "none",
            borderBottom: tab === id ? "2px solid #6C5CE7" : "2px solid transparent",
            color: tab === id ? "#A29BFE" : "#636e72",
            fontSize: 11, fontWeight: 700, cursor: "pointer",
            letterSpacing: 0.5, textTransform: "uppercase", transition: "all 0.2s",
          }}>{label}</button>
        ))}
      </div>

      <div style={{ padding: 14 }}>

        {/* ─── STUDIO TAB ──────────────────────────────────────────────────── */}
        {tab === "studio" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

            {/* Current run live view */}
            {status?.currentRun && status.currentRun.stage !== "idle" && (
              <div style={{
                background: "rgba(30,26,62,0.62)", border: `1px solid ${currentMeta.color}44`,
                borderRadius: 12, padding: 14,
              }}>
                <div style={{ fontSize: 10, color: "#636e72", marginBottom: 8, fontWeight: 700, letterSpacing: 1 }}>
                  LIVE RUN — {currentMeta.icon} {currentMeta.label.toUpperCase()}
                </div>

                {status.currentRun.idea && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#dfe6e9", marginBottom: 2 }}>
                      💡 {status.currentRun.idea.title}
                    </div>
                    <div style={{ fontSize: 11, color: "#636e72", lineHeight: 1.5 }}>
                      {status.currentRun.idea.concept}
                    </div>
                    <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                      <span style={{ fontSize: 9, background: "rgba(30,26,62,0.62)", color: "#A29BFE", padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>
                        {MODE_LABELS[status.currentRun.idea.suggestedMode] ?? status.currentRun.idea.suggestedMode}
                      </span>
                      <span style={{ fontSize: 9, background: "rgba(30,26,62,0.62)", color: "#636e72", padding: "2px 8px", borderRadius: 10 }}>
                        {status.currentRun.idea.genre}
                      </span>
                    </div>
                  </div>
                )}

                {status.currentRun.design && (
                  <div style={{ borderTop: "1px solid #1a1b2e", paddingTop: 8, marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: "#636e72", marginBottom: 4 }}>
                      🧠 Design: {status.currentRun.design.difficulty} · {status.currentRun.design.enemyCount} enemies
                    </div>
                    <div style={{ fontSize: 11, color: "#b2bec3", lineHeight: 1.6 }}>
                      {status.currentRun.design.mechanics.slice(0, 2).join(" · ")}
                    </div>
                  </div>
                )}

                {status.currentRun.testReport && (
                  <div style={{ borderTop: "1px solid #1a1b2e", paddingTop: 8 }}>
                    <ScoreBar value={status.currentRun.testReport.engagementScore}  label="Engagement" />
                    <ScoreBar value={status.currentRun.testReport.balanceScore}     label="Balance"    />
                    <ScoreBar value={status.currentRun.testReport.performanceScore} label="Performance" />
                    <ScoreBar value={status.currentRun.testReport.overallScore}     label="Overall Quality" />
                    {status.currentRun.testReport.bugs.length > 0 && (
                      <div style={{ fontSize: 10, color: "#e17055", marginTop: 4 }}>
                        ⚠ {status.currentRun.testReport.bugs[0]}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Engine overview */}
            <div style={{ background: "rgba(30,26,62,0.62)", border: "1px solid #1a1b2e", borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 10, color: "#636e72", marginBottom: 10, fontWeight: 700, letterSpacing: 1 }}>
                STUDIO ENGINES
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  { icon: "💡", name: "Idea Engine",       desc: "Trend analysis → game concept",      color: "#A29BFE" },
                  { icon: "🧠", name: "Design Engine",     desc: "Concept → mechanics + structure",     color: "#6C5CE7" },
                  { icon: "🛠", name: "Build Engine",      desc: "Design → full GameConfig JSON",      color: "#fdcb6e" },
                  { icon: "🧪", name: "Testing Engine",    desc: "Simulate gameplay → quality scores",  color: "#e17055" },
                  { icon: "🚀", name: "Optimize Engine",   desc: "Auto-refine until threshold met",     color: "#fd79a8" },
                  { icon: "🌐", name: "Publish Engine",    desc: "Feed + remix + multiplayer support",  color: "#00b894" },
                ].map((e) => (
                  <div key={e.name} style={{
                    background: "rgba(30,26,62,0.62)", border: "1px solid #1a1b2e",
                    borderRadius: 10, padding: "10px 12px",
                    display: "flex", alignItems: "center", gap: 8,
                  }}>
                    <span style={{ fontSize: 18 }}>{e.icon}</span>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: e.color }}>{e.name}</div>
                      <div style={{ fontSize: 9.5, color: "#636e72", lineHeight: 1.4 }}>{e.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Last run summary */}
            {status?.lastRun?.stage === "complete" && (
              <div style={{
                background: status.lastRun.publishedGame ? "#00b89410" : "#fdcb6e10",
                border: `1px solid ${status.lastRun.publishedGame ? "#00b89433" : "#fdcb6e33"}`,
                borderRadius: 10, padding: 12,
              }}>
                <div style={{ fontSize: 10, color: "#636e72", marginBottom: 4, fontWeight: 700, letterSpacing: 1 }}>LAST RUN</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#dfe6e9" }}>
                  {status.lastRun.publishedGame ? `🌐 ${status.lastRun.publishedGame.title}` : "✓ Cycle complete (not published)"}
                </div>
                <div style={{ fontSize: 11, color: "#636e72", marginTop: 2 }}>
                  {Math.round((status.lastRun.durationMs ?? 0) / 1000)}s
                  {status.lastRun.qualityScore !== undefined && ` · Quality: ${Math.round(status.lastRun.qualityScore * 100)}%`}
                  {status.lastRun.optimizationCount > 0 && ` · ${status.lastRun.optimizationCount} optimization passes`}
                </div>
                {status.lastRun.error && <div style={{ fontSize: 11, color: "#fdcb6e", marginTop: 4 }}>⚠ {status.lastRun.error}</div>}
              </div>
            )}

            {/* Log */}
            <div style={{ background: "transparent", border: "1px solid #1a1b2e", borderRadius: 10, padding: 10, maxHeight: 110, overflowY: "auto" }}>
              <div style={{ fontSize: 10, color: "#636e72", marginBottom: 4, fontWeight: 700, letterSpacing: 1 }}>LIVE LOG</div>
              {log.length === 0
                ? <div style={{ fontSize: 11, color: "#2d3436" }}>No activity yet…</div>
                : log.map((l, i) => <div key={i} style={{ fontSize: 11, color: "#b2bec3", lineHeight: 1.7 }}>{l}</div>)
              }
              <div ref={logRef} />
            </div>
          </div>
        )}

        {/* ─── GAMES TAB ───────────────────────────────────────────────────── */}
        {tab === "games" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {games.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#636e72", fontSize: 13 }}>
                🎮 No games published yet.<br />
                <span style={{ fontSize: 11, color: "#2d3436" }}>Generate your first game to get started.</span>
              </div>
            ) : games.map((game) => {
              const isExpanded = expanded === game.id;
              return (
                <div key={game.id} style={{
                  background: "rgba(30,26,62,0.62)", border: "1px solid #1a1b2e",
                  borderRadius: 12, overflow: "hidden",
                }}>
                  <div style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", marginBottom: 3 }}>{game.title}</div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 9, background: "#6C5CE722", color: "#A29BFE", padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>
                            {MODE_LABELS[game.config.gameMode ?? "platformer"] ?? game.config.gameMode}
                          </span>
                          <span style={{ fontSize: 9, background: "rgba(30,26,62,0.62)", color: "#636e72", padding: "2px 8px", borderRadius: 10 }}>
                            {game.genre}
                          </span>
                          <span style={{ fontSize: 9, background: "rgba(30,26,62,0.62)", color: "#636e72", padding: "2px 8px", borderRadius: 10 }}>
                            v{game.version}
                          </span>
                          {game.remixEnabled && <span style={{ fontSize: 9, background: "#00b89422", color: "#00b894", padding: "2px 8px", borderRadius: 10 }}>🔀 Remix</span>}
                          {game.multiplayerEnabled && <span style={{ fontSize: 9, background: "#fd79a822", color: "#fd79a8", padding: "2px 8px", borderRadius: 10 }}>👥 MP</span>}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", marginLeft: 10 }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: scoreColor(game.qualityScore) }}>
                          {Math.round(game.qualityScore * 100)}%
                        </div>
                        <div style={{ fontSize: 9, color: "#636e72" }}>QUALITY</div>
                      </div>
                    </div>

                    <div style={{ fontSize: 11, color: "#636e72", lineHeight: 1.5, marginBottom: 8 }}>
                      {game.concept}
                    </div>

                    {/* Quality bars */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 12px" }}>
                      <ScoreBar value={game.testReport.engagementScore}  label="Engagement"  />
                      <ScoreBar value={game.testReport.balanceScore}     label="Balance"     />
                      <ScoreBar value={game.testReport.performanceScore} label="Performance" />
                    </div>

                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button onClick={() => handlePlay(game)} style={{
                        flex: 1, padding: "9px", borderRadius: 8,
                        background: "linear-gradient(135deg, #6C5CE7, #A29BFE)",
                        border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
                      }}>▶ Play Game</button>
                      <button onClick={() => setExpanded(isExpanded ? null : game.id)} style={{
                        padding: "9px 12px", borderRadius: 8,
                        border: "1px solid #1a1b2e", background: "none", color: "#636e72",
                        fontSize: 12, cursor: "pointer",
                      }}>{isExpanded ? "▲" : "▼"}</button>
                      <button onClick={() => unpublish(game.id)} style={{
                        padding: "9px 12px", borderRadius: 8,
                        border: "1px solid #e1705533", background: "none", color: "#e17055",
                        fontSize: 11, cursor: "pointer",
                      }}>🗑</button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={{ borderTop: "1px solid #1a1b2e", padding: "12px 14px", background: "transparent" }}>
                      <div style={{ fontSize: 10, color: "#636e72", marginBottom: 4, fontWeight: 700, letterSpacing: 1 }}>IDEA MECHANIC</div>
                      <div style={{ fontSize: 11, color: "#b2bec3", marginBottom: 8 }}>{game.idea.uniqueMechanic}</div>
                      <div style={{ fontSize: 10, color: "#636e72", marginBottom: 4, fontWeight: 700, letterSpacing: 1 }}>OPTIMIZATION</div>
                      <div style={{ fontSize: 11, color: "#b2bec3", marginBottom: 8 }}>{game.optimizationPasses} passes run</div>
                      <div style={{ fontSize: 10, color: "#636e72", marginBottom: 4, fontWeight: 700, letterSpacing: 1 }}>PUBLISHED</div>
                      <div style={{ fontSize: 11, color: "#b2bec3" }}>{new Date(game.publishedAt).toLocaleString()}</div>
                      {game.testReport.recommendations.slice(0, 2).map((r, i) => (
                        <div key={i} style={{ fontSize: 10, color: "#636e72", marginTop: 4 }}>• {r}</div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ─── HISTORY TAB ─────────────────────────────────────────────────── */}
        {tab === "history" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {runs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#636e72", fontSize: 13 }}>
                📜 No runs yet.
              </div>
            ) : runs.map((run) => (
              <div key={run.id} style={{
                background: "rgba(30,26,62,0.62)",
                border: `1px solid ${run.publishedGame ? "#00b89433" : run.stage === "failed" ? "#e1705533" : "#1a1b2e"}`,
                borderRadius: 10, padding: "12px 14px",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: run.publishedGame ? "#00b894" : run.stage === "failed" ? "#e17055" : "#dfe6e9" }}>
                    {run.publishedGame ? `🌐 ${run.publishedGame.title}` : run.stage === "failed" ? "❌ Failed" : run.idea ? `✓ ${run.idea.title}` : "✓ Cycle"}
                  </span>
                  <span style={{ fontSize: 10, color: "#636e72" }}>
                    {new Date(run.startedAt).toLocaleTimeString()} · {Math.round((run.durationMs ?? 0) / 1000)}s
                  </span>
                </div>
                <div style={{ display: "flex", gap: 10, fontSize: 11, color: "#636e72" }}>
                  {run.qualityScore !== undefined && (
                    <span style={{ color: scoreColor(run.qualityScore) }}>{Math.round(run.qualityScore * 100)}% quality</span>
                  )}
                  {run.optimizationCount > 0 && <span>{run.optimizationCount} opt passes</span>}
                  <span>{STAGE_META[run.stage].icon} {STAGE_META[run.stage].label}</span>
                </div>
                {run.error && <div style={{ fontSize: 10, color: "#fdcb6e", marginTop: 4 }}>⚠ {run.error}</div>}
              </div>
            ))}
          </div>
        )}

        {/* ─── CONTROL TAB ─────────────────────────────────────────────────── */}
        {tab === "control" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

            {/* Status */}
            <div style={{
              background: status?.running ? "#00b89415" : "#e1705515",
              border: `1px solid ${status?.running ? "#00b89433" : "#e1705533"}`,
              borderRadius: 10, padding: "10px 14px",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <div style={{
                width: 10, height: 10, borderRadius: "50%",
                background: status?.running ? "#00b894" : "#e17055",
                boxShadow: status?.running ? "0 0 8px #00b894" : "none",
              }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: status?.running ? "#00b894" : "#e17055" }}>
                {status?.running ? "Studio Online" : "Studio Offline"}
              </span>
              {status?.autoLoop && <span style={{ marginLeft: "auto", fontSize: 9, background: "#A29BFE22", color: "#A29BFE", padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>AUTO-LOOP ON</span>}
            </div>

            {/* Interval */}
            <div style={{ background: "rgba(30,26,62,0.62)", border: "1px solid #1a1b2e", borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 10, color: "#636e72", marginBottom: 8, fontWeight: 700, letterSpacing: 1 }}>AUTO-LOOP INTERVAL</div>
              <div style={{ display: "flex", gap: 8 }}>
                {[15, 30, 60, 120].map((m) => (
                  <button key={m} onClick={() => setIntervalMin(m)} style={{
                    flex: 1, padding: "8px 0", borderRadius: 8,
                    border: `1px solid ${intervalMin === m ? "#6C5CE7" : "#1a1b2e"}`,
                    background: intervalMin === m ? "#6C5CE722" : "none",
                    color: intervalMin === m ? "#A29BFE" : "#636e72",
                    fontSize: 12, fontWeight: 700, cursor: "pointer",
                  }}>{m}m</button>
                ))}
              </div>
            </div>

            {/* Auto-loop toggle */}
            <div style={{
              background: "rgba(30,26,62,0.62)", border: "1px solid #1a1b2e", borderRadius: 10, padding: 14,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#dfe6e9" }}>Continuous Creation Loop</div>
                <div style={{ fontSize: 11, color: "#636e72", marginTop: 2 }}>
                  Automatically generates new games on the set interval
                </div>
              </div>
              <div onClick={() => setAutoLoop((v) => !v)} style={{
                width: 44, height: 24, borderRadius: 12,
                background: autoLoop ? "#6C5CE7" : "#2d3436",
                position: "relative", cursor: "pointer", transition: "background 0.3s",
              }}>
                <div style={{
                  position: "absolute", top: 3, left: autoLoop ? 22 : 3,
                  width: 18, height: 18, borderRadius: "50%", background: "#fff",
                  transition: "left 0.3s",
                }} />
              </div>
            </div>

            {/* Buttons */}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={startStudio} disabled={loading || !!status?.running} style={{
                flex: 1, padding: "12px", borderRadius: 10, border: "none",
                background: status?.running ? "#2d3436" : "linear-gradient(135deg, #6C5CE7, #A29BFE)",
                color: status?.running ? "#636e72" : "#fff",
                fontSize: 13, fontWeight: 700, cursor: status?.running ? "not-allowed" : "pointer",
              }}>▶ Start Studio</button>
              <button onClick={pauseStudio} disabled={!status?.running} style={{
                flex: 1, padding: "12px", borderRadius: 10,
                border: `1px solid ${!status?.running ? "transparent" : "#e1705533"}`,
                background: !status?.running ? "#2d3436" : "#e1705522",
                color: !status?.running ? "#636e72" : "#e17055",
                fontSize: 13, fontWeight: 700, cursor: !status?.running ? "not-allowed" : "pointer",
              }}>⏸ Pause</button>
            </div>

            <button onClick={generateGame} disabled={loading} style={{
              padding: "12px", borderRadius: 10,
              border: "1px solid #6C5CE733", background: "#6C5CE722", color: "#A29BFE",
              fontSize: 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
            }}>
              {loading ? "⚙ Generating game… (~2-3 min)" : "🎮 Generate One Game Now"}
            </button>

            {/* Safety info */}
            <div style={{
              background: "rgba(30,26,62,0.62)", border: "1px solid #1a1b2e", borderRadius: 10,
              padding: 14, fontSize: 11, color: "#636e72", lineHeight: 1.8,
            }}>
              <div style={{ fontWeight: 700, color: "#dfe6e9", marginBottom: 6 }}>🔐 Safety Controls</div>
              <div>• Max {status?.maxPublishPerHour ?? 5} games published per hour ({status?.publishThisHour ?? 0} this hour)</div>
              <div>• Min {Math.round((status?.minQualityScore ?? 0.70) * 100)}% quality score required to publish</div>
              <div>• Max {status?.maxOptimizationIterations ?? 3} optimization passes per game</div>
              <div>• All games can be manually unpublished</div>
              <div>• Remix + multiplayer flags are per-game configurable</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
