/**
 * The ☰ menu: Control Center style bubbles for the screens that aren't in the tab bar,
 * and the 7-day streak that lights up by itself when the user opens and uses the app.
 */
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Store, Workflow, Users, Compass, Mic, Smile, BarChart3, Settings, Wrench, X, Flame, type LucideIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { clearEarned, useDailyStreak } from "@/lib/dailyStreak";

const BUBBLES: { label: string; to: string; icon: LucideIcon }[] = [
  { label: "Marketplace", to: "/marketplace", icon: Store },
  { label: "Workflows",   to: "/workflows",   icon: Workflow },
  { label: "Social",      to: "/feed",        icon: Users },
  { label: "Explore",     to: "/explore",     icon: Compass },
  { label: "Voice",       to: "/apex-os",     icon: Mic },
  { label: "Avatar",      to: "/apex-avatar", icon: Smile },
  { label: "Insights",    to: "/insights",    icon: BarChart3 },
  { label: "Settings",    to: "/settings",    icon: Settings },
];

export function ApexControlPanel() {
  const [open, setOpen] = useState(false);
  const [location, nav] = useLocation();
  const isOwner = !!useAuth().user?.isOwner;
  const close = () => setOpen(false);
  const go = (to: string) => { close(); nav(to); };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* ☰ button (Settings has its own back button instead) */}
      {location !== "/settings" && <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        className="mg-cc mg-focus"
        style={{ position: "fixed", top: 14, left: 16, zIndex: 55, width: 42, height: 42, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, padding: 0, cursor: "pointer" }}
      >
        {[18, 12, 18].map((w, i) => (
          <span key={i} style={{ width: w, height: 2.2, borderRadius: 2, background: "#fff" }} />
        ))}
      </button>}

      {/* Dim */}
      <div
        onClick={close}
        aria-hidden
        style={{ position: "fixed", inset: 0, zIndex: 58, background: "rgba(8,7,20,0.45)", opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity .25s" }}
      />

      {/* Sheet */}
      <aside
        aria-label="Menu"
        aria-hidden={!open}
        className="mg-font"
        style={{
          position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 60,
          width: "min(320px, 82vw)", padding: "22px 16px 20px",
          display: "flex", flexDirection: "column", gap: 18, overflowY: "auto",
          background: "linear-gradient(180deg, rgba(38,34,78,0.74), rgba(22,19,48,0.84))",
          backdropFilter: "blur(28px) saturate(170%)", WebkitBackdropFilter: "blur(28px) saturate(170%)",
          borderRight: "1.5px solid rgba(255,255,255,0.16)", boxShadow: "24px 0 50px rgba(0,0,0,0.35)",
          transform: open ? "translateX(0)" : "translateX(-105%)",
          transition: "transform .34s cubic-bezier(.25,.46,.45,.94)",
          visibility: open ? "visible" : "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 4 }}>
          <span className="mg-display" style={{ fontSize: 22, fontWeight: 700, color: "var(--mg-ink)" }}>Apex</span>
          <div style={{ display: "flex", gap: 8 }}>
            {isOwner && (
              <button onClick={() => go("/dev-cockpit")} aria-label="Dev Cockpit" title="Dev Cockpit" className="mg-cc mg-focus" style={{ width: 38, height: 38, color: "#FFCF8A", borderColor: "rgba(255,207,138,0.7)" }}>
                <Wrench size={16} strokeWidth={2.2} />
              </button>
            )}
            <button onClick={close} aria-label="Close menu" className="mg-cc mg-focus" style={{ width: 38, height: 38 }}>
              <X size={16} strokeWidth={2.2} />
            </button>
          </div>
        </div>

        <nav style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 8px", justifyItems: "center" }}>
          {BUBBLES.map(({ label, to, icon: Icon }) => {
            const here = location === to || location.startsWith(`${to}/`);
            return (
              <button key={to} onClick={() => go(to)} aria-current={here ? "page" : undefined} className="mg-bubble mg-focus" style={{ display: "grid", justifyItems: "center", gap: 7, background: "none", border: 0, padding: 0, cursor: "pointer" }}>
                <span className={`mg-cc${here ? " on" : ""}`} style={{ width: 66, height: 66 }}>
                  <Icon size={26} strokeWidth={2.2} />
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--mg-ink-2)" }}>{label}</span>
              </button>
            );
          })}
        </nav>

        <StreakCard />
      </aside>
    </>
  );
}

/** Seven circles. Nothing to tap: today's lights up by itself after the first interaction of the day. */
function StreakCard() {
  const s = useDailyStreak();
  const qc = useQueryClient();
  const [lighting, setLighting] = useState(false);
  const prevDay = useRef<number | null>(null);

  const lit = s?.cycleDay ?? 0;
  useEffect(() => {
    const prev = prevDay.current;
    prevDay.current = lit;
    if (prev === null || lit <= prev) return;
    setLighting(true);
    const t = setTimeout(() => setLighting(false), 1200);
    return () => clearTimeout(t);
  }, [lit]);

  useEffect(() => {
    if (s?.earned === "bonus") void qc.invalidateQueries({ queryKey: ["daily-usage"] });
  }, [s?.earned, qc]);

  if (!s) {
    return (
      <div className="mg-cc-card" style={{ marginTop: "auto", padding: 14, fontSize: 13, color: "var(--mg-ink-2)" }}>
        Sign in to start a 7-day streak.
      </div>
    );
  }

  const left = 7 - lit;
  return (
    <section aria-label="7-day streak" className="mg-cc-card" style={{ marginTop: "auto", padding: 14, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <span className="mg-display" style={{ fontSize: 15, fontWeight: 700, color: "var(--mg-ink)" }}>{s.streak}-day streak</span>
        <span style={{ fontSize: 11.5, color: "var(--mg-ink-3)" }}>
          {left === 0 ? "Week complete" : s.checkedInToday ? `${left} to go` : "Use Apex today to keep it"}
        </span>
      </div>
      <div role="img" aria-label={`${lit} of 7 days this week`} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
        {Array.from({ length: 7 }, (_, i) => {
          const on = i < lit;
          return (
            <span key={i} className={`mg-cc${on ? " on" : ""}${on && lighting && i === lit - 1 ? " mg-light" : ""}`} style={{ aspectRatio: "1", width: "100%", cursor: "default", color: on ? "#FF8A4C" : "var(--mg-ink-3)", fontSize: 11, fontWeight: 700 }}>
              {on ? <Flame size={14} fill="currentColor" strokeWidth={0} /> : i + 1}
            </span>
          );
        })}
      </div>
      <span style={{ fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, color: "var(--mg-ink-3)" }}>Rewards</span>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <Reward got={s.rewards.bonus.earned} title={`Day ${s.rewards.bonus.day}`} text={`+${s.rewards.bonus.messages} messages today`} />
        <Reward got={s.rewards.avatar.earned} title={`Day ${s.rewards.avatar.day}`} text="Midnight avatar outfit" />
      </div>
      {s.earned && (
        <div role="status" onClick={clearEarned} style={{ fontSize: 12.5, fontWeight: 600, color: "#2a1300", background: "#fff", borderRadius: 14, padding: "8px 10px", cursor: "pointer" }}>
          {s.earned === "bonus" ? `Day ${s.rewards.bonus.day} reward: +${s.rewards.bonus.messages} messages added for today` : "Day 7 reward: the Midnight outfit is in Avatar → Outfit"}
        </div>
      )}
    </section>
  );
}

function Reward({ got, title, text }: { got: boolean; title: string; text: string }) {
  return (
    <div style={{ borderRadius: 16, padding: "8px 10px", fontSize: 11, lineHeight: 1.3, background: got ? "#fff" : "rgba(255,255,255,0.08)", border: `1.5px solid ${got ? "#fff" : "rgba(255,255,255,0.2)"}`, color: got ? "#5b4a3a" : "var(--mg-ink-3)" }}>
      <b style={{ display: "block", fontSize: 11.5, color: got ? "#2a1300" : "var(--mg-ink-2)" }}>{title}{got ? " ✓" : ""}</b>
      {text}
    </div>
  );
}
