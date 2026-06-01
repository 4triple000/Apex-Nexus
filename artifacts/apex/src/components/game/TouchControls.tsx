/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  APEX GAME ENGINE — Touch Controls Overlay              ║
 * ╚══════════════════════════════════════════════════════════╝
 */
import { useEffect, useRef } from "react";

export interface TouchInput {
  left:  boolean;
  right: boolean;
  jump:  boolean;
}

interface TouchControlsProps {
  onInput: (input: TouchInput) => void;
}

// ── Button component ──────────────────────────────────────────────────────────

function GameButton({
  label, onDown, onUp, style,
}: {
  label: React.ReactNode;
  onDown: () => void;
  onUp:   () => void;
  style?: React.CSSProperties;
}) {
  const pressed = useRef(false);

  return (
    <div
      onPointerDown={(e) => {
        e.preventDefault();
        pressed.current = true;
        onDown();
      }}
      onPointerUp={(e) => {
        e.preventDefault();
        if (pressed.current) { pressed.current = false; onUp(); }
      }}
      onPointerLeave={(e) => {
        e.preventDefault();
        if (pressed.current) { pressed.current = false; onUp(); }
      }}
      onPointerCancel={(e) => {
        e.preventDefault();
        if (pressed.current) { pressed.current = false; onUp(); }
      }}
      style={{
        width: 62,
        height: 62,
        borderRadius: 14,
        background: "rgba(108,92,231,0.18)",
        border: "2px solid rgba(108,92,231,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 22,
        color: "#A29BFE",
        cursor: "pointer",
        userSelect: "none",
        WebkitUserSelect: "none",
        touchAction: "none",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        transition: "background 0.1s, transform 0.05s",
        ...style,
      }}
    >
      {label}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function TouchControls({ onInput }: TouchControlsProps) {
  const state = useRef<TouchInput>({ left: false, right: false, jump: false });

  const emit = () => onInput({ ...state.current });

  // Keyboard support (also wired here so it's co-located)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft"  || e.key === "a") { state.current.left  = true;  emit(); }
      if (e.key === "ArrowRight" || e.key === "d") { state.current.right = true;  emit(); }
      if (e.key === " " || e.key === "ArrowUp" || e.key === "w") {
        if (!state.current.jump) { state.current.jump = true; emit(); }
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft"  || e.key === "a") { state.current.left  = false; emit(); }
      if (e.key === "ArrowRight" || e.key === "d") { state.current.right = false; emit(); }
      if (e.key === " " || e.key === "ArrowUp" || e.key === "w") { state.current.jump = false; emit(); }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup",   up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{
      position:       "absolute",
      bottom:         20,
      left:           0,
      right:          0,
      display:        "flex",
      justifyContent: "space-between",
      alignItems:     "flex-end",
      padding:        "0 20px",
      pointerEvents:  "none",
    }}>
      {/* Left cluster: ← → */}
      <div style={{ display: "flex", gap: 10, pointerEvents: "all" }}>
        <GameButton
          label="◀"
          onDown={() => { state.current.left  = true;  emit(); }}
          onUp={  () => { state.current.left  = false; emit(); }}
        />
        <GameButton
          label="▶"
          onDown={() => { state.current.right = true;  emit(); }}
          onUp={  () => { state.current.right = false; emit(); }}
        />
      </div>

      {/* Right cluster: jump */}
      <div style={{ pointerEvents: "all" }}>
        <GameButton
          label="▲"
          onDown={() => { state.current.jump = true;  emit(); }}
          onUp={  () => { state.current.jump = false; emit(); }}
          style={{
            width: 72, height: 72,
            background: "rgba(162,155,254,0.22)",
            border: "2px solid rgba(162,155,254,0.55)",
            fontSize: 26,
          }}
        />
      </div>
    </div>
  );
}
