/**
 * AI Models — every model Apex offers, grouped by what it's for: chat, game dev and worlds,
 * images, voice and audio, AI video, and video editing. Shows which ones are connected.
 */
import { useMemo, useState, type ComponentType } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Search, ArrowUpRight, MessageCircle, Gamepad2, Gift } from "lucide-react";
import { RiOpenaiFill } from "react-icons/ri";
import { SiClaude, SiPerplexity, SiGooglegemini, SiGoogle, SiX, SiDeepseek, SiMistralai, SiMeta, SiElevenlabs } from "react-icons/si";
import { useAuth } from "@/contexts/AuthContext";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Category = "chat" | "game" | "image" | "audio" | "video" | "editing";
interface CatalogModel {
  id: string; name: string; maker: string; category: Category; tagline: string;
  bestFor: string[]; envKey: string; color: string; keyUrl: string; chat?: boolean; connected: boolean;
}

const LOGOS: Record<string, ComponentType<{ size?: number; color?: string }>> = {
  openai: RiOpenaiFill, "gpt-image": RiOpenaiFill, whisper: RiOpenaiFill, sora: RiOpenaiFill,
  claude: SiClaude, perplexity: SiPerplexity, gemini: SiGooglegemini, veo: SiGoogle,
  grok: SiX, deepseek: SiDeepseek, mistral: SiMistralai, llama: SiMeta, free: Gift, elevenlabs: SiElevenlabs,
};

const USE_IN: Partial<Record<string, { label: string; to: string }>> = {
  elevenlabs: { label: "Give your game characters voices", to: "/game-engine" },
  skybox: { label: "Build worlds in the Engine", to: "/game-engine" },
  meshy: { label: "Make 3D models for your game", to: "/game-engine" },
  tripo: { label: "Make 3D characters for your game", to: "/game-engine" },
  scenario: { label: "Make game art in the Engine", to: "/game-engine" },
  inworld: { label: "Give your game talking NPCs", to: "/game-engine" },
};

const BEST_FOR = ["Everyday", "Game dev", "Video", "Creators", "Code", "Research"];

export default function ModelsPage() {
  const [, nav] = useLocation();
  const isOwner = !!useAuth().user?.isOwner;
  const [category, setCategory] = useState<Category | "all">(() => {
    const q = new URLSearchParams(window.location.search).get("cat");
    return (["chat", "game", "image", "audio", "video", "editing"] as const).find((c) => c === q) ?? "all";
  });
  const [bestFor, setBestFor] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const data = useQuery({
    queryKey: ["model-catalog"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/models`);
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error("Couldn't load the models");
      return json.data as { categories: Record<Category, string>; models: CatalogModel[] };
    },
    staleTime: 60_000,
  });

  const models = data.data?.models ?? [];
  const labels = data.data?.categories;
  const connected = models.filter((m) => m.connected).length;

  const shown = useMemo(() => models.filter((m) =>
    (category === "all" || m.category === category) &&
    (!bestFor || m.bestFor.includes(bestFor)) &&
    (!query.trim() || `${m.name} ${m.maker} ${m.tagline}`.toLowerCase().includes(query.trim().toLowerCase())),
  ), [models, category, bestFor, query]);

  const groups = (Object.keys(labels ?? {}) as Category[])
    .map((c) => ({ c, label: labels![c], items: shown.filter((m) => m.category === c) }))
    .filter((g) => g.items.length);

  return (
    <div className="mg-font" style={{ flex: 1, overflowY: "auto", padding: "0 16px 40px" }}>
      <div style={{ maxWidth: 980, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
        <header>
          <h1 className="mg-display" style={{ margin: 0, fontSize: 28, fontWeight: 700, color: "var(--mg-ink)" }}>AI Models</h1>
          <p style={{ margin: "2px 0 0", fontSize: 13.5, color: "var(--mg-ink-2)" }}>
            {models.length ? `${models.length} models for chat, game worlds, images, voices and video · ${connected} connected` : "Chat, game worlds, images, voices and video"}
          </p>
        </header>

        <label style={{ display: "flex", alignItems: "center", gap: 10, height: 44, borderRadius: 22, padding: "0 16px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.16)" }}>
          <Search size={16} style={{ color: "var(--mg-ink-3)" }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search models" aria-label="Search models"
            style={{ flex: 1, minWidth: 0, background: "none", border: 0, outline: "none", color: "var(--mg-ink)", fontSize: 15, fontFamily: "inherit" }} />
        </label>

        <div role="radiogroup" aria-label="Category" style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none" }}>
          {([["all", "All"], ...Object.entries(labels ?? {})] as [Category | "all", string][]).map(([id, label]) => (
            <Chip key={id} on={category === id} onClick={() => setCategory(id)}>{label}</Chip>
          ))}
        </div>
        <div role="radiogroup" aria-label="Best for" style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", alignItems: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "var(--mg-ink-3)", flexShrink: 0 }}>BEST FOR</span>
          {BEST_FOR.map((b) => <Chip key={b} small on={bestFor === b} onClick={() => setBestFor(bestFor === b ? null : b)}>{b}</Chip>)}
        </div>

        {data.isLoading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
            {[0, 1, 2, 3].map((i) => <div key={i} className="mg-cc-card" style={{ height: 150, borderWidth: 1, opacity: 0.5 }} />)}
          </div>
        ) : data.isError ? (
          <p style={{ margin: 0, color: "var(--mg-ink-3)", fontSize: 13.5 }}>Couldn't load the models. Try again in a moment.</p>
        ) : groups.length === 0 ? (
          <p style={{ margin: 0, color: "var(--mg-ink-3)", fontSize: 13.5 }}>No models match.</p>
        ) : groups.map((g) => (
          <section key={g.c} style={{ display: "grid", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mg-ink-3)" }}>{g.label}</span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
              {g.items.map((m) => <ModelCard key={m.id} m={m} isOwner={isOwner} onGo={nav} />)}
            </div>
          </section>
        ))}

        {isOwner && models.length > 0 && (
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--mg-ink-3)", lineHeight: 1.5 }}>
            Owner tip: add a model's key (shown on each card) to the API server's environment on Render, and it connects after the next deploy.
          </p>
        )}
      </div>
    </div>
  );
}

function Chip({ on, small, onClick, children }: { on: boolean; small?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button role="radio" aria-checked={on} onClick={onClick} className="mg-press mg-focus"
      style={{ flexShrink: 0, height: small ? 30 : 34, padding: small ? "0 12px" : "0 14px", borderRadius: 17, fontSize: small ? 12 : 13, fontWeight: 600, cursor: "pointer", color: on ? "#1C1640" : "var(--mg-ink-2)", background: on ? "#fff" : "rgba(255,255,255,0.08)", border: `1px solid ${on ? "#fff" : "rgba(255,255,255,0.14)"}` }}>
      {children}
    </button>
  );
}

function ModelCard({ m, isOwner, onGo }: { m: CatalogModel; isOwner: boolean; onGo: (to: string) => void }) {
  const Logo = LOGOS[m.id];
  const use = USE_IN[m.id];
  return (
    <article className="mg-cc-card" style={{ borderWidth: 1, borderRadius: 24, padding: 14, display: "grid", gap: 10, alignContent: "start", background: `radial-gradient(120% 90% at 0% 0%, ${m.color}24, transparent 60%), rgba(255,255,255,0.06)` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span aria-hidden style={{ width: 46, height: 46, borderRadius: 15, flexShrink: 0, display: "grid", placeItems: "center", background: "rgba(24,20,48,0.85)", border: "1px solid rgba(255,255,255,0.18)", boxShadow: `0 8px 22px ${m.color}33` }}>
          {Logo ? <Logo size={24} color={m.color} /> : <span className="mg-display" style={{ fontWeight: 700, fontSize: 18, color: m.color }}>{m.name[0]}</span>}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontWeight: 700, fontSize: 15, color: "var(--mg-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</span>
          <span style={{ display: "block", fontSize: 12, color: "var(--mg-ink-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.maker}</span>
        </span>
        <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 99, color: m.connected ? "#4ADE80" : "var(--mg-ink-3)", background: m.connected ? "rgba(74,222,128,0.12)" : "rgba(255,255,255,0.06)", border: `1px solid ${m.connected ? "rgba(74,222,128,0.3)" : "rgba(255,255,255,0.12)"}` }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: m.connected ? "#4ADE80" : "rgba(255,255,255,0.35)" }} />
          {m.connected ? "Connected" : "Not connected yet"}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 13.5, color: "var(--mg-ink-2)", lineHeight: 1.45 }}>{m.tagline}</p>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {m.bestFor.map((b) => <span key={b} style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 8, color: "var(--mg-ink-2)", background: "rgba(255,255,255,0.07)" }}>{b}</span>)}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {m.chat && (
          <button onClick={() => onGo(`/?model=${m.id}`)} className="mg-press mg-focus" style={actionBtn(true)}><MessageCircle size={14} /> Chat with it</button>
        )}
        {use && (
          <button onClick={() => onGo(use.to)} className="mg-press mg-focus" style={actionBtn(!m.chat)}><Gamepad2 size={14} /> {use.label}</button>
        )}
        {isOwner && !m.connected && (
          <a href={m.keyUrl} target="_blank" rel="noreferrer" className="mg-focus" style={{ ...actionBtn(false), textDecoration: "none" }}>
            Get a key <ArrowUpRight size={13} />
          </a>
        )}
      </div>
      {isOwner && !m.connected && <code style={{ fontSize: 11.5, color: "var(--mg-ink-3)" }}>{m.envKey}</code>}
    </article>
  );
}

const actionBtn = (primary: boolean): React.CSSProperties => ({
  height: 32, padding: "0 12px", borderRadius: 16, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
  display: "inline-flex", alignItems: "center", gap: 6,
  color: primary ? "#1C1640" : "var(--mg-ink)", background: primary ? "#fff" : "rgba(255,255,255,0.08)",
  border: `1px solid ${primary ? "#fff" : "rgba(255,255,255,0.16)"}`,
});
