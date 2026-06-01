/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  APEX BASKETBALL CONTROLS — Move + Jump + Shoot         ║
 * ╚══════════════════════════════════════════════════════════╝
 */
import { useEffect, useRef } from "react";

export interface BasketballInput {
  left:  boolean;
  right: boolean;
  jump:  boolean;
  shoot: boolean;
}

interface Props {
  onInput: (input: BasketballInput) => void;
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
        width: 62, height: 62, borderRadius: 14,
        background: "rgba(108,92,231,0.18)",
        border: "2px solid rgba(108,92,231,0.40)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 22, color: "#A29BFE", cursor: "pointer",
        userSelect: "none", WebkitUserSelect: "none", touchAction: "none",
        backdropFilter: "blur(8px)",
        ...style,
      }}
    >
      {label}
    </div>
  );
}

export function BasketballControls({ onInput }: Props) {
  const st = useRef<BasketballInput>({ left: false, right: false, jump: false, shoot: false });
  const emit = () => onInput({ ...st.current });

  useEffect(() => {
    const dn = (e: KeyboardEvent) => {
      if (e.key === "a" || e.key === "ArrowLeft")  { st.current.left  = true;  emit(); }
      if (e.key === "d" || e.key === "ArrowRight") { st.current.right = true;  emit(); }
      if (e.key === "w" || e.key === "ArrowUp")    { if (!st.current.jump) { st.current.jump = true; emit(); } }
      if (e.key === " " || e.key === "f")          { st.current.shoot = true;  emit(); }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "a" || e.key === "ArrowLeft")  { st.current.left  = false; emit(); }
      if (e.key === "d" || e.key === "ArrowRight") { st.current.right = false; emit(); }
      if (e.key === "w" || e.key === "ArrowUp")    { st.current.jump  = false; emit(); }
      if (e.key === " " || e.key === "f")          { st.current.shoot = false; emit(); }
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
      {/* Left cluster: ← → */}
      <div style={{ display: "flex", gap: 10, pointerEvents: "all" }}>
        <GameBtn label="◀" onDown={() => { st.current.left  = true;  emit(); }} onUp={() => { st.current.left  = false; emit(); }} />
        <GameBtn label="▶" onDown={() => { st.current.right = true;  emit(); }} onUp={() => { st.current.right = false; emit(); }} />
      </div>

      {/* Right cluster: jump + shoot */}
      <div style={{ display: "flex", gap: 10, pointerEvents: "all" }}>
        <GameBtn
          label="▲"
          onDown={() => { st.current.jump = true;  emit(); }}
          onUp={  () => { st.current.jump = false; emit(); }}
          style={{ width: 62, height: 62 }}
        />
        <GameBtn
          label="🏀"
          onDown={() => { st.current.shoot = true;  emit(); }}
          onUp={  () => { st.current.shoot = false; emit(); }}
          style={{
            width: 72, height: 72, borderRadius: "50%",
            background: "rgba(255,140,0,0.25)",
            border: "2px solid rgba(255,140,0,0.55)",
            fontSize: 26,
          }}
        />
      </div>
    </div>
  );
}
