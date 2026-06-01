/**
 * MonitorPane — Apex AI OS Live Monitoring Dashboard
 *
 * Displays real execution telemetry fetched from GET /api/metrics/project/:id
 * (backed by devos_logs, apex_deployments, devos_files tables).
 * Falls back gracefully if the project has no execution history yet.
 */

import { useState, useEffect, useRef } from "react";

interface MonitorPaneProps {
  projectId: number | null;
  projectName: string;
  buildCount?: number;
  editCount?: number;
}

interface RealMetrics {
  requestsPerMin:  number;
  errorRate:       number;
  avgLatencyMs:    number;
  memoryMB:        number;
  totalExecutions: number;
  successRate:     number;
  deploymentCount: number;
  fileCount:       number;
  lastExecutionAt: string | null;
  uptimeSince:     string | null;
  recentActivity:  number;
}

interface ObservationEntry {
  id:      string;
  ts:      string;
  message: string;
  type:    "info" | "warn" | "improve";
}

const LOOP_STAGES = ["INPUT", "BUILD", "RUN", "OBSERVE", "LEARN", "IMPROVE"];

// Observation messages are derived from real metric thresholds — they are
// diagnostic notes, not random content.
function buildObservations(m: RealMetrics, prev: ObservationEntry[]): ObservationEntry[] {
  const notes: Array<{ message: string; type: ObservationEntry["type"] }> = [];

  if (m.errorRate > 10)   notes.push({ message: `Error rate at ${m.errorRate.toFixed(1)}% — review recent failures`, type: "warn" });
  if (m.errorRate === 0 && m.totalExecutions > 0) notes.push({ message: "Error rate at 0% — all executions successful", type: "improve" });
  if (m.avgLatencyMs > 5000) notes.push({ message: `Avg latency ${m.avgLatencyMs}ms — optimize execution pipeline`, type: "warn" });
  if (m.avgLatencyMs > 0 && m.avgLatencyMs < 1000) notes.push({ message: `Avg latency ${m.avgLatencyMs}ms — excellent performance`, type: "info" });
  if (m.deploymentCount > 0) notes.push({ message: `${m.deploymentCount} deployment(s) recorded`, type: "info" });
  if (m.fileCount > 0)        notes.push({ message: `${m.fileCount} file(s) in project`, type: "info" });
  if (m.totalExecutions === 0) notes.push({ message: "No executions yet — run your first workflow to see telemetry", type: "info" });
  if (m.successRate === 100 && m.totalExecutions > 0) notes.push({ message: "100% success rate — all steps passing", type: "improve" });
  if (m.recentActivity > 5) notes.push({ message: `${m.recentActivity} executions in the last 10 min — high activity`, type: "improve" });

  const fresh = notes.map((n, i) => ({
    id: `obs-${Date.now()}-${i}`,
    ts: new Date().toLocaleTimeString(),
    ...n,
  }));

  // Prepend new notes and cap at 8
  return [...fresh, ...prev].slice(0, 8);
}

export function MonitorPane({ projectId, projectName, buildCount = 0, editCount = 0 }: MonitorPaneProps) {
  const [metrics,      setMetrics]      = useState<RealMetrics | null>(null);
  const [fetchError,   setFetchError]   = useState(false);
  const [observations, setObservations] = useState<ObservationEntry[]>([]);
  const [loopPhase,    setLoopPhase]    = useState(0);
  const [uptime,       setUptime]       = useState(0);
  const prevMetricsRef = useRef<RealMetrics | null>(null);
  const loopRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Real metrics fetch ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    async function fetchMetrics() {
      try {
        const res = await fetch(`/api/metrics/project/${projectId}`);
        if (!res.ok) { if (!cancelled) setFetchError(true); return; }
        const body = await res.json() as { ok?: boolean; metrics?: RealMetrics };
        if (!cancelled && body.metrics) {
          const m = body.metrics;
          setMetrics(m);
          setFetchError(false);
          // Generate observations based on real metric thresholds
          setObservations(prev => buildObservations(m, prev));
          // Seed uptime from first log timestamp
          if (m.uptimeSince) {
            const elapsed = Math.floor((Date.now() - new Date(m.uptimeSince).getTime()) / 1000);
            setUptime(elapsed);
          }
          prevMetricsRef.current = m;
        }
      } catch {
        if (!cancelled) setFetchError(true);
      }
    }

    fetchMetrics();
    pollRef.current = setInterval(fetchMetrics, 10_000);
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [projectId]);

  // ── Uptime ticker (seconds) ─────────────────────────────────────────────────
  useEffect(() => {
    if (!projectId) return;
    const id = setInterval(() => setUptime(v => v + 1), 1000);
    return () => clearInterval(id);
  }, [projectId]);

  // ── Loop phase animator ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!projectId) return;
    loopRef.current = setInterval(() => setLoopPhase(v => (v + 1) % LOOP_STAGES.length), 2400);
    return () => { if (loopRef.current) clearInterval(loopRef.current); };
  }, [projectId]);

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (!projectId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8" style={{ background: "#0D0D0D" }}>
        <div className="text-4xl mb-4">📊</div>
        <h3 className="text-white font-bold text-base mb-2">Monitor activates after build</h3>
        <p className="text-white/40 text-sm max-w-48">
          Generate your first app and the AI will start monitoring it in real time.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "#0D0D0D" }}>
      {/* Header */}
      <div className="px-5 py-4 border-b flex-shrink-0" style={{ borderColor: "#1C1C1E" }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold text-sm">Live Monitor</h2>
            <p className="text-white/40 text-[11px] mt-0.5">{projectName} — real-time telemetry</p>
          </div>
          <div className="flex items-center gap-1.5">
            {fetchError
              ? <><div className="w-2 h-2 rounded-full bg-red-500" /><span className="text-red-400 text-[11px] font-mono">OFFLINE</span></>
              : <><div className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" /><span className="text-[#22c55e] text-[11px] font-mono">LIVE</span></>
            }
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* ── AI Evolution Loop ─────────────────────────────────────────────── */}
        <div className="rounded-xl p-3" style={{ background: "#161B22", border: "1px solid #21262D" }}>
          <p className="text-white/30 text-[10px] uppercase tracking-wider mb-2.5">AI Evolution Loop</p>
          <div className="flex items-center gap-1 overflow-x-auto">
            {LOOP_STAGES.map((stage, i) => (
              <div key={stage} className="flex items-center gap-1 flex-shrink-0">
                <div
                  className="px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all duration-500"
                  style={{
                    background: loopPhase === i ? "rgba(255,204,51,0.2)" : "rgba(255,255,255,0.04)",
                    color: loopPhase === i ? "#FFCC33" : "rgba(255,255,255,0.25)",
                    border: `1px solid ${loopPhase === i ? "rgba(255,204,51,0.4)" : "rgba(255,255,255,0.06)"}`,
                    transform: loopPhase === i ? "scale(1.05)" : "scale(1)",
                  }}
                >
                  {stage}
                </div>
                {i < LOOP_STAGES.length - 1 && (
                  <svg width="8" height="8" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M2 6h8M7 3l3 3-3 3" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Project stats ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="Builds"      value={String(buildCount)}                         icon="🏗"  color="#FFCC33" />
          <StatCard label="Edits"       value={String(editCount)}                          icon="✏️"  color="#60a5fa" />
          <StatCard label="Deployments" value={String(metrics?.deploymentCount ?? "—")}   icon="🚀"  color="#22c55e" />
        </div>

        {/* ── Live metrics ──────────────────────────────────────────────────── */}
        <div>
          <p className="text-white/30 text-[10px] uppercase tracking-wider mb-2">Runtime Metrics</p>
          {metrics ? (
            <div className="grid grid-cols-2 gap-2">
              <MetricCard
                label="Requests/min"
                value={`${metrics.requestsPerMin}`}
                delta={metrics.recentActivity > 0 ? `${metrics.recentActivity} recent` : "no recent activity"}
                positive={metrics.requestsPerMin > 0}
                icon="📡"
              />
              <MetricCard
                label="Error rate"
                value={`${metrics.errorRate.toFixed(2)}%`}
                delta={metrics.errorRate === 0 ? "✓ clean" : metrics.errorRate > 10 ? "↑ investigate" : "within range"}
                positive={metrics.errorRate < 5}
                icon="⚠"
              />
              <MetricCard
                label="Avg latency"
                value={metrics.avgLatencyMs > 0 ? `${metrics.avgLatencyMs}ms` : "—"}
                delta={metrics.avgLatencyMs > 0 && metrics.avgLatencyMs < 1000 ? "fast" : metrics.avgLatencyMs >= 1000 ? "slow" : "no data"}
                positive={metrics.avgLatencyMs < 1000}
                icon="⚡"
              />
              <MetricCard
                label="Total runs"
                value={String(metrics.totalExecutions)}
                delta={`${metrics.successRate}% success`}
                positive={metrics.successRate >= 80}
                icon="▶"
              />
            </div>
          ) : (
            <div className="rounded-xl p-4 text-center" style={{ background: "#161B22", border: "1px solid #21262D" }}>
              {fetchError
                ? <p className="text-red-400 text-[11px]">Could not load metrics — check API connection</p>
                : <p className="text-white/30 text-[11px]">Loading telemetry…</p>
              }
            </div>
          )}
        </div>

        {/* ── Uptime bar ────────────────────────────────────────────────────── */}
        <UptimeBar seconds={uptime} successRate={metrics?.successRate ?? 100} />

        {/* ── AI Observations feed ──────────────────────────────────────────── */}
        {observations.length > 0 && (
          <div>
            <p className="text-white/30 text-[10px] uppercase tracking-wider mb-2">AI Observations</p>
            <div className="space-y-1.5">
              {observations.map((obs) => (
                <ObservationRow key={obs.id} obs={obs} />
              ))}
            </div>
          </div>
        )}

        {/* ── File count ────────────────────────────────────────────────────── */}
        {metrics && metrics.fileCount > 0 && (
          <div className="rounded-xl px-3 py-2.5 flex items-center gap-3" style={{ background: "#161B22", border: "1px solid #21262D" }}>
            <span className="text-lg">📁</span>
            <div>
              <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>Project Files</p>
              <p className="text-white font-bold text-sm">{metrics.fileCount} file{metrics.fileCount !== 1 ? "s" : ""}</p>
            </div>
            {metrics.lastExecutionAt && (
              <div className="ml-auto text-right">
                <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>Last run</p>
                <p className="text-white/60 text-[11px] font-mono">
                  {new Date(metrics.lastExecutionAt).toLocaleTimeString()}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <div className="rounded-xl p-3 text-center" style={{ background: "#161B22", border: "1px solid #21262D" }}>
      <div className="text-lg mb-1">{icon}</div>
      <div className="text-lg font-bold" style={{ color }}>{value}</div>
      <div className="text-[9px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{label}</div>
    </div>
  );
}

function MetricCard({ label, value, delta, positive, icon }: {
  label: string; value: string; delta: string; positive: boolean; icon: string;
}) {
  return (
    <div className="rounded-xl p-3" style={{ background: "#161B22", border: "1px solid #21262D" }}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-sm">{icon}</span>
        <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>{label}</span>
      </div>
      <div className="text-lg font-bold text-white">{value}</div>
      <div className="text-[10px] mt-0.5 font-mono" style={{ color: positive ? "#22c55e" : "#f87171" }}>
        {delta}
      </div>
    </div>
  );
}

function UptimeBar({ seconds, successRate }: { seconds: number; successRate: number }) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const str = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  const displayRate = successRate.toFixed(1);

  return (
    <div className="rounded-xl px-3 py-2.5 flex items-center gap-3" style={{ background: "#161B22", border: "1px solid #21262D" }}>
      <div>
        <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>Session Uptime</p>
        <p className="text-white font-mono text-sm font-bold">{str}</p>
      </div>
      <div className="flex-1 flex gap-0.5">
        {Array.from({ length: 24 }).map((_, i) => {
          const health = successRate / 100;
          const threshold = Math.floor(24 * health);
          return (
            <div
              key={i}
              className="flex-1 rounded-sm"
              style={{
                height: 16,
                background: i < threshold
                  ? "rgba(34,197,94,0.5)"
                  : i === threshold
                  ? "rgba(255,204,51,0.5)"
                  : "rgba(255,255,255,0.06)",
              }}
            />
          );
        })}
      </div>
      <span className="text-[11px] font-bold flex-shrink-0"
        style={{ color: successRate >= 90 ? "#22c55e" : successRate >= 70 ? "#FFCC33" : "#f87171" }}>
        {displayRate}%
      </span>
    </div>
  );
}

function ObservationRow({ obs }: { obs: ObservationEntry }) {
  const colors = {
    info:    { dot: "#60a5fa", bg: "rgba(59,130,246,0.06)",  border: "rgba(59,130,246,0.15)" },
    warn:    { dot: "#FFCC33", bg: "rgba(255,204,51,0.04)",  border: "rgba(255,204,51,0.15)" },
    improve: { dot: "#22c55e", bg: "rgba(34,197,94,0.06)",   border: "rgba(34,197,94,0.15)" },
  };
  const c = colors[obs.type];
  return (
    <div className="flex items-start gap-2.5 px-3 py-2 rounded-xl" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: c.dot }} />
      <p className="flex-1 text-[11px] leading-snug" style={{ color: "rgba(255,255,255,0.55)" }}>{obs.message}</p>
      <span className="text-[9px] flex-shrink-0 font-mono" style={{ color: "rgba(255,255,255,0.2)" }}>{obs.ts}</span>
    </div>
  );
}
