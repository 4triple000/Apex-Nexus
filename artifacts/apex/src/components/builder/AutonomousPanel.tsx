import { useState, useEffect, useRef, useCallback } from "react";
import { authHeaders } from "@/lib/authSession";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const api  = (p: string) => `${BASE}${p}`;

// ── Types ─────────────────────────────────────────────────────────────────────
type Phase =
  | "idle" | "observing" | "analyzing" | "building" | "testing" | "deploying";

interface SysStatus {
  running:              boolean;
  phase:                Phase;
  autoApply:            boolean;
  cycleIntervalMs:      number;
  consecutiveFails:     number;
  pendingSuggestions:   number;
  totalSuggestions:     number;
  cyclesRun:            number;
  lastCycle:            CycleRecord | null;
  metrics:              Metrics;
}

interface Metrics {
  totalEvents:    number;
  recentEvents:   number;
  activeSessions: number;
  errorCount:     number;
  gameSessions:   number;
  avgFps:         number | null;
  gameModes:      GameModeMetrics[];
}

interface GameModeMetrics {
  mode:           string;
  sessions:       number;
  wins:           number;
  losses:         number;
  avgFps:         number;
  avgDurationMs:  number;
}

interface Suggestion {
  id:             string;
  pattern:        { title: string; severity: string; class: string };
  plan:           { feature: string; description: string; files: Array<{ path: string }> };
  sandboxScore:   number;
  sandboxReason:  string;
  createdAt:      number;
  status:         "pending" | "applied" | "discarded";
  snapshotId?:    string;
}

interface CycleRecord {
  id:                  string;
  startedAt:           number;
  completedAt:         number;
  eventsProcessed:     number;
  patternsFound:       number;
  suggestionGenerated: boolean;
  deployed:            boolean;
  deployedFeature?:    string;
  error?:              string;
}

// ── Phase visuals ─────────────────────────────────────────────────────────────
const PHASE_META: Record<Phase, { icon: string; label: string; color: string }> = {
  idle:       { icon: "◉", label: "Idle",       color: "#636e72" },
  observing:  { icon: "👁", label: "Observing",  color: "#00cec9" },
  analyzing:  { icon: "🧠", label: "Analyzing",  color: "#6C5CE7" },
  building:   { icon: "🛠", label: "Building",   color: "#fdcb6e" },
  testing:    { icon: "🧪", label: "Testing",    color: "#e17055" },
  deploying:  { icon: "🚀", label: "Deploying",  color: "#00b894" },
};

const SEV_COLOR: Record<string, string> = {
  critical: "#ff4757",
  high:     "#ff6b81",
  medium:   "#fdcb6e",
  low:      "#00cec9",
};

// ── Main component ────────────────────────────────────────────────────────────
export default function AutonomousPanel({ ownerMode = false }: { ownerMode?: boolean }) {
  const [status, setStatus]         = useState<SysStatus | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [history, setHistory]       = useState<CycleRecord[]>([]);
  const [loading, setLoading]       = useState(false);
  const [log, setLog]               = useState<string[]>([]);
  const [autoApplyEnabled, setAutoApplyEnabled] = useState(false);
  const [cycleIntervalMin, setCycleIntervalMin] = useState(10);
  const [expandedSugg, setExpandedSugg]     = useState<string | null>(null);
  const [activeTab, setActiveTab]   = useState<"monitor" | "suggestions" | "history" | "control">("monitor");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((msg: string) => {
    setLog((prev) => [...prev.slice(-39), `${new Date().toLocaleTimeString()} ${msg}`]);
  }, []);

  // ── Polling ───────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      const [sRes, sgRes, hRes] = await Promise.all([
        fetch(api("/api/autonomous/status")),
        fetch(api("/api/autonomous/suggestions")),
        fetch(api("/api/autonomous/history")),
      ]);
      if (sRes.ok) {
        const data = await sRes.json() as SysStatus;
        setStatus(data);
      }
      if (sgRes.ok) {
        const data = await sgRes.json() as { suggestions: Suggestion[] };
        setSuggestions(data.suggestions ?? []);
      }
      if (hRes.ok) {
        const data = await hRes.json() as { history: CycleRecord[] };
        setHistory(data.history ?? []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchAll();
    pollRef.current = setInterval(fetchAll, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchAll]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const startSystem = async () => {
    setLoading(true);
    try {
      const res = await fetch(api("/api/autonomous/start"), {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body:    JSON.stringify({
          intervalMs:  cycleIntervalMin * 60_000,
          autoApply:   autoApplyEnabled,
        }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (data.ok) addLog("✅ Autonomous system started");
      else addLog(`❌ Error: ${data.error ?? "Unknown"}`);
      await fetchAll();
    } finally { setLoading(false); }
  };

  const pauseSystem = async () => {
    await fetch(api("/api/autonomous/pause"), { method: "POST" });
    addLog("⏸ System paused");
    await fetchAll();
  };

  const triggerCycle = async () => {
    setLoading(true);
    addLog("⚡ Manual cycle triggered…");
    try {
      const res = await fetch(api("/api/autonomous/cycle"), {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body:    JSON.stringify({ autoApply: ownerMode }),
      });
      const data = await res.json() as { record?: CycleRecord; error?: string };
      if (data.record) {
        addLog(`✅ Cycle done — ${data.record.patternsFound} patterns, deployed: ${data.record.deployed}`);
      } else {
        addLog(`❌ ${data.error ?? "Cycle error"}`);
      }
      await fetchAll();
    } finally { setLoading(false); }
  };

  const applySuggestion = async (id: string) => {
    if (!ownerMode) { addLog("❌ Only the app owner can apply changes"); return; }
    setLoading(true);
    try {
      const res = await fetch(api(`/api/autonomous/apply/${id}`), {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
      });
      const data = await res.json() as { ok?: boolean; snapshotId?: string; error?: string };
      if (data.ok) addLog(`🚀 Applied! Snapshot: ${data.snapshotId}`);
      else addLog(`❌ ${data.error}`);
      await fetchAll();
    } finally { setLoading(false); }
  };

  const discardSuggestion = async (id: string) => {
    await fetch(api(`/api/autonomous/discard/${id}`), { method: "POST" });
    addLog("🗑 Suggestion discarded");
    await fetchAll();
  };

  // ── Render helpers ────────────────────────────────────────────────────────
  const phaseMeta = PHASE_META[status?.phase ?? "idle"];

  const scoreBar = (score: number) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{
        flex: 1, height: 6, background: "#2d3436", borderRadius: 3, overflow: "hidden",
      }}>
        <div style={{
          height: "100%",
          width:  `${Math.round(score * 100)}%`,
          background: score >= 0.7 ? "#00b894" : score >= 0.5 ? "#fdcb6e" : "#e17055",
          borderRadius: 3,
          transition: "width 0.4s ease",
        }} />
      </div>
      <span style={{ fontSize: 11, color: "#b2bec3", minWidth: 30 }}>
        {Math.round(score * 100)}%
      </span>
    </div>
  );

  return (
    <div style={{
      fontFamily:  "'SF Pro Display', -apple-system, sans-serif",
      background:  "transparent",
      borderRadius: 16,
      border:       "1px solid #1e1f2e",
      overflow:     "hidden",
      minHeight:    400,
    }}>
      {/* ── Header ── */}
      <div style={{
        background:  "linear-gradient(135deg, #0d0e1a 0%, #12132a 100%)",
        borderBottom: "1px solid #1e2035",
        padding:      "16px 20px",
        display:      "flex",
        alignItems:   "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "linear-gradient(135deg, #6C5CE7, #A29BFE)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18,
          }}>🤖</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>
              Apex Autonomous System
              <span style={{
                marginLeft: 8, fontSize: 10, fontWeight: 600, letterSpacing: 1,
                background: "rgba(30,26,62,0.62)", color: "#A29BFE", padding: "2px 8px", borderRadius: 10,
              }}>v1</span>
            </div>
            <div style={{ fontSize: 11, color: "#636e72" }}>
              Self-Observing · Self-Improving · Continuous Evolution
            </div>
          </div>
        </div>

        {/* Phase indicator */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "rgba(30,26,62,0.62)", border: "1px solid #1e2035",
          borderRadius: 20, padding: "6px 14px",
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: phaseMeta.color,
            boxShadow: status?.running ? `0 0 8px ${phaseMeta.color}` : "none",
            animation: status?.running && status.phase !== "idle" ? "pulse 1.2s ease infinite" : "none",
          }} />
          <span style={{ fontSize: 12, color: phaseMeta.color, fontWeight: 600 }}>
            {phaseMeta.icon} {phaseMeta.label}
          </span>
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div style={{
        display: "flex", borderBottom: "1px solid #1e1f2e",
        background: "transparent",
      }}>
        {(["monitor", "suggestions", "history", "control"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            flex: 1, padding: "10px 0", background: "none", border: "none",
            borderBottom: activeTab === tab ? "2px solid #6C5CE7" : "2px solid transparent",
            color:        activeTab === tab ? "#A29BFE" : "#636e72",
            fontSize:     12, fontWeight: 600, cursor: "pointer", letterSpacing: 0.5,
            textTransform: "uppercase", transition: "all 0.2s",
          }}>
            {{ monitor: "📊 Monitor", suggestions: `🧠 Suggestions${suggestions.filter((s) => s.status === "pending").length ? ` (${suggestions.filter((s) => s.status === "pending").length})` : ""}`, history: "📜 History", control: "⚙ Control" }[tab]}
          </button>
        ))}
      </div>

      <div style={{ padding: 16 }}>

        {/* ─── MONITOR TAB ─────────────────────────────────────────────────── */}
        {activeTab === "monitor" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Cycle pipeline visualization */}
            <div style={{
              background: "rgba(30,26,62,0.62)", border: "1px solid #1e2035",
              borderRadius: 12, padding: 14,
            }}>
              <div style={{ fontSize: 11, color: "#636e72", marginBottom: 10, fontWeight: 600, letterSpacing: 1 }}>
                AUTONOMOUS CYCLE
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {(["observing", "analyzing", "building", "testing", "deploying"] as Phase[]).map((p, i) => {
                  const meta    = PHASE_META[p];
                  const active  = status?.phase === p;
                  const done    = false; // can track completed phases later
                  return (
                    <div key={p} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                      <div style={{
                        flex: 1, textAlign: "center",
                        background: active ? `${meta.color}22` : "#12132a",
                        border:     `1px solid ${active ? meta.color : "#1e2035"}`,
                        borderRadius: 8, padding: "6px 4px",
                        transition: "all 0.3s",
                      }}>
                        <div style={{ fontSize: 16 }}>{meta.icon}</div>
                        <div style={{ fontSize: 9, color: active ? meta.color : "#2d3436", fontWeight: 600, marginTop: 2 }}>
                          {meta.label.toUpperCase()}
                        </div>
                      </div>
                      {i < 4 && (
                        <div style={{ fontSize: 10, color: "#2d3436", margin: "0 2px" }}>›</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Metric cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {[
                { label: "Events (24h)",    value: status?.metrics.recentEvents ?? 0,    icon: "📡", color: "#6C5CE7" },
                { label: "Active Sessions", value: status?.metrics.activeSessions ?? 0,  icon: "👤", color: "#00cec9" },
                { label: "Game Sessions",   value: status?.metrics.gameSessions ?? 0,    icon: "🎮", color: "#A29BFE" },
                { label: "Avg FPS",         value: status?.metrics.avgFps ?? "—",        icon: "⚡", color: "#fdcb6e" },
                { label: "Errors (1h)",     value: status?.metrics.errorCount ?? 0,      icon: "⚠", color: "#e17055" },
                { label: "Cycles Run",      value: status?.cyclesRun ?? 0,               icon: "🔁", color: "#00b894" },
              ].map(({ label, value, icon, color }) => (
                <div key={label} style={{
                  background: "rgba(30,26,62,0.62)", border: "1px solid #1e2035",
                  borderRadius: 10, padding: "10px 12px",
                }}>
                  <div style={{ fontSize: 11, color: "#636e72", marginBottom: 4 }}>{icon} {label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Game mode breakdown */}
            {(status?.metrics.gameModes ?? []).length > 0 && (
              <div style={{
                background: "rgba(30,26,62,0.62)", border: "1px solid #1e2035",
                borderRadius: 12, padding: 14,
              }}>
                <div style={{ fontSize: 11, color: "#636e72", marginBottom: 10, fontWeight: 600, letterSpacing: 1 }}>
                  🎮 GAME MODE METRICS
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {(status!.metrics.gameModes).slice(0, 5).map((m) => (
                    <div key={m.mode} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      background: "rgba(30,26,62,0.62)", borderRadius: 8, padding: "8px 12px",
                    }}>
                      <span style={{ fontSize: 12, color: "#A29BFE", fontWeight: 600, minWidth: 90 }}>
                        {m.mode}
                      </span>
                      <span style={{ fontSize: 11, color: "#636e72" }}>{m.sessions}s</span>
                      <span style={{ fontSize: 11, color: m.avgFps < 30 ? "#e17055" : "#00b894" }}>
                        {m.avgFps > 0 ? `${m.avgFps} fps` : "—"}
                      </span>
                      <span style={{ fontSize: 11, color: "#636e72", marginLeft: "auto" }}>
                        {m.wins}W / {m.losses}L
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Activity log */}
            <div style={{
              background: "transparent", border: "1px solid #1e2035",
              borderRadius: 10, padding: 12, maxHeight: 140, overflowY: "auto",
            }}>
              <div style={{ fontSize: 11, color: "#636e72", marginBottom: 8, fontWeight: 600, letterSpacing: 1 }}>
                ACTIVITY LOG
              </div>
              {log.length === 0 ? (
                <div style={{ fontSize: 11, color: "#2d3436" }}>No activity yet…</div>
              ) : (
                log.map((line, i) => (
                  <div key={i} style={{ fontSize: 11, color: "#b2bec3", lineHeight: "1.8" }}>{line}</div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </div>
        )}

        {/* ─── SUGGESTIONS TAB ─────────────────────────────────────────────── */}
        {activeTab === "suggestions" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {suggestions.length === 0 ? (
              <div style={{
                textAlign: "center", padding: "40px 20px",
                color: "#636e72", fontSize: 13,
              }}>
                🧠 No suggestions yet.<br/>
                <span style={{ fontSize: 11, color: "#2d3436" }}>Run a cycle to generate improvement suggestions.</span>
              </div>
            ) : suggestions.map((s) => (
              <div key={s.id} style={{
                background: "rgba(30,26,62,0.62)", border: `1px solid ${s.status === "applied" ? "#00b89444" : s.status === "discarded" ? "#2d343644" : "#1e2035"}`,
                borderRadius: 12, overflow: "hidden",
              }}>
                <div
                  onClick={() => setExpandedSugg(expandedSugg === s.id ? null : s.id)}
                  style={{ padding: "12px 14px", cursor: "pointer" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: 1, padding: "2px 8px",
                      borderRadius: 10, background: `${SEV_COLOR[s.pattern.severity] ?? "#636e72"}22`,
                      color: SEV_COLOR[s.pattern.severity] ?? "#636e72",
                    }}>
                      {s.pattern.severity.toUpperCase()}
                    </span>
                    <span style={{
                      fontSize: 10, color: "#636e72",
                      marginLeft: "auto",
                    }}>
                      {s.status === "applied"   ? "✅ Applied"   :
                       s.status === "discarded" ? "🗑 Discarded" : "⏳ Pending"}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#dfe6e9", marginBottom: 4 }}>
                    {s.plan.feature}
                  </div>
                  <div style={{ fontSize: 11, color: "#636e72", marginBottom: 8 }}>
                    {s.plan.description}
                  </div>
                  {scoreBar(s.sandboxScore)}
                </div>

                {expandedSugg === s.id && (
                  <div style={{
                    borderTop: "1px solid #1e2035", padding: "12px 14px",
                    background: "transparent",
                  }}>
                    <div style={{ fontSize: 11, color: "#636e72", marginBottom: 6 }}>
                      Pattern: <span style={{ color: "#A29BFE" }}>{s.pattern.title}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#636e72", marginBottom: 6 }}>
                      Safety: <span style={{ color: "#b2bec3" }}>{s.sandboxReason}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#636e72", marginBottom: 10 }}>
                      Files: {s.plan.files.map((f) => (
                        <span key={f.path} style={{
                          display: "inline-block", marginRight: 4, marginBottom: 4,
                          background: "rgba(30,26,62,0.62)", padding: "2px 8px", borderRadius: 6,
                          color: "#6C5CE7", fontSize: 10,
                        }}>{f.path.split("/").pop()}</span>
                      ))}
                    </div>
                    {s.status === "pending" && ownerMode && (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => applySuggestion(s.id)} disabled={loading} style={{
                          flex: 1, padding: "8px", borderRadius: 8, border: "none",
                          background: "linear-gradient(135deg, #00b894, #00cec9)",
                          color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
                        }}>
                          🚀 Apply to Apex
                        </button>
                        <button onClick={() => discardSuggestion(s.id)} style={{
                          padding: "8px 14px", borderRadius: 8, border: "1px solid #2d3436",
                          background: "none", color: "#636e72", fontSize: 12, cursor: "pointer",
                        }}>
                          🗑 Discard
                        </button>
                      </div>
                    )}
                    {s.status === "applied" && s.snapshotId && (
                      <div style={{ fontSize: 11, color: "#00b894" }}>
                        ✅ Applied · Snapshot: {s.snapshotId}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ─── HISTORY TAB ──────────────────────────────────────────────────── */}
        {activeTab === "history" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {history.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#636e72", fontSize: 13 }}>
                🔁 No cycles run yet.
              </div>
            ) : history.map((c) => (
              <div key={c.id} style={{
                background: "rgba(30,26,62,0.62)", border: `1px solid ${c.error ? "#e1705533" : c.deployed ? "#00b89433" : "#1e2035"}`,
                borderRadius: 10, padding: "12px 14px",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: c.error ? "#e17055" : c.deployed ? "#00b894" : "#dfe6e9" }}>
                    {c.error ? "❌ Failed" : c.deployed ? `🚀 Deployed: ${c.deployedFeature}` : "✓ Completed"}
                  </div>
                  <div style={{ fontSize: 10, color: "#636e72" }}>
                    {new Date(c.startedAt).toLocaleTimeString()}
                    {" · "}
                    {Math.round((c.completedAt - c.startedAt) / 1000)}s
                  </div>
                </div>
                <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#636e72" }}>
                  <span>📡 {c.eventsProcessed} events</span>
                  <span>🔍 {c.patternsFound} patterns</span>
                  <span>{c.suggestionGenerated ? "🧠 Built" : "—"}</span>
                </div>
                {c.error && (
                  <div style={{ marginTop: 6, fontSize: 11, color: "#e17055" }}>{c.error}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ─── CONTROL TAB ──────────────────────────────────────────────────── */}
        {activeTab === "control" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Status banner */}
            <div style={{
              background: status?.running ? "#00b89415" : "#e1705515",
              border: `1px solid ${status?.running ? "#00b89433" : "#e1705533"}`,
              borderRadius: 10, padding: "10px 14px",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <div style={{
                width: 10, height: 10, borderRadius: "50%",
                background: status?.running ? "#00b894" : "#e17055",
                boxShadow: status?.running ? "0 0 8px #00b894" : "none",
              }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: status?.running ? "#00b894" : "#e17055" }}>
                {status?.running ? "System Running" : "System Paused"}
              </span>
              {status?.autoApply && (
                <span style={{
                  marginLeft: "auto", fontSize: 10, fontWeight: 700, letterSpacing: 1,
                  background: "#fdcb6e22", color: "#fdcb6e", padding: "2px 8px", borderRadius: 10,
                }}>
                  AUTO-APPLY ON
                </span>
              )}
            </div>

            {/* Interval control */}
            <div style={{ background: "rgba(30,26,62,0.62)", border: "1px solid #1e2035", borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 11, color: "#636e72", marginBottom: 8, fontWeight: 600, letterSpacing: 1 }}>
                CYCLE INTERVAL
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {[5, 10, 15, 30].map((m) => (
                  <button key={m} onClick={() => setCycleIntervalMin(m)} style={{
                    flex: 1, padding: "8px 0", borderRadius: 8,
                    border: `1px solid ${cycleIntervalMin === m ? "#6C5CE7" : "#1e2035"}`,
                    background: cycleIntervalMin === m ? "#6C5CE722" : "none",
                    color: cycleIntervalMin === m ? "#A29BFE" : "#636e72",
                    fontSize: 12, fontWeight: 600, cursor: "pointer",
                  }}>{m}m</button>
                ))}
              </div>
            </div>

            {/* Auto-apply toggle */}
            {ownerMode && (
              <div style={{
                background: "rgba(30,26,62,0.62)", border: "1px solid #1e2035",
                borderRadius: 10, padding: 14,
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#dfe6e9" }}>Auto-Apply Changes</div>
                  <div style={{ fontSize: 11, color: "#636e72", marginTop: 2 }}>
                    Automatically deploy approved suggestions (requires dev key)
                  </div>
                </div>
                <div
                  onClick={() => setAutoApplyEnabled((v) => !v)}
                  style={{
                    width: 44, height: 24, borderRadius: 12,
                    background: autoApplyEnabled ? "#6C5CE7" : "#2d3436",
                    position: "relative", cursor: "pointer", transition: "background 0.3s",
                  }}
                >
                  <div style={{
                    position: "absolute", top: 3, left: autoApplyEnabled ? 22 : 3,
                    width: 18, height: 18, borderRadius: "50%", background: "#fff",
                    transition: "left 0.3s",
                  }} />
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={startSystem} disabled={loading || status?.running} style={{
                  flex: 1, padding: "12px", borderRadius: 10, border: "none",
                  background: status?.running
                    ? "#2d3436"
                    : "linear-gradient(135deg, #6C5CE7, #A29BFE)",
                  color: status?.running ? "#636e72" : "#fff",
                  fontSize: 13, fontWeight: 700, cursor: status?.running ? "not-allowed" : "pointer",
                }}>
                  ▶ Start System
                </button>
                <button onClick={pauseSystem} disabled={loading || !status?.running} style={{
                  flex: 1, padding: "12px", borderRadius: 10,
                  border: `1px solid ${!status?.running ? "transparent" : "#e1705533"}`,
                  background: !status?.running ? "#2d3436" : "#e1705522",
                  color: !status?.running ? "#636e72" : "#e17055",
                  fontSize: 13, fontWeight: 700, cursor: !status?.running ? "not-allowed" : "pointer",
                }}>
                  ⏸ Pause
                </button>
              </div>

              <button onClick={triggerCycle} disabled={loading} style={{
                width: "100%", padding: "11px", borderRadius: 10,
                border: "1px solid #6C5CE733",
                background: "#6C5CE722", color: "#A29BFE",
                fontSize: 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
              }}>
                ⚡ {loading ? "Running cycle…" : "Trigger Manual Cycle"}
              </button>
            </div>

            {/* Safety summary */}
            <div style={{
              background: "rgba(30,26,62,0.62)", border: "1px solid #1e2035",
              borderRadius: 10, padding: 14, fontSize: 11, color: "#636e72",
              lineHeight: 1.8,
            }}>
              <div style={{ fontWeight: 700, color: "#dfe6e9", marginBottom: 6 }}>🔐 Safety Layer</div>
              <div>• Snapshot created before every auto-deploy</div>
              <div>• Minimum sandbox score: 70% required</div>
              <div>• Max 1 code change per cycle</div>
              <div>• Auto-pause after 3 consecutive failures</div>
              <div>• Core engine files are permanently protected</div>
              {status?.consecutiveFails ? (
                <div style={{ color: "#e17055", marginTop: 4 }}>
                  ⚠ {status.consecutiveFails} consecutive failure(s)
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
