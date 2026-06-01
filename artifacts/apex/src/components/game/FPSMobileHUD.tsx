/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  APEX ENGINE 3D — COD-Style Mobile FPS HUD v1           ║
 * ║                                                         ║
 * ║  Features:                                              ║
 * ║    🔫  Fire, Jump, Crouch, Reload, Scope buttons        ║
 * ║    ✏️   Drag-and-drop HUD editor with grid overlay      ║
 * ║    🎮  4 presets: COD Classic, Simple, Pro Claw, Minimal║
 * ║    📐  Per-button size, opacity, visibility controls    ║
 * ║    💾  Layout saved to localStorage                     ║
 * ║    🌀  Optional gyroscope aim (tilt-to-look)           ║
 * ╚══════════════════════════════════════════════════════════╝
 */
import { useEffect, useRef, useState, useCallback } from "react";
import type { InputManager } from "@/engine3d/InputManager";
import {
  type HUDLayout, type HUDElement, type ButtonId,
  PRESETS, cloneLayout, saveLayout, loadLayout, getAutoPreset,
} from "@/engine3d/HUDLayout";
import { JoystickZone, LookZone } from "./MobileJoystick";
import { useHUDOptimizer } from "@/hooks/useHUDOptimizer";
import type { AdaptMode } from "@/engine3d/HUDOptimizer";
import { THUMB_ZONES } from "@/engine3d/HUDOptimizer";

// ── Props ─────────────────────────────────────────────────────────────────────

interface FPSMobileHUDProps {
  manager: InputManager;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const GRAD     = "linear-gradient(135deg,#6C5CE7,#A29BFE,#FD79A8)";
const GOLD     = "#ffcc33";
const BG_GLASS = "rgba(7,8,14,0.88)";

const ACTION_MAP: Partial<Record<ButtonId, (m: InputManager, held: boolean) => void>> = {
  fire:   (m, h) => m.setShoot(h),
  jump:   (m, h) => m.setJump(h),
  reload: (m, h) => m.setReload(h),
  crouch: (m, h) => m.setCrouch(h),
  scope:  (m, h) => m.setScope(h),
  sprint: (m, h) => m.setSprint(h),
};

// ── Main component ────────────────────────────────────────────────────────────

export function FPSMobileHUD({ manager }: FPSMobileHUDProps) {

  // ── State ──────────────────────────────────────────────────────────────────
  const [layout,    setLayout]    = useState<HUDLayout>(loadLayout);
  const layoutRef                 = useRef<HUDLayout>(layout);
  useEffect(() => { layoutRef.current = layout; }, [layout]);

  const [editMode,    setEditMode]    = useState(false);
  const [selectedId,  setSelectedId]  = useState<ButtonId | null>(null);
  const [showPresets, setShowPresets] = useState(false);
  const [adaptMode,   setAdaptMode]   = useState<AdaptMode>("balanced");
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [showThumbZones, setShowThumbZones] = useState(false);

  // ── AI optimizer ────────────────────────────────────────────────────────────
  const { recordPress, undo, toast, dismissToast, metrics, sessionPresses, generation, forceOptimize } =
    useHUDOptimizer({
      gameMode:  "fps",
      mode:      adaptMode,
      layout,
      setLayout: (next) => {
        setLayout(next);
        saveLayout(next);
      },
    });

  // Gyro
  const [gyroEnabled,    setGyroEnabled]    = useState(false);
  const [gyroSens,       setGyroSens]       = useState(5);
  const [gyroPermission, setGyroPermission] = useState<"unknown"|"granted"|"denied">("unknown");
  const [showGyroPanel,  setShowGyroPanel]  = useState(false);

  // Joystick thumb visual
  const [joyThumb, setJoyThumb] = useState({ dx: 0, dy: 0, active: false });
  const rafRef                  = useRef<number>(0);

  // Edit drag tracking
  const dragRef = useRef<{
    id:          ButtonId;
    startTouchX: number;
    startTouchY: number;
    startBtnX:   number;
    startBtnY:   number;
  } | null>(null);

  // ── Joystick visual sync (RAF) ─────────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      const j = manager.joystick;
      setJoyThumb(p =>
        p.dx === j.dx && p.dy === j.dy && p.active === j.active
          ? p
          : { dx: j.dx, dy: j.dy, active: j.active }
      );
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [manager]);

  // ── Gyroscope ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!gyroEnabled || gyroPermission === "denied") return;
    const handler = (e: DeviceMotionEvent) => {
      const rate = e.rotationRate;
      if (!rate || rate.gamma === null || rate.beta === null) return;
      const s = gyroSens * 0.00009;
      manager.setGyroLook(rate.gamma * s, rate.beta * s * 0.5);
    };
    window.addEventListener("devicemotion", handler);
    return () => window.removeEventListener("devicemotion", handler);
  }, [gyroEnabled, gyroSens, gyroPermission, manager]);

  const requestGyroPermission = useCallback(async () => {
    const DMEA = DeviceMotionEvent as unknown as {
      requestPermission?: () => Promise<string>;
    };
    if (typeof DMEA.requestPermission === "function") {
      try {
        const result = await DMEA.requestPermission();
        const ok = result === "granted";
        setGyroPermission(ok ? "granted" : "denied");
        if (ok) { setGyroEnabled(true); setShowGyroPanel(true); }
      } catch {
        setGyroPermission("denied");
      }
    } else {
      setGyroPermission("granted");
      setGyroEnabled(true);
      setShowGyroPanel(true);
    }
  }, []);

  const handleGyroToggle = useCallback(() => {
    if (gyroPermission === "unknown") {
      requestGyroPermission();
    } else if (gyroPermission === "denied") {
      alert("Gyroscope permission denied. Please allow in device settings.");
    } else {
      setGyroEnabled(e => !e);
      setShowGyroPanel(prev => !prev);
    }
  }, [gyroPermission, requestGyroPermission]);

  // ── Edit mode drag handlers ────────────────────────────────────────────────

  const onBtnEditTouchStart = useCallback(
    (e: React.TouchEvent, id: ButtonId) => {
      if (!editMode) return;
      e.preventDefault();
      e.stopPropagation();
      const t = e.changedTouches[0]!;
      const btn = layoutRef.current.buttons.find(b => b.id === id)!;
      dragRef.current = {
        id,
        startTouchX: t.clientX,
        startTouchY: t.clientY,
        startBtnX:   btn.x,
        startBtnY:   btn.y,
      };
      setSelectedId(id);
    },
    [editMode]
  );

  const onEditOverlayTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!dragRef.current) return;
      e.preventDefault();
      const t = e.changedTouches[0]!;
      const { id, startTouchX, startTouchY, startBtnX, startBtnY } = dragRef.current;
      const W = window.innerWidth, H = window.innerHeight;
      const nx = Math.max(4, Math.min(96, startBtnX + (t.clientX - startTouchX) / W * 100));
      const ny = Math.max(4, Math.min(96, startBtnY + (t.clientY - startTouchY) / H * 100));
      setLayout(prev => ({
        ...prev,
        buttons: prev.buttons.map(b => b.id === id ? { ...b, x: nx, y: ny } : b),
      }));
    },
    []
  );

  const onEditOverlayTouchEnd = useCallback(() => {
    dragRef.current = null;
  }, []);

  // ── Layout helpers ─────────────────────────────────────────────────────────

  const patchButton = (id: ButtonId, patch: Partial<HUDElement>) =>
    setLayout(prev => ({
      ...prev,
      buttons: prev.buttons.map(b => b.id === id ? { ...b, ...patch } : b),
    }));

  const handleSave = () => {
    saveLayout(layout);
    setEditMode(false);
    setSelectedId(null);
    setShowPresets(false);
  };

  const handleReset = () => {
    setLayout(getAutoPreset());
    setSelectedId(null);
  };

  const applyPreset = (preset: HUDLayout) => {
    setLayout(cloneLayout(preset));
    setShowPresets(false);
    setSelectedId(null);
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const JOY_R  = layout.joystick.size / 2;
  const JOY_TH = JOY_R * 0.47;

  const joystickStyle = {
    position:   "absolute" as const,
    left:       `calc(${layout.joystick.x}% - ${JOY_R}px)`,
    top:        `calc(${layout.joystick.y}% - ${JOY_R}px)`,
    width:      JOY_R * 2,
    height:     JOY_R * 2,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.04)",
    border:     "2px solid rgba(255,255,255,0.13)",
    pointerEvents: "none" as const,
    opacity:    layout.joystick.opacity,
    transition: editMode ? "none" : undefined,
    outline: editMode ? "2px dashed rgba(108,92,231,0.6)" : undefined,
    zIndex: 20,
  };

  const selectedBtn = layout.buttons.find(b => b.id === selectedId);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Interactive joystick zone (fixes the input pipeline bug) ──────── */}
      {!editMode && <JoystickZone manager={manager} widthPct={45} />}

      {/* ── Joystick position indicator in edit mode (visual-only) ──────────── */}
      {editMode && (
        <div style={{
          ...joystickStyle,
          pointerEvents: "none",
          opacity: layout.joystick.opacity * 0.7,
        }}>
          <div style={{
            position:    "absolute",
            left: "50%", top: "50%",
            width:       JOY_TH * 2, height: JOY_TH * 2, borderRadius: "50%",
            background:  GRAD, opacity: 0.5,
            border:      "2px solid rgba(255,255,255,0.35)",
            transform:   "translate(-50%, -50%)",
          }} />
        </div>
      )}

      {/* ── Interactive look zone (right half, captures swipe for camera) ─── */}
      {!editMode && <LookZone manager={manager} widthPct={55} sensitivity={0.006} />}

      {/* ── Look zone hint label ─────────────────────────────────────────── */}
      {!editMode && (
        <div style={{
          position: "absolute", top: 0, right: 0,
          width: "55%", height: "100%",
          pointerEvents: "none", zIndex: 17,
        }}>
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%,-50%)",
            fontSize: 9, color: "rgba(255,255,255,0.08)",
            fontWeight: 600, letterSpacing: 1,
            userSelect: "none",
          }}>SWIPE TO LOOK</div>
        </div>
      )}

      {/* ── Thumb zone overlay (when AI panel is open, show reach zones) ──── */}
      {showThumbZones && !editMode && THUMB_ZONES.filter(z => z.name !== "top").map(z => (
        <div key={z.name} style={{
          position: "absolute",
          left:    `${z.xMin}%`,
          top:     `${z.yMin}%`,
          width:   `${z.xMax - z.xMin}%`,
          height:  `${z.yMax - z.yMin}%`,
          borderRadius: 20,
          border:  `1.5px dashed rgba(108,92,231,0.35)`,
          background: "rgba(108,92,231,0.04)",
          pointerEvents: "none",
          zIndex:  16,
        }}>
          <div style={{
            position: "absolute", top: 6, left: 6,
            fontSize: 8, fontWeight: 700, color: "rgba(162,155,254,0.5)",
            letterSpacing: "0.08em",
          }}>
            {z.name === "left" ? "LEFT THUMB" : "RIGHT THUMB"}
          </div>
        </div>
      ))}

      {/* ── Action buttons ───────────────────────────────────────────────── */}
      {layout.buttons.map(btn => {
        if (!btn.visible && !editMode) return null;
        const isSelected = editMode && selectedId === btn.id;
        const inEditFade = editMode && !btn.visible;
        return (
          <ActionButton
            key={btn.id}
            btn={btn}
            editMode={editMode}
            isSelected={isSelected}
            dimmed={inEditFade}
            manager={manager}
            onEditTouchStart={onBtnEditTouchStart}
            onRecord={recordPress}
          />
        );
      })}

      {/* ── AI Optimizer Toast notification ──────────────────────────────── */}
      {toast.visible && (
        <div style={{
          position: "absolute", top: 56, left: "50%",
          transform: "translateX(-50%)",
          display: "flex", alignItems: "center", gap: 10,
          background: "rgba(7,8,14,0.92)", backdropFilter: "blur(20px)",
          border: "1px solid rgba(108,92,231,0.50)",
          borderRadius: 16, padding: "10px 14px",
          zIndex: 70, maxWidth: 280,
          boxShadow: "0 0 24px rgba(108,92,231,0.25), 0 8px 24px rgba(0,0,0,0.60)",
          animation: "toastIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both",
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
            background: "linear-gradient(135deg, #6C5CE7, #A29BFE)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13,
          }}>🤖</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#A29BFE",
              letterSpacing: "0.08em", marginBottom: 2 }}>
              HUD OPTIMIZED · Gen {toast.generation}
            </div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)",
              lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis",
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
              {toast.reasons.slice(0, 2).join(" · ")}
            </div>
          </div>
          {toast.canUndo && (
            <button onClick={undo} style={{
              all: "unset", cursor: "pointer",
              padding: "5px 9px", borderRadius: 8,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.15)",
              fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.55)",
              flexShrink: 0, letterSpacing: "0.05em",
            }}>UNDO</button>
          )}
          <button onClick={dismissToast} style={{
            all: "unset", cursor: "pointer", padding: 4,
            fontSize: 14, color: "rgba(255,255,255,0.30)", flexShrink: 0, lineHeight: 1,
          }}>✕</button>
        </div>
      )}

      {/* ── Edit mode: grid + drag overlay ──────────────────────────────── */}
      {editMode && (
        <div
          onTouchMove={onEditOverlayTouchMove}
          onTouchEnd={onEditOverlayTouchEnd}
          onTouchCancel={onEditOverlayTouchEnd}
          style={{
            position: "absolute", inset: 0,
            backgroundImage: "radial-gradient(circle, rgba(108,92,231,0.18) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            zIndex: 19,
            pointerEvents: "all",
          }}
        />
      )}

      {/* ── Edit mode: selected button controls ──────────────────────────── */}
      {editMode && selectedBtn && (
        <div style={{
          position: "absolute", bottom: 144, left: "50%",
          transform: "translateX(-50%)",
          background: BG_GLASS, backdropFilter: "blur(20px)",
          border: "1px solid rgba(108,92,231,0.35)",
          borderRadius: 18, padding: "14px 20px",
          display: "flex", flexDirection: "column", gap: 10,
          zIndex: 50, minWidth: 220,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: 1 }}>
            {selectedBtn.label} {selectedBtn.id.toUpperCase()}
          </div>
          {/* Size slider */}
          <SliderRow
            label="Size"
            value={selectedBtn.size}
            min={36} max={100}
            onChange={v => patchButton(selectedBtn.id, { size: v })}
          />
          {/* Opacity slider */}
          <SliderRow
            label="Opacity"
            value={Math.round(selectedBtn.opacity * 100)}
            min={20} max={100}
            onChange={v => patchButton(selectedBtn.id, { opacity: v / 100 })}
          />
          {/* Visible toggle */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>Visible</span>
            <ToggleSwitch
              value={selectedBtn.visible}
              onChange={v => patchButton(selectedBtn.id, { visible: v })}
            />
          </div>
        </div>
      )}

      {/* ── Edit mode: preset strip ──────────────────────────────────────── */}
      {editMode && showPresets && (
        <div style={{
          position: "absolute", top: 60, left: "50%",
          transform: "translateX(-50%)",
          display: "flex", gap: 8,
          background: BG_GLASS, backdropFilter: "blur(20px)",
          border: "1px solid rgba(108,92,231,0.3)",
          borderRadius: 16, padding: "10px 14px",
          zIndex: 60,
        }}>
          {PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => applyPreset(p)}
              style={{
                background: p.id === layout.id ? "rgba(108,92,231,0.5)" : "rgba(255,255,255,0.06)",
                border: `1px solid ${p.id === layout.id ? "rgba(162,155,254,0.7)" : "rgba(255,255,255,0.1)"}`,
                borderRadius: 10, color: "#fff", fontSize: 11, fontWeight: 700,
                padding: "6px 12px", cursor: "pointer",
              }}
            >{p.name}</button>
          ))}
        </div>
      )}

      {/* ── Edit mode: bottom toolbar ────────────────────────────────────── */}
      {editMode && (
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          background: BG_GLASS, backdropFilter: "blur(24px)",
          borderTop: "1px solid rgba(108,92,231,0.25)",
          padding: "12px 20px 20px",
          display: "flex", gap: 10, alignItems: "center", justifyContent: "center",
          zIndex: 55,
        }}>
          <ToolbarBtn label="Presets" icon="🎮" onClick={() => setShowPresets(p => !p)} />
          <ToolbarBtn label="Reset"   icon="↺"  onClick={handleReset} danger />
          <div style={{ flex: 1 }} />
          <ToolbarBtn label="Save & Done" icon="✓" onClick={handleSave} accent />
        </div>
      )}

      {/* ── Top-right controls: AI + gyro + edit ──────────────────────────── */}
      <div style={{
        position: "absolute", top: 12, right: 12,
        display: "flex", gap: 8, zIndex: 60,
        pointerEvents: "all",
      }}>
        {/* AI Optimizer button */}
        <button
          onClick={() => { setShowAIPanel(p => !p); setShowThumbZones(p => !p); }}
          style={{
            background: adaptMode !== "static"
              ? "rgba(108,92,231,0.30)" : "rgba(255,255,255,0.08)",
            border: `1px solid ${adaptMode !== "static"
              ? "rgba(162,155,254,0.65)" : "rgba(255,255,255,0.15)"}`,
            borderRadius: 20, padding: "5px 10px",
            fontSize: 11, color: "#fff", fontWeight: 700, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 5,
          }}
        >
          <span>🤖</span>
          <span style={{ fontSize: 9, letterSpacing: "0.05em" }}>
            {adaptMode === "static" ? "OFF" : adaptMode === "balanced" ? "AI" : "AI+"}
          </span>
          {generation > 0 && (
            <span style={{
              fontSize: 8, fontWeight: 800,
              color: "#A29BFE", marginLeft: -2,
            }}>G{generation}</span>
          )}
        </button>

        {/* Gyro button */}
        <button
          onClick={handleGyroToggle}
          style={{
            background: gyroEnabled ? "rgba(55,209,120,0.3)" : "rgba(255,255,255,0.08)",
            border: `1px solid ${gyroEnabled ? "rgba(55,209,120,0.7)" : "rgba(255,255,255,0.15)"}`,
            borderRadius: 20, padding: "5px 10px",
            fontSize: 11, color: "#fff", fontWeight: 700, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 5,
          }}
        >
          <span>🌀</span>
          <span style={{ fontSize: 9 }}>GYRO</span>
        </button>

        {/* Edit button */}
        <button
          onClick={() => { setEditMode(e => !e); setSelectedId(null); setShowPresets(false); }}
          style={{
            background: editMode ? "rgba(108,92,231,0.45)" : "rgba(255,255,255,0.08)",
            border: `1px solid ${editMode ? "rgba(162,155,254,0.7)" : "rgba(255,255,255,0.15)"}`,
            borderRadius: 20, padding: "5px 10px",
            fontSize: 11, color: "#fff", fontWeight: 700, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 5,
          }}
        >
          <span>✏️</span>
          <span style={{ fontSize: 9 }}>{editMode ? "EDITING" : "EDIT"}</span>
        </button>
      </div>

      {/* ── AI Optimizer Panel ───────────────────────────────────────────── */}
      {showAIPanel && (
        <div style={{
          position: "absolute", top: 48, right: 12,
          background: "rgba(7,8,14,0.94)", backdropFilter: "blur(20px)",
          border: "1px solid rgba(108,92,231,0.35)",
          borderRadius: 18, padding: "16px 18px",
          zIndex: 65, minWidth: 210, maxWidth: 240,
          pointerEvents: "all",
          boxShadow: "0 0 24px rgba(108,92,231,0.20), 0 8px 32px rgba(0,0,0,0.70)",
        }}>
          {/* Header */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginBottom: 14,
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: "50%",
              background: "linear-gradient(135deg,#6C5CE7,#A29BFE)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11,
            }}>🤖</div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#A29BFE",
                letterSpacing: "0.06em" }}>HUD AI OPTIMIZER</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>
                Gen {generation} · {sessionPresses} presses
              </div>
            </div>
          </div>

          {/* Mode selector */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.40)",
              letterSpacing: "0.10em", marginBottom: 7 }}>ADAPTATION MODE</div>
            <div style={{ display: "flex", gap: 5 }}>
              {(["static", "balanced", "aggressive"] as AdaptMode[]).map(m => (
                <button key={m} onClick={() => setAdaptMode(m)} style={{
                  flex: 1, padding: "6px 2px",
                  background: adaptMode === m ? "rgba(108,92,231,0.45)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${adaptMode === m ? "rgba(162,155,254,0.65)" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: 10, cursor: "pointer",
                  fontSize: 9, fontWeight: 800, color: adaptMode === m ? "#A29BFE" : "rgba(255,255,255,0.40)",
                  letterSpacing: "0.04em",
                }}>
                  {m === "static" ? "OFF" : m === "balanced" ? "BALANCED" : "FAST"}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", marginTop: 5, lineHeight: 1.5 }}>
              {adaptMode === "static"     ? "HUD stays fixed. No AI changes."
               : adaptMode === "balanced" ? "Adapts every 60s or 40 presses."
               : "Adapts every 30s or 20 presses — fastest."}
            </div>
          </div>

          {/* Metrics preview (top 3 buttons) */}
          {metrics.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.40)",
                letterSpacing: "0.10em", marginBottom: 7 }}>BUTTON ACTIVITY</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {[...metrics]
                  .sort((a, b) => b.usageCount - a.usageCount)
                  .slice(0, 4)
                  .map(m => {
                    const total = m.usageCount;
                    const maxCount = metrics.reduce((mx, x) => Math.max(mx, x.usageCount), 1);
                    const barW = total > 0 ? Math.round((total / maxCount) * 100) : 0;
                    return (
                      <div key={m.buttonId} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 10, width: 14, textAlign: "center" }}>
                          {m.buttonId === "fire"   ? "🔫"
                           : m.buttonId === "jump"   ? "⬆"
                           : m.buttonId === "scope"  ? "🔭"
                           : m.buttonId === "crouch" ? "⬇"
                           : m.buttonId === "reload" ? "R"
                           : m.buttonId === "sprint" ? "⚡" : m.buttonId[0]?.toUpperCase()}
                        </span>
                        <div style={{ flex: 1, height: 4, borderRadius: 3,
                          background: "rgba(255,255,255,0.07)" }}>
                          <div style={{
                            width: `${barW}%`, height: "100%", borderRadius: 3,
                            background: "linear-gradient(90deg,#6C5CE7,#A29BFE)",
                            transition: "width 0.4s ease",
                          }} />
                        </div>
                        <span style={{ fontSize: 8, color: "rgba(255,255,255,0.30)",
                          fontVariantNumeric: "tabular-nums", minWidth: 18 }}>
                          {total}
                        </span>
                      </div>
                    );
                  })
                }
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 7 }}>
            {adaptMode !== "static" && (
              <button onClick={() => { forceOptimize(); setShowAIPanel(false); }} style={{
                flex: 1, padding: "7px 4px",
                background: "rgba(108,92,231,0.35)",
                border: "1px solid rgba(162,155,254,0.50)",
                borderRadius: 10, cursor: "pointer",
                fontSize: 9, fontWeight: 800, color: "#A29BFE",
              }}>⚡ OPTIMIZE NOW</button>
            )}
            <button onClick={() => { undo(); setShowAIPanel(false); }} style={{
              flex: 1, padding: "7px 4px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 10, cursor: "pointer",
              fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.40)",
            }}>↺ UNDO</button>
          </div>

          <button onClick={() => { setShowAIPanel(false); setShowThumbZones(false); }} style={{
            marginTop: 10, width: "100%",
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8, color: "rgba(255,255,255,0.30)", fontSize: 9,
            padding: "5px", cursor: "pointer",
          }}>Close</button>
        </div>
      )}

      {/* ── Keyframe for toast ──────────────────────────────────────────────── */}
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-10px) scale(0.95); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0)      scale(1);    }
        }
      `}</style>

      {/* ── Gyro settings panel ──────────────────────────────────────────── */}
      {showGyroPanel && gyroPermission === "granted" && (
        <div style={{
          position: "absolute", top: 48, right: 12,
          background: BG_GLASS, backdropFilter: "blur(20px)",
          border: "1px solid rgba(55,209,120,0.3)",
          borderRadius: 16, padding: "14px 18px",
          zIndex: 60, minWidth: 190,
          pointerEvents: "all",
        }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(55,209,120,0.9)", marginBottom: 10 }}>
            🌀 GYROSCOPE AIM
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>Enabled</span>
            <ToggleSwitch value={gyroEnabled} onChange={setGyroEnabled} />
          </div>
          <SliderRow
            label="Sensitivity"
            value={gyroSens}
            min={1} max={15}
            onChange={setGyroSens}
          />
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 8 }}>
            Tilt phone to aim. Works alongside joystick look.
          </div>
          <button
            onClick={() => setShowGyroPanel(false)}
            style={{
              marginTop: 10, width: "100%",
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8, color: "rgba(255,255,255,0.5)", fontSize: 10,
              padding: "5px", cursor: "pointer",
            }}
          >Close</button>
        </div>
      )}
    </>
  );
}

// ── ActionButton ──────────────────────────────────────────────────────────────

interface ActionButtonProps {
  btn:             HUDElement;
  editMode:        boolean;
  isSelected:      boolean;
  dimmed:          boolean;
  manager:         InputManager;
  onEditTouchStart: (e: React.TouchEvent, id: ButtonId) => void;
  onRecord?:       (buttonId: string, x: number, y: number) => void;
}

function ActionButton({ btn, editMode, isSelected, dimmed, manager, onEditTouchStart, onRecord }: ActionButtonProps) {
  const [pressed, setPressed] = useState(false);

  const fire = ACTION_MAP[btn.id];

  const onDown = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (editMode) {
      onEditTouchStart(e, btn.id);
      return;
    }
    setPressed(true);
    fire?.(manager, true);
    // Record press for AI optimizer
    const t = e.changedTouches[0];
    onRecord?.(btn.id, t ? t.clientX : 0, t ? t.clientY : 0);
  }, [editMode, fire, manager, btn.id, onEditTouchStart, onRecord]);

  const onUp = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (editMode) return;
    setPressed(false);
    fire?.(manager, false);
  }, [editMode, fire, manager]);

  const r = btn.size / 2;

  return (
    <div
      onTouchStart={onDown}
      onTouchEnd={onUp}
      onTouchCancel={onUp}
      style={{
        position:   "absolute",
        left:       `calc(${btn.x}% - ${r}px)`,
        top:        `calc(${btn.y}% - ${r}px)`,
        width:      btn.size,
        height:     btn.size,
        borderRadius: "50%",
        background: pressed && !editMode ? "rgba(255,255,255,0.25)" : btn.color,
        border:     `2px solid ${isSelected ? "#A29BFE" : btn.border}`,
        display:    "flex", alignItems: "center", justifyContent: "center",
        fontSize:   btn.size > 60 ? 22 : btn.size > 48 ? 17 : 13,
        fontWeight: 800,
        color:      "#fff",
        opacity:    (dimmed ? 0.38 : 1) * btn.opacity,
        userSelect: "none" as const,
        WebkitUserSelect: "none" as const,
        cursor:     "pointer",
        zIndex:     25,
        boxShadow:  pressed && !editMode
          ? `0 0 18px ${btn.border}`
          : isSelected
          ? "0 0 14px rgba(162,155,254,0.6)"
          : editMode
          ? "0 0 8px rgba(108,92,231,0.4)"
          : "none",
        outline:    editMode ? "2px dashed rgba(108,92,231,0.45)" : undefined,
        transition: pressed || editMode
          ? "none"
          : "left 0.55s cubic-bezier(0.34,1.56,0.64,1), top 0.55s cubic-bezier(0.34,1.56,0.64,1), width 0.45s ease, height 0.45s ease, opacity 0.5s ease, background 0.1s, box-shadow 0.1s",
      }}
    >
      {btn.label}
      {/* Edit mode: visibility dot */}
      {editMode && (
        <span style={{
          position: "absolute", top: -4, right: -4,
          width: 14, height: 14, borderRadius: "50%",
          background: btn.visible ? "rgba(55,209,120,0.9)" : "rgba(255,80,80,0.9)",
          border: "1px solid rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 7, color: "#fff", fontWeight: 800,
        }}>
          {btn.visible ? "✓" : "✗"}
        </span>
      )}
    </div>
  );
}

// ── SliderRow ─────────────────────────────────────────────────────────────────

function SliderRow({
  label, value, min, max, onChange,
}: {
  label:    string;
  value:    number;
  min:      number;
  max:      number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", width: 60 }}>{label}</span>
      <input
        type="range"
        min={min} max={max}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: "#A29BFE", cursor: "pointer" }}
      />
      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", width: 28, textAlign: "right" }}>
        {value}
      </span>
    </div>
  );
}

// ── ToggleSwitch ──────────────────────────────────────────────────────────────

function ToggleSwitch({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!value)}
      style={{
        width: 38, height: 20, borderRadius: 10,
        background: value ? "rgba(108,92,231,0.8)" : "rgba(255,255,255,0.12)",
        border: `1px solid ${value ? "rgba(162,155,254,0.7)" : "rgba(255,255,255,0.15)"}`,
        position: "relative", cursor: "pointer",
        transition: "background 0.18s",
      }}
    >
      <div style={{
        position: "absolute",
        left: value ? "calc(100% - 18px)" : 2,
        top: 2, width: 14, height: 14, borderRadius: "50%",
        background: "#fff",
        transition: "left 0.18s",
        boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
      }} />
    </div>
  );
}

// ── ToolbarBtn ────────────────────────────────────────────────────────────────

function ToolbarBtn({
  label, icon, onClick, accent, danger,
}: {
  label:   string;
  icon:    string;
  onClick: () => void;
  accent?: boolean;
  danger?: boolean;
}) {
  const bg = accent
    ? "linear-gradient(135deg,rgba(108,92,231,0.7),rgba(162,155,254,0.7))"
    : danger
    ? "rgba(255,80,80,0.2)"
    : "rgba(255,255,255,0.08)";
  const bd = accent
    ? "rgba(162,155,254,0.6)"
    : danger
    ? "rgba(255,80,80,0.45)"
    : "rgba(255,255,255,0.12)";

  return (
    <button
      onClick={onClick}
      style={{
        background: bg, border: `1px solid ${bd}`,
        borderRadius: 12, padding: "8px 14px",
        color: "#fff", fontSize: 11, fontWeight: 700,
        cursor: "pointer",
        display: "flex", alignItems: "center", gap: 5,
      }}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
