import { useState, useEffect } from "react";
import { useApexState, type ApexState } from "@/contexts/ApexStateContext";
import { useLocation } from "wouter";

const STATE_CONFIG: Record<ApexState, { color: string; glow: string; pulse: boolean; label: string }> = {
  idle:       { color: "#6C5CE7", glow: "rgba(108,92,231,0.6)",  pulse: true,  label: "Apex" },
  listening:  { color: "#00D2D3", glow: "rgba(0,210,211,0.75)",  pulse: false, label: "Listening…" },
  thinking:   { color: "#A29BFE", glow: "rgba(162,155,254,0.8)", pulse: false, label: "Thinking…" },
  responding: { color: "#FD79A8", glow: "rgba(253,121,168,0.75)",pulse: false, label: "Responding" },
  active:     { color: "#55EFC4", glow: "rgba(85,239,196,0.8)",  pulse: true,  label: "Active" },
};

export function ApexOrb() {
  const { state, setState, wakePhrase } = useApexState();
  const [, nav] = useLocation();
  const [expanded, setExpanded]     = useState(false);
  const [dragging, setDragging]     = useState(false);
  const [hovered, setHovered]       = useState(false);
  const [tick, setTick]             = useState(0);
  const cfg = STATE_CONFIG[state];

  // Subtle floating tick for alive effect
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 50);
    return () => clearInterval(t);
  }, []);

  const floatY = Math.sin(tick * 0.04) * 3;
  const floatX = Math.cos(tick * 0.025) * 1.5;

  // Wake phrase listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setExpanded(false); setState("idle"); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setState]);

  const handleTap = () => {
    if (expanded) {
      setExpanded(false);
      setState("idle");
    } else {
      setExpanded(true);
      setState("active");
    }
  };

  const handleGoToChat = () => {
    setExpanded(false);
    setState("idle");
    nav("/");
  };

  return (
    <>
      {/* ── Backdrop when expanded ─────────────────────────────────────────── */}
      {expanded && (
        <div
          onClick={() => { setExpanded(false); setState("idle"); }}
          style={{
            position: "fixed", inset: 0, zIndex: 49,
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            animation: "fadeIn 0.25s ease",
          }}
        />
      )}

      {/* ── Quick AI Chat Overlay ──────────────────────────────────────────── */}
      {expanded && (
        <div
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 60,
            width: "min(360px, 90vw)",
            background: "linear-gradient(135deg, rgba(20,18,35,0.97) 0%, rgba(15,12,28,0.99) 100%)",
            border: `1px solid ${cfg.color}44`,
            borderRadius: 24,
            padding: 24,
            boxShadow: `0 0 60px ${cfg.glow}, 0 32px 80px rgba(0,0,0,0.7)`,
            animation: "scaleIn 0.3s cubic-bezier(0.34,1.56,0.64,1)",
          }}
        >
          {/* State indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: `radial-gradient(circle at 35% 35%, ${cfg.color}, ${cfg.color}88)`,
              boxShadow: `0 0 20px ${cfg.glow}`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontSize: 16 }}>✦</span>
            </div>
            <div>
              <div style={{ color: "white", fontWeight: 700, fontSize: 15 }}>Apex AI</div>
              <div style={{ color: cfg.color, fontSize: 12, fontWeight: 600 }}>{cfg.label}</div>
            </div>
            <button
              onClick={() => { setExpanded(false); setState("idle"); }}
              style={{ marginLeft: "auto", color: "rgba(255,255,255,0.4)", fontSize: 18, lineHeight: 1, background: "none", border: "none", cursor: "pointer" }}
            >×</button>
          </div>

          <div style={{
            background: "rgba(255,255,255,0.04)", borderRadius: 16,
            padding: "16px", marginBottom: 16, border: "1px solid rgba(255,255,255,0.07)",
          }}>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, lineHeight: 1.6, margin: 0 }}>
              Say <span style={{ color: cfg.color, fontWeight: 700 }}>"{wakePhrase}"</span> or open the full chat to start a conversation.
            </p>
          </div>

          {/* State selector */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {(["idle", "listening", "thinking", "responding"] as ApexState[]).map(s => (
              <button
                key={s}
                onClick={() => setState(s)}
                style={{
                  padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600,
                  border: `1px solid ${state === s ? STATE_CONFIG[s].color + "88" : "rgba(255,255,255,0.12)"}`,
                  background: state === s ? STATE_CONFIG[s].color + "22" : "transparent",
                  color: state === s ? STATE_CONFIG[s].color : "rgba(255,255,255,0.4)",
                  cursor: "pointer", transition: "all 0.2s",
                  textTransform: "capitalize",
                }}
              >
                {s}
              </button>
            ))}
          </div>

          <button
            onClick={handleGoToChat}
            style={{
              width: "100%", padding: "12px", borderRadius: 14,
              background: `linear-gradient(135deg, ${cfg.color}, ${cfg.color}bb)`,
              border: "none", color: "white", fontWeight: 700, fontSize: 14,
              cursor: "pointer", boxShadow: `0 0 24px ${cfg.glow}`,
              transition: "all 0.2s",
            }}
          >
            Open Full Chat →
          </button>
        </div>
      )}

      {/* ── The Orb ────────────────────────────────────────────────────────── */}
      <div
        onClick={handleTap}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: "fixed",
          top: 14,
          right: 16,
          zIndex: 55,
          width: 42,
          height: 42,
          borderRadius: "50%",
          cursor: "pointer",
          transform: `translate(${floatX}px, ${floatY}px) scale(${hovered ? 1.12 : expanded ? 1.2 : 1})`,
          transition: "transform 0.3s cubic-bezier(0.34,1.56,0.64,1)",
          willChange: "transform",
        }}
      >
        {/* Outer glow ring */}
        <div style={{
          position: "absolute", inset: -6,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${cfg.glow} 0%, transparent 70%)`,
          opacity: state === "idle" ? 0.5 : 0.9,
          animation: cfg.pulse ? "orbPulse 2.4s ease-in-out infinite" : state === "listening" ? "orbBeat 0.6s ease-in-out infinite alternate" : "none",
          pointerEvents: "none",
        }} />

        {/* Core orb */}
        <div style={{
          position: "absolute", inset: 0,
          borderRadius: "50%",
          background: `radial-gradient(circle at 35% 30%, ${cfg.color}ff, ${cfg.color}77)`,
          boxShadow: [
            `0 0 0 1.5px ${cfg.color}55`,
            `0 0 16px ${cfg.glow}`,
            `0 0 32px ${cfg.color}33`,
            "0 4px 16px rgba(0,0,0,0.5)",
            "inset 0 1px 0 rgba(255,255,255,0.3)",
          ].join(", "),
        }}>
          <div style={{
            position: "absolute", inset: 0, display: "flex",
            alignItems: "center", justifyContent: "center",
          }}>
            <span style={{
              fontSize: 18, color: "white", lineHeight: 1,
              filter: `drop-shadow(0 0 6px ${cfg.glow})`,
              animation: state === "thinking" ? "spin 1.2s linear infinite" : "none",
            }}>
              {state === "idle" ? "✦" : state === "listening" ? "◉" : state === "thinking" ? "◌" : state === "responding" ? "◆" : "⚡"}
            </span>
          </div>
        </div>

        {/* Highlight */}
        <div style={{
          position: "absolute", top: 6, left: 9, width: 10, height: 6,
          borderRadius: "50%", background: "rgba(255,255,255,0.55)",
          filter: "blur(2px)", pointerEvents: "none",
        }} />

        {/* State label pill */}
        {(state !== "idle" || hovered) && (
          <div style={{
            position: "absolute", top: "50%", right: "calc(100% + 8px)",
            transform: "translateY(-50%)",
            background: "rgba(10,8,20,0.92)",
            border: `1px solid ${cfg.color}44`,
            borderRadius: 99, padding: "3px 10px",
            color: cfg.color, fontSize: 10, fontWeight: 700,
            whiteSpace: "nowrap",
            boxShadow: `0 0 12px ${cfg.glow}`,
            backdropFilter: "blur(12px)",
            animation: "fadeInLeft 0.2s ease",
            pointerEvents: "none",
          }}>
            {cfg.label}
          </div>
        )}
      </div>

      <style>{`
        @keyframes orbPulse {
          0%, 100% { opacity: 0.45; transform: scale(1); }
          50%       { opacity: 0.75; transform: scale(1.18); }
        }
        @keyframes orbBeat {
          0%   { opacity: 0.6; transform: scale(1); }
          100% { opacity: 1;   transform: scale(1.25); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.85); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes fadeInLeft {
          from { opacity: 0; transform: translateY(-50%) translateX(8px); }
          to   { opacity: 1; transform: translateY(-50%) translateX(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
