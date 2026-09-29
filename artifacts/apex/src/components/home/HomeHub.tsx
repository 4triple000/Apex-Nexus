import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Search, ChevronLeft, ChevronRight, ArrowUpRight, Sparkles } from "lucide-react";
import { RiOpenaiFill } from "react-icons/ri";
import { SiClaude, SiPerplexity } from "react-icons/si";
import { ApexLogo } from "@/components/ui/ApexLogo";

// ── Models ─────────────────────────────────────────────────────────────────────

export type ModelId = "auto" | "openai" | "claude" | "perplexity";
export type ChatMode = "chat" | "battle" | "hive";

type Model = {
  id: ModelId;
  name: string;
  maker: string;
  tagline: string;
  color: string;
  aliases: string[];
  Logo: ComponentType<{ size?: number; color?: string }>;
};

function AutoLogo({ size = 40 }: { size?: number }) {
  return <ApexLogo size={size} />;
}

export const MODELS: Model[] = [
  { id: "auto",       name: "Apex Auto",  maker: "Apex",       tagline: "Picks the best model for each message",   color: "#8B7BFF", aliases: ["auto", "apex", "best", "smart"],          Logo: AutoLogo },
  { id: "openai",     name: "ChatGPT",    maker: "OpenAI",     tagline: "Fast, all-round everyday answers",        color: "#10A37F", aliases: ["gpt", "chatgpt", "openai", "chat gpt"],   Logo: RiOpenaiFill },
  { id: "claude",     name: "Claude",     maker: "Anthropic",  tagline: "Deep reasoning, writing and code",        color: "#D97757", aliases: ["claude", "anthropic", "opus", "sonnet"], Logo: SiClaude },
  { id: "perplexity", name: "Perplexity", maker: "Perplexity", tagline: "Live web research with sources",          color: "#20B8CD", aliases: ["perplexity", "sonar", "search", "web"],  Logo: SiPerplexity },
];

export function modelById(id: ModelId): Model {
  return MODELS.find((m) => m.id === id) ?? MODELS[0];
}

export function ModelLogo({ id, size = 22 }: { id: ModelId; size?: number }) {
  const m = modelById(id);
  return id === "auto" ? <ApexLogo size={size} /> : <m.Logo size={size} color={m.color} />;
}

/** Which providers the server has keys for. `undefined` while loading or if the check fails. */
export function useProviderStatus(): Partial<Record<ModelId, boolean>> | undefined {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const { data } = useQuery({
    queryKey: ["chat-providers"],
    queryFn: async () => {
      const res = await fetch(`${base}/api/chat/providers`);
      if (!res.ok) throw new Error("status check failed");
      return (await res.json()) as { providers: Record<"openai" | "claude" | "perplexity", boolean> };
    },
    staleTime: 60_000,
    retry: 1,
  });
  if (!data) return undefined;
  const p = data.providers;
  return { ...p, auto: p.openai || p.claude || p.perplexity };
}

// ── Greeting header ────────────────────────────────────────────────────────────

export function HubHeader({ name, onAvatar }: { name?: string; onAvatar: () => void }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const initial = (name?.trim()[0] ?? "A").toUpperCase();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 42 }}>
      {/* The fixed ☰ menu button (ApexControlPanel) sits in this space */}
      <div style={{ width: 42, flexShrink: 0 }} aria-hidden />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: "var(--mg-ink-3)", fontWeight: 500 }}>{greeting}</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--mg-ink)", letterSpacing: "-0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          Hey, {name?.trim() || "Creator"}
        </div>
      </div>
      <button
        onClick={onAvatar}
        aria-label="Your profile"
        className="mg-press mg-focus"
        style={{ width: 42, height: 42, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.22)", background: "linear-gradient(135deg, #8B7BFF, #00C2FF)", color: "white", fontWeight: 700, fontSize: 15, cursor: "pointer", flexShrink: 0 }}
      >
        {initial}
      </button>
    </div>
  );
}

// ── Search: models, modes, tools, or just ask ─────────────────────────────────

type SearchItem =
  | { kind: "model"; id: ModelId; label: string; sub: string }
  | { kind: "mode"; id: ChatMode; label: string; sub: string }
  | { kind: "tool"; href: string; label: string; sub: string; emoji: string }
  | { kind: "ask"; label: string; sub: string };

const MODE_ITEMS: { id: ChatMode; label: string; sub: string; aliases: string[] }[] = [
  { id: "chat",   label: "Chat",   sub: "One model answers",             aliases: ["chat", "single"] },
  { id: "battle", label: "Battle", sub: "Every model answers, you vote", aliases: ["battle", "compare", "versus", "vs"] },
  { id: "hive",   label: "Hive",   sub: "Models team up on one answer",  aliases: ["hive", "team", "combine", "together"] },
];

const TOOL_ITEMS = [
  { href: "/ai-studio",  label: "AI Studio",      sub: "Build an app from a description", emoji: "🧠", aliases: ["studio", "build", "app", "builder"] },
  { href: "/games",      label: "Apex Games",     sub: "Play and remix games",            emoji: "🎮", aliases: ["games", "game", "play"] },
  { href: "/dm",         label: "Messages",       sub: "Instagram and Messenger inbox",   emoji: "💬", aliases: ["messages", "dm", "instagram", "facebook", "messenger", "inbox"] },
  { href: "/screenshot", label: "Screenshot AI",  sub: "Explain anything on screen",      emoji: "📸", aliases: ["screenshot", "image", "photo"] },
  { href: "/feed",       label: "Content Writer", sub: "Posts, captions and scripts",     emoji: "✍️", aliases: ["write", "writer", "content", "post", "caption"] },
  { href: "/workflows",  label: "AI Coach",       sub: "Workflows and coaching",          emoji: "🔁", aliases: ["coach", "workflow", "automation"] },
];

export function ModelSearch({
  onPickModel, onPickMode, onAsk,
}: {
  onPickModel: (id: ModelId) => void;
  onPickMode: (id: ChatMode) => void;
  onAsk: (text: string) => void;
}) {
  const [, nav] = useLocation();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const items = useMemo<SearchItem[]>(() => {
    const q = query.trim().toLowerCase();
    const hit = (label: string, aliases: string[]) =>
      !q || label.toLowerCase().includes(q) || aliases.some((a) => a.includes(q) || q.includes(a));
    const list: SearchItem[] = [
      ...MODELS.filter((m) => hit(m.name, m.aliases)).map((m) => ({ kind: "model" as const, id: m.id, label: m.name, sub: m.tagline })),
      ...MODE_ITEMS.filter((m) => q && hit(m.label, m.aliases)).map((m) => ({ kind: "mode" as const, id: m.id, label: `${m.label} mode`, sub: m.sub })),
      ...TOOL_ITEMS.filter((t) => q && hit(t.label, t.aliases)).map((t) => ({ kind: "tool" as const, href: t.href, label: t.label, sub: t.sub, emoji: t.emoji })),
    ];
    if (q) list.push({ kind: "ask", label: `Ask Apex “${query.trim()}”`, sub: "Send as a message" });
    return list;
  }, [query]);

  useEffect(() => setActive(0), [query]);

  // Close the list when tapping elsewhere
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const choose = (item: SearchItem) => {
    if (item.kind === "model") onPickModel(item.id);
    else if (item.kind === "mode") onPickMode(item.id);
    else if (item.kind === "tool") nav(item.href);
    else onAsk(query.trim());
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={boxRef} style={{ position: "relative", zIndex: 20 }}>
      <label className="mg-glass" style={{ display: "flex", alignItems: "center", gap: 10, height: 46, borderRadius: 23, padding: "0 16px", cursor: "text" }}>
        <Search size={16} style={{ color: "var(--mg-ink-2)", flexShrink: 0 }} />
        <input
          id="home-model-search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            else if (e.key === "Enter" && items[active]) { e.preventDefault(); choose(items[active]); }
            else if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Search a model, or ask Apex…"
          aria-label="Search models and tools, or ask Apex"
          autoComplete="off"
          style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: "var(--mg-ink)", fontSize: 15 }}
        />
      </label>

      {open && items.length > 0 && (
        <div
          role="listbox"
          className="mg-glass"
          style={{ position: "absolute", top: 54, left: 0, right: 0, borderRadius: 22, padding: 6, background: "rgba(22,19,44,0.97)", maxHeight: 320, overflowY: "auto" }}
        >
          {!query.trim() && (
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--mg-ink-3)", padding: "8px 12px 4px" }}>
              Models
            </div>
          )}
          {items.map((item, i) => (
            <button
              key={`${item.kind}-${item.label}`}
              role="option"
              aria-selected={i === active}
              onPointerEnter={() => setActive(i)}
              onClick={() => choose(item)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 16, border: "none", cursor: "pointer", textAlign: "left", color: "var(--mg-ink)", background: i === active ? "rgba(255,255,255,0.09)" : "transparent" }}
            >
              <span style={{ width: 32, height: 32, borderRadius: 10, display: "grid", placeItems: "center", background: "rgba(255,255,255,0.07)", flexShrink: 0, fontSize: 16 }}>
                {item.kind === "model" ? <ModelLogo id={item.id} size={18} />
                  : item.kind === "tool" ? item.emoji
                  : item.kind === "mode" ? (item.id === "battle" ? "⚔️" : item.id === "hive" ? "🐝" : "💬")
                  : <Sparkles size={16} style={{ color: "var(--mg-violet)" }} />}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</span>
                <span style={{ display: "block", fontSize: 12, color: "var(--mg-ink-3)" }}>{item.sub}</span>
              </span>
              {item.kind === "tool" && <ArrowUpRight size={15} style={{ color: "var(--mg-ink-3)" }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Mode chips: Chat · Battle · Hive ───────────────────────────────────────────

export function ModeChips({ mode, onChange }: { mode: ChatMode; onChange: (m: ChatMode) => void }) {
  return (
    <div role="tablist" aria-label="Chat mode" style={{ display: "flex", gap: 8 }}>
      {MODE_ITEMS.map((m) => {
        const on = m.id === mode;
        return (
          <button
            key={m.id}
            role="tab"
            aria-selected={on}
            data-testid={`button-mode-${m.id}`}
            onClick={() => onChange(m.id)}
            className="mg-press mg-focus"
            style={{
              height: 36, padding: "0 18px", borderRadius: 18, fontSize: 13.5, fontWeight: 600, cursor: "pointer",
              color: on ? "#120F2A" : "var(--mg-ink-2)",
              background: on ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.07)",
              border: `1px solid ${on ? "transparent" : "rgba(255,255,255,0.12)"}`,
              boxShadow: on ? "0 6px 18px rgba(139,123,255,0.35)" : "none",
              transition: "background 0.25s, color 0.25s, box-shadow 0.25s",
            }}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Swipeable model cards ──────────────────────────────────────────────────────

function StatusPill({ connected }: { connected: boolean | undefined }) {
  if (connected === undefined) return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, padding: "4px 10px", borderRadius: 99, background: connected ? "rgba(74,222,128,0.14)" : "rgba(255,255,255,0.08)", color: connected ? "#86EFAC" : "var(--mg-ink-3)", border: `1px solid ${connected ? "rgba(74,222,128,0.3)" : "rgba(255,255,255,0.12)"}` }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: connected ? "#4ADE80" : "rgba(255,255,255,0.35)" }} />
      {connected ? "Connected" : "Not connected yet"}
    </span>
  );
}

function ArrowButton({ dir, onClick }: { dir: "prev" | "next"; onClick: () => void }) {
  const Icon = dir === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      onClick={onClick}
      aria-label={dir === "prev" ? "Previous model" : "Next model"}
      className="mg-glass mg-press mg-focus"
      style={{ position: "absolute", top: "42%", [dir === "prev" ? "left" : "right"]: 10, width: 34, height: 34, borderRadius: "50%", display: "grid", placeItems: "center", color: "var(--mg-ink)", cursor: "pointer", zIndex: 3, padding: 0 }}
    >
      <Icon size={18} />
    </button>
  );
}

export function ModelCarousel({
  value, onChange, status,
}: {
  value: ModelId;
  onChange: (id: ModelId) => void;
  status: Partial<Record<ModelId, boolean>> | undefined;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const index = Math.max(0, MODELS.findIndex((m) => m.id === value));

  // Keep the visible card in sync when the model is picked elsewhere (search, arrows)
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const current = Math.round(el.scrollLeft / Math.max(el.clientWidth, 1));
    if (current !== index) el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
  }, [index]);

  // A swipe selects the card it settles on
  const onScroll = () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const el = trackRef.current;
      if (!el) return;
      const i = Math.round(el.scrollLeft / Math.max(el.clientWidth, 1));
      const m = MODELS[Math.min(Math.max(i, 0), MODELS.length - 1)];
      if (m.id !== value) onChange(m.id);
    }, 90);
  };

  const go = (delta: number) => onChange(MODELS[(index + delta + MODELS.length) % MODELS.length].id);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="mg-glass" style={{ position: "relative", borderRadius: 30, overflow: "hidden" }}>
        <div ref={trackRef} onScroll={onScroll} className="mg-snap" aria-roledescription="carousel" aria-label="AI models">
          {MODELS.map((m, i) => (
            <div
              key={m.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${m.name}, ${i + 1} of ${MODELS.length}`}
              style={{ position: "relative", minHeight: 236, padding: "22px 22px 20px", display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 6, background: `radial-gradient(120% 90% at 50% 0%, ${m.color}40 0%, transparent 62%)` }}
            >
              <div style={{ position: "absolute", top: 26, left: "50%", transform: "translateX(-50%)", width: 92, height: 92, borderRadius: 28, display: "grid", placeItems: "center", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", boxShadow: `inset 0 1px 0 rgba(255,255,255,0.35), 0 16px 40px ${m.color}55` }}>
                {m.id === "auto" ? <ApexLogo size={60} radius={18} /> : <m.Logo size={50} color={m.id === "openai" ? "#FFFFFF" : m.color} />}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--mg-ink)", letterSpacing: "-0.02em" }}>{m.name}</div>
                <StatusPill connected={status?.[m.id]} />
              </div>
              <div style={{ fontSize: 13.5, color: "var(--mg-ink-2)" }}>
                <span style={{ color: "var(--mg-ink-3)" }}>{m.maker} · </span>{m.tagline}
              </div>
            </div>
          ))}
        </div>
        <ArrowButton dir="prev" onClick={() => go(-1)} />
        <ArrowButton dir="next" onClick={() => go(1)} />
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 6 }} aria-hidden>
        {MODELS.map((m, i) => (
          <span key={m.id} style={{ height: 6, width: i === index ? 20 : 6, borderRadius: 3, background: "var(--mg-ink)", opacity: i === index ? 0.9 : 0.28, transition: "width 0.3s, opacity 0.3s" }} />
        ))}
      </div>
    </div>
  );
}

// ── Battle / Hive card ─────────────────────────────────────────────────────────

export function ModeCard({ mode, status }: { mode: "battle" | "hive"; status: Partial<Record<ModelId, boolean>> | undefined }) {
  const [, nav] = useLocation();
  const models = MODELS.filter((m) => m.id !== "auto");
  const connected = status ? models.filter((m) => status[m.id]).length : undefined;
  const copy = mode === "battle"
    ? { title: "Battle", body: "Every connected model answers the same message. Compare them side by side and vote for the best.", accent: "#FF6B6B" }
    : { title: "Hive", body: "Every connected model answers, then Apex blends the best parts into one answer.", accent: "#8B7BFF" };
  return (
    <div className="mg-glass" style={{ borderRadius: 30, padding: 22, minHeight: 236, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 16, background: `radial-gradient(120% 90% at 50% 0%, ${copy.accent}38 0%, transparent 62%), linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04))` }}>
      <div style={{ display: "flex", justifyContent: "center", paddingTop: 6 }}>
        {models.map((m, i) => (
          <span key={m.id} style={{ width: 64, height: 64, borderRadius: 22, display: "grid", placeItems: "center", marginLeft: i ? -12 : 0, background: "rgba(24,20,48,0.85)", border: "1px solid rgba(255,255,255,0.2)", boxShadow: `0 10px 26px ${m.color}44`, opacity: status && !status[m.id] ? 0.45 : 1 }}>
            <m.Logo size={32} color={m.id === "openai" ? "#FFFFFF" : m.color} />
          </span>
        ))}
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--mg-ink)" }}>{copy.title}</div>
          {connected !== undefined && (
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--mg-ink-3)" }}>{connected} of {models.length} connected</span>
          )}
        </div>
        <div style={{ fontSize: 13.5, color: "var(--mg-ink-2)", lineHeight: 1.5 }}>{copy.body}</div>
        {mode === "battle" && (
          <button onClick={() => nav("/arena")} className="mg-press mg-focus" style={{ justifySelf: "start", marginTop: 4, fontSize: 13, fontWeight: 600, color: "var(--mg-ink)", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.16)", borderRadius: 99, padding: "7px 14px", cursor: "pointer" }}>
            Open the Arena →
          </button>
        )}
      </div>
    </div>
  );
}
