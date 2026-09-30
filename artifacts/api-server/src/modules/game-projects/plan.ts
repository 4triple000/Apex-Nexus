/**
 * Game plans for the Apex Engine: a starter plan per template (works with no AI key),
 * and AI help to write or change a plan when OpenAI is connected.
 */
import { z } from "zod";
import { openai, isOpenAIConfigured } from "@workspace/integrations-openai-ai-server";
import { logger } from "../../lib/logger";

export const TARGETS = ["apex", "mobile", "pc"] as const;
export const ENGINES = ["apex", "unity", "unreal"] as const;
export const TEMPLATES = ["fps", "topdown", "platformer", "sports", "openworld", "survival"] as const;
export type Target = (typeof TARGETS)[number];
export type Engine = (typeof ENGINES)[number];
export type Template = (typeof TEMPLATES)[number];
/** Starter plans: the six templates, plus racing and a neutral one for ideas that match none */
export type Starter = Template | "racing" | "custom";

export const CAMERAS = ["First person", "Third person", "Top-down", "Side view"] as const;

export const GamePlan = z.object({
  pitch: z.string().max(1200),
  genre: z.string().max(80),
  camera: z.enum(CAMERAS),
  platforms: z.array(z.string().max(40)).max(8),
  coreLoop: z.string().max(1200),
  controls: z.array(z.string().max(160)).max(16),
  mechanics: z.array(z.string().max(240)).max(16),
  levels: z.array(z.object({ name: z.string().max(80), goal: z.string().max(240) })).max(16),
  // voiceId/voiceName: the ElevenLabs voice picked for the character
  characters: z.array(z.object({ name: z.string().max(80), role: z.string().max(240), voiceId: z.string().max(40).optional(), voiceName: z.string().max(40).optional() })).max(16),
  artStyle: z.string().max(600),
  audio: z.string().max(600),
  checklist: z.array(z.object({ id: z.string().max(40), label: z.string().max(160), done: z.boolean() })).max(30),
});
export type GamePlan = z.infer<typeof GamePlan>;

interface StarterPlan {
  genre: string;
  camera: GamePlan["camera"];
  coreLoop: string;
  mechanics: string[];
  levels: GamePlan["levels"];
  characters: GamePlan["characters"];
  artStyle: string;
  audio: string;
}

const STARTERS: Record<Starter, StarterPlan> = {
  fps: {
    genre: "First-person shooter", camera: "First person",
    coreLoop: "Drop into the arena, clear each wave of enemies, grab health and ammo, and survive to the extraction point.",
    mechanics: ["Hitscan rifle with recoil and reload", "Sprint and slide", "Health and ammo pickups", "Enemy waves that get tougher"],
    levels: [{ name: "Rooftops", goal: "Clear 3 waves and reach the helipad" }, { name: "Warehouse", goal: "Defend the cargo for 3 minutes" }],
    characters: [{ name: "Player", role: "Soldier with a rifle and a sidearm" }, { name: "Grunt", role: "Rushes the player at close range" }, { name: "Sniper", role: "Holds high ground and punishes standing still" }],
    artStyle: "Neon night city, strong rim lighting, clean readable silhouettes.",
    audio: "Punchy weapon sounds, synth soundtrack that ramps up each wave.",
  },
  topdown: {
    genre: "Top-down shooter", camera: "Top-down",
    coreLoop: "Move and aim in any direction, clear the room, collect upgrades, and push to the next room.",
    mechanics: ["Twin-stick move and aim", "Dash with a short cooldown", "Weapon upgrades between rooms", "Room-by-room progression"],
    levels: [{ name: "Neon Streets", goal: "Clear 5 rooms" }, { name: "Boss Arena", goal: "Defeat the boss" }],
    characters: [{ name: "Player", role: "Fast operative with a blaster" }, { name: "Drone", role: "Flies in patterns and fires bursts" }, { name: "Boss", role: "Big enemy with 3 attack phases" }],
    artStyle: "Bright neon shapes on a dark floor, glowing bullets.",
    audio: "Chiptune-meets-synthwave music, crisp hit sounds.",
  },
  platformer: {
    genre: "Platformer", camera: "Side view",
    coreLoop: "Run and jump through each level, collect coins, avoid or stomp enemies, and reach the flag.",
    mechanics: ["Tight jump with coyote time", "Double jump unlock", "Moving platforms", "Coins that unlock new levels"],
    levels: [{ name: "Neon Hills", goal: "Reach the flag" }, { name: "Sky Towers", goal: "Collect all 3 stars and reach the top" }],
    characters: [{ name: "Player", role: "Nimble hero who can double jump" }, { name: "Walker", role: "Patrols back and forth" }, { name: "Flyer", role: "Swoops down when the player is near" }],
    artStyle: "Colorful glowing platforms, soft gradients, cute characters.",
    audio: "Upbeat melody, bouncy jump and coin sounds.",
  },
  sports: {
    genre: "Arcade basketball", camera: "Third person",
    coreLoop: "Win possession, drive to the hoop, and score before the shot clock and match timer run out.",
    mechanics: ["Timed shot meter", "Dribble moves and crossovers", "Steals and blocks", "Hot streak bonus"],
    levels: [{ name: "Street Court", goal: "First to 21" }, { name: "Arena Finals", goal: "Win a 4-quarter match" }],
    characters: [{ name: "Player", role: "Shooting guard with a quick release" }, { name: "Rival", role: "Tough defender who contests every shot" }],
    artStyle: "Night street court under floodlights, bold team colors.",
    audio: "Hip-hop beats, sneaker squeaks, crowd reactions.",
  },
  openworld: {
    genre: "Open-world action", camera: "Third person",
    coreLoop: "Explore the city, take on missions, earn cash, and upgrade your gear and vehicles.",
    mechanics: ["Get in and drive vehicles", "Missions with markers on a map", "Wanted level that brings police", "Shops for weapons and outfits"],
    levels: [{ name: "Downtown", goal: "Finish the first 3 story missions" }, { name: "Docks", goal: "Pull off the heist" }],
    characters: [{ name: "Player", role: "Newcomer building a reputation" }, { name: "Fixer", role: "Hands out missions" }, { name: "Police", role: "Chases the player when wanted" }],
    artStyle: "Sunset city with neon signs, realistic scale.",
    audio: "Radio stations in cars, city ambience.",
  },
  racing: {
    genre: "Racing", camera: "Third person",
    coreLoop: "Race through each track, nail boosts and shortcuts, beat your rivals, and spend winnings on upgrades.",
    mechanics: ["Drift to charge a boost", "Shortcuts and jumps on every track", "Vehicle upgrades between races", "Time trials with ghost replays"],
    levels: [{ name: "Neon Canyon", goal: "Finish in the top 3" }, { name: "Skyline Loop", goal: "Beat the champion's lap time" }],
    characters: [{ name: "Player", role: "Up-and-coming racer" }, { name: "Champion", role: "The rival to beat on every track" }],
    artStyle: "Fast, glowing tracks with strong speed lines and motion blur.",
    audio: "Driving electronic music, engine roar that rises with speed.",
  },
  custom: {
    genre: "Action", camera: "Third person",
    coreLoop: "Master one signature ability, use it to get past tougher and tougher challenges, and earn upgrades along the way.",
    mechanics: ["Movement that feels great", "One signature ability that makes the game unique", "Enemies or obstacles that test that ability", "Rewards and upgrades between levels"],
    levels: [{ name: "Level 1", goal: "Teach the main ability" }, { name: "Level 2", goal: "Combine it with a new challenge" }],
    characters: [{ name: "Player", role: "The hero of your idea" }, { name: "Rival", role: "Stands in the player's way" }],
    artStyle: "Pick a look that fits the idea: realistic, stylized, or neon.",
    audio: "Music that matches the mood, with punchy feedback sounds.",
  },
  survival: {
    genre: "Wave survival", camera: "Top-down",
    coreLoop: "Survive endless waves, collect loot between waves, and build up your defenses.",
    mechanics: ["Waves that grow each round", "Loot drops and upgrades", "Build barricades", "Boss every 5 waves"],
    levels: [{ name: "Outpost", goal: "Survive 10 waves" }, { name: "Night Mode", goal: "Survive 5 waves in the dark" }],
    characters: [{ name: "Player", role: "Survivor with a shotgun" }, { name: "Crawler", role: "Weak but comes in swarms" }, { name: "Brute", role: "Slow and tanky" }],
    artStyle: "Moody lighting, glowing enemies, readable arena.",
    audio: "Tense ambient music that builds during waves.",
  },
};

export function detectTemplate(prompt: string): Starter {
  const p = prompt.toLowerCase();
  if (/(rac(e|ing)|kart|drift|speedway|hover.?bike)/.test(p)) return "racing";
  if (/(fps|first.?person|call of duty|shooter 3d|3d shooter|warzone)/.test(p)) return "fps";
  if (/(open.?world|gta|city|explore)/.test(p)) return "openworld";
  if (/(basketball|soccer|football|sport|nba|2k)/.test(p)) return "sports";
  if (/(platform|jump|mario|side.?scroll)/.test(p)) return "platformer";
  if (/(survive|survival|wave|zombie)/.test(p)) return "survival";
  if (/(top.?down|twin.?stick|arena)/.test(p)) return "topdown";
  if (/(rac(e|ing)|kart|drift|car\b|cars\b|bike|motorcycle|speedway)/.test(p)) return "racing";
  if (/(shoot|gun|sniper|battle royale)/.test(p)) return "fps";
  return "custom";
}

export function platformsFor(target: Target): string[] {
  if (target === "mobile") return ["iPhone", "Android"];
  if (target === "pc") return ["Windows PC", "Mac", "PlayStation", "Xbox"];
  return ["Phone", "Computer (web)"];
}

function controlsFor(target: Target, camera: GamePlan["camera"]): string[] {
  if (target === "mobile") {
    return ["Left thumb: on-screen joystick to move", "Right thumb: drag to aim or look", "Buttons: jump and fire on the right side"];
  }
  const look = camera === "First person" || camera === "Third person" ? "Mouse: look around" : "Mouse: aim";
  return ["WASD: move", look, "Space: jump", "Left click: fire / action", "Controller: left stick move, right stick look, RT fire"];
}

export function checklistFor(target: Target, engine: Engine): GamePlan["checklist"] {
  const plan = [
    { id: "pitch", label: "Write the pitch", done: false },
    { id: "loop", label: "Describe the core loop", done: false },
    { id: "controls", label: "Decide the controls", done: false },
    { id: "mechanics", label: "List the main mechanics", done: false },
    { id: "level1", label: "Plan the first level", done: false },
    { id: "art", label: "Pick an art style", done: false },
  ];
  if (engine === "unity") {
    return [...plan,
      { id: "install", label: "Install Unity Hub and Unity 6 on your computer", done: false },
      { id: "download", label: "Download the starter project from Apex", done: false },
      { id: "open", label: "Open it in Unity Hub and press Play", done: false },
      ...(target === "mobile" ? [{ id: "device", label: "Build to your phone (iOS or Android)", done: false }] : []),
    ];
  }
  if (engine === "unreal") {
    return [...plan,
      { id: "install", label: "Install Unreal Engine 5 (Epic Games Launcher) and Visual Studio", done: false },
      { id: "download", label: "Download the starter project from Apex", done: false },
      { id: "open", label: "Open the .uproject file and press Play", done: false },
    ];
  }
  return [...plan, { id: "play", label: "Press Play and test it", done: false }, { id: "publish", label: "Publish it to Apex Games", done: false }];
}

/** A complete plan built from a template, used when AI isn't connected (and as the AI's starting point). */
export function starterPlan(template: Starter, target: Target, engine: Engine, prompt?: string): GamePlan {
  const s = STARTERS[template];
  // Mobile games play best with simple cameras
  const camera = target === "mobile" && s.camera === "First person" ? "Third person" : s.camera;
  return {
    pitch: prompt?.trim() ? prompt.trim().slice(0, 1200) : `A ${s.genre.toLowerCase()} built for ${platformsFor(target).join(", ")}.`,
    genre: s.genre,
    camera,
    platforms: platformsFor(target),
    coreLoop: s.coreLoop,
    controls: controlsFor(target, camera),
    mechanics: s.mechanics,
    levels: s.levels,
    characters: s.characters,
    artStyle: s.artStyle,
    audio: s.audio,
    checklist: checklistFor(target, engine).map((c) => (c.id === "pitch" && prompt?.trim() ? { ...c, done: true } : c)),
  };
}

function parseJson(raw: string): unknown {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  return JSON.parse(cleaned);
}

const PLAN_RULES = `A game plan is JSON with exactly these keys:
pitch (string), genre (string), camera ("First person" | "Third person" | "Top-down" | "Side view"),
platforms (string[]), coreLoop (string), controls (string[]), mechanics (string[]),
levels ({name, goal}[]), characters ({name, role}[]), artStyle (string), audio (string),
checklist ({id, label, done}[]).
Keep it concrete and buildable by one person or a small team. Plain, friendly language. No markdown.`;

/** Writes a custom plan from the user's idea. Falls back to the starter plan if AI isn't connected or fails. */
export async function aiPlan(prompt: string, template: Starter, target: Target, engine: Engine): Promise<{ plan: GamePlan; ai: boolean }> {
  const base = starterPlan(template, target, engine, prompt);
  if (!isOpenAIConfigured() || !prompt.trim()) return { plan: base, ai: false };
  try {
    const r = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 2500,
      messages: [
        { role: "system", content: `You are a senior game designer. ${PLAN_RULES} Keep the checklist exactly as given. Return ONLY the JSON object.` },
        { role: "user", content: `Game idea: ${prompt}\nMade for: ${base.platforms.join(", ")} with ${engine === "apex" ? "the Apex web engine" : engine === "unity" ? "Unity" : "Unreal Engine 5"}.\nStart from this plan and make it specific to the idea:\n${JSON.stringify(base)}` },
      ],
    });
    const parsed = GamePlan.safeParse(parseJson(r.choices[0]?.message?.content ?? ""));
    if (parsed.success) return { plan: { ...parsed.data, checklist: base.checklist }, ai: true };
    logger.warn({ issues: parsed.error.issues.slice(0, 3) }, "Engine: AI plan did not match the schema");
  } catch (err) {
    logger.warn({ err }, "Engine: AI plan failed; using starter plan");
  }
  return { plan: base, ai: false };
}

/** Changes a plan from a chat request. Throws when AI isn't connected. */
export async function aiEditPlan(plan: GamePlan, request: string): Promise<{ plan: GamePlan; reply: string }> {
  const r = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 2500,
    messages: [
      { role: "system", content: `You are a senior game designer helping someone plan their game. ${PLAN_RULES}
Apply the user's request to the plan. Keep checklist items and their done values unless asked.
Return ONLY JSON: {"plan": <the full updated plan>, "reply": "<one or two short sentences saying what you changed>"}` },
      { role: "user", content: `Current plan:\n${JSON.stringify(plan)}\n\nRequest: ${request}` },
    ],
  });
  const out = parseJson(r.choices[0]?.message?.content ?? "") as { plan?: unknown; reply?: unknown };
  const parsed = GamePlan.safeParse(out.plan);
  if (!parsed.success) throw new Error("The AI's answer didn't match the plan format. Try asking again.");
  return { plan: parsed.data, reply: typeof out.reply === "string" ? out.reply.slice(0, 400) : "Updated your plan." };
}

/** Changes an Apex game config from a chat request. Throws when AI isn't connected. */
export async function aiEditConfig(config: unknown, request: string): Promise<{ config: Record<string, unknown>; reply: string }> {
  const r = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 4000,
    messages: [
      { role: "system", content: `You edit games for the Apex web engine. A game is a JSON GameConfig with keys like
name, gameMode ("platformer"|"shooter"|"basketball"|"topdown"|"fps"|"openworld"), gravity, winCondition
("reach_end"|"collect_all"|"defeat_all"|"survive"|"score_limit"), background, width, height, player {x,y,width,height,color,jumpForce,speed},
platforms [{x,y,width,height,color}], enemies [{x,y,width,height,color,speed,patrol:{minX,maxX},hp}], coins [{x,y,radius,color,value}],
surviveSecs, scoreLimit, health, shootCooldown, worldConfig (3D modes; keep its structure).
Apply the request, keep everything else, and keep the game playable.
Return ONLY JSON: {"config": <full updated GameConfig>, "reply": "<one short sentence saying what changed>"}` },
      { role: "user", content: `Game:\n${JSON.stringify(config)}\n\nRequest: ${request}` },
    ],
  });
  const out = parseJson(r.choices[0]?.message?.content ?? "") as { config?: unknown; reply?: unknown };
  const cfg = out.config as Record<string, unknown> | undefined;
  if (!cfg || typeof cfg !== "object" || !cfg.player || !Array.isArray(cfg.enemies)) {
    throw new Error("The AI's answer wasn't a playable game. Try asking again.");
  }
  return { config: cfg, reply: typeof out.reply === "string" ? out.reply.slice(0, 300) : "Updated your game." };
}
