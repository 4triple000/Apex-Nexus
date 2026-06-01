/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  APEX GAME ENGINE — Demo Games + AI Generator (v3)      ║
 * ╠══════════════════════════════════════════════════════════╣
 * ║  v3: shooter · basketball · topdown / open-world        ║
 * ║  Advanced game type detection from natural language      ║
 * ╚══════════════════════════════════════════════════════════╝
 */
import type { GameConfig, PlatformConfig, EnemyConfig, CoinConfig } from './types';
import { buildDefaultWorldConfig, type WorldConfig, type EnemyBehavior } from "@/engine3d/WorldLoader";

// ══════════════════════════════════════════════════════════════════════════════
// ── DEMO GAMES ────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

export const DEMO_GAMES: GameConfig[] = [
  // ── 1. Neon Platformer ────────────────────────────────────────────────────
  {
    name:         "Neon Platformer",
    gravity:      0.55,
    winCondition: "collect_all",
    background:   "#07080E",
    width:        400,
    height:       600,
    player: { x: 40, y: 480, width: 32, height: 32, color: "blue", jumpForce: 12, speed: 4.5 },
    platforms: [
      { x: 0,   y: 560, width: 400, height: 16, color: "#2d3561" },
      { x: 60,  y: 480, width: 90,  height: 12, color: "#3d2561" },
      { x: 200, y: 400, width: 80,  height: 12, color: "#252d61" },
      { x: 80,  y: 330, width: 100, height: 12, color: "#3d2561" },
      { x: 240, y: 260, width: 100, height: 12, color: "#252d61" },
      { x: 100, y: 190, width: 80,  height: 12, color: "#3d2561" },
      { x: 250, y: 130, width: 120, height: 12, color: "#252d61" },
    ],
    enemies: [
      { x: 80,  y: 460, width: 28, height: 28, color: "red",    speed: 1.2, patrol: { minX: 60,  maxX: 150 } },
      { x: 200, y: 380, width: 28, height: 28, color: "orange", speed: 1.5, patrol: { minX: 200, maxX: 280 } },
      { x: 100, y: 300, width: 28, height: 28, color: "red",    speed: 2.0, patrol: { minX: 80,  maxX: 180 } },
    ],
    coins: [
      { x: 110, y: 455, radius: 8, color: "gold", value: 10 },
      { x: 140, y: 455, radius: 8, color: "gold", value: 10 },
      { x: 220, y: 375, radius: 8, color: "gold", value: 10 },
      { x: 250, y: 375, radius: 8, color: "gold", value: 10 },
      { x: 120, y: 305, radius: 8, color: "gold", value: 10 },
      { x: 160, y: 305, radius: 8, color: "gold", value: 10 },
      { x: 280, y: 235, radius: 8, color: "gold", value: 10 },
      { x: 320, y: 235, radius: 8, color: "gold", value: 10 },
      { x: 290, y: 105, radius: 10, color: "#ffcc33", value: 50 },
    ],
  },

  // ── 2. Sky Jumper ────────────────────────────────────────────────────────
  {
    name:         "Sky Jumper",
    gravity:      0.4,
    winCondition: "reach_end",
    background:   "#0a1628",
    width:        400,
    height:       600,
    player: { x: 30, y: 520, width: 30, height: 30, color: "cyan", jumpForce: 13, speed: 4 },
    platforms: [
      { x: 0,   y: 570, width: 120, height: 16, color: "#1a3a5c" },
      { x: 150, y: 520, width: 80,  height: 12, color: "#1a3a5c" },
      { x: 100, y: 450, width: 70,  height: 12, color: "#1a3a5c" },
      { x: 220, y: 390, width: 90,  height: 12, color: "#1a3a5c" },
      { x: 60,  y: 330, width: 80,  height: 12, color: "#1a3a5c" },
      { x: 200, y: 270, width: 80,  height: 12, color: "#1a3a5c" },
      { x: 80,  y: 210, width: 90,  height: 12, color: "#1a3a5c" },
      { x: 240, y: 150, width: 80,  height: 12, color: "#1a3a5c" },
      { x: 290, y: 80,  width: 110, height: 16, color: "#2a5a8c" },
    ],
    enemies: [
      { x: 155, y: 500, width: 26, height: 26, color: "purple", speed: 1.8, patrol: { minX: 150, maxX: 230 } },
      { x: 225, y: 370, width: 26, height: 26, color: "purple", speed: 2.2, patrol: { minX: 220, maxX: 310 } },
    ],
    coins: [
      { x: 175, y: 495, radius: 7, color: "gold", value: 10 },
      { x: 130, y: 425, radius: 7, color: "gold", value: 10 },
      { x: 260, y: 365, radius: 7, color: "gold", value: 10 },
      { x: 100, y: 305, radius: 7, color: "gold", value: 10 },
      { x: 250, y: 245, radius: 7, color: "gold", value: 10 },
      { x: 350, y: 55,  radius: 12, color: "#ffcc33", value: 50 },
    ],
    endX: 370,
  },

  // ── 3. Dodge Blitz ───────────────────────────────────────────────────────
  {
    name:         "Dodge Blitz",
    gravity:      0,
    winCondition: "survive",
    surviveSecs:  30,
    background:   "#0d0a1e",
    width:        400,
    height:       600,
    player: { x: 184, y: 500, width: 32, height: 32, color: "green", jumpForce: 0, speed: 5.5 },
    platforms: [
      { x: 0, y: 580, width: 400, height: 20, color: "#1a1a2e" },
    ],
    enemies: [
      { x: 50,  y: -40,  width: 30, height: 30, color: "red",    speed: 3,   patrol: { minX: 50,  maxX: 50  } },
      { x: 150, y: -80,  width: 30, height: 30, color: "orange", speed: 3.5, patrol: { minX: 150, maxX: 150 } },
      { x: 250, y: -120, width: 30, height: 30, color: "red",    speed: 4,   patrol: { minX: 250, maxX: 250 } },
      { x: 330, y: -60,  width: 30, height: 30, color: "orange", speed: 3.2, patrol: { minX: 330, maxX: 330 } },
    ],
    coins: [],
  },

  // ── 4. Neon Ops (Shooter demo) ───────────────────────────────────────────
  {
    name:         "Neon Ops",
    gameMode:     "shooter",
    gravity:      0,
    winCondition: "defeat_all",
    background:   "#080c14",
    width:        400,
    height:       600,
    health:       100,
    shootCooldown: 320,
    player: { x: 184, y: 290, width: 28, height: 28, color: "#00cfff", jumpForce: 0, speed: 4 },
    platforms: [
      { x: 0,   y: 0,   width: 400, height: 16,  color: "#1a2a3a" },
      { x: 0,   y: 584, width: 400, height: 16,  color: "#1a2a3a" },
      { x: 0,   y: 0,   width: 16,  height: 600, color: "#1a2a3a" },
      { x: 384, y: 0,   width: 16,  height: 600, color: "#1a2a3a" },
      { x: 60,  y: 80,  width: 80,  height: 14,  color: "#243040" },
      { x: 260, y: 80,  width: 80,  height: 14,  color: "#243040" },
      { x: 60,  y: 500, width: 80,  height: 14,  color: "#243040" },
      { x: 260, y: 500, width: 80,  height: 14,  color: "#243040" },
      { x: 160, y: 240, width: 80,  height: 14,  color: "#243040" },
    ],
    enemies: [
      { x: 40,  y: 40,  width: 28, height: 28, color: "red",    speed: 1.6, hp: 1 },
      { x: 300, y: 40,  width: 28, height: 28, color: "red",    speed: 1.8, hp: 1 },
      { x: 40,  y: 520, width: 28, height: 28, color: "orange", speed: 2.0, hp: 1 },
      { x: 300, y: 520, width: 28, height: 28, color: "orange", speed: 2.2, hp: 1 },
      { x: 180, y: 160, width: 32, height: 32, color: "#ff00aa", speed: 1.4, hp: 2 },
    ],
    coins: [
      { x: 100, y: 280, radius: 8, color: "#00cfff", value: 50 },
      { x: 290, y: 280, radius: 8, color: "#00cfff", value: 50 },
      { x: 195, y: 400, radius: 8, color: "gold",    value: 100 },
    ],
  },

  // ── 5. Street Hoops (Basketball demo) ────────────────────────────────────
  {
    name:         "Street Hoops",
    gameMode:     "basketball",
    gravity:      0.55,
    winCondition: "score_limit",
    scoreLimit:   10,
    surviveSecs:  60,
    background:   "#0a0a0a",
    width:        400,
    height:       600,
    player: { x: 50, y: 480, width: 28, height: 36, color: "#ff8c00", jumpForce: 13, speed: 4.5 },
    basket: { x: 295, y: 240, width: 60 },
    platforms: [
      { x: 0,   y: 560, width: 400, height: 16, color: "#2a1a00" },
      { x: 0,   y: 0,   width: 8,   height: 600, color: "#1a1a1a" },
      { x: 392, y: 0,   width: 8,   height: 600, color: "#1a1a1a" },
      { x: 80,  y: 460, width: 80,  height: 10,  color: "#2a1a00" },
      { x: 230, y: 400, width: 80,  height: 10,  color: "#2a1a00" },
      { x: 80,  y: 340, width: 80,  height: 10,  color: "#2a1a00" },
    ],
    enemies: [],
    coins: [],
  },

  // ── 6. Neon Warzone (3D FPS demo) ────────────────────────────────────────
  {
    name:         "Neon Warzone",
    gameMode:     "fps",
    gravity:      0,
    winCondition: "defeat_all",
    background:   "#070a14",
    width:        400,
    height:       600,
    health:       100,
    player: { x: 0, y: 1.7, width: 1, height: 2, color: "#00cfff", jumpForce: 8, speed: 7 },
    platforms: [],
    enemies: Array.from({ length: 8 }, () => ({
      x: 0, y: 0, width: 0.7, height: 1.6, color: "#e74c3c", hp: 3,
    })),
    coins: [],
  },

  // ── 7. Neon City (3D Open World sandbox) ─────────────────────────────────
  {
    name:         "Neon City",
    gameMode:     "openworld",
    gravity:      0,
    winCondition: "collect_all",
    background:   "#07080e",
    width:        400,
    height:       600,
    health:       100,
    player: { x: 8, y: 0, width: 0.65, height: 1.8, color: "#3d5afe", jumpForce: 9, speed: 7 },
    platforms: [],
    enemies: [],
    coins: [],
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// ── GAME TYPE DETECTION ───────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

type DetectedGameType = "fps" | "openworld" | "shooter" | "basketball" | "topdown" | "platformer";

function detectGameType(prompt: string): DetectedGameType {
  const lp = prompt.toLowerCase();

  // 3D FPS keywords (checked FIRST — supersedes 2D shooter)
  const fpsKw = [
    "fps", "first person", "first-person", "3d shooter", "3d fps",
    "doom", "quake", "halo", "call of duty", "cod", "counterstrike",
    "cs:go", "csgo", "cs go", "battlefield", "valorant", "overwatch",
    "3d game", "3d world", "first person shooter", "fps game",
    "three.js", "webgl", "3d engine",
  ];
  if (fpsKw.some((kw) => lp.includes(kw))) return "fps";

  // 2D top-down shooter keywords
  const shooterKw = [
    "shooter", "shooting", "top-down shooter", "top down shooter",
    "arena shooter", "gun", "guns", "bullet", "bullets",
    "warfare", "combat", "military", "sniper", "pistol", "rifle",
    "weapon", "weapons", "ammo", "enemy soldiers", "kill enemies",
  ];
  if (shooterKw.some((kw) => lp.includes(kw))) return "shooter";

  // Basketball keywords
  const basketKw = [
    "basketball", "nba", "hoops", "hoop", "basket", "2k", "dunk",
    "three pointer", "layup", "court", "shoot the ball", "ball into",
  ];
  if (basketKw.some((kw) => lp.includes(kw))) return "basketball";

  // Open world / GTA-style keywords (3D sandbox)
  const owKw = [
    "open world", "openworld", "gta", "grand theft", "sandbox", "free roam",
    "free-roam", "city", "explore", "exploration", "driving", "drive around",
    "npc", "npcs", "pedestrian", "vehicle", "vehicles", "car", "cars",
    "missions", "quest", "collect items", "3d city", "city world",
  ];
  if (owKw.some((kw) => lp.includes(kw))) return "openworld";

  // 2D top-down keywords
  const topdownKw = [
    "top down", "top-down", "overhead", "rpg", "adventure", "map",
  ];
  if (topdownKw.some((kw) => lp.includes(kw))) return "topdown";

  return "platformer";
}

// ══════════════════════════════════════════════════════════════════════════════
// ── PLATFORMER GENERATOR (v2 — existing) ──────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

const ADJECTIVES = [
  "Neon", "Dark", "Cyber", "Inferno", "Shadow", "Quantum", "Hyper",
  "Phantom", "Turbo", "Void", "Blaze", "Thunder", "Crystal", "Frost",
  "Solar", "Lunar", "Atomic", "Stealth", "Ultra", "Nova",
];
const NOUNS = [
  "Run", "Dash", "Blitz", "Rush", "Surge", "Strike", "Quest",
  "Chase", "Jump", "Drop", "Climb", "Drift", "Escape", "Arena",
  "Trial", "Gauntlet", "Zone", "Leap", "Frenzy", "Storm",
];

function uniqueName(seed: string): string {
  const h = Array.from(seed).reduce((a, c) => a ^ c.charCodeAt(0), 0);
  const adj  = ADJECTIVES[Math.abs(h)            % ADJECTIVES.length]!;
  const noun = NOUNS    [Math.abs(h * 31 + 7)   % NOUNS.length]!;
  return `${adj} ${noun}`;
}

interface ParsedStyle {
  gravity:     number;
  playerColor: string;
  bgColor:     string;
  platColor:   string;
  enemyColor:  string;
  enemySpeed:  number;
  playerSpeed: number;
  jumpForce:   number;
  winType:     GameConfig["winCondition"];
  surviveSecs: number;
  density:     "sparse" | "normal" | "dense";
  twist:       "wide" | "tall" | "survive_wave" | "coin_hunt" | "boss_rush" | "default";
}

function parsePrompt(p: string): ParsedStyle {
  const lp = p.toLowerCase();

  let gravity = 0.5;
  if (lp.includes("heavy") || lp.includes("weight") || lp.includes("lead")) gravity = 0.85;
  else if (lp.includes("float") || lp.includes("feather") || lp.includes("light")) gravity = 0.22;
  else if (lp.includes("moon") || lp.includes("zero") || lp.includes("space")) gravity = 0.15;

  let playerColor = "blue", bgColor = "#07080E", platColor = "#2d3561", enemyColor = "red";

  if (lp.includes("neon") || lp.includes("cyber")) {
    playerColor = "#00ffcc"; bgColor = "#03001a"; platColor = "#1a0033"; enemyColor = "#ff00ff";
  } else if (lp.includes("fire") || lp.includes("inferno") || lp.includes("lava")) {
    playerColor = "#ff6600"; bgColor = "#1a0500"; platColor = "#3a1000"; enemyColor = "#ff2200";
  } else if (lp.includes("ice") || lp.includes("frost") || lp.includes("snow") || lp.includes("crystal")) {
    playerColor = "#aaeeff"; bgColor = "#020e1a"; platColor = "#0a2a3a"; enemyColor = "#00aaff";
  } else if (lp.includes("shadow") || lp.includes("dark") || lp.includes("void")) {
    playerColor = "#9977ff"; bgColor = "#000005"; platColor = "#0d0d1a"; enemyColor = "#7700ff";
  } else if (lp.includes("gold") || lp.includes("sun") || lp.includes("solar")) {
    playerColor = "#ffcc00"; bgColor = "#100d00"; platColor = "#2a2000"; enemyColor = "#ff8800";
  } else if (lp.includes("green") || lp.includes("nature") || lp.includes("jungle")) {
    playerColor = "#00ff88"; bgColor = "#001a08"; platColor = "#002a10"; enemyColor = "#00aa44";
  } else if (lp.includes("red") || lp.includes("blood") || lp.includes("danger")) {
    playerColor = "#ff3344"; bgColor = "#0d0000"; platColor = "#200005"; enemyColor = "#ff0000";
  } else if (lp.includes("purple") || lp.includes("violet") || lp.includes("magic")) {
    playerColor = "#cc44ff"; bgColor = "#070010"; platColor = "#1a0030"; enemyColor = "#8800ff";
  }

  let playerSpeed = 4.5, jumpForce = 12;
  if (lp.includes("fast") || lp.includes("speed") || lp.includes("turbo") || lp.includes("hyper")) {
    playerSpeed = 7; jumpForce = 13;
  } else if (lp.includes("slow") || lp.includes("careful") || lp.includes("stealth")) {
    playerSpeed = 2.8; jumpForce = 10.5;
  }

  let enemySpeed = 1.4;
  if (lp.includes("hard") || lp.includes("difficult") || lp.includes("extreme")) enemySpeed = 2.8;
  else if (lp.includes("easy") || lp.includes("beginner") || lp.includes("relax"))  enemySpeed = 0.8;
  else if (lp.includes("fast"))                                                       enemySpeed = 2.2;

  let winType: GameConfig["winCondition"] = "collect_all";
  let surviveSecs = 30;

  if (lp.includes("survive") || lp.includes("endure") || lp.includes("dodge") || lp.includes("avoid")) {
    winType     = "survive";
    surviveSecs = lp.includes("60") ? 60 : lp.includes("45") ? 45 : lp.includes("20") ? 20 : 30;
  } else if (lp.includes("reach") || lp.includes("race") || lp.includes("goal") || lp.includes("flag") || lp.includes("end")) {
    winType = "reach_end";
  } else if (lp.includes("boss") || lp.includes("kill") || lp.includes("stomp") || lp.includes("defeat")) {
    winType = "defeat_all";
  }

  let density: ParsedStyle["density"] = "normal";
  if (lp.includes("many") || lp.includes("lots") || lp.includes("swarm") || lp.includes("wave")) density = "dense";
  if (lp.includes("few") || lp.includes("minimal") || lp.includes("empty"))                      density = "sparse";

  let twist: ParsedStyle["twist"] = "default";
  if (lp.includes("wide") || lp.includes("horizontal") || lp.includes("scroll"))            twist = "wide";
  else if (lp.includes("tower") || lp.includes("tall") || lp.includes("climb") || lp.includes("vertical")) twist = "tall";
  else if (lp.includes("wave") || lp.includes("swarm") || lp.includes("horde"))             twist = "survive_wave";
  else if (lp.includes("coin") || lp.includes("treasure") || lp.includes("collect"))        twist = "coin_hunt";
  else if (lp.includes("boss") || lp.includes("big") || lp.includes("giant"))               twist = "boss_rush";
  else if (winType === "survive")                                                             twist = "survive_wave";

  return { gravity, playerColor, bgColor, platColor, enemyColor, enemySpeed, playerSpeed, jumpForce, winType, surviveSecs, density, twist };
}

// ── Platformer level builders ─────────────────────────────────────────────────

function buildSurviveLevel(s: ParsedStyle, name: string): GameConfig {
  const enemyCount = s.density === "dense" ? 8 : s.density === "sparse" ? 3 : 5;
  const enemies: EnemyConfig[] = Array.from({ length: enemyCount }, (_, i) => ({
    x:      50 + Math.floor(i * (300 / enemyCount)),
    y:      -30 - i * 50,
    width:  26 + (i % 3) * 4,
    height: 26 + (i % 3) * 4,
    color:  s.enemyColor,
    speed:  s.enemySpeed + i * 0.2,
    patrol: { minX: 50 + Math.floor(i * (300 / enemyCount)), maxX: 50 + Math.floor(i * (300 / enemyCount)) },
  }));

  return {
    name, gravity: 0, winCondition: "survive",
    surviveSecs: s.surviveSecs,
    background: s.bgColor, width: 400, height: 600,
    player:    { x: 184, y: 500, width: 32, height: 32, color: s.playerColor, jumpForce: 0, speed: s.playerSpeed },
    platforms: [{ x: 0, y: 580, width: 400, height: 20, color: s.platColor }],
    enemies,
    coins: [],
  };
}

function buildPlatformerLevel(s: ParsedStyle, name: string): GameConfig {
  const tiers = [
    { y: 550, minX: 0,   maxX: 160,  platW: 160 },
    { y: 480, minX: 160, maxX: 320,  platW: 120 },
    { y: 410, minX: 60,  maxX: 200,  platW: 100 },
    { y: 340, minX: 200, maxX: 340,  platW: 100 },
    { y: 270, minX: 80,  maxX: 220,  platW: 90  },
    { y: 200, minX: 220, maxX: 360,  platW: 90  },
    { y: 130, minX: 100, maxX: 280,  platW: 80  },
  ];

  const platforms: PlatformConfig[] = tiers.map((t) => ({
    x: t.minX, y: t.y, width: t.platW, height: 12, color: s.platColor,
  }));
  platforms.push({ x: 0, y: 590, width: 400, height: 10, color: s.platColor });

  const enemyCount = s.density === "dense" ? 5 : s.density === "sparse" ? 2 : 3;
  const enemyTiers = tiers.slice(0, enemyCount);
  const enemies: EnemyConfig[] = enemyTiers.map((t, i) => ({
    x:      t.minX + 10,
    y:      t.y - 28,
    width:  24 + i * 2,
    height: 24 + i * 2,
    color:  s.enemyColor,
    speed:  s.enemySpeed + i * 0.3,
    patrol: { minX: t.minX + 5, maxX: t.minX + t.platW - 15 },
  }));

  const coins: CoinConfig[] = [];
  tiers.forEach((t, i) => {
    coins.push({ x: t.minX + 30,           y: t.y - 18, radius: 7, color: "gold",    value: 10 });
    coins.push({ x: t.minX + t.platW - 30, y: t.y - 18, radius: 7, color: "gold",    value: 10 });
    if (i === tiers.length - 1) {
      coins.push({ x: t.minX + t.platW / 2, y: t.y - 22, radius: 11, color: "#ffcc33", value: 50 });
    }
  });

  return {
    name, gravity: s.gravity, winCondition: s.winType,
    background: s.bgColor, width: 400, height: 600,
    player:    { x: 30, y: 555, width: 30, height: 30, color: s.playerColor, jumpForce: s.jumpForce, speed: s.playerSpeed },
    platforms, enemies, coins,
    endX:        s.winType === "reach_end" ? 380 : undefined,
    surviveSecs: s.winType === "survive"   ? s.surviveSecs : undefined,
  };
}

function buildCoinHunt(s: ParsedStyle, name: string): GameConfig {
  const platData: PlatformConfig[] = [
    { x: 0,   y: 590, width: 400, height: 10, color: s.platColor },
    { x: 20,  y: 520, width: 80,  height: 10, color: s.platColor },
    { x: 150, y: 490, width: 70,  height: 10, color: s.platColor },
    { x: 290, y: 510, width: 90,  height: 10, color: s.platColor },
    { x: 60,  y: 430, width: 60,  height: 10, color: s.platColor },
    { x: 190, y: 410, width: 80,  height: 10, color: s.platColor },
    { x: 310, y: 440, width: 70,  height: 10, color: s.platColor },
    { x: 30,  y: 350, width: 90,  height: 10, color: s.platColor },
    { x: 180, y: 330, width: 60,  height: 10, color: s.platColor },
    { x: 290, y: 350, width: 80,  height: 10, color: s.platColor },
    { x: 80,  y: 260, width: 70,  height: 10, color: s.platColor },
    { x: 210, y: 250, width: 80,  height: 10, color: s.platColor },
    { x: 50,  y: 180, width: 60,  height: 10, color: s.platColor },
    { x: 200, y: 160, width: 120, height: 10, color: s.platColor },
    { x: 110, y: 90,  width: 90,  height: 10, color: s.platColor },
  ];

  const coins: CoinConfig[] = platData.slice(1).map((pl) => ({
    x: pl.x + pl.width / 2, y: pl.y - 16, radius: 8, color: "gold", value: 15,
  }));
  coins[coins.length - 1] = { ...coins[coins.length - 1]!, radius: 12, color: "#ffcc33", value: 75 };

  const enemies: EnemyConfig[] = s.density === "sparse" ? [] : [
    { x: 25,  y: 502, width: 24, height: 24, color: s.enemyColor, speed: s.enemySpeed,       patrol: { minX: 20,  maxX: 90 } },
    { x: 190, y: 392, width: 24, height: 24, color: s.enemyColor, speed: s.enemySpeed + 0.4, patrol: { minX: 185, maxX: 255 } },
    { x: 80,  y: 242, width: 24, height: 24, color: s.enemyColor, speed: s.enemySpeed + 0.8, patrol: { minX: 75,  maxX: 140 } },
  ];

  return {
    name, gravity: s.gravity, winCondition: "collect_all",
    background: s.bgColor, width: 400, height: 600,
    player:    { x: 30, y: 560, width: 28, height: 28, color: s.playerColor, jumpForce: s.jumpForce, speed: s.playerSpeed },
    platforms: platData, enemies, coins,
  };
}

function buildBossRush(s: ParsedStyle, name: string): GameConfig {
  const platforms: PlatformConfig[] = [
    { x: 0,   y: 580, width: 400, height: 20, color: s.platColor },
    { x: 80,  y: 460, width: 100, height: 12, color: s.platColor },
    { x: 220, y: 460, width: 100, height: 12, color: s.platColor },
    { x: 150, y: 360, width: 100, height: 12, color: s.platColor },
    { x: 50,  y: 280, width: 80,  height: 12, color: s.platColor },
    { x: 270, y: 280, width: 80,  height: 12, color: s.platColor },
  ];

  const enemies: EnemyConfig[] = [
    { x: 170, y: 340, width: 56, height: 56, color: s.enemyColor, speed: s.enemySpeed * 0.6, patrol: { minX: 150, maxX: 230 } },
    { x: 90,  y: 440, width: 28, height: 28, color: "orange",     speed: s.enemySpeed + 0.3, patrol: { minX: 80,  maxX: 175 } },
    { x: 230, y: 440, width: 28, height: 28, color: "orange",     speed: s.enemySpeed + 0.5, patrol: { minX: 220, maxX: 315 } },
    { x: 60,  y: 255, width: 22, height: 22, color: "yellow",     speed: s.enemySpeed + 0.8, patrol: { minX: 50,  maxX: 125 } },
    { x: 275, y: 255, width: 22, height: 22, color: "yellow",     speed: s.enemySpeed + 1.0, patrol: { minX: 270, maxX: 345 } },
  ];

  const coins: CoinConfig[] = [
    { x: 130, y: 435, radius: 7, color: "gold",    value: 10 },
    { x: 155, y: 435, radius: 7, color: "gold",    value: 10 },
    { x: 250, y: 435, radius: 7, color: "gold",    value: 10 },
    { x: 185, y: 335, radius: 7, color: "gold",    value: 20 },
    { x: 215, y: 335, radius: 7, color: "gold",    value: 20 },
    { x: 75,  y: 255, radius: 9, color: "#ffcc33", value: 30 },
    { x: 285, y: 255, radius: 9, color: "#ffcc33", value: 30 },
  ];

  return {
    name, gravity: s.gravity, winCondition: "defeat_all",
    background: s.bgColor, width: 400, height: 600,
    player:    { x: 30, y: 545, width: 30, height: 30, color: s.playerColor, jumpForce: s.jumpForce, speed: s.playerSpeed },
    platforms, enemies, coins,
  };
}

function buildReachEnd(s: ParsedStyle, name: string): GameConfig {
  const platforms: PlatformConfig[] = [
    { x: 0,   y: 560, width: 120, height: 14, color: s.platColor },
    { x: 150, y: 530, width: 80,  height: 12, color: s.platColor },
    { x: 280, y: 500, width: 90,  height: 12, color: s.platColor },
    { x: 80,  y: 460, width: 80,  height: 12, color: s.platColor },
    { x: 210, y: 420, width: 100, height: 12, color: s.platColor },
    { x: 50,  y: 370, width: 90,  height: 12, color: s.platColor },
    { x: 190, y: 330, width: 80,  height: 12, color: s.platColor },
    { x: 310, y: 290, width: 80,  height: 12, color: s.platColor },
    { x: 120, y: 240, width: 100, height: 12, color: s.platColor },
    { x: 260, y: 180, width: 120, height: 14, color: s.platColor },
  ];

  const enemies: EnemyConfig[] = [
    { x: 155, y: 510, width: 24, height: 24, color: s.enemyColor, speed: s.enemySpeed,       patrol: { minX: 150, maxX: 225 } },
    { x: 215, y: 400, width: 24, height: 24, color: s.enemyColor, speed: s.enemySpeed + 0.4, patrol: { minX: 210, maxX: 305 } },
    { x: 55,  y: 350, width: 24, height: 24, color: s.enemyColor, speed: s.enemySpeed + 0.7, patrol: { minX: 50,  maxX: 135 } },
    { x: 315, y: 270, width: 24, height: 24, color: s.enemyColor, speed: s.enemySpeed + 1.0, patrol: { minX: 310, maxX: 385 } },
  ];

  const coins: CoinConfig[] = [
    { x: 175, y: 505, radius: 7,  color: "gold",    value: 10 },
    { x: 300, y: 475, radius: 7,  color: "gold",    value: 10 },
    { x: 130, y: 435, radius: 7,  color: "gold",    value: 10 },
    { x: 240, y: 395, radius: 7,  color: "gold",    value: 10 },
    { x: 90,  y: 345, radius: 7,  color: "gold",    value: 15 },
    { x: 210, y: 305, radius: 7,  color: "gold",    value: 15 },
    { x: 340, y: 265, radius: 7,  color: "gold",    value: 20 },
    { x: 310, y: 155, radius: 12, color: "#ffcc33", value: 75 },
  ];

  return {
    name, gravity: s.gravity, winCondition: "reach_end",
    background: s.bgColor, width: 400, height: 600,
    endX: 370,
    player:    { x: 30, y: 530, width: 28, height: 28, color: s.playerColor, jumpForce: s.jumpForce, speed: s.playerSpeed },
    platforms, enemies, coins,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// ── SHOOTER TEMPLATE BUILDER ──────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

function buildShooterGame(prompt: string, name: string): GameConfig {
  const lp = prompt.toLowerCase();

  // Color themes
  let playerColor = "#00cfff", bgColor = "#080c14", wallColor = "#1a2a3a", enemyColor = "#ff4444";

  if (lp.includes("neon") || lp.includes("cyber"))       { playerColor = "#00ffcc"; bgColor = "#03001a"; wallColor = "#1a0033"; enemyColor = "#ff00ff"; }
  if (lp.includes("fire") || lp.includes("red"))          { playerColor = "#ff8800"; bgColor = "#120000"; wallColor = "#2a0800"; enemyColor = "#ff2200"; }
  if (lp.includes("ice") || lp.includes("frost"))         { playerColor = "#aaeeff"; bgColor = "#020e1a"; wallColor = "#0a2a3a"; enemyColor = "#00aaff"; }
  if (lp.includes("shadow") || lp.includes("dark"))       { playerColor = "#9977ff"; bgColor = "#000005"; wallColor = "#0d0d1a"; enemyColor = "#7700ff"; }

  const isHard    = lp.includes("hard") || lp.includes("extreme") || lp.includes("difficult");
  const isEasy    = lp.includes("easy") || lp.includes("beginner");
  const enemySpd  = isHard ? 2.2 : isEasy ? 0.9 : 1.5;
  const enemyHp   = isHard ? 2 : 1;
  const enemyCnt  = lp.includes("many") || lp.includes("swarm") ? 8 : isHard ? 6 : 5;

  // Build enemy positions: spawned at edges/corners
  const positions = [
    { x: 30,  y: 30  }, { x: 300, y: 30  },
    { x: 30,  y: 530 }, { x: 300, y: 530 },
    { x: 170, y: 30  }, { x: 170, y: 530 },
    { x: 30,  y: 280 }, { x: 300, y: 280 },
  ];
  const enemies: EnemyConfig[] = positions.slice(0, enemyCnt).map((pos, i) => ({
    x: pos.x, y: pos.y, width: 28, height: 28,
    color: i % 3 === 0 ? enemyColor : i % 3 === 1 ? "orange" : "#ff00aa",
    speed: enemySpd + i * 0.1,
    hp:    enemyHp,
  }));

  // Pickup items (ammo/health theme shown as gold orbs)
  const coins: CoinConfig[] = [
    { x: 195, y: 290, radius: 8, color: playerColor, value: 100 },
    { x: 100, y: 150, radius: 7, color: "gold",      value: 50  },
    { x: 290, y: 420, radius: 7, color: "gold",      value: 50  },
  ];

  return {
    name,
    gameMode:     "shooter",
    gravity:      0,
    winCondition: "defeat_all",
    background:   bgColor,
    width:        400,
    height:       600,
    health:       isHard ? 60 : 100,
    shootCooldown: isHard ? 400 : 280,
    player: { x: 186, y: 286, width: 28, height: 28, color: playerColor, jumpForce: 0, speed: isHard ? 3.5 : 4.2 },
    // Outer walls + interior obstacles
    platforms: [
      { x: 0,   y: 0,   width: 400, height: 16,  color: wallColor },
      { x: 0,   y: 584, width: 400, height: 16,  color: wallColor },
      { x: 0,   y: 0,   width: 16,  height: 600, color: wallColor },
      { x: 384, y: 0,   width: 16,  height: 600, color: wallColor },
      { x: 80,  y: 100, width: 70,  height: 14,  color: wallColor },
      { x: 250, y: 100, width: 70,  height: 14,  color: wallColor },
      { x: 80,  y: 480, width: 70,  height: 14,  color: wallColor },
      { x: 250, y: 480, width: 70,  height: 14,  color: wallColor },
      { x: 165, y: 230, width: 70,  height: 14,  color: wallColor },
      { x: 165, y: 360, width: 70,  height: 14,  color: wallColor },
    ],
    enemies,
    coins,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// ── BASKETBALL TEMPLATE BUILDER ───────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

function buildBasketballGame(prompt: string, name: string): GameConfig {
  const lp = prompt.toLowerCase();

  let playerColor = "#ff8c00", bgColor = "#0a0a0a", platColor = "#2a1a00";
  if (lp.includes("neon") || lp.includes("cyber"))  { playerColor = "#00ffcc"; bgColor = "#03001a"; platColor = "#1a0033"; }
  if (lp.includes("dark") || lp.includes("night"))  { playerColor = "#9977ff"; bgColor = "#000005"; platColor = "#0d0d1a"; }

  const scoreTarget = lp.includes("20") ? 20 : lp.includes("5") ? 5 : 10;
  const gameTime    = lp.includes("30") ? 30 : lp.includes("90") ? 90 : 60;

  return {
    name,
    gameMode:     "basketball",
    gravity:      0.55,
    winCondition: "score_limit",
    scoreLimit:   scoreTarget,
    surviveSecs:  gameTime,
    background:   bgColor,
    width:        400,
    height:       600,
    player: { x: 50, y: 490, width: 28, height: 36, color: playerColor, jumpForce: 13, speed: 4.5 },
    basket: { x: 295, y: 240, width: 60 },
    platforms: [
      { x: 0,   y: 560, width: 400, height: 16, color: platColor },
      { x: 0,   y: 0,   width: 8,   height: 600, color: "#1a1a1a" },
      { x: 392, y: 0,   width: 8,   height: 600, color: "#1a1a1a" },
      { x: 60,  y: 460, width: 90,  height: 10,  color: platColor },
      { x: 230, y: 400, width: 80,  height: 10,  color: platColor },
      { x: 100, y: 340, width: 80,  height: 10,  color: platColor },
    ],
    enemies: [],
    coins:   [],
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// ── TOPDOWN / OPEN WORLD TEMPLATE BUILDER ────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

function buildTopDownGame(prompt: string, name: string): GameConfig {
  const lp = prompt.toLowerCase();

  let playerColor = "#ffcc33", bgColor = "#0a100a", wallColor = "#1a2a1a", enemyColor = "#ff4444";
  if (lp.includes("city") || lp.includes("urban") || lp.includes("gta")) {
    bgColor = "#0a0a10"; wallColor = "#1a1a2a"; playerColor = "#00cfff";
  } else if (lp.includes("desert") || lp.includes("western")) {
    bgColor = "#140e00"; wallColor = "#2a1e00"; playerColor = "#ffaa22";
  } else if (lp.includes("space") || lp.includes("alien")) {
    bgColor = "#040010"; wallColor = "#100030"; playerColor = "#aa00ff"; enemyColor = "#00ff88";
  }

  const enemyCnt  = lp.includes("many") || lp.includes("lots") ? 8 : 5;
  const isHard    = lp.includes("hard") || lp.includes("extreme");

  const enemyPositions = [
    { x: 40,  y: 40  }, { x: 310, y: 40  },
    { x: 40,  y: 520 }, { x: 310, y: 520 },
    { x: 180, y: 100 }, { x: 180, y: 460 },
    { x: 40,  y: 280 }, { x: 310, y: 280 },
  ];
  const enemies: EnemyConfig[] = enemyPositions.slice(0, enemyCnt).map((pos, i) => ({
    x: pos.x, y: pos.y, width: 26, height: 26,
    color: i % 2 === 0 ? enemyColor : "orange",
    speed: (isHard ? 1.8 : 1.2) + i * 0.15,
    hp: 1,
  }));

  // Collectibles scattered around the arena
  const coins: CoinConfig[] = [
    { x: 100, y: 100, radius: 9, color: "gold", value: 50 },
    { x: 290, y: 100, radius: 9, color: "gold", value: 50 },
    { x: 100, y: 470, radius: 9, color: "gold", value: 50 },
    { x: 290, y: 470, radius: 9, color: "gold", value: 50 },
    { x: 195, y: 290, radius: 11, color: "#ffcc33", value: 100 },
  ];

  return {
    name,
    gameMode:     "topdown",
    gravity:      0,
    winCondition: "collect_all",
    background:   bgColor,
    width:        400,
    height:       600,
    health:       100,
    shootCooldown: 500,
    player: { x: 186, y: 286, width: 26, height: 26, color: playerColor, jumpForce: 0, speed: isHard ? 3.5 : 4.0 },
    platforms: [
      { x: 0,   y: 0,   width: 400, height: 16,  color: wallColor },
      { x: 0,   y: 584, width: 400, height: 16,  color: wallColor },
      { x: 0,   y: 0,   width: 16,  height: 600, color: wallColor },
      { x: 384, y: 0,   width: 16,  height: 600, color: wallColor },
      { x: 80,  y: 120, width: 60,  height: 12,  color: wallColor },
      { x: 260, y: 120, width: 60,  height: 12,  color: wallColor },
      { x: 80,  y: 460, width: 60,  height: 12,  color: wallColor },
      { x: 260, y: 460, width: 60,  height: 12,  color: wallColor },
      { x: 170, y: 240, width: 60,  height: 12,  color: wallColor },
      { x: 170, y: 360, width: 60,  height: 12,  color: wallColor },
    ],
    enemies,
    coins,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// ── FPS WORLD CONFIG BUILDER ──────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
// Generates a WorldConfig JSON structure from prompt keywords.
// The 3D engine reads this to instantiate the full Three.js scene.

function buildFPSWorldConfig(prompt: string, name: string, enemyCount: number, enemyHp: number): WorldConfig {
  const lp = prompt.toLowerCase();

  // ── Theme selection ───────────────────────────────────────────────────────
  let skyColor    = "#060810";
  let fogColor    = "#060810";
  let ambientCol  = "#223344";
  let sunColor    = "#6677cc";
  let wallColor   = "#1a2035";
  let propColor   = "#2c3e50";
  let accentCol   = "#6c5ce7";

  if (lp.includes("inferno") || lp.includes("lava") || lp.includes("fire")) {
    skyColor = "#0f0400"; fogColor = "#0f0400"; ambientCol = "#442211";
    sunColor = "#ff6600"; wallColor = "#2a1510"; accentCol = "#ff4400";
  } else if (lp.includes("ice") || lp.includes("frost") || lp.includes("snow")) {
    skyColor = "#020810"; fogColor = "#020810"; ambientCol = "#114466";
    sunColor = "#aaccff"; wallColor = "#1a2535"; accentCol = "#00aaff";
  } else if (lp.includes("space") || lp.includes("alien") || lp.includes("sci-fi")) {
    skyColor = "#020006"; fogColor = "#020006"; ambientCol = "#110044";
    sunColor = "#aa44ff"; wallColor = "#14102a"; accentCol = "#aa00ff";
  } else if (lp.includes("forest") || lp.includes("jungle") || lp.includes("nature")) {
    skyColor = "#040a04"; fogColor = "#040a04"; ambientCol = "#112211";
    sunColor = "#448833"; wallColor = "#1a2a14"; accentCol = "#00cc44";
  }

  // ── Arena size ────────────────────────────────────────────────────────────
  const isLarge  = lp.includes("large") || lp.includes("open") || lp.includes("wide");
  const arenaR   = isLarge ? 36 : 24;
  const wallH    = 7;

  // ── World objects ─────────────────────────────────────────────────────────
  const objects: WorldConfig["world"]["objects"] = [
    // Floor
    { id: "floor", type: "ground", position: {x:0, y:0, z:0}, scale: {x: arenaR*2, y:0.1, z: arenaR*2}, color: "#12141a" },
    // Perimeter walls
    { id: "wall_n", type: "wall", position: {x:0,     y:wallH/2, z:-arenaR}, scale: {x: arenaR*2, y:wallH, z:0.5}, color: wallColor },
    { id: "wall_s", type: "wall", position: {x:0,     y:wallH/2, z: arenaR}, scale: {x: arenaR*2, y:wallH, z:0.5}, color: wallColor },
    { id: "wall_e", type: "wall", position: {x: arenaR, y:wallH/2, z:0},    scale: {x:0.5, y:wallH, z: arenaR*2}, color: wallColor },
    { id: "wall_w", type: "wall", position: {x:-arenaR, y:wallH/2, z:0},    scale: {x:0.5, y:wallH, z: arenaR*2}, color: wallColor },
    // Cover crates
    ...Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2;
      const r = 8 + (i % 3) * 3;
      return {
        id:    `crate${i}`,
        type:  "prop" as const,
        position: { x: Math.cos(a) * r, y: 0.85, z: Math.sin(a) * r },
        scale: { x: 1.7, y: 1.7, z: 1.7 },
        color: propColor,
      };
    }),
    // Accent columns
    ...Array.from({ length: 4 }, (_, i) => {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const r = arenaR * 0.6;
      return {
        id:       `col${i}`,
        type:     "building" as const,
        position: { x: Math.cos(a) * r, y: wallH / 2, z: Math.sin(a) * r },
        scale:    { x: 1.8, y: wallH, z: 1.8 },
        color:    "#14102a",
        emissive: accentCol,
        material: "emissive" as const,
      };
    }),
  ];

  // ── Enemy spawns ──────────────────────────────────────────────────────────
  const enemies: WorldConfig["enemies"] = Array.from({ length: enemyCount }, (_, i) => {
    const a    = (i / enemyCount) * Math.PI * 2;
    const r    = 10 + (i % 3) * 4;
    const beh: EnemyBehavior = i % 3 === 0 ? "patrol" : i % 3 === 1 ? "guard" : "chase";
    return {
      id:    `e${i}`,
      spawn: { x: Math.cos(a) * r, y: 0, z: Math.sin(a) * r },
      hp:    enemyHp, speed: 4.0 + (i % 3) * 0.8,
      behavior: beh,
    };
  });

  // ── Pickups ───────────────────────────────────────────────────────────────
  const pickups: WorldConfig["pickups"] = [
    { id: "hp1",   position: { x: 6,  y: 1, z:  5 }, kind: "health", value: 30 },
    { id: "ammo1", position: { x:-7,  y: 1, z: -8 }, kind: "ammo",   value: 20 },
    { id: "ammo2", position: { x: 10, y: 1, z: -5 }, kind: "ammo",   value: 20 },
  ];

  return {
    mode: "fps", name,
    world: { skyColor, fogColor, fogDensity: 0.018, ambientColor: ambientCol, ambientIntensity: 0.5, sunColor, objects },
    enemies, pickups,
    playerSpawn: { x: 0, y: 1.7, z: 0 },
    objective: "eliminate_all",
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// ── FPS TEMPLATE BUILDER ─────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

function buildFPSGame(prompt: string, name: string): GameConfig {
  const lp = prompt.toLowerCase();

  // Difficulty tuning
  const enemyCount = lp.includes("many") || lp.includes("wave") || lp.includes("horde") ? 14
    : lp.includes("easy") || lp.includes("beginner") ? 4 : 8;
  const enemyHp    = lp.includes("hard") || lp.includes("elite") ? 5 : 3;
  const playerHp   = lp.includes("hard") ? 60 : lp.includes("easy") ? 150 : 100;

  // Theme colours
  let bgColor = "#070a14";
  if (lp.includes("inferno") || lp.includes("lava") || lp.includes("fire")) bgColor = "#100400";
  else if (lp.includes("ice") || lp.includes("frost") || lp.includes("snow")) bgColor = "#02080f";
  else if (lp.includes("space") || lp.includes("alien")) bgColor = "#030006";

  return {
    name,
    gameMode:     "fps",
    gravity:      0,
    winCondition: "defeat_all",
    background:   bgColor,
    width:        400,
    height:       600,
    health:       playerHp,
    player: { x: 0, y: 1.7, width: 1, height: 2, color: "#00cfff", jumpForce: 8, speed: 7 },
    platforms: [],
    enemies: Array.from({ length: enemyCount }, () => ({
      x: 0, y: 0, width: 0.7, height: 1.6, color: "#e74c3c", hp: enemyHp,
    })),
    coins: [],
    // WorldConfig wires the 3D scene loader to AI-generated world JSON
    worldConfig: buildFPSWorldConfig(prompt, name, enemyCount, enemyHp),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// ── OPEN WORLD GENERATOR ──────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

function buildOpenWorldGame(prompt: string, name: string): GameConfig {
  const lp = prompt.toLowerCase();
  const playerHp = lp.includes("hard") ? 60 : lp.includes("easy") ? 150 : 100;
  return {
    name,
    gameMode:     "openworld",
    gravity:      0,
    winCondition: "collect_all",
    background:   "#07080e",
    width:        400,
    height:       600,
    health:       playerHp,
    player: { x: 8, y: 0, width: 0.65, height: 1.8, color: "#3d5afe", jumpForce: 9, speed: 7 },
    platforms: [],
    enemies: [],
    coins: [],
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// ── PUBLIC GENERATOR ──────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

export function generateGameFromPrompt(prompt: string): GameConfig {
  const gameType = detectGameType(prompt);
  const name     = uniqueName(prompt);

  console.log(`%c[AI Generator v4] "${name}" | type=${gameType}`, "color:#A29BFE;font-weight:bold");

  // ── Route to correct engine ──────────────────────────────────────────────

  if (gameType === "fps") {
    return buildFPSGame(prompt, name);
  }

  if (gameType === "openworld") {
    return buildOpenWorldGame(prompt, name);
  }

  if (gameType === "shooter") {
    return buildShooterGame(prompt, name);
  }

  if (gameType === "basketball") {
    return buildBasketballGame(prompt, name);
  }

  if (gameType === "topdown") {
    return buildTopDownGame(prompt, name);
  }

  // ── Platformer variants ──────────────────────────────────────────────────

  const style = parsePrompt(prompt);

  if (style.winType === "survive" || style.twist === "survive_wave") {
    return buildSurviveLevel(style, name);
  }
  if (style.twist === "coin_hunt") {
    return buildCoinHunt(style, name);
  }
  if (style.twist === "boss_rush" || style.winType === "defeat_all") {
    return buildBossRush(style, name);
  }
  if (style.winType === "reach_end" || style.twist === "wide") {
    return buildReachEnd(style, name);
  }
  return buildPlatformerLevel(style, name);
}
