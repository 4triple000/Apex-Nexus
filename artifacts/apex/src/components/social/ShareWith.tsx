/**
 * "Share With": who can see a post. Public, Followers, one of your Circles, or Private (only you).
 */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Globe, Users, Compass, Lock, Check, Plus } from "lucide-react";
import { socialApi, type Visibility } from "@/lib/socialApi";
import { S, Sheet, primaryBtn, ghostBtn } from "./ui";

export interface Audience { visibility: Visibility; circle?: { id: number; name: string; emoji: string } }

const OPTIONS: { id: Visibility | "circle"; icon: typeof Globe; title: string; sub: string }[] = [
  { id: "public", icon: Globe, title: "Public", sub: "Anyone on Apex" },
  { id: "followers", icon: Users, title: "Followers", sub: "Your followers" },
  { id: "circle", icon: Compass, title: "Circle", sub: "Choose a circle" },
  { id: "private", icon: Lock, title: "Private", sub: "Only you" },
];

export function audienceLabel(a: Audience) {
  if (a.circle) return { icon: Compass, text: `${a.circle.emoji} ${a.circle.name}` };
  const o = OPTIONS.find((x) => x.id === a.visibility)!;
  return { icon: o.icon, text: o.title };
}

/** The small pill in the composer that opens Share With. */
export function AudiencePill({ value, onClick }: { value: Audience; onClick: () => void }) {
  const l = audienceLabel(value);
  return <button onClick={onClick} style={ghostBtn({ height: 28, padding: "0 10px", borderRadius: 14, fontSize: 12 })}><l.icon size={13} /> {l.text}</button>;
}

const Radio = ({ on }: { on: boolean }) => (
  <span aria-hidden style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: on ? S.btn : "none", border: on ? 0 : `1.5px solid ${S.ink3}` }}>
    {on ? <Check size={13} color={S.btnText} strokeWidth={2.6} /> : null}
  </span>
);

export function ShareWithSheet({ open, value, onClose, onChange, onNewCircle, allowCircle = true }: {
  open: boolean;
  value: Audience;
  onClose: () => void;
  onChange: (a: Audience) => void;
  onNewCircle?: () => void;
  allowCircle?: boolean;
}) {
  const { data } = useQuery({ queryKey: ["social-circles"], enabled: open && allowCircle, queryFn: socialApi.circles });
  const [pick, setPick] = useState<Audience>(value);
  const [mode, setMode] = useState<Visibility | "circle">(value.circle ? "circle" : value.visibility);
  useEffect(() => { if (open) { setPick(value); setMode(value.circle ? "circle" : value.visibility); } }, [open, value]);
  const mine = data?.mine ?? [];
  const choose = (id: Visibility | "circle") => {
    setMode(id);
    if (id !== "circle") setPick({ visibility: id });
    else if (!pick.circle && mine[0]) setPick({ visibility: "public", circle: { id: mine[0].id, name: mine[0].name, emoji: mine[0].emoji } });
  };
  const done = () => { onChange(mode === "circle" && !pick.circle ? { visibility: "public" } : pick); onClose(); };

  return (
    <Sheet open={open} onClose={onClose} label="Share with" maxWidth={480} z={9100}
      title={<span>Share With<span style={{ display: "block", fontFamily: "Manrope, sans-serif", fontSize: 12.5, fontWeight: 500, color: S.ink2, marginTop: 3 }}>Who can see this?</span></span>}>
      <div role="radiogroup" aria-label="Who can see this" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {OPTIONS.filter((o) => allowCircle || o.id !== "circle").map((o) => {
          const on = mode === o.id;
          return (
            <button key={o.id} role="radio" aria-checked={on} onClick={() => choose(o.id)}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 14, background: on ? "rgba(255,255,255,0.06)" : "none", border: `1px solid ${on ? "rgba(255,255,255,0.22)" : "transparent"}`, color: S.ink, cursor: "pointer", textAlign: "left", fontFamily: "Manrope, sans-serif" }}>
              <span style={{ width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.05)", flexShrink: 0 }}><o.icon size={18} /></span>
              <span style={{ flexGrow: 1 }}><span style={{ display: "block", fontSize: 13.5, fontWeight: 800 }}>{o.title}</span><span style={{ display: "block", fontSize: 11.5, color: S.ink3, marginTop: 2 }}>{o.sub}</span></span>
              <Radio on={on} />
            </button>
          );
        })}
      </div>

      {allowCircle ? (
        <>
          <div style={{ height: 1, background: S.line, margin: "16px 6px" }} />
          <div style={{ padding: "0 6px 6px", fontSize: 12, fontWeight: 800, color: S.ink2 }}>Your Circles</div>
          {!mine.length ? <div style={{ padding: "4px 6px 8px", fontSize: 12.5, color: S.ink3 }}>You're not in any circles yet.</div> : null}
          <div role="radiogroup" aria-label="Circle" style={{ display: "flex", flexDirection: "column" }}>
            {mine.map((c) => {
              const on = mode === "circle" && pick.circle?.id === c.id;
              return (
                <button key={c.id} role="radio" aria-checked={on} onClick={() => { setMode("circle"); setPick({ visibility: "public", circle: { id: c.id, name: c.name, emoji: c.emoji } }); }}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 6px", background: "none", border: 0, color: S.ink, cursor: "pointer", textAlign: "left", fontFamily: "Manrope, sans-serif" }}>
                  <span aria-hidden style={{ width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, background: "linear-gradient(145deg, #4A4642, #222226)", border: `1px solid ${S.line}` }}>{c.emoji}</span>
                  <span style={{ flexGrow: 1 }}><span style={{ display: "block", fontSize: 13.5, fontWeight: 800 }}>{c.name}</span><span style={{ display: "block", fontSize: 11.5, color: S.ink3, marginTop: 2 }}>{c.memberCount} {c.memberCount === 1 ? "person" : "people"}</span></span>
                  <Radio on={on} />
                </button>
              );
            })}
          </div>
          {onNewCircle ? (
            <button onClick={onNewCircle} style={{ width: "100%", height: 42, marginTop: 8, borderRadius: 12, border: `1px dashed ${S.line2}`, background: "none", color: S.ink2, fontFamily: "Manrope, sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Plus size={16} /> New circle
            </button>
          ) : null}
        </>
      ) : null}
      <button onClick={done} style={primaryBtn({ width: "100%", height: 48, marginTop: 18, borderRadius: 14, fontSize: 14.5 })}>Done</button>
    </Sheet>
  );
}
