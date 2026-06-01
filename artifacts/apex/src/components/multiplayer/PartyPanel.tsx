import { useState } from "react";
import { UserPlus, X, Crown, Check, Clock } from "lucide-react";

const IOS    = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";
const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

export interface PartyMember {
  playerId: string;
  name: string;
  ready: boolean;
  isHost: boolean;
  rank?: string;
  ping?: number;
  avatar?: string;
}

interface Props {
  members: PartyMember[];
  currentPlayerId: string;
  onKick: (playerId: string) => void;
  onToggleReady: () => void;
  onInvite: () => void;
  isReady: boolean;
  disabled?: boolean;
}

const RANK_COLORS: Record<string, string> = {
  Bronze: "#CD7F32",
  Silver: "#C0C0C0",
  Gold: "#FFD700",
  Platinum: "#00FFFF",
  Diamond: "#B9F2FF",
  Elite: "#FF00FF",
};

const EMPTY_SLOT_COUNT = 4; // show up to 4 slots

function AvatarCircle({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const hue = name.charCodeAt(0) * 17 % 360;
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `linear-gradient(135deg, hsl(${hue},70%,45%), hsl(${(hue + 60) % 360},70%,35%))`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.38, fontWeight: 700, color: "#fff",
      flexShrink: 0,
      boxShadow: `0 0 0 2px rgba(255,255,255,0.08), 0 2px 8px rgba(0,0,0,0.4)`,
    }}>
      {initials}
    </div>
  );
}

export function PartyPanel({ members, currentPlayerId, onKick, onToggleReady, onInvite, isReady, disabled }: Props) {
  const [hoveredKick, setHoveredKick] = useState<string | null>(null);

  const isHost = members.find(m => m.playerId === currentPlayerId)?.isHost ?? false;
  const allReady = members.length >= 2 && members.every(m => m.ready);
  const filledCount = members.length;
  const emptySlots = Math.max(0, EMPTY_SLOT_COUNT - filledCount);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 3, height: 16, borderRadius: 2,
            background: "linear-gradient(180deg, #06B6D4, #3B82F6)",
          }} />
          <span style={{ color: "rgba(255,255,255,0.50)", fontSize: 11, fontWeight: 600,
            letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Squad — {filledCount}/{EMPTY_SLOT_COUNT}
          </span>
        </div>

        {/* Invite button */}
        <button
          onClick={onInvite}
          disabled={disabled || filledCount >= EMPTY_SLOT_COUNT}
          style={{
            all: "unset", cursor: disabled ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 12px", borderRadius: 10,
            background: "rgba(6,182,212,0.12)",
            border: "1px solid rgba(6,182,212,0.25)",
            color: "#06B6D4", fontSize: 11, fontWeight: 600,
            opacity: filledCount >= EMPTY_SLOT_COUNT ? 0.4 : 1,
            transition: `opacity 0.15s ${IOS}`,
          }}
        >
          <UserPlus size={12} />
          Invite
        </button>
      </div>

      {/* Member rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {members.map((member, idx) => {
          const isCurrentPlayer = member.playerId === currentPlayerId;
          const canKick = isHost && !isCurrentPlayer;

          return (
            <div
              key={member.playerId}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 14px", borderRadius: 14,
                background: isCurrentPlayer
                  ? "rgba(162,155,254,0.07)"
                  : "rgba(255,255,255,0.04)",
                border: isCurrentPlayer
                  ? "1px solid rgba(162,155,254,0.15)"
                  : "1px solid rgba(255,255,255,0.06)",
                animation: `slideIn 0.32s ${SPRING} both`,
                animationDelay: `${idx * 0.06}s`,
              }}
            >
              {/* Avatar */}
              <div style={{ position: "relative" }}>
                <AvatarCircle name={member.name} size={38} />
                {/* Ready indicator */}
                <div style={{
                  position: "absolute", bottom: -1, right: -1,
                  width: 12, height: 12, borderRadius: "50%",
                  background: member.ready ? "#10B981" : "rgba(255,255,255,0.2)",
                  border: "2px solid #0A0A0F",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: `background 0.2s ${IOS}`,
                }}>
                  {member.ready && <Check size={6} color="#fff" strokeWidth={3} />}
                </div>
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{
                    fontSize: 13, fontWeight: 700,
                    color: isCurrentPlayer ? "#C4B5FD" : "rgba(255,255,255,0.85)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {member.name}
                  </span>
                  {member.isHost && (
                    <Crown size={11} color="#FFD700" style={{ flexShrink: 0 }} />
                  )}
                  {isCurrentPlayer && (
                    <span style={{ fontSize: 9, color: "rgba(196,181,253,0.6)", fontWeight: 600,
                      letterSpacing: "0.04em" }}>
                      YOU
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                  {member.rank && (
                    <span style={{ fontSize: 10, fontWeight: 600,
                      color: RANK_COLORS[member.rank] ?? "rgba(255,255,255,0.4)" }}>
                      {member.rank}
                    </span>
                  )}
                  {member.ping != null && (
                    <span style={{ fontSize: 10, color: pingColor(member.ping), fontWeight: 500 }}>
                      {member.ping}ms
                    </span>
                  )}
                </div>
              </div>

              {/* Right side — ready badge or kick */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {/* Status badge */}
                <div style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
                  padding: "3px 8px", borderRadius: 6,
                  color: member.ready ? "#10B981" : "rgba(255,255,255,0.30)",
                  background: member.ready ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${member.ready ? "rgba(16,185,129,0.25)" : "rgba(255,255,255,0.08)"}`,
                  transition: `all 0.18s ${IOS}`,
                }}>
                  {member.ready ? "READY" : "WAIT"}
                </div>

                {/* Kick button (host only, not self) */}
                {canKick && (
                  <button
                    onClick={() => onKick(member.playerId)}
                    onMouseEnter={() => setHoveredKick(member.playerId)}
                    onMouseLeave={() => setHoveredKick(null)}
                    style={{
                      all: "unset", cursor: "pointer",
                      width: 24, height: 24, borderRadius: 6,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: hoveredKick === member.playerId ? "rgba(239,68,68,0.15)" : "transparent",
                      color: hoveredKick === member.playerId ? "#EF4444" : "rgba(255,255,255,0.25)",
                      transition: `all 0.15s ${IOS}`,
                    }}
                  >
                    <X size={12} strokeWidth={2.5} />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Empty slots */}
        {Array.from({ length: emptySlots }).map((_, i) => (
          <div
            key={`empty-${i}`}
            onClick={onInvite}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 14px", borderRadius: 14,
              background: "rgba(255,255,255,0.02)",
              border: "1px dashed rgba(255,255,255,0.08)",
              cursor: "pointer",
              opacity: 0.6,
            }}
          >
            <div style={{
              width: 38, height: 38, borderRadius: "50%",
              background: "rgba(255,255,255,0.04)",
              border: "1.5px dashed rgba(255,255,255,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <UserPlus size={14} color="rgba(255,255,255,0.25)" />
            </div>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.25)", fontWeight: 500 }}>
              Open slot — tap to invite
            </span>
          </div>
        ))}
      </div>

      {/* Ready toggle (for current player) */}
      <button
        onClick={onToggleReady}
        disabled={disabled}
        style={{
          all: "unset", cursor: disabled ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: "11px 0", borderRadius: 12,
          background: isReady
            ? "rgba(16,185,129,0.12)"
            : "rgba(255,255,255,0.05)",
          border: `1px solid ${isReady ? "rgba(16,185,129,0.30)" : "rgba(255,255,255,0.10)"}`,
          color: isReady ? "#10B981" : "rgba(255,255,255,0.55)",
          fontSize: 13, fontWeight: 700, letterSpacing: "0.04em",
          transition: `all 0.22s ${SPRING}`,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {isReady ? (
          <><Check size={14} strokeWidth={3} /> READY</>
        ) : (
          <><Clock size={14} /> MARK READY</>
        )}
      </button>

      {/* All-ready status */}
      {allReady && (
        <div style={{
          textAlign: "center", fontSize: 11, color: "#10B981", fontWeight: 600,
          letterSpacing: "0.06em", padding: "6px 0",
          animation: `fadeIn 0.3s ${IOS} both`,
        }}>
          ✓ All players ready
        </div>
      )}
    </div>
  );
}

function pingColor(ping: number): string {
  if (ping < 40) return "#10B981";
  if (ping < 80) return "#F59E0B";
  return "#EF4444";
}
