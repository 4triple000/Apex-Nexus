/**
 * Connectors — link your own AI accounts (free, unlimited replies on your key) and apps
 * (Google Calendar & Drive, GitHub, Spotify…) so Apex can use them in chat.
 */
import { useEffect, useState, type ComponentType } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, ExternalLink, KeyRound, Link2, Loader2, LogIn, ShieldCheck, Sparkles, Unlink } from "lucide-react";
import { RiOpenaiFill } from "react-icons/ri";
import { SiAnthropic, SiGooglegemini, SiX, SiPerplexity, SiDeepseek, SiMistralai, SiMeta, SiElevenlabs, SiGoogle, SiGithub, SiSpotify, SiNotion, SiDiscord } from "react-icons/si";
import { authHeaders } from "@/lib/authSession";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Connector {
  id: string;
  name: string;
  kind: "key" | "oauth" | "signin";
  category: "ai" | "voice" | "apps";
  featured?: boolean;
  description: string;
  unlocks: string;
  color: string;
  keyUrl?: string;
  keyHint?: string;
  available: boolean;
  linked: boolean;
  accountLabel: string | null;
  setup?: { envKeys: string[]; callbackUrl: string };
}

const LOGOS: Record<string, ComponentType<{ size?: number; color?: string }>> = {
  openai: RiOpenaiFill, anthropic: SiAnthropic, gemini: SiGooglegemini, xai: SiX, perplexity: SiPerplexity,
  deepseek: SiDeepseek, mistral: SiMistralai, groq: SiMeta, elevenlabs: SiElevenlabs,
  google: SiGoogle, github: SiGithub, spotify: SiSpotify, notion: SiNotion, discord: SiDiscord,
};

const SECTIONS: { id: Connector["category"]; title: string; sub: string }[] = [
  { id: "ai", title: "Your AI accounts", sub: "Chat on your own AI account instead of Apex credits: no daily limits, billed by the provider." },
  { id: "voice", title: "Voice", sub: "Use your own voice plan for game characters." },
  { id: "apps", title: "Apps", sub: "Let Apex read from your accounts when you ask it something about them." },
];

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, { ...init, headers: { "Content-Type": "application/json", ...authHeaders(), ...init?.headers } });
  const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: T; error?: string } | null;
  if (!res.ok || !json?.ok) throw new Error(json?.error ?? `Something went wrong (${res.status})`);
  return json.data as T;
}

export default function ConnectorsPage() {
  const qc = useQueryClient();
  const [showKeys, setShowKeys] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const list = useQuery({ queryKey: ["connectors"], queryFn: () => call<{ connectors: Connector[] }>("/connectors") });

  // Back from linking an app: ?connected=github or ?connect_error=…
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const failed = params.get("connect_error");
    if (!connected && !failed) return;
    window.history.replaceState(null, "", window.location.pathname);
    const name = (id: string | null) => list.data?.connectors.find((c) => c.id === id)?.name ?? "The account";
    if (connected) setNotice({ tone: "ok", text: `${name(connected)} is linked.` });
    else setNotice({ tone: "error", text: failed === "cancelled" ? "Linking was cancelled." : `${name(params.get("connector"))} couldn't be linked. Try again.` });
  }, [list.data]);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["connectors"] });
    void qc.invalidateQueries({ queryKey: ["credits"] });
  };

  const connectors = list.data?.connectors ?? [];
  const linkedCount = connectors.filter((c) => c.linked).length;

  return (
    <div className="mg-font" style={{ flex: 1, overflowY: "auto", padding: "0 16px 48px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", display: "grid", gap: 20 }}>
        <header style={{ display: "grid", gap: 4 }}>
          <h1 className="mg-display" style={{ margin: 0, fontSize: 28, fontWeight: 700, color: "var(--mg-ink)" }}>Connectors</h1>
          <p style={{ margin: 0, fontSize: 14, color: "var(--mg-ink-2)", lineHeight: 1.5 }}>
            Bring your own AI subscriptions and apps into Apex.{linkedCount ? ` ${linkedCount} linked.` : ""}
          </p>
          <p style={{ margin: "6px 0 0", display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, color: "var(--mg-ink-3)", lineHeight: 1.45 }}>
            <ShieldCheck size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            Keys and tokens are encrypted and only used for your own requests. You can unlink any time.
          </p>
        </header>

        {notice && (
          <div role="status" style={{ padding: "10px 14px", borderRadius: 14, fontSize: 13.5, fontWeight: 600, color: notice.tone === "ok" ? "#86EFAC" : "#FCA5A5", background: notice.tone === "ok" ? "rgba(74,222,128,0.12)" : "rgba(248,113,113,0.12)", border: `1px solid ${notice.tone === "ok" ? "rgba(74,222,128,0.3)" : "rgba(248,113,113,0.3)"}` }}>
            {notice.text}
          </div>
        )}

        {list.isLoading && <div className="mg-cc-card" style={{ height: 120, borderWidth: 1, opacity: 0.5 }} />}
        {list.error && <p style={{ color: "#FCA5A5", fontSize: 14 }}>{(list.error as Error).message}</p>}

        {SECTIONS.map((section) => {
          const items = connectors.filter((c) => c.category === section.id);
          if (!items.length) return null;
          const featured = items.filter((c) => c.featured);
          const keys = items.filter((c) => !c.featured);
          // AI keys fold away behind the one-tap sign-in (open when one is already linked)
          const fold = section.id === "ai" && featured.length > 0;
          const keysOpen = showKeys || keys.some((c) => c.linked);
          return (
            <section key={section.id} style={{ display: "grid", gap: 10 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mg-ink-3)" }}>{section.title}</h2>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--mg-ink-2)", lineHeight: 1.45 }}>{section.sub}</p>
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                {featured.map((c) => <ConnectorCard key={c.id} c={c} onChange={refresh} onNotice={setNotice} />)}
                {fold && (
                  <button onClick={() => setShowKeys((v) => !v)} aria-expanded={keysOpen} className="mg-focus"
                    style={{ display: "flex", alignItems: "center", gap: 6, justifySelf: "start", background: "none", border: 0, padding: "4px 2px", fontSize: 13, fontWeight: 600, color: "var(--mg-ink-2)", cursor: "pointer" }}>
                    <KeyRound size={14} /> Or paste an API key from one provider
                    <ChevronDown size={14} style={{ transform: keysOpen ? "rotate(180deg)" : undefined, transition: "transform .2s" }} />
                  </button>
                )}
                {(!fold || keysOpen) && keys.map((c) => <ConnectorCard key={c.id} c={c} onChange={refresh} onNotice={setNotice} />)}
              </div>
            </section>
          );
        })}

        <p style={{ margin: 0, fontSize: 12.5, color: "var(--mg-ink-3)", lineHeight: 1.5 }}>
          Why not your ChatGPT Plus or Claude Pro login? Those plans only work inside OpenAI's and Anthropic's own apps; they don't let
          other apps use them. OpenRouter and API keys are pay-as-you-go instead, usually a few cents per chat.
        </p>
      </div>
    </div>
  );
}

function ConnectorCard({ c, onChange, onNotice }: { c: Connector; onChange: () => void; onNotice: (n: { tone: "ok" | "error"; text: string }) => void }) {
  const Logo = LOGOS[c.id];
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linkKey = async () => {
    setBusy(true); setError(null);
    try {
      await call(`/connectors/${c.id}/key`, { method: "POST", body: JSON.stringify({ key: key.trim() }) });
      setKey(""); setOpen(false); onChange();
      onNotice({ tone: "ok", text: `${c.name} is linked.` });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const linkApp = async () => {
    setBusy(true); setError(null);
    try {
      const { url } = await call<{ url: string }>(`/connectors/${c.id}/authorize`, { method: "POST", body: JSON.stringify({ returnTo: `${window.location.origin}${BASE}/connectors` }) });
      window.location.href = url;
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const unlink = async () => {
    setBusy(true);
    try {
      await call(`/connectors/${c.id}`, { method: "DELETE" });
      onChange();
      onNotice({ tone: "ok", text: `${c.name} was unlinked.` });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mg-cc-card" style={{ borderWidth: 1, borderRadius: 22, padding: 14, display: "grid", gap: 10, ...(c.featured ? { background: "linear-gradient(135deg, rgba(139,123,255,0.28), rgba(0,194,255,0.12))", borderColor: "rgba(139,123,255,0.55)" } : {}) }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ width: 44, height: 44, borderRadius: 14, display: "grid", placeItems: "center", flexShrink: 0, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)" }}>
          {Logo ? <Logo size={22} color={c.color} /> : <Link2 size={20} />}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: "var(--mg-ink)" }}>{c.name}</span>
            {c.linked && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 700, padding: "3px 8px", borderRadius: 99, color: "#86EFAC", background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.3)" }}>
                <Check size={12} /> Linked{c.accountLabel ? ` · ${c.accountLabel}` : ""}
              </span>
            )}
            {c.featured && !c.linked && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 700, padding: "3px 8px", borderRadius: 99, color: "#1C1640", background: "#FFD479" }}>
                <Sparkles size={11} /> Recommended
              </span>
            )}
            {!c.available && !c.linked && (
              <span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 8px", borderRadius: 99, color: "var(--mg-ink-3)", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}>Coming soon</span>
            )}
          </div>
          <div style={{ fontSize: 13, color: "var(--mg-ink-2)", marginTop: 2, lineHeight: 1.4 }}>{c.linked ? c.unlocks : c.description}</div>
        </div>
        {c.linked ? (
          <button onClick={unlink} disabled={busy} className="mg-press mg-focus" aria-label={`Unlink ${c.name}`}
            style={btn(false)}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Unlink size={15} />} Unlink</button>
        ) : c.kind === "key" ? (
          <button onClick={() => setOpen((o) => !o)} className="mg-press mg-focus" aria-expanded={open} style={btn(true)}>
            <KeyRound size={15} /> {open ? "Cancel" : "Add key"}
          </button>
        ) : (
          <button onClick={linkApp} disabled={busy || !c.available} className="mg-press mg-focus" style={{ ...btn(true), opacity: c.available ? 1 : 0.45, cursor: c.available ? "pointer" : "not-allowed" }}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : c.kind === "signin" ? <LogIn size={15} /> : <Link2 size={15} />} {c.kind === "signin" ? "Sign in" : "Connect"}
          </button>
        )}
      </div>

      {!c.linked && c.kind !== "key" && c.available && (
        <div style={{ fontSize: 12.5, color: "var(--mg-ink-3)" }}>{c.unlocks}</div>
      )}

      {open && !c.linked && c.kind === "key" && (
        <form onSubmit={(e) => { e.preventDefault(); if (key.trim()) void linkKey(); }} style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 12.5, color: "var(--mg-ink-2)", lineHeight: 1.45 }}>{c.unlocks}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="password" autoComplete="off" spellCheck={false} value={key} onChange={(e) => setKey(e.target.value)}
              placeholder={c.keyHint ? `Paste your key (${c.keyHint})` : "Paste your API key"} aria-label={`${c.name} API key`}
              style={{ flex: 1, minWidth: 0, height: 40, borderRadius: 12, padding: "0 12px", fontSize: 14, color: "var(--mg-ink)", background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.16)", outline: "none" }}
            />
            <button type="submit" disabled={busy || !key.trim()} className="mg-press mg-focus" style={{ ...btn(true), opacity: key.trim() ? 1 : 0.5 }}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : "Link"}
            </button>
          </div>
          {c.keyUrl && (
            <a href={c.keyUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12.5, color: "#A5B4FC", width: "fit-content" }}>
              Get a key from {c.name.split(" (")[0]} <ExternalLink size={12} />
            </a>
          )}
        </form>
      )}

      {error && <div role="alert" style={{ fontSize: 12.5, color: "#FCA5A5" }}>{error}</div>}

      {c.setup && !c.available && (
        <div style={{ fontSize: 12, color: "var(--mg-ink-3)", lineHeight: 1.5, padding: "8px 10px", borderRadius: 12, background: "rgba(255,212,121,0.07)", border: "1px dashed rgba(255,212,121,0.3)" }}>
          <strong style={{ color: "#FFD479" }}>Owner setup:</strong> create an OAuth app with {c.name.split(" ")[0]}, use redirect URL{" "}
          <code style={{ wordBreak: "break-all" }}>{c.setup.callbackUrl}</code>, then add {c.setup.envKeys.map((k) => <code key={k} style={{ marginRight: 4 }}>{k}</code>)} on Render.
        </div>
      )}
    </div>
  );
}

function btn(primary: boolean): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 6, height: 36, padding: "0 14px", borderRadius: 12, flexShrink: 0,
    fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
    color: primary ? "#1C1640" : "var(--mg-ink)", background: primary ? "#fff" : "rgba(255,255,255,0.08)",
    border: primary ? "0" : "1px solid rgba(255,255,255,0.16)",
  };
}
