/**
 * Common game changes applied instantly on the device (no AI needed):
 * harder / easier, more / fewer enemies, faster / slower, higher jump, new map.
 * Anything else goes to the AI helper on the server.
 */
import type { GameConfig, EnemyConfig } from "@/engine/types";
import { generateGameFromPrompt } from "@/engine/demoGames";

const MODE_PROMPT: Record<string, string> = {
  fps: "3D first person shooter", openworld: "open world city game", gta: "open world city game",
  basketball: "basketball game", shooter: "top-down arena shooter", topdown: "top-down arena shooter", platformer: "neon platformer",
};

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const is3D = (c: GameConfig) => c.gameMode === "fps" || c.gameMode === "openworld" || c.gameMode === "gta";

export function enemyCount(c: GameConfig) {
  return c.worldConfig?.enemies?.length ?? c.enemies.length;
}

/** Sets how many enemies there are, copying or removing from the end. */
export function setEnemyCount(config: GameConfig, n: number): GameConfig {
  const c = clone(config);
  const count = Math.max(1, Math.min(30, Math.round(n)));
  if (c.worldConfig?.enemies) {
    const list = c.worldConfig.enemies;
    while (list.length < count) {
      const base = list[list.length - 1] ?? { id: "e0", spawn: { x: 10, y: 0, z: 10 }, hp: 100, speed: 4 };
      const a = (list.length / count) * Math.PI * 2;
      const r = 12 + (list.length % 4) * 5;
      list.push({ ...base, id: `e${list.length + 1}`, spawn: { x: Math.cos(a) * r, y: 0, z: Math.sin(a) * r } });
    }
    list.length = count;
  }
  if (!is3D(c) || c.enemies.length) {
    const list = c.enemies;
    const w = c.width ?? 400;
    while (list.length < count) {
      const base: EnemyConfig = list[list.length - 1] ?? { x: 100, y: 100, width: 28, height: 28, color: "red", speed: 1.5 };
      const x = 40 + ((list.length * 97) % Math.max(60, w - 80));
      list.push({ ...base, x, patrol: base.patrol ? { minX: Math.max(0, x - 50), maxX: Math.min(w, x + 50) } : undefined });
    }
    list.length = Math.min(list.length, count);
  }
  return c;
}

/** Multiplies enemy speed and health. */
export function scaleEnemies(config: GameConfig, speed = 1, hp = 1): GameConfig {
  const c = clone(config);
  c.enemies = c.enemies.map((e) => ({ ...e, speed: e.speed !== undefined ? +(e.speed * speed).toFixed(2) : e.speed, hp: e.hp !== undefined ? Math.max(1, Math.round(e.hp * hp)) : e.hp }));
  if (c.worldConfig?.enemies) {
    c.worldConfig.enemies = c.worldConfig.enemies.map((e) => ({ ...e, speed: +((e.speed ?? 4) * speed).toFixed(2), hp: Math.max(1, Math.round((e.hp ?? 100) * hp)) }));
  }
  return c;
}

export function quickEdit(config: GameConfig, request: string): { config: GameConfig; reply: string } | null {
  const t = request.toLowerCase();
  if (/(new|different|another) (map|level|layout)|regenerate|reroll/.test(t)) {
    const fresh = generateGameFromPrompt(`${MODE_PROMPT[config.gameMode ?? "platformer"] ?? "game"} ${Math.random().toString(36).slice(2, 6)}`);
    return { config: { ...fresh, name: config.name }, reply: "Made a new map with the same kind of game." };
  }
  if (/harder|more difficult|tougher|challenging/.test(t)) {
    let c = scaleEnemies(config, 1.25, 1.3);
    c = setEnemyCount(c, enemyCount(c) + 2);
    if (c.health) c.health = Math.max(20, Math.round(c.health * 0.85));
    return { config: c, reply: "Harder: 2 more enemies, and they're faster and tougher." };
  }
  if (/easier|less difficult|too hard/.test(t)) {
    let c = scaleEnemies(config, 0.8, 0.75);
    c = setEnemyCount(c, enemyCount(c) - 1);
    if (c.health) c.health = Math.round(c.health * 1.25);
    return { config: c, reply: "Easier: one less enemy, and they're slower and weaker." };
  }
  const more = t.match(/(\d+)?\s*more enem/);
  if (more) {
    const add = more[1] ? Number(more[1]) : 3;
    return { config: setEnemyCount(config, enemyCount(config) + add), reply: `Added ${add} enemies.` };
  }
  if (/(fewer|less) enem/.test(t)) {
    return { config: setEnemyCount(config, enemyCount(config) - 2), reply: "Removed 2 enemies." };
  }
  if (/(faster|speed up|quicker)/.test(t) && !/enem/.test(t)) {
    const c = clone(config);
    c.player.speed = +(c.player.speed * 1.3).toFixed(2);
    return { config: c, reply: "Your player moves 30% faster." };
  }
  if (/(slower|slow down)/.test(t) && !/enem/.test(t)) {
    const c = clone(config);
    c.player.speed = +(c.player.speed * 0.8).toFixed(2);
    return { config: c, reply: "Your player moves 20% slower." };
  }
  if (/(higher|bigger|more) jump|jump higher/.test(t)) {
    const c = clone(config);
    c.player.jumpForce = +(c.player.jumpForce * 1.2).toFixed(2);
    return { config: c, reply: "Jumps go 20% higher." };
  }
  return null;
}
