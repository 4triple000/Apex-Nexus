import { useState, useCallback, useRef, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import {
  useStudioProjects, useCreateStudioProject, useSaveStudioProject,
  useDeleteStudioProject, useRunStudioProject,
  type StudioProject, type StudioNode, type StudioEdge,
  type StudioViewport, type ProjectType, type ExecStep,
} from "@/hooks/useStudio";
import { usePublishToMarketplace } from "@/hooks/useStudioMarketplace";
import { useCollaboration } from "@/hooks/useCollaboration";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "@/hooks/use-session";
import { useMyProfile } from "@/hooks/useSocial";
import { StudioCanvasV2 } from "@/components/studio/StudioCanvasV2";
import { NodeLibrary } from "@/components/studio/NodeLibrary";
import { PropertiesPanel } from "@/components/studio/PropertiesPanel";
import { NODE_DEF_MAP } from "@/components/studio/nodeDefinitions";
import { AutopilotPanel } from "@/components/studio/AutopilotPanel";
import { type AutopilotResult } from "@/hooks/useAutopilot";
import { GameForge } from "@/components/studio/GameForge";

const GOLD = "#ffcc33";
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const PROJECT_TYPES: { value: ProjectType; label: string; icon: string; color: string }[] = [
  { value: "game", label: "Game", icon: "🎮", color: "#34d399" },
  { value: "ai_tool", label: "AI Tool", icon: "🤖", color: "#a78bfa" },
  { value: "app", label: "App", icon: "📱", color: "#38bdf8" },
  { value: "automation", label: "Automation", icon: "⚡", color: "#fbbf24" },
  { value: "media", label: "Media", icon: "🎬", color: "#f87171" },
];

function delay(ms: number) { return new Promise<void>((r) => setTimeout(r, ms)); }

// ─────────────────────────────────────────────────────────────
// DEBUG CONSOLE
// ─────────────────────────────────────────────────────────────
function DebugConsole({
  logs, isRunning, finalOutput, onClear,
}: {
  logs: ExecStep[];
  isRunning: boolean;
  finalOutput?: string;
  onClear: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className="flex flex-col border-t overflow-hidden flex-shrink-0"
      style={{ background: "rgba(10,12,18,0.97)", borderColor: "rgba(255,255,255,0.07)", height: 180 }}
    >
      <div className="flex items-center gap-3 px-4 py-1.5 border-b border-white/5 flex-shrink-0">
        <div className="flex gap-1.5 items-center">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
        </div>
        <span className="text-[10px] font-mono text-white/30 tracking-widest uppercase">Execution Console</span>
        {isRunning && (
          <div className="flex items-center gap-1.5 ml-1">
            <div className="w-1.5 h-1.5 rounded-full bg-[#ffcc33] animate-pulse" />
            <span className="text-[9px] font-mono text-[#ffcc33]">Running</span>
          </div>
        )}
        {logs.length > 0 && (
          <button onClick={onClear} className="ml-auto text-[9px] text-white/20 hover:text-white/50 transition-colors">
            clear
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-1.5 font-mono">
        {logs.length === 0 && !isRunning && (
          <p className="text-white/15 text-[10px]">$ Run a project to see execution output here...</p>
        )}
        {logs.map((log, i) => {
          const def = NODE_DEF_MAP[log.nodeType];
          return (
            <div key={i} className="flex items-start gap-2">
              <span className="text-white/20 text-[9px] w-4 flex-shrink-0">{i + 1}</span>
              <span
                className="text-[9px] flex-shrink-0 whitespace-nowrap"
                style={{ color: log.success ? (def?.color ?? "#ffffff40") : "#f87171" }}
              >
                [{def?.icon ?? "⚡"} {log.label}]
              </span>
              <span className="text-[9px] text-white/60 leading-relaxed break-all">{log.output.slice(0, 160)}</span>
            </div>
          );
        })}
        {finalOutput && !isRunning && (
          <div className="mt-2 pt-2 border-t border-white/5 flex items-start gap-2">
            <span className="text-[9px] text-[#ffcc33] flex-shrink-0">$ OUTPUT →</span>
            <span className="text-[9px] text-[#ffcc33]/80 leading-relaxed break-all">{finalOutput.slice(0, 300)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CANVAS EDITOR V2
// ─────────────────────────────────────────────────────────────
function CanvasEditorV2({
  project,
  onClose,
  autoRun = false,
}: {
  project: StudioProject;
  onClose: () => void;
  autoRun?: boolean;
}) {
  // ── Core graph state ─────────────────────────────────────────
  const [nodes, setNodes] = useState<StudioNode[]>(() => (project.nodes ?? []).map((n) => ({ ...n })));
  const [edges, setEdges] = useState<StudioEdge[]>(() => (project.edges ?? []).map((e) => ({ ...e })));

  // ── Viewport: start from saved, update on pan/zoom ────────────
  const [currentViewport, setCurrentViewport] = useState<StudioViewport | null>(
    project.viewport ?? null
  );

  // ── UI state ──────────────────────────────────────────────────
  const [selectedNode, setSelectedNode] = useState<StudioNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<StudioEdge | null>(null);
  const [showLibrary, setShowLibrary] = useState(true);
  const [showProps, setShowProps] = useState(true);
  const [showConsole, setShowConsole] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  // ── Execution state ───────────────────────────────────────────
  const [executionState, setExecutionState] = useState<
    Map<string, { status: "active" | "complete" | "error"; output?: string }>
  >(new Map());
  const [consoleLogs, setConsoleLogs] = useState<ExecStep[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [finalOutput, setFinalOutput] = useState<string | undefined>();
  const [runInputs, setRunInputs] = useState<Record<string, string>>({});
  const [showInputModal, setShowInputModal] = useState(false);

  const save = useSaveStudioProject();
  const runProject = useRunStudioProject();
  const publishMutation = usePublishToMarketplace();
  const { toast } = useToast();
  const sessionId = useSession();
  const { data: meData } = useMyProfile();
  const executionAbortRef = useRef(false);

  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishDesc, setPublishDesc] = useState("");
  const [showAutopilot, setShowAutopilot] = useState(false);

  // ── Collaboration ─────────────────────────────────────────────
  const collab = useCollaboration(project.id, nodes, edges);
  const [shareToast, setShareToast] = useState(false);
  const edgesRef = useRef(edges);
  edgesRef.current = edges;

  // Handle remote node/edge changes — update state WITHOUT re-emitting
  const handleRemoteChange = useCallback((newNodes: StudioNode[], newEdges: StudioEdge[]) => {
    setNodes(newNodes);
    setEdges(newEdges);
  }, []);

  useEffect(() => {
    collab.setRemoteChangeHandler(handleRemoteChange);
    return () => collab.setRemoteChangeHandler(null);
  }, [collab.setRemoteChangeHandler, handleRemoteChange]);

  const inputNodes = nodes.filter((n) => n.type === "user_input" || n.type === "player_input");

  // executeWithAnimation declared later — use ref for pre-declaration callbacks
  const execAnimRef = useRef<((inputs?: Record<string, string>) => Promise<void>) | null>(null);
  const autoRunFired = useRef(false);

  // ── Autopilot: load generated graph into editor ────────────────
  const handleAutopilotGenerated = useCallback((result: AutopilotResult) => {
    const newNodes = (result.nodes as StudioNode[]).map((n) => ({ ...n }));
    const newEdges = (result.edges as StudioEdge[]).map((e) => ({ ...e }));
    setNodes(newNodes);
    setEdges(newEdges);
    setSelectedNode(null);
    setSelectedEdge(null);
    setShowAutopilot(false);
    setTimeout(() => { void execAnimRef.current?.({}); }, 600);
  }, []);

  // ── Graph mutation handlers ───────────────────────────────────
  const addNode = useCallback((partial: Omit<StudioNode, "x" | "y">) => {
    // Place new nodes in a cascading grid, avoid the top-left corner occupied by early nodes
    setNodes((prev) => {
      const col = prev.length % 4;
      const row = Math.floor(prev.length / 4);
      const newNode: StudioNode = { ...partial, x: 80 + col * 240, y: 80 + row * 180 };
      return [...prev, newNode];
    });
  }, []);

  const handleNodesChange = useCallback((updated: StudioNode[]) => {
    setNodes(updated);
    setSelectedNode((sel) => (sel ? (updated.find((n) => n.id === sel.id) ?? null) : null));
    collab.emitNodesChange(updated, edgesRef.current);
  }, [collab.emitNodesChange]);

  const handleEdgesChange = useCallback((updated: StudioEdge[]) => {
    setEdges(updated);
    setSelectedEdge((sel) => (sel ? (updated.find((e) => e.id === sel.id) ?? null) : null));
    collab.emitNodesChange(nodes, updated);
  }, [collab.emitNodesChange, nodes]);

  const handleViewportChange = useCallback((vp: StudioViewport) => {
    setCurrentViewport(vp);
  }, []);

  const updateNodeData = useCallback((id: string, data: Record<string, string | number | boolean>) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, data } : n)));
    setSelectedNode((prev) => (prev?.id === id ? { ...prev, data } : prev));
  }, []);

  const deleteNode = useCallback((id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setEdges((prev) => prev.filter((e) => e.from !== id && e.to !== id));
    setSelectedNode(null);
  }, []);

  const deleteEdge = useCallback((id: string) => {
    setEdges((prev) => prev.filter((e) => e.id !== id));
    setSelectedEdge(null);
  }, []);

  // ── Save: includes viewport ───────────────────────────────────
  const handleSave = useCallback(async (currentNodes = nodes, currentEdges = edges) => {
    setSaveStatus("saving");
    try {
      await save.mutateAsync({
        id: project.id,
        title: project.title,
        type: project.type,
        thumbnail: project.thumbnail,
        nodes: currentNodes,
        edges: currentEdges,
        viewport: currentViewport ?? undefined,
      });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2500);
    } catch {
      setSaveStatus("idle");
    }
  }, [save, project.id, project.title, project.type, project.thumbnail, nodes, edges, currentViewport]);

  // ── Execution ─────────────────────────────────────────────────
  const executeWithAnimation = useCallback(async (inputs: Record<string, string> = {}) => {
    if (isRunning) return; // Guard against double-run

    setIsRunning(true);
    setShowConsole(true);
    setConsoleLogs([]);
    setFinalOutput(undefined);
    setExecutionState(new Map());
    executionAbortRef.current = false;

    // Auto-save before run to ensure server has latest graph
    await save.mutateAsync({
      id: project.id,
      title: project.title,
      type: project.type,
      thumbnail: project.thumbnail,
      nodes,
      edges,
      viewport: currentViewport ?? undefined,
    }).catch(() => {}); // Non-fatal — still attempt run

    try {
      const result = await runProject.mutateAsync({ id: project.id, inputs });
      const completed = new Map<string, { status: "active" | "complete" | "error"; output?: string }>();

      for (const step of result.executionLog) {
        if (executionAbortRef.current) break;

        // Highlight active node
        completed.set(step.nodeId, { status: "active", output: step.output });
        setExecutionState(new Map(completed));
        setConsoleLogs((prev) => [...prev, step]);

        await delay(550);
        if (executionAbortRef.current) break;

        // Settle node to complete/error
        completed.set(step.nodeId, {
          status: step.success ? "complete" : "error",
          output: step.output,
        });
        setExecutionState(new Map(completed));
      }

      setFinalOutput(result.finalOutput);
    } catch (err) {
      const errMsg = (err as Error).message;
      setConsoleLogs((prev) => [
        ...prev,
        { nodeId: "error", nodeType: "error", label: "Error", output: errMsg, success: false },
      ]);
    } finally {
      setIsRunning(false);
    }
  }, [isRunning, save, runProject, project, nodes, edges, currentViewport]);

  // Keep ref in sync so pre-declaration callbacks can call it
  execAnimRef.current = executeWithAnimation;

  // Auto-run on mount when autoRun prop is set (for autopilot-created projects)
  useEffect(() => {
    if (autoRun && !autoRunFired.current && nodes.length > 0) {
      autoRunFired.current = true;
      const timer = setTimeout(() => void executeWithAnimation({}), 1000);
      return () => clearTimeout(timer);
    }
    return undefined;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun, nodes.length]);

  const handleRunClick = useCallback(() => {
    if (isRunning) return;
    if (inputNodes.length > 0) {
      // Pre-fill defaults
      setRunInputs(
        Object.fromEntries(
          inputNodes.map((n) => [
            n.type === "player_input" ? "playerInput" : "userInput",
            String(n.data.value ?? n.data.default ?? ""),
          ])
        )
      );
      setShowInputModal(true);
    } else {
      void executeWithAnimation({});
    }
  }, [isRunning, inputNodes, executeWithAnimation]);

  const typeInfo = PROJECT_TYPES.find((t) => t.value === project.type);

  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ background: "#0F1115", paddingBottom: 64 }}>
      {/* Top toolbar */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 flex-shrink-0 border-b"
        style={{ background: "rgba(15,17,21,0.98)", borderColor: "rgba(255,255,255,0.06)" }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-base flex-shrink-0"
          style={{ background: `${typeInfo?.color ?? GOLD}18`, border: `1px solid ${typeInfo?.color ?? GOLD}25` }}
        >
          {project.thumbnail}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-xs truncate leading-tight">{project.title}</p>
          <p className="text-white/30 text-[8px] font-mono capitalize">
            {project.type.replace("_", " ")} · {nodes.length}n · {edges.length}e
          </p>
        </div>

        {/* Panel toggles */}
        <div className="flex items-center gap-1 border-r border-white/8 pr-2 mr-1">
          {[
            { key: "lib", label: "Nodes", active: showLibrary, toggle: () => setShowLibrary((p) => !p) },
            { key: "con", label: "Console", active: showConsole, toggle: () => setShowConsole((p) => !p) },
            { key: "prop", label: "Props", active: showProps, toggle: () => setShowProps((p) => !p) },
          ].map((p) => (
            <button
              key={p.key}
              onClick={p.toggle}
              className="px-2 py-1 rounded-md text-[9px] font-mono font-bold transition-all"
              style={
                p.active
                  ? { background: "rgba(255,204,51,0.12)", color: GOLD }
                  : { background: "transparent", color: "rgba(255,255,255,0.25)" }
              }
            >
              {p.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => void handleSave()}
          disabled={save.isPending}
          className="px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-bold transition-all"
          style={{
            background: "rgba(255,255,255,0.05)",
            color: saveStatus === "saved" ? "#4ade80" : "rgba(255,255,255,0.4)",
          }}
        >
          {saveStatus === "saving" ? "…" : saveStatus === "saved" ? "✓" : "💾"}
        </button>

        <button
          onClick={() => { setPublishDesc(project.description ?? ""); setShowPublishModal(true); }}
          disabled={nodes.length === 0}
          title="Publish to Marketplace"
          className="px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-bold transition-all disabled:opacity-30"
          style={{
            background: project.isPublished ? "rgba(74,222,128,0.1)" : "rgba(255,255,255,0.05)",
            color: project.isPublished ? "#4ade80" : "rgba(255,255,255,0.4)",
          }}
        >
          {project.isPublished ? "✓ Pub" : "📤"}
        </button>

        {/* Collaborator avatars */}
        {collab.collaborators.length > 0 && (
          <div className="flex items-center gap-0.5 border-r border-white/8 pr-2 mr-1">
            {collab.collaborators.slice(0, 4).map((c) => (
              <div
                key={c.socketId}
                title={c.name}
                className="w-5 h-5 rounded-full border-2 border-[#04080f] flex items-center justify-center text-[8px] font-black text-black"
                style={{ background: c.color, borderColor: c.color + "40" }}
              >
                {c.name.slice(0, 1)}
              </div>
            ))}
            {collab.collaborators.length > 4 && (
              <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[7px] text-white/60 font-bold">
                +{collab.collaborators.length - 4}
              </div>
            )}
          </div>
        )}

        {/* Autopilot button */}
        <button
          onClick={() => setShowAutopilot(true)}
          title="AI Autopilot — regenerate from a prompt"
          className="px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-bold transition-all hover:brightness-110"
          style={{ background: "rgba(255,204,51,0.1)", color: GOLD }}
        >
          ✨ AI
        </button>

        {/* Share / collab button */}
        <button
          onClick={() => {
            const url = `${window.location.origin}${BASE}/studio?project=${project.id}`;
            void navigator.clipboard.writeText(url).then(() => {
              setShareToast(true);
              setTimeout(() => setShareToast(false), 2500);
            });
          }}
          title="Copy share link"
          className="relative px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-bold transition-all"
          style={{
            background: collab.isConnected ? "rgba(78,205,196,0.1)" : "rgba(255,255,255,0.05)",
            color: collab.isConnected ? "#4ecdc4" : "rgba(255,255,255,0.4)",
          }}
        >
          {shareToast ? "✓" : collab.isConnected ? "🔗" : "🔗"}
          {collab.isConnected && (
            <span
              className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: "#4ecdc4" }}
            />
          )}
        </button>

        <button
          onClick={handleRunClick}
          disabled={isRunning || nodes.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black text-black transition-all disabled:opacity-40 hover:brightness-110 active:scale-95"
          style={{ background: GOLD }}
        >
          {isRunning ? (
            <><div className="w-2.5 h-2.5 rounded-full border-2 border-black/40 border-t-black animate-spin" /> Running</>
          ) : (
            <><span>▶</span> Run</>
          )}
        </button>
      </div>

      {/* Publish Modal */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-[#0F1115] border border-white/8 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-white/8">
              <h3 className="text-white font-bold text-base">Publish to Marketplace</h3>
              <p className="text-white/40 text-xs mt-1">Share your node graph with the community</p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-white/50 text-xs mb-1.5 block">Project Title</label>
                <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm">
                  {project.title}
                </div>
              </div>
              <div>
                <label className="text-white/50 text-xs mb-1.5 block">Description</label>
                <textarea
                  value={publishDesc}
                  onChange={e => setPublishDesc(e.target.value)}
                  placeholder="Describe what your project does..."
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#ffcc33]/40 placeholder-white/20 resize-none"
                />
              </div>
              <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3 text-xs text-white/50">
                <span className="text-2xl">{project.thumbnail}</span>
                <div>
                  <p className="text-white/70 font-medium">{project.type.replace("_", " ")}</p>
                  <p>{nodes.length} nodes · {edges.length} edges</p>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-white/8 flex gap-2">
              <button
                onClick={() => setShowPublishModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/60 text-sm hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    await publishMutation.mutateAsync({
                      studioProjectId: project.id,
                      title: project.title,
                      description: publishDesc || project.description || undefined,
                      type: (project.type as "game" | "ai_tool" | "app" | "automation" | "media"),
                      thumbnail: project.thumbnail ?? "⚡",
                      authorName: meData?.user.username ?? "Apex User",
                      sessionId,
                      nodes: nodes,
                      edges: edges,
                    });
                    setShowPublishModal(false);
                    toast({ title: "Published!", description: `"${project.title}" is now live in the Marketplace.` });
                  } catch (err) {
                    toast({ title: "Publish failed", description: (err as Error).message, variant: "destructive" });
                  }
                }}
                disabled={publishMutation.isPending}
                className="flex-1 py-2.5 rounded-xl text-black text-sm font-bold transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: GOLD }}
              >
                {publishMutation.isPending ? "Publishing…" : project.isPublished ? "Re-publish" : "Publish"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3-panel + console layout */}
      <div className="flex flex-1 overflow-hidden flex-col">
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Node Library */}
          {showLibrary && (
            <div className="w-44 flex-shrink-0 border-r border-white/6 overflow-hidden">
              <NodeLibrary onAddNode={addNode} />
            </div>
          )}

          {/* Center: React Flow Canvas */}
          <div className="flex-1 overflow-hidden">
            <StudioCanvasV2
              nodes={nodes}
              edges={edges}
              savedViewport={currentViewport}
              executionState={executionState}
              collaborators={collab.collaborators}
              onNodesChange={handleNodesChange}
              onEdgesChange={handleEdgesChange}
              onNodeSelect={(n) => { setSelectedNode(n); if (n) setSelectedEdge(null); }}
              onEdgeSelect={(e) => { setSelectedEdge(e); if (e) setSelectedNode(null); }}
              onViewportChange={handleViewportChange}
              onCursorMove={collab.emitCursor}
              onCursorLeave={collab.emitCursorLeave}
              onNodeSelectCollab={collab.emitSelection}
            />
          </div>

          {/* Right: Properties */}
          {showProps && (
            <div className="w-52 flex-shrink-0 border-l border-white/6 overflow-hidden">
              <PropertiesPanel
                selectedNode={selectedNode}
                selectedEdge={selectedEdge}
                onUpdateNode={updateNodeData}
                onDeleteNode={deleteNode}
                onDeleteEdge={deleteEdge}
              />
            </div>
          )}
        </div>

        {/* Bottom: Debug console */}
        {showConsole && (
          <DebugConsole
            logs={consoleLogs}
            isRunning={isRunning}
            finalOutput={finalOutput}
            onClear={() => {
              setConsoleLogs([]);
              setFinalOutput(undefined);
              setExecutionState(new Map());
            }}
          />
        )}
      </div>

      {/* Input modal */}
      {/* Autopilot modal — regenerate from prompt inside editor */}
      {showAutopilot && (
        <AutopilotPanel
          mode="modal"
          onClose={() => setShowAutopilot(false)}
          onGenerated={handleAutopilotGenerated}
        />
      )}

      {showInputModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-[#0d1424] rounded-3xl border border-white/10 p-5 space-y-4">
            <h3 className="text-white font-black text-sm">Inputs Required</h3>
            {inputNodes.map((n) => {
              const key = n.type === "player_input" ? "playerInput" : "userInput";
              return (
                <div key={n.id}>
                  <label className="text-white/50 text-xs block mb-1.5">
                    {String(n.data.label ?? (n.type === "player_input" ? "Player Input" : "User Input"))}
                  </label>
                  <input
                    value={runInputs[key] ?? ""}
                    onChange={(e) => setRunInputs((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder={String(n.data.default ?? n.data.value ?? "Enter value...")}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#ffcc33]/30"
                  />
                </div>
              );
            })}
            <div className="flex gap-3">
              <button
                onClick={() => setShowInputModal(false)}
                className="flex-1 py-3 rounded-xl text-sm text-white/40 bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowInputModal(false);
                  void executeWithAnimation(runInputs);
                }}
                className="flex-1 py-3 rounded-xl text-sm font-black text-black"
                style={{ background: GOLD }}
              >
                ▶ Run
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PROJECT CARD
// ─────────────────────────────────────────────────────────────
function ProjectCard({ project, onOpen, onDelete }: {
  project: StudioProject;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const typeInfo = PROJECT_TYPES.find((t) => t.value === project.type);
  const nodeCount = (project.nodes ?? []).length;
  const edgeCount = (project.edges ?? []).length;

  return (
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
      className="w-full text-left rounded-2xl border overflow-hidden group transition-all hover:scale-[1.01] cursor-pointer"
      style={{
        background: "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(0,0,0,0.3))",
        borderColor: "rgba(255,255,255,0.07)",
        backdropFilter: "blur(10px)",
      }}
    >
      <div className="p-4 flex items-start gap-3">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
          style={{
            background: `linear-gradient(135deg, ${typeInfo?.color ?? GOLD}20, ${typeInfo?.color ?? GOLD}08)`,
            border: `1px solid ${typeInfo?.color ?? GOLD}25`,
          }}
        >
          {project.thumbnail}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm truncate">{project.title}</p>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="text-[9px] px-2 py-0.5 rounded-full font-bold"
              style={{ background: `${typeInfo?.color ?? GOLD}18`, color: typeInfo?.color ?? GOLD }}
            >
              {typeInfo?.icon} {typeInfo?.label}
            </span>
            <span className="text-white/25 text-[9px]">{nodeCount} nodes · {edgeCount} edges</span>
          </div>
          {project.description && (
            <p className="text-white/35 text-xs mt-1.5 line-clamp-1">{project.description}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="text-white/20 text-[9px] font-mono">▶ {project.runCount ?? 0}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="text-red-400/30 hover:text-red-400 text-[10px] transition-colors opacity-0 group-hover:opacity-100"
          >
            🗑
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CREATE MODAL
// ─────────────────────────────────────────────────────────────
function CreateModal({ onCreate, onClose }: {
  onCreate: (data: { title: string; type: ProjectType; thumbnail: string; description?: string }) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<ProjectType>("automation");
  const emojis = ["⚡", "🎮", "🤖", "📱", "🎬", "🔮", "🧠", "🚀", "🌟", "💡", "🎯", "🔥", "🌊", "🎨", "💎"];
  const [emoji, setEmoji] = useState("⚡");
  const typeInfo = PROJECT_TYPES.find((t) => t.value === type);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-md p-4">
      <div
        className="w-full max-w-sm rounded-3xl border p-5 space-y-4"
        style={{ background: "linear-gradient(180deg, #131620, #0F1115)", borderColor: "rgba(255,255,255,0.08)" }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-white font-black text-base">New Project</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white text-lg">×</button>
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Project name..."
          autoFocus
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#ffcc33]/30"
        />

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short description (optional)..."
          rows={2}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-white/20 focus:outline-none resize-none"
        />

        <div>
          <p className="text-white/35 text-[10px] font-mono uppercase tracking-wider mb-2">Type</p>
          <div className="grid grid-cols-5 gap-1.5">
            {PROJECT_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setType(t.value)}
                className="flex flex-col items-center gap-1 py-2.5 rounded-xl text-[9px] font-bold transition-all"
                style={
                  type === t.value
                    ? { background: `${t.color}18`, border: `1.5px solid ${t.color}50`, color: t.color }
                    : { background: "rgba(255,255,255,0.04)", border: "1.5px solid transparent", color: "rgba(255,255,255,0.3)" }
                }
              >
                <span className="text-base">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-white/35 text-[10px] font-mono uppercase tracking-wider mb-2">Icon</p>
          <div className="flex gap-1.5 flex-wrap">
            {emojis.map((e) => (
              <button
                key={e}
                onClick={() => setEmoji(e)}
                className="w-9 h-9 rounded-xl text-lg transition-all"
                style={
                  emoji === e
                    ? { background: "rgba(255,204,51,0.18)", border: "1.5px solid rgba(255,204,51,0.4)" }
                    : { background: "rgba(255,255,255,0.04)" }
                }
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl text-sm text-white/40 bg-white/5">Cancel</button>
          <button
            onClick={() => {
              if (title.trim()) {
                onCreate({ title: title.trim(), type, thumbnail: emoji, description: description.trim() || undefined });
              }
            }}
            disabled={!title.trim()}
            className="flex-1 py-3 rounded-xl text-sm font-black text-black disabled:opacity-40 transition-all"
            style={{ background: GOLD }}
          >
            Create →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN STUDIO PAGE
// ─────────────────────────────────────────────────────────────
type StudioTab = "projects" | "game-forge";

export default function StudioPage() {
  const { data: projects = [], isLoading } = useStudioProjects();
  const createProject = useCreateStudioProject();
  const deleteProject = useDeleteStudioProject();
  const [, navigate] = useLocation();

  const [studioTab, setStudioTab] = useState<StudioTab>("projects");
  const [showCreate, setShowCreate] = useState(false);
  const [seeding, setSeeding] = useState(false);

  function openProject(p: StudioProject, autoRun = false) {
    if (autoRun) sessionStorage.setItem("studio_autorun", "1");
    navigate(`/studio/project/${p.id}`);
  }

  // Handle autopilot generation from the project list page
  async function handlePageAutopilot(result: AutopilotResult) {
    const p = await createProject.mutateAsync({
      title: result.title,
      type: result.type as ProjectType,
      thumbnail: result.thumbnail,
      description: result.description,
      nodes: result.nodes as StudioNode[],
      edges: result.edges as StudioEdge[],
    });
    openProject(p, true);
  }

  async function handleCreate(data: { title: string; type: ProjectType; thumbnail: string; description?: string }) {
    const p = await createProject.mutateAsync(data);
    setShowCreate(false);
    openProject(p);
  }

  async function handleSeed() {
    setSeeding(true);
    await fetch(`${BASE}api/studio/seed`, { method: "POST" });
    setSeeding(false);
    window.location.reload();
  }

  const typeCount = PROJECT_TYPES.reduce((acc, t) => {
    acc[t.value] = projects.filter((p) => p.type === t.value).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "#0F1115" }}>
      {/* Header */}
      <div
        className="flex-shrink-0 px-4 pt-5 pb-4 border-b"
        style={{ borderColor: "rgba(255,255,255,0.06)", background: "linear-gradient(180deg, rgba(15,17,21,0.95), transparent)" }}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1
                className="text-xl font-black tracking-[0.1em] uppercase"
                style={{ color: GOLD, textShadow: "0 0 30px rgba(255,204,51,0.35)" }}
              >
                APEX STUDIO
              </h1>
              <span
                className="text-[9px] font-black px-1.5 py-0.5 rounded-full tracking-widest"
                style={{ background: "rgba(255,204,51,0.12)", color: GOLD }}
              >
                v2
              </span>
            </div>
            <p className="text-[10px] font-mono text-white/25 tracking-widest uppercase mt-0.5">
              Visual AI Creation Engine
            </p>
          </div>
          <div className="flex items-center gap-2">
            {studioTab === "projects" && (
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black text-black transition-all hover:brightness-110 active:scale-95"
                style={{ background: GOLD }}
              >
                + New
              </button>
            )}
          </div>
        </div>

        {/* ── Tab switcher ────────────────────────────────────────────────── */}
        <div className="flex gap-1.5 mt-3">
          {([
            { id: "projects",    label: "Projects",     icon: "🗂️" },
            { id: "game-forge",  label: "🎮 Game Forge", icon: "" },
          ] as { id: StudioTab; label: string; icon: string }[]).map((t) => (
            <button
              key={t.id}
              onClick={() => setStudioTab(t.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all"
              style={
                studioTab === t.id
                  ? { background: t.id === "game-forge" ? "rgba(249,115,22,0.18)" : `${GOLD}18`,
                      border: `1.5px solid ${t.id === "game-forge" ? "rgba(249,115,22,0.45)" : GOLD + "50"}`,
                      color: t.id === "game-forge" ? "#f97316" : GOLD }
                  : { background: "rgba(255,255,255,0.04)", border: "1.5px solid transparent", color: "rgba(255,255,255,0.30)" }
              }
            >
              {t.icon && <span>{t.icon}</span>}
              {t.label}
            </button>
          ))}
        </div>

        {/* Stats bar */}
        {projects.length > 0 && (
          <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-hide">
            {PROJECT_TYPES.filter((t) => typeCount[t.value] > 0).map((t) => (
              <div
                key={t.value}
                className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full"
                style={{ background: `${t.color}10`, border: `1px solid ${t.color}20` }}
              >
                <span className="text-sm">{t.icon}</span>
                <span className="text-[10px] font-bold" style={{ color: t.color }}>{typeCount[t.value]}</span>
              </div>
            ))}
            <div className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/4 border border-white/8">
              <span className="text-[10px] text-white/40 font-mono">
                {projects.reduce((s, p) => s + (p.runCount ?? 0), 0)} runs total
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Game Forge tab ─────────────────────────────────────────────────── */}
      {studioTab === "game-forge" && (
        <div className="flex-1 overflow-hidden">
          <GameForge />
        </div>
      )}

      {/* ── Projects tab ───────────────────────────────────────────────────── */}
      {studioTab === "projects" && <>

      {/* AI Autopilot panel */}
      <AutopilotPanel onGenerated={(r) => void handlePageAutopilot(r)} />

      {/* AI Studio CTA */}
      <div className="px-4 pt-3 pb-0 flex-shrink-0">
        <a
          href={`${BASE}/ai-studio`}
          className="flex items-center gap-3 w-full rounded-2xl px-4 py-3 transition-all hover:brightness-110 active:scale-[0.99]"
          style={{
            background: "linear-gradient(135deg, rgba(255,204,51,0.08) 0%, rgba(255,140,0,0.06) 100%)",
            border: "1px solid rgba(255,204,51,0.18)",
          }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #FFCC33, #FF8C00)", boxShadow: "0 4px 12px rgba(255,204,51,0.25)" }}
          >
            🏗️
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[#FFCC33] font-black text-sm">AI Studio — Build with AI</p>
            <p className="text-white/40 text-[11px] truncate">Describe your idea → live app in seconds</p>
          </div>
          <span className="text-[#FFCC33]/50 text-sm flex-shrink-0">→</span>
        </a>
      </div>

      {/* Project list */}
      <div className="flex-1 overflow-y-auto px-4 py-2 pb-24 space-y-2.5">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-5 h-5 rounded-full border-2 border-[#ffcc33]/30 border-t-[#ffcc33] animate-spin" />
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 gap-5 text-center">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl"
              style={{ background: "rgba(255,204,51,0.06)", border: "1px solid rgba(255,204,51,0.12)" }}
            >
              ⚡
            </div>
            <div>
              <p className="text-white/50 font-black text-base">Start Building</p>
              <p className="text-white/25 text-xs mt-1">Create AI tools, games, and automations visually</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCreate(true)}
                className="px-5 py-2.5 rounded-xl text-sm font-black text-black"
                style={{ background: GOLD }}
              >
                + Create Project
              </button>
              <button
                onClick={handleSeed}
                disabled={seeding}
                className="px-4 py-2.5 rounded-xl text-sm font-bold bg-white/6 text-white/50 border border-white/10 disabled:opacity-50"
              >
                {seeding ? "Loading..." : "🚀 Examples"}
              </button>
            </div>
          </div>
        ) : (
          <>
            {projects.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                onOpen={() => openProject(p)}
                onDelete={() => deleteProject.mutate(p.id)}
              />
            ))}
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="w-full py-2.5 rounded-xl text-xs text-white/20 hover:text-white/40 bg-white/2 hover:bg-white/5 transition-all border border-white/5 disabled:opacity-30"
            >
              {seeding ? "Loading..." : "+ Load Example Projects"}
            </button>
          </>
        )}
      </div>

      {showCreate && <CreateModal onCreate={handleCreate} onClose={() => setShowCreate(false)} />}

      </>} {/* end projects tab */}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// STUDIO PROJECT PAGE — /studio/project/:id
// ─────────────────────────────────────────────────────────────
export function StudioProjectPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { data: projects = [], isLoading } = useStudioProjects();

  // Read and clear the autoRun flag once on mount (side-effect safe)
  const autoRunRef = useRef(sessionStorage.getItem("studio_autorun") === "1");
  useEffect(() => {
    if (autoRunRef.current) sessionStorage.removeItem("studio_autorun");
  }, []);

  const project = projects.find((p) => String(p.id) === id);

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: "#0F1115" }}>
        <div className="text-white/30 text-sm font-mono animate-pulse">Loading project…</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4" style={{ background: "#0F1115" }}>
        <p className="text-white/40 text-sm">Project not found.</p>
        <button
          onClick={() => navigate("/studio")}
          className="text-[#ffcc33] text-xs underline"
        >
          ← Back to Studio
        </button>
      </div>
    );
  }

  return (
    <CanvasEditorV2
      project={project}
      onClose={() => navigate("/studio")}
      autoRun={autoRunRef.current}
    />
  );
}
