/**
 * Apex Engine — start screen. Describe a game or pick a template, choose what you're making
 * (a quick game that plays right away, a mobile game, or a computer game), and open it in the editor.
 * Mobile and computer games are planned here and built in Unity or Unreal on a computer.
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Crosshair, LayoutGrid, Footprints, Dribbble, Building2, Waves, Sparkles, ChevronRight, Smartphone, Monitor, Zap, type LucideIcon } from "lucide-react";
import { generateGameFromPrompt } from "@/engine/demoGames";
import { consumeEditorGame } from "@/data/gameRegistry";
import { getAuthSessionId } from "@/lib/authSession";
import { engineApi, engineLabel, TARGETS, TEMPLATES, type Engine, type Target, type Template } from "@/lib/engineApi";

const TEMPLATE_ICONS: Record<Template, LucideIcon> = {
  fps: Crosshair, topdown: LayoutGrid, platformer: Footprints, sports: Dribbble, openworld: Building2, survival: Waves,
};
const TARGET_ICONS: Record<Target, LucideIcon> = { apex: Zap, mobile: Smartphone, pc: Monitor };

const CREATE_LABEL: Record<Target, string> = {
  apex: "Create with AI",
  mobile: "Plan my mobile game",
  pc: "Plan my computer game",
};

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

export default function EngineLauncherPage() {
  const [, nav] = useLocation();
  const signedIn = !!getAuthSessionId();
  const [prompt, setPrompt] = useState("");
  const [target, setTarget] = useState<Target>("apex");
  const [pcEngine, setPcEngine] = useState<Engine>("unreal");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const projects = useQuery({ queryKey: ["engine-projects"], queryFn: engineApi.list, enabled: signedIn });

  const create = async (template?: Template) => {
    if (!signedIn) { nav("/login"); return; }
    const t = TEMPLATES.find((x) => x.id === template);
    const text = prompt.trim() || t?.prompt || "";
    if (!text) { setError("Describe your game or pick a template."); return; }
    setError(null);
    setBusy(target === "apex" ? "Building your game…" : "Writing your game plan…");
    try {
      // Every game gets a playable Apex version: the game itself, or a quick prototype of a Unity/Unreal game
      const config = generateGameFromPrompt(t && prompt.trim() ? `${t.prompt}: ${prompt}` : text);
      const { project } = await engineApi.create({ prompt: text, target, engine: target === "pc" ? pcEngine : undefined, template, config });
      nav(`/game-engine/${project.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the game. Try again.");
      setBusy(null);
    }
  };

  // "Edit" from the You tab or a Remix from the feed arrives here as a queued game
  useEffect(() => {
    const game = consumeEditorGame();
    if (!game || !signedIn) return;
    setBusy("Opening your game…");
    engineApi.create({ target: "apex", title: game.name, config: game, prompt: game.name })
      .then(({ project }) => nav(`/game-engine/${project.id}`))
      .catch((e) => { setError(e instanceof Error ? e.message : "Couldn't open that game."); setBusy(null); });
  }, [signedIn, nav]);

  const selected = TARGETS.find((x) => x.id === target)!;

  return (
    <div className="mg-font" style={{ flex: 1, overflowY: "auto", padding: "0 16px 40px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
        <header>
          <h1 className="mg-display" style={{ margin: 0, fontSize: 28, fontWeight: 700, color: "var(--mg-ink)" }}>Apex Engine</h1>
          <p style={{ margin: "2px 0 0", fontSize: 13.5, color: "var(--mg-ink-2)" }}>Make a game you can play now, or plan a big one on your phone and build it on your computer.</p>
        </header>

        {/* New game */}
        <section className="mg-cc-card" style={{ padding: 16, display: "grid", gap: 14, borderRadius: 28, borderWidth: 1, background: "radial-gradient(90% 70% at 20% 0%, rgba(139,123,255,0.4), transparent 70%), linear-gradient(160deg, rgba(139,123,255,0.26), rgba(0,194,255,0.1))" }}>
          <textarea
            id="engine-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="A rooftop shooter at night with drones and a jetpack…"
            aria-label="Describe your game"
            style={{ width: "100%", resize: "none", borderRadius: 18, padding: "12px 14px", background: "rgba(10,9,24,0.4)", border: "1px solid rgba(255,255,255,0.14)", color: "var(--mg-ink)", fontSize: 15, lineHeight: 1.5, outline: "none", fontFamily: "inherit" }}
          />

          <div style={{ display: "grid", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "var(--mg-ink-2)" }}>WHAT ARE YOU MAKING?</span>
            <div role="radiogroup" aria-label="What are you making?" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6, padding: 4, borderRadius: 20, background: "rgba(10,9,24,0.4)" }}>
              {TARGETS.map((t) => {
                const on = t.id === target;
                const Icon = TARGET_ICONS[t.id];
                return (
                  <button key={t.id} role="radio" aria-checked={on} onClick={() => setTarget(t.id)} className="mg-focus"
                    style={{ minHeight: 44, borderRadius: 16, border: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 13, fontWeight: 700, padding: "6px 8px", color: on ? "#1C1640" : "var(--mg-ink-2)", background: on ? "#fff" : "transparent" }}>
                    <Icon size={15} strokeWidth={2.4} /> {t.label}
                  </button>
                );
              })}
            </div>
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--mg-ink-2)", lineHeight: 1.45 }}>
              {selected.sub}.{" "}
              {target === "apex" ? "Press Play to test it and publish it to Apex Games."
                : target === "mobile" ? "Plan it here, try a quick prototype, then download a Unity project on your computer and put it on your phone."
                : "Plan it here on the go, try a quick prototype, then download the project when you're back at your computer."}
            </p>
            {target === "pc" && (
              <div role="radiogroup" aria-label="Game engine" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {(["unreal", "unity"] as Engine[]).map((e) => {
                  const on = e === pcEngine;
                  return (
                    <button key={e} role="radio" aria-checked={on} onClick={() => setPcEngine(e)} className="mg-focus"
                      style={{ height: 34, padding: "0 14px", borderRadius: 17, cursor: "pointer", fontSize: 13, fontWeight: 700, color: on ? "#1C1640" : "var(--mg-ink-2)", background: on ? "#fff" : "rgba(255,255,255,0.08)", border: `1px solid ${on ? "#fff" : "rgba(255,255,255,0.16)"}` }}>
                      {engineLabel(e)}
                    </button>
                  );
                })}
                <span style={{ fontSize: 12, color: "var(--mg-ink-3)" }}>{pcEngine === "unreal" ? "Best graphics. Needs a strong PC." : "Easier to start. Runs on most computers."}</span>
              </div>
            )}
          </div>

          <button onClick={() => create()} disabled={!!busy} className="mg-press mg-focus"
            style={{ height: 48, borderRadius: 24, border: 0, cursor: busy ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 15, fontWeight: 700, color: "#fff", background: "linear-gradient(135deg, #7C6CFF, #3BA8FF)", boxShadow: "0 10px 26px rgba(108,92,231,0.45)", opacity: busy ? 0.7 : 1 }}>
            <Sparkles size={17} /> {busy ?? CREATE_LABEL[target]}
          </button>
          {error && <p role="alert" style={{ margin: 0, fontSize: 13, color: "#FFB3CF" }}>{error}</p>}
          {!signedIn && <p style={{ margin: 0, fontSize: 12.5, color: "var(--mg-ink-2)" }}>Sign in to save your games to your account so you can pick them up on any device.</p>}
        </section>

        {/* Templates */}
        <section style={{ display: "grid", gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "var(--mg-ink-3)" }}>OR START FROM A TEMPLATE</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: "14px 8px" }}>
            {TEMPLATES.map((t) => {
              const Icon = TEMPLATE_ICONS[t.id];
              return (
                <button key={t.id} onClick={() => create(t.id)} disabled={!!busy} className="mg-bubble mg-focus" aria-label={`Start a ${t.label} ${target === "apex" ? "game" : TARGETS.find((x) => x.id === target)!.label.toLowerCase()}`}
                  style={{ display: "grid", justifyItems: "center", gap: 7, background: "none", border: 0, cursor: "pointer", padding: 0 }}>
                  <span className="mg-cc" style={{ width: 60, height: 60 }}><Icon size={24} strokeWidth={2.2} /></span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--mg-ink-2)" }}>{t.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Projects */}
        {signedIn && (
          <section style={{ display: "grid", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "var(--mg-ink-3)" }}>YOUR PROJECTS</span>
            {projects.isLoading ? (
              <div className="mg-cc-card" style={{ height: 64, borderWidth: 1, opacity: 0.6 }} />
            ) : projects.isError ? (
              <p style={{ margin: 0, fontSize: 13, color: "var(--mg-ink-3)" }}>Couldn't load your projects. Try again in a moment.</p>
            ) : (projects.data?.length ?? 0) === 0 ? (
              <p style={{ margin: 0, fontSize: 13.5, color: "var(--mg-ink-3)" }}>Nothing yet. Your games show up here on every device you sign in on.</p>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {projects.data!.map((p) => {
                  const Icon = TARGET_ICONS[p.target];
                  const planned = p.target !== "apex";
                  return (
                    <button key={p.id} onClick={() => nav(`/game-engine/${p.id}`)} className="mg-press mg-focus mg-cc-card"
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 22, borderWidth: 1, cursor: "pointer", textAlign: "left", color: "var(--mg-ink)" }}>
                      <span className="mg-cc" style={{ width: 42, height: 42 }}><Icon size={18} strokeWidth={2.2} /></span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 14.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.title}</span>
                        <span style={{ fontSize: 12, color: "var(--mg-ink-3)" }}>
                          {planned ? `${engineLabel(p.engine)} · ${p.progress.done} of ${p.progress.total} steps` : "Quick game"} · {timeAgo(p.updatedAt)}
                        </span>
                      </span>
                      <ChevronRight size={16} style={{ color: "var(--mg-ink-3)" }} />
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
