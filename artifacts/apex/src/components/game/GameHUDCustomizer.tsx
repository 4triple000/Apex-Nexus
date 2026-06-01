/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  APEX ENGINE — Pre-Game HUD Customiser                  ║
 * ║                                                          ║
 * ║  Shown BEFORE any game canvas loads.                    ║
 * ║  Lets the player customise controls for THIS game only. ║
 * ║                                                          ║
 * ║  Features:                                               ║
 * ║    • Phone-shaped live preview                          ║
 * ║    • Drag buttons to reposition (touch + mouse)         ║
 * ║    • Toggle visibility per button                       ║
 * ║    • Resize per button (+/-)                            ║
 * ║    • Opacity slider                                     ║
 * ║    • Reset to schema defaults                           ║
 * ║    • Layout saved per-game to localStorage             ║
 * ╚══════════════════════════════════════════════════════════╝
 */
import { useState, useRef, useCallback, useEffect } from "react";
import type { GameInputSchema } from "@/engine3d/GameInputSchema";
import type { HUDLayout, HUDElement, ActionId } from "@/engine3d/HUDLayout";
import {
  generateLayoutFromSchema, cloneLayout,
  saveLayoutForGame, loadLayoutForGame,
} from "@/engine3d/HUDLayout";

// ── Design tokens ─────────────────────────────────────────────────────────────

const GRAD   = "linear-gradient(135deg,#6C5CE7,#A29BFE,#FD79A8)";
const GOLD   = "#ffcc33";
const BG     = "#07080E";
const BG2    = "#0F1115";
const BORDER = "rgba(255,255,255,0.08)";

// ── Props ─────────────────────────────────────────────────────────────────────

interface GameHUDCustomizerProps {
  schema:    GameInputSchema;
  gameMode:  string;
  onPlay:    () => void;
  onBack?:   () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GameHUDCustomizer({ schema, gameMode, onPlay, onBack }: GameHUDCustomizerProps) {
  const defaultLayout = generateLayoutFromSchema(schema);
  const [layout, setLayout] = useState<HUDLayout>(() =>
    loadLayoutForGame(gameMode, defaultLayout),
  );
  const [selected, setSelected] = useState<ActionId | null>(null);

  // Preview frame ref — for converting pointer events to % positions
  const frameRef = useRef<HTMLDivElement>(null);
  const dragging  = useRef<{ id: ActionId; ox: number; oy: number } | null>(null);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const updateButton = useCallback((id: ActionId, patch: Partial<HUDElement>) => {
    setLayout((prev) => ({
      ...prev,
      buttons: prev.buttons.map((b) => b.id === id ? { ...b, ...patch } : b),
    }));
  }, []);

  const selectedBtn = layout.buttons.find((b) => b.id === selected) ?? null;

  // ── Pointer drag inside the preview frame ─────────────────────────────────

  const getPct = (clientX: number, clientY: number): { x: number; y: number } => {
    const el = frameRef.current;
    if (!el) return { x: 50, y: 50 };
    const r = el.getBoundingClientRect();
    return {
      x: Math.min(98, Math.max(2, ((clientX - r.left) / r.width)  * 100)),
      y: Math.min(98, Math.max(2, ((clientY - r.top)  / r.height) * 100)),
    };
  };

  const onBtnPointerDown = (id: ActionId, e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setSelected(id);
    const btn = layout.buttons.find((b) => b.id === id);
    if (!btn) return;
    const { x, y } = getPct(e.clientX, e.clientY);
    dragging.current = { id, ox: x - btn.x, oy: y - btn.y };
  };

  const onFramePointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const { id, ox, oy } = dragging.current;
    const { x, y } = getPct(e.clientX, e.clientY);
    updateButton(id, { x: x - ox, y: y - oy });
  };

  const onFramePointerUp = () => { dragging.current = null; };

  // ── Reset / save ───────────────────────────────────────────────────────────

  const handleReset = () => setLayout(cloneLayout(defaultLayout));

  const handlePlay = () => {
    saveLayoutForGame(gameMode, layout);
    onPlay();
  };

  // ── Joystick base indicator (bottom-left of frame) ─────────────────────────
  const j = layout.joystick;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: BG,
      display: "flex", flexDirection: "column",
      fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif",
      color: "#fff",
      userSelect: "none", WebkitUserSelect: "none",
      overflow: "hidden",
    }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        padding: "14px 20px 12px",
        borderBottom: `1px solid ${BORDER}`,
        background: BG2,
        display: "flex", alignItems: "center", gap: 12, flexShrink: 0,
      }}>
        {onBack && (
          <button onClick={onBack} style={ghostBtn}>← Back</button>
        )}
        <span style={{ fontSize: 26 }}>{schema.icon}</span>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: 0.2 }}>
            Customize Controls
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>
            {schema.displayName}
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={handleReset} style={ghostBtn}>Reset</button>
          <button onClick={handlePlay} style={{
            ...ghostBtn,
            background: GRAD,
            border: "none",
            color: "#fff",
            fontWeight: 800,
            padding: "8px 22px",
            fontSize: 13,
          }}>▶ Play Now</button>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, display: "flex", overflow: "hidden",
        gap: 0,
      }}>

        {/* ── Left panel: button list ──────────────────────────────────────── */}
        <div style={{
          width: 200, flexShrink: 0,
          borderRight: `1px solid ${BORDER}`,
          background: BG2,
          overflowY: "auto",
          padding: "12px 0",
        }}>
          <div style={{ padding: "0 14px 8px", fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>
            Buttons
          </div>
          {layout.buttons.map((btn) => {
            const def = schema.actions.find((a) => a.id === btn.id);
            const isSel = selected === btn.id;
            return (
              <div
                key={btn.id}
                onClick={() => setSelected(btn.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 14px",
                  cursor: "pointer",
                  background: isSel ? "rgba(108,92,231,0.18)" : "transparent",
                  borderLeft: isSel ? `3px solid #A29BFE` : "3px solid transparent",
                  transition: "background 0.15s",
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: btn.color, border: `1.5px solid ${btn.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, opacity: btn.visible ? 1 : 0.35,
                }}>{btn.label}</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, opacity: btn.visible ? 1 : 0.4 }}>
                    {def?.description ?? btn.id}
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>
                    {def?.desktopKey ?? "?"}
                  </div>
                </div>
                <div style={{ marginLeft: "auto" }}>
                  <div
                    onClick={(e) => { e.stopPropagation(); updateButton(btn.id, { visible: !btn.visible }); }}
                    style={{
                      width: 28, height: 16, borderRadius: 8,
                      background: btn.visible ? "#6C5CE7" : "rgba(255,255,255,0.1)",
                      border: `1px solid ${btn.visible ? "#A29BFE" : BORDER}`,
                      cursor: "pointer", position: "relative", transition: "background 0.2s",
                    }}
                  >
                    <div style={{
                      position: "absolute", top: 2, borderRadius: "50%",
                      width: 12, height: 12, background: "#fff",
                      left: btn.visible ? 14 : 2, transition: "left 0.15s",
                    }} />
                  </div>
                </div>
              </div>
            );
          })}

          {/* ── Mobile-only: show joystick indicator ────────────────────── */}
          <div style={{
            margin: "12px 14px 0",
            padding: "10px 12px",
            borderRadius: 10,
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${BORDER}`,
            fontSize: 11, color: "rgba(255,255,255,0.45)",
          }}>
            <div style={{ fontWeight: 700, marginBottom: 4, color: "rgba(255,255,255,0.7)" }}>
              🕹 Left Joystick
            </div>
            Move (always visible on mobile)
          </div>

          {/* ── Desktop hint ─────────────────────────────────────────────── */}
          <div style={{
            margin: "10px 14px 0",
            padding: "10px 12px",
            borderRadius: 10,
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${BORDER}`,
            fontSize: 11, color: "rgba(255,255,255,0.45)",
          }}>
            <div style={{ fontWeight: 700, marginBottom: 6, color: "rgba(255,255,255,0.7)" }}>
              ⌨ Desktop Keys
            </div>
            {schema.desktopHints.map((h) => (
              <div key={h.keys} style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <kbd style={{ background: "rgba(255,255,255,0.08)", border: `1px solid ${BORDER}`, borderRadius: 4, padding: "1px 5px", fontSize: 9, fontFamily: "monospace" }}>{h.keys}</kbd>
                <span style={{ color: "#888" }}>{h.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Centre: phone preview ────────────────────────────────────────── */}
        <div style={{
          flex: 1,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.3)",
          padding: 20,
          overflow: "hidden",
        }}>
          {/* Phone bezel */}
          <div style={{
            position: "relative",
            width: "min(340px, 90vw)",
            aspectRatio: "9/18",
            background: "#080b10",
            borderRadius: 28,
            border: "3px solid rgba(255,255,255,0.12)",
            boxShadow: "0 0 60px rgba(108,92,231,0.25), inset 0 0 30px rgba(0,0,0,0.5)",
            overflow: "hidden",
            cursor: "crosshair",
          }}
            ref={frameRef}
            onPointerMove={onFramePointerMove}
            onPointerUp={onFramePointerUp}
            onPointerLeave={onFramePointerUp}
          >
            {/* Grid lines */}
            <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%", opacity:0.06, pointerEvents:"none" }}>
              {[10,20,30,40,50,60,70,80,90].map((p) => (
                <line key={`v${p}`} x1={`${p}%`} y1="0" x2={`${p}%`} y2="100%" stroke="#fff" strokeWidth="0.5" />
              ))}
              {[10,20,30,40,50,60,70,80,90].map((p) => (
                <line key={`h${p}`} x1="0" y1={`${p}%`} x2="100%" y2={`${p}%`} stroke="#fff" strokeWidth="0.5" />
              ))}
            </svg>

            {/* City/scene label at top */}
            <div style={{
              position: "absolute", top: 12, left: 0, right: 0,
              textAlign: "center", fontSize: 10, color: "rgba(255,255,255,0.2)",
              pointerEvents: "none",
            }}>
              GAME AREA  •  DRAG BUTTONS TO REPOSITION
            </div>

            {/* Joystick indicator */}
            <div style={{
              position: "absolute",
              left: `${j.x}%`, top: `${j.y}%`,
              transform: "translate(-50%,-50%)",
              width: j.size * 0.5, height: j.size * 0.5,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.04)",
              border: "1.5px solid rgba(255,255,255,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              pointerEvents: "none",
            }}>
              <div style={{
                width: "40%", height: "40%", borderRadius: "50%",
                background: GRAD, opacity: 0.6,
              }} />
            </div>

            {/* Action buttons — draggable */}
            {layout.buttons.map((btn) => {
              const isSel = selected === btn.id;
              const visible = btn.visible;
              return (
                <div
                  key={btn.id}
                  onPointerDown={(e) => onBtnPointerDown(btn.id, e)}
                  style={{
                    position: "absolute",
                    left: `${btn.x}%`, top: `${btn.y}%`,
                    transform: "translate(-50%,-50%)",
                    width: btn.size * 0.5, height: btn.size * 0.5,
                    borderRadius: "50%",
                    background: visible ? btn.color : "rgba(255,255,255,0.05)",
                    border: `${isSel ? 2.5 : 1.5}px solid ${visible ? btn.border : "rgba(255,255,255,0.15)"}`,
                    boxShadow: isSel ? `0 0 14px ${btn.border}` : "none",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: btn.size * 0.22,
                    cursor: "grab",
                    opacity: visible ? btn.opacity : 0.28,
                    transition: "box-shadow 0.15s",
                    zIndex: isSel ? 10 : 5,
                    touchAction: "none",
                    WebkitUserSelect: "none",
                  }}
                >
                  {visible ? btn.label : "✕"}
                  {isSel && (
                    <div style={{
                      position: "absolute", inset: -4, borderRadius: "50%",
                      border: `2px dashed ${GOLD}`,
                      animation: "spin 3s linear infinite",
                    }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Right panel: selected button controls ───────────────────────── */}
        <div style={{
          width: 200, flexShrink: 0,
          borderLeft: `1px solid ${BORDER}`,
          background: BG2,
          padding: "14px 14px",
          overflowY: "auto",
        }}>
          {selectedBtn ? (
            <>
              <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: selectedBtn.color, border: `2px solid ${selectedBtn.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 17,
                }}>{selectedBtn.label}</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>
                    {schema.actions.find((a) => a.id === selectedBtn.id)?.description ?? selectedBtn.id}
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>
                    Selected
                  </div>
                </div>
              </div>

              {/* Visible toggle */}
              <div style={row}>
                <span style={label}>Visible</span>
                <ToggleSwitch
                  on={selectedBtn.visible}
                  onChange={(v) => updateButton(selectedBtn.id, { visible: v })}
                />
              </div>

              {/* Size */}
              <div style={{ marginBottom: 14 }}>
                <div style={label}>Size</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                  <IncBtn label="−" onClick={() => updateButton(selectedBtn.id, { size: Math.max(30, selectedBtn.size - 6) })} />
                  <div style={{ flex: 1, textAlign: "center", fontSize: 12, color: "#aaa" }}>
                    {selectedBtn.size}px
                  </div>
                  <IncBtn label="+" onClick={() => updateButton(selectedBtn.id, { size: Math.min(120, selectedBtn.size + 6) })} />
                </div>
                <input
                  type="range" min={30} max={120} step={2}
                  value={selectedBtn.size}
                  onChange={(e) => updateButton(selectedBtn.id, { size: +e.target.value })}
                  style={sliderStyle}
                />
              </div>

              {/* Opacity */}
              <div style={{ marginBottom: 14 }}>
                <div style={label}>Opacity</div>
                <input
                  type="range" min={20} max={100} step={5}
                  value={Math.round(selectedBtn.opacity * 100)}
                  onChange={(e) => updateButton(selectedBtn.id, { opacity: +e.target.value / 100 })}
                  style={sliderStyle}
                />
                <div style={{ fontSize: 10, color: "#888", textAlign: "right", marginTop: 2 }}>
                  {Math.round(selectedBtn.opacity * 100)}%
                </div>
              </div>

              {/* Position readout */}
              <div style={{ marginBottom: 14 }}>
                <div style={label}>Position</div>
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  <div style={posBox}>X {Math.round(selectedBtn.x)}%</div>
                  <div style={posBox}>Y {Math.round(selectedBtn.y)}%</div>
                </div>
              </div>

              {/* Reset this button */}
              <button
                onClick={() => {
                  const def = schema.actions.find((a) => a.id === selectedBtn.id);
                  if (def) updateButton(selectedBtn.id, {
                    x: def.defaultX, y: def.defaultY, size: def.defaultSize,
                    opacity: def.opacity, visible: def.visible,
                  });
                }}
                style={{ ...ghostBtn, width: "100%", textAlign: "center" }}
              >
                Reset Button
              </button>
            </>
          ) : (
            <div style={{
              height: "100%", display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              textAlign: "center",
              color: "rgba(255,255,255,0.25)", fontSize: 12,
            }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>👈</div>
              Tap a button in the preview to edit it
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom bar ──────────────────────────────────────────────────────── */}
      <div style={{
        padding: "12px 20px",
        borderTop: `1px solid ${BORDER}`,
        background: BG2,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
          Drag buttons inside the preview to reposition them
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={handleReset} style={ghostBtn}>Reset All</button>
          <button onClick={handlePlay} style={{
            ...ghostBtn,
            background: GRAD, border: "none", color: "#fff",
            fontWeight: 800, fontSize: 14, padding: "10px 28px",
          }}>▶ Play Now</button>
        </div>
      </div>

      {/* ── CSS keyframes ───────────────────────────────────────────────────── */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ToggleSwitch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div onClick={() => onChange(!on)} style={{
      width: 36, height: 20, borderRadius: 10,
      background: on ? "#6C5CE7" : "rgba(255,255,255,0.1)",
      border: `1px solid ${on ? "#A29BFE" : BORDER}`,
      cursor: "pointer", position: "relative", transition: "background 0.2s",
    }}>
      <div style={{
        position: "absolute", top: 3, borderRadius: "50%",
        width: 14, height: 14, background: "#fff",
        left: on ? 19 : 3, transition: "left 0.15s",
      }} />
    </div>
  );
}

function IncBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      width: 28, height: 28, borderRadius: 8,
      background: "rgba(255,255,255,0.06)",
      border: `1px solid ${BORDER}`,
      color: "#fff", fontSize: 14, fontWeight: 800,
      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    }}>{label}</button>
  );
}

// ── Inline styles ─────────────────────────────────────────────────────────────

const ghostBtn: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: `1px solid ${BORDER}`,
  borderRadius: 10,
  color: "#ccc",
  fontSize: 12,
  fontWeight: 600,
  padding: "8px 14px",
  cursor: "pointer",
};

const row: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 14,
};

const label: React.CSSProperties = {
  fontSize: 11,
  color: "rgba(255,255,255,0.45)",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: 0.8,
};

const sliderStyle: React.CSSProperties = {
  width: "100%",
  accentColor: "#A29BFE",
  marginTop: 6,
};

const posBox: React.CSSProperties = {
  flex: 1,
  background: "rgba(255,255,255,0.04)",
  border: `1px solid ${BORDER}`,
  borderRadius: 6,
  textAlign: "center",
  padding: "5px 0",
  fontSize: 11,
  color: "#888",
};
