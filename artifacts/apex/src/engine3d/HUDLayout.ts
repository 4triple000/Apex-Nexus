/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  APEX ENGINE 3D — HUD Layout System v2                  ║
 * ║                                                          ║
 * ║  Changes from v1:                                        ║
 * ║    ✓ ButtonId → ActionId (superset across all games)    ║
 * ║    ✓ Per-game localStorage (apex:hud:<gameMode>)        ║
 * ║    ✓ generateLayoutFromSchema() auto-builds layouts      ║
 * ║    ✓ Legacy FPS presets kept for FPSMobileHUD compat    ║
 * ╚══════════════════════════════════════════════════════════╝
 */
import type { ActionDef, GameInputSchema } from "./GameInputSchema";

// ── Types ─────────────────────────────────────────────────────────────────────

export type { ActionId } from "./GameInputSchema";
import type { ActionId } from "./GameInputSchema";

/** Legacy alias — callers that used ButtonId continue to work. */
export type ButtonId = ActionId;

export interface HUDElement {
  id:       ActionId;
  label:    string;     // Emoji / short text on button face
  color:    string;     // rgba background fill
  border:   string;     // rgba border stroke
  /** X position as % of viewport width (0 = left, 100 = right) */
  x:        number;
  /** Y position as % of viewport height (0 = top, 100 = bottom) */
  y:        number;
  /** Diameter in logical pixels */
  size:     number;
  /** 0.1 – 1.0 */
  opacity:  number;
  visible:  boolean;
}

export interface JoystickConfig {
  x:       number;   // % from left (centre of base)
  y:       number;   // % from top  (centre of base)
  size:    number;   // Outer ring diameter px
  opacity: number;
}

export interface HUDLayout {
  id:       string;
  name:     string;
  joystick: JoystickConfig;
  buttons:  HUDElement[];
}

// ── Helper: ActionDef → HUDElement ───────────────────────────────────────────

function defToElement(a: ActionDef): HUDElement {
  return {
    id:      a.id,
    label:   a.label,
    color:   a.color,
    border:  a.border,
    x:       a.defaultX,
    y:       a.defaultY,
    size:    a.defaultSize,
    opacity: a.opacity,
    visible: a.visible,
  };
}

// ── Auto-generate a layout from a GameInputSchema ────────────────────────────

export function generateLayoutFromSchema(schema: GameInputSchema): HUDLayout {
  return {
    id:       `${schema.gameMode}-auto`,
    name:     `${schema.displayName} Default`,
    joystick: { x: 13, y: 80, size: 110, opacity: 0.85 },
    buttons:  schema.actions.map(defToElement),
  };
}

// ── Deep-clone ────────────────────────────────────────────────────────────────

export function cloneLayout(l: HUDLayout): HUDLayout {
  return JSON.parse(JSON.stringify(l));
}

// ── Per-game storage ──────────────────────────────────────────────────────────

function gameKey(gameMode: string) { return `apex:hud:${gameMode}`; }

export function saveLayoutForGame(gameMode: string, layout: HUDLayout): void {
  try { localStorage.setItem(gameKey(gameMode), JSON.stringify(layout)); } catch { /* ignore */ }
}

export function loadLayoutForGame(gameMode: string, fallback: HUDLayout): HUDLayout {
  try {
    const raw = localStorage.getItem(gameKey(gameMode));
    if (raw) {
      const parsed = JSON.parse(raw) as HUDLayout;
      // Merge-in any new buttons that appeared in the schema since last save
      for (const btn of fallback.buttons) {
        if (!parsed.buttons.find((b) => b.id === btn.id)) {
          parsed.buttons.push(btn);
        }
      }
      return parsed;
    }
  } catch { /* ignore */ }
  return cloneLayout(fallback);
}

// ── Legacy FPS-specific storage (kept for FPSMobileHUD backward compat) ───────

const LEGACY_KEY = "apex:fps-hud-layout";

export function saveLayout(layout: HUDLayout): void {
  try { localStorage.setItem(LEGACY_KEY, JSON.stringify(layout)); } catch { /* ignore */ }
  saveLayoutForGame("fps", layout);
}

export function loadLayout(): HUDLayout {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as HUDLayout;
      const base = cloneLayout(COD_CLASSIC);
      for (const btn of base.buttons) {
        if (!parsed.buttons.find((b) => b.id === btn.id)) {
          parsed.buttons.push(btn);
        }
      }
      return parsed;
    }
  } catch { /* ignore */ }
  return cloneLayout(getAutoPreset());
}

// ── Legacy FPS presets (unchanged) ───────────────────────────────────────────

export const COD_CLASSIC: HUDLayout = {
  id: "cod-classic", name: "COD Classic",
  joystick: { x: 13, y: 80, size: 110, opacity: 0.85 },
  buttons: [
    { id:"fire",   label:"🔫", color:"rgba(253,121,168,0.28)", border:"rgba(253,121,168,0.7)",  x:88, y:78, size:84, opacity:0.95, visible:true  },
    { id:"jump",   label:"⬆",  color:"rgba(108,92,231,0.28)",  border:"rgba(162,155,254,0.7)", x:88, y:62, size:58, opacity:0.90, visible:true  },
    { id:"scope",  label:"🔭", color:"rgba(0,206,201,0.28)",   border:"rgba(0,206,201,0.7)",   x:76, y:73, size:56, opacity:0.88, visible:true  },
    { id:"crouch", label:"⬇",  color:"rgba(255,204,51,0.28)",  border:"rgba(255,204,51,0.7)",  x:76, y:86, size:50, opacity:0.85, visible:true  },
    { id:"reload", label:"R",   color:"rgba(55,209,120,0.28)",  border:"rgba(55,209,120,0.7)",  x:65, y:79, size:48, opacity:0.85, visible:true  },
    { id:"sprint", label:"⚡",  color:"rgba(255,255,255,0.15)", border:"rgba(255,255,255,0.4)", x:30, y:80, size:44, opacity:0.75, visible:false },
  ],
};

const SIMPLE: HUDLayout = {
  id: "simple", name: "Simple",
  joystick: { x: 13, y: 80, size: 110, opacity: 0.80 },
  buttons: [
    { id:"fire",   label:"🔫", color:"rgba(253,121,168,0.28)", border:"rgba(253,121,168,0.7)",  x:88, y:80, size:88, opacity:0.95, visible:true  },
    { id:"jump",   label:"⬆",  color:"rgba(108,92,231,0.28)",  border:"rgba(162,155,254,0.7)", x:88, y:64, size:56, opacity:0.88, visible:true  },
    { id:"reload", label:"R",   color:"rgba(55,209,120,0.28)",  border:"rgba(55,209,120,0.7)",  x:76, y:80, size:50, opacity:0.85, visible:true  },
    { id:"scope",  label:"🔭", color:"rgba(0,206,201,0.28)",   border:"rgba(0,206,201,0.7)",   x:76, y:66, size:44, opacity:0.80, visible:false },
    { id:"crouch", label:"⬇",  color:"rgba(255,204,51,0.28)",  border:"rgba(255,204,51,0.7)",  x:76, y:90, size:44, opacity:0.80, visible:false },
    { id:"sprint", label:"⚡",  color:"rgba(255,255,255,0.15)", border:"rgba(255,255,255,0.4)", x:30, y:82, size:44, opacity:0.75, visible:false },
  ],
};

const PRO_CLAW: HUDLayout = {
  id: "pro-claw", name: "Pro Claw",
  joystick: { x: 11, y: 78, size: 100, opacity: 0.75 },
  buttons: [
    { id:"fire",   label:"🔫", color:"rgba(253,121,168,0.28)", border:"rgba(253,121,168,0.7)",  x:85, y:82, size:68, opacity:0.95, visible:true },
    { id:"jump",   label:"⬆",  color:"rgba(108,92,231,0.28)",  border:"rgba(162,155,254,0.7)", x:93, y:62, size:50, opacity:0.88, visible:true },
    { id:"scope",  label:"🔭", color:"rgba(0,206,201,0.28)",   border:"rgba(0,206,201,0.7)",   x:76, y:72, size:46, opacity:0.85, visible:true },
    { id:"crouch", label:"⬇",  color:"rgba(255,204,51,0.28)",  border:"rgba(255,204,51,0.7)",  x:76, y:86, size:44, opacity:0.82, visible:true },
    { id:"reload", label:"R",   color:"rgba(55,209,120,0.28)",  border:"rgba(55,209,120,0.7)",  x:66, y:79, size:42, opacity:0.82, visible:true },
    { id:"sprint", label:"⚡",  color:"rgba(255,255,255,0.15)", border:"rgba(255,255,255,0.4)", x:33, y:80, size:42, opacity:0.78, visible:true },
  ],
};

const MINIMAL: HUDLayout = {
  id: "minimal", name: "Minimal HUD",
  joystick: { x: 13, y: 82, size: 104, opacity: 0.65 },
  buttons: [
    { id:"fire",   label:"🔫", color:"rgba(253,121,168,0.20)", border:"rgba(253,121,168,0.55)", x:88, y:80, size:92, opacity:0.90, visible:true  },
    { id:"jump",   label:"⬆",  color:"rgba(108,92,231,0.20)",  border:"rgba(162,155,254,0.45)", x:88, y:63, size:52, opacity:0.75, visible:true  },
    { id:"scope",  label:"🔭", color:"rgba(0,206,201,0.20)",   border:"rgba(0,206,201,0.45)",   x:76, y:75, size:46, opacity:0.70, visible:false },
    { id:"crouch", label:"⬇",  color:"rgba(255,204,51,0.20)",  border:"rgba(255,204,51,0.45)",  x:76, y:88, size:44, opacity:0.70, visible:false },
    { id:"reload", label:"R",   color:"rgba(55,209,120,0.20)",  border:"rgba(55,209,120,0.45)",  x:76, y:88, size:44, opacity:0.70, visible:false },
    { id:"sprint", label:"⚡",  color:"rgba(255,255,255,0.10)", border:"rgba(255,255,255,0.30)", x:30, y:82, size:44, opacity:0.65, visible:false },
  ],
};

export const PRESETS: HUDLayout[] = [COD_CLASSIC, SIMPLE, PRO_CLAW, MINIMAL];

export function getAutoPreset(): HUDLayout {
  const w = typeof window !== "undefined" ? window.innerWidth : 390;
  return cloneLayout(w >= 768 ? PRO_CLAW : COD_CLASSIC);
}
