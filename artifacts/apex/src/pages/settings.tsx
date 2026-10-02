/**
 * Settings: system controls, wake phrase, Apex tone and account, opened from the ☰ menu.
 * Layout follows the Control Center: a tile of round toggles next to two tall sliders.
 */
import { useRef, type ReactNode } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, ChevronRight, Moon, Mic, Brain, Speech, Volume2, FastForward, UserRound, Gauge, Shield, LogOut, Globe, Plug, Smartphone, type LucideIcon } from "lucide-react";
import { useApexState } from "@/contexts/ApexStateContext";
import { useAuth } from "@/contexts/AuthContext";
import { planLabel } from "@/components/layout/topbar";

const TONES = [
  { id: "friend",    label: "Friend",    emoji: "👋" },
  { id: "assistant", label: "Assistant", emoji: "🤖" },
  { id: "formal",    label: "Formal",    emoji: "👔" },
  { id: "creative",  label: "Creative",  emoji: "🎨" },
];

const label: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mg-ink-3)", margin: "0 0 10px 2px" };

export default function SettingsPage() {
  const [, nav] = useLocation();
  const p = useApexState();
  const { user, logout } = useAuth();

  const onOff = (v: boolean) => (v ? "on" : "off");
  const summary = `Dark mode ${onOff(p.darkMode)} · Voice mode ${onOff(p.voiceMode)} · Memory ${onOff(p.memoryEnabled)} · Hands-free ${onOff(p.handsFree)}`;

  return (
    <div className="mg-font" style={{ flex: 1, overflowY: "auto", padding: "0 16px 32px" }}>
      <div style={{ maxWidth: 520, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
        <header style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => (window.history.length > 1 ? window.history.back() : nav("/"))} aria-label="Back" className="mg-cc mg-focus" style={{ width: 40, height: 40 }}>
            <ChevronLeft size={20} strokeWidth={2.4} />
          </button>
          <h1 className="mg-display" style={{ margin: 0, fontSize: 28, fontWeight: 700, color: "var(--mg-ink)" }}>Settings</h1>
        </header>

        {/* System controls */}
        <section>
          <h2 style={label}>System controls</h2>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 0.5fr) minmax(0, 0.5fr)", gap: 10, height: 170 }}>
            <div className="mg-cc-card" style={{ borderRadius: 30, padding: 14, display: "grid", gridTemplateColumns: "1fr 1fr", placeItems: "center", background: "linear-gradient(160deg, rgba(139,123,255,0.45), rgba(139,123,255,0.18))" }}>
              <Toggle icon={Moon} label="Dark mode" on={p.darkMode} set={p.setDarkMode} />
              <Toggle icon={Mic} label="Voice mode" on={p.voiceMode} set={p.setVoiceMode} />
              <Toggle icon={Brain} label="Memory" on={p.memoryEnabled} set={p.setMemoryEnabled} />
              <Toggle icon={Speech} label="Hands-free" on={p.handsFree} set={p.setHandsFree} />
            </div>
            <VSlider icon={Volume2} label="Apex volume" value={p.volume} min={0} max={1} set={p.setVolume} format={(v) => `${Math.round(v * 100)}%`} />
            <VSlider icon={FastForward} label="Apex speaking speed" value={p.speechRate} min={0.5} max={2} set={p.setSpeechRate} format={(v) => `${v.toFixed(1)}×`} />
          </div>
          <p aria-live="polite" style={{ margin: "10px 0 0", textAlign: "center", fontSize: 12, color: "var(--mg-ink-3)" }}>{summary}</p>
        </section>

        {/* Wake phrase */}
        <section>
          <h2 style={label}>Wake phrase</h2>
          <label style={{ display: "block", borderRadius: 22, padding: "12px 16px", border: "1.5px solid rgba(255,255,255,0.3)", background: "linear-gradient(110deg, rgba(139,123,255,0.55), rgba(0,194,255,0.75))", cursor: "text" }}>
            <span style={{ display: "block", fontSize: 12, color: "rgba(255,255,255,0.78)" }}>Say this to start talking to Apex</span>
            <input
              value={p.wakePhrase}
              onChange={(e) => p.setWakePhrase(e.target.value.slice(0, 40))}
              onBlur={() => { if (!p.wakePhrase.trim()) p.setWakePhrase("Hey Apex"); }}
              placeholder="Hey Apex"
              aria-label="Wake phrase"
              style={{ width: "100%", background: "none", border: 0, outline: "none", padding: "2px 0 0", color: "#fff", fontSize: 18, fontWeight: 700, fontFamily: "inherit" }}
            />
          </label>
        </section>

        {/* Apex tone */}
        <section>
          <h2 style={label}>Apex tone</h2>
          <div role="radiogroup" aria-label="Apex tone" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {TONES.map((t) => {
              const on = p.personality === t.id;
              return (
                <button key={t.id} role="radio" aria-checked={on} onClick={() => p.setPersonality(t.id)} className="mg-press mg-focus"
                  style={{ height: 46, borderRadius: 23, fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, color: on ? "#1C1640" : "var(--mg-ink-2)", background: on ? "#fff" : "rgba(255,255,255,0.08)", border: `1.5px solid ${on ? "#fff" : "rgba(255,255,255,0.2)"}` }}>
                  <span aria-hidden>{t.emoji}</span>{t.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Account */}
        <section>
          <h2 style={label}>Account</h2>
          <div className="mg-cc-card mg-rows" style={{ overflow: "hidden" }}>
            <Row icon={UserRound} title={user?.username ?? "Profile"} note={planLabel(user?.subscriptionTier, user?.isOwner)} onClick={() => nav("/profile")} />
            <Row icon={Gauge} title="Usage & plan" onClick={() => nav("/usage")} />
            <Row icon={Plug} title="Connectors" note="Your AI accounts and apps" onClick={() => nav("/connectors")} />
            <Row icon={Shield} title="Privacy & notifications" onClick={() => nav("/profile")} />
            <Row icon={Globe} title="Custom domain" onClick={() => nav("/domain-settings")} />
            <Row icon={Smartphone} title="Get the phone app" note="Android and iPhone" onClick={() => nav("/install")} />
            {user && <Row icon={LogOut} title="Sign out" danger onClick={() => { logout(); nav("/login"); }} />}
          </div>
        </section>
      </div>
    </div>
  );
}

function Toggle({ icon: Icon, label, on, set }: { icon: LucideIcon; label: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} title={label} onClick={() => set(!on)} className={`mg-cc mg-focus${on ? " on" : ""}`} style={{ width: 54, height: 54 }}>
      <Icon size={22} strokeWidth={2.2} />
    </button>
  );
}

/** Tall Control Center slider: white fill rises from the bottom. Drag, tap, or use arrow keys. */
function VSlider({ icon: Icon, label, value, min, max, set, format }: { icon: LucideIcon; label: string; value: number; min: number; max: number; set: (v: number) => void; format: (v: number) => string }) {
  const ref = useRef<HTMLDivElement>(null);
  const pct = (value - min) / (max - min);
  const step = (max - min) / 20;
  const clamp = (v: number) => Math.round(Math.min(max, Math.max(min, v)) * 100) / 100;

  const fromPointer = (clientY: number) => {
    const r = ref.current!.getBoundingClientRect();
    set(clamp(min + (1 - (clientY - r.top) / r.height) * (max - min)));
  };

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={format(value)}
      aria-orientation="vertical"
      className="mg-focus"
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); fromPointer(e.clientY); }}
      onPointerMove={(e) => { if (e.buttons) fromPointer(e.clientY); }}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp" || e.key === "ArrowRight") { e.preventDefault(); set(clamp(value + step)); }
        if (e.key === "ArrowDown" || e.key === "ArrowLeft") { e.preventDefault(); set(clamp(value - step)); }
      }}
      style={{ position: "relative", borderRadius: 28, overflow: "hidden", touchAction: "none", cursor: "ns-resize", background: "rgba(255,255,255,0.1)", border: "1.5px solid rgba(255,255,255,0.3)" }}
    >
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: `${pct * 100}%`, background: "#F4F2FF", transition: "height .08s" }} />
      <Icon size={22} strokeWidth={2.2} style={{ position: "absolute", left: "50%", bottom: 16, translate: "-50% 0", color: pct > 0.12 ? "#7A6BFF" : "#fff" }} />
    </div>
  );
}

function Row({ icon: Icon, title, note, danger, onClick }: { icon: LucideIcon; title: string; note?: string; danger?: boolean; onClick: () => void }): ReactNode {
  return (
    <button onClick={onClick} className="mg-focus" style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", background: "none", border: 0, borderTop: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", textAlign: "left", color: danger ? "#FF7A9C" : "var(--mg-ink)" }}>
      <span className="mg-cc" style={{ width: 34, height: 34, color: danger ? "#FF7A9C" : "#fff" }}><Icon size={16} strokeWidth={2.2} /></span>
      <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600 }}>{title}</span>
      {note && <span style={{ fontSize: 12, color: "var(--mg-ink-3)" }}>{note}</span>}
      {!danger && <ChevronRight size={16} style={{ color: "var(--mg-ink-3)" }} />}
    </button>
  );
}
