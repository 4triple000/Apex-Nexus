/**
 * ProactiveSuggestions — Apex-initiated action pills.
 * Shown above the chat input when relationship level > 1.0 and suggestions exist.
 */
import { Sparkles } from "lucide-react";

const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const IOS    = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";

interface Props {
  suggestions: string[];
  relationshipLevel: number;
  onSelect: (text: string) => void;
}

export function ProactiveSuggestions({ suggestions, relationshipLevel, onSelect }: Props) {
  if (relationshipLevel < 1.2 || suggestions.length === 0) return null;

  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 6,
      padding: "8px 14px 0",
      animation: "dm-drawer-enter 0.28s ease-out both",
    }}>
      {/* Label */}
      <div style={{
        display: "flex", alignItems: "center", gap: 5,
        fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.28)",
        textTransform: "uppercase", letterSpacing: "0.06em",
      }}>
        <Sparkles size={9} style={{ color: "#A29BFE" }} />
        Apex suggests
      </div>

      {/* Scrollable pill row */}
      <div style={{
        display: "flex", gap: 6, overflowX: "auto",
        paddingBottom: 2,
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}>
        {suggestions.map((s, i) => (
          <button
            key={i}
            onClick={() => onSelect(s.replace(/^[⚔️🔄🧠💬🎯✨🤝⚡🔥]\s*/, ''))}
            style={{
              flexShrink: 0,
              padding: "6px 13px", borderRadius: 99, cursor: "pointer",
              background: "rgba(108,92,231,0.12)",
              border: "1px solid rgba(108,92,231,0.28)",
              fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.72)",
              whiteSpace: "nowrap",
              transition: `all 0.18s ${IOS}`,
              animationDelay: `${i * 0.05}s`,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(108,92,231,0.24)";
              (e.currentTarget as HTMLButtonElement).style.color = "white";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(108,92,231,0.12)";
              (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.72)";
            }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
