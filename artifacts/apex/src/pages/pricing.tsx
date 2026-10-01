/**
 * Pricing — Free, Pro ($14.99/mo or $129/yr) and credit packs that never expire.
 * Checkout runs on Stripe; prices come from the server (GET /store).
 */
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Crown, Loader2, Sparkles, Zap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCredits } from "@/hooks/useCredits";
import { authHeaders } from "@/lib/authSession";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Store {
  stripeReady: boolean;
  pro: { monthlyCents: number; yearlyCents: number };
  packs: { id: string; credits: number; priceCents: number; name: string }[];
}

const money = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;

async function post(path: string, body: unknown): Promise<string> {
  const res = await fetch(`${BASE}/api${path}`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => null)) as { data?: { url: string }; error?: string } | null;
  if (!res.ok || !json?.data?.url) throw new Error(json?.error ?? "Something went wrong. Try again.");
  return json.data.url;
}

const FREE = ["20 AI credits every day", "Every AI model", "Builder, Games and Engine", "Connectors: use your own AI account"];
const PRO = ["60 AI credits every day (3x Free)", "Every AI model, including Claude and Grok", "Bigger builds and more projects", "Priority for new features"];

export default function PricingPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: credits } = useCredits();
  const [yearly, setYearly] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const store = useQuery({
    queryKey: ["store"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/store`);
      return ((await res.json()) as { data: Store }).data;
    },
  });

  const isPro = credits?.tier === "pro" || credits?.tier === "enterprise" || (user?.subscriptionTier && user.subscriptionTier !== "free");

  // Back from Stripe
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get("checkout");
    const bought = params.get("credits");
    if (!checkout && !bought) return;
    window.history.replaceState(null, "", window.location.pathname);
    if (checkout === "success") setNotice({ tone: "ok", text: "Welcome to Pro! Your new credits are ready (it can take a few seconds to show)." });
    else if (bought === "success") setNotice({ tone: "ok", text: "Credits added! They never expire (it can take a few seconds to show)." });
    else setNotice({ tone: "error", text: "Checkout was cancelled. You weren't charged." });
    const t = setTimeout(() => void qc.invalidateQueries({ queryKey: ["credits"] }), 3000);
    return () => clearTimeout(t);
  }, [qc]);

  const go = async (key: string, path: string, body: unknown) => {
    setBusy(key); setNotice(null);
    try {
      window.location.href = await post(path, { ...(body as object), returnTo: `${window.location.origin}${BASE}/pricing` });
    } catch (err) {
      setNotice({ tone: "error", text: (err as Error).message });
      setBusy(null);
    }
  };

  const s = store.data;
  const ready = !!s?.stripeReady;
  const proPrice = s ? (yearly ? s.pro.yearlyCents : s.pro.monthlyCents) : yearly ? 12900 : 1499;

  return (
    <div className="mg-font" style={{ flex: 1, overflowY: "auto", padding: "0 16px 48px" }}>
      <div style={{ maxWidth: 820, margin: "0 auto", display: "grid", gap: 20 }}>
        <header style={{ textAlign: "center", display: "grid", gap: 6, paddingTop: 4 }}>
          <h1 className="mg-display" style={{ margin: 0, fontSize: 30, fontWeight: 700, color: "var(--mg-ink)" }}>Plans & credits</h1>
          <p style={{ margin: 0, fontSize: 14.5, color: "var(--mg-ink-2)" }}>Every reply costs 1 to 3 credits depending on the model. Cheaper models stretch your credits further.</p>
          {credits && !credits.unlimited && (
            <p style={{ margin: 0, fontSize: 13, color: "var(--mg-ink-3)" }}>
              You have {credits.dailyRemaining ?? credits.remaining} of {credits.limit} daily credits left{credits.purchased ? ` + ${credits.purchased} bought credits` : ""}.
            </p>
          )}
        </header>

        {notice && (
          <div role="status" style={{ padding: "10px 14px", borderRadius: 14, fontSize: 13.5, fontWeight: 600, textAlign: "center", color: notice.tone === "ok" ? "#86EFAC" : "#FCA5A5", background: notice.tone === "ok" ? "rgba(74,222,128,0.12)" : "rgba(248,113,113,0.12)", border: `1px solid ${notice.tone === "ok" ? "rgba(74,222,128,0.3)" : "rgba(248,113,113,0.3)"}` }}>
            {notice.text}
          </div>
        )}
        {s && !ready && (
          <div style={{ padding: "10px 14px", borderRadius: 14, fontSize: 13.5, textAlign: "center", color: "#FFD479", background: "rgba(255,212,121,0.08)", border: "1px dashed rgba(255,212,121,0.35)" }}>
            Payments are being set up. Upgrades and credit packs will open here soon.
          </div>
        )}

        {/* Monthly / yearly */}
        <div role="radiogroup" aria-label="Billing period" style={{ justifySelf: "center", display: "flex", gap: 4, padding: 4, borderRadius: 16, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}>
          {[["Monthly", false], ["Yearly · save 28%", true]].map(([label, val]) => (
            <button key={String(label)} role="radio" aria-checked={yearly === val} onClick={() => setYearly(val as boolean)} className="mg-focus"
              style={{ height: 34, padding: "0 16px", borderRadius: 12, border: 0, fontSize: 13, fontWeight: 700, cursor: "pointer", color: yearly === val ? "#1C1640" : "var(--mg-ink-2)", background: yearly === val ? "#fff" : "transparent" }}>
              {label as string}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          <PlanCard icon={<Sparkles size={18} />} name="Free" price="$0" sub="forever" features={FREE}
            action={<span style={{ fontSize: 13, color: "var(--mg-ink-3)" }}>{isPro ? "Included" : "Your current plan"}</span>} />
          <PlanCard icon={<Crown size={18} />} name="Pro" featured price={money(proPrice)} sub={yearly ? "per year" : "per month"} features={PRO}
            action={isPro ? (
              <button onClick={() => void go("portal", "/store/portal", {})} disabled={!!busy || !ready} className="mg-press mg-focus" style={btn(false)}>
                {busy === "portal" ? <Loader2 size={15} className="animate-spin" /> : null} Manage subscription
              </button>
            ) : (
              <button onClick={() => void go("pro", "/store/pro/checkout", { interval: yearly ? "year" : "month" })} disabled={!!busy || !ready} className="mg-press mg-focus" style={{ ...btn(true), opacity: ready ? 1 : 0.5 }}>
                {busy === "pro" ? <Loader2 size={15} className="animate-spin" /> : <Crown size={15} />} Upgrade to Pro
              </button>
            )} />
        </div>

        {/* Credit packs */}
        <section id="packs" style={{ display: "grid", gap: 10 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mg-ink-3)" }}>Credit packs</h2>
            <p style={{ margin: "4px 0 0", fontSize: 13.5, color: "var(--mg-ink-2)" }}>One-time top-ups that never expire. They're used after your daily credits run out.</p>
          </div>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
            {(s?.packs ?? []).map((p, i) => (
              <div key={p.id} className="mg-cc-card" style={{ borderWidth: 1, borderRadius: 20, padding: 16, display: "grid", gap: 8, textAlign: "center", ...(i === 1 ? { borderColor: "rgba(139,123,255,0.6)" } : {}) }}>
                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 22, fontWeight: 700, color: "var(--mg-ink)" }} className="mg-display">
                  <Zap size={18} color="#FFD479" /> {p.credits}
                </span>
                <span style={{ fontSize: 12.5, color: "var(--mg-ink-3)" }}>credits · {(p.priceCents / p.credits).toFixed(2).replace(/^0/, "")}¢ each</span>
                <button onClick={() => void go(p.id, "/store/credits/checkout", { packId: p.id })} disabled={!!busy || !ready} className="mg-press mg-focus" style={{ ...btn(i === 1), justifyContent: "center", opacity: ready ? 1 : 0.5 }}>
                  {busy === p.id ? <Loader2 size={15} className="animate-spin" /> : null} Buy for {money(p.priceCents)}
                </button>
              </div>
            ))}
          </div>
        </section>

        <p style={{ margin: 0, textAlign: "center", fontSize: 12.5, color: "var(--mg-ink-3)", lineHeight: 1.5 }}>
          Want no limits? Link your own AI account in <a href={`${BASE}/connectors`} style={{ color: "#A5B4FC" }}>Connectors</a> and replies on it don't use credits.
          Payments are handled by Stripe. Cancel any time. See the <a href={`${BASE}/terms`} style={{ color: "#A5B4FC" }}>Terms</a>.
        </p>
      </div>
    </div>
  );
}

function PlanCard({ icon, name, price, sub, features, action, featured }: { icon: React.ReactNode; name: string; price: string; sub: string; features: string[]; action: React.ReactNode; featured?: boolean }) {
  return (
    <div className="mg-cc-card" style={{ borderWidth: 1, borderRadius: 24, padding: 18, display: "grid", gap: 12, alignContent: "start", ...(featured ? { background: "linear-gradient(135deg, rgba(139,123,255,0.28), rgba(0,194,255,0.12))", borderColor: "rgba(139,123,255,0.55)" } : {}) }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: featured ? "#FFD479" : "var(--mg-ink-2)" }}>
        {icon}<span style={{ fontWeight: 700, fontSize: 15, color: "var(--mg-ink)" }}>{name}</span>
      </div>
      <div><span className="mg-display" style={{ fontSize: 34, fontWeight: 700, color: "var(--mg-ink)" }}>{price}</span> <span style={{ fontSize: 13, color: "var(--mg-ink-3)" }}>{sub}</span></div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 7 }}>
        {features.map((f) => (
          <li key={f} style={{ display: "flex", gap: 8, fontSize: 13.5, color: "var(--mg-ink-2)" }}><Check size={15} color="#86EFAC" style={{ flexShrink: 0, marginTop: 2 }} />{f}</li>
        ))}
      </ul>
      <div>{action}</div>
    </div>
  );
}

function btn(primary: boolean): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 6, height: 40, padding: "0 16px", borderRadius: 12, width: "100%", justifyContent: "center",
    fontSize: 13.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
    color: primary ? "#1C1640" : "var(--mg-ink)", background: primary ? "#fff" : "rgba(255,255,255,0.08)",
    border: primary ? "0" : "1px solid rgba(255,255,255,0.16)",
  };
}
