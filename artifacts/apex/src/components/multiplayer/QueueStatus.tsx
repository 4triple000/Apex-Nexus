import { useEffect, useState } from "react";

const IOS = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";

export type QueueState =
  | { phase: "idle" }
  | { phase: "searching"; waitMs: number; playersFound: number; playersNeeded: number }
  | { phase: "found"; roomId: string; playerCount: number }
  | { phase: "countdown"; secondsLeft: number; roomId: string }
  | { phase: "error"; message: string };

interface Props {
  state: QueueState;
}

function DotPulse({ color }: { color: string }) {
  return (
    <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
      {[0, 1, 2].map(i => (
        <div
          key={i}
          style={{
            width: 5, height: 5, borderRadius: "50%",
            background: color,
            animation: `dotBounce 1.2s ease-in-out infinite`,
            animationDelay: `${i * 0.20}s`,
          }}
        />
      ))}
    </div>
  );
}

function WaitTimeDisplay({ ms }: { ms: number }) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  const label = m > 0 ? `${m}m ${rem}s` : `${s}s`;
  return (
    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.40)", fontWeight: 500 }}>
      {label}
    </span>
  );
}

function PlayerCountBar({ found, needed }: { found: number; needed: number }) {
  const pct = Math.min(100, (found / needed) * 100);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.40)", fontWeight: 500 }}>
          Players
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>
          {found}
          <span style={{ color: "rgba(255,255,255,0.30)", fontWeight: 400 }}>/{needed}</span>
        </span>
      </div>
      <div style={{
        height: 4, borderRadius: 2,
        background: "rgba(255,255,255,0.07)",
        overflow: "hidden",
      }}>
        <div style={{
          height: "100%",
          width: `${pct}%`,
          borderRadius: 2,
          background: "linear-gradient(90deg, #6C5CE7, #A29BFE)",
          boxShadow: "0 0 8px rgba(162,155,254,0.60)",
          transition: `width 0.40s ${IOS}`,
        }} />
      </div>
    </div>
  );
}

export function QueueStatus({ state }: Props) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (state.phase !== "searching") return;
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, [state.phase]);

  if (state.phase === "idle") return null;

  // ── Searching ────────────────────────────────────────────────────────────
  if (state.phase === "searching") {
    return (
      <div style={{
        padding: "18px 18px", borderRadius: 16,
        background: "rgba(108,92,231,0.08)",
        border: "1px solid rgba(108,92,231,0.20)",
        display: "flex", flexDirection: "column", gap: 14,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <DotPulse color="#A29BFE" />
            <span style={{ fontSize: 14, fontWeight: 700, color: "#C4B5FD" }}>
              Searching for match…
            </span>
          </div>
          <WaitTimeDisplay ms={state.waitMs + tick * 1000} />
        </div>
        <PlayerCountBar found={state.playersFound} needed={state.playersNeeded} />
      </div>
    );
  }

  // ── Match found ───────────────────────────────────────────────────────────
  if (state.phase === "found") {
    return (
      <div style={{
        padding: "18px 18px", borderRadius: 16,
        background: "rgba(16,185,129,0.08)",
        border: "1px solid rgba(16,185,129,0.25)",
        display: "flex", alignItems: "center", gap: 12,
        animation: "pulse 1s ease-in-out 2",
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: "50%",
          background: "rgba(16,185,129,0.15)",
          border: "2px solid rgba(16,185,129,0.40)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20, flexShrink: 0,
        }}>
          ✓
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#10B981" }}>
            Match Found!
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.40)", marginTop: 2 }}>
            {state.playerCount} players · Loading…
          </div>
        </div>
      </div>
    );
  }

  // ── Countdown ─────────────────────────────────────────────────────────────
  if (state.phase === "countdown") {
    return (
      <div style={{
        padding: "18px 18px", borderRadius: 16,
        background: "rgba(239,68,68,0.08)",
        border: "1px solid rgba(239,68,68,0.25)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#FCA5A5" }}>
          Match starting in
        </span>
        <span style={{
          fontSize: 32, fontWeight: 900, color: "#EF4444",
          fontVariantNumeric: "tabular-nums",
          textShadow: "0 0 20px rgba(239,68,68,0.60)",
          animation: `countPop 0.4s ${IOS} both`,
        }}>
          {state.secondsLeft}
        </span>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (state.phase === "error") {
    return (
      <div style={{
        padding: "14px 16px", borderRadius: 14,
        background: "rgba(239,68,68,0.07)",
        border: "1px solid rgba(239,68,68,0.20)",
        fontSize: 12, color: "#FCA5A5", fontWeight: 500,
      }}>
        ⚠ {state.message}
      </div>
    );
  }

  return null;
}
