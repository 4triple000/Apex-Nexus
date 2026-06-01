/**
 * WorkflowPane — Apex AI OS Workflow Engine UI
 *
 * Displays modular AI-executable workflows for the current project.
 * Users can run workflows step-by-step and see live execution logs.
 */

import { useState, useEffect } from "react";

export interface WorkflowStep {
  id: string;
  action: string;
  input?: string;
  output?: string;
  conditions?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  triggers: string[];
  steps: WorkflowStep[];
}

interface RunLog {
  stepId: string;
  status: "pending" | "running" | "done" | "error";
  startedAt?: number;
  doneAt?: number;
  result?: string;
}

interface WorkflowPaneProps {
  workflows: Workflow[];
  projectId: number | null;
  projectName: string;
  onAddWorkflow?: () => void;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const apiUrl = (path: string) => `${BASE}/api${path}`;

export function WorkflowPane({ workflows, projectId, projectName, onAddWorkflow }: WorkflowPaneProps) {
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runLogs, setRunLogs] = useState<Record<string, RunLog[]>>({});
  const [expandedId, setExpandedId] = useState<string | null>(workflows[0]?.id ?? null);

  const runWorkflow = async (workflow: Workflow) => {
    if (!projectId || runningId) return;
    setRunningId(workflow.id);
    setExpandedId(workflow.id);

    const initLogs: RunLog[] = workflow.steps.map((s) => ({ stepId: s.id, status: "pending" }));
    setRunLogs((prev) => ({ ...prev, [workflow.id]: initLogs }));

    try {
      const res = await fetch(apiUrl("/studio/ai/workflow/run"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, workflowId: workflow.id }),
      });

      const { data } = await res.json() as {
        data: { steps: (WorkflowStep & { delayMs: number })[] };
      };

      for (const stepData of data.steps) {
        await delay(stepData.delayMs);
        setRunLogs((prev) => ({
          ...prev,
          [workflow.id]: (prev[workflow.id] ?? []).map((l) =>
            l.stepId === stepData.id ? { ...l, status: "running", startedAt: Date.now() } : l
          ),
        }));
        await delay(350);
        setRunLogs((prev) => ({
          ...prev,
          [workflow.id]: (prev[workflow.id] ?? []).map((l) =>
            l.stepId === stepData.id
              ? { ...l, status: "done", doneAt: Date.now(), result: stepData.output ?? "Completed" }
              : l
          ),
        }));
      }
    } catch {
      setRunLogs((prev) => ({
        ...prev,
        [workflow.id]: (prev[workflow.id] ?? []).map((l) =>
          l.status === "running" ? { ...l, status: "error" } : l
        ),
      }));
    } finally {
      setRunningId(null);
    }
  };

  if (workflows.length === 0) {
    return (
      <EmptyWorkflows projectName={projectName} onAdd={onAddWorkflow} />
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "#0D0D0D" }}>
      {/* Header */}
      <div className="px-5 py-4 border-b flex-shrink-0" style={{ borderColor: "#1C1C1E" }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold text-sm">Workflow Engine</h2>
            <p className="text-white/40 text-[11px] mt-0.5">
              {workflows.length} modular workflow{workflows.length !== 1 ? "s" : ""} — click Run to execute
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider"
              style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)" }}
            >
              ● Live
            </div>
            {onAddWorkflow && (
              <button
                onClick={onAddWorkflow}
                className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all hover:brightness-110"
                style={{ background: "rgba(255,204,51,0.1)", color: "#FFCC33", border: "1px solid rgba(255,204,51,0.2)" }}
              >
                + New
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Workflow list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {workflows.map((wf) => {
          const logs = runLogs[wf.id] ?? [];
          const isRunning = runningId === wf.id;
          const isExpanded = expandedId === wf.id;
          const doneLogs = logs.filter((l) => l.status === "done").length;
          const totalLogs = logs.length;
          const hasRun = logs.length > 0;

          return (
            <div
              key={wf.id}
              className="rounded-2xl overflow-hidden transition-all"
              style={{ background: "#161B22", border: `1px solid ${isRunning ? "rgba(255,204,51,0.3)" : "#21262D"}` }}
            >
              {/* Workflow header */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : wf.id)}
                className="w-full flex items-start gap-3 p-4 text-left"
              >
                {/* Status dot */}
                <div className="flex-shrink-0 mt-0.5">
                  {isRunning ? (
                    <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "rgba(255,204,51,0.3)", borderTopColor: "#FFCC33" }} />
                  ) : hasRun && doneLogs === totalLogs ? (
                    <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "rgba(34,197,94,0.15)" }}>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5L4 7.5L8.5 2.5" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px]" style={{ background: "#0D0D0D", border: "1px solid #2A2A2A" }}>
                      ⚡
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-white text-sm font-semibold">{wf.name}</p>
                    {isRunning && (
                      <span className="text-[#FFCC33] text-[10px] font-mono">{doneLogs}/{totalLogs}</span>
                    )}
                  </div>
                  <p className="text-white/40 text-[11px] mt-0.5 truncate">{wf.description}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-white/25 text-[10px]">🔁 {wf.steps.length} steps</span>
                    {wf.triggers[0] && (
                      <span className="text-white/25 text-[10px] truncate">↯ {wf.triggers[0]}</span>
                    )}
                  </div>
                </div>

                <svg
                  width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="rgba(255,255,255,0.3)" strokeWidth="2"
                  className={`flex-shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {/* Expanded: steps + run button */}
              {isExpanded && (
                <div className="border-t px-4 pb-4" style={{ borderColor: "#21262D" }}>
                  {/* Run button */}
                  <div className="flex items-center justify-between mt-3 mb-3">
                    <span className="text-white/30 text-[10px] uppercase tracking-wider">Steps</span>
                    <button
                      onClick={() => runWorkflow(wf)}
                      disabled={!!runningId || !projectId}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all hover:brightness-110 disabled:opacity-40"
                      style={{ background: "rgba(255,204,51,0.12)", color: "#FFCC33", border: "1px solid rgba(255,204,51,0.25)" }}
                    >
                      {isRunning ? (
                        <>
                          <div className="w-2.5 h-2.5 rounded-full border border-t-transparent animate-spin" style={{ borderColor: "rgba(255,204,51,0.3)", borderTopColor: "#FFCC33" }} />
                          Running…
                        </>
                      ) : (
                        <>▶ Run</>
                      )}
                    </button>
                  </div>

                  {/* Step list */}
                  <div className="space-y-2">
                    {wf.steps.map((step, idx) => {
                      const log = logs.find((l) => l.stepId === step.id);
                      return (
                        <div key={step.id} className="flex items-start gap-3">
                          {/* Step number / status */}
                          <div className="flex-shrink-0 flex flex-col items-center" style={{ width: 20 }}>
                            {!log || log.status === "pending" ? (
                              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ background: "#0D0D0D", border: "1px solid #2A2A2A", color: "rgba(255,255,255,0.3)" }}>
                                {idx + 1}
                              </div>
                            ) : log.status === "running" ? (
                              <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "rgba(255,204,51,0.2)", borderTopColor: "#FFCC33" }} />
                            ) : log.status === "done" ? (
                              <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "rgba(34,197,94,0.15)" }}>
                                <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M1.5 5L4 7.5L8.5 2.5" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                              </div>
                            ) : (
                              <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "rgba(239,68,68,0.15)" }}>
                                <span style={{ color: "#ef4444", fontSize: 9 }}>✕</span>
                              </div>
                            )}
                            {idx < wf.steps.length - 1 && (
                              <div className="w-px flex-1 mt-1" style={{ background: log?.status === "done" ? "rgba(34,197,94,0.3)" : "#2A2A2A", minHeight: 12 }} />
                            )}
                          </div>

                          {/* Step content */}
                          <div className="flex-1 pb-2">
                            <p className="text-[12px] font-medium" style={{ color: log?.status === "done" ? "#4ade80" : log?.status === "running" ? "#FFCC33" : "rgba(255,255,255,0.6)" }}>
                              {step.action}
                            </p>
                            {step.output && (
                              <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>
                                → {step.output}
                              </p>
                            )}
                            {log?.status === "done" && log.result && (
                              <div className="mt-1 px-2 py-1 rounded text-[10px]" style={{ background: "rgba(34,197,94,0.08)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.15)" }}>
                                ✓ {log.result}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Completion badge */}
                  {hasRun && doneLogs === totalLogs && totalLogs > 0 && (
                    <div className="mt-3 px-3 py-2 rounded-xl text-[11px] font-medium text-center" style={{ background: "rgba(34,197,94,0.08)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.15)" }}>
                      ✓ Workflow completed successfully
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EmptyWorkflows({ projectName, onAdd }: { projectName: string; onAdd?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8" style={{ background: "#0D0D0D" }}>
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4" style={{ background: "#161B22", border: "1px solid #21262D" }}>
        🔄
      </div>
      <h3 className="text-white font-bold text-base mb-2">No workflows yet</h3>
      <p className="text-white/40 text-sm mb-6 max-w-52">
        Generate your {projectName ? `"${projectName}"` : "first"} app and workflows will be created automatically.
      </p>
      {onAdd && (
        <button
          onClick={onAdd}
          className="px-4 py-2 rounded-xl text-sm font-medium"
          style={{ background: "rgba(255,204,51,0.1)", color: "#FFCC33", border: "1px solid rgba(255,204,51,0.2)" }}
        >
          + Add workflow manually
        </button>
      )}
    </div>
  );
}

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}
