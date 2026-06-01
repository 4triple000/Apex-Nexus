/**
 * Orchestrator Agent Dashboard
 * Real-time view of the autonomous multi-agent system:
 *   observe → decide → assign → validate → deploy
 */
import { useState, useEffect, useRef, useCallback } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const api  = (p: string) => `${BASE}${p}`;

// ── Types ─────────────────────────────────────────────────────────────────────
type Phase = "idle" | "observing" | "deciding" | "assigning" | "validating" | "deploying";
type TaskStatus = "pending" | "assigned" | "running" | "validating" | "approved" | "rejected" | "deployed" | "failed";

interface OrchestratorStatus {
  running:          boolean;
  phase:            Phase;
  autoApply:        boolean;
  intervalMs:       number;
  consecutiveFails: number;
  cyclesRun:        number;
  tasksTotal:       number;
  tasksPending:     number;
  tasksApproved:    number;
  tasksDeployed:    number;
  tasksRejected:    number;
  lastCycle:        OrchestratorCycle | null;
}

interface OrchestratorTask {
  id:              string;
  cycleId:         string;
  type:            string;
  priority:        "critical" | "high" | "medium" | "low";
  title:           string;
  description:     string;
  context:         string;
  assignedAgent:   string;
  agentIcon:       string;
  status:          TaskStatus;
  agentOutput?:    string;
  validationScore?: number;
  validationReason?: string;
  approvedBy?:     "auto" | "admin";
  createdAt:       number;
  completedAt?:    number;
}

interface OrchestratorCycle {
  id:              string;
  startedAt:       number;
  completedAt:     number;
  tasksGenerated:  number;
  tasksApproved:   number;
  tasksDeployed:   number;
  tasksRejected:   number;
  observation:     string;
  error?:          string;
}

// ── Visual mappings ───────────────────────────────────────────────────────────
const PHASE_META: Record<Phase, { icon: string; label: string; color: string }> = {
  idle:       { icon: "◉",  label: "Idle",       color: "#636e72" },
  observing:  { icon: "👁", label: "Observing",   color: "#00cec9" },
  deciding:   { icon: "🧠", label: "Deciding",    color: "#A29BFE" },
  assigning:  { icon: "🤖", label: "Assigning",   color: "#6C5CE7" },
  validating: { icon: "🧪", label: "Validating",  color: "#fdcb6e" },
  deploying:  { icon: "🚀", label: "Deploying",   color: "#00b894" },
};

const PRIORITY_COLOR: Record<string, string> = {
  critical: "#ff4757",
  high:     "#ff6b81",
  medium:   "#fdcb6e",
  low:      "#00cec9",
};

const STATUS_META: Record<TaskStatus, { icon: string; color: string; label: string }> = {
  pending:    { icon: "⏳", color: "#636e72", label: "Pending"    },
  assigned:   { icon: "📋", color: "#A29BFE", label: "Assigned"   },
  running:    { icon: "⚙",  color: "#fdcb6e", label: "Running"    },
  validating: { icon: "🧪", color: "#e17055", label: "Validating" },
  approved:   { icon: "✅", color: "#00b894", label: "Approved"   },
  rejected:   { icon: "❌", color: "#e17055", label: "Rejected"   },
  deployed:   { icon: "🚀", color: "#00cec9", label: "Deployed"   },
  failed:     { icon: "💥", color: "#ff4757", label: "Failed"     },
};

const AGENT_COLORS: Record<string, string> = {
  builder:   "#6C5CE7",
  debug:     "#e17055",
  ui:        "#fd79a8",
  optimizer: "#fdcb6e",
  product:   "#00b894",
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function OrchestratorPanel() {
  const [status,     setStatus]      = useState<OrchestratorStatus | null>(null);
  const [tasks,      setTasks]       = useState<OrchestratorTask[]>([]);
  const [cycles,     setCycles]      = useState<OrchestratorCycle[]>([]);
  const [activeTab,  setActiveTab]   = useState<"mission" | "tasks" | "history" | "control">("mission");
  const [expanded,   setExpanded]    = useState<string | null>(null);
  const [loading,    setLoading]     = useState(false);
  const [log,        setLog]         = useState<string[]>([]);
  const [autoApply,  setAutoApply]   = useState(false);
  const [intervalMin, setIntervalMin] = useState(15);
  const logEndRef = useRef<HTMLDivElement>(null);
  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  const addLog = useCallback((msg: string) => {
    setLog((p) => [...p.slice(-39), `${new Date().toLocaleTimeString()} ${msg}`]);
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const [sRes, tRes, hRes] = await Promise.all([
        fetch(api("/api/agents/orchestrator/status")),
        fetch(api("/api/agents/orchestrator/tasks?limit=30")),
        fetch(api("/api/agents/orchestrator/history")),
      ]);
      if (sRes.ok) setStatus(await sRes.json() as OrchestratorStatus);
      if (tRes.ok) { const d = await tRes.json() as { tasks: OrchestratorTask[] }; setTasks(d.tasks ?? []); }
      if (hRes.ok) { const d = await hRes.json() as { cycles: OrchestratorCycle[] }; setCycles(d.cycles ?? []); }
    } catch { /* non-fatal */ }
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
      const res = await fetch(api("/api/agents/orchestrator/start"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intervalMs: intervalMin * 60_000, autoApply }),
      });
      const d = await res.json() as { ok?: boolean; error?: string };
      if (d.ok) addLog("✅ Orchestrator started");
      else addLog(`❌ ${d.error ?? "Error"}`);
      await fetchAll();
    } finally { setLoading(false); }
  };

  const pauseSystem = async () => {
    await fetch(api("/api/agents/orchestrator/pause"), { method: "POST" });
    addLog("⏸ Orchestrator paused");
    await fetchAll();
  };

  const triggerCycle = async () => {
    setLoading(true);
    addLog("⚡ Manual orchestrator cycle triggered…");
    try {
      const res = await fetch(api("/api/agents/orchestrator/cycle"), { method: "POST" });
      const d = await res.json() as { cycle?: OrchestratorCycle; error?: string };
      if (d.cycle) {
        addLog(`✅ Cycle done — ${d.cycle.tasksGenerated} tasks, ${d.cycle.tasksApproved} approved`);
      } else {
        addLog(`❌ ${d.error ?? "Cycle error"}`);
      }
      await fetchAll();
    } finally { setLoading(false); }
  };

  const approveTask = async (id: string) => {
    const res = await fetch(api(`/api/agents/orchestrator/approve/${id}`), { method: "POST" });
    const d = await res.json() as { ok?: boolean };
    if (d.ok) addLog("🚀 Task approved and deployed");
    await fetchAll();
  };

  const rejectTask = async (id: string) => {
    await fetch(api(`/api/agents/orchestrator/reject/${id}`), { method: "POST" });
    addLog("🗑 Task rejected");
    await fetchAll();
  };

  const retryTask = async (id: string) => {
    await fetch(api(`/api/agents/orchestrator/retry/${id}`), { method: "POST" });
    addLog("🔄 Task queued for retry");
    await fetchAll();
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const phaseMeta = PHASE_META[status?.phase ?? "idle"];

  const scoreBar = (score: number) => (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ flex: 1, height: 5, background: "#2d3436", borderRadius: 3, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${Math.round(score * 100)}%`,
          background: score >= 0.7 ? "#00b894" : score >= 0.5 ? "#fdcb6e" : "#e17055",
          borderRadius: 3, transition: "width 0.4s",
        }} />
      </div>
      <span style={{ fontSize: 10, color: "#b2bec3", minWidth: 28 }}>{Math.round(score * 100)}%</span>
    </div>
  );

  return (
    <div style={{
      fontFamily: "'SF Pro Display', -apple-system, sans-serif",
      background: "#0a0b0f", borderRadius: 16,
      border: "1px solid #1e1f2e", overflow: "hidden",
    }}>
      {/* ── Header ── */}
      <div style={{
        background: "linear-gradient(135deg, #0d0e1a, #12132a)",
        borderBottom: "1px solid #1e2035", padding: "16px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            background: "linear-gradient(135deg, #6C5CE7, #A29BFE, #FD79A8)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
          }}>🧠</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", letterSpacing: -0.3 }}>
              Orchestrator Agent
              <span style={{ marginLeft: 8, fontSize: 9, fontWeight: 700, letterSpacing: 1.2,
                background: "#1e2035", color: "#6C5CE7", padding: "2px 7px", borderRadius: 10,
              }}>MASTER AI</span>
            </div>
            <div style={{ fontSize: 11, color: "#636e72" }}>
              Autonomous · Multi-Agent · Self-Directing
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Stats pills */}
          {[
            { v: status?.tasksDeployed ?? 0, label: "Deployed", c: "#00b894" },
            { v: status?.tasksApproved ?? 0, label: "Approved", c: "#A29BFE" },
            { v: status?.tasksRejected ?? 0, label: "Rejected", c: "#e17055" },
          ].map(({ v, label, c }) => (
            <div key={label} style={{
              background: "#0f1020", border: "1px solid #1e2035",
              borderRadius: 20, padding: "4px 12px", textAlign: "center",
            }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: c }}>{v}</div>
              <div style={{ fontSize: 9, color: "#636e72", letterSpacing: 0.5 }}>{label.toUpperCase()}</div>
            </div>
          ))}

          {/* Phase indicator */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "#0f1020", border: "1px solid #1e2035",
            borderRadius: 20, padding: "6px 14px",
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%", background: phaseMeta.color,
              boxShadow: status?.running ? `0 0 8px ${phaseMeta.color}` : "none",
            }} />
            <span style={{ fontSize: 12, color: phaseMeta.color, fontWeight: 700 }}>
              {phaseMeta.icon} {phaseMeta.label}
            </span>
          </div>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div style={{ display: "flex", borderBottom: "1px solid #1e1f2e", background: "#0a0b0f" }}>
        {(["mission", "tasks", "history", "control"] as const).map((tab) => {
          const pendingCount = tab === "tasks" ? tasks.filter((t) => t.status === "approved").length : 0;
          return (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              flex: 1, padding: "10px 0", background: "none", border: "none",
              borderBottom: activeTab === tab ? "2px solid #6C5CE7" : "2px solid transparent",
              color: activeTab === tab ? "#A29BFE" : "#636e72",
              fontSize: 11, fontWeight: 700, cursor: "pointer",
              letterSpacing: 0.5, textTransform: "uppercase", transition: "all 0.2s",
            }}>
              {{ mission: "🎯 Mission", tasks: `📋 Tasks${pendingCount ? ` (${pendingCount})` : ""}`, history: "📜 Cycles", control: "⚙ Control" }[tab]}
            </button>
          );
        })}
      </div>

      <div style={{ padding: 16 }}>

        {/* ─── MISSION TAB ─────────────────────────────────────────────────── */}
        {activeTab === "mission" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Cycle pipeline */}
            <div style={{ background: "#0f1020", border: "1px solid #1e2035", borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 10, color: "#636e72", marginBottom: 10, fontWeight: 700, letterSpacing: 1 }}>
                ORCHESTRATION PIPELINE
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                {(["observing", "deciding", "assigning", "validating", "deploying"] as Phase[]).map((p, i) => {
                  const m = PHASE_META[p];
                  const active = status?.phase === p;
                  return (
                    <div key={p} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                      <div style={{
                        flex: 1, textAlign: "center",
                        background: active ? `${m.color}22` : "#12132a",
                        border: `1px solid ${active ? m.color : "#1e2035"}`,
                        borderRadius: 8, padding: "6px 2px", transition: "all 0.3s",
                      }}>
                        <div style={{ fontSize: 15 }}>{m.icon}</div>
                        <div style={{ fontSize: 8, color: active ? m.color : "#2d3436", fontWeight: 700, marginTop: 2, letterSpacing: 0.3 }}>
                          {m.label.toUpperCase()}
                        </div>
                      </div>
                      {i < 4 && <div style={{ fontSize: 10, color: "#2d3436", flexShrink: 0, margin: "0 1px" }}>›</div>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Agent roster */}
            <div style={{ background: "#0f1020", border: "1px solid #1e2035", borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 10, color: "#636e72", marginBottom: 10, fontWeight: 700, letterSpacing: 1 }}>
                AGENT ROSTER
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {([
                  { id: "builder",   icon: "🏗", name: "Builder Agent",   desc: "Code generation",    color: "#6C5CE7" },
                  { id: "debug",     icon: "🐛", name: "Debug Agent",     desc: "Error fixing",       color: "#e17055" },
                  { id: "ui",        icon: "🎨", name: "UI Agent",        desc: "Design & UX",        color: "#fd79a8" },
                  { id: "optimizer", icon: "⚡", name: "Optimizer Agent", desc: "Performance",        color: "#fdcb6e" },
                  { id: "product",   icon: "🚀", name: "Product Agent",   desc: "Feature planning",   color: "#00b894" },
                ]).map((agent) => {
                  const agentTasks = tasks.filter((t) => t.assignedAgent === agent.id);
                  const running    = agentTasks.some((t) => t.status === "running");
                  return (
                    <div key={agent.id} style={{
                      background: running ? `${agent.color}15` : "#12132a",
                      border: `1px solid ${running ? agent.color + "44" : "#1e2035"}`,
                      borderRadius: 10, padding: "10px 12px",
                      display: "flex", alignItems: "center", gap: 10, transition: "all 0.3s",
                    }}>
                      <span style={{ fontSize: 20 }}>{agent.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: running ? agent.color : "#dfe6e9" }}>
                          {agent.name}
                        </div>
                        <div style={{ fontSize: 10, color: "#636e72" }}>{agent.desc}</div>
                      </div>
                      <div style={{
                        width: 8, height: 8, borderRadius: "50%",
                        background: running ? agent.color : "#2d3436",
                        boxShadow: running ? `0 0 6px ${agent.color}` : "none",
                      }} />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Summary stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {[
                { label: "Cycles",   value: status?.cyclesRun ?? 0,       color: "#6C5CE7" },
                { label: "Tasks",    value: status?.tasksTotal ?? 0,       color: "#A29BFE" },
                { label: "Deployed", value: status?.tasksDeployed ?? 0,    color: "#00b894" },
                { label: "Rejected", value: status?.tasksRejected ?? 0,    color: "#e17055" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{
                  background: "#0f1020", border: "1px solid #1e2035",
                  borderRadius: 10, padding: "10px", textAlign: "center",
                }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
                  <div style={{ fontSize: 10, color: "#636e72", marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Activity log */}
            <div style={{
              background: "#050608", border: "1px solid #1e2035",
              borderRadius: 10, padding: 12, maxHeight: 120, overflowY: "auto",
            }}>
              <div style={{ fontSize: 10, color: "#636e72", marginBottom: 6, fontWeight: 700, letterSpacing: 1 }}>
                LIVE LOG
              </div>
              {log.length === 0 ? (
                <div style={{ fontSize: 11, color: "#2d3436" }}>No activity yet…</div>
              ) : log.map((line, i) => (
                <div key={i} style={{ fontSize: 11, color: "#b2bec3", lineHeight: 1.8 }}>{line}</div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        )}

        {/* ─── TASKS TAB ────────────────────────────────────────────────────── */}
        {activeTab === "tasks" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {tasks.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#636e72", fontSize: 13 }}>
                📋 No tasks yet.<br />
                <span style={{ fontSize: 11, color: "#2d3436" }}>Run a cycle to generate tasks.</span>
              </div>
            ) : tasks.map((task) => {
              const sm = STATUS_META[task.status];
              const agentColor = AGENT_COLORS[task.assignedAgent] ?? "#636e72";
              const isExpanded = expanded === task.id;
              return (
                <div key={task.id} style={{
                  background: "#0f1020",
                  border: `1px solid ${task.status === "deployed" ? "#00b89433" : task.status === "rejected" ? "#e1705533" : "#1e2035"}`,
                  borderRadius: 12, overflow: "hidden",
                }}>
                  <div
                    onClick={() => setExpanded(isExpanded ? null : task.id)}
                    style={{ padding: "12px 14px", cursor: "pointer" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: 1,
                        background: `${PRIORITY_COLOR[task.priority] ?? "#636e72"}22`,
                        color: PRIORITY_COLOR[task.priority] ?? "#636e72",
                        padding: "2px 8px", borderRadius: 10,
                      }}>{task.priority.toUpperCase()}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                        background: `${agentColor}22`, color: agentColor,
                        padding: "2px 8px", borderRadius: 10,
                      }}>{task.agentIcon} {task.assignedAgent}</span>
                      <span style={{ marginLeft: "auto", fontSize: 11, color: sm.color, fontWeight: 600 }}>
                        {sm.icon} {sm.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#dfe6e9", marginBottom: 4 }}>
                      {task.title}
                    </div>
                    {task.validationScore !== undefined && scoreBar(task.validationScore)}
                  </div>

                  {isExpanded && (
                    <div style={{ borderTop: "1px solid #1e2035", padding: "12px 14px", background: "#080910" }}>
                      <div style={{ fontSize: 11, color: "#636e72", marginBottom: 8, lineHeight: 1.6 }}>
                        {task.description}
                      </div>
                      {task.context && (
                        <div style={{ fontSize: 11, color: "#636e72", marginBottom: 8 }}>
                          Context: <span style={{ color: "#b2bec3" }}>{task.context}</span>
                        </div>
                      )}
                      {task.validationReason && (
                        <div style={{ fontSize: 11, color: "#636e72", marginBottom: 8 }}>
                          Validation: <span style={{ color: "#b2bec3" }}>{task.validationReason}</span>
                        </div>
                      )}
                      {task.agentOutput && (
                        <div style={{
                          background: "#050608", borderRadius: 8, padding: 10, marginBottom: 10,
                          fontSize: 11, color: "#b2bec3", maxHeight: 120, overflowY: "auto",
                          whiteSpace: "pre-wrap", fontFamily: "monospace",
                        }}>
                          {task.agentOutput.slice(0, 800)}{task.agentOutput.length > 800 ? "…" : ""}
                        </div>
                      )}
                      {task.status === "approved" && (
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => approveTask(task.id)} style={{
                            flex: 1, padding: "8px", borderRadius: 8, border: "none",
                            background: "linear-gradient(135deg, #00b894, #00cec9)",
                            color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
                          }}>🚀 Deploy</button>
                          <button onClick={() => rejectTask(task.id)} style={{
                            padding: "8px 14px", borderRadius: 8, border: "1px solid #2d3436",
                            background: "none", color: "#636e72", fontSize: 12, cursor: "pointer",
                          }}>✕ Reject</button>
                        </div>
                      )}
                      {(task.status === "rejected" || task.status === "failed") && (
                        <button onClick={() => retryTask(task.id)} style={{
                          width: "100%", padding: "8px", borderRadius: 8,
                          border: "1px solid #6C5CE733", background: "#6C5CE722",
                          color: "#A29BFE", fontSize: 12, fontWeight: 700, cursor: "pointer",
                        }}>🔄 Retry Task</button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ─── CYCLES TAB ───────────────────────────────────────────────────── */}
        {activeTab === "history" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {cycles.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#636e72", fontSize: 13 }}>
                🔁 No cycles run yet.
              </div>
            ) : cycles.map((c) => (
              <div key={c.id} style={{
                background: "#0f1020",
                border: `1px solid ${c.error ? "#e1705533" : c.tasksDeployed > 0 ? "#00b89433" : "#1e2035"}`,
                borderRadius: 10, padding: "12px 14px",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: c.error ? "#e17055" : c.tasksDeployed > 0 ? "#00b894" : "#dfe6e9" }}>
                    {c.error ? "❌ Failed" : c.tasksDeployed > 0 ? `🚀 ${c.tasksDeployed} Deployed` : c.tasksGenerated > 0 ? `✓ ${c.tasksGenerated} Tasks` : "✓ Healthy"}
                  </span>
                  <span style={{ fontSize: 10, color: "#636e72" }}>
                    {new Date(c.startedAt).toLocaleTimeString()}
                    {" · "}{Math.round((c.completedAt - c.startedAt) / 1000)}s
                  </span>
                </div>
                <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#636e72", marginBottom: c.observation ? 6 : 0 }}>
                  <span>📋 {c.tasksGenerated} tasks</span>
                  <span>✅ {c.tasksApproved} approved</span>
                  <span>🚀 {c.tasksDeployed} deployed</span>
                  <span>❌ {c.tasksRejected} rejected</span>
                </div>
                {c.observation && (
                  <div style={{ fontSize: 10, color: "#2d3436", lineHeight: 1.6 }}>
                    {c.observation.slice(0, 160)}
                  </div>
                )}
                {c.error && <div style={{ fontSize: 11, color: "#e17055", marginTop: 4 }}>{c.error}</div>}
              </div>
            ))}
          </div>
        )}

        {/* ─── CONTROL TAB ──────────────────────────────────────────────────── */}
        {activeTab === "control" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

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
                {status?.running ? "Orchestrator Running" : "Orchestrator Paused"}
              </span>
              {status?.autoApply && (
                <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, letterSpacing: 1, background: "#fdcb6e22", color: "#fdcb6e", padding: "2px 8px", borderRadius: 10 }}>
                  AUTO-APPLY ON
                </span>
              )}
            </div>

            {/* Interval */}
            <div style={{ background: "#0f1020", border: "1px solid #1e2035", borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 10, color: "#636e72", marginBottom: 8, fontWeight: 700, letterSpacing: 1 }}>
                CYCLE INTERVAL
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {[5, 10, 15, 30].map((m) => (
                  <button key={m} onClick={() => setIntervalMin(m)} style={{
                    flex: 1, padding: "8px 0", borderRadius: 8,
                    border: `1px solid ${intervalMin === m ? "#6C5CE7" : "#1e2035"}`,
                    background: intervalMin === m ? "#6C5CE722" : "none",
                    color: intervalMin === m ? "#A29BFE" : "#636e72",
                    fontSize: 12, fontWeight: 700, cursor: "pointer",
                  }}>{m}m</button>
                ))}
              </div>
            </div>

            {/* Auto-apply toggle */}
            <div style={{
              background: "#0f1020", border: "1px solid #1e2035", borderRadius: 10, padding: 14,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#dfe6e9" }}>Auto-Deploy Approved Tasks</div>
                <div style={{ fontSize: 11, color: "#636e72", marginTop: 2 }}>
                  Automatically deploy tasks that pass validation (≥65% score)
                </div>
              </div>
              <div onClick={() => setAutoApply((v) => !v)} style={{
                width: 44, height: 24, borderRadius: 12,
                background: autoApply ? "#6C5CE7" : "#2d3436",
                position: "relative", cursor: "pointer", transition: "background 0.3s",
              }}>
                <div style={{
                  position: "absolute", top: 3, left: autoApply ? 22 : 3,
                  width: 18, height: 18, borderRadius: "50%", background: "#fff",
                  transition: "left 0.3s",
                }} />
              </div>
            </div>

            {/* Buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={startSystem} disabled={loading || !!status?.running} style={{
                  flex: 1, padding: "12px", borderRadius: 10, border: "none",
                  background: status?.running ? "#2d3436" : "linear-gradient(135deg, #6C5CE7, #A29BFE)",
                  color: status?.running ? "#636e72" : "#fff",
                  fontSize: 13, fontWeight: 700, cursor: status?.running ? "not-allowed" : "pointer",
                }}>▶ Start Orchestrator</button>
                <button onClick={pauseSystem} disabled={!status?.running} style={{
                  flex: 1, padding: "12px", borderRadius: 10,
                  border: `1px solid ${!status?.running ? "transparent" : "#e1705533"}`,
                  background: !status?.running ? "#2d3436" : "#e1705522",
                  color: !status?.running ? "#636e72" : "#e17055",
                  fontSize: 13, fontWeight: 700, cursor: !status?.running ? "not-allowed" : "pointer",
                }}>⏸ Pause</button>
              </div>
              <button onClick={triggerCycle} disabled={loading} style={{
                padding: "11px", borderRadius: 10,
                border: "1px solid #6C5CE733", background: "#6C5CE722", color: "#A29BFE",
                fontSize: 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
              }}>⚡ {loading ? "Running cycle…" : "Trigger Manual Cycle"}</button>
            </div>

            {/* Safety */}
            <div style={{
              background: "#0f1020", border: "1px solid #1e2035", borderRadius: 10,
              padding: 14, fontSize: 11, color: "#636e72", lineHeight: 1.8,
            }}>
              <div style={{ fontWeight: 700, color: "#dfe6e9", marginBottom: 6 }}>🔐 Safety Controls</div>
              <div>• Admin can approve/reject/retry every task</div>
              <div>• Auto-pause after 3 consecutive failures</div>
              <div>• Min 65% validation score to approve</div>
              <div>• All agent decisions logged with full audit trail</div>
              <div>• Autonomous mode requires explicit opt-in</div>
              {(status?.consecutiveFails ?? 0) > 0 && (
                <div style={{ color: "#e17055", marginTop: 4 }}>
                  ⚠ {status?.consecutiveFails} consecutive failure(s)
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
