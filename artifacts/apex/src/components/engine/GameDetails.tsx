/**
 * Scene list (the parts of your game) and the Settings panel for whatever is selected.
 */
import { Globe, User, Skull, Square, Coins, Flag, Users, Minus, Plus, type LucideIcon } from "lucide-react";
import type { GameConfig, WinCondition } from "@/engine/types";
import type { GameSettings } from "@/lib/engineApi";
import { enemyCount, setEnemyCount, scaleEnemies } from "@/lib/quickEdits";

export type SceneItem = "world" | "player" | "enemies" | "platforms" | "coins" | "rules" | "multiplayer";

const is3D = (c: GameConfig) => c.gameMode === "fps" || c.gameMode === "openworld" || c.gameMode === "gta";

const MODE_NAMES: Record<string, string> = {
  fps: "3D shooter", openworld: "Open world", gta: "Open world", basketball: "Basketball",
  shooter: "Shooter", topdown: "Top-down", platformer: "Platformer",
};

export function sceneItems(c: GameConfig): { id: SceneItem; label: string; icon: LucideIcon; note?: string }[] {
  const items: { id: SceneItem; label: string; icon: LucideIcon; note?: string }[] = [
    { id: "world", label: "World", icon: Globe, note: MODE_NAMES[c.gameMode ?? "platformer"] },
    { id: "player", label: "Player", icon: User },
    { id: "enemies", label: "Enemies", icon: Skull, note: String(enemyCount(c)) },
  ];
  if (!is3D(c)) items.push({ id: "platforms", label: "Platforms", icon: Square, note: String(c.platforms.length) });
  if ((c.coins?.length ?? 0) > 0) items.push({ id: "coins", label: "Coins", icon: Coins, note: String(c.coins!.length) });
  items.push({ id: "rules", label: "Rules", icon: Flag }, { id: "multiplayer", label: "Multiplayer", icon: Users });
  return items;
}

export function SceneOutline({ config, selected, onSelect }: { config: GameConfig; selected: SceneItem; onSelect: (s: SceneItem) => void }) {
  return (
    <div role="listbox" aria-label="Parts of your game" style={{ display: "grid", gap: 2 }}>
      {sceneItems(config).map(({ id, label, icon: Icon, note }) => {
        const on = id === selected;
        return (
          <button key={id} role="option" aria-selected={on} onClick={() => onSelect(id)} className="mg-focus"
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 12, border: 0, cursor: "pointer", textAlign: "left", fontSize: 13.5, fontWeight: 600, background: on ? "rgba(139,123,255,0.28)" : "transparent", color: on ? "#fff" : "var(--mg-ink-2)" }}>
            <Icon size={15} strokeWidth={2.2} />
            <span style={{ flex: 1 }}>{label}</span>
            {note && <span style={{ fontSize: 12, color: "var(--mg-ink-3)" }}>{note}</span>}
          </button>
        );
      })}
    </div>
  );
}

const WIN_LABELS: Record<WinCondition, string> = {
  reach_end: "Reach the end", collect_all: "Collect every coin", defeat_all: "Defeat every enemy", survive: "Survive the timer", score_limit: "Reach the score",
};

export function DetailsPanel({ config, selected, onChange, settings, onSettings, onTestWithFriends }: {
  config: GameConfig;
  selected: SceneItem;
  onChange: (c: GameConfig) => void;
  settings: GameSettings;
  onSettings: (s: GameSettings) => void;
  onTestWithFriends: () => void;
}) {
  const set = (patch: Partial<GameConfig>) => onChange({ ...config, ...patch });
  const setPlayer = (patch: Partial<GameConfig["player"]>) => onChange({ ...config, player: { ...config.player, ...patch } });
  const firstEnemy = config.worldConfig?.enemies?.[0] ?? config.enemies[0];
  const threeD = is3D(config);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {selected === "world" && (
        <>
          <Heading title="World" note={MODE_NAMES[config.gameMode ?? "platformer"]} />
          <Text label="Name" value={config.name} onChange={(v) => set({ name: v.slice(0, 60) })} />
          {!threeD && <ColorRow label="Background" value={config.background ?? "#0d0b22"} onChange={(v) => set({ background: v })} />}
          {!threeD && config.gameMode !== "topdown" && (
            <Slider label="Gravity" value={config.gravity} min={0} max={1.5} step={0.05} format={(v) => v.toFixed(2)} onChange={(v) => set({ gravity: v })} />
          )}
          {threeD && config.worldConfig && (
            <ColorRow label="Sky" value={config.worldConfig.world.skyColor ?? "#2b1d6e"} onChange={(v) => onChange({ ...config, worldConfig: { ...config.worldConfig!, world: { ...config.worldConfig!.world, skyColor: v } } })} />
          )}
        </>
      )}

      {selected === "player" && (
        <>
          <Heading title="Player" />
          <Slider label="Speed" value={config.player.speed} min={1} max={14} step={0.5} format={(v) => v.toFixed(1)} onChange={(v) => setPlayer({ speed: v })} />
          {!threeD && config.gameMode !== "topdown" && (
            <Slider label="Jump" value={config.player.jumpForce} min={0} max={22} step={0.5} format={(v) => v.toFixed(1)} onChange={(v) => setPlayer({ jumpForce: v })} />
          )}
          {(config.health !== undefined || threeD || config.gameMode === "shooter" || config.gameMode === "topdown") && (
            <Slider label="Health" value={config.health ?? 100} min={10} max={300} step={10} format={(v) => String(v)} onChange={(v) => set({ health: v })} />
          )}
          {!threeD && <ColorRow label="Color" value={toHex(config.player.color)} onChange={(v) => setPlayer({ color: v })} />}
        </>
      )}

      {selected === "enemies" && (
        <>
          <Heading title="Enemies" />
          <Stepper label="How many" value={enemyCount(config)} min={1} max={30} onChange={(n) => onChange(setEnemyCount(config, n))} />
          {firstEnemy && (
            <Slider label="Speed" value={firstEnemy.speed ?? 2} min={0.5} max={threeD ? 10 : 6} step={0.1} format={(v) => v.toFixed(1)}
              onChange={(v) => onChange(scaleEnemies(config, v / Math.max(0.1, firstEnemy.speed ?? 2)))} />
          )}
          {firstEnemy?.hp !== undefined && (
            <Slider label="Health" value={firstEnemy.hp} min={1} max={threeD ? 400 : 10} step={1} format={(v) => String(v)}
              onChange={(v) => onChange(scaleEnemies(config, 1, v / Math.max(1, firstEnemy.hp ?? 1)))} />
          )}
        </>
      )}

      {selected === "platforms" && (
        <>
          <Heading title="Platforms" note={`${config.platforms.length}`} />
          <p style={hint}>Ask the AI helper to add, move or reshape platforms, or tap "New map" for a fresh layout.</p>
        </>
      )}

      {selected === "coins" && (
        <>
          <Heading title="Coins" note={`${config.coins?.length ?? 0}`} />
          <p style={hint}>Coins count toward the goal when the rule is "Collect every coin".</p>
        </>
      )}

      {selected === "rules" && (
        <>
          <Heading title="Rules" />
          <label style={row}>
            <span style={lbl}>Win when</span>
            <select value={config.winCondition} onChange={(e) => set({ winCondition: e.target.value as WinCondition })} style={input}>
              {(Object.keys(WIN_LABELS) as WinCondition[]).map((w) => <option key={w} value={w}>{WIN_LABELS[w]}</option>)}
            </select>
          </label>
          {config.winCondition === "survive" && (
            <Slider label="Seconds" value={config.surviveSecs ?? 30} min={10} max={300} step={5} format={(v) => `${v}s`} onChange={(v) => set({ surviveSecs: v })} />
          )}
          {config.winCondition === "score_limit" && (
            <Slider label="Score" value={config.scoreLimit ?? 10} min={1} max={100} step={1} format={(v) => String(v)} onChange={(v) => set({ scoreLimit: v })} />
          )}
        </>
      )}

      {selected === "multiplayer" && (
        <>
          <Heading title="Multiplayer" />
          <label style={{ ...row, cursor: "pointer" }}>
            <span style={lbl}>Play with friends</span>
            <button role="switch" aria-checked={!!settings.multiplayer} onClick={() => onSettings({ ...settings, multiplayer: !settings.multiplayer })} className="mg-focus"
              style={{ width: 46, height: 26, borderRadius: 13, border: 0, cursor: "pointer", position: "relative", background: settings.multiplayer ? "#4ADE80" : "rgba(255,255,255,0.18)" }}>
              <span style={{ position: "absolute", top: 3, left: settings.multiplayer ? 23 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
            </button>
          </label>
          {settings.multiplayer && (
            <Stepper label="Max players" value={settings.maxPlayers ?? 8} min={2} max={16} onChange={(n) => onSettings({ ...settings, maxPlayers: n })} />
          )}
          <button onClick={onTestWithFriends} className="mg-press mg-focus" style={{ height: 40, borderRadius: 20, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.08)", color: "var(--mg-ink)", fontWeight: 700, fontSize: 13.5, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Users size={16} /> Test with friends
          </button>
        </>
      )}
    </div>
  );
}

const hint: React.CSSProperties = { margin: 0, fontSize: 12.5, color: "var(--mg-ink-3)", lineHeight: 1.45 };
const row: React.CSSProperties = { display: "grid", gridTemplateColumns: "96px minmax(0, 1fr)", alignItems: "center", gap: 10 };
const lbl: React.CSSProperties = { fontSize: 12.5, color: "var(--mg-ink-3)" };
const input: React.CSSProperties = { height: 34, borderRadius: 10, padding: "0 10px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.14)", color: "var(--mg-ink)", fontSize: 13, fontFamily: "inherit", minWidth: 0 };

const NAMED: Record<string, string> = { red: "#ff4d6d", orange: "#ff9f43", blue: "#4dabff", cyan: "#22d3ee", green: "#4ade80", purple: "#a78bfa", gold: "#ffd166" };
const toHex = (c: string) => (c.startsWith("#") && c.length === 7 ? c : NAMED[c] ?? "#4ade80");

function Heading({ title, note }: { title: string; note?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <span style={{ fontWeight: 700, fontSize: 14.5, color: "var(--mg-ink)" }}>{title}</span>
      {note && <span style={{ fontSize: 12, color: "var(--mg-ink-3)" }}>{note}</span>}
    </div>
  );
}

function Text({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={row}>
      <span style={lbl}>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} style={input} />
    </label>
  );
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={row}>
      <span style={lbl}>{label}</span>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} style={{ ...input, padding: 2, width: 64, cursor: "pointer" }} />
    </label>
  );
}

function Slider({ label, value, min, max, step, format, onChange }: { label: string; value: number; min: number; max: number; step: number; format: (v: number) => string; onChange: (v: number) => void }) {
  return (
    <label style={row}>
      <span style={lbl}>{label}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <input type="range" min={min} max={max} step={step} value={Math.min(max, Math.max(min, value))} onChange={(e) => onChange(Number(e.target.value))} style={{ flex: 1, minWidth: 0, accentColor: "#8B7BFF" }} />
        <span style={{ width: 44, textAlign: "right", fontSize: 12.5, fontVariantNumeric: "tabular-nums", color: "var(--mg-ink)" }}>{format(value)}</span>
      </span>
    </label>
  );
}

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  const btn: React.CSSProperties = { width: 32, height: 32 };
  return (
    <div style={row}>
      <span style={lbl}>{label}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={() => onChange(Math.max(min, value - 1))} aria-label={`Fewer: ${label}`} className="mg-cc mg-focus" style={btn}><Minus size={14} /></button>
        <span style={{ minWidth: 24, textAlign: "center", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "var(--mg-ink)" }}>{value}</span>
        <button onClick={() => onChange(Math.min(max, value + 1))} aria-label={`More: ${label}`} className="mg-cc mg-focus" style={btn}><Plus size={14} /></button>
      </span>
    </div>
  );
}
