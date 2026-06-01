/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  APEX ENGINE — Mobile Joystick + Look Zone              ║
 * ║                                                          ║
 * ║  Root-cause fix for joystick input pipeline:            ║
 * ║  The InputOverlay sits over the canvas and blocks all   ║
 * ║  touch events from reaching InputManager's canvas       ║
 * ║  listeners. These components capture touch directly in  ║
 * ║  React and call InputManager's public setJoystick /     ║
 * ║  addLookDelta methods.                                  ║
 * ║                                                          ║
 * ║  JoystickZone  — left-side floating joystick            ║
 * ║  LookZone      — right-side swipe-to-look               ║
 * ║  DebugInputPanel — real-time moveX/Y / joystick state   ║
 * ╚══════════════════════════════════════════════════════════╝
 */
import { useRef, useState, useCallback, useEffect } from "react";
import type { InputManager } from "@/engine3d/InputManager";

const GRAD = "linear-gradient(135deg,#6C5CE7,#A29BFE,#FD79A8)";

// ── Joystick geometry ─────────────────────────────────────────────────────────

const JOY_R       = 56;   // outer ring radius (px)
const JOY_THUMB_R = 24;   // thumb radius (px)
const JOY_DEAD    = 0.08; // dead zone magnitude

// ── JoystickZone ──────────────────────────────────────────────────────────────
//
//  Covers the left 45 % of the screen. When the user places a finger anywhere
//  in this zone, a floating joystick base appears at the touch point and the
//  thumb tracks finger movement within JOY_R pixels.
//
//  setJoystick(dx, dy) / clearJoystick() are called directly on the manager.

interface JoystickZoneProps {
  manager:     InputManager;
  /** Width of the zone as a percentage of the container (default 45) */
  widthPct?:   number;
  /** Extra top-offset % to avoid UI chrome (default 0) */
  topPct?:     number;
  /** Bottom-offset % to avoid action-button rows (default 0) */
  bottomPct?:  number;
}

export function JoystickZone({
  manager,
  widthPct    = 45,
  topPct      = 0,
  bottomPct   = 0,
}: JoystickZoneProps) {
  // Finger tracking
  const touchIdRef  = useRef<number | null>(null);
  const baseRef     = useRef<{ x: number; y: number } | null>(null);

  // Visual state
  const [basePos, setBasePos] = useState<{ x: number; y: number } | null>(null);
  const [thumb,   setThumb]   = useState({ dx: 0, dy: 0 });

  // ── Touch handlers ──────────────────────────────────────────────────────────

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i]!;
      if (touchIdRef.current === null) {
        touchIdRef.current = t.identifier;
        baseRef.current    = { x: t.clientX, y: t.clientY };
        setBasePos({ x: t.clientX, y: t.clientY });
        setThumb({ dx: 0, dy: 0 });
        manager.setJoystick(0, 0);
        break;
      }
    }
  }, [manager]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i]!;
      if (t.identifier === touchIdRef.current && baseRef.current) {
        const rawX = (t.clientX - baseRef.current.x) / JOY_R;
        const rawY = (t.clientY - baseRef.current.y) / JOY_R;
        const len  = Math.hypot(rawX, rawY);
        const dx   = len > 1 ? rawX / len : rawX;
        const dy   = len > 1 ? rawY / len : rawY;

        // Apply dead zone
        const adjDX = Math.abs(dx) < JOY_DEAD ? 0 : dx;
        const adjDY = Math.abs(dy) < JOY_DEAD ? 0 : dy;

        setThumb({ dx, dy });                   // visual tracks raw (for smooth look)
        manager.setJoystick(adjDX, adjDY);      // input uses dead-zone-corrected
        break;
      }
    }
  }, [manager]);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i]!;
      if (t.identifier === touchIdRef.current) {
        touchIdRef.current = null;
        baseRef.current    = null;
        setBasePos(null);
        setThumb({ dx: 0, dy: 0 });
        manager.clearJoystick();
        break;
      }
    }
  }, [manager]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Touch capture zone — left side of screen */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        style={{
          position:   "absolute",
          left:       0,
          top:        `${topPct}%`,
          bottom:     `${bottomPct}%`,
          width:      `${widthPct}%`,
          zIndex:     19,       // below buttons (25), above look zone (18)
          touchAction:"none",   // suppress browser scroll / zoom
          WebkitUserSelect: "none",
          userSelect: "none",
        }}
      />

      {/* Floating joystick visual — renders at fixed screen position */}
      {basePos && (
        <div
          style={{
            position:   "fixed",
            left:       basePos.x - JOY_R,
            top:        basePos.y - JOY_R,
            width:      JOY_R * 2,
            height:     JOY_R * 2,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.05)",
            border:     "2px solid rgba(255,255,255,0.22)",
            pointerEvents: "none",
            zIndex:     30,
          }}
        >
          {/* Thumb dot */}
          <div style={{
            position: "absolute",
            left: "50%", top: "50%",
            width:  JOY_THUMB_R * 2,
            height: JOY_THUMB_R * 2,
            borderRadius: "50%",
            background: GRAD,
            opacity:    0.85,
            border:     "2px solid rgba(255,255,255,0.4)",
            boxShadow:  "0 0 12px rgba(108,92,231,0.5)",
            transform:  `translate(calc(-50% + ${thumb.dx * JOY_R}px), calc(-50% + ${thumb.dy * JOY_R}px))`,
            transition: "transform 0s",   // zero lag for responsiveness
          }} />

          {/* Crosshair guides */}
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.06)",
          }} />
        </div>
      )}
    </>
  );
}

// ── LookZone ──────────────────────────────────────────────────────────────────
//
//  Covers the right side of the screen. Every pixel of swipe translates to
//  a look delta in radians, passed to manager.addLookDelta(dx, dy).
//  Action buttons sit on top at higher z-index and capture their own touches.

interface LookZoneProps {
  manager:      InputManager;
  /** Width of the zone as % of container (default 55) */
  widthPct?:    number;
  /** Look sensitivity (radians per pixel). Default: 0.006 */
  sensitivity?: number;
}

export function LookZone({
  manager,
  widthPct    = 55,
  sensitivity = 0.006,
}: LookZoneProps) {
  const touchIdRef  = useRef<number | null>(null);
  const prevRef     = useRef({ x: 0, y: 0 });

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i]!;
      if (touchIdRef.current === null) {
        touchIdRef.current = t.identifier;
        prevRef.current    = { x: t.clientX, y: t.clientY };
        break;
      }
    }
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i]!;
      if (t.identifier === touchIdRef.current) {
        const dx = (t.clientX - prevRef.current.x) * sensitivity;
        const dy = (t.clientY - prevRef.current.y) * sensitivity;
        manager.addLookDelta(dx, dy);
        prevRef.current = { x: t.clientX, y: t.clientY };
        break;
      }
    }
  }, [manager, sensitivity]);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i]!;
      if (t.identifier === touchIdRef.current) {
        touchIdRef.current = null;
        break;
      }
    }
  }, []);

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      style={{
        position:   "absolute",
        right:      0,
        top:        0,
        bottom:     0,
        width:      `${widthPct}%`,
        zIndex:     18,        // below buttons (25) and joystick zone (19)
        touchAction:"none",
        WebkitUserSelect: "none",
        userSelect: "none",
      }}
    />
  );
}

// ── DebugInputPanel ───────────────────────────────────────────────────────────
//
//  Real-time overlay showing moveX/Y, joystick state, and movement readiness.
//  Polls manager.snapshot every animation frame.

interface DebugInputPanelProps {
  manager:  InputManager;
  onClose?: () => void;
}

export function DebugInputPanel({ manager, onClose }: DebugInputPanelProps) {
  const [snap, setSnap] = useState(manager.snapshot);
  const [joy,  setJoy]  = useState(manager.joystick);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const tick = () => {
      const s = manager.snapshot;
      const j = manager.joystick;
      setSnap({ ...s });
      setJoy({ ...j });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [manager]);

  const moving = Math.abs(snap.moveX) > 0.05 || Math.abs(snap.moveY) > 0.05;
  const bar = (v: number, col: string) => (
    <div style={{ width: 80, height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 3, overflow: "hidden" }}>
      <div style={{
        height: "100%",
        width:  `${Math.abs(v) * 80}px`,
        marginLeft: v < 0 ? `${(1 + v) * 40}px` : "40px",
        background: col,
        borderRadius: 3,
      }} />
    </div>
  );

  return (
    <div style={{
      position: "absolute", top: 50, left: 10, zIndex: 50,
      background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 10, padding: "10px 14px", minWidth: 180,
      fontFamily: "monospace", fontSize: 10, color: "#ccc",
      pointerEvents: "all",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontWeight: 700, color: "#a29bfe", fontSize: 11 }}>INPUT DEBUG</span>
        {onClose && (
          <span onClick={onClose} style={{ cursor: "pointer", color: "#ff7675", fontSize: 13 }}>✕</span>
        )}
      </div>

      {/* moveX */}
      <div style={{ marginBottom: 5 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
          <span>moveX</span>
          <span style={{ color: snap.moveX !== 0 ? "#00b894" : "#888" }}>
            {snap.moveX.toFixed(3)}
          </span>
        </div>
        {bar(snap.moveX, "#6c5ce7")}
      </div>

      {/* moveY */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
          <span>moveY</span>
          <span style={{ color: snap.moveY !== 0 ? "#00b894" : "#888" }}>
            {snap.moveY.toFixed(3)}
          </span>
        </div>
        {bar(snap.moveY, "#a29bfe")}
      </div>

      {/* Joystick */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: joy.active ? "#00b894" : "#636e72",
            boxShadow: joy.active ? "0 0 6px #00b894" : "none",
          }} />
          <span style={{ color: joy.active ? "#00b894" : "#888" }}>
            JOY {joy.active ? "ACTIVE" : "IDLE"}
          </span>
        </div>
        {joy.active && (
          <div style={{ marginTop: 3, color: "#dfe6e9", fontSize: 9 }}>
            dx={joy.dx.toFixed(2)} dy={joy.dy.toFixed(2)}
          </div>
        )}
      </div>

      {/* Movement state */}
      <div style={{
        padding: "4px 8px", borderRadius: 6, textAlign: "center",
        background: moving ? "rgba(0,184,148,0.15)" : "rgba(255,118,117,0.15)",
        border: `1px solid ${moving ? "rgba(0,184,148,0.3)" : "rgba(255,118,117,0.3)"}`,
        color: moving ? "#00b894" : "#ff7675",
        fontWeight: 700, fontSize: 10,
      }}>
        {moving ? "▶ MOVING" : "■ STATIONARY"}
      </div>

      {/* lookX/Y */}
      <div style={{ marginTop: 6, color: "#888", fontSize: 9 }}>
        look: ({snap.lookX.toFixed(3)}, {snap.lookY.toFixed(3)})
      </div>
      <div style={{ color: "#888", fontSize: 9 }}>
        device: {snap.deviceType}
      </div>

      {/* Failsafe warning */}
      {joy.active && !moving && (
        <div style={{
          marginTop: 6, padding: "3px 6px", borderRadius: 4,
          background: "rgba(253,121,168,0.2)", border: "1px solid rgba(253,121,168,0.4)",
          color: "#fd79a8", fontSize: 9, fontWeight: 700,
        }}>
          ⚠ JOY ACTIVE but moveX/Y = 0<br />
          Check setJoystick() connection
        </div>
      )}
    </div>
  );
}
