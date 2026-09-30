/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  APEX FEATURE BUILDER — Builder Tab Component               ║
 * ║                                                             ║
 * ║  Two modes:                                                 ║
 * ║    User mode  — simulate features, build personal content   ║
 * ║    Dev mode   — apply real code changes to Apex codebase    ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
import { useState, useEffect, useCallback } from "react";
import AutonomousPanel from "./AutonomousPanel";
import { useAuth } from "@/contexts/AuthContext";
import { authHeaders } from "@/lib/authSession";
import OrchestratorPanel from "../agents/OrchestratorPanel";

// ── Design tokens (matching game-engine.tsx) ───────────────────────────────
const BG = "transparent";
const CARD   = "rgba(255,255,255,0.04)";
const BORDER = "rgba(255,255,255,0.08)";
const GRAD   = "linear-gradient(135deg,#6C5CE7,#A29BFE,#FD79A8)";
const GOLD   = "#A29BFE";

// ── Types ──────────────────────────────────────────────────────────────────
interface PlanFile {
  path:        string;
  action:      "create" | "modify";
  description: string;
  code:        string;
  insertAfter?: string;
}

interface FeaturePlan {
  feature:      string;
  description:  string;
  userValue:    string;
  complexity:   "low" | "medium" | "high";
  type:         string;
  files:        PlanFile[];
  risks:        string[];
  estimatedLines: number;
  userExtension?: {
    type:   string;
    name:   string;
    config: Record<string, unknown>;
  } | null;
}

interface Snapshot {
  id:        string;
  label:     string;
  timestamp: number;
  files:     Array<{ path: string }>;
}

interface ApplyResult {
  path:    string;
  status:  string;
  message: string;
}

// ── Quick prompt examples ──────────────────────────────────────────────────
const EXAMPLES = [
  { label: "🎯 Game Feature",   prompt: "add a double-jump power-up to platformer games" },
  { label: "📊 Leaderboard",    prompt: "add a global leaderboard with top 10 scores" },
  { label: "🎨 Dark Theme",     prompt: "add a midnight purple theme with neon accents" },
  { label: "🤖 AI Persona",     prompt: "create a cyberpunk hacker AI persona named Ghost" },
  { label: "💥 Particles",      prompt: "add particle explosion effects when enemies are defeated" },
  { label: "📡 Live Stats",     prompt: "add a live player stats HUD overlay during games" },
];

const COMPLEXITY_COLOR: Record<string, string> = {
  low:    "#10B981",
  medium: "#FFB703",
  high:   "#FF6B6B",
};

// ── Component ──────────────────────────────────────────────────────────────
export function BuilderTab({ api }: { api: (p: string) => string }) {
  const [prompt,       setPrompt]       = useState("");
  const [planning,     setPlanning]     = useState(false);
  const [plan,         setPlan]         = useState<FeaturePlan | null>(null);
  const [planOffline,  setPlanOffline]  = useState(false);
  const [applying,     setApplying]     = useState(false);
  const [applyResults, setApplyResults] = useState<ApplyResult[] | null>(null);
  const [viewCodeIdx,  setViewCodeIdx]  = useState<number | null>(null);
  const [buildLog,     setBuildLog]     = useState<string[]>([]);

  // Dev mode state
  // Developer Mode (apply code changes) is only offered to the app owner
  const isOwner = !!useAuth().user?.isOwner;
  const [devMode,          setDevMode]          = useState(false);
  const [keyError,         setKeyError]          = useState<string | null>(null);
  const [planError,        setPlanError]         = useState<string | null>(null);

  // Snapshot state
  const [snapshots,         setSnapshots]         = useState<Snapshot[]>([]);
  const [loadingSnapshots,  setLoadingSnapshots]  = useState(false);
  const [rollingBack,       setRollingBack]       = useState<string | null>(null);
  const [rollbackResult,    setRollbackResult]    = useState<string | null>(null);

  // Sub-tab: "builder" | "autonomous" | "orchestrator"
  const [subTab, setSubTab] = useState<"builder" | "autonomous" | "orchestrator">("builder");

  // Fetch snapshots when dev mode activates
  useEffect(() => {
    if (devMode) fetchSnapshots();
  }, [devMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchSnapshots = useCallback(async () => {
    setLoadingSnapshots(true);
    try {
      const res = await fetch(api("/api/builder/snapshots"), { headers: authHeaders() });
      if (res.status === 401 || res.status === 403) { handleNotOwner(); return; }
      const data = await res.json() as { snapshots: Snapshot[] };
      setSnapshots(data.snapshots ?? []);
    } catch { /* non-fatal */ }
    finally { setLoadingSnapshots(false); }
  }, [api]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNotOwner = () => {
    setDevMode(false);
    setKeyError("Developer Mode is only available to the app owner.");
  };

  const exitDevMode = () => {
    setDevMode(false);
    setSnapshots([]);
  };

  // ── Generate plan ───────────────────────────────────────────────────────
  const generatePlan = async () => {
    if (!prompt.trim()) return;
    setPlanning(true);
    setPlan(null);
    setPlanError(null);
    setApplyResults(null);
    setBuildLog([]);
    setViewCodeIdx(null);
    try {
      const res  = await fetch(api("/api/builder/plan"), {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ prompt, devMode }),
      });
      const data = await res.json() as { plan: FeaturePlan; offline: boolean };
      setPlan(data.plan);
      setPlanOffline(data.offline ?? false);
    } catch {
      setPlanError("Failed to generate plan — check API connection");
    } finally {
      setPlanning(false);
    }
  };

  // ── Apply plan (dev only) ───────────────────────────────────────────────
  const applyPlan = async () => {
    if (!plan || !devMode) return;
    setApplying(true);
    setApplyResults(null);
    setBuildLog(["🔒 Creating snapshot before applying…"]);
    try {
      const res  = await fetch(api("/api/builder/apply"), {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body:    JSON.stringify({ plan }),
      });

      if (res.status === 401 || res.status === 403) { handleNotOwner(); return; }

      const data = await res.json() as { success: boolean; snapshotId: string; results: ApplyResult[] };

      setBuildLog((l) => [
        ...l,
        `📦 Snapshot saved: ${data.snapshotId}`,
        ...(data.results ?? []).map((r) =>
          r.status === "error"
            ? `❌ ${r.path}: ${r.message}`
            : `✅ ${r.path} — ${r.message}`
        ),
        data.success ? "🚀 All changes applied! Vite HMR will hot-reload." : "⚠️ Some files had errors — check log above.",
      ]);

      setApplyResults(data.results);
      await fetchSnapshots();
    } catch (err) {
      setBuildLog((l) => [...l, `❌ Network error: ${String(err)}`]);
    } finally {
      setApplying(false);
    }
  };

  // ── Rollback ────────────────────────────────────────────────────────────
  const rollback = async (snapshotId: string) => {
    if (!devMode || rollingBack) return;
    setRollingBack(snapshotId);
    setRollbackResult(null);
    try {
      const res = await fetch(api("/api/builder/rollback"), {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body:    JSON.stringify({ snapshotId }),
      });
      if (res.status === 401 || res.status === 403) { handleNotOwner(); return; }
      const data = await res.json() as { success: boolean; results: Array<{ path: string; status: string }> };
      const ok   = data.results.filter((r) => r.status === "restored").length;
      setRollbackResult(`↩ Rolled back ${ok} file${ok !== 1 ? "s" : ""}. Vite HMR will reload.`);
    } catch {
      setRollbackResult("❌ Rollback failed — check API connection");
    } finally {
      setRollingBack(null);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Sub-tab bar: Builder ↔ Autonomous ── */}
      <div style={{
        display: "flex", borderRadius: 14,
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${BORDER}`,
        padding: 4, gap: 2,
      }}>
        {([
          { id: "builder",      label: "⚡ Builder"      },
          { id: "autonomous",   label: "🤖 Autonomous"   },
          { id: "orchestrator", label: "🧠 Orchestrator" },
        ] as const).map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setSubTab(id)}
            style={{
              flex: 1, padding: "8px 0", borderRadius: 10, border: "none",
              background: subTab === id
                ? id === "builder"
                  ? "rgba(162,155,254,0.15)"
                  : "linear-gradient(135deg,#6C5CE7,#A29BFE)"
                : "none",
              color: subTab === id
                ? id === "builder" ? GOLD : "#fff"
                : "#555",
              fontWeight: 700, fontSize: 12, cursor: "pointer",
              transition: "all 0.2s",
            }}
          >{label}</button>
        ))}
      </div>

      {/* ── Autonomous System panel ── */}
      {subTab === "autonomous" && (
        <AutonomousPanel ownerMode={devMode} />
      )}

      {/* ── Orchestrator Agent panel ── */}
      {subTab === "orchestrator" && (
        <OrchestratorPanel />
      )}

      {/* ── Builder content (shown only on builder tab) ── */}
      {subTab === "builder" && <>

      {/* ── Dev mode banner ── */}
      {devMode ? (
        <div style={{
          borderRadius: 12,
          background: "rgba(162,155,254,0.07)",
          border: "1px solid rgba(162,155,254,0.25)",
          padding: "10px 14px",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 16 }}>🔐</span>
          <span style={{ flex: 1, fontWeight: 700, fontSize: 13, color: GOLD }}>
            Developer Mode active — you can apply code changes to the Apex codebase
          </span>
          <button
            onClick={exitDevMode}
            style={{
              background: "none", border: "1px solid rgba(162,155,254,0.30)",
              borderRadius: 8, color: GOLD, fontSize: 11, fontWeight: 700,
              padding: "4px 10px", cursor: "pointer",
            }}
          >Exit Dev</button>
        </div>
      ) : (
        <div style={{
          borderRadius: 12,
          background: CARD,
          border: `1px solid ${BORDER}`,
          padding: "10px 14px",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 16 }}>👤</span>
          <span style={{ flex: 1, fontSize: 13, color: "#666" }}>
            User mode — simulate features &amp; build personal content
          </span>
          {isOwner && (
            <button
              onClick={() => { setKeyError(null); setDevMode(true); }}
              style={{
                background: "none", border: `1px solid ${BORDER}`,
                borderRadius: 8, color: "#555", fontSize: 11, fontWeight: 700,
                padding: "4px 10px", cursor: "pointer",
              }}
            >🔐 Developer Mode</button>
          )}
        </div>
      )}

      {keyError && !devMode && (
        <div style={{ fontSize: 12, color: "#FF6B6B" }}>{keyError}</div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ PROMPT INPUT ━━━━━━━━━━━━━━━━━━ */}
      <section>
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>
          🧠 {devMode ? "Feature Builder" : "Feature Simulator"}
        </div>
        <div style={{ fontSize: 12, color: "#555", marginBottom: 14 }}>
          {devMode
            ? "Describe a feature → AI generates a plan → you apply it to Apex in one click"
            : "Describe a feature → AI plans it → preview what would be built (no code changes)"}
        </div>

        <div style={{
          background: CARD, borderRadius: 16, border: `1px solid ${BORDER}`,
          padding: 16, display: "flex", flexDirection: "column", gap: 12,
        }}>
          {/* Quick examples */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {EXAMPLES.map((ex) => (
              <button
                key={ex.label}
                onClick={() => setPrompt(ex.prompt)}
                style={{
                  padding: "5px 12px", borderRadius: 20,
                  border: "1px solid rgba(162,155,254,0.28)",
                  background: "rgba(108,92,231,0.10)",
                  color: "#A29BFE", fontSize: 11, fontWeight: 600,
                  cursor: "pointer",
                }}
              >{ex.label}</button>
            ))}
          </div>

          {/* Prompt textarea */}
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generatePlan(); }}
            placeholder='e.g. "add particle effects when the player jumps" or "create a leaderboard"'
            rows={3}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: `1px solid ${BORDER}`, borderRadius: 12,
              color: "#fff", padding: "10px 14px", fontSize: 14,
              resize: "vertical", outline: "none", fontFamily: "inherit", lineHeight: 1.5,
            }}
          />

          <button
            onClick={generatePlan}
            disabled={planning || !prompt.trim()}
            style={{
              padding: "12px", borderRadius: 12, border: "none",
              background: planning || !prompt.trim() ? "rgba(255,255,255,0.06)" : GRAD,
              color:      planning || !prompt.trim() ? "#555" : "#fff",
              fontWeight: 700, fontSize: 15,
              cursor: planning || !prompt.trim() ? "not-allowed" : "pointer",
              transition: "all 0.2s",
            }}
          >
            {planning ? "⚙️ Planning feature…" : "🧠 Generate Feature Plan"}
          </button>

          {planError && (
            <div style={{ fontSize: 12, color: "#FF6B6B" }}>{planError}</div>
          )}

          {/* ── Planning skeleton ── */}
          {planning && (
            <div style={{
              borderRadius: 12, border: "1px solid rgba(108,92,231,0.25)",
              background: "rgba(108,92,231,0.05)", padding: "18px 16px",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
              animation: "apex-fade-in 0.25s ease",
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 11,
                background: GRAD,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
              }}>🤖</div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontWeight: 700, color: "#A29BFE", fontSize: 14, marginBottom: 3 }}>
                  {devMode ? "Architecting feature…" : "Simulating feature…"}
                </div>
                <div style={{ fontSize: 12, color: "#555" }}>
                  AI is analyzing the codebase and generating a plan
                </div>
              </div>
              <div style={{ width: "100%", height: 3, borderRadius: 2, background: "rgba(108,92,231,0.12)", overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  background: GRAD,
                  animation: "apex-scan 1.5s linear infinite",
                }} />
              </div>
            </div>
          )}

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━ FEATURE PLAN ━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {plan && !planning && (
            <div style={{
              borderRadius: 14,
              border: "1px solid rgba(108,92,231,0.35)",
              background: "rgba(108,92,231,0.06)",
              padding: 16, display: "flex", flexDirection: "column", gap: 14,
              animation: "apex-fade-in 0.3s ease",
            }}>

              {planOffline && (
                <div style={{ fontSize: 11, color: "#888", padding: "4px 10px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}` }}>
                  ⚡ Offline plan — AI unavailable. This is a placeholder.
                </div>
              )}

              {/* Plan header */}
              <div>
                <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 6 }}>
                  ✅ {plan.feature}
                </div>
                <div style={{ fontSize: 13, color: "#AAA", lineHeight: 1.55, marginBottom: 8 }}>
                  {plan.description}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Tag>
                    <span style={{ color: COMPLEXITY_COLOR[plan.complexity] ?? "#fff" }}>
                      ⚡ {plan.complexity}
                    </span>
                  </Tag>
                  <Tag>{plan.type}</Tag>
                  <Tag>~{plan.estimatedLines ?? "?"} lines</Tag>
                </div>
              </div>

              {/* User value */}
              {plan.userValue && (
                <div style={{
                  fontSize: 12, color: "#10B981",
                  padding: "8px 12px", borderRadius: 10,
                  background: "rgba(16,185,129,0.07)",
                  border: "1px solid rgba(16,185,129,0.15)",
                }}>
                  💚 {plan.userValue}
                </div>
              )}

              {/* Files affected */}
              {plan.files?.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, color: "#666", marginBottom: 8, fontWeight: 700 }}>
                    📁 FILES TO CHANGE ({plan.files.length})
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {plan.files.map((file, i) => (
                      <div
                        key={i}
                        style={{
                          borderRadius: 10,
                          background: "rgba(255,255,255,0.03)",
                          border: `1px solid ${BORDER}`,
                          padding: "10px 12px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: "2px 7px",
                            borderRadius: 6,
                            background: file.action === "create"
                              ? "rgba(16,185,129,0.15)"
                              : "rgba(108,92,231,0.15)",
                            color: file.action === "create" ? "#10B981" : "#A29BFE",
                          }}>
                            {file.action === "create" ? "+ CREATE" : "~ MODIFY"}
                          </span>
                          <span style={{ fontSize: 11, color: "#888", fontFamily: "monospace", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {file.path}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: "#666", marginBottom: file.code ? 8 : 0 }}>
                          {file.description}
                        </div>
                        {file.code && (
                          <button
                            onClick={() => setViewCodeIdx(viewCodeIdx === i ? null : i)}
                            style={{
                              background: "none", border: `1px solid ${BORDER}`,
                              borderRadius: 6, color: "#666", fontSize: 11,
                              padding: "3px 9px", cursor: "pointer",
                            }}
                          >
                            {viewCodeIdx === i ? "▲ Hide code" : "{ } View code"}
                          </button>
                        )}
                        {viewCodeIdx === i && file.code && (
                          <pre style={{
                            marginTop: 8, fontSize: 10, color: "#A29BFE",
                            background: "rgba(0,0,0,0.50)", borderRadius: 8,
                            padding: "10px 12px", overflowX: "auto", maxHeight: 280,
                            lineHeight: 1.65, fontFamily: "monospace",
                          }}>
                            {file.code}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Risks */}
              {plan.risks?.length > 0 && (
                <div style={{
                  fontSize: 12, color: "#888",
                  padding: "8px 12px", borderRadius: 10,
                  background: "rgba(255,107,107,0.05)",
                  border: "1px solid rgba(255,107,107,0.12)",
                }}>
                  ⚠️ {plan.risks.join(" · ")}
                </div>
              )}

              {/* ── Action buttons ── */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

                {/* DEV: Apply to Apex */}
                {devMode && (
                  <button
                    onClick={applyPlan}
                    disabled={applying || !plan.files?.length}
                    style={{
                      padding: "12px", borderRadius: 12, border: "none",
                      background: applying ? "rgba(255,255,255,0.06)" : `linear-gradient(135deg,${GOLD},#ffaa00)`,
                      color: applying ? "#555" : "#000",
                      fontWeight: 800, fontSize: 14,
                      cursor: applying ? "not-allowed" : "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    {applying ? "⚙️ Applying changes…" : "🚀 Apply to Apex (Dev)"}
                  </button>
                )}

                {/* USER: Build as extension */}
                {!devMode && plan.userExtension && (
                  <div style={{
                    borderRadius: 12, background: "rgba(16,185,129,0.07)",
                    border: "1px solid rgba(16,185,129,0.18)", padding: 12,
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#10B981", marginBottom: 4 }}>
                      🎮 Build as User Extension
                    </div>
                    <div style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>
                      This feature would be added to your personal content — no code changes required.
                    </div>
                    <div style={{
                      fontSize: 11, color: "#555",
                      padding: "6px 10px", borderRadius: 8,
                      background: "rgba(0,0,0,0.30)",
                      fontFamily: "monospace", whiteSpace: "pre-wrap",
                    }}>
                      {JSON.stringify(plan.userExtension.config, null, 2)}
                    </div>
                  </div>
                )}

                {/* USER: Not dev — explain limitation */}
                {!devMode && (
                  <div style={{
                    fontSize: 12, color: "#555", textAlign: "center",
                    padding: "8px 0",
                  }}>
                    🔐 Activate developer mode to apply this feature to the Apex codebase
                  </div>
                )}
              </div>

              {/* ── Build log (after apply) ── */}
              {buildLog.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: "#555", fontWeight: 700, marginBottom: 6 }}>BUILD LOG</div>
                  <div style={{
                    background: "rgba(0,0,0,0.55)", borderRadius: 10,
                    padding: "10px 12px", fontFamily: "monospace",
                    fontSize: 11, lineHeight: 1.9, color: "#A29BFE",
                    maxHeight: 200, overflowY: "auto",
                  }}>
                    {buildLog.map((line, i) => (
                      <div key={i}>{line}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* Apply results summary */}
              {applyResults && (
                <div style={{
                  padding: "8px 12px", borderRadius: 10,
                  background: applyResults.some(r => r.status === "error")
                    ? "rgba(255,107,107,0.08)"
                    : "rgba(16,185,129,0.08)",
                  border: `1px solid ${applyResults.some(r => r.status === "error") ? "rgba(255,107,107,0.2)" : "rgba(16,185,129,0.2)"}`,
                  fontSize: 12,
                  color: applyResults.some(r => r.status === "error") ? "#FF6B6B" : "#10B981",
                }}>
                  {applyResults.some(r => r.status === "error")
                    ? `⚠️ ${applyResults.filter(r => r.status === "error").length} file(s) had errors`
                    : `✅ ${applyResults.length} file(s) applied — Vite HMR should hot-reload`
                  }
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ VERSION HISTORY (DEV) ━━━━━━━━━━ */}
      {devMode && (
        <section>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>
            📦 Version History
          </div>
          <div style={{ fontSize: 12, color: "#555", marginBottom: 12 }}>
            Snapshots are created automatically before each apply — roll back in one click
          </div>

          {rollbackResult && (
            <div style={{
              marginBottom: 12, fontSize: 12,
              padding: "8px 12px", borderRadius: 10,
              background: "rgba(16,185,129,0.08)",
              border: "1px solid rgba(16,185,129,0.2)",
              color: "#10B981",
            }}>
              {rollbackResult}
            </div>
          )}

          <div style={{
            background: CARD, borderRadius: 16, border: `1px solid ${BORDER}`,
            overflow: "hidden",
          }}>
            {loadingSnapshots ? (
              <div style={{ padding: 20, textAlign: "center", color: "#555", fontSize: 13 }}>
                Loading snapshots…
              </div>
            ) : snapshots.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: "#444", fontSize: 13 }}>
                No snapshots yet — they'll appear here after your first apply
              </div>
            ) : (
              snapshots.map((snap, i) => (
                <div
                  key={snap.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 16px",
                    borderBottom: i < snapshots.length - 1 ? `1px solid ${BORDER}` : "none",
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: "rgba(108,92,231,0.12)",
                    border: "1px solid rgba(108,92,231,0.22)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18,
                  }}>📦</div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>
                      {snap.label}
                    </div>
                    <div style={{ fontSize: 11, color: "#555" }}>
                      {new Date(snap.timestamp).toLocaleString()} · {snap.files?.length ?? 0} file{(snap.files?.length ?? 0) !== 1 ? "s" : ""}
                    </div>
                  </div>

                  <button
                    onClick={() => rollback(snap.id)}
                    disabled={rollingBack === snap.id}
                    style={{
                      padding: "7px 14px", borderRadius: 9,
                      border: "1px solid rgba(108,92,231,0.30)",
                      background: rollingBack === snap.id
                        ? "rgba(255,255,255,0.04)"
                        : "rgba(108,92,231,0.10)",
                      color: rollingBack === snap.id ? "#444" : "#A29BFE",
                      fontWeight: 700, fontSize: 12,
                      cursor: rollingBack === snap.id ? "not-allowed" : "pointer",
                      flexShrink: 0,
                    }}
                  >
                    {rollingBack === snap.id ? "Rolling back…" : "↩ Rollback"}
                  </button>
                </div>
              ))
            )}
          </div>

          {snapshots.length > 0 && (
            <div style={{ fontSize: 11, color: "#444", marginTop: 8, textAlign: "center" }}>
              Snapshots are stored in <code style={{ color: "#555" }}>.apex-builder/snapshots/</code> · Max 10 kept
            </div>
          )}
        </section>
      )}

      {/* ── CSS keyframes injected once ── */}
      <style>{`
        @keyframes apex-scan {
          0%   { width: 0%;   margin-left: 0% }
          50%  { width: 55%;  margin-left: 22% }
          100% { width: 0%;   margin-left: 100% }
        }
        @keyframes apex-fade-in {
          from { opacity: 0; transform: translateY(8px) }
          to   { opacity: 1; transform: translateY(0) }
        }
      `}</style>

      </>}
    </div>
  );
}

// ── Shared mini Tag component ──────────────────────────────────────────────
function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      padding: "3px 10px", borderRadius: 20,
      fontSize: 11, fontWeight: 600,
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.08)",
      color: "#888",
    }}>{children}</span>
  );
}
