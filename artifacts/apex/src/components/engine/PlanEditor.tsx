/**
 * Planning a mobile or computer game: the plan's sections, the checklist,
 * and the card that gets the Unity / Unreal project onto your computer.
 */
import { Plus, Trash2, Download, Check, Monitor, Smartphone } from "lucide-react";
import type { CameraStyle, GamePlan, GameProject } from "@/lib/engineApi";
import { engineLabel } from "@/lib/engineApi";

export type PlanSection = "overview" | "loop" | "controls" | "mechanics" | "levels" | "characters" | "art" | "checklist";

export const PLAN_SECTIONS: { id: PlanSection; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "loop", label: "Core loop" },
  { id: "controls", label: "Controls" },
  { id: "mechanics", label: "Mechanics" },
  { id: "levels", label: "Levels" },
  { id: "characters", label: "Characters" },
  { id: "art", label: "Art & sound" },
  { id: "checklist", label: "Checklist" },
];

const CAMERAS: CameraStyle[] = ["First person", "Third person", "Top-down", "Side view"];

export function PlanNav({ plan, section, onSelect }: { plan: GamePlan; section: PlanSection; onSelect: (s: PlanSection) => void }) {
  const done = plan.checklist.filter((c) => c.done).length;
  return (
    <div role="tablist" aria-label="Game plan" style={{ display: "grid", gap: 2 }}>
      {PLAN_SECTIONS.map((s) => {
        const on = s.id === section;
        return (
          <button key={s.id} role="tab" aria-selected={on} onClick={() => onSelect(s.id)} className="mg-focus"
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderRadius: 12, border: 0, cursor: "pointer", textAlign: "left", fontSize: 13.5, fontWeight: 600, background: on ? "rgba(139,123,255,0.28)" : "transparent", color: on ? "#fff" : "var(--mg-ink-2)" }}>
            {s.label}
            {s.id === "checklist" && <span style={{ fontSize: 12, color: "var(--mg-ink-3)" }}>{done}/{plan.checklist.length}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function PlanSectionEditor({ plan, section, onChange }: { plan: GamePlan; section: PlanSection; onChange: (p: GamePlan) => void }) {
  const set = (patch: Partial<GamePlan>) => onChange({ ...plan, ...patch });
  switch (section) {
    case "overview":
      return (
        <div style={stack}>
          <Field label="Pitch" hint="One or two sentences that sell the game.">
            <textarea value={plan.pitch} onChange={(e) => set({ pitch: e.target.value.slice(0, 1200) })} rows={4} style={area} />
          </Field>
          <Field label="Genre"><input value={plan.genre} onChange={(e) => set({ genre: e.target.value.slice(0, 80) })} style={box} /></Field>
          <Field label="Camera">
            <div role="radiogroup" aria-label="Camera" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {CAMERAS.map((c) => (
                <button key={c} role="radio" aria-checked={plan.camera === c} onClick={() => set({ camera: c })} className="mg-focus"
                  style={{ height: 32, padding: "0 12px", borderRadius: 16, fontSize: 12.5, fontWeight: 700, cursor: "pointer", color: plan.camera === c ? "#1C1640" : "var(--mg-ink-2)", background: plan.camera === c ? "#fff" : "rgba(255,255,255,0.08)", border: `1px solid ${plan.camera === c ? "#fff" : "rgba(255,255,255,0.16)"}` }}>
                  {c}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Platforms"><p style={{ margin: 0, fontSize: 13.5, color: "var(--mg-ink-2)" }}>{plan.platforms.join(", ")}</p></Field>
        </div>
      );
    case "loop":
      return (
        <div style={stack}>
          <Field label="Core loop" hint="What the player does again and again: the moment-to-moment fun.">
            <textarea value={plan.coreLoop} onChange={(e) => set({ coreLoop: e.target.value.slice(0, 1200) })} rows={6} style={area} />
          </Field>
        </div>
      );
    case "controls":
      return <ListField label="Controls" items={plan.controls} onChange={(controls) => set({ controls })} placeholder="e.g. Hold right trigger to aim" />;
    case "mechanics":
      return <ListField label="Mechanics" items={plan.mechanics} onChange={(mechanics) => set({ mechanics })} placeholder="e.g. Wall-running with a 2 second limit" />;
    case "levels":
      return <PairList label="Levels" a="Name" b="Goal" items={plan.levels.map((l) => [l.name, l.goal])} onChange={(v) => set({ levels: v.map(([name, goal]) => ({ name, goal })) })} />;
    case "characters":
      return <PairList label="Characters" a="Name" b="Role" items={plan.characters.map((c) => [c.name, c.role])} onChange={(v) => set({ characters: v.map(([name, role]) => ({ name, role })) })} />;
    case "art":
      return (
        <div style={stack}>
          <Field label="Art style"><textarea value={plan.artStyle} onChange={(e) => set({ artStyle: e.target.value.slice(0, 600) })} rows={3} style={area} /></Field>
          <Field label="Sound and music"><textarea value={plan.audio} onChange={(e) => set({ audio: e.target.value.slice(0, 600) })} rows={3} style={area} /></Field>
        </div>
      );
    case "checklist":
      return (
        <div style={stack}>
          <span style={labelStyle}>Checklist</span>
          <div role="list" style={{ display: "grid", gap: 6 }}>
            {plan.checklist.map((c, i) => (
              <button key={c.id} role="checkbox" aria-checked={c.done} onClick={() => set({ checklist: plan.checklist.map((x, j) => (j === i ? { ...x, done: !x.done } : x)) })} className="mg-focus"
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.12)", background: c.done ? "rgba(74,222,128,0.1)" : "rgba(255,255,255,0.05)", cursor: "pointer", textAlign: "left", color: c.done ? "var(--mg-ink-2)" : "var(--mg-ink)", fontSize: 13.5 }}>
                <span className={`mg-cc${c.done ? " on" : ""}`} style={{ width: 24, height: 24, color: c.done ? "#16a34a" : "#fff" }}>{c.done && <Check size={13} strokeWidth={3} />}</span>
                <span style={{ textDecoration: c.done ? "line-through" : "none" }}>{c.label}</span>
              </button>
            ))}
          </div>
        </div>
      );
  }
}

/** Where the project gets built: engine, steps, and the download (on a computer). */
export function BuildCard({ project, plan, onDownload, downloading, error, onEngine }: {
  project: GameProject;
  plan: GamePlan;
  onDownload: () => void;
  downloading: boolean;
  error: string | null;
  onEngine?: (e: "unity" | "unreal") => void;
}) {
  const done = plan.checklist.filter((c) => c.done).length;
  const pct = plan.checklist.length ? Math.round((done / plan.checklist.length) * 100) : 0;
  const engine = engineLabel(project.engine);
  const mobile = project.target === "mobile";
  const onPhone = typeof window !== "undefined" && window.matchMedia("(max-width: 820px)").matches;
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span className="mg-cc" style={{ width: 38, height: 38 }}>{mobile ? <Smartphone size={17} /> : <Monitor size={17} />}</span>
        <span style={{ display: "grid" }}>
          <span style={{ fontWeight: 700, fontSize: 14.5, color: "var(--mg-ink)" }}>{mobile ? "Mobile game" : "Computer game"} · {engine}</span>
          <span style={{ fontSize: 12, color: "var(--mg-ink-3)" }}>{plan.platforms.join(", ")}</span>
        </span>
      </div>
      {project.target === "pc" && onEngine && (
        <div role="radiogroup" aria-label="Game engine" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, padding: 4, borderRadius: 14, background: "rgba(255,255,255,0.06)" }}>
          {(["unreal", "unity"] as const).map((e) => (
            <button key={e} role="radio" aria-checked={project.engine === e} onClick={() => onEngine(e)} className="mg-focus"
              style={{ height: 30, borderRadius: 10, border: 0, fontSize: 12.5, fontWeight: 700, cursor: "pointer", color: project.engine === e ? "#1C1640" : "var(--mg-ink-2)", background: project.engine === e ? "#fff" : "transparent" }}>
              {engineLabel(e)}
            </button>
          ))}
        </div>
      )}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--mg-ink-2)", marginBottom: 5 }}>
          <span>Plan progress</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{done} of {plan.checklist.length}</span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.12)", overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg, #8B7BFF, #00C2FF)" }} />
        </div>
      </div>
      <button onClick={onDownload} disabled={downloading} className="mg-press mg-focus"
        style={{ height: 44, borderRadius: 22, border: 0, background: "#fff", color: "#1C1640", fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: downloading ? 0.7 : 1 }}>
        <Download size={16} /> {downloading ? "Making your project…" : `Download ${engine} project`}
      </button>
      {error && <p role="alert" style={{ margin: 0, fontSize: 12.5, color: "#FFB3CF" }}>{error}</p>}
      <p style={{ margin: 0, fontSize: 12.5, color: "var(--mg-ink-2)", lineHeight: 1.5 }}>
        {onPhone
          ? `Your plan is saved to your account. When you're at your computer, open Apex, go to Games → Create → this project, and download it there.`
          : `Unzip it and ${project.engine === "unity" ? "add it in Unity Hub" : "double-click the .uproject file"}. The README inside walks you through it${mobile ? ", including putting it on your phone" : ""}.`}
      </p>
    </div>
  );
}

const stack: React.CSSProperties = { display: "grid", gap: 14 };
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mg-ink-3)" };
const box: React.CSSProperties = { height: 38, borderRadius: 12, padding: "0 12px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", color: "var(--mg-ink)", fontSize: 14, fontFamily: "inherit", outline: "none", width: "100%", minWidth: 0 };
const area: React.CSSProperties = { ...box, height: "auto", padding: "10px 12px", resize: "vertical", lineHeight: 1.5 };

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={labelStyle}>{label}</span>
      {hint && <span style={{ fontSize: 12.5, color: "var(--mg-ink-3)", marginTop: -2 }}>{hint}</span>}
      {children}
    </label>
  );
}

function ListField({ label, items, onChange, placeholder }: { label: string; items: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  return (
    <div style={stack}>
      <span style={labelStyle}>{label}</span>
      {items.map((it, i) => (
        <div key={i} style={{ display: "flex", gap: 8 }}>
          <input value={it} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value.slice(0, 240) : x)))} aria-label={`${label} ${i + 1}`} style={box} />
          <button onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label={`Remove ${label.toLowerCase()} ${i + 1}`} className="mg-cc mg-focus" style={{ width: 38, height: 38 }}><Trash2 size={14} /></button>
        </div>
      ))}
      {items.length < 16 && (
        <button onClick={() => onChange([...items, ""])} className="mg-focus" style={addBtn}><Plus size={14} /> Add · {placeholder}</button>
      )}
    </div>
  );
}

function PairList({ label, a, b, items, onChange }: { label: string; a: string; b: string; items: [string, string][]; onChange: (v: [string, string][]) => void }) {
  return (
    <div style={stack}>
      <span style={labelStyle}>{label}</span>
      {items.map(([x, y], i) => (
        <div key={i} style={{ display: "grid", gap: 6, padding: 10, borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={x} placeholder={a} aria-label={`${a} ${i + 1}`} onChange={(e) => onChange(items.map((p, j) => (j === i ? [e.target.value.slice(0, 80), p[1]] : p)))} style={{ ...box, fontWeight: 700 }} />
            <button onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label={`Remove ${label.toLowerCase()} ${i + 1}`} className="mg-cc mg-focus" style={{ width: 38, height: 38 }}><Trash2 size={14} /></button>
          </div>
          <input value={y} placeholder={b} aria-label={`${b} ${i + 1}`} onChange={(e) => onChange(items.map((p, j) => (j === i ? [p[0], e.target.value.slice(0, 240)] : p)))} style={box} />
        </div>
      ))}
      {items.length < 16 && <button onClick={() => onChange([...items, ["", ""]])} className="mg-focus" style={addBtn}><Plus size={14} /> Add {label.toLowerCase().replace(/s$/, "")}</button>}
    </div>
  );
}

const addBtn: React.CSSProperties = { height: 36, borderRadius: 18, border: "1px dashed rgba(255,255,255,0.25)", background: "transparent", color: "var(--mg-ink-2)", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 };
