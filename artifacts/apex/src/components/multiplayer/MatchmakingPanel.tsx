import { Globe, Wifi, Shield, ChevronRight } from "lucide-react";

const IOS = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";

const REGIONS = [
  { id: "us-east",    label: "US East",     flag: "🇺🇸", ping: 14 },
  { id: "eu-west",    label: "EU West",     flag: "🇪🇺", ping: 32 },
  { id: "ap-south",   label: "Asia Pacific", flag: "🌏", ping: 91 },
  { id: "us-west",    label: "US West",     flag: "🇺🇸", ping: 48 },
];

interface Props {
  selectedRegion: string;
  onRegionChange: (region: string) => void;
  queueSize: number;
  serverAuthority?: boolean;
  disabled?: boolean;
}

function PingBadge({ ping }: { ping: number }) {
  const color = ping < 40 ? "#10B981" : ping < 80 ? "#F59E0B" : "#EF4444";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 4,
      fontSize: 10, fontWeight: 600, color,
    }}>
      <Wifi size={9} color={color} />
      {ping}ms
    </div>
  );
}

export function MatchmakingPanel({ selectedRegion, onRegionChange, queueSize, serverAuthority = true, disabled }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{
          width: 3, height: 16, borderRadius: 2,
          background: "linear-gradient(180deg, #10B981, #06B6D4)",
        }} />
        <span style={{ color: "rgba(255,255,255,0.50)", fontSize: 11, fontWeight: 600,
          letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Matchmaking
        </span>
      </div>

      {/* Region selector */}
      <div style={{
        borderRadius: 14,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
        overflow: "hidden",
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "10px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}>
          <Globe size={13} color="rgba(255,255,255,0.35)" />
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.40)", fontWeight: 600,
            letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Region
          </span>
        </div>

        {REGIONS.map((region, idx) => {
          const isSelected = selectedRegion === region.id;
          return (
            <button
              key={region.id}
              disabled={disabled}
              onClick={() => onRegionChange(region.id)}
              style={{
                all: "unset",
                cursor: disabled ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center",
                width: "100%",
                padding: "11px 14px",
                borderBottom: idx < REGIONS.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                background: isSelected ? "rgba(16,185,129,0.07)" : "transparent",
                transition: `background 0.18s ${IOS}`,
                boxSizing: "border-box",
              }}
            >
              <span style={{ fontSize: 16, marginRight: 10 }}>{region.flag}</span>
              <span style={{
                flex: 1, fontSize: 13, fontWeight: isSelected ? 700 : 500,
                color: isSelected ? "rgba(255,255,255,0.90)" : "rgba(255,255,255,0.55)",
              }}>
                {region.label}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <PingBadge ping={region.ping} />
                {isSelected && (
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: "#10B981",
                    boxShadow: "0 0 6px rgba(16,185,129,0.60)",
                  }} />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Server info strip */}
      <div style={{
        display: "flex", gap: 8,
      }}>
        {/* Players in queue */}
        <div style={{
          flex: 1, display: "flex", alignItems: "center", gap: 8,
          padding: "10px 12px", borderRadius: 12,
          background: "rgba(108,92,231,0.07)",
          border: "1px solid rgba(108,92,231,0.15)",
        }}>
          <div style={{
            width: 7, height: 7, borderRadius: "50%",
            background: "#A29BFE",
            boxShadow: "0 0 6px rgba(162,155,254,0.70)",
            animation: "pulse 2s ease-in-out infinite",
            flexShrink: 0,
          }} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#C4B5FD",
              fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
              {queueSize.toLocaleString()}
            </div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.30)", fontWeight: 500, marginTop: 1 }}>
              IN QUEUE
            </div>
          </div>
        </div>

        {/* Server authority */}
        {serverAuthority && (
          <div style={{
            flex: 1, display: "flex", alignItems: "center", gap: 8,
            padding: "10px 12px", borderRadius: 12,
            background: "rgba(16,185,129,0.07)",
            border: "1px solid rgba(16,185,129,0.15)",
          }}>
            <Shield size={14} color="#10B981" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#10B981", lineHeight: 1 }}>
                Secured
              </div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.30)", fontWeight: 500, marginTop: 1 }}>
                SERVER-AUTH
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
