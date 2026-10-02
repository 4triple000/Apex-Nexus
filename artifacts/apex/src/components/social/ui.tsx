/**
 * Social look: near-black glass, white primary buttons, one soft gold accent.
 * Shared pieces for the Social screens.
 */
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { mediaSrc, type Author } from "@/lib/socialApi";

export const S = {
  bg: "#0A0918",
  surf: "rgba(255,255,255,0.07)",
  surf2: "rgba(255,255,255,0.11)",
  line: "rgba(255,255,255,0.12)",
  line2: "rgba(255,255,255,0.18)",
  ink: "#F3F0FF",
  ink2: "rgba(243,240,255,0.72)",
  ink3: "rgba(243,240,255,0.52)",
  gold: "#E2C17E",
  goldSoft: "rgba(226,193,126,0.14)",
  goldLine: "rgba(226,193,126,0.4)",
  heart: "#FF4D67",
  /** The second side of a debate (gold is the first) */
  silver: "#C9CDD6",
  silverSoft: "rgba(201,205,214,0.12)",
  btn: "#F5F5F7",
  btnText: "#0A0A0C",
};

/** Midnight Glass panel: a light frosted gradient with a bright top edge. */
export const card: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04))",
  border: `1px solid ${S.line}`,
  borderRadius: 20,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.22), 0 10px 30px rgba(0,0,0,0.22)",
};

/** Social's Midnight Glass background: deep navy with soft violet, cyan and pink light behind the glass. */
export function SocialBackdrop() {
  const blob = (style: React.CSSProperties) => <div style={{ position: "absolute", borderRadius: "50%", filter: "blur(70px)", ...style }} />;
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 0, overflow: "hidden", background: S.bg, pointerEvents: "none" }}>
      {blob({ left: "-25%", top: "-8%", width: "80%", height: 340, background: "rgba(139,123,255,0.5)" })}
      {blob({ right: "-30%", top: "38%", width: "75%", height: 300, background: "rgba(0,194,255,0.26)" })}
      {blob({ left: "5%", bottom: "-12%", width: "85%", height: 280, background: "rgba(255,79,163,0.32)" })}
    </div>
  );
}

export function primaryBtn(extra?: React.CSSProperties): React.CSSProperties {
  return { height: 40, padding: "0 18px", borderRadius: 12, border: 0, background: S.btn, color: S.btnText, fontFamily: "Manrope, sans-serif", fontSize: 13.5, fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, whiteSpace: "nowrap", ...extra };
}
export function ghostBtn(extra?: React.CSSProperties): React.CSSProperties {
  return { height: 40, padding: "0 16px", borderRadius: 12, border: `1px solid ${S.line2}`, background: "rgba(255,255,255,0.05)", color: S.ink, fontFamily: "Manrope, sans-serif", fontSize: 13.5, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, whiteSpace: "nowrap", ...extra };
}
export const iconBtn: React.CSSProperties = { width: 38, height: 38, borderRadius: "50%", border: 0, background: "none", color: S.ink2, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 };

export function Avatar({ user, size = 36, ring = false }: { user: Pick<Author, "username" | "avatarUrl" | "avatarEmoji">; size?: number; ring?: boolean }) {
  const ringStyle = ring ? { boxShadow: `0 0 0 2px ${S.bg}, 0 0 0 3.5px ${S.gold}` } : {};
  if (user.avatarUrl) {
    return <img src={user.avatarUrl.startsWith("/api/") ? mediaSrc(user.avatarUrl) : user.avatarUrl} alt="" width={size} height={size} loading="lazy" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: `1px solid ${S.line}`, ...ringStyle }} />;
  }
  const letter = (user.username || "?").trim()[0]?.toUpperCase() ?? "?";
  return (
    <span aria-hidden style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(145deg, #4A4642, #222226)", border: `1px solid ${S.line}`, color: "#ECE9E4", fontFamily: "Sora, sans-serif", fontWeight: 700, fontSize: Math.round(size * 0.38), ...ringStyle }}>
      {letter}
    </span>
  );
}

/** Bottom sheet rendered on <body> (page transitions use transforms, which would trap a fixed overlay). */
export function Sheet({ open, onClose, title, children, maxWidth = 520, label, z = 9000 }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; maxWidth?: number; label: string; z?: number }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={label} onClick={onClose} className="mg-font"
      style={{ position: "fixed", inset: 0, zIndex: z, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <style>{`@keyframes apexSheetUp{from{transform:translateY(24px);opacity:0}to{transform:none;opacity:1}}@media (prefers-reduced-motion: reduce){.apex-sheet{animation:none!important}}`}</style>
      <div className="apex-sheet" onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth, maxHeight: "92vh", display: "flex", flexDirection: "column", background: "#13112A", color: S.ink, border: `1px solid ${S.line2}`, borderBottom: 0, borderRadius: "26px 26px 0 0", animation: "apexSheetUp .22s ease-out" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px 8px" }}>
          <div style={{ flexGrow: 1, fontFamily: "Sora, sans-serif", fontSize: 17, fontWeight: 700 }}>{title}</div>
          <button onClick={onClose} aria-label="Close" style={iconBtn}><X size={20} /></button>
        </div>
        <div style={{ overflowY: "auto", padding: "4px 16px 20px" }}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/** Text with #hashtags and @mentions picked out. */
export function RichText({ text, onTag }: { text: string; onTag?: (tag: string) => void }) {
  const parts = text.split(/(#[\p{L}\p{N}_]{2,30}|@[\w]{2,30})/u);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("#") && onTag ? (
          <button key={i} onClick={() => onTag(p.slice(1).toLowerCase())} style={{ background: "none", border: 0, padding: 0, color: S.gold, font: "inherit", cursor: "pointer" }}>{p}</button>
        ) : p.startsWith("@") || p.startsWith("#") ? (
          <span key={i} style={{ color: S.gold }}>{p}</span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

/** Stand-in artwork for tags and games, so tiles have a picture before real thumbnails exist. */
const SCENES = [
  "radial-gradient(55% 50% at 35% 35%, rgba(226,193,126,0.42), transparent 70%), linear-gradient(180deg,#24201A,#0C0B0A)",
  "radial-gradient(50% 45% at 60% 40%, rgba(255,170,110,0.32), transparent 70%), linear-gradient(180deg,#261C18,#0D0B0B)",
  "radial-gradient(45% 45% at 50% 35%, rgba(240,230,210,0.22), transparent 70%), linear-gradient(180deg,#1E1E22,#0B0B0D)",
  "radial-gradient(50% 50% at 40% 45%, rgba(200,150,90,0.35), transparent 70%), linear-gradient(160deg,#211A14,#0B0A09)",
  "radial-gradient(45% 55% at 55% 50%, rgba(255,120,100,0.28), transparent 70%), linear-gradient(160deg,#241718,#0D0A0B)",
  "radial-gradient(50% 50% at 50% 40%, rgba(170,180,195,0.22), transparent 70%), linear-gradient(180deg,#1A1C20,#0A0B0D)",
];
/** Profile cover art, by name. */
export const COVERS: Record<string, string> = {
  city: "radial-gradient(3px 3px at 20% 62%, #FFD9A0, transparent), radial-gradient(3px 3px at 38% 58%, #FFE3B8, transparent), radial-gradient(3px 3px at 62% 55%, #E8E8F0, transparent), radial-gradient(3px 3px at 78% 64%, #FFD9A0, transparent), linear-gradient(180deg, #1E2230 0%, #2A2733 45%, #111014 75%, #0B0A0C 100%)",
  sunset: "radial-gradient(40% 35% at 50% 70%, rgba(255,214,140,0.95), rgba(255,140,70,0.6) 45%, rgba(255,120,60,0) 75%), linear-gradient(180deg, #3E2A34 0%, #C2603E 55%, #2A1A20 78%, #0E0B0C 100%)",
  studio: "radial-gradient(55% 50% at 40% 40%, rgba(226,193,126,0.35), transparent 70%), linear-gradient(180deg, #24201A, #0C0B0A)",
  neon: "radial-gradient(60% 55% at 30% 35%, rgba(255,150,100,0.35), transparent 70%), radial-gradient(45% 45% at 80% 70%, rgba(90,160,255,0.3), transparent 70%), linear-gradient(180deg,#1A1820,#0B0A0D)",
  arcade: "radial-gradient(50% 55% at 75% 40%, rgba(255,120,100,0.35), transparent 70%), linear-gradient(120deg, #24181A, #0C0A0B)",
  gold: "linear-gradient(160deg, #EBCB8B, #8A6A34 60%, #2A2214)",
  night: "radial-gradient(2px 2px at 15% 30%, #fff, transparent), radial-gradient(2px 2px at 70% 20%, #fff, transparent), radial-gradient(1.5px 1.5px at 45% 50%, #ddd, transparent), linear-gradient(180deg, #16161C, #0A0A0C)",
};

export function sceneFor(seed: string | number): string {
  const s = String(seed);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return SCENES[h % SCENES.length]!;
}

/** The small gold "Apex" label on anything Apex wrote. */
export function ApexTag({ children = "Apex" }: { children?: ReactNode }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 800, color: S.gold }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2z" /></svg>
      {children}
    </span>
  );
}

/** Gold-edged card for Apex's answers and summaries. */
export const apexCard: React.CSSProperties = { padding: 12, borderRadius: 14, background: "linear-gradient(135deg, rgba(226,193,126,0.08), rgba(226,193,126,0.02))", border: "1px solid rgba(226,193,126,0.28)" };

export function SectionLabel({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", color: S.ink2, textTransform: "uppercase" }}>{children}</div>
      {sub ? <div style={{ fontSize: 11.5, color: S.ink3, marginTop: 2 }}>{sub}</div> : null}
    </div>
  );
}
