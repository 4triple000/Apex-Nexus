/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  APEX ENGINE 3D — COD-Style Loadout System                  ║
 * ║                                                             ║
 * ║  Loadout = primaryWeapon + secondaryWeapon + perks (3)      ║
 * ║           + equipment (1)                                   ║
 * ║                                                             ║
 * ║  5 preset loadouts + 1 fully custom slot                    ║
 * ║  Perks: 6 types with real gameplay effects                  ║
 * ║  Equipment: 6 types  (grenade / armor / utility)            ║
 * ║  Persisted to localStorage                                  ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

// ── Weapon Classes ────────────────────────────────────────────────────────────
// These map to both FPS (weapons.ts) and GTA (GTAWeaponSystem.ts) systems.

export type LoadoutWeaponId = "pistol" | "rifle" | "shotgun" | "sniper";

export interface LoadoutWeaponDef {
  id:    LoadoutWeaponId;
  name:  string;
  emoji: string;
  desc:  string;
  /** Maps to GTA slot */
  gtaSlot: "pistol" | "smg" | "shotgun" | "rifle";
}

export const LOADOUT_WEAPONS: Record<LoadoutWeaponId, LoadoutWeaponDef> = {
  pistol:  { id: "pistol",  name: "Pistol",        emoji: "🔫", desc: "Reliable sidearm",       gtaSlot: "pistol"  },
  rifle:   { id: "rifle",   name: "Assault Rifle",  emoji: "⚡", desc: "Full-auto, high DPS",    gtaSlot: "rifle"   },
  shotgun: { id: "shotgun", name: "Shotgun",        emoji: "💥", desc: "Devastating at close range", gtaSlot: "shotgun" },
  sniper:  { id: "sniper",  name: "Sniper Rifle",   emoji: "🎯", desc: "One-shot precision",     gtaSlot: "rifle"   },
};

// ── Perks ─────────────────────────────────────────────────────────────────────

export type PerkId =
  | "hardened"
  | "lightweight"
  | "resilience"
  | "fast_hands"
  | "scavenger"
  | "awareness";

export interface Perk {
  id:          PerkId;
  name:        string;
  emoji:       string;
  desc:        string;
  damageMult?: number;   // multiplier on outgoing damage (default 1.0)
  speedMult?:  number;   // multiplier on move speed    (default 1.0)
  extraHealth?: number;  // added to max health
  reloadMult?: number;   // < 1 = faster reload         (default 1.0)
  ammoMult?:   number;   // multiplier on reserve ammo  (default 1.0)
  mapRadius?:  number;   // extra minimap reveal radius  (default 0)
}

export const PERKS: Record<PerkId, Perk> = {
  hardened:   { id: "hardened",   name: "Hardened",   emoji: "🔥", desc: "+20% weapon damage",   damageMult: 1.20 },
  lightweight:{ id: "lightweight",name: "Lightweight", emoji: "⚡", desc: "+25% move speed",      speedMult:  1.25 },
  resilience: { id: "resilience", name: "Resilience",  emoji: "🛡", desc: "+50 max health",       extraHealth: 50  },
  fast_hands: { id: "fast_hands", name: "Fast Hands",  emoji: "🔄", desc: "-30% reload time",     reloadMult:  0.70 },
  scavenger:  { id: "scavenger",  name: "Scavenger",   emoji: "💰", desc: "+60% ammo reserve",    ammoMult:    1.60 },
  awareness:  { id: "awareness",  name: "Awareness",   emoji: "👁",  desc: "+40m minimap radius",  mapRadius:   40   },
};

// ── Equipment ─────────────────────────────────────────────────────────────────

export type EquipmentId =
  | "frag"
  | "smoke"
  | "flashbang"
  | "armor"
  | "medkit"
  | "speed_boost";

export interface Equipment {
  id:    EquipmentId;
  name:  string;
  emoji: string;
  desc:  string;
}

export const EQUIPMENT: Record<EquipmentId, Equipment> = {
  frag:        { id: "frag",        name: "Frag Grenade",   emoji: "💣", desc: "Area damage on throw"      },
  smoke:       { id: "smoke",       name: "Smoke Grenade",  emoji: "💨", desc: "Conceals vision in area"   },
  flashbang:   { id: "flashbang",   name: "Flashbang",      emoji: "✨", desc: "Blinds nearby enemies"     },
  armor:       { id: "armor",       name: "Body Armor",     emoji: "🦺", desc: "+30 HP at match start"     },
  medkit:      { id: "medkit",      name: "Medkit",         emoji: "💊", desc: "Restores 40 HP on use"     },
  speed_boost: { id: "speed_boost", name: "Speed Boost",    emoji: "🏃", desc: "10s of boosted sprint"     },
};

// ── Loadout ───────────────────────────────────────────────────────────────────

export interface Loadout {
  id:        string;
  name:      string;
  emoji:     string;
  desc:      string;
  primary:   LoadoutWeaponId;
  secondary: LoadoutWeaponId;
  perks:     PerkId[];        // up to 3
  equipment: EquipmentId;
  /** Visual stat bars 0–100 for display */
  stats: { damage: number; speed: number; health: number; utility: number };
}

// ── Preset Loadouts ───────────────────────────────────────────────────────────

export const PRESET_LOADOUTS: Loadout[] = [
  {
    id: "assault", name: "Assault", emoji: "🔥",
    desc: "High damage rifle build. Front-line fighter.",
    primary: "rifle", secondary: "pistol",
    perks: ["hardened", "fast_hands", "scavenger"],
    equipment: "frag",
    stats: { damage: 90, speed: 55, health: 60, utility: 55 },
  },
  {
    id: "ghost", name: "Ghost", emoji: "👻",
    desc: "Mobility-focused stealth operative.",
    primary: "pistol", secondary: "pistol",
    perks: ["lightweight", "awareness", "scavenger"],
    equipment: "smoke",
    stats: { damage: 45, speed: 95, health: 55, utility: 75 },
  },
  {
    id: "tank", name: "Tank", emoji: "🛡",
    desc: "Maximum survivability, close-quarters enforcer.",
    primary: "shotgun", secondary: "rifle",
    perks: ["resilience", "hardened", "fast_hands"],
    equipment: "armor",
    stats: { damage: 75, speed: 40, health: 95, utility: 40 },
  },
  {
    id: "recon", name: "Recon", emoji: "🎯",
    desc: "Long-range sniper with enhanced map awareness.",
    primary: "sniper", secondary: "pistol",
    perks: ["hardened", "awareness", "lightweight"],
    equipment: "flashbang",
    stats: { damage: 85, speed: 65, health: 50, utility: 70 },
  },
  {
    id: "medic", name: "Medic", emoji: "💊",
    desc: "Sustained fighter with heal utility.",
    primary: "rifle", secondary: "pistol",
    perks: ["resilience", "fast_hands", "scavenger"],
    equipment: "medkit",
    stats: { damage: 65, speed: 60, health: 80, utility: 80 },
  },
];

// ── Custom Loadout ────────────────────────────────────────────────────────────

const CUSTOM_KEY = "apex:custom_loadout";

export const DEFAULT_CUSTOM_LOADOUT: Loadout = {
  id: "custom", name: "Custom", emoji: "⚙",
  desc: "Your personal build.",
  primary: "rifle", secondary: "pistol",
  perks: ["hardened", "fast_hands", "scavenger"],
  equipment: "frag",
  stats: { damage: 70, speed: 60, health: 60, utility: 60 },
};

export function loadCustomLoadout(): Loadout {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    if (raw) return { ...DEFAULT_CUSTOM_LOADOUT, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_CUSTOM_LOADOUT };
}

export function saveCustomLoadout(loadout: Loadout): void {
  try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(loadout)); } catch { /* ignore */ }
}

// ── Active Loadout Key ────────────────────────────────────────────────────────

const ACTIVE_KEY = "apex:active_loadout";

export function loadActiveLoadoutId(): string {
  return localStorage.getItem(ACTIVE_KEY) ?? "assault";
}

export function saveActiveLoadoutId(id: string): void {
  localStorage.setItem(ACTIVE_KEY, id);
}

// ── All Loadouts (presets + custom) ──────────────────────────────────────────

export function getAllLoadouts(): Loadout[] {
  return [...PRESET_LOADOUTS, loadCustomLoadout()];
}

export function getLoadoutById(id: string): Loadout {
  return getAllLoadouts().find((l) => l.id === id) ?? PRESET_LOADOUTS[0]!;
}

// ── Applied Effects ───────────────────────────────────────────────────────────

export interface LoadoutEffects {
  damageMult:  number;
  speedMult:   number;
  extraHealth: number;
  reloadMult:  number;
  ammoMult:    number;
  mapRadius:   number;
  /** Equipment one-shot bonus (e.g. +30 HP from armor) */
  startBonusHp: number;
}

export function getLoadoutEffects(loadout: Loadout | undefined): LoadoutEffects {
  if (!loadout) return { damageMult: 1.0, speedMult: 1.0, extraHealth: 0, reloadMult: 1.0, ammoMult: 1.0, mapRadius: 0, startBonusHp: 0 };
  const effects: LoadoutEffects = {
    damageMult: 1.0, speedMult: 1.0, extraHealth: 0,
    reloadMult: 1.0, ammoMult: 1.0, mapRadius: 0, startBonusHp: 0,
  };

  for (const perkId of loadout.perks) {
    const perk = PERKS[perkId];
    if (!perk) continue;
    if (perk.damageMult)  effects.damageMult  *= perk.damageMult;
    if (perk.speedMult)   effects.speedMult   *= perk.speedMult;
    if (perk.extraHealth) effects.extraHealth += perk.extraHealth;
    if (perk.reloadMult)  effects.reloadMult  *= perk.reloadMult;
    if (perk.ammoMult)    effects.ammoMult    *= perk.ammoMult;
    if (perk.mapRadius)   effects.mapRadius   += perk.mapRadius;
  }

  // Equipment bonuses
  if (loadout.equipment === "armor")  effects.startBonusHp += 30;
  if (loadout.equipment === "medkit") effects.extraHealth  += 20;

  return effects;
}

// ── Stat labels ───────────────────────────────────────────────────────────────

export const PERK_IDS: PerkId[] = [
  "hardened", "lightweight", "resilience", "fast_hands", "scavenger", "awareness",
];

export const EQUIPMENT_IDS: EquipmentId[] = [
  "frag", "smoke", "flashbang", "armor", "medkit", "speed_boost",
];
