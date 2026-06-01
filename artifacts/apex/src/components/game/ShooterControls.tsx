/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  APEX SHOOTER CONTROLS — 4-way d-pad + fire button      ║
 * ╚══════════════════════════════════════════════════════════╝
 */
import { useEffect, useRef } from "react";

export interface ShooterInput {
  up:    boolean;
  down:  boolean;
  left:  boolean;
  right: boolean;
  shoot: boolean;
}

interface Props {
  onInput: (input: ShooterInput) => void;
}

function GameBtn({
  label, style, onDown, onUp,
}: {
  label: React.ReactNode;
  style?: React.CSSProperties;
  onDown: () => void;
  onUp:   () => void;
}) {
  const held = useRef(false);
  return (
    <div
      onPointerDown={(e) => { e.preventDefault(); held.current = true; onDown(); }}
      onPointerUp={(e)   => { e.preventDefault(); if (held.current) { held.current = false; onUp(); } }}
      onPointerLeave={(e)=> { e.preventDefault(); if (held.current) { held.current = false; onUp(); } }}
      onPointerCancel={(e)=>{ e.preventDefault(); if (held.current) { held.current = false; onUp(); } }}
      style={{
        width: 54, height: 54, borderRadius: 12,
        background: "rgba(108,92,231,0.18)",
        border: "2px solid rgba(108,92,231,0.40)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 20, color: "#A29BFE", cursor: "pointer",
        userSelect: "none", WebkitUserSelect: "none", touchAction: "none",
        backdropFilter: "blur(8px)",
        ...style,
      }}
    >
      {label}
    </div>
  );
}

export function ShooterControls({ onInput }: Props) {
  const st = useRef<ShooterInput>({ up: false, down: false, left: false, right: false, shoot: false });
  const emit = () => onInput({ ...st.current });

  useEffect(() => {
    const dn = (e: KeyboardEvent) => {
      if (e.key === "w" || e.key === "ArrowUp")    { st.current.up    = true;  emit(); }
      if (e.key === "s" || e.key === "ArrowDown")  { st.current.down  = true;  emit(); }
      if (e.key === "a" || e.key === "ArrowLeft")  { st.current.left  = true;  emit(); }
      if (e.key === "d" || e.key === "ArrowRight") { st.current.right = true;  emit(); }
      if (e.key === " " || e.key === "f" || e.key === "x") { st.current.shoot = true; emit(); }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "w" || e.key === "ArrowUp")    { st.current.up    = false; emit(); }
      if (e.key === "s" || e.key === "ArrowDown")  { st.current.down  = false; emit(); }
      if (e.key === "a" || e.key === "ArrowLeft")  { st.current.left  = false; emit(); }
      if (e.key === "d" || e.key === "ArrowRight") { st.current.right = false; emit(); }
      if (e.key === " " || e.key === "f" || e.key === "x") { st.current.shoot = false; emit(); }
    };
    window.addEventListener("keydown", dn);
    window.addEventListener("keyup",   up);
    return () => { window.removeEventListener("keydown", dn); window.removeEventListener("keyup", up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{
      position: "absolute", bottom: 20, left: 0, right: 0,
      display: "flex", justifyContent: "space-between", alignItems: "flex-end",
      padding: "0 20px", pointerEvents: "none",
    }}>
      {/* D-pad (left side) */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, pointerEvents: "all" }}>
        <GameBtn label="▲" onDown={() => { st.current.up    = true;  emit(); }} onUp={() => { st.current.up    = false; emit(); }} />
        <div style={{ display: "flex", gap: 4 }}>
          <GameBtn label="◀" onDown={() => { st.current.left  = true;  emit(); }} onUp={() => { st.current.left  = false; emit(); }} />
          <div style={{ width: 54, height: 54 }} />
          <GameBtn label="▶" onDown={() => { st.current.right = true;  emit(); }} onUp={() => { st.current.right = false; emit(); }} />
        </div>
        <GameBtn label="▼" onDown={() => { st.current.down  = true;  emit(); }} onUp={() => { st.current.down  = false; emit(); }} />
      </div>

      {/* Fire button (right side) */}
      <div style={{ pointerEvents: "all" }}>
        <GameBtn
          label="🔫"
          onDown={() => { st.current.shoot = true;  emit(); }}
          onUp={  () => { st.current.shoot = false; emit(); }}
          style={{
            width: 72, height: 72, borderRadius: "50%",
            background: "rgba(255,68,68,0.25)",
            border: "2px solid rgba(255,68,68,0.55)",
            fontSize: 26,
          }}
        />
      </div>
    </div>
  );
}
