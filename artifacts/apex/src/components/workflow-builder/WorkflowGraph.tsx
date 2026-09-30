import { useCallback, useEffect, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  type NodeMouseHandler,
  type OnNodesChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { TriggerNode } from "./nodes/TriggerNode";
import { ActionNode } from "./nodes/ActionNode";
import { DelayNode } from "./nodes/DelayNode";
import { workflowToGraph } from "./workflowToGraph";
import { type WorkflowState } from "./types";
import { Plus } from "lucide-react";

const nodeTypes = {
  triggerNode: TriggerNode,
  actionNode: ActionNode,
  delayNode: DelayNode,
};

interface WorkflowGraphProps {
  workflow: WorkflowState | null;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onAddAction: () => void;
}

export function WorkflowGraph({
  workflow,
  selectedNodeId,
  onSelectNode,
  onAddAction,
}: WorkflowGraphProps) {
  const { nodes: derivedNodes, edges: derivedEdges } = useMemo(
    () =>
      workflow
        ? workflowToGraph(workflow)
        : { nodes: [], edges: [] },
    [workflow]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(derivedNodes);
  const [edges, setEdges] = useEdgesState(derivedEdges);

  useEffect(() => {
    const updated = derivedNodes.map((n) => ({
      ...n,
      selected: n.id === selectedNodeId,
    }));
    setNodes(updated);
    setEdges(derivedEdges);
  }, [derivedNodes, derivedEdges, selectedNodeId, setNodes, setEdges]);

  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      onSelectNode(node.id === selectedNodeId ? null : node.id);
    },
    [selectedNodeId, onSelectNode]
  );

  const onPaneClick = useCallback(() => {
    onSelectNode(null);
  }, [onSelectNode]);

  return (
    <div
      style={{
        flex: 1,
        position: "relative",
        background: "transparent",
        overflow: "hidden",
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange as OnNodesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView={!!workflow}
        fitViewOptions={{ padding: 0.25, maxZoom: 1.2 }}
        minZoom={0.3}
        maxZoom={2}
        deleteKeyCode={null}
        style={{ background: "transparent" }}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="#1e1e1e"
        />
        <Controls
          style={{
            background: "#111",
            border: "1px solid #222",
            borderRadius: 10,
            boxShadow: "none",
          }}
        />
      </ReactFlow>

      {/* Empty state */}
      {!workflow && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 48, opacity: 0.15 }}>⚡</div>
          <div
            style={{
              fontSize: 14,
              color: "#333",
              fontWeight: 500,
              textAlign: "center",
            }}
          >
            Your workflow graph will appear here
          </div>
          <div style={{ fontSize: 12, color: "#2a2a2a", textAlign: "center" }}>
            Start by describing a workflow in the chat panel
          </div>
        </div>
      )}

      {/* Add action button */}
      {workflow && (
        <button
          onClick={onAddAction}
          title="Add action via AI"
          style={{
            position: "absolute",
            bottom: 20,
            right: 20,
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "#A29BFE",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 16px rgba(162,155,254,0.35)",
            transition: "transform 0.15s, box-shadow 0.15s",
            zIndex: 10,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.08)";
            e.currentTarget.style.boxShadow = "0 6px 20px rgba(162,155,254,0.45)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = "0 4px 16px rgba(162,155,254,0.35)";
          }}
        >
          <Plus size={20} color="#000" strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}
