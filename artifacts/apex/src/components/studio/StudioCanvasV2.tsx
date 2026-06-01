import { useCallback, useMemo, useEffect, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type Node,
  type Viewport,
  BackgroundVariant,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ApexNode } from "./ApexNode";
import { NODE_DEF_MAP } from "./nodeDefinitions";
import { RemoteCursors, getNodeSelectionColor } from "./RemoteCursors";
import type { StudioNode, StudioEdge, StudioViewport } from "../../hooks/useStudio";
import type { Collaborator } from "../../hooks/useCollaboration";

const nodeTypes = { apexNode: ApexNode };

// ─── Conversion helpers ─────────────────────────────────────
export function studioNodesToRF(
  nodes: StudioNode[],
  executionState?: Map<string, { status: "active" | "complete" | "error"; output?: string }>,
  collaborators?: Collaborator[],
): Node[] {
  return nodes.map((n) => {
    const execInfo = executionState?.get(n.id);
    const remoteColor = collaborators ? getNodeSelectionColor(collaborators, n.id) : null;
    return {
      id: n.id,
      type: "apexNode",
      position: { x: n.x, y: n.y },
      data: {
        nodeType: n.type,
        config: n.data,
        isActive: execInfo?.status === "active",
        isCompleted: execInfo?.status === "complete",
        hasError: execInfo?.status === "error",
        output: execInfo?.output,
        remoteSelectionColor: remoteColor,
      },
    };
  });
}

export function studioEdgesToRF(edges: StudioEdge[]): Edge[] {
  return edges.map((e) => {
    const isTrue = e.label === "true" || e.label === "win";
    const isFalse = e.label === "false" || e.label === "loss";
    return {
      id: e.id,
      source: e.from,
      target: e.to,
      sourceHandle: e.label ?? "out",
      targetHandle: "in",
      label: e.label && e.label !== "out" ? e.label : undefined,
      labelStyle: {
        fill: isTrue ? "#4ade80" : isFalse ? "#f87171" : "rgba(255,255,255,0.3)",
        fontSize: 9, fontFamily: "monospace", fontWeight: "bold",
      },
      labelBgStyle: { fill: "transparent" },
      style: {
        stroke: isTrue ? "#4ade80" : isFalse ? "#f87171" : "rgba(255,255,255,0.25)",
        strokeWidth: 1.5,
      },
      type: "smoothstep",
    };
  });
}

export function rfNodesToStudio(nodes: Node[]): StudioNode[] {
  return nodes.map((n) => ({
    id: n.id,
    type: (n.data as { nodeType: string }).nodeType,
    x: Math.round(n.position.x),
    y: Math.round(n.position.y),
    data: (n.data as { config: Record<string, string | number | boolean> }).config ?? {},
  }));
}

export function rfEdgesToStudio(edges: Edge[]): StudioEdge[] {
  return edges.map((e) => ({
    id: e.id,
    from: e.source,
    to: e.target,
    label: e.label as string | undefined,
  }));
}

// ─── Props ─────────────────────────────────────────────────
interface StudioCanvasV2Props {
  nodes: StudioNode[];
  edges: StudioEdge[];
  savedViewport?: StudioViewport | null;
  executionState?: Map<string, { status: "active" | "complete" | "error"; output?: string }>;
  collaborators?: Collaborator[];
  onNodesChange: (nodes: StudioNode[]) => void;
  onEdgesChange: (edges: StudioEdge[]) => void;
  onNodeSelect: (node: StudioNode | null) => void;
  onEdgeSelect: (edge: StudioEdge | null) => void;
  onViewportChange: (viewport: StudioViewport) => void;
  onCursorMove?: (x: number, y: number) => void;
  onCursorLeave?: () => void;
  onNodeSelectCollab?: (nodeId: string | null) => void;
}

// ─── Inner canvas (must be inside ReactFlowProvider) ────────
function CanvasInner({
  nodes: studioNodes,
  edges: studioEdges,
  savedViewport,
  executionState,
  collaborators = [],
  onNodesChange,
  onEdgesChange,
  onNodeSelect,
  onEdgeSelect,
  onViewportChange,
  onCursorMove,
  onCursorLeave,
  onNodeSelectCollab,
}: StudioCanvasV2Props) {
  const { setViewport, screenToFlowPosition } = useReactFlow();

  const [localNodes, setLocalNodes, onLocalNodesChange] = useNodesState(
    studioNodesToRF(studioNodes, executionState, collaborators)
  );
  const [localEdges, setLocalEdges, onLocalEdgesChange] = useEdgesState(
    studioEdgesToRF(studioEdges)
  );

  // Restore saved viewport once on mount
  const viewportRestored = useRef(false);
  useEffect(() => {
    if (!viewportRestored.current && savedViewport) {
      viewportRestored.current = true;
      setViewport({ x: savedViewport.x, y: savedViewport.y, zoom: savedViewport.zoom });
    }
  }, [savedViewport, setViewport]);

  // Sync nodes from props (e.g., execution state updates, node additions from library, remote changes)
  const rfNodesFromProps = useMemo(
    () => studioNodesToRF(studioNodes, executionState, collaborators),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [studioNodes, executionState, collaborators]
  );

  // Sync edges from props (e.g., after deletion or remote change)
  const rfEdgesFromProps = useMemo(() => studioEdgesToRF(studioEdges), [studioEdges]);

  // Sync external prop changes → local RF state, preserving drag positions
  useEffect(() => {
    setLocalNodes((prev) => {
      const posMap = new Map(prev.map((n) => [n.id, n.position]));
      return rfNodesFromProps.map((n) => ({
        ...n,
        position: posMap.get(n.id) ?? n.position,
      }));
    });
  }, [rfNodesFromProps, setLocalNodes]);

  useEffect(() => {
    setLocalEdges(rfEdgesFromProps);
  }, [rfEdgesFromProps, setLocalEdges]);

  // ─── Handlers ──────────────────────────────────────────────

  const handleConnect = useCallback(
    (connection: Connection) => {
      const label = connection.sourceHandle && connection.sourceHandle !== "out"
        ? connection.sourceHandle
        : undefined;
      const newEdge: Edge = {
        ...connection,
        id: `e_${Date.now()}`,
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle ?? "out",
        targetHandle: connection.targetHandle ?? "in",
        label,
        style: {
          stroke: label === "true" || label === "win" ? "#4ade80"
            : label === "false" || label === "loss" ? "#f87171"
            : "rgba(255,255,255,0.3)",
          strokeWidth: 1.5,
        },
        type: "smoothstep",
      };
      setLocalEdges((eds) => {
        const updated = addEdge(newEdge, eds);
        onEdgesChange(rfEdgesToStudio(updated));
        return updated;
      });
    },
    [setLocalEdges, onEdgesChange]
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const sNode = studioNodes.find((n) => n.id === node.id);
      onNodeSelect(sNode ?? null);
      onEdgeSelect(null);
      onNodeSelectCollab?.(node.id);
    },
    [studioNodes, onNodeSelect, onEdgeSelect, onNodeSelectCollab]
  );

  const handleEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      const sEdge = studioEdges.find((e) => e.id === edge.id);
      onEdgeSelect(sEdge ?? null);
      onNodeSelect(null);
      onNodeSelectCollab?.(null);
    },
    [studioEdges, onEdgeSelect, onNodeSelect, onNodeSelectCollab]
  );

  const handleNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setLocalNodes((nds) => {
        const updated = nds.map((n) =>
          n.id === node.id ? { ...n, position: node.position } : n
        );
        onNodesChange(rfNodesToStudio(updated));
        return updated;
      });
    },
    [setLocalNodes, onNodesChange]
  );

  const handlePaneClick = useCallback(() => {
    onNodeSelect(null);
    onEdgeSelect(null);
    onNodeSelectCollab?.(null);
  }, [onNodeSelect, onEdgeSelect, onNodeSelectCollab]);

  const handleNodesDelete = useCallback(
    (deleted: Node[]) => {
      const deletedIds = new Set(deleted.map((n) => n.id));
      onNodesChange(studioNodes.filter((n) => !deletedIds.has(n.id)));
      onEdgesChange(studioEdges.filter((e) => !deletedIds.has(e.from) && !deletedIds.has(e.to)));
      onNodeSelect(null);
    },
    [studioNodes, studioEdges, onNodesChange, onEdgesChange, onNodeSelect]
  );

  const handleEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      const deletedIds = new Set(deleted.map((e) => e.id));
      onEdgesChange(studioEdges.filter((e) => !deletedIds.has(e.id)));
      onEdgeSelect(null);
    },
    [studioEdges, onEdgesChange, onEdgeSelect]
  );

  const handleMoveEnd = useCallback(
    (_: MouseEvent | TouchEvent, vp: Viewport) => {
      onViewportChange({ x: vp.x, y: vp.y, zoom: vp.zoom });
    },
    [onViewportChange]
  );

  // Track mouse position in flow-space for cursor broadcasting
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!onCursorMove) return;
      const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      onCursorMove(flowPos.x, flowPos.y);
    },
    [onCursorMove, screenToFlowPosition]
  );

  const defaultViewport = savedViewport
    ? { x: savedViewport.x, y: savedViewport.y, zoom: savedViewport.zoom }
    : { x: 80, y: 80, zoom: 1 };

  return (
    <div
      className="w-full h-full"
      style={{ background: "#04080f" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={onCursorLeave}
    >
      <style>{`
        .react-flow__background { background: #04080f !important; }
        .react-flow__controls {
          background: rgba(8,13,25,0.95) !important;
          border: 1px solid rgba(255,255,255,0.07) !important;
          border-radius: 10px !important;
          overflow: hidden;
        }
        .react-flow__controls-button {
          background: transparent !important;
          border: none !important;
          border-bottom: 1px solid rgba(255,255,255,0.05) !important;
          color: rgba(255,255,255,0.4) !important;
          fill: rgba(255,255,255,0.4) !important;
        }
        .react-flow__controls-button:hover {
          background: rgba(255,255,255,0.06) !important;
          fill: rgba(255,255,255,0.8) !important;
        }
        .react-flow__controls-button:last-child { border-bottom: none !important; }
        .react-flow__minimap {
          background: rgba(8,13,25,0.95) !important;
          border: 1px solid rgba(255,255,255,0.07) !important;
          border-radius: 10px !important;
          overflow: hidden;
        }
        .react-flow__edge.selected .react-flow__edge-path { stroke: #ffcc33 !important; }
        .react-flow__handle { transition: transform 0.15s, box-shadow 0.15s; }
        .react-flow__handle:hover { transform: scale(1.5); box-shadow: 0 0 6px currentColor; }
        .react-flow__attribution { display: none !important; }
        .react-flow__pane { cursor: grab; }
        .react-flow__pane:active { cursor: grabbing; }
        .react-flow__node.selected > div { outline: none !important; }
      `}</style>
      <ReactFlow
        nodes={localNodes}
        edges={localEdges}
        onNodesChange={onLocalNodesChange}
        onEdgesChange={onLocalEdgesChange}
        onConnect={handleConnect}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onNodeDragStop={handleNodeDragStop}
        onPaneClick={handlePaneClick}
        onNodesDelete={handleNodesDelete}
        onEdgesDelete={handleEdgesDelete}
        onMoveEnd={handleMoveEnd}
        nodeTypes={nodeTypes}
        deleteKeyCode="Delete"
        snapToGrid
        snapGrid={[16, 16]}
        defaultViewport={defaultViewport}
        proOptions={{ hideAttribution: true }}
        fitView={!savedViewport && studioNodes.length > 0}
        fitViewOptions={{ padding: 0.25, maxZoom: 1.1 }}
        minZoom={0.2}
        maxZoom={2.5}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.2}
          color="rgba(255,255,255,0.04)"
        />
        <Controls showInteractive={false} position="bottom-right" />
        <MiniMap
          nodeColor={(n) => {
            const def = NODE_DEF_MAP[(n.data as { nodeType: string }).nodeType];
            return def?.color ?? "rgba(255,255,255,0.15)";
          }}
          maskColor="rgba(4,8,15,0.75)"
          style={{ width: 110, height: 72 }}
          position="bottom-left"
        />

        {studioNodes.length === 0 && (
          <Panel position="top-center">
            <div className="mt-10 text-center pointer-events-none select-none">
              <p className="text-4xl mb-3 opacity-8">⚡</p>
              <p className="text-white/20 text-sm font-bold">← Add nodes from the panel</p>
              <p className="text-white/10 text-xs mt-1.5">
                Drag to move · Connect handles to wire nodes · Del to remove
              </p>
            </div>
          </Panel>
        )}
      </ReactFlow>

      {/* Remote cursors overlay — rendered outside ReactFlow DOM tree for correct z-index */}
      <RemoteCursors collaborators={collaborators} />
    </div>
  );
}

// ─── Public export — wraps with ReactFlowProvider ────────────
export function StudioCanvasV2(props: StudioCanvasV2Props) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
