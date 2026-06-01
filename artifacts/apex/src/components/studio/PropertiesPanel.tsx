import { NODE_DEF_MAP } from "./nodeDefinitions";
import type { StudioNode, StudioEdge } from "../../hooks/useStudio";

interface PropertiesPanelProps {
  selectedNode: StudioNode | null;
  selectedEdge: StudioEdge | null;
  onUpdateNode: (id: string, data: Record<string, string | number | boolean>) => void;
  onDeleteNode: (id: string) => void;
  onDeleteEdge: (id: string) => void;
}

export function PropertiesPanel({ selectedNode, selectedEdge, onUpdateNode, onDeleteNode, onDeleteEdge }: PropertiesPanelProps) {
  if (!selectedNode && !selectedEdge) {
    return (
      <div className="h-full bg-[#080d18] border-l border-white/8 flex flex-col items-center justify-center p-4">
        <div className="text-4xl mb-3 opacity-20">⚙️</div>
        <p className="text-white/25 text-xs text-center">Click a node to edit properties</p>
      </div>
    );
  }

  if (selectedEdge) {
    return (
      <div className="h-full bg-[#080d18] border-l border-white/8 flex flex-col p-4 gap-4">
        <div>
          <p className="text-white/40 text-[9px] font-mono uppercase tracking-wider mb-2">Connection</p>
          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <p className="text-white/60 text-xs">{selectedEdge.from} → {selectedEdge.to}</p>
            {selectedEdge.label && (
              <p className="text-xs mt-1" style={{ color: selectedEdge.label === "true" ? "#4ade80" : "#f87171" }}>
                Branch: {selectedEdge.label}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => onDeleteEdge(selectedEdge.id)}
          className="py-2 rounded-lg text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/15 transition-colors"
        >
          🗑 Delete Connection
        </button>
      </div>
    );
  }

  const node = selectedNode!;
  const def = NODE_DEF_MAP[node.type];
  if (!def) return null;

  function handleChange(key: string, value: string | number | boolean) {
    onUpdateNode(node.id, { ...node.data, [key]: value });
  }

  return (
    <div className="h-full bg-[#080d18] border-l border-white/8 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/8">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-xl"
            style={{ background: def.bgColor, border: `1px solid ${def.color}30` }}
          >
            {def.icon}
          </div>
          <div>
            <p className="text-white font-bold text-sm">{def.label}</p>
            <p className="text-[10px]" style={{ color: def.color }}>{def.category}</p>
          </div>
        </div>
        <p className="text-white/40 text-xs mt-2">{def.description}</p>
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <p className="text-white/40 text-[9px] font-mono uppercase tracking-wider mb-3">Properties</p>
          {def.fields.length === 0 ? (
            <p className="text-white/25 text-xs">No configuration needed.</p>
          ) : (
            def.fields.map((field) => (
              <div key={field.key} className="mb-3">
                <label className="text-white/50 text-[10px] mb-1.5 block">{field.label}</label>
                {field.type === "textarea" ? (
                  <textarea
                    value={String(node.data[field.key] ?? field.default ?? "")}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-white/20 resize-none"
                    rows={3}
                    style={{ borderColor: `${def.color}20` }}
                  />
                ) : field.type === "select" ? (
                  <select
                    value={String(node.data[field.key] ?? field.default ?? "")}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    className="w-full bg-[#0d1424] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                    style={{ borderColor: `${def.color}20` }}
                  >
                    {field.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.type}
                    value={String(node.data[field.key] ?? field.default ?? "")}
                    onChange={(e) => handleChange(field.key, field.type === "number" ? Number(e.target.value) : e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/25 focus:outline-none"
                    style={{ borderColor: `${def.color}20` }}
                  />
                )}
              </div>
            ))
          )}
        </div>

        {/* Node ID (debug) */}
        <div className="p-2.5 rounded-lg bg-white/3 border border-white/5">
          <p className="text-white/20 text-[9px] font-mono">id: {node.id}</p>
          <p className="text-white/20 text-[9px] font-mono">pos: {Math.round(node.x)}, {Math.round(node.y)}</p>
        </div>
      </div>

      {/* Delete */}
      <div className="p-4 border-t border-white/8">
        <button
          onClick={() => onDeleteNode(node.id)}
          className="w-full py-2 rounded-lg text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/15 transition-colors"
        >
          🗑 Delete Node
        </button>
      </div>
    </div>
  );
}
