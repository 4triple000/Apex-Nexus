/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  APEX ENGINE 3D — Universal Input Overlay v2            ║
 * ║                                                          ║
 * ║  v2 changes:                                            ║
 * ║    ✓ Schema-aware: reads saved layout per gameMode      ║
 * ║    ✓ Mobile buttons driven by ACTION_TO_INPUT mapping   ║
 * ║    ✓ Desktop key hints from schema.desktopHints         ║
 * ║    ✓ Controller hints from schema.controllerHints       ║
 * ║    ✓ FPS mode → delegates to FPSMobileHUD (COD HUD)    ║
 * ╚══════════════════════════════════════════════════════════╝
 */
import { useEffect, useRef, useState, useCallback } from "react";
import type { InputManager } from "@/engine3d/InputManager";
import { getSchemaForMode, ACTION_TO_INPUT } from "@/engine3d/GameInputSchema";
import {
  generateLayoutFromSchema, loadLayoutForGame,
  type HUDLayout, type HUDElement,
} from "@/engine3d/HUDLayout";
import { FPSMobileHUD } from "./FPSMobileHUD";
import { JoystickZone, LookZone, DebugInputPanel } from "./MobileJoystick";

// ── Props ─────────────────────────────────────────────────────────────────────

/** Pass the raw game mode string (e.g. "fps", "openworld", "basketball") */
export type OverlayMode = string;

interface InputOverlayProps {
  manager:        InputManager;
  mode?:          OverlayMode;
  pointerLocked?: boolean;
  onBack?:        () => void;
  style?:         React.CSSProperties;
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const GRAD = "linear-gradient(135deg,#6C5CE7,#A29BFE,#FD79A8)";
const BORDER = "rgba(255,255,255,0.12)";

// ── Touch button helper ───────────────────────────────────────────────────────

function TouchBtn({
  btn, manager,
}: { btn: HUDElement; manager: InputManager }) {
  const [pressed, setPressed] = useState(false);

  const down = useCallback((e: React.TouchEvent | React.PointerEvent) => {
    e.preventDefault(); (e as React.TouchEvent).stopPropagation?.();
    setPressed(true);
    ACTION_TO_INPUT[btn.id]?.(manager, true);
  }, [btn.id, manager]);

  const up = useCallback((e: React.TouchEvent | React.PointerEvent) => {
    e.preventDefault();
    setPressed(false);
    ACTION_TO_INPUT[btn.id]?.(manager, false);
  }, [btn.id, manager]);

  const sz = btn.size * 0.62;   // scale from design px to overlay px

  return (
    <div
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={up}
      onPointerLeave={up}
      style={{
        position: "absolute",
        left: `${btn.x}%`, top: `${btn.y}%`,
        transform: "translate(-50%,-50%)",
        width: sz, height: sz, borderRadius: "50%",
        background: pressed ? "rgba(255,255,255,0.22)" : btn.color,
        border: `2px solid ${btn.border}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: sz > 44 ? 18 : 13, fontWeight: 800, color: "#fff",
        userSelect: "none", WebkitUserSelect: "none",
        cursor: "pointer",
        touchAction: "none",
        opacity: btn.opacity,
        boxShadow: pressed ? `0 0 14px ${btn.border}` : "none",
        transition: pressed ? "none" : "background 0.1s",
        zIndex: 25,
      }}
    >{btn.label}</div>
  );
}

// ── Schema-aware mobile HUD (all modes except fps which uses FPSMobileHUD) ───

function SchematicMobileHUD({ manager, gameMode }: { manager: InputManager; gameMode: string }) {
  const schema   = getSchemaForMode(gameMode);
  const fallback = generateLayoutFromSchema(schema);
  const layout   = loadLayoutForGame(gameMode, fallback);

  return (
    <>
      {/* ── Interactive joystick zone (left side — fixes the pipeline bug) ── */}
      {schema.hasJoystick && (
        <JoystickZone manager={manager} widthPct={45} />
      )}

      {/* ── Right-side swipe look zone ──────────────────────────────────── */}
      <LookZone manager={manager} widthPct={55} />

      {/* ── Action buttons (from saved layout) ──────────────────────────── */}
      {layout.buttons.filter((b) => b.visible).map((btn) => (
        <TouchBtn key={btn.id} btn={btn} manager={manager} />
      ))}
    </>
  );
}

// ── Desktop key hints ─────────────────────────────────────────────────────────

function DesktopHints({ gameMode, pointerLocked }: { gameMode: string; pointerLocked: boolean }) {
  const schema = getSchemaForMode(gameMode);
  const isFPS  = gameMode === "fps";

  return (
    <>
      {/* FPS: click-to-lock prompt */}
      {isFPS && !pointerLocked && (
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%,40px)",
          pointerEvents: "none", zIndex: 15,
          background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 20, padding: "7px 18px",
          fontSize: 12, color: "rgba(255,255,255,0.55)", fontWeight: 600,
        }}>Click to capture mouse</div>
      )}

      {/* Key hints grid */}
      {(isFPS ? pointerLocked : true) && (
        <div style={{
          position: "absolute", bottom: 16, left: 16,
          pointerEvents: "none", zIndex: 15,
          display: "flex", gap: 6, flexDirection: "column",
        }}>
          {schema.desktopHints.map(({ keys, desc }) => (
            <div key={keys} style={{ display: "flex", alignItems: "center", gap: 6, opacity: 0.36 }}>
              <kbd style={{
                background: "rgba(255,255,255,0.07)", border: `1px solid ${BORDER}`,
                borderRadius: 5, padding: "2px 6px", fontSize: 9, fontWeight: 700,
                color: "#fff", fontFamily: "monospace",
              }}>{keys}</kbd>
              <span style={{ fontSize: 9, color: "#aaa" }}>{desc}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ── Controller hints ──────────────────────────────────────────────────────────

function ControllerHints({ gameMode }: { gameMode: string }) {
  const { controllerHints } = getSchemaForMode(gameMode);
  return (
    <div style={{
      position: "absolute", bottom: 14, right: 14,
      pointerEvents: "none", zIndex: 15,
      display: "flex", gap: 6,
    }}>
      {controllerHints.map(({ btn, desc }) => (
        <div key={btn} style={{ textAlign: "center", opacity: 0.45 }}>
          <div style={{
            width: 30, height: 30, borderRadius: "50%",
            background: "rgba(255,255,255,0.06)", border: `1px solid ${BORDER}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 8, fontWeight: 800, color: "#fff", marginBottom: 3,
          }}>{btn}</div>
          <div style={{ fontSize: 7, color: "#888" }}>{desc}</div>
        </div>
      ))}
    </div>
  );
}

// ── Main InputOverlay ─────────────────────────────────────────────────────────

export function InputOverlay({
  manager, mode = "platformer", pointerLocked = false, onBack, style,
}: InputOverlayProps) {
  const [deviceType, setDeviceType] = useState(manager.deviceType);
  const [showDebug,  setShowDebug]  = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      if (manager.deviceType !== deviceType) setDeviceType(manager.deviceType);
    }, 500);
    return () => clearInterval(id);
  }, [manager, deviceType]);

  const gameMode = mode;

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 20,
      pointerEvents: "none", userSelect: "none", WebkitUserSelect: "none",
      ...style,
    }}>

      {/* ── Back button ──────────────────────────────────────────────────── */}
      {onBack && (
        <button
          onClick={onBack}
          style={{
            position: "absolute", top: 10, left: 10, zIndex: 30,
            background: "rgba(0,0,0,0.55)", border: `1px solid ${BORDER}`,
            borderRadius: 20, color: "#aaa", fontSize: 12, fontWeight: 600,
            padding: "6px 14px", cursor: "pointer", pointerEvents: "all",
          }}
        >← Back</button>
      )}

      {/* ── Mobile controls ──────────────────────────────────────────────── */}
      {deviceType === "mobile" && (
        <div style={{ position: "absolute", inset: 0, pointerEvents: "all" }}>
          {gameMode === "fps" ? (
            <FPSMobileHUD manager={manager} />
          ) : (
            <SchematicMobileHUD manager={manager} gameMode={gameMode} />
          )}
        </div>
      )}

      {/* ── Desktop controls ─────────────────────────────────────────────── */}
      {deviceType === "desktop" && (
        <DesktopHints gameMode={gameMode} pointerLocked={pointerLocked} />
      )}

      {/* ── Controller hints ─────────────────────────────────────────────── */}
      {deviceType === "controller" && (
        <ControllerHints gameMode={gameMode} />
      )}

      {/* ── Debug toggle button (top-right corner) ───────────────────────── */}
      <button
        onClick={() => setShowDebug((v) => !v)}
        style={{
          position: "absolute", top: 10, right: 10, zIndex: 50,
          background: showDebug ? "rgba(108,92,231,0.6)" : "rgba(0,0,0,0.45)",
          border: `1px solid ${showDebug ? "#6c5ce7" : BORDER}`,
          borderRadius: 12, color: showDebug ? "#fff" : "#666",
          fontSize: 9, fontWeight: 800, padding: "4px 9px",
          cursor: "pointer", pointerEvents: "all", letterSpacing: 0.5,
        }}
      >DBG</button>

      {/* ── Debug panel ──────────────────────────────────────────────────── */}
      {showDebug && (
        <div style={{ pointerEvents: "all" }}>
          <DebugInputPanel manager={manager} onClose={() => setShowDebug(false)} />
        </div>
      )}
    </div>
  );
}
