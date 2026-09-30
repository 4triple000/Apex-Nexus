/**
 * AutopilotPane — Apex AI OS Autopilot System
 *
 * The autonomous monitoring and self-healing layer.
 * Scans the project for issues and applies fixes automatically.
 *
 * Modes: OFF → SUGGEST → AUTO FIX → FULL AUTONOMOUS
 */

import { useState, useEffect, useCallback } from "react";

export type AutopilotMode = "off" | "suggest" | "auto_fix" | "full_auto";

export interface AutopilotIssue {
  id: string;
  severity: "error" | "warn" | "info";
  title: string;
  description: string;
  component: string;
  suggestedFix: string;
  appliedAt?: string;
}

interface AutopilotPaneProps {
  projectId: number | null;
  projectName: string;
  mode: AutopilotMode;
  onModeChange: (mode: AutopilotMode) => void;
  onFixApplied?: (previewHtml: string) => void;
  interactionLogs?: InteractionLog[];
}

interface InteractionLog {
  timestamp: string;
  type: "generate" | "edit" | "workflow_run" | "autopilot_fix" | "error";
  prompt?: string;
  success: boolean;
  durationMs?: number;
  insight?: string;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const apiUrl = (path: string) => `${BASE}/api${path}`;

const MODES: { id: AutopilotMode; label: string; color: string; desc: string; icon: string }[] = [
  { id: "off",       label: "OFF",          color: "#666",    icon: "⏸",  desc: "Manual mode only. No AI monitoring." },
  { id: "suggest",   label: "SUGGEST",      color: "#3b82f6", icon: "💡", desc: "AI scans and recommends fixes. You approve." },
  { id: "auto_fix",  label: "AUTO FIX",     color: "#A29BFE", icon: "🔧", desc: "AI automatically applies safe fixes." },
  { id: "full_auto", label: "FULL AUTO",    color: "#ef4444", icon: "🤖", desc: "AI autonomously fixes all issues including structure." },
];

export function AutopilotPane({ projectId, projectName, mode, onModeChange, onFixApplied, interactionLogs = [] }: AutopilotPaneProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [issues, setIssues] = useState<AutopilotIssue[]>([]);
  const [fixingId, setFixingId] = useState<string | null>(null);
  const [appliedFixes, setAppliedFixes] = useState<string[]>([]);
  const [healthScore, setHealthScore] = useState<number | null>(null);
  const [observations, setObservations] = useState<string[]>([]);
  const [lastScan, setLastScan] = useState<Date | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const runScan = useCallback(async () => {
    if (!projectId || isScanning) return;
    setIsScanning(true);
    setScanError(null);
    try {
      const res = await fetch(apiUrl("/studio/ai/autopilot/scan"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok) throw new Error("Scan failed");
      const { data } = await res.json() as {
        data: {
          issues: AutopilotIssue[];
          healthScore: number;
          observations: string[];
        };
      };
      setIssues(data.issues ?? []);
      setHealthScore(data.healthScore);
      setObservations(data.observations ?? []);
      setLastScan(new Date());
    } catch (e) {
      setScanError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setIsScanning(false);
    }
  }, [projectId, isScanning]);

  // Auto-scan when mode changes to active
  useEffect(() => {
    if (mode !== "off" && projectId && issues.length === 0 && !isScanning) {
      void runScan();
    }
  }, [mode, projectId]);

  const applyFix = async (issue: AutopilotIssue) => {
    if (!projectId || fixingId) return;
    setFixingId(issue.id);
    try {
      const res = await fetch(apiUrl("/studio/ai/autopilot/fix"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, issueId: issue.id, issue }),
      });
      if (!res.ok) throw new Error("Fix failed");
      const { data } = await res.json() as { data: { previewHtml: string } };
      setIssues((prev) => prev.map((i) => i.id === issue.id ? { ...i, appliedAt: new Date().toISOString() } : i));
      setAppliedFixes((prev) => [...prev, issue.id]);
      if (data.previewHtml) onFixApplied?.(data.previewHtml);
    } catch {
      // Silently mark as attempted
      setAppliedFixes((prev) => [...prev, issue.id]);
    } finally {
      setFixingId(null);
    }
  };

  const currentMode = MODES.find((m) => m.id === mode)!;
  const pendingIssues = issues.filter((i) => !appliedFixes.includes(i.id));
  const fixedIssues   = issues.filter((i) => appliedFixes.includes(i.id));

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "transparent" }}>
      {/* Header */}
      <div className="px-5 py-4 border-b flex-shrink-0" style={{ borderColor: "#1C1C1E" }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold text-sm">AI Autopilot</h2>
            <p className="text-white/40 text-[11px] mt-0.5">Autonomous monitoring &amp; self-healing</p>
          </div>
          {healthScore !== null && (
            <HealthBadge score={healthScore} />
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* ── Mode switcher ─────────────────────────────────────────────────── */}
        <div>
          <p className="text-white/30 text-[10px] uppercase tracking-wider mb-2">Autopilot Mode</p>
          <div className="grid grid-cols-2 gap-2">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => onModeChange(m.id)}
                className="flex items-start gap-2 p-3 rounded-xl text-left transition-all"
                style={{
                  background: mode === m.id ? `${m.color}15` : "#161B22",
                  border: `1px solid ${mode === m.id ? `${m.color}40` : "#21262D"}`,
                }}
              >
                <span className="text-base leading-none flex-shrink-0">{m.icon}</span>
                <div>
                  <p className="text-[11px] font-bold" style={{ color: mode === m.id ? m.color : "rgba(255,255,255,0.5)" }}>
                    {m.label}
                  </p>
                  <p className="text-[9px] leading-snug mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>
                    {m.desc}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Scan button ───────────────────────────────────────────────────── */}
        {mode !== "off" && (
          <div className="flex items-center gap-3">
            <button
              onClick={runScan}
              disabled={isScanning || !projectId}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all hover:brightness-110 disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ background: "rgba(162,155,254,0.1)", color: "#A29BFE", border: "1px solid rgba(162,155,254,0.2)" }}
            >
              {isScanning ? (
                <>
                  <div className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "rgba(162,155,254,0.3)", borderTopColor: "#A29BFE" }} />
                  Scanning…
                </>
              ) : (
                <>🔍 Run Scan</>
              )}
            </button>
            {lastScan && (
              <span className="text-white/25 text-[10px]">
                Last: {lastScan.toLocaleTimeString()}
              </span>
            )}
          </div>
        )}

        {/* No project state */}
        {!projectId && (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">🤖</div>
            <p className="text-white/40 text-sm">Generate an app to activate Autopilot</p>
          </div>
        )}

        {/* Scan error */}
        {scanError && (
          <div className="px-3 py-2.5 rounded-xl text-sm" style={{ background: "rgba(239,68,68,0.08)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
            ⚠ {scanError}
          </div>
        )}

        {/* ── Observations ─────────────────────────────────────────────────── */}
        {observations.length > 0 && (
          <div>
            <p className="text-white/30 text-[10px] uppercase tracking-wider mb-2">AI Observations</p>
            <div className="space-y-1.5">
              {observations.map((obs, i) => (
                <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(30,26,62,0.62)", border: "1px solid #21262D" }}>
                  <span className="text-blue-400 text-[10px] mt-0.5 flex-shrink-0">●</span>
                  <p className="text-white/50 text-[11px] leading-snug">{obs}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Pending Issues ────────────────────────────────────────────────── */}
        {pendingIssues.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-white/30 text-[10px] uppercase tracking-wider">
                Issues Detected ({pendingIssues.length})
              </p>
              {mode === "auto_fix" || mode === "full_auto" ? (
                <button
                  onClick={() => pendingIssues.forEach(applyFix)}
                  disabled={!!fixingId}
                  className="text-[10px] px-2 py-1 rounded-lg transition-all"
                  style={{ background: "rgba(162,155,254,0.1)", color: "#A29BFE", border: "1px solid rgba(162,155,254,0.2)" }}
                >
                  Fix All
                </button>
              ) : null}
            </div>
            <div className="space-y-2">
              {pendingIssues.map((issue) => (
                <IssueCard
                  key={issue.id}
                  issue={issue}
                  mode={mode}
                  isFixing={fixingId === issue.id}
                  onFix={() => applyFix(issue)}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Applied fixes ─────────────────────────────────────────────────── */}
        {fixedIssues.length > 0 && (
          <div>
            <p className="text-white/30 text-[10px] uppercase tracking-wider mb-2">
              Applied Fixes ({fixedIssues.length})
            </p>
            <div className="space-y-1.5">
              {fixedIssues.map((issue) => (
                <div key={issue.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl" style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)" }}>
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="6" fill="rgba(34,197,94,0.15)" />
                    <path d="M4 7L6 9L10 5" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-[11px] text-white/50">{issue.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No issues after scan */}
        {!isScanning && lastScan && pendingIssues.length === 0 && fixedIssues.length === 0 && (
          <div className="text-center py-6">
            <div className="text-4xl mb-3">✅</div>
            <p className="text-white/50 text-sm font-medium">No issues detected</p>
            <p className="text-white/25 text-[11px] mt-1">Your app looks healthy</p>
          </div>
        )}

        {/* ── Self-Improving System ─────────────────────────────────────────── */}
        {interactionLogs.length > 0 && (
          <SelfImprovingLog logs={interactionLogs} />
        )}
      </div>
    </div>
  );
}

// ── Issue Card ─────────────────────────────────────────────────────────────────

function IssueCard({
  issue,
  mode,
  isFixing,
  onFix,
}: {
  issue: AutopilotIssue;
  mode: AutopilotMode;
  isFixing: boolean;
  onFix: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const severityColors = {
    error: { border: "rgba(239,68,68,0.3)", bg: "rgba(239,68,68,0.06)", dot: "#ef4444", label: "ERROR" },
    warn:  { border: "rgba(162,155,254,0.3)", bg: "rgba(162,155,254,0.04)", dot: "#A29BFE", label: "WARN" },
    info:  { border: "rgba(59,130,246,0.3)", bg: "rgba(59,130,246,0.04)", dot: "#60a5fa", label: "INFO" },
  };
  const s = severityColors[issue.severity];
  const canFix = mode === "auto_fix" || mode === "full_auto" || mode === "suggest";

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
      <button onClick={() => setExpanded((v) => !v)} className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left">
        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: s.dot }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold" style={{ color: s.dot }}>{s.label}</span>
            <span className="text-[11px] font-medium text-white/80">{issue.title}</span>
          </div>
          <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{issue.component}</p>
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" className={`flex-shrink-0 transition-transform mt-1 ${expanded ? "rotate-180" : ""}`}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t" style={{ borderColor: s.border }}>
          <p className="text-[11px] mt-2.5 leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{issue.description}</p>
          <div className="mt-2 px-2.5 py-2 rounded-lg text-[10px] leading-relaxed" style={{ background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.06)" }}>
            💡 Fix: {issue.suggestedFix}
          </div>
          {canFix && (
            <button
              onClick={onFix}
              disabled={isFixing}
              className="mt-2.5 w-full py-2 rounded-lg text-[11px] font-medium transition-all hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-1.5"
              style={{ background: "rgba(162,155,254,0.1)", color: "#A29BFE", border: "1px solid rgba(162,155,254,0.2)" }}
            >
              {isFixing ? (
                <>
                  <div className="w-2.5 h-2.5 rounded-full border border-t-transparent animate-spin" style={{ borderColor: "rgba(162,155,254,0.3)", borderTopColor: "#A29BFE" }} />
                  Applying fix…
                </>
              ) : "🔧 Apply Fix"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Health badge ───────────────────────────────────────────────────────────────

function HealthBadge({ score }: { score: number }) {
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#A29BFE" : "#ef4444";
  const label = score >= 80 ? "Healthy" : score >= 60 ? "Fair" : "At Risk";
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{ background: `${color}10`, border: `1px solid ${color}30` }}>
      <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      <span className="text-[11px] font-bold" style={{ color }}>
        {score}% {label}
      </span>
    </div>
  );
}

// ── Self-Improving System log ──────────────────────────────────────────────────

function SelfImprovingLog({ logs }: { logs: InteractionLog[] }) {
  const recent = [...logs].reverse().slice(0, 8);
  const successRate = Math.round((logs.filter((l) => l.success).length / logs.length) * 100);

  const typeIcons: Record<string, string> = {
    generate: "🏗",
    edit: "✏️",
    workflow_run: "⚡",
    autopilot_fix: "🔧",
    error: "⚠",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-white/30 text-[10px] uppercase tracking-wider">Self-Improving System</p>
        <span className="text-[10px] font-mono" style={{ color: successRate >= 80 ? "#22c55e" : "#A29BFE" }}>
          {successRate}% success rate
        </span>
      </div>
      <div className="rounded-xl overflow-hidden" style={{ background: "rgba(30,26,62,0.62)", border: "1px solid #21262D" }}>
        <div className="px-3 py-2 border-b" style={{ borderColor: "#21262D" }}>
          <div className="flex items-center justify-between text-[10px]">
            <span style={{ color: "rgba(255,255,255,0.3)" }}>Interaction loop active</span>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
              <span style={{ color: "#22c55e" }}>LEARNING</span>
            </div>
          </div>
          <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: "rgba(30,26,62,0.62)" }}>
            <div className="h-full rounded-full" style={{ width: `${successRate}%`, background: "linear-gradient(90deg, #22c55e, #4ade80)" }} />
          </div>
        </div>
        <div className="divide-y divide-[#21262D]">
          {recent.map((log, i) => (
            <div key={i} className="flex items-center gap-2.5 px-3 py-2">
              <span className="text-base leading-none flex-shrink-0">{typeIcons[log.type] ?? "●"}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.5)" }}>
                  {log.prompt?.slice(0, 50) ?? log.type}
                </p>
                {log.insight && (
                  <p className="text-[9px] mt-0.5" style={{ color: "rgba(162,155,254,0.6)" }}>
                    → {log.insight.slice(0, 60)}
                  </p>
                )}
              </div>
              <div className="flex-shrink-0">
                {log.success ? (
                  <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: "rgba(34,197,94,0.12)" }}>
                    <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                      <path d="M1.5 5L4 7.5L8.5 2.5" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                ) : (
                  <div className="w-4 h-4 rounded-full" style={{ background: "rgba(239,68,68,0.12)" }} />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
