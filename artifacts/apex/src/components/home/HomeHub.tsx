import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Search, ChevronLeft, ChevronRight, ArrowUpRight, Sparkles, Star, Clock, ScanText, Gift } from "lucide-react";
import { RiOpenaiFill } from "react-icons/ri";
import { SiClaude, SiPerplexity, SiGooglegemini, SiX, SiDeepseek, SiMistralai, SiMeta } from "react-icons/si";
import { ApexLogo } from "@/components/ui/ApexLogo";
import { usePromptLibrary } from "@/lib/promptLibrary";
import { useCredits, openCreditsSheet, resetsIn } from "@/hooks/useCredits";

// ── Models ─────────────────────────────────────────────────────────────────────

export type ModelId = "auto" | "free" | "openai" | "claude" | "perplexity" | "gemini" | "grok" | "deepseek" | "mistral" | "llama";
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
  { id: "free",       name: "Apex Free",  maker: "Groq · Cerebras · GitHub", tagline: "Free open models, no credits used", color: "#86EFAC", aliases: ["free", "apex free", "open", "gpt-oss", "qwen"], Logo: Gift },
  { id: "openai",     name: "ChatGPT",    maker: "OpenAI",     tagline: "Fast, all-round everyday answers",        color: "#10A37F", aliases: ["gpt", "chatgpt", "openai", "chat gpt"],   Logo: RiOpenaiFill },
  { id: "claude",     name: "Claude",     maker: "Anthropic",  tagline: "Deep reasoning, writing and code",        color: "#D97757", aliases: ["claude", "anthropic", "opus", "sonnet"], Logo: SiClaude },
  { id: "perplexity", name: "Perplexity", maker: "Perplexity", tagline: "Live web research with sources",          color: "#20B8CD", aliases: ["perplexity", "sonar", "search", "web"],  Logo: SiPerplexity },
  { id: "gemini",     name: "Gemini",     maker: "Google",     tagline: "Huge context: reads long docs, images and video", color: "#4E86F7", aliases: ["gemini", "google", "bard"], Logo: SiGooglegemini },
  { id: "grok",       name: "Grok",       maker: "xAI",        tagline: "Bold, witty answers with a real-time feel", color: "#E7E7E7", aliases: ["grok", "xai", "x", "elon"], Logo: SiX },
  { id: "deepseek",   name: "DeepSeek",   maker: "DeepSeek",   tagline: "Strong reasoning and code at a low cost",   color: "#4D6BFE", aliases: ["deepseek", "deep seek", "r1"], Logo: SiDeepseek },
  { id: "mistral",    name: "Mistral",    maker: "Mistral AI", tagline: "Fast and great in many languages",          color: "#FF7000", aliases: ["mistral", "le chat"], Logo: SiMistralai },
  { id: "llama",      name: "Llama",      maker: "Meta · via Groq", tagline: "Open model with lightning-fast replies", color: "#0866FF", aliases: ["llama", "meta", "groq"], Logo: SiMeta },
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
      return (await res.json()) as { providers: Partial<Record<Exclude<ModelId, "auto">, boolean>> };
    },
    staleTime: 60_000,
    retry: 1,
  });
  if (!data) return undefined;
  const p = data.providers;
  return { ...p, auto: Object.values(p).some(Boolean) };
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
        <div className="mg-display" style={{ fontSize: 18, fontWeight: 700, color: "var(--mg-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
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

type SearchItem = { section?: string } & (
  | { kind: "prompt"; text: string; label: string; sub: string; saved: boolean }
  | { kind: "model"; id: ModelId; label: string; sub: string }
  | { kind: "mode"; id: ChatMode; label: string; sub: string }
  | { kind: "tool"; href: string; label: string; sub: string; emoji: string }
  | { kind: "ask"; label: string; sub: string }
);

const MODE_ITEMS: { id: ChatMode; label: string; sub: string; aliases: string[] }[] = [
  { id: "chat",   label: "Chat",   sub: "One model answers",             aliases: ["chat", "single"] },
  { id: "battle", label: "Battle", sub: "Every model answers, you vote", aliases: ["battle", "compare", "versus", "vs"] },
  { id: "hive",   label: "Hive",   sub: "Models team up on one answer",  aliases: ["hive", "team", "combine", "together"] },
];

const TOOL_ITEMS = [
  { href: "/builder",    label: "Builder",        sub: "Build an app from a description", emoji: "🧠", aliases: ["studio", "build", "app", "builder"] },
  { href: "/games",      label: "Apex Games",     sub: "Play and remix games",            emoji: "🎮", aliases: ["games", "game", "play"] },
  { href: "/dm",         label: "Messages",       sub: "Instagram and Messenger inbox",   emoji: "💬", aliases: ["messages", "dm", "instagram", "facebook", "messenger", "inbox"] },
  { href: "/screenshot", label: "Screenshot AI",  sub: "Explain anything on screen",      emoji: "📸", aliases: ["screenshot", "image", "photo"] },
  { href: "/feed",       label: "Social",         sub: "Creators and what they're making", emoji: "👥", aliases: ["social", "feed", "explore", "community", "creators", "follow"] },
  { href: "/connectors", label: "Connectors",     sub: "Your own AI keys and apps",       emoji: "🔌", aliases: ["connect", "connector", "key", "api", "account", "github", "google", "spotify", "notion"] },
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

  const prompts = usePromptLibrary("chat");

  const items = useMemo<SearchItem[]>(() => {
    const q = query.trim().toLowerCase();
    const hit = (label: string, aliases: string[]) =>
      !q || label.toLowerCase().includes(q) || aliases.some((a) => a.includes(q) || q.includes(a));
    const matches = (t: string) => !q || t.toLowerCase().includes(q);
    const saved = prompts.saved.filter((p) => matches(p.text)).slice(0, q ? 3 : 4);
    const recent = prompts.history.filter((p) => matches(p.text) && !prompts.isSaved(p.text)).slice(0, q ? 3 : 4);
    const models = MODELS.filter((m) => hit(m.name, m.aliases)).map((m, i) => ({ kind: "model" as const, id: m.id, label: m.name, sub: m.tagline, section: i === 0 ? "Models" : undefined }));
    const list: SearchItem[] = [
      ...saved.map((p, i) => ({ kind: "prompt" as const, text: p.text, label: p.text, sub: "Saved prompt · tap to send", saved: true, section: i === 0 ? "Saved" : undefined })),
      ...recent.map((p, i) => ({ kind: "prompt" as const, text: p.text, label: p.text, sub: "Recent · tap to send again", saved: false, section: i === 0 ? "Recent" : undefined })),
      ...models,
      ...MODE_ITEMS.filter((m) => q && hit(m.label, m.aliases)).map((m) => ({ kind: "mode" as const, id: m.id, label: `${m.label} mode`, sub: m.sub })),
      ...TOOL_ITEMS.filter((t) => q && hit(t.label, t.aliases)).map((t) => ({ kind: "tool" as const, href: t.href, label: t.label, sub: t.sub, emoji: t.emoji })),
    ];
    if (q) list.push({ kind: "ask", label: `Ask Apex “${query.trim()}”`, sub: "Send as a message" });
    return list;
  }, [query, prompts.saved, prompts.history, prompts.isSaved]);

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
    if (item.kind === "prompt") onAsk(item.text);
    else if (item.kind === "model") onPickModel(item.id);
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
          {items.map((item, i) => (
            <div key={`${item.kind}-${item.label}`}>
            {item.section && (
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--mg-ink-3)", padding: "8px 12px 4px" }}>
                {item.section}
              </div>
            )}
            <button
              role="option"
              aria-selected={i === active}
              onPointerEnter={() => setActive(i)}
              onClick={() => choose(item)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 16, border: "none", cursor: "pointer", textAlign: "left", color: "var(--mg-ink)", background: i === active ? "rgba(255,255,255,0.09)" : "transparent" }}
            >
              <span style={{ width: 32, height: 32, borderRadius: 10, display: "grid", placeItems: "center", background: "rgba(255,255,255,0.07)", flexShrink: 0, fontSize: 16 }}>
                {item.kind === "prompt" ? (item.saved ? <Star size={15} style={{ color: "#FFD479" }} fill="#FFD479" /> : <Clock size={15} style={{ color: "var(--mg-ink-2)" }} />)
                  : item.kind === "model" ? <ModelLogo id={item.id} size={18} />
                  : item.kind === "tool" ? item.emoji
                  : item.kind === "mode" ? (item.id === "battle" ? "⚔️" : item.id === "hive" ? "🐝" : "💬")
                  : <Sparkles size={16} style={{ color: "var(--mg-violet)" }} />}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</span>
                <span style={{ display: "block", fontSize: 12, color: "var(--mg-ink-3)" }}>{item.sub}</span>
              </span>
              {item.kind === "tool" && <ArrowUpRight size={15} style={{ color: "var(--mg-ink-3)" }} />}
              {item.kind === "prompt" && (
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={item.saved ? "Remove from saved" : "Save prompt"}
                  onClick={(e) => { e.stopPropagation(); prompts.toggleSaved(item.text); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); prompts.toggleSaved(item.text); } }}
                  style={{ padding: 6, borderRadius: 10, display: "grid", placeItems: "center" }}
                >
                  <Star size={15} style={{ color: item.saved ? "#FFD479" : "var(--mg-ink-3)" }} fill={item.saved ? "#FFD479" : "none"} />
                </span>
              )}
            </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Mode chips: Chat · Battle · Hive ───────────────────────────────────────────

export function ModeChips({ mode, onChange }: { mode: ChatMode; onChange: (m: ChatMode) => void }) {
  const [, nav] = useLocation();
  return (
    <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none" }}>
    <div role="tablist" aria-label="Chat mode" style={{ display: "flex", gap: 8, flexShrink: 0 }}>
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
    <button
      onClick={() => nav("/screenshot")}
      className="mg-press mg-focus"
      style={{ flexShrink: 0, height: 36, padding: "0 14px", borderRadius: 18, fontSize: 13.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "var(--mg-ink-2)", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
    >
      <ScanText size={15} /> Screenshot
    </button>
    </div>
  );
}

// ── Today's credits ────────────────────────────────────────────────────────────

/** "18 credits left" with a small ring; tap for the credits sheet. Hidden until the numbers load. */
export function UsagePill() {
  const { data } = useCredits();
  if (!data) return null;
  const pct = data.unlimited ? 0 : Math.min(1, data.used / Math.max(1, data.limit));
  const warn = !data.unlimited && pct >= 0.8;
  const r = 7, c = 2 * Math.PI * r;
  const left = data.unlimited ? 1 : 1 - pct;
  return (
    <button
      type="button"
      onClick={() => openCreditsSheet("info")}
      aria-label={data.unlimited ? "Unlimited AI credits" : `${data.remaining} AI credits left today. Tap for details.`}
      title={data.unlimited ? "Unlimited AI credits" : `Credits reset ${resetsIn(data.resetsAt)}`}
      className="mg-press mg-focus"
      style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 26, padding: "0 10px 0 6px", borderRadius: 13, fontSize: 11.5, fontWeight: 700, color: warn ? "#FFD479" : "var(--mg-ink-2)", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", whiteSpace: "nowrap", cursor: "pointer" }}
    >
      <svg width={18} height={18} viewBox="0 0 18 18" aria-hidden>
        <circle cx={9} cy={9} r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={2.5} />
        <circle cx={9} cy={9} r={r} fill="none" stroke={warn ? "#FFD479" : "#8B7BFF"} strokeWidth={2.5} strokeDasharray={`${c * left} ${c}`} strokeLinecap="round" transform="rotate(-90 9 9)" />
      </svg>
      {data.unlimited ? "Unlimited" : `${data.remaining} credit${data.remaining === 1 ? "" : "s"} left`}
    </button>
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
  const { data: credits } = useCredits();
  const index = Math.max(0, MODELS.findIndex((m) => m.id === value));
  // The dot follows the card under your finger while swiping, before the model is picked
  const [live, setLive] = useState(index);
  useEffect(() => setLive(index), [index]);
  const [, nav] = useLocation();

  // Keep the visible card in sync when the model is picked elsewhere (search, arrows)
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const current = Math.round(el.scrollLeft / Math.max(el.clientWidth, 1));
    if (current !== index) el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
  }, [index]);

  // A swipe selects the card it settles on
  const onScroll = () => {
    const t = trackRef.current;
    if (t) setLive(Math.min(Math.max(Math.round(t.scrollLeft / Math.max(t.clientWidth, 1)), 0), MODELS.length - 1));
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
              style={{ position: "relative", minHeight: 236, padding: "22px 22px 20px", display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 6, background: `radial-gradient(90% 70% at 50% 18%, ${m.color}45 0%, transparent 70%), linear-gradient(160deg, rgba(139,123,255,0.35), rgba(0,194,255,0.12))` }}
            >
              <div style={{ position: "absolute", top: 26, left: "50%", transform: "translateX(-50%)", width: 92, height: 92, borderRadius: 28, display: "grid", placeItems: "center", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", boxShadow: `inset 0 1px 0 rgba(255,255,255,0.35), 0 16px 40px ${m.color}55` }}>
                {m.id === "auto" ? <ApexLogo size={60} radius={18} /> : <m.Logo size={50} color={m.id === "openai" ? "#FFFFFF" : m.color} />}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div className="mg-display" style={{ fontSize: 24, fontWeight: 700, color: "var(--mg-ink)" }}>{m.name}</div>
                <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                  {m.id !== "auto" && credits?.costs[m.id] !== undefined && (
                    <span style={{ fontSize: 11.5, fontWeight: 600, padding: "4px 9px", borderRadius: 99, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "var(--mg-ink-2)" }}>
                      {credits.ownKeys?.includes(m.id) ? "Your key · free" : `${credits.costs[m.id]} credit${credits.costs[m.id] === 1 ? "" : "s"}`}
                    </span>
                  )}
                  <StatusPill connected={status?.[m.id] === undefined ? undefined : status[m.id] || !!credits?.ownKeys?.includes(m.id)} />
                </span>
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
          <span key={m.id} style={{ height: 6, width: i === live ? 20 : 6, borderRadius: 3, background: "var(--mg-ink)", opacity: i === live ? 0.9 : 0.28, transition: "width 0.3s, opacity 0.3s" }} />
        ))}
      </div>
      <button onClick={() => nav("/models")} className="mg-focus" style={{ alignSelf: "center", background: "none", border: 0, color: "var(--mg-violet)", fontSize: 13, fontWeight: 700, cursor: "pointer", padding: 4 }}>
        See all AI models: images, voices, video, 3D →
      </button>
    </div>
  );
}

// ── Battle / Hive card ─────────────────────────────────────────────────────────

export function ModeCard({ mode, status }: { mode: "battle" | "hive"; status: Partial<Record<ModelId, boolean>> | undefined }) {
  const [, nav] = useLocation();
  const models = MODELS.filter((m) => m.id !== "auto");
  const connected = status ? models.filter((m) => status[m.id]).length : undefined;
  // Connected models first; five logos fit on a phone, the rest show as "+N"
  const shown = [...models].sort((a, b) => Number(!!status?.[b.id]) - Number(!!status?.[a.id])).slice(0, 5);
  const copy = mode === "battle"
    ? { title: "Battle", body: "Every connected model answers the same message. Compare them side by side and vote for the best.", accent: "#FF6B6B" }
    : { title: "Hive", body: "Every connected model answers, then Apex blends the best parts into one answer.", accent: "#8B7BFF" };
  return (
    <div className="mg-glass" style={{ borderRadius: 30, padding: 22, minHeight: 236, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 16, background: `radial-gradient(120% 90% at 50% 0%, ${copy.accent}38 0%, transparent 62%), linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04))` }}>
      <div style={{ display: "flex", justifyContent: "center", paddingTop: 6 }}>
        {shown.map((m, i) => (
          <span key={m.id} style={{ width: 64, height: 64, borderRadius: 22, display: "grid", placeItems: "center", marginLeft: i ? -12 : 0, background: "rgba(24,20,48,0.85)", border: "1px solid rgba(255,255,255,0.2)", boxShadow: `0 10px 26px ${m.color}44`, opacity: status && !status[m.id] ? 0.45 : 1 }}>
            <m.Logo size={32} color={m.id === "openai" ? "#FFFFFF" : m.color} />
          </span>
        ))}
        {models.length > shown.length && (
          <span style={{ width: 64, height: 64, borderRadius: 22, display: "grid", placeItems: "center", marginLeft: -12, background: "rgba(24,20,48,0.85)", border: "1px solid rgba(255,255,255,0.2)", fontWeight: 700, fontSize: 15, color: "var(--mg-ink-2)" }}>
            +{models.length - shown.length}
          </span>
        )}
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div className="mg-display" style={{ fontSize: 24, fontWeight: 700, color: "var(--mg-ink)" }}>{copy.title}</div>
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
