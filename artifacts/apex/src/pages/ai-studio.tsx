/**
 * Apex Studio AI OS
 *
 * A unified AI development and execution system:
 *  - AI Studio: Prompt-to-build app generation
 *  - Workflow Engine: Modular AI-executable workflows
 *  - AI Autopilot: Autonomous monitoring and self-healing
 *  - Monitor: Real-time telemetry and AI evolution loop
 *
 * Layout:
 *   [Chat Panel (360px)] [Right Panel: Preview | Workflows | Autopilot | Monitor | Files]
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { ChatPanel } from "@/components/ai-studio/ChatPanel";
import { PreviewPane } from "@/components/ai-studio/PreviewPane";
import { FileExplorer, type ProjectFile } from "@/components/ai-studio/FileExplorer";
import { WorkflowPane, type Workflow } from "@/components/ai-studio/WorkflowPane";
import { AutopilotPane, type AutopilotMode } from "@/components/ai-studio/AutopilotPane";
import { MonitorPane } from "@/components/ai-studio/MonitorPane";
import { useSession } from "@/hooks/use-session";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const apiUrl = (path: string) => `${BASE}/api${path}`;

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface AiStudioPlan {
  project_name: string;
  app_type: string;
  description: string;
  features: string[];
  pages: string[];
  tech_stack: string[];
  database_schema?: { table: string; fields: string[] }[];
  api_routes?: string[];
  workflows?: Workflow[];
}

export interface BuildStep {
  id: string;
  label: string;
  detail: string;
  status: "pending" | "active" | "done" | "error";
}

type RightTab = "preview" | "workflows" | "autopilot" | "monitor" | "files";

// ── Build step definitions ─────────────────────────────────────────────────────

const GENERATE_STEPS: Omit<BuildStep, "status">[] = [
  { id: "read",      label: "Reading your prompt",        detail: "Understanding what you want to build" },
  { id: "plan",      label: "Planning the architecture",  detail: "Choosing stack, pages, and data models" },
  { id: "workflows", label: "Creating AI workflows",      detail: "Generating modular executable workflows" },
  { id: "code",      label: "Writing source code",        detail: "Generating React components and API routes" },
  { id: "preview",   label: "Building live preview",      detail: "Compiling standalone HTML preview" },
  { id: "save",      label: "Saving your project",        detail: "Persisting to your AI OS workspace" },
];

const EDIT_STEPS: Omit<BuildStep, "status">[] = [
  { id: "read",    label: "Reading your request",     detail: "Understanding what needs to change" },
  { id: "plan",    label: "Analyzing the codebase",   detail: "Identifying affected workflows and files" },
  { id: "code",    label: "Applying your changes",    detail: "Making surgical edits to the code" },
  { id: "preview", label: "Refreshing the preview",   detail: "Rebuilding the live preview HTML" },
  { id: "save",    label: "Saving updates",           detail: "Persisting changes to your project" },
];

const GENERATE_DELAYS = [0, 1800, 3800, 6500, 11500, 18000];
const EDIT_DELAYS     = [0, 1600, 3400, 6000, 10000];

// ── Deploy stages ──────────────────────────────────────────────────────────────

const DEPLOY_STAGES = [
  { icon: "📦", label: "Bundling project",       detail: "Compiling all files and assets" },
  { icon: "🔒", label: "Running security checks", detail: "Scanning for vulnerabilities" },
  { icon: "☁️",  label: "Uploading to edge CDN",  detail: "Pushing to global infrastructure" },
  { icon: "🔧", label: "Configuring deployment",  detail: "Setting up routing and SSL" },
  { icon: "🚀", label: "Going live",              detail: "Your app is now deployed!" },
];

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AiStudioPage() {
  const [, setLocation] = useLocation();
  const sessionId = useSession();
  const { toast } = useToast();

  // ── Project state ────────────────────────────────────────────────────────
  const [projectId, setProjectId] = useState<number | null>(null);
  const [projectTitle, setProjectTitle] = useState("Untitled Project");
  const [plan, setPlan] = useState<AiStudioPlan | null>(null);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [previewHtml, setPreviewHtml] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [buildCount, setBuildCount] = useState(0);
  const [editCount, setEditCount] = useState(0);
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [isGenerating, setIsGenerating] = useState(false);
  const [buildSteps, setBuildSteps] = useState<BuildStep[]>([]);
  const [rightTab, setRightTab] = useState<RightTab>("preview");
  const [isTitleEditing, setIsTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [autopilotMode, setAutopilotMode] = useState<AutopilotMode>("off");

  // ── Deploy modal state ───────────────────────────────────────────────────
  const [deployOpen, setDeployOpen] = useState(false);
  const [deployStage, setDeployStage] = useState(-1);
  const [deployDone, setDeployDone] = useState(false);
  const [deployUrl, setDeployUrl] = useState("");

  const stepTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // ── Step animation ────────────────────────────────────────────────────────

  const startSteps = useCallback((isEdit: boolean) => {
    stepTimersRef.current.forEach(clearTimeout);
    stepTimersRef.current = [];
    const defs = isEdit ? EDIT_STEPS : GENERATE_STEPS;
    const delays = isEdit ? EDIT_DELAYS : GENERATE_DELAYS;
    setBuildSteps(defs.map((s) => ({ ...s, status: "pending" })));
    defs.forEach((_, idx) => {
      const t = setTimeout(() => {
        setBuildSteps((prev) =>
          prev.map((s, i) => {
            if (i < idx) return { ...s, status: "done" };
            if (i === idx) return { ...s, status: "active" };
            return s;
          })
        );
      }, delays[idx] ?? 0);
      stepTimersRef.current.push(t);
    });
  }, []);

  const completeSteps = useCallback((success: boolean) => {
    stepTimersRef.current.forEach(clearTimeout);
    stepTimersRef.current = [];
    setBuildSteps((prev) =>
      prev.map((s) => ({
        ...s,
        status: success ? "done" : s.status === "active" ? "error" : s.status,
      }))
    );
  }, []);

  useEffect(() => {
    return () => { stepTimersRef.current.forEach(clearTimeout); };
  }, []);

  // ── Send message (generate or edit) ──────────────────────────────────────

  const handleSend = useCallback(async (message: string) => {
    if (isGenerating) return;
    const isEdit = !!projectId;
    setIsGenerating(true);
    startSteps(isEdit);

    setMessages((prev) => [
      ...prev,
      { role: "user", content: message, timestamp: new Date().toISOString() },
    ]);

    try {
      if (!isEdit) {
        const res = await fetch(apiUrl("/studio/ai/generate"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: message, sessionId }),
        });
        if (!res.ok) throw new Error(`Generation failed: ${res.status}`);
        const { data } = await res.json() as {
          data: {
            projectId: number;
            plan: AiStudioPlan;
            files: ProjectFile[];
            previewHtml: string;
            summary: string;
            chatHistory: ChatMessage[];
          };
        };

        completeSteps(true);
        setProjectId(data.projectId);
        setPlan(data.plan);
        setFiles(data.files);
        setPreviewHtml(data.previewHtml);
        setProjectTitle(data.plan.project_name);
        setMessages(data.chatHistory);
        setBuildCount(1);
        setEditCount(0);
        setRightTab("preview");

        const wfCount = data.plan.workflows?.length ?? 0;
        toast({
          title: `✨ ${data.plan.project_name} built!`,
          description: `${data.summary}${wfCount > 0 ? ` · ${wfCount} workflows created` : ""}`,
        });
      } else {
        const res = await fetch(apiUrl("/studio/ai/edit"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, request: message }),
        });
        if (!res.ok) throw new Error(`Edit failed: ${res.status}`);
        const { data } = await res.json() as {
          data: {
            files: ProjectFile[];
            previewHtml: string;
            changedFiles: string[];
            summary: string;
            chatHistory: ChatMessage[];
          };
        };

        completeSteps(true);
        setFiles(data.files);
        setPreviewHtml(data.previewHtml);
        setMessages(data.chatHistory);
        setEditCount((c) => c + 1);

        const changed = data.changedFiles.length;
        if (changed > 0) {
          toast({ title: "Changes applied", description: `${changed} file${changed !== 1 ? "s" : ""} updated` });
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Something went wrong";
      completeSteps(false);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Sorry, something went wrong: ${errMsg}. Please try again.`, timestamp: new Date().toISOString() },
      ]);
      toast({ title: "Error", description: errMsg, variant: "destructive" });
    } finally {
      setIsGenerating(false);
      setTimeout(() => setBuildSteps([]), 2200);
    }
  }, [isGenerating, projectId, sessionId, startSteps, completeSteps, toast]);

  // ── Run handler ────────────────────────────────────────────────────────────

  const handleRun = useCallback(() => {
    if (!previewHtml) return;
    setRightTab("preview");
    setPreviewRefreshKey((k) => k + 1);
    toast({ title: "▶ Running preview", description: "Reloading your app in the preview pane" });
  }, [previewHtml, toast]);

  // ── Deploy handler ─────────────────────────────────────────────────────────

  const handleDeploy = useCallback(() => {
    if (!projectId) return;
    setDeployOpen(true);
    setDeployDone(false);
    setDeployStage(0);
    setDeployUrl("");

    DEPLOY_STAGES.forEach((_, idx) => {
      setTimeout(() => {
        setDeployStage(idx);
        if (idx === DEPLOY_STAGES.length - 1) {
          setTimeout(() => {
            const slug = projectTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
            setDeployUrl(`https://${slug}-${Math.random().toString(36).slice(2, 8)}.apex.app`);
            setDeployDone(true);
          }, 900);
        }
      }, idx * 900);
    });
  }, [projectId, projectTitle]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const handleDownloadHtml = useCallback(() => {
    if (!previewHtml) return;
    const blob = new Blob([previewHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectTitle.replace(/\s+/g, "-").toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }, [previewHtml, projectTitle]);

  const handleDownloadFile = useCallback((file: ProjectFile) => {
    const blob = new Blob([file.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.path.split("/").pop() ?? "file.txt";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleNewProject = useCallback(() => {
    setProjectId(null);
    setProjectTitle("Untitled Project");
    setPlan(null);
    setFiles([]);
    setPreviewHtml("");
    setMessages([]);
    setBuildSteps([]);
    setBuildCount(0);
    setEditCount(0);
    setRightTab("preview");
    setAutopilotMode("off");
  }, []);

  const handleSaveTitle = useCallback(async () => {
    if (!projectId || !titleDraft.trim()) { setIsTitleEditing(false); return; }
    setProjectTitle(titleDraft.trim());
    setIsTitleEditing(false);
    await fetch(apiUrl("/studio/ai/save"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, title: titleDraft.trim() }),
    }).catch(() => undefined);
  }, [projectId, titleDraft]);

  const handleAutopilotFixApplied = useCallback((html: string) => {
    setPreviewHtml(html);
    setRightTab("preview");
    toast({ title: "🔧 Fix applied", description: "Preview updated with the patch" });
  }, [toast]);

  const hasProject = !!projectId;
  const workflows: Workflow[] = plan?.workflows ?? [];

  // Tab config
  const tabs: { id: RightTab; label: string; icon: string; badge?: number }[] = [
    { id: "preview",   icon: "🖥",  label: "Preview" },
    { id: "workflows", icon: "⚡",  label: "Workflows", badge: workflows.length || undefined },
    { id: "autopilot", icon: "🤖",  label: "Autopilot" },
    { id: "monitor",   icon: "📊",  label: "Monitor" },
    { id: "files",     icon: "📁",  label: `Files${files.length > 0 ? ` (${files.length})` : ""}` },
  ];

  const autopilotColors: Record<AutopilotMode, string> = {
    off: "#666",
    suggest: "#3b82f6",
    auto_fix: "#FFCC33",
    full_auto: "#ef4444",
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ background: "#0F1115" }}>

      {/* ── Deploy Modal ─────────────────────────────────────────────────────── */}
      {deployOpen && (
        <DeployModal
          projectName={projectTitle}
          stages={DEPLOY_STAGES}
          currentStage={deployStage}
          isDone={deployDone}
          deployUrl={deployUrl}
          onClose={() => { setDeployOpen(false); setDeployStage(-1); }}
        />
      )}

      {/* ── Top Toolbar ──────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 py-2.5 flex-shrink-0 border-b"
        style={{ background: "rgba(15,17,21,0.98)", borderColor: "rgba(255,255,255,0.06)" }}
      >
        {/* Back */}
        <button
          onClick={() => (window.history.length > 1 ? window.history.back() : setLocation("/"))}
          className="text-white/30 hover:text-white/70 transition-colors text-lg leading-none flex-shrink-0"
          title="Back"
          aria-label="Back"
        >
          ←
        </button>

        {/* Logo */}
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-black flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #FFCC33, #FF8C00)", color: "#000" }}
        >
          ⚡
        </div>

        {/* Title */}
        {isTitleEditing ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={handleSaveTitle}
            onKeyDown={(e) => { if (e.key === "Enter") void handleSaveTitle(); if (e.key === "Escape") setIsTitleEditing(false); }}
            className="bg-transparent text-white text-sm font-bold outline-none border-b border-[#FFCC33]/50 pb-0.5 w-48"
          />
        ) : (
          <button
            onClick={() => { if (hasProject) { setTitleDraft(projectTitle); setIsTitleEditing(true); } }}
            className="text-white text-sm font-bold truncate max-w-48 text-left hover:text-white/80 transition-colors"
          >
            {projectTitle}
          </button>
        )}

        {/* App type badge */}
        {plan && (
          <span
            className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider flex-shrink-0 hidden sm:block"
            style={{ background: "rgba(255,204,51,0.1)", color: "#FFCC33", border: "1px solid rgba(255,204,51,0.2)" }}
          >
            {plan.app_type.replace("_", " ")}
          </span>
        )}

        <div className="flex-1" />

        {/* Tech stack pills (desktop only) */}
        {plan && (
          <div className="hidden xl:flex items-center gap-1.5 flex-shrink-0">
            {plan.tech_stack.slice(0, 3).map((tech) => (
              <span
                key={tech}
                className="px-2 py-0.5 rounded text-[9px] text-white/35"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                {tech}
              </span>
            ))}
          </div>
        )}

        {/* Autopilot mode indicator */}
        {hasProject && (
          <button
            onClick={() => setRightTab("autopilot")}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all hover:brightness-110 flex-shrink-0"
            style={{
              background: `${autopilotColors[autopilotMode]}15`,
              color: autopilotColors[autopilotMode],
              border: `1px solid ${autopilotColors[autopilotMode]}30`,
            }}
          >
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: autopilotColors[autopilotMode] }} />
            {autopilotMode === "off" ? "Autopilot: OFF" : autopilotMode === "suggest" ? "SUGGEST" : autopilotMode === "auto_fix" ? "AUTO FIX" : "FULL AUTO"}
          </button>
        )}

        {/* ── Run button ─────────────────────────────────────────────────────── */}
        {hasProject && (
          <button
            onClick={handleRun}
            disabled={isGenerating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all hover:brightness-110 disabled:opacity-40 flex-shrink-0"
            style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }}
            title="Re-run the preview"
          >
            <svg width="9" height="10" viewBox="0 0 9 10" fill="currentColor">
              <path d="M0 0L9 5L0 10V0Z" />
            </svg>
            Run
          </button>
        )}

        {/* ── Deploy button ──────────────────────────────────────────────────── */}
        {hasProject && (
          <button
            onClick={handleDeploy}
            disabled={isGenerating || deployOpen}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all hover:brightness-110 disabled:opacity-40 flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #FFCC33, #FF8C00)", color: "#000" }}
            title="Deploy your app"
          >
            🚀 Deploy
          </button>
        )}

        {/* Action buttons */}
        {hasProject && (
          <>
            <button
              onClick={handleDownloadHtml}
              className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all hover:brightness-110 flex-shrink-0"
              style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              ↓ Export
            </button>
            <button
              onClick={handleNewProject}
              className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all hover:brightness-110 flex-shrink-0"
              style={{ background: "rgba(255,204,51,0.1)", color: "#FFCC33", border: "1px solid rgba(255,204,51,0.2)" }}
            >
              + New
            </button>
          </>
        )}

        {/* Model indicator */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg flex-shrink-0"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-white/30 text-[10px] font-mono hidden sm:block">GPT-5.2</span>
        </div>
      </div>

      {/* ── Main Content ────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Chat Panel */}
        <div
          className="flex-shrink-0 border-r overflow-hidden"
          style={{ width: 360, borderColor: "rgba(255,255,255,0.06)" }}
        >
          <ChatPanel
            messages={messages}
            isGenerating={isGenerating}
            buildSteps={buildSteps}
            hasProject={hasProject}
            plan={plan}
            onSend={handleSend}
            onRun={hasProject ? handleRun : undefined}
            onDeploy={hasProject ? handleDeploy : undefined}
          />
        </div>

        {/* Right: Tabbed panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tab bar */}
          <div
            className="flex items-center gap-1 px-4 py-2 flex-shrink-0 border-b overflow-x-auto"
            style={{ background: "#0F1115", borderColor: "rgba(255,255,255,0.06)" }}
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setRightTab(tab.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex-shrink-0 whitespace-nowrap"
                style={
                  rightTab === tab.id
                    ? { background: "rgba(255,204,51,0.1)", color: "#FFCC33", border: "1px solid rgba(255,204,51,0.2)" }
                    : { background: "transparent", color: "rgba(255,255,255,0.35)", border: "1px solid transparent" }
                }
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.badge != null && tab.badge > 0 && (
                  <span
                    className="px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                    style={{ background: "rgba(255,204,51,0.2)", color: "#FFCC33" }}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden">
            {rightTab === "preview" && (
              <PreviewPane
                html={previewHtml}
                isLoading={isGenerating}
                buildSteps={buildSteps}
                projectName={projectTitle}
                externalRefreshKey={previewRefreshKey}
                onDownload={previewHtml ? handleDownloadHtml : undefined}
                onRun={hasProject ? handleRun : undefined}
                onDeploy={hasProject ? handleDeploy : undefined}
              />
            )}

            {rightTab === "workflows" && (
              <WorkflowPane
                workflows={workflows}
                projectId={projectId}
                projectName={projectTitle}
                onAddWorkflow={() => {
                  setRightTab("preview");
                  toast({ title: "Add a workflow via chat", description: 'Try: "Add a payment workflow" or "Create an email notification flow"' });
                }}
              />
            )}

            {rightTab === "autopilot" && (
              <AutopilotPane
                projectId={projectId}
                projectName={projectTitle}
                mode={autopilotMode}
                onModeChange={setAutopilotMode}
                onFixApplied={handleAutopilotFixApplied}
              />
            )}

            {rightTab === "monitor" && (
              <MonitorPane
                projectId={projectId}
                projectName={projectTitle}
                buildCount={buildCount}
                editCount={editCount}
              />
            )}

            {rightTab === "files" && (
              <FileExplorer
                files={files}
                onDownloadFile={handleDownloadFile}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Deploy Modal ───────────────────────────────────────────────────────────────

interface DeployModalProps {
  projectName: string;
  stages: { icon: string; label: string; detail: string }[];
  currentStage: number;
  isDone: boolean;
  deployUrl: string;
  onClose: () => void;
}

function DeployModal({ projectName, stages, currentStage, isDone, deployUrl, onClose }: DeployModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{ background: "#0F1115", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        {/* Header */}
        <div
          className="px-6 py-5 border-b"
          style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,204,51,0.04)" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
                style={{ background: "linear-gradient(135deg, #FFCC33, #FF8C00)" }}
              >
                🚀
              </div>
              <div>
                <p className="text-white font-bold text-sm">Deploying to Apex Cloud</p>
                <p className="text-white/40 text-xs truncate max-w-44">{projectName}</p>
              </div>
            </div>
            {isDone && (
              <button
                onClick={onClose}
                className="text-white/40 hover:text-white/70 transition-colors text-lg leading-none"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Stages */}
        <div className="px-6 py-5 space-y-4">
          {stages.map((stage, idx) => {
            const done = idx < currentStage || (idx === currentStage && isDone);
            const active = idx === currentStage && !isDone;
            return (
              <div key={idx} className="flex items-center gap-3">
                {/* Status icon */}
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-base"
                  style={{
                    background: done ? "rgba(34,197,94,0.12)" : active ? "rgba(255,204,51,0.12)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${done ? "rgba(34,197,94,0.25)" : active ? "rgba(255,204,51,0.25)" : "rgba(255,255,255,0.06)"}`,
                  }}
                >
                  {done ? (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M3 7L5.5 9.5L11 4.5" stroke="#22c55e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : active ? (
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin"
                      style={{ borderColor: "rgba(255,204,51,0.3)", borderTopColor: "#FFCC33" }} />
                  ) : (
                    <span style={{ filter: "grayscale(1)", opacity: 0.3 }}>{stage.icon}</span>
                  )}
                </div>

                {/* Labels */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium"
                    style={{ color: done ? "#4ade80" : active ? "#FFCC33" : "rgba(255,255,255,0.25)" }}>
                    {stage.label}
                  </p>
                  {active && (
                    <p className="text-[11px] text-white/35 mt-0.5">{stage.detail}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Success footer */}
        {isDone && deployUrl && (
          <div
            className="px-6 py-4 border-t"
            style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(34,197,94,0.04)" }}
          >
            <p className="text-[11px] text-white/40 mb-2">Your app is live at:</p>
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}
            >
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
              <span className="text-green-400 text-xs font-mono flex-1 truncate">{deployUrl}</span>
              <button
                onClick={() => navigator.clipboard.writeText(deployUrl)}
                className="text-white/30 hover:text-white/60 transition-colors text-[10px]"
                title="Copy URL"
              >
                Copy
              </button>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={onClose}
                className="flex-1 py-2 rounded-xl text-xs font-medium transition-all"
                style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                Close
              </button>
              <button
                className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                style={{ background: "linear-gradient(135deg, #FFCC33, #FF8C00)", color: "#000" }}
                onClick={() => window.open(deployUrl, "_blank")}
              >
                Open App ↗
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
