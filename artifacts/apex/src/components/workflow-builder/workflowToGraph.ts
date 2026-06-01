/**
 * Converts a WorkflowState object into React Flow nodes and edges.
 * The workflow JSON is always the single source of truth.
 */

import { type Node, type Edge, MarkerType } from "@xyflow/react";
import { type WorkflowState } from "./types";

const X_CENTER = 180;
const Y_START = 60;
const Y_GAP = 150;

const EDGE_STYLE = {
  stroke: "#FFCC33",
  strokeWidth: 2,
};

export function workflowToGraph(workflow: WorkflowState): {
  nodes: Node[];
  edges: Edge[];
} {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // ── Trigger node ──────────────────────────────────────────────────────────
  nodes.push({
    id: "trigger",
    type: "triggerNode",
    position: { x: X_CENTER, y: Y_START },
    data: {
      trigger: workflow.trigger,
      conditions: workflow.conditions,
    },
    draggable: true,
    selectable: true,
  });

  let prevId = "trigger";

  // ── Action nodes ──────────────────────────────────────────────────────────
  workflow.actions.forEach((action, i) => {
    const id = `action-${i}`;
    const nodeType =
      action.type === "delay" ? "delayNode" : "actionNode";

    nodes.push({
      id,
      type: nodeType,
      position: { x: X_CENTER, y: Y_START + (i + 1) * Y_GAP },
      data: { action, index: i },
      draggable: true,
      selectable: true,
    });

    edges.push({
      id: `edge-${prevId}-${id}`,
      source: prevId,
      target: id,
      type: "smoothstep",
      animated: true,
      style: EDGE_STYLE,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: "#FFCC33",
        width: 16,
        height: 16,
      },
    });

    prevId = id;
  });

  return { nodes, edges };
}
