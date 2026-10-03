/**
 * Credits sheet — how many AI credits are left today, what each model costs, and the ways to get more
 * (upgrade, link your own AI key, or come back tomorrow). Opens from the credits pill or when a chat
 * runs out. Mounted once; open it with openCreditsSheet().
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { X, Zap, KeyRound, Flame, Crown } from "lucide-react";
import { useCredits, resetsIn } from "@/hooks/useCredits";

const MODEL_NAMES: Record<string, string> = {
  free: "Apex Free", llama: "Llama", deepseek: "DeepSeek", gemini: "Gemini", mistral: "Mistral",
  openai: "ChatGPT", grok: "Grok", perplexity: "Perplexity", claude: "Claude", elevenlabs: "Voice line",
};

export function CreditsSheetHost() {
  const [open, setOpen] = useState<{ reason: "info" | "out"; message?: string } | null>(null);
  const { data, refetch } = useCredits();
  const [, nav] = useLocation();

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<{ reason: "info" | "out"; message?: string }>).detail;
      setOpen(detail ?? { reason: "info" });
      void refetch();
    };
    window.addEventListener("apex:credits-sheet", onOpen);
    return () => window.removeEventListener("apex:credits-sheet", onOpen);
  }, [refetch]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;
  const go = (to: string) => { setOpen(null); nav(to); };
  const out = open.reason === "out";
  const pct = data && !data.unlimited ? Math.min(1, data.used / Math.max(1, data.limit)) : 0;
  const costs = Object.entries(data?.costs ?? {}).filter(([id]) => MODEL_NAMES[id]).sort((a, b) => a[1] - b[1]);
  const isPaid = data?.tier === "pro" || data?.tier === "enterprise";

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="AI credits" onClick={() => setOpen(null)}
      className="mg-font"
      style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(6,5,18,0.6)", backdropFilter: "blur(6px)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 12 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 460, maxHeight: "88vh", overflowY: "auto", borderRadius: 28, padding: "22px 20px 20px", background: "linear-gradient(180deg, rgba(40,32,92,0.98), rgba(20,16,48,0.98))", border: "1px solid rgba(255,255,255,0.16)", boxShadow: "0 30px 80px rgba(0,0,0,0.5)", color: "var(--mg-ink)", display: "grid", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h2 className="mg-display" style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
              {out ? "You're out of credits for today" : "Your AI credits"}
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 13.5, color: "var(--mg-ink-2)", lineHeight: 1.45 }}>
              {open.message ?? (data?.unlimited ? "You have unlimited credits." : `Credits reset ${data ? resetsIn(data.resetsAt) : "at midnight"}.`)}
            </p>
          </div>
          <button onClick={() => setOpen(null)} aria-label="Close" className="mg-cc mg-focus" style={{ width: 34, height: 34, flexShrink: 0 }}><X size={16} /></button>
        </div>

        {data && !data.unlimited && (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span className="mg-display" style={{ fontSize: 34, fontWeight: 700 }}>{data.remaining}</span>
              <span style={{ fontSize: 13.5, color: "var(--mg-ink-2)" }}>
                left ({data.dailyRemaining ?? data.remaining} of {data.limit} daily{data.bonus ? `, incl. +${data.bonus} bonus` : ""}{data.purchased ? ` + ${data.purchased} bought` : ""})
              </span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
              <div style={{ width: `${(1 - pct) * 100}%`, height: "100%", borderRadius: 4, background: pct >= 0.8 ? "#FFD479" : "linear-gradient(90deg,#8B7BFF,#5BC0FF)" }} />
            </div>
          </div>
        )}

        {/* Ways to get more */}
        <div style={{ display: "grid", gap: 8 }}>
          {!isPaid && !data?.isOwner && (
            <Option icon={<Crown size={18} />} accent="#FFD479" title="Upgrade to Pro" sub="60 credits every day (3x Free) for $14.99 a month." onClick={() => go("/pricing")} primary />
          )}
          <Option icon={<Zap size={18} />} accent="#FFD479" title="Buy a credit pack" sub="300 credits ($5) · 600 credits ($8) · 900 credits ($12). They never expire." onClick={() => go("/pricing#packs")} />
          <Option icon={<KeyRound size={18} />} accent="#86EFAC" title="Use your own AI account" sub="Sign in with OpenRouter (or add an API key) and chat on your own account with no daily limit." onClick={() => go("/connectors")} />
          {out && (
            <Option icon={<Zap size={18} />} accent="#8B7BFF" title="Try a lighter model" sub="Llama, DeepSeek and Gemini cost 1 credit per reply." onClick={() => setOpen(null)} />
          )}
          <Option icon={<Flame size={18} />} accent="#FF8A4C" title="Keep your streak going" sub="Day 3 of your 7-day streak adds +10 bonus credits." onClick={() => setOpen(null)} />
        </div>

        {/* What each model costs */}
        {costs.length > 0 && (
          <div style={{ display: "grid", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mg-ink-3)" }}>Credits per reply</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {costs.map(([id, cost]) => {
                const own = data?.ownKeys?.includes(id);
                return (
                  <span key={id} style={{ fontSize: 12, fontWeight: 600, padding: "5px 10px", borderRadius: 99, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "var(--mg-ink-2)" }}>
                    {MODEL_NAMES[id]} · {own ? "free (your key)" : `${cost}`}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function Option({ icon, accent, title, sub, onClick, primary }: { icon: React.ReactNode; accent: string; title: string; sub: string; onClick: () => void; primary?: boolean }) {
  return (
    <button onClick={onClick} className="mg-press mg-focus"
      style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "left", padding: "12px 14px", borderRadius: 18, cursor: "pointer", color: "var(--mg-ink)", background: primary ? "rgba(255,212,121,0.12)" : "rgba(255,255,255,0.06)", border: `1px solid ${primary ? "rgba(255,212,121,0.4)" : "rgba(255,255,255,0.12)"}` }}>
      <span style={{ width: 38, height: 38, borderRadius: 12, display: "grid", placeItems: "center", flexShrink: 0, color: accent, background: "rgba(255,255,255,0.07)" }}>{icon}</span>
      <span style={{ display: "grid", gap: 2 }}>
        <span style={{ fontWeight: 700, fontSize: 14.5 }}>{title}</span>
        <span style={{ fontSize: 12.5, color: "var(--mg-ink-2)", lineHeight: 1.4 }}>{sub}</span>
      </span>
    </button>
  );
}
