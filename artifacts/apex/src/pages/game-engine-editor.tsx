/**
 * Apex Engine editor.
 * Quick games: the parts of the game on the left, the view in the middle (Play runs it right there),
 * settings on the right, and the AI helper at the bottom.
 * Mobile and computer games: the game plan, a quick prototype, and the Unity / Unreal project download.
 * On phones the view sits on top with a sheet below that switches between panels.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Play, Square, Upload, MoreHorizontal, Trash2 } from "lucide-react";
import { useEngine } from "@/engine/EngineContext";
import type { GameConfig } from "@/engine/types";
import { useAuth } from "@/contexts/AuthContext";
import { generateGameFromPrompt } from "@/engine/demoGames";
import { engineApi, engineLabel, TARGETS, TEMPLATES, type GamePlan, type GameProject, type GameSettings, type Target } from "@/lib/engineApi";
import { quickEdit } from "@/lib/quickEdits";
import { Viewport } from "@/components/engine/Viewport";
import { AIHelper, type HelperMessage } from "@/components/engine/AIHelper";
import { SceneOutline, DetailsPanel, type SceneItem } from "@/components/engine/GameDetails";
import { PlanNav, PlanSectionEditor, BuildCard, PLAN_SECTIONS, type PlanSection } from "@/components/engine/PlanEditor";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function useWide() {
  const q = "(min-width: 1024px)";
  const [wide, setWide] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setWide(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return wide;
}

const GAME_CHIPS = ["Make it harder", "Make it easier", "More enemies", "Faster player", "New map"];
const PLAN_CHIPS = ["Add a boss fight", "Make it co-op", "Simplify it for a solo developer", "Add a second level", "Suggest a monetization plan"];

export default function EngineEditorPage({ id }: { id: number }) {
  const [, nav] = useLocation();
  const qc = useQueryClient();
  const wide = useWide();
  const { user } = useAuth();
  const { sendToEngine, stopGame } = useEngine();

  const query = useQuery({ queryKey: ["engine-project", id], queryFn: () => engineApi.get(id), enabled: Number.isInteger(id), retry: 1 });
  const [project, setProject] = useState<GameProject | null>(null);
  const [saved, setSaved] = useState<"saved" | "saving" | "error">("saved");
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState<SceneItem>("player");
  const [section, setSection] = useState<PlanSection>("overview");
  const [sheet, setSheet] = useState<"scene" | "settings" | "ai" | "plan" | "build">("ai");
  const [messages, setMessages] = useState<HelperMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const pending = useRef<Partial<GameProject>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!query.data || project) return;
    const p = query.data.project;
    setProject(p);
    // Games started in the phone app have no playable version yet; make one here
    if (!p.config) {
      const idea = p.prompt || TEMPLATES.find((t) => t.id === p.template)?.prompt || p.title;
      const config = generateGameFromPrompt(idea);
      pending.current = { ...pending.current, config };
      setProject({ ...p, config });
      timer.current = setTimeout(() => void flush(), 0);
    }
  }, [query.data, project]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (project) setSheet(project.target === "apex" ? "ai" : "plan"); }, [project?.target]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { stopGame(); }, [stopGame]);

  const flush = useCallback(async () => {
    const body = pending.current;
    pending.current = {};
    if (!Object.keys(body).length) return;
    setSaved("saving");
    try {
      const next = await engineApi.update(id, body);
      // Server may adjust the plan (e.g. the checklist when the target changes)
      if (body.target || body.engine) setProject(next);
      setSaved("saved");
      void qc.invalidateQueries({ queryKey: ["engine-projects"] });
    } catch {
      setSaved("error");
    }
  }, [id, qc]);

  // Save on the way out
  useEffect(() => () => { clearTimeout(timer.current); void flush(); }, [flush]);

  const change = (patch: Partial<Pick<GameProject, "title" | "config" | "plan" | "settings" | "target" | "engine">>, immediate = false) => {
    setProject((p) => (p ? { ...p, ...patch } : p));
    pending.current = { ...pending.current, ...patch };
    setSaved("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), immediate ? 0 : 800);
  };

  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(null), 2800); };

  const play = () => {
    if (!project?.config) return;
    sendToEngine(project.config);
    setPlaying(true);
  };
  const stop = () => { stopGame(); setPlaying(false); };

  const setConfig = (config: GameConfig) => {
    change({ config });
    if (playing) sendToEngine(config);
  };

  const ask = async (text: string) => {
    if (!project) return;
    setMessages((m) => [...m, { from: "me", text }]);
    setBusy(true);
    try {
      if (project.target === "apex") {
        const quick = project.config ? quickEdit(project.config, text) : null;
        if (quick) {
          setConfig(quick.config);
          setMessages((m) => [...m, { from: "ai", text: `${quick.reply} Press Play to try it.` }]);
          return;
        }
        await flush();
        const r = await engineApi.askGame(project.id, text);
        setProject(r.project);
        if (playing && r.project.config) sendToEngine(r.project.config);
        setMessages((m) => [...m, { from: "ai", text: r.reply }]);
      } else {
        await flush();
        const r = await engineApi.askPlan(project.id, text);
        setProject(r.project);
        setMessages((m) => [...m, { from: "ai", text: r.reply }]);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong. Try again.";
      const hint = project.target === "apex" && /isn't connected/.test(msg) ? ` Until then, try: ${GAME_CHIPS.join(", ")}.` : "";
      setMessages((m) => [...m, { from: "ai", text: msg + hint, error: true }]);
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!project?.config) return;
    try {
      let feedSession = "anon";
      try { feedSession = localStorage.getItem("apex-session-id") ?? "anon"; } catch { /* private mode */ }
      const res = await fetch(`${BASE}/api/game-feed/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-session-id": feedSession },
        body: JSON.stringify({ name: project.title, creatorName: user?.username ?? "Creator", createdBy: "user", gameConfig: { ...project.config, name: project.title }, tags: [project.config.gameMode ?? "platformer"], remixable: true }),
      });
      if (!res.ok) throw new Error();
      void qc.invalidateQueries({ queryKey: ["game-feed-web"] });
      flash("Published to Apex Games");
    } catch {
      flash("Couldn't publish. Try again.");
    }
  };

  const download = async () => {
    if (!project) return;
    setDownloadError(null);
    setDownloading(true);
    try {
      await flush();
      await engineApi.download(project.id, project.title, project.engine);
      const plan = project.plan;
      if (plan && plan.checklist.some((c) => c.id === "download" && !c.done)) {
        change({ plan: { ...plan, checklist: plan.checklist.map((c) => (c.id === "download" ? { ...c, done: true } : c)) } });
      }
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : "Couldn't make the project.");
    } finally {
      setDownloading(false);
    }
  };

  const remove = async () => {
    try {
      await engineApi.remove(id);
      void qc.invalidateQueries({ queryKey: ["engine-projects"] });
      nav("/game-engine");
    } catch {
      flash("Couldn't delete. Try again.");
    }
  };

  if (query.isError) {
    return (
      <Shell>
        <div style={{ margin: "auto", textAlign: "center", display: "grid", gap: 12, padding: 24 }}>
          <p style={{ margin: 0, color: "var(--mg-ink-2)" }}>{query.error instanceof Error ? query.error.message : "Couldn't open this game."}</p>
          <button onClick={() => nav("/game-engine")} className="mg-cc on mg-focus" style={{ height: 40, width: "auto", borderRadius: 20, padding: "0 16px", fontWeight: 700 }}>Back to the Engine</button>
        </div>
      </Shell>
    );
  }
  if (!project) return <Shell><div style={{ margin: "auto", color: "var(--mg-ink-3)" }}>Opening your game…</div></Shell>;

  const isPlan = project.target !== "apex";
  const plan = project.plan;
  const settings: GameSettings = project.settings ?? {};
  const targetSwitch = (t: Target) => { if (t !== project.target) { stop(); change({ target: t }, true); } };

  const toolbar = (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: wide ? "10px 14px" : "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(18,16,39,0.92)", flexWrap: wide ? "wrap" : "nowrap", paddingTop: wide ? 10 : "calc(10px + env(safe-area-inset-top, 0px))", position: "relative", zIndex: 20 }}>
      <button onClick={() => nav("/game-engine")} aria-label="Back to the Engine" className="mg-cc mg-focus" style={{ width: 36, height: 36 }}><ChevronLeft size={18} strokeWidth={2.4} /></button>
      <input value={project.title} onChange={(e) => change({ title: e.target.value.slice(0, 80) || "Untitled game" })} aria-label="Game name"
        className="mg-display" style={{ flex: wide ? "1 1 140px" : "1 1 0", minWidth: 0, background: "none", border: 0, outline: "none", color: "var(--mg-ink)", fontSize: 16, fontWeight: 700, fontFamily: "inherit" }} />
      <span aria-live="polite" title={saved === "saving" ? "Saving" : saved === "error" ? "Not saved" : "Saved"} style={{ fontSize: 11.5, color: saved === "error" ? "#FFB3CF" : "var(--mg-ink-3)", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 5 }}>
        {!wide && <span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", background: saved === "error" ? "#FF4FA3" : saved === "saving" ? "#FFD166" : "#4ADE80" }} />}
        {wide ? (saved === "saving" ? "Saving…" : saved === "error" ? "Not saved" : "Saved") : <span className="sr-only">{saved === "saving" ? "Saving" : saved === "error" ? "Not saved" : "Saved"}</span>}
      </span>
      {wide && (
        <div role="radiogroup" aria-label="What you're making" style={{ display: "inline-flex", padding: 3, gap: 2, borderRadius: 16, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}>
          {TARGETS.map((t) => (
            <button key={t.id} role="radio" aria-checked={project.target === t.id} onClick={() => targetSwitch(t.id)} className="mg-focus"
              style={{ height: 26, padding: "0 11px", borderRadius: 13, border: 0, fontSize: 12, fontWeight: 700, cursor: "pointer", color: project.target === t.id ? "#1C1640" : "var(--mg-ink-3)", background: project.target === t.id ? "#fff" : "transparent" }}>
              {t.label}
            </button>
          ))}
        </div>
      )}
      {project.config && (
        <button onClick={playing ? stop : play} className="mg-press mg-focus"
          style={{ height: 34, padding: "0 14px", borderRadius: 17, border: 0, fontWeight: 800, fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, background: playing ? "#FF4FA3" : "#4ADE80", color: playing ? "#fff" : "#06210F" }}>
          {playing ? <><Square size={13} fill="currentColor" /> Stop</> : <><Play size={13} fill="currentColor" /> {isPlan ? (wide ? "Prototype" : "Try") : "Play"}</>}
        </button>
      )}
      {!isPlan && (
        <button onClick={publish} aria-label="Publish to Apex Games" className="mg-press mg-focus" style={{ height: 34, padding: wide ? "0 14px" : "0 10px", borderRadius: 17, border: 0, background: "#fff", color: "#1C1640", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Upload size={14} /> {wide ? "Publish" : ""}
        </button>
      )}
      <div style={{ position: "relative" }}>
        <button onClick={() => { setMenu((v) => !v); setConfirmDelete(false); }} aria-label="More" aria-expanded={menu} className="mg-cc mg-focus" style={{ width: 34, height: 34 }}><MoreHorizontal size={16} /></button>
        {menu && (
          <div role="menu" style={{ position: "absolute", right: 0, top: 40, width: 230, padding: 8, borderRadius: 16, background: "rgba(28,24,62,0.97)", border: "1px solid rgba(255,255,255,0.16)", display: "grid", gap: 4, zIndex: 30 }}>
            {!wide && TARGETS.map((t) => (
              <button key={t.id} role="menuitemradio" aria-checked={project.target === t.id} onClick={() => { targetSwitch(t.id); setMenu(false); }} style={menuItem(project.target === t.id)}>Make it a {t.label.toLowerCase()}</button>
            ))}
            {confirmDelete ? (
              <button role="menuitem" onClick={remove} style={{ ...menuItem(false), color: "#FF7A9C", fontWeight: 700 }}><Trash2 size={14} /> Yes, delete it</button>
            ) : (
              <button role="menuitem" onClick={() => setConfirmDelete(true)} style={{ ...menuItem(false), color: "#FF7A9C" }}><Trash2 size={14} /> Delete game</button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const helper = (fill = false) => (
    <AIHelper messages={messages} busy={busy} fill={fill}
      chips={isPlan ? PLAN_CHIPS : GAME_CHIPS}
      placeholder={isPlan ? "Ask the AI to change your plan…" : "Ask the AI to change your game…"}
      onSend={ask} />
  );

  const details = project.config && (
    <DetailsPanel config={project.config} selected={selected} onChange={setConfig} settings={settings}
      onSettings={(s) => change({ settings: s })} onTestWithFriends={() => nav("/multiplayer")} />
  );

  const buildCard = plan && (
    <BuildCard project={project} plan={plan} onDownload={download} downloading={downloading} error={downloadError}
      onEngine={(e) => { if (e !== project.engine) change({ engine: e }, true); }} />
  );

  // ── Computer layout ─────────────────────────────────────────────────────────
  if (wide) {
    return (
      <Shell>
        {toolbar}
        <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: isPlan ? "220px minmax(0, 1fr) 320px" : "220px minmax(0, 1fr) 300px" }}>
          <aside style={side("right")}>
            <span style={cap}>{isPlan ? "Game plan" : "Scene"}</span>
            {isPlan && plan ? <PlanNav plan={plan} section={section} onSelect={setSection} /> : project.config && <SceneOutline config={project.config} selected={selected} onSelect={setSelected} />}
          </aside>
          <main style={{ display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0 }}>
            {isPlan && plan ? (
              playing ? (
                <Viewport config={project.config} playing onPlay={play} onStop={stop} />
              ) : (
                <div style={{ flex: 1, overflowY: "auto", padding: "22px 28px" }}>
                  <div style={{ maxWidth: 680, margin: "0 auto" }}>
                    <PlanSectionEditor plan={plan} section={section} onChange={(p: GamePlan) => change({ plan: p })} />
                  </div>
                </div>
              )
            ) : (
              <div style={{ flex: 1, minHeight: 0 }}><Viewport config={project.config} playing={playing} onPlay={play} onStop={stop} /></div>
            )}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", padding: "10px 14px", background: "rgba(18,16,39,0.92)" }}>{helper()}</div>
          </main>
          <aside style={side("left")}>
            <span style={cap}>{isPlan ? "Get it running" : "Settings"}</span>
            {isPlan ? buildCard : details}
          </aside>
        </div>
        {toast && <Toast text={toast} />}
      </Shell>
    );
  }

  // ── Phone layout ────────────────────────────────────────────────────────────
  const tabs: { id: typeof sheet; label: string }[] = isPlan
    ? [{ id: "plan", label: "Plan" }, { id: "ai", label: "AI" }, { id: "build", label: "Build" }]
    : [{ id: "scene", label: "Scene" }, { id: "settings", label: "Settings" }, { id: "ai", label: "AI" }];

  return (
    <Shell>
      {toolbar}
      {(!isPlan || playing) && (
        <div style={{ height: playing ? "62dvh" : "38dvh", flexShrink: 0, transition: "height .25s" }}>
          <Viewport config={project.config} playing={playing} onPlay={play} onStop={stop} />
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 10, padding: "10px 12px 12px", borderRadius: isPlan && !playing ? 0 : "24px 24px 0 0", marginTop: isPlan && !playing ? 0 : -16, position: "relative", zIndex: 5, background: "#14122C", borderTop: "1px solid rgba(255,255,255,0.12)" }}>
        {!(isPlan && !playing) && <span aria-hidden style={{ width: 38, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.3)", alignSelf: "center" }} />}
        <div role="tablist" style={{ display: "grid", gridTemplateColumns: `repeat(${tabs.length}, 1fr)`, gap: 4, padding: 4, borderRadius: 16, background: "rgba(255,255,255,0.06)", flexShrink: 0 }}>
          {tabs.map((t) => (
            <button key={t.id} role="tab" aria-selected={sheet === t.id} onClick={() => setSheet(t.id)} className="mg-focus"
              style={{ height: 32, borderRadius: 12, border: 0, fontSize: 13, fontWeight: 700, cursor: "pointer", color: sheet === t.id ? "#1C1640" : "var(--mg-ink-2)", background: sheet === t.id ? "#fff" : "transparent" }}>
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: sheet === "ai" ? "hidden" : "auto" }}>
          {sheet === "scene" && project.config && <SceneOutline config={project.config} selected={selected} onSelect={(s) => { setSelected(s); setSheet("settings"); }} />}
          {sheet === "settings" && details}
          {sheet === "ai" && helper(true)}
          {sheet === "build" && buildCard}
          {sheet === "plan" && plan && (
            <div style={{ display: "grid", gap: 12 }}>
              <div role="tablist" aria-label="Plan sections" style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none" }}>
                {PLAN_SECTIONS.map((s) => (
                  <button key={s.id} role="tab" aria-selected={section === s.id} onClick={() => setSection(s.id)} className="mg-focus"
                    style={{ flexShrink: 0, height: 30, padding: "0 12px", borderRadius: 15, fontSize: 12.5, fontWeight: 700, cursor: "pointer", color: section === s.id ? "#1C1640" : "var(--mg-ink-2)", background: section === s.id ? "#fff" : "rgba(255,255,255,0.08)", border: `1px solid ${section === s.id ? "#fff" : "rgba(255,255,255,0.14)"}` }}>
                    {s.label}
                  </button>
                ))}
              </div>
              <PlanSectionEditor plan={plan} section={section} onChange={(p: GamePlan) => change({ plan: p })} />
              <p style={{ margin: 0, fontSize: 12, color: "var(--mg-ink-3)" }}>{engineLabel(project.engine)} project · saved to your account</p>
            </div>
          )}
        </div>
      </div>
      {toast && <Toast text={toast} />}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mg-font" style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: "#0C0B1A", color: "var(--mg-ink)" }}>{children}</div>;
}

function Toast({ text }: { text: string }) {
  return <div role="status" style={{ position: "fixed", left: "50%", bottom: 24, translate: "-50% 0", zIndex: 60, padding: "10px 16px", borderRadius: 16, background: "rgba(28,24,62,0.96)", border: "1px solid rgba(255,255,255,0.18)", fontSize: 13.5, fontWeight: 600 }}>{text}</div>;
}

const cap: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mg-ink-3)" };
const side = (border: "left" | "right"): React.CSSProperties => ({
  padding: 14, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto", minHeight: 0,
  background: "#0F0E21", [border === "right" ? "borderRight" : "borderLeft"]: "1px solid rgba(255,255,255,0.08)",
});
const menuItem = (on: boolean): React.CSSProperties => ({
  display: "flex", alignItems: "center", gap: 8, height: 36, padding: "0 10px", borderRadius: 10, border: 0, cursor: "pointer", textAlign: "left",
  fontSize: 13, fontWeight: on ? 700 : 600, background: on ? "rgba(255,255,255,0.1)" : "transparent", color: "var(--mg-ink)",
});
