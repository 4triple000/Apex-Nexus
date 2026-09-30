/**
 * Usage & plan — today's AI credits and the ways to get more. The owner also sees what the
 * AI keys are costing: estimated spend by day, by model and by user.
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Crown, KeyRound, Zap } from "lucide-react";
import { useGetVoteStats } from "@workspace/api-client-react";
import { useCredits, resetsIn, openCreditsSheet } from "@/hooks/useCredits";
import { authHeaders } from "@/lib/authSession";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const BAR = "#8B7BFF";
const label: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mg-ink-3)", margin: 0 };
const card: React.CSSProperties = { borderWidth: 1, borderRadius: 22, padding: 16, display: "grid", gap: 12 };

const NAMES: Record<string, string> = {
  openai: "ChatGPT", claude: "Claude", perplexity: "Perplexity", gemini: "Gemini", grok: "Grok",
  deepseek: "DeepSeek", mistral: "Mistral", llama: "Llama", elevenlabs: "ElevenLabs voice",
};

const usd = (n: number) => (n >= 100 ? `$${n.toFixed(0)}` : n >= 1 ? `$${n.toFixed(2)}` : `$${n.toFixed(3)}`);

export default function Usage() {
  const [, nav] = useLocation();
  const { data: credits, isLoading } = useCredits();
  const pct = credits && !credits.unlimited ? Math.min(1, credits.used / Math.max(1, credits.limit)) : 0;
  const isPaid = credits?.tier === "pro" || credits?.tier === "enterprise";

  return (
    <div className="mg-font" style={{ flex: 1, overflowY: "auto", padding: "0 16px 48px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", display: "grid", gap: 18 }}>
        <header>
          <h1 className="mg-display" style={{ margin: 0, fontSize: 28, fontWeight: 700, color: "var(--mg-ink)" }}>Usage & plan</h1>
          <p style={{ margin: "4px 0 0", fontSize: 14, color: "var(--mg-ink-2)" }}>
            {credits ? `${credits.isOwner ? "Owner" : credits.tier === "free" ? "Free" : credits.tier[0]!.toUpperCase() + credits.tier.slice(1)} plan` : "Your AI credits"}
          </p>
        </header>

        {/* Today's credits */}
        <section className="mg-cc-card" style={card} aria-label="Today's credits">
          <p style={label}>Today's AI credits</p>
          {isLoading || !credits ? (
            <div style={{ height: 60, opacity: 0.4 }} />
          ) : credits.unlimited ? (
            <div className="mg-display" style={{ fontSize: 30, fontWeight: 700, color: "var(--mg-ink)" }}>Unlimited</div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <span className="mg-display" style={{ fontSize: 40, fontWeight: 700, color: "var(--mg-ink)" }}>{credits.remaining}</span>
                <span style={{ fontSize: 14, color: "var(--mg-ink-2)" }}>of {credits.limit} left · resets {resetsIn(credits.resetsAt)}</span>
              </div>
              <div role="progressbar" aria-valuemin={0} aria-valuemax={credits.limit} aria-valuenow={credits.used} aria-label="Credits used today"
                style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
                <div style={{ width: `${pct * 100}%`, height: "100%", borderRadius: 4, background: pct >= 0.8 ? "#FFD479" : BAR }} />
              </div>
            </>
          )}
          <button onClick={() => openCreditsSheet("info")} className="mg-focus" style={{ justifySelf: "start", background: "none", border: 0, padding: 0, color: "#A5B4FC", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            What does each model cost?
          </button>
        </section>

        {/* Ways to get more */}
        {credits && !credits.isOwner && (
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            {!isPaid && (
              <Tile icon={<Crown size={18} />} accent="#FFD479" title="Upgrade to Pro" sub="20x the credits every day." onClick={() => nav("/pricing")} />
            )}
            <Tile icon={<KeyRound size={18} />} accent="#86EFAC" title="Use your own AI account" sub="Replies on your own key are free and unlimited." onClick={() => nav("/connectors")} />
          </div>
        )}

        {credits?.isOwner && <OwnerSpending />}

        <Leaderboard />
      </div>
    </div>
  );
}

function Tile({ icon, accent, title, sub, onClick }: { icon: React.ReactNode; accent: string; title: string; sub: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="mg-cc-card mg-press mg-focus" style={{ borderWidth: 1, borderRadius: 20, padding: 14, display: "flex", gap: 12, alignItems: "center", textAlign: "left", cursor: "pointer", color: "var(--mg-ink)" }}>
      <span style={{ width: 38, height: 38, borderRadius: 12, display: "grid", placeItems: "center", color: accent, background: "rgba(255,255,255,0.07)", flexShrink: 0 }}>{icon}</span>
      <span style={{ display: "grid", gap: 2 }}>
        <span style={{ fontWeight: 700, fontSize: 14.5 }}>{title}</span>
        <span style={{ fontSize: 12.5, color: "var(--mg-ink-2)" }}>{sub}</span>
      </span>
    </button>
  );
}

// ── Owner: what the AI keys cost ──────────────────────────────────────────────

interface Spending {
  days: number;
  totals: { costUsd: number; messages: number; ownKeyMessages: number; credits: number; users: number };
  byDay: { day: string; costUsd: number; messages: number }[];
  byModel: { provider: string; costUsd: number; messages: number }[];
  topUsers: { userId: number | null; username: string | null; email: string | null; tier: string | null; costUsd: number; messages: number }[];
}

function OwnerSpending() {
  const [days, setDays] = useState(7);
  const { data, isLoading, error } = useQuery({
    queryKey: ["credits-admin", days],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/credits/admin?days=${days}`, { headers: authHeaders() });
      const json = (await res.json()) as { ok: boolean; data: Spending; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Couldn't load spending");
      return json.data;
    },
    refetchInterval: 120_000,
  });

  // Fill in days with no usage so the bars line up with the calendar
  const series: { day: string; costUsd: number; messages: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    series.push(data?.byDay.find((d) => d.day === day) ?? { day, costUsd: 0, messages: 0 });
  }
  const today = series[series.length - 1];
  const maxDay = Math.max(0.0001, ...series.map((d) => d.costUsd));
  const maxModel = Math.max(0.0001, ...(data?.byModel.map((m) => m.costUsd) ?? [0]));
  const perUser = data && data.totals.users ? data.totals.costUsd / data.totals.users : 0;
  const ownShare = data && data.totals.messages ? Math.round((data.totals.ownKeyMessages / data.totals.messages) * 100) : 0;

  return (
    <section style={{ display: "grid", gap: 12 }} aria-label="AI spending (owner only)">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <p style={label}>AI spending · only you see this</p>
          <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--mg-ink-3)" }}>Estimated from token counts. Check each provider's billing page for exact totals.</p>
        </div>
        <div role="radiogroup" aria-label="Time range" style={{ display: "flex", gap: 4, padding: 3, borderRadius: 12, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}>
          {[7, 30].map((d) => (
            <button key={d} role="radio" aria-checked={days === d} onClick={() => setDays(d)} className="mg-focus"
              style={{ height: 28, padding: "0 12px", borderRadius: 9, border: 0, fontSize: 12.5, fontWeight: 700, cursor: "pointer", color: days === d ? "#1C1640" : "var(--mg-ink-2)", background: days === d ? "#fff" : "transparent" }}>
              {d} days
            </button>
          ))}
        </div>
      </div>

      {error && <p style={{ color: "#FCA5A5", fontSize: 13.5, margin: 0 }}>{(error as Error).message}</p>}

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        <Stat title={`Last ${days} days`} value={data ? usd(data.totals.costUsd) : "…"} note="estimated cost" />
        <Stat title="Today" value={today ? usd(today.costUsd) : "…"} note={`${today?.messages ?? 0} replies`} />
        <Stat title="Per active user" value={data ? usd(perUser) : "…"} note={`${data?.totals.users ?? 0} user${data?.totals.users === 1 ? "" : "s"}`} />
        <Stat title="On users' own keys" value={data ? `${ownShare}%` : "…"} note="of replies (cost you $0)" />
      </div>

      {/* Daily cost */}
      <div className="mg-cc-card" style={card}>
        <p style={{ ...label, textTransform: "none", letterSpacing: 0, fontSize: 13.5, color: "var(--mg-ink)" }}>Estimated cost per day</p>
        {isLoading ? <div style={{ height: 140, opacity: 0.4 }} /> : (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 140, borderBottom: "1px solid rgba(255,255,255,0.14)" }}>
            {series.map((d) => (
              <DayBar key={d.day} day={d} height={(d.costUsd / maxDay) * 100} />
            ))}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--mg-ink-3)" }}>
          <span>{shortDay(series[0]!.day)}</span><span>max {usd(maxDay)}</span><span>{shortDay(series[series.length - 1]!.day)}</span>
        </div>
      </div>

      {/* By model */}
      <div className="mg-cc-card" style={card}>
        <p style={{ ...label, textTransform: "none", letterSpacing: 0, fontSize: 13.5, color: "var(--mg-ink)" }}>Cost by model</p>
        {!data?.byModel.length ? <p style={{ margin: 0, fontSize: 13, color: "var(--mg-ink-3)" }}>No AI usage in this period yet.</p> : (
          <div style={{ display: "grid", gap: 8 }}>
            {data.byModel.map((m) => (
              <div key={m.provider} style={{ display: "grid", gridTemplateColumns: "96px 1fr auto", alignItems: "center", gap: 10, fontSize: 13 }}
                title={`${NAMES[m.provider] ?? m.provider}: ${usd(m.costUsd)} over ${m.messages} replies`}>
                <span style={{ color: "var(--mg-ink-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{NAMES[m.provider] ?? m.provider}</span>
                <span style={{ height: 10, borderRadius: 2, background: "rgba(255,255,255,0.06)" }}>
                  <span style={{ display: "block", height: "100%", width: `${Math.max(1, (m.costUsd / maxModel) * 100)}%`, background: BAR, borderRadius: "0 4px 4px 0" }} />
                </span>
                <span style={{ color: "var(--mg-ink)", fontVariantNumeric: "tabular-nums", minWidth: 110, textAlign: "right" }}>{usd(m.costUsd)} · {m.messages}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Heaviest users */}
      <div className="mg-cc-card" style={{ ...card, overflowX: "auto" }}>
        <p style={{ ...label, textTransform: "none", letterSpacing: 0, fontSize: 13.5, color: "var(--mg-ink)" }}>Heaviest users</p>
        {!data?.topUsers.length ? <p style={{ margin: 0, fontSize: 13, color: "var(--mg-ink-3)" }}>Nobody yet.</p> : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "var(--mg-ink-3)", textAlign: "left" }}>
                <th style={th}>User</th><th style={th}>Plan</th><th style={{ ...th, textAlign: "right" }}>Replies</th><th style={{ ...th, textAlign: "right" }}>Est. cost</th>
              </tr>
            </thead>
            <tbody>
              {data.topUsers.map((u) => (
                <tr key={u.userId ?? "guest"} style={{ borderTop: "1px solid rgba(255,255,255,0.08)", color: "var(--mg-ink)" }}>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>{u.username ?? "Unknown"}</div>
                    <div style={{ fontSize: 11.5, color: "var(--mg-ink-3)" }}>{u.email}</div>
                  </td>
                  <td style={{ ...td, color: "var(--mg-ink-2)" }}>{u.tier ?? "free"}</td>
                  <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{u.messages}</td>
                  <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{usd(u.costUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

const th: React.CSSProperties = { padding: "6px 8px", fontWeight: 600, fontSize: 11.5 };
const td: React.CSSProperties = { padding: "8px" };
const shortDay = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString([], { month: "short", day: "numeric" });

function DayBar({ day, height }: { day: { day: string; costUsd: number; messages: number }; height: number }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      tabIndex={0}
      aria-label={`${shortDay(day.day)}: ${usd(day.costUsd)}, ${day.messages} replies`}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onFocus={() => setHover(true)} onBlur={() => setHover(false)}
      style={{ position: "relative", flex: 1, height: "100%", display: "flex", alignItems: "flex-end", cursor: "default", outline: "none" }}
    >
      <div style={{ width: "100%", height: `${Math.max(day.costUsd > 0 ? 2 : 0, height)}%`, background: BAR, opacity: hover ? 1 : 0.85, borderRadius: "4px 4px 0 0" }} />
      {hover && (
        <div role="tooltip" style={{ position: "absolute", bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap", padding: "6px 9px", borderRadius: 10, fontSize: 12, color: "var(--mg-ink)", background: "rgba(20,16,48,0.96)", border: "1px solid rgba(255,255,255,0.16)", zIndex: 2, pointerEvents: "none" }}>
          <strong>{shortDay(day.day)}</strong> · {usd(day.costUsd)} · {day.messages} replies
        </div>
      )}
    </div>
  );
}

function Stat({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <div className="mg-cc-card" style={{ borderWidth: 1, borderRadius: 18, padding: 14, display: "grid", gap: 2 }}>
      <span style={{ fontSize: 12, color: "var(--mg-ink-3)" }}>{title}</span>
      <span className="mg-display" style={{ fontSize: 24, fontWeight: 700, color: "var(--mg-ink)", fontVariantNumeric: "tabular-nums" }}>{value}</span>
      <span style={{ fontSize: 11.5, color: "var(--mg-ink-3)" }}>{note}</span>
    </div>
  );
}

// ── Battle leaderboard (kept from the old page) ───────────────────────────────

function Leaderboard() {
  const { data } = useGetVoteStats();
  if (!data || data.total === 0) return null;
  const rows = [...data.providers].sort((a, b) => b.votes - a.votes);
  return (
    <section className="mg-cc-card" style={card} aria-label="AI Battle leaderboard">
      <p style={label}><Zap size={11} style={{ verticalAlign: -1 }} /> Battle leaderboard · {data.total} votes</p>
      {rows.map((p) => (
        <div key={p.provider} style={{ display: "grid", gridTemplateColumns: "96px 1fr auto", alignItems: "center", gap: 10, fontSize: 13 }}>
          <span style={{ color: "var(--mg-ink-2)" }}>{NAMES[p.provider] ?? p.provider}</span>
          <span style={{ height: 10, borderRadius: 2, background: "rgba(255,255,255,0.06)" }}>
            <span style={{ display: "block", height: "100%", width: `${p.percentage}%`, background: BAR, borderRadius: "0 4px 4px 0" }} />
          </span>
          <span style={{ color: "var(--mg-ink)", fontVariantNumeric: "tabular-nums" }}>{p.votes} · {p.percentage}%</span>
        </div>
      ))}
    </section>
  );
}
