/**
 * Builder — the middle tab. Describe something, pick what kind of thing it is,
 * and AI Studio builds it. Also lists your projects and build prompts.
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Smartphone, Globe, Gamepad2, Bot, Workflow, Star, Clock, ChevronRight, FolderOpen, Plus } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { recordPrompt, usePromptLibrary } from "@/lib/promptLibrary";
import { UsagePill } from "@/components/home/HomeHub";

const TYPES = [
  { id: "app",        label: "App",        icon: Smartphone, prefix: "A mobile-friendly app: " },
  { id: "website",    label: "Website",    icon: Globe,      prefix: "A website: " },
  { id: "game",       label: "Game",       icon: Gamepad2,   prefix: "A browser game: " },
  { id: "bot",        label: "Bot",        icon: Bot,        prefix: "A chatbot: " },
  { id: "automation", label: "Automation", icon: Workflow,   prefix: "An automation workflow: " },
] as const;

const IDEAS = [
  "A habit tracker with streaks and reminders",
  "A landing page for my clothing brand",
  "A space shooter with power-ups",
];

interface Project { id: number; title: string; description?: string | null; appType?: string | null; updatedAt: string }

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

const glass: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0.05))",
  backdropFilter: "blur(22px) saturate(180%)",
  WebkitBackdropFilter: "blur(22px) saturate(180%)",
  border: "1px solid rgba(255,255,255,0.18)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35), 0 10px 30px rgba(0,0,0,0.25)",
};

const label: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--mg-ink-3)" };

export default function BuilderPage() {
  const [, nav] = useLocation();
  const sessionId = useSession();
  const [prompt, setPrompt] = useState("");
  const [type, setType] = useState<(typeof TYPES)[number]["id"]>("app");
  const library = usePromptLibrary("build");
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  const projects = useQuery({
    queryKey: ["studio-projects", sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const res = await fetch(`${base}/api/studio/ai/projects?sessionId=${encodeURIComponent(sessionId)}`);
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Couldn't load projects");
      return json.data.projects as Project[];
    },
  });

  const build = (text = prompt) => {
    const t = text.trim();
    if (!t) return;
    recordPrompt(t, "build");
    const prefix = TYPES.find((x) => x.id === type)?.prefix ?? "";
    nav(`/ai-studio?prompt=${encodeURIComponent(prefix + t)}`);
  };

  const promptRows = [
    ...library.saved.slice(0, 3).map((p) => ({ ...p, saved: true })),
    ...library.history.filter((p) => !library.isSaved(p.text)).slice(0, 3).map((p) => ({ ...p, saved: false })),
  ];

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 32px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h1 className="mg-display" style={{ fontSize: 28, fontWeight: 700, margin: 0, color: "var(--mg-ink)" }}>Builder</h1>
            <p style={{ margin: "2px 0 0", fontSize: 13.5, color: "var(--mg-ink-2)" }}>Describe it. Apex builds it.</p>
          </div>
          <UsagePill />
        </div>

        {/* Prompt card */}
        <div style={{ ...glass, borderRadius: 28, padding: 16, display: "flex", flexDirection: "column", gap: 12, background: "radial-gradient(90% 70% at 20% 0%, rgba(139,123,255,0.35), transparent 70%), linear-gradient(160deg, rgba(139,123,255,0.28), rgba(0,194,255,0.10))" }}>
          <textarea
            id="builder-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); build(); } }}
            placeholder="A social app for dog lovers with real-time chat…"
            rows={3}
            aria-label="Describe what you want to build"
            style={{ width: "100%", resize: "none", background: "rgba(10,9,24,0.35)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 18, padding: "12px 14px", color: "var(--mg-ink)", fontSize: 15, outline: "none", fontFamily: "inherit", lineHeight: 1.5 }}
          />
          <div role="radiogroup" aria-label="What are you building?" style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none" }}>
            {TYPES.map(({ id, label: l, icon: Icon }) => {
              const on = id === type;
              return (
                <button
                  key={id}
                  role="radio"
                  aria-checked={on}
                  onClick={() => setType(id)}
                  className="mg-press mg-focus"
                  style={{ flexShrink: 0, height: 34, padding: "0 13px", borderRadius: 17, display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, cursor: "pointer", color: on ? "#120F2A" : "var(--mg-ink-2)", background: on ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.07)", border: `1px solid ${on ? "transparent" : "rgba(255,255,255,0.12)"}` }}
                >
                  <Icon size={14} /> {l}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => build()}
            disabled={!prompt.trim()}
            className="mg-press mg-focus"
            style={{ height: 48, borderRadius: 24, border: "none", cursor: prompt.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 15, fontWeight: 700, color: "white", background: "linear-gradient(135deg, #7C6CFF, #3BA8FF)", opacity: prompt.trim() ? 1 : 0.5, boxShadow: "0 10px 26px rgba(108,92,231,0.45)" }}
          >
            <Sparkles size={17} /> Build with Apex
          </button>
        </div>

        {/* Ideas when nothing typed */}
        {!prompt.trim() && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={label}>Try an idea</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {IDEAS.map((idea) => (
                <button key={idea} onClick={() => setPrompt(idea)} className="mg-press mg-focus" style={{ padding: "8px 13px", borderRadius: 16, fontSize: 12.5, fontWeight: 500, color: "var(--mg-ink-2)", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer", textAlign: "left" }}>
                  {idea}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Saved + recent build prompts */}
        {promptRows.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={label}>Your prompts</span>
            <div style={{ ...glass, borderRadius: 22, overflow: "hidden" }}>
              {promptRows.map((p, i) => (
                <div key={p.text} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderTop: i ? "1px solid rgba(255,255,255,0.07)" : "none" }}>
                  {p.saved ? <Star size={15} fill="#FFD479" style={{ color: "#FFD479", flexShrink: 0 }} /> : <Clock size={15} style={{ color: "var(--mg-ink-3)", flexShrink: 0 }} />}
                  <button onClick={() => setPrompt(p.text)} style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", color: "var(--mg-ink)", fontSize: 13.5, cursor: "pointer", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {p.text}
                  </button>
                  <button onClick={() => library.toggleSaved(p.text)} aria-label={p.saved ? "Remove from saved" : "Save prompt"} style={{ background: "none", border: "none", padding: 4, cursor: "pointer" }}>
                    <Star size={15} fill={p.saved ? "#FFD479" : "none"} style={{ color: p.saved ? "#FFD479" : "var(--mg-ink-3)" }} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Projects */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={label}>Your projects</span>
            <button onClick={() => nav("/ai-studio")} className="mg-focus" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12.5, fontWeight: 600, color: "var(--mg-violet)", background: "none", border: "none", cursor: "pointer" }}>
              <Plus size={14} /> Blank project
            </button>
          </div>
          {projects.isLoading ? (
            <div style={{ ...glass, borderRadius: 22, height: 64, opacity: 0.6 }} />
          ) : projects.isError ? (
            <p style={{ fontSize: 13, color: "var(--mg-ink-3)" }}>Couldn't load your projects. Pull down or try again in a moment.</p>
          ) : (projects.data?.length ?? 0) === 0 ? (
            <div style={{ ...glass, borderRadius: 22, padding: 18, display: "flex", alignItems: "center", gap: 12 }}>
              <FolderOpen size={22} style={{ color: "var(--mg-ink-2)" }} />
              <span style={{ fontSize: 13.5, color: "var(--mg-ink-2)" }}>Nothing built yet. Your first build shows up here.</span>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {projects.data!.slice(0, 12).map((p) => (
                <button key={p.id} onClick={() => nav(`/ai-studio?project=${p.id}`)} className="mg-press mg-focus" style={{ ...glass, borderRadius: 22, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left", color: "var(--mg-ink)" }}>
                  <span style={{ width: 40, height: 40, borderRadius: 14, display: "grid", placeItems: "center", background: "rgba(139,123,255,0.22)", flexShrink: 0 }}>
                    <Sparkles size={18} style={{ color: "#C9C2FF" }} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 14.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.title}</span>
                    <span style={{ display: "block", fontSize: 12, color: "var(--mg-ink-3)" }}>{p.appType ? `${p.appType} · ` : ""}{timeAgo(p.updatedAt)}</span>
                  </span>
                  <ChevronRight size={16} style={{ color: "var(--mg-ink-3)" }} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
