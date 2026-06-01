import { useState, useRef, useCallback, useEffect } from "react";
import type { StudioNode, StudioEdge } from "../../hooks/useStudio";
import { NODE_DEF_MAP, CATEGORY_LABELS } from "./nodeDefinitions";

const NODE_W = 180;
const NODE_H = 64;
const PORT_R = 6;

interface PortPos { x: number; y: number }

function getInputPort(node: StudioNode): PortPos {
  return { x: node.x, y: node.y + NODE_H / 2 };
}

function getOutputPorts(node: StudioNode): { id: string; label?: string; pos: PortPos }[] {
  const def = NODE_DEF_MAP[node.type];
  if (!def || def.outputs === 0) return [];
  if (def.outputs === 1) {
    return [{ id: "out", pos: { x: node.x + NODE_W, y: node.y + NODE_H / 2 } }];
  }
  const labels = def.outputLabels ?? ["out1", "out2"];
  return labels.map((label, i) => ({
    id: label,
    label,
    pos: { x: node.x + NODE_W, y: node.y + NODE_H * 0.33 + i * NODE_H * 0.34 },
  }));
}

function bezierPath(from: PortPos, to: PortPos): string {
  const dx = Math.max(80, Math.abs(to.x - from.x) * 0.5);
  return `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`;
}

interface DragState {
  nodeId: string;
  offsetX: number;
  offsetY: number;
}

interface ConnectState {
  fromNodeId: string;
  fromPortId: string;
  fromPos: PortPos;
  mouseX: number;
  mouseY: number;
}

interface PanState {
  startMouseX: number;
  startMouseY: number;
  startPanX: number;
  startPanY: number;
}

interface StudioCanvasProps {
  nodes: StudioNode[];
  edges: StudioEdge[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  onSelectNode: (id: string | null) => void;
  onSelectEdge: (id: string | null) => void;
  onMoveNode: (id: string, x: number, y: number) => void;
  onAddEdge: (edge: StudioEdge) => void;
  onDeleteEdge: (id: string) => void;
}

export function StudioCanvas({
  nodes, edges, selectedNodeId, selectedEdgeId,
  onSelectNode, onSelectEdge, onMoveNode, onAddEdge, onDeleteEdge,
}: StudioCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 80, y: 80 });
  const [zoom, setZoom] = useState(1);

  const dragging = useRef<DragState | null>(null);
  const connecting = useRef<ConnectState | null>(null);
  const panning = useRef<PanState | null>(null);
  const [ghostEdge, setGhostEdge] = useState<{ from: PortPos; to: PortPos } | null>(null);

  function screenToCanvas(sx: number, sy: number): PortPos {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: sx, y: sy };
    return {
      x: (sx - rect.left - pan.x) / zoom,
      y: (sy - rect.top - pan.y) / zoom,
    };
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (dragging.current) {
      const cp = screenToCanvas(e.clientX, e.clientY);
      onMoveNode(dragging.current.nodeId, cp.x - dragging.current.offsetX, cp.y - dragging.current.offsetY);
    }
    if (connecting.current) {
      const cp = screenToCanvas(e.clientX, e.clientY);
      setGhostEdge({ from: connecting.current.fromPos, to: cp });
    }
    if (panning.current) {
      const dx = e.clientX - panning.current.startMouseX;
      const dy = e.clientY - panning.current.startMouseY;
      setPan({ x: panning.current.startPanX + dx, y: panning.current.startPanY + dy });
    }
  }, [pan, zoom, onMoveNode]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    dragging.current = null;
    panning.current = null;
    if (connecting.current) {
      const cp = screenToCanvas(e.clientX, e.clientY);
      // Find target input port
      for (const node of nodes) {
        if (node.id === connecting.current.fromNodeId) continue;
        const def = NODE_DEF_MAP[node.type];
        if (!def || def.inputs === 0) continue;
        const ip = getInputPort(node);
        const dist = Math.hypot(cp.x - ip.x, cp.y - ip.y);
        if (dist < 20) {
          onAddEdge({
            id: `e_${Date.now()}`,
            from: connecting.current.fromNodeId,
            to: node.id,
            label: connecting.current.fromPortId !== "out" ? connecting.current.fromPortId : undefined,
          });
          break;
        }
      }
      connecting.current = null;
      setGhostEdge(null);
    }
  }, [nodes, pan, zoom, onAddEdge]);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  function handleNodeMouseDown(e: React.MouseEvent, node: StudioNode) {
    e.stopPropagation();
    onSelectNode(node.id);
    const cp = screenToCanvas(e.clientX, e.clientY);
    dragging.current = { nodeId: node.id, offsetX: cp.x - node.x, offsetY: cp.y - node.y };
  }

  function handlePortMouseDown(e: React.MouseEvent, node: StudioNode, portId: string, portPos: PortPos) {
    e.stopPropagation();
    e.preventDefault();
    connecting.current = { fromNodeId: node.id, fromPortId: portId, fromPos: portPos, mouseX: portPos.x, mouseY: portPos.y };
    setGhostEdge({ from: portPos, to: portPos });
  }

  function handleCanvasMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    onSelectNode(null);
    onSelectEdge(null);
    panning.current = { startMouseX: e.clientX, startMouseY: e.clientY, startPanX: pan.x, startPanY: pan.y };
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.min(2, Math.max(0.3, z * delta)));
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden select-none"
      style={{ background: "#060a14", cursor: panning.current ? "grabbing" : "default" }}
      onMouseDown={handleCanvasMouseDown}
      onWheel={handleWheel}
    >
      {/* Grid background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)`,
          backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      />

      {/* Canvas content (panned + zoomed) */}
      <div
        className="absolute inset-0 origin-top-left"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
      >
        {/* SVG edges layer */}
        <svg
          className="absolute pointer-events-none"
          style={{ left: -2000, top: -2000, width: 8000, height: 8000 }}
          overflow="visible"
        >
          {edges.map((edge) => {
            const fromNode = nodes.find((n) => n.id === edge.from);
            const toNode = nodes.find((n) => n.id === edge.to);
            if (!fromNode || !toNode) return null;
            const outPorts = getOutputPorts(fromNode);
            const fromPort = edge.label
              ? outPorts.find((p) => p.id === edge.label) ?? outPorts[0]
              : outPorts[0];
            if (!fromPort) return null;
            const toPort = getInputPort(toNode);
            const isSelected = selectedEdgeId === edge.id;
            const edgeColor = edge.label === "true" ? "#4ade80" : edge.label === "false" ? "#f87171" : edge.label === "win" ? "#fbbf24" : edge.label === "loss" ? "#f87171" : "#ffffff40";
            return (
              <g key={edge.id} className="pointer-events-auto cursor-pointer" onClick={() => onSelectEdge(edge.id)}>
                <path
                  d={bezierPath(fromPort.pos, toPort)}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={12}
                />
                <path
                  d={bezierPath(fromPort.pos, toPort)}
                  fill="none"
                  stroke={isSelected ? "#ffcc33" : edgeColor}
                  strokeWidth={isSelected ? 2 : 1.5}
                  strokeDasharray={isSelected ? "6,3" : undefined}
                  opacity={0.8}
                />
                {edge.label && (
                  <text
                    x={(fromPort.pos.x + toPort.x) / 2}
                    y={(fromPort.pos.y + toPort.y) / 2 - 6}
                    textAnchor="middle"
                    fill={edgeColor}
                    fontSize="9"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Ghost edge while connecting */}
          {ghostEdge && (
            <path
              d={bezierPath(ghostEdge.from, ghostEdge.to)}
              fill="none"
              stroke="#ffcc33"
              strokeWidth={1.5}
              strokeDasharray="6,3"
              opacity={0.7}
            />
          )}
        </svg>

        {/* Nodes */}
        {nodes.map((node) => {
          const def = NODE_DEF_MAP[node.type];
          if (!def) return null;
          const isSelected = selectedNodeId === node.id;
          const catInfo = CATEGORY_LABELS[def.category];
          const outPorts = getOutputPorts(node);

          return (
            <div
              key={node.id}
              className="absolute cursor-grab active:cursor-grabbing transition-shadow"
              style={{
                left: node.x,
                top: node.y,
                width: NODE_W,
                zIndex: isSelected ? 20 : 10,
              }}
              onMouseDown={(e) => handleNodeMouseDown(e, node)}
            >
              {/* Node card */}
              <div
                className="rounded-xl border overflow-hidden"
                style={{
                  background: isSelected ? `${def.bgColor}` : "rgba(8,13,25,0.95)",
                  borderColor: isSelected ? def.color : "rgba(255,255,255,0.1)",
                  boxShadow: isSelected ? `0 0 0 1px ${def.color}40, 0 4px 20px ${def.color}20` : "0 2px 8px rgba(0,0,0,0.4)",
                }}
              >
                {/* Header */}
                <div
                  className="flex items-center gap-2 px-3 py-2"
                  style={{ background: def.bgColor, borderBottom: `1px solid ${def.color}15` }}
                >
                  <span className="text-base">{def.icon}</span>
                  <span className="text-white text-[11px] font-bold truncate flex-1">{def.label}</span>
                  <span
                    className="text-[8px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: `${def.color}20`, color: def.color }}
                  >
                    {def.category.toUpperCase().slice(0, 3)}
                  </span>
                </div>

                {/* Body — show first meaningful field value if set */}
                <div className="px-3 py-1.5 min-h-[28px] flex items-center">
                  {def.fields.length > 0 ? (
                    <p className="text-white/40 text-[9px] truncate w-full font-mono">
                      {String(node.data[def.fields[0]!.key] ?? def.fields[0]?.placeholder ?? "…")}
                    </p>
                  ) : (
                    <p className="text-white/20 text-[9px] italic">—</p>
                  )}
                </div>
              </div>

              {/* Input port */}
              {def.inputs > 0 && (
                <div
                  className="absolute rounded-full border-2 transition-transform hover:scale-125"
                  style={{
                    width: PORT_R * 2,
                    height: PORT_R * 2,
                    left: -PORT_R,
                    top: NODE_H / 2 - PORT_R,
                    background: "#0a0f1e",
                    borderColor: def.color,
                    cursor: "crosshair",
                    zIndex: 30,
                  }}
                />
              )}

              {/* Output ports */}
              {outPorts.map((port) => (
                <div
                  key={port.id}
                  className="absolute rounded-full border-2 transition-transform hover:scale-125"
                  style={{
                    width: PORT_R * 2,
                    height: PORT_R * 2,
                    right: -PORT_R,
                    top: port.pos.y - node.y - PORT_R,
                    background: port.label === "true" || port.label === "win" ? "#4ade80" :
                      port.label === "false" || port.label === "loss" ? "#f87171" : def.color,
                    borderColor: "rgba(0,0,0,0.5)",
                    cursor: "crosshair",
                    zIndex: 30,
                  }}
                  onMouseDown={(e) => handlePortMouseDown(e, node, port.id, port.pos)}
                  title={port.label ? `Output: ${port.label}` : "Output"}
                />
              ))}
            </div>
          );
        })}
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1">
        <button
          onClick={() => setZoom((z) => Math.min(2, z * 1.2))}
          className="w-8 h-8 rounded-lg bg-white/8 text-white/60 hover:bg-white/15 text-base flex items-center justify-center border border-white/10"
        >+</button>
        <button
          onClick={() => setZoom(1)}
          className="w-8 h-8 rounded-lg bg-white/8 text-white/50 hover:bg-white/15 text-[9px] flex items-center justify-center border border-white/10 font-mono"
        >{Math.round(zoom * 100)}%</button>
        <button
          onClick={() => setZoom((z) => Math.max(0.3, z * 0.8))}
          className="w-8 h-8 rounded-lg bg-white/8 text-white/60 hover:bg-white/15 text-base flex items-center justify-center border border-white/10"
        >−</button>
        <button
          onClick={() => { setPan({ x: 80, y: 80 }); setZoom(1); }}
          className="w-8 h-8 rounded-lg bg-white/8 text-white/40 hover:bg-white/15 text-[10px] flex items-center justify-center border border-white/10"
          title="Reset view"
        >⊙</button>
      </div>

      {/* Empty state hint */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-5xl mb-3 opacity-20">⚡</div>
            <p className="text-white/20 text-sm">Click nodes in the left panel to add them</p>
            <p className="text-white/10 text-xs mt-1">Drag ports to connect • Click canvas to pan</p>
          </div>
        </div>
      )}
    </div>
  );
}
