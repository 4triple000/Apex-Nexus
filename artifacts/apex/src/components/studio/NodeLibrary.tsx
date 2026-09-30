import { useState } from "react";
import { NODE_DEFS, CATEGORY_LABELS, type NodeCategory } from "./nodeDefinitions";
import type { StudioNode } from "../../hooks/useStudio";

interface NodeLibraryProps {
  onAddNode: (node: Omit<StudioNode, "x" | "y">) => void;
}

export function NodeLibrary({ onAddNode }: NodeLibraryProps) {
  const [activeCategory, setActiveCategory] = useState<NodeCategory | "all">("all");
  const [search, setSearch] = useState("");

  const categories = Object.entries(CATEGORY_LABELS) as [NodeCategory, typeof CATEGORY_LABELS[string]][];

  const visible = NODE_DEFS.filter((n) => {
    if (activeCategory !== "all" && n.category !== activeCategory) return false;
    if (search && !n.label.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  function handleAdd(nodeType: string) {
    const def = NODE_DEFS.find((n) => n.type === nodeType);
    if (!def) return;
    onAddNode({
      id: `n_${Date.now()}`,
      type: nodeType,
      data: Object.fromEntries(def.fields.map((f) => [f.key, f.default ?? ""])),
    });
  }

  return (
    <div className="flex flex-col h-full bg-[transparent] border-r border-white/8 overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-white/8">
        <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-white/40 mb-2">Nodes</p>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..."
          className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-white/25 focus:outline-none"
        />
      </div>

      {/* Category pills */}
      <div className="flex gap-1 p-2 flex-wrap border-b border-white/5">
        <button
          onClick={() => setActiveCategory("all")}
          className={`px-2 py-0.5 rounded-full text-[9px] font-bold transition-all ${activeCategory === "all" ? "bg-white/20 text-white" : "text-white/40 hover:text-white/70"}`}
        >
          All
        </button>
        {categories.map(([cat, info]) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-2 py-0.5 rounded-full text-[9px] font-bold transition-all ${activeCategory === cat ? "text-black" : "text-white/40 hover:text-white/70"}`}
            style={activeCategory === cat ? { background: info.color } : {}}
          >
            {info.icon}
          </button>
        ))}
      </div>

      {/* Node list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {visible.map((def) => {
          const catInfo = CATEGORY_LABELS[def.category];
          return (
            <button
              key={def.type}
              onClick={() => handleAdd(def.type)}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all hover:bg-white/8 active:scale-95 border border-transparent hover:border-white/10"
              draggable
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                style={{ background: def.bgColor, border: `1px solid ${def.color}25` }}
              >
                {def.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-[11px] font-medium leading-tight">{def.label}</p>
                <p className="text-white/30 text-[9px] leading-tight truncate">{def.description}</p>
              </div>
              <div
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: catInfo.color }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
