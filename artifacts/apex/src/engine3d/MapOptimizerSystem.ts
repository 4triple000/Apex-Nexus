/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  APEX ENGINE 3D — AI Map Optimizer                          ║
 * ║                                                             ║
 * ║  Uses gameplay analytics heatmaps to mutate MapConfig:     ║
 * ║    ➕  Add cover near death choke-points                    ║
 * ║    ➖  Remove cover from unused dead zones                  ║
 * ║    ⚖  Re-weight spawn points away from danger              ║
 * ║    🔁  Rebuild path corridors through hot zones             ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
import type { MapConfig, CoverObject, SpawnPoint } from "./MapGenSystem";
import type { MapAnalyticsSystem } from "./MapAnalyticsSystem";

// ── Result ────────────────────────────────────────────────────────────────────

export interface OptimizationResult {
  config:        MapConfig;
  changes:       string[];
  addedCover:    number;
  removedCover:  number;
  movedSpawns:   number;
  balanceScore:  number;  // 0..100 — higher = better balanced
}

// ── Optimizer ─────────────────────────────────────────────────────────────────

export function optimizeMap(
  config:    MapConfig,
  analytics: MapAnalyticsSystem,
): OptimizationResult {
  const changes: string[] = [];
  let addedCover   = 0;
  let removedCover = 0;
  let movedSpawns  = 0;

  let covers:  CoverObject[] = [...config.covers];
  let spawns:  SpawnPoint[]  = [...config.spawnPoints];
  let idN = covers.length;

  const chokePoints  = analytics.getChokePoints(2);   // ≥2 deaths = choke
  const unusedAreas  = analytics.getUnusedAreas();
  const heatmap      = analytics.getHeatmap();
  const maxDeaths    = Math.max(1, ...heatmap.map(c => c.deaths));

  // ── Phase 1: Add protective cover near choke points ─────────────────────────
  for (const choke of chokePoints) {
    if (addedCover >= 4) break;   // Cap additions per optimization pass

    // Try offset directions to place cover next to (not on top of) the choke
    const dirs = [[3.5, 0], [-3.5, 0], [0, 3.5], [0, -3.5], [2.5, 2.5], [-2.5, 2.5]];
    for (const [ox, oz] of dirs) {
      const nx = choke.wx + ox;
      const nz = choke.wz + oz;

      if (Math.abs(nx) > 27 || Math.abs(nz) > 27) continue; // Out of bounds
      if (covers.some(c => Math.hypot(c.x - nx, c.z - nz) < 3)) continue; // Too close

      const size: [number, number, number] = choke.deaths >= 5 ? [3, 3, 3] : [2, 2, 2];
      covers.push({
        id: `opt_${idN++}`,
        x: nx, z: nz,
        w: size[0], h: size[1], d: size[2],
        type: "crate",
        optimizerAdded: true,
      });
      addedCover++;
      changes.push(
        `➕ Cover at (${nx.toFixed(1)}, ${nz.toFixed(1)}) ` +
        `— ${choke.deaths} deaths choke-point`
      );
      break;
    }
  }

  // ── Phase 2: Prune cover from dead zones (unused areas) ─────────────────────
  for (const dead of unusedAreas) {
    if (removedCover >= 3) break; // Cap removals per pass

    // Find the closest non-optimizer cover in this dead zone
    const nearby = covers
      .filter(c => !c.optimizerAdded && Math.hypot(c.x - dead.wx, c.z - dead.wz) < 7)
      .sort((a, b) => Math.hypot(a.x - dead.wx, a.z - dead.wz) - Math.hypot(b.x - dead.wx, b.z - dead.wz));

    if (nearby.length > 0) {
      const rm = nearby[0];
      covers = covers.filter(c => c.id !== rm.id);
      removedCover++;
      changes.push(
        `➖ Removed ${rm.type} at (${rm.x.toFixed(1)}, ${rm.z.toFixed(1)}) ` +
        `— dead zone (${dead.visits} visits)`
      );
    }
  }

  // ── Phase 3: Re-weight spawns away from hot zones ───────────────────────────
  spawns = spawns.map(sp => {
    const nearby = heatmap.filter(c => Math.hypot(c.wx - sp.x, c.wz - sp.z) < 9);
    const localDeaths = nearby.reduce((n, c) => n + c.deaths, 0);
    const ratio = localDeaths / (maxDeaths * 3);

    if (ratio > 0.4 && sp.weight > 0.3) {
      const newW = Math.max(0.2, +(sp.weight - 0.2).toFixed(2));
      if (newW !== sp.weight) {
        movedSpawns++;
        changes.push(
          `⚖ Spawn (${sp.x.toFixed(0)}, ${sp.z.toFixed(0)}) weight ` +
          `${sp.weight.toFixed(1)}→${newW.toFixed(1)} — high death proximity`
        );
        return { ...sp, weight: newW };
      }
    }
    // Boost spawn weight in safe, well-visited areas
    if (ratio < 0.1 && sp.weight < 1.0) {
      const newW = Math.min(1.0, +(sp.weight + 0.1).toFixed(2));
      return { ...sp, weight: newW };
    }
    return sp;
  });

  if (changes.length === 0) {
    changes.push("✅ Map is well-balanced — no structural changes needed");
  }

  // ── Phase 4: Compute balance score ──────────────────────────────────────────
  //   Higher = more evenly distributed deaths + high exploration coverage
  const coverage = analytics.explorationCoverage;
  const deathSpread = chokePoints.length === 0
    ? 1.0
    : 1.0 - Math.min(1, (chokePoints[0]?.deaths ?? 0) / 10);
  const balanceScore = Math.round((coverage * 0.5 + deathSpread * 0.5) * 100);

  const logEntry = [
    `v${config.version + 1}:`,
    addedCover   > 0 ? `+${addedCover} cover` : null,
    removedCover > 0 ? `-${removedCover} removed` : null,
    movedSpawns  > 0 ? `${movedSpawns} spawns` : null,
    `score ${balanceScore}`,
  ].filter(Boolean).join(" ");

  const newConfig: MapConfig = {
    ...config,
    version:         config.version + 1,
    covers,
    spawnPoints:     spawns,
    generationCount: config.generationCount + 1,
    optimizationLog: [...config.optimizationLog.slice(-9), logEntry],
  };

  return { config: newConfig, changes, addedCover, removedCover, movedSpawns, balanceScore };
}
