/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  APEX ENGINE 3D — Map Analytics System                      ║
 * ║                                                             ║
 * ║  Tracks per-session gameplay events on a spatial grid:     ║
 * ║    💀  Player deaths        → death heatmap                ║
 * ║    🗺  Player visits        → exploration coverage         ║
 * ║    💥  Damage taken         → danger heatmap               ║
 * ║                                                             ║
 * ║  Produces:                                                  ║
 * ║    ⚠  Choke points   (high death density)                  ║
 * ║    🏜  Unused areas   (low player visits)                   ║
 * ║    🔥  Hot zones      (high damage taken)                   ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

export const ANALYTICS_CELL = 4;   // World units per cell
export const ANALYTICS_HALF = 32;  // Arena half-size
const GRID_DIM = Math.ceil((ANALYTICS_HALF * 2) / ANALYTICS_CELL); // 16

// ── Types ──────────────────────────────────────────────────────────────────────

export interface HeatCell {
  cx:     number;   // grid column
  cz:     number;   // grid row
  wx:     number;   // world-space center X
  wz:     number;   // world-space center Z
  deaths: number;
  visits: number;
  damage: number;
}

interface CellData {
  deaths: number;
  visits: number;
  damage: number;
}

export interface PersistedAnalytics {
  version: 1;
  cells: { cx: number; cz: number; deaths: number; visits: number; damage: number }[];
}

// ── Class ─────────────────────────────────────────────────────────────────────

export class MapAnalyticsSystem {
  private grid: Map<string, CellData> = new Map();

  // ── Private helpers ─────────────────────────────────────────────────────────

  private key(cx: number, cz: number): string { return `${cx}|${cz}`; }

  private toCell(wx: number, wz: number): [number, number] {
    const cx = Math.floor((wx + ANALYTICS_HALF) / ANALYTICS_CELL);
    const cz = Math.floor((wz + ANALYTICS_HALF) / ANALYTICS_CELL);
    return [
      Math.max(0, Math.min(GRID_DIM - 1, cx)),
      Math.max(0, Math.min(GRID_DIM - 1, cz)),
    ];
  }

  private toWorld(cx: number, cz: number): [number, number] {
    return [
      -ANALYTICS_HALF + cx * ANALYTICS_CELL + ANALYTICS_CELL / 2,
      -ANALYTICS_HALF + cz * ANALYTICS_CELL + ANALYTICS_CELL / 2,
    ];
  }

  private get(cx: number, cz: number): CellData {
    const k = this.key(cx, cz);
    if (!this.grid.has(k)) this.grid.set(k, { deaths: 0, visits: 0, damage: 0 });
    return this.grid.get(k)!;
  }

  // ── Recording ───────────────────────────────────────────────────────────────

  recordDeath(wx: number, wz: number): void {
    const [cx, cz] = this.toCell(wx, wz);
    this.get(cx, cz).deaths++;
  }

  recordVisit(wx: number, wz: number): void {
    const [cx, cz] = this.toCell(wx, wz);
    this.get(cx, cz).visits++;
  }

  recordDamage(wx: number, wz: number, amount: number): void {
    const [cx, cz] = this.toCell(wx, wz);
    this.get(cx, cz).damage += amount;
  }

  // ── Queries ─────────────────────────────────────────────────────────────────

  getHeatmap(): HeatCell[] {
    return Array.from(this.grid.entries()).map(([key, data]) => {
      const [cxs, czs] = key.split("|");
      const cx = parseInt(cxs);
      const cz = parseInt(czs);
      const [wx, wz] = this.toWorld(cx, cz);
      return { cx, cz, wx, wz, ...data };
    });
  }

  /** Cells with disproportionate deaths — dangerous bottlenecks */
  getChokePoints(minDeaths = 2): HeatCell[] {
    return this.getHeatmap()
      .filter(c => c.deaths >= minDeaths)
      .sort((a, b) => b.deaths - a.deaths)
      .slice(0, 8);
  }

  /** Cells with almost no player presence */
  getUnusedAreas(): HeatCell[] {
    const all = this.getHeatmap();
    if (all.length === 0) return [];
    const maxVisit = Math.max(1, ...all.map(c => c.visits));
    const threshold = maxVisit * 0.08; // <8% of max is "unused"
    return all
      .filter(c => c.deaths === 0 && c.visits <= threshold)
      .sort((a, b) => a.visits - b.visits)
      .slice(0, 6);
  }

  /** Cells with highest sustained combat */
  getHotZones(): HeatCell[] {
    return this.getHeatmap()
      .filter(c => c.damage > 0)
      .sort((a, b) => b.damage - a.damage)
      .slice(0, 5);
  }

  // ── Aggregates ──────────────────────────────────────────────────────────────

  get totalDeaths(): number {
    let n = 0;
    for (const d of this.grid.values()) n += d.deaths;
    return n;
  }

  get totalVisitTicks(): number {
    let n = 0;
    for (const d of this.grid.values()) n += d.visits;
    return n;
  }

  get uniqueCellsVisited(): number {
    return Array.from(this.grid.values()).filter(c => c.visits > 0).length;
  }

  /** Coverage 0..1 — fraction of arena cells visited at least once */
  get explorationCoverage(): number {
    return this.uniqueCellsVisited / (GRID_DIM * GRID_DIM);
  }

  // ── Persistence ─────────────────────────────────────────────────────────────

  /** Merge cross-session analytics (additive) */
  merge(data: PersistedAnalytics): void {
    for (const c of data.cells) {
      const cell = this.get(c.cx, c.cz);
      cell.deaths  += c.deaths;
      cell.visits  += c.visits;
      cell.damage  += c.damage;
    }
  }

  serialize(): PersistedAnalytics {
    return {
      version: 1,
      cells: this.getHeatmap().map(({ cx, cz, deaths, visits, damage }) => ({
        cx, cz, deaths, visits, damage,
      })),
    };
  }
}

// ── localStorage helpers ──────────────────────────────────────────────────────

const ANALYTICS_KEY = "apex:mapAnalytics_v2";

export function saveAnalytics(data: PersistedAnalytics): void {
  try { localStorage.setItem(ANALYTICS_KEY, JSON.stringify(data)); } catch { /* quota */ }
}

export function loadAnalytics(): PersistedAnalytics | null {
  try {
    const raw = localStorage.getItem(ANALYTICS_KEY);
    return raw ? (JSON.parse(raw) as PersistedAnalytics) : null;
  } catch { return null; }
}
