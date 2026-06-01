/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  APEX ENGINE — Game Input Schema System                  ║
 * ║                                                          ║
 * ║  Each game mode owns its input requirements.             ║
 * ║  The HUD auto-generates from the schema.                 ║
 * ║  Players customise per-game — no global lock-in.         ║
 * ║                                                          ║
 * ║  Flow:                                                   ║
 * ║    1. GameCanvas reads schema for current mode           ║
 * ║    2. GameHUDCustomizer shows pre-launch editor          ║
 * ║    3. Layout saved per-game to localStorage              ║
 * ║    4. InputOverlay renders saved layout with ACTION_MAP  ║
 * ╚══════════════════════════════════════════════════════════╝
 */
import type { InputManager } from "./InputManager";

// ── Action ID — superset of every button across all games ────────────────────

export type ActionId =
  | "fire"           // Shoot weapon
  | "jump"           // Jump
  | "sprint"         // Sprint / run fast
  | "interact"       // Interact / enter-vehicle prompt
  | "reload"         // Reload weapon
  | "crouch"         // Crouch / take cover
  | "scope"          // Aim-down-sights
  | "attack"         // Melee / basic punch (open world)
  | "enter_vehicle"  // Enter nearest vehicle
  | "exit_vehicle"   // Leave vehicle
  | "shoot_ball"     // Basketball shot
  | "pass"           // Basketball pass
  | "steal"          // Basketball steal
  | "dash";          // Quick dash / dodge

// ── Action definition ─────────────────────────────────────────────────────────

export interface ActionDef {
  id:          ActionId;
  label:       string;   // Emoji / short text on button face
  description: string;   // Human-readable for the customiser UI
  color:       string;   // rgba button background
  border:      string;   // rgba button border/glow
  defaultX:    number;   // % from left viewport edge  (0–100)
  defaultY:    number;   // % from top  viewport edge  (0–100)
  defaultSize: number;   // Diameter in px
  opacity:     number;   // 0.1 – 1.0
  visible:     boolean;
  desktopKey:  string;   // Keyboard hint for desktop UI
  gamepadBtn:  string;   // Gamepad button hint
}

// ── Mapping: ActionId → InputManager setter ───────────────────────────────────
// Each action resolves to whichever InputManager field is most semantically apt.

export const ACTION_TO_INPUT: Record<ActionId, (m: InputManager, held: boolean) => void> = {
  fire:          (m, h) => m.setShoot(h),
  jump:          (m, h) => m.setJump(h),
  sprint:        (m, h) => m.setSprint(h),
  interact:      (m, h) => m.setInteract(h),
  reload:        (m, h) => m.setReload(h),
  crouch:        (m, h) => m.setCrouch(h),
  scope:         (m, h) => m.setScope(h),
  attack:        (m, h) => m.setShoot(h),         // maps → shoot
  enter_vehicle: (m, h) => m.setInteract(h),      // maps → interact
  exit_vehicle:  (m, h) => m.setInteract(h),      // maps → interact
  shoot_ball:    (m, h) => m.setShoot(h),         // maps → shoot
  pass:          (m, h) => m.setInteract(h),      // maps → interact
  steal:         (m, h) => m.setCrouch(h),        // maps → crouch
  dash:          (m, h) => m.setSprint(h),        // maps → sprint
};

// ── Shared action templates ───────────────────────────────────────────────────

const A = (id: ActionId, label: string, description: string,
           color: string, border: string,
           x: number, y: number, size: number, opacity: number, visible: boolean,
           desktopKey: string, gamepadBtn: string): ActionDef =>
  ({ id, label, description, color, border, defaultX: x, defaultY: y,
     defaultSize: size, opacity, visible, desktopKey, gamepadBtn });

// Primary action buttons (large, right-side)
const FIRE    = A("fire",     "🔫","Fire / Shoot",       "rgba(253,121,168,0.28)","rgba(253,121,168,0.75)", 85,75,84,0.95,true,  "Click","RT");
const ATTACK  = A("attack",   "👊","Attack / Melee",     "rgba(253,121,168,0.28)","rgba(253,121,168,0.75)", 85,75,80,0.95,true,  "Click","RT");
const BBALL   = A("shoot_ball","🏀","Shoot Ball",         "rgba(255,140,0,0.30)",  "rgba(255,140,0,0.80)",  85,70,88,0.95,true,  "Click","A");

// Jump / vertical
const JUMP    = A("jump",     "⬆","Jump",               "rgba(108,92,231,0.28)","rgba(162,155,254,0.75)", 85,60,58,0.90,true,  "Space","A");

// Utility cluster (right side, secondary)
const SCOPE   = A("scope",    "🔭","Aim Down Sights",   "rgba(0,206,201,0.28)",  "rgba(0,206,201,0.75)",  74,72,56,0.88,true,  "Z",    "LB");
const CROUCH  = A("crouch",   "⬇","Crouch / Cover",    "rgba(255,204,51,0.28)", "rgba(255,204,51,0.75)", 74,87,50,0.85,true,  "C",    "B");
const RELOAD  = A("reload",   "R","Reload",             "rgba(55,209,120,0.28)", "rgba(55,209,120,0.75)", 65,78,48,0.85,true,  "R",    "Y");
const INTERACT= A("interact", "E","Interact",           "rgba(255,204,51,0.28)", "rgba(255,204,51,0.75)", 73,82,52,0.90,true,  "E",    "X");
const ENTER_V = A("enter_vehicle","🚗","Enter Vehicle",  "rgba(0,206,201,0.28)",  "rgba(0,206,201,0.75)", 65,72,52,0.88,true,  "E",    "X");
const EXIT_V  = A("exit_vehicle","🚪","Exit Vehicle",    "rgba(255,204,51,0.28)", "rgba(255,204,51,0.75)", 65,85,46,0.85,false, "E",    "X");
const PASS    = A("pass",     "➡️","Pass Ball",         "rgba(108,92,231,0.28)","rgba(162,155,254,0.75)", 74,80,56,0.90,true,  "F",    "X");
const STEAL   = A("steal",    "🫳","Steal Ball",        "rgba(55,209,120,0.28)", "rgba(55,209,120,0.75)", 74,64,50,0.85,true,  "C",    "B");
const DASH    = A("dash",     "💨","Dash / Dodge",      "rgba(0,206,201,0.28)",  "rgba(0,206,201,0.75)", 85,58,52,0.88,true,  "Shift","LB");

// Sprint (left-side double-tap style — lower-left)
const SPRINT  = A("sprint",   "⚡","Sprint",            "rgba(255,255,255,0.15)","rgba(255,255,255,0.40)", 30,80,44,0.75,false, "Shift","LS");

// ── GameInputSchema ───────────────────────────────────────────────────────────

export interface GameInputSchema {
  gameMode:     string;
  displayName:  string;
  icon:         string;     // Emoji icon for the pre-game screen header
  actions:      ActionDef[];
  hasJoystick:  boolean;    // Show left virtual joystick
  hasLookZone:  boolean;    // Right-side swipe = camera look (FPS/OW)
  desktopHints: { keys: string; desc: string }[];
  controllerHints: { btn: string; desc: string }[];
}

// ── Per-mode schemas ──────────────────────────────────────────────────────────

export const FPS_SCHEMA: GameInputSchema = {
  gameMode: "fps", displayName: "First-Person Shooter", icon: "🎯",
  hasJoystick: true, hasLookZone: true,
  actions: [FIRE, JUMP, SCOPE, CROUCH, RELOAD, SPRINT],
  desktopHints: [
    { keys:"WASD",  desc:"Move"   }, { keys:"Mouse",  desc:"Look"   },
    { keys:"Click", desc:"Shoot"  }, { keys:"Space",  desc:"Jump"   },
    { keys:"R",     desc:"Reload" }, { keys:"Z",      desc:"ADS"    },
    { keys:"C",     desc:"Crouch" }, { keys:"Shift",  desc:"Sprint" },
  ],
  controllerHints: [
    { btn:"LS",desc:"Move" },{ btn:"RS",desc:"Look" },{ btn:"RT",desc:"Shoot" },
    { btn:"A",desc:"Jump"  },{ btn:"Y",desc:"Reload"},{ btn:"LB",desc:"ADS"  },
  ],
};

export const OPENWORLD_SCHEMA: GameInputSchema = {
  gameMode: "openworld", displayName: "Open World / GTA", icon: "🌆",
  hasJoystick: true, hasLookZone: true,
  actions: [ATTACK, JUMP, SPRINT, INTERACT, ENTER_V, EXIT_V],
  desktopHints: [
    { keys:"WASD",       desc:"Move"    }, { keys:"Right drag", desc:"Camera"  },
    { keys:"Click",      desc:"Attack"  }, { keys:"Space",      desc:"Jump"    },
    { keys:"E",          desc:"Interact"}, { keys:"Shift",      desc:"Sprint"  },
  ],
  controllerHints: [
    { btn:"LS",desc:"Move"   },{ btn:"RS",desc:"Camera"  },{ btn:"RT",desc:"Attack" },
    { btn:"A",desc:"Jump"    },{ btn:"X",desc:"Interact" },
  ],
};

export const SHOOTER_SCHEMA: GameInputSchema = {
  gameMode: "shooter", displayName: "Top-Down Shooter", icon: "💥",
  hasJoystick: true, hasLookZone: false,
  actions: [FIRE, JUMP, SPRINT, INTERACT],
  desktopHints: [
    { keys:"WASD",  desc:"Move"    }, { keys:"Click", desc:"Shoot"   },
    { keys:"Space", desc:"Jump"    }, { keys:"E",     desc:"Interact"},
    { keys:"Shift", desc:"Sprint"  },
  ],
  controllerHints: [
    { btn:"LS",desc:"Move"  },{ btn:"RT",desc:"Shoot" },{ btn:"A",desc:"Jump" },
    { btn:"X",desc:"Interact"},
  ],
};

export const BASKETBALL_SCHEMA: GameInputSchema = {
  gameMode: "basketball", displayName: "Basketball", icon: "🏀",
  hasJoystick: true, hasLookZone: false,
  actions: [BBALL, PASS, STEAL, SPRINT, DASH],
  desktopHints: [
    { keys:"WASD",  desc:"Move"  }, { keys:"Click", desc:"Shoot" },
    { keys:"F",     desc:"Pass"  }, { keys:"C",     desc:"Steal"},
    { keys:"Shift", desc:"Dash"  },
  ],
  controllerHints: [
    { btn:"LS",desc:"Move" },{ btn:"A",desc:"Shoot"},{ btn:"X",desc:"Pass"},
    { btn:"B",desc:"Steal"},{ btn:"LB",desc:"Dash"},
  ],
};

export const PLATFORMER_SCHEMA: GameInputSchema = {
  gameMode: "platformer", displayName: "Platformer", icon: "🕹️",
  hasJoystick: true, hasLookZone: false,
  actions: [JUMP, DASH, SPRINT, INTERACT],
  desktopHints: [
    { keys:"WASD / ←→", desc:"Move"    }, { keys:"Space", desc:"Jump"    },
    { keys:"Shift",     desc:"Sprint"  }, { keys:"E",     desc:"Interact"},
  ],
  controllerHints: [
    { btn:"LS",desc:"Move"},{ btn:"A",desc:"Jump"},{ btn:"LB",desc:"Dash"},
    { btn:"X",desc:"Interact"},
  ],
};

// ── Schema lookup ─────────────────────────────────────────────────────────────

const _MAP: Record<string, GameInputSchema> = {
  fps:        FPS_SCHEMA,
  openworld:  OPENWORLD_SCHEMA,
  gta:        OPENWORLD_SCHEMA,
  shooter:    SHOOTER_SCHEMA,
  topdown:    SHOOTER_SCHEMA,
  basketball: BASKETBALL_SCHEMA,
  platformer: PLATFORMER_SCHEMA,
};

export function getSchemaForMode(gameMode: string): GameInputSchema {
  return _MAP[gameMode] ?? PLATFORMER_SCHEMA;
}
