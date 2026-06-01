import { useEffect, useRef, useState } from "react";
import { useDMAnalytics } from "../../hooks/useDM";

interface GraphNode {
  id: number;
  username: string;
  displayName: string | null | undefined;
  responseRate: number;
  totalMessages: number;
  closenessScore: number;
  engagementStrength: number;
  x: number;
  y: number;
}

function getNodeColor(closeness: number): string {
  if (closeness >= 75) return "#10b981";
  if (closeness >= 50) return "#ffcc33";
  if (closeness >= 25) return "#f59e0b";
  return "#6366f1";
}

function getInitials(name: string): string {
  return name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

const RING_COLORS = ["#ffcc33", "#8b5cf6", "#10b981", "#ec4899", "#3b82f6", "#ef4444"];

export function SocialGraph() {
  const { data, isLoading } = useDMAnalytics();
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const width = 340;
  const height = 320;
  const cx = width / 2;
  const cy = height / 2;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-white/30 text-sm">Loading graph...</p>
      </div>
    );
  }

  const contacts: GraphNode[] = (data?.perContact ?? [])
    .filter((c) => c.totalMessages > 0)
    .map((c, i) => {
      const closeness = Math.round(
        c.responseRate * 0.6 + Math.min(c.totalMessages * 2, 40)
      );
      const engagement = Math.min(100, c.totalMessages * 8);
      const angle = (i / Math.max((data?.perContact?.filter((x) => x.totalMessages > 0).length ?? 1), 1)) * 2 * Math.PI - Math.PI / 2;
      const radius = 100 - (closeness / 100) * 30;
      return {
        id: c.contactId,
        username: c.username,
        displayName: c.displayName,
        responseRate: c.responseRate,
        totalMessages: c.totalMessages,
        closenessScore: Math.min(100, closeness),
        engagementStrength: Math.min(100, engagement),
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
      };
    });

  if (contacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="text-4xl">🌐</div>
        <p className="text-white/40 text-sm">No relationships to graph yet</p>
        <p className="text-white/25 text-xs">Send some messages to see your social graph</p>
      </div>
    );
  }

  const hovered = hoveredId != null ? contacts.find((c) => c.id === hoveredId) : null;

  return (
    <div className="flex flex-col gap-3">
      {/* Graph SVG */}
      <div className="relative bg-white/3 rounded-2xl border border-white/10 overflow-hidden">
        <svg
          ref={svgRef}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full"
        >
          <defs>
            <radialGradient id="centerGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffcc33" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#ffcc33" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Background pulse */}
          <circle cx={cx} cy={cy} r={60} fill="url(#centerGrad)" />

          {/* Edges */}
          {contacts.map((node, i) => {
            const strength = node.engagementStrength / 100;
            const color = RING_COLORS[i % RING_COLORS.length]!;
            return (
              <line
                key={`edge-${node.id}`}
                x1={cx}
                y1={cy}
                x2={node.x}
                y2={node.y}
                stroke={color}
                strokeWidth={1 + strength * 3}
                strokeOpacity={0.15 + strength * 0.3}
                strokeDasharray={node.closenessScore < 30 ? "4 4" : undefined}
              />
            );
          })}

          {/* Contact nodes */}
          {contacts.map((node, i) => {
            const nodeRadius = 16 + (node.engagementStrength / 100) * 10;
            const color = RING_COLORS[i % RING_COLORS.length]!;
            const isHovered = hoveredId === node.id;
            const initials = getInitials(node.displayName ?? node.username);

            return (
              <g
                key={`node-${node.id}`}
                onMouseEnter={() => setHoveredId(node.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{ cursor: "pointer" }}
              >
                {isHovered && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={nodeRadius + 6}
                    fill={color}
                    fillOpacity={0.15}
                  />
                )}
                <circle cx={node.x} cy={node.y} r={nodeRadius} fill={`${color}25`} stroke={color} strokeWidth={isHovered ? 2.5 : 1.5} />
                <text x={node.x} y={node.y} textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight="700" fill="white" fontFamily="system-ui, sans-serif">
                  {initials}
                </text>
                <text x={node.x} y={node.y + nodeRadius + 10} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.6)" fontFamily="system-ui, sans-serif">
                  {(node.displayName ?? node.username).split(" ")[0]}
                </text>
              </g>
            );
          })}

          {/* Center "You" node */}
          <circle cx={cx} cy={cy} r={28} fill="#ffcc33" fillOpacity={0.2} stroke="#ffcc33" strokeWidth={2} />
          <circle cx={cx} cy={cy} r={22} fill="#0a0a14" stroke="#ffcc33" strokeWidth={1.5} />
          <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight="800" fill="#ffcc33" fontFamily="system-ui, sans-serif">
            YOU
          </text>
        </svg>
      </div>

      {/* Hovered Node Details */}
      {hovered && (
        <div className="bg-white/5 rounded-xl p-3 border border-white/10 animate-in fade-in duration-150">
          <div className="flex items-center justify-between mb-2">
            <p className="text-white font-bold text-sm">{hovered.displayName ?? hovered.username}</p>
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-bold"
              style={{ background: `${getNodeColor(hovered.closenessScore)}25`, color: getNodeColor(hovered.closenessScore) }}
            >
              {hovered.closenessScore >= 75 ? "Close" : hovered.closenessScore >= 50 ? "Connected" : hovered.closenessScore >= 25 ? "Warming" : "New"}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Closeness", value: `${hovered.closenessScore}%` },
              { label: "Engagement", value: `${hovered.engagementStrength}%` },
              { label: "Response Rate", value: `${hovered.responseRate}%` },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <p className="text-white font-bold text-sm">{value}</p>
                <p className="text-white/40 text-[9px]">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 pb-1">
        {[
          { color: "#10b981", label: "Close (75+)" },
          { color: "#ffcc33", label: "Connected (50+)" },
          { color: "#f59e0b", label: "Warming (25+)" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ background: color }} />
            <span className="text-[9px] text-white/40">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
