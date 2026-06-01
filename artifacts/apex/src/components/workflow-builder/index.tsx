/**
 * Conversational AI Workflow Builder — main 3-panel layout.
 *
 * Architecture:
 *  - WorkflowState is the single source of truth
 *  - React Flow nodes/edges are derived from WorkflowState via workflowToGraph()
 *  - Chat panel calls AI API → updates WorkflowState
 *  - Properties panel directly mutates WorkflowState fields
 */

import { useState, useCallback, useId } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { Link } from "wouter";
import {
  ArrowLeft,
  Download,
  Save,
  CheckCircle2,
  Loader2,
  Wand2,
} from "lucide-react";

import { ChatPanel } from "./ChatPanel";
import { WorkflowGraph } from "./WorkflowGraph";
import { PropertiesPanel } from "./PropertiesPanel";
import {
  type WorkflowState,
  type ChatMessage,
  type GenerationResult,
} from "./types";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const apiUrl = (path: string) => `${BASE}api${path}`;

async function request<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", ...opts?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function uid() {
  return Math.random().toString(36).slice(2);
}

export function WorkflowBuilder() {
  const [workflow, setWorkflow] = useState<WorkflowState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  // ── Chat handler ──────────────────────────────────────────────────────────
  const handleSend = useCallback(
    async (text: string) => {
      const userMsg: ChatMessage = {
        id: uid(),
        role: "user",
        content: text,
        kind: "text",
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      try {
        let result: { data: GenerationResult };

        if (!workflow) {
          // ── First message: generate new workflow ──────────────────────────
          result = await request<{ data: GenerationResult }>(
            apiUrl("/ai/generate-workflow"),
            { method: "POST", body: JSON.stringify({ prompt: text }) }
          );
        } else {
          // ── Follow-up: update existing workflow ───────────────────────────
          const conversationHistory = messages.map((m) => ({
            role: m.role,
            content: m.content,
          }));
          result = await request<{ data: GenerationResult }>(
            apiUrl("/ai/update-workflow"),
            {
              method: "POST",
              body: JSON.stringify({
                currentWorkflow: workflow,
                request: text,
                conversationHistory,
              }),
            }
          );
        }

        const { workflow: newWorkflow, preview, autoFixed, issues } = result.data;

        setWorkflow(newWorkflow);
        setSelectedNodeId(null);

        const isCreate = !workflow;
        const complexity = preview?.estimatedComplexity ?? "medium";
        const actionCount = newWorkflow.actions.length;
        let reply = isCreate
          ? `Created "${newWorkflow.name}" — a ${complexity} workflow with ${actionCount} action${actionCount !== 1 ? "s" : ""}.\n\n${newWorkflow.description}`
          : `Updated "${newWorkflow.name}" — now has ${actionCount} action${actionCount !== 1 ? "s" : ""}.`;

        if (autoFixed && issues.length > 0) {
          reply += `\n\n⚠ Auto-fixed: ${issues.slice(0, 2).join(", ")}`;
        }

        const aiMsg: ChatMessage = {
          id: uid(),
          role: "assistant",
          content: reply,
          kind: isCreate ? "workflow_created" : "workflow_updated",
        };
        setMessages((prev) => [...prev, aiMsg]);
      } catch (err) {
        const errorMsg: ChatMessage = {
          id: uid(),
          role: "assistant",
          content: `Something went wrong: ${(err as Error).message}`,
          kind: "error",
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [workflow, messages]
  );

  // ── Add action shortcut (from + FAB in graph) ─────────────────────────────
  const handleAddAction = useCallback(() => {
    handleSend("Add a send_message action at the end");
  }, [handleSend]);

  // ── Clear conversation ────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    setMessages([]);
    setWorkflow(null);
    setSelectedNodeId(null);
  }, []);

  // ── Direct workflow mutation from PropertiesPanel ─────────────────────────
  const handleUpdateWorkflow = useCallback((updated: WorkflowState) => {
    setWorkflow(updated);
  }, []);

  const handleDeleteAction = useCallback(
    (index: number) => {
      if (!workflow) return;
      const newActions = workflow.actions.filter((_, i) => i !== index);
      setWorkflow({ ...workflow, actions: newActions });
      setSelectedNodeId(null);
    },
    [workflow]
  );

  // ── Save to backend ───────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!workflow) return;
    setSaveState("saving");
    try {
      await request(apiUrl("/ai/save-workflow"), {
        method: "POST",
        body: JSON.stringify({ workflow }),
      });
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);
    } catch {
      setSaveState("idle");
    }
  }, [workflow]);

  // ── Export JSON ───────────────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    if (!workflow) return;
    const blob = new Blob([JSON.stringify(workflow, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${workflow.name.replace(/\s+/g, "-").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [workflow]);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#080808",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div
        style={{
          height: 52,
          background: "#0d0d0d",
          borderBottom: "1px solid #1a1a1a",
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          gap: 12,
          flexShrink: 0,
          zIndex: 10,
        }}
      >
        <Link href="/workflows">
          <button
            style={{
              background: "none",
              border: "1px solid #222",
              borderRadius: 8,
              padding: "5px 10px",
              cursor: "pointer",
              color: "#666",
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 12,
              transition: "all 0.12s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "#444"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "#666"; e.currentTarget.style.borderColor = "#222"; }}
          >
            <ArrowLeft size={13} />
            Back
          </button>
        </Link>

        {/* Logo / title */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 7,
              background: "rgba(255,204,51,0.15)",
              border: "1px solid rgba(255,204,51,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Wand2 size={13} color="#FFCC33" />
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
            AI Workflow Builder
          </span>
        </div>

        {/* Workflow name (editable) */}
        {workflow && (
          <input
            value={workflow.name}
            onChange={(e) =>
              setWorkflow({ ...workflow, name: e.target.value })
            }
            style={{
              background: "none",
              border: "none",
              outline: "none",
              fontSize: 13,
              color: "#888",
              fontWeight: 500,
              fontFamily: "inherit",
              marginLeft: 8,
              flex: 1,
              minWidth: 0,
            }}
            onFocus={(e) => (e.target.style.color = "#fff")}
            onBlur={(e) => (e.target.style.color = "#888")}
          />
        )}

        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {workflow && (
            <button
              onClick={handleExport}
              style={{
                background: "none",
                border: "1px solid #222",
                borderRadius: 8,
                padding: "5px 12px",
                cursor: "pointer",
                color: "#666",
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                gap: 5,
                transition: "all 0.12s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "#444"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "#666"; e.currentTarget.style.borderColor = "#222"; }}
            >
              <Download size={13} />
              Export JSON
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!workflow || saveState === "saving"}
            style={{
              background: workflow ? "#FFCC33" : "#1a1a1a",
              border: "none",
              borderRadius: 8,
              padding: "5px 14px",
              cursor: workflow ? "pointer" : "not-allowed",
              color: workflow ? "#000" : "#444",
              fontSize: 12,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "all 0.12s",
            }}
          >
            {saveState === "saving" ? (
              <Loader2 size={13} className="animate-spin" />
            ) : saveState === "saved" ? (
              <CheckCircle2 size={13} />
            ) : (
              <Save size={13} />
            )}
            {saveState === "saved" ? "Saved!" : "Save"}
          </button>
        </div>
      </div>

      {/* ── 3-panel body ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <ChatPanel
          messages={messages}
          isLoading={isLoading}
          onSend={handleSend}
          onClear={handleClear}
        />

        <ReactFlowProvider>
          <WorkflowGraph
            workflow={workflow}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            onAddAction={handleAddAction}
          />
        </ReactFlowProvider>

        <PropertiesPanel
          workflow={workflow}
          selectedNodeId={selectedNodeId}
          onUpdateWorkflow={handleUpdateWorkflow}
          onDeleteAction={handleDeleteAction}
        />
      </div>
    </div>
  );
}
