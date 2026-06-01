import type { BlockDef } from "@/data/blockSystem";
import { COMPONENT_REGISTRY } from "./componentRegistry";

const EIOS = "cubic-bezier(0.25,0.46,0.45,0.94)";

interface Props {
  blocks:          BlockDef[];
  selectedBlockId: string | null;
  onSelectBlock:   (id: string) => void;
}

function FallbackBlock({ block, selected }: { block: BlockDef; selected: boolean }) {
  return (
    <div style={{
      padding: "8px 10px",
      background: selected ? `${block.color}18` : block.accent,
      display: "flex", alignItems: "center", gap: 8,
    }}>
      <span style={{ fontSize: 16 }}>{block.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: block.color }}>{block.name}</div>
        <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {block.description}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {block.outputs.slice(0,2).map(o => (
          <div key={o} style={{ fontSize: 7, fontWeight: 600, color: `${block.color}80`, background: `${block.color}12`, borderRadius: 99, padding: "1px 5px" }}>
            {o}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CanvasRenderer({ blocks, selectedBlockId, onSelectBlock }: Props) {
  if (!blocks.length) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 12px", gap: 8, opacity: 0.4 }}>
        <div style={{ fontSize: 22 }}>📱</div>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textAlign: "center" }}>
          Add blocks to preview your app
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "6px 4px" }}>
      {blocks.map((block) => {
        const entry   = COMPONENT_REGISTRY[block.id];
        const selected = selectedBlockId === block.id;
        const LiveComp = entry?.component;

        return (
          <div
            key={block.id}
            style={{
              position: "relative",
              borderRadius: 12,
              border: selected
                ? `1.5px solid ${block.color}`
                : "1.5px solid transparent",
              boxShadow: selected ? `0 0 14px ${block.color}35` : "none",
              overflow: "hidden",
              transition: `border-color 0.18s ${EIOS}, box-shadow 0.18s ${EIOS}`,
              cursor: "pointer",
            }}
            onClick={() => onSelectBlock(block.id)}
          >
            {LiveComp ? (
              <LiveComp blockColor={block.color} blockName={block.name} />
            ) : (
              <FallbackBlock block={block} selected={selected} />
            )}

            {/* Selection dot */}
            {selected && (
              <div style={{
                position: "absolute", top: 6, right: 6,
                width: 7, height: 7, borderRadius: "50%",
                background: block.color,
                boxShadow: `0 0 6px ${block.color}`,
                pointerEvents: "none",
              }} />
            )}

            {/* Block type label on hover via title tooltip */}
            {!LiveComp && (
              <div style={{
                position: "absolute", top: 0, right: 0, bottom: 0,
                width: 3, background: block.color, opacity: selected ? 1 : 0.3,
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
