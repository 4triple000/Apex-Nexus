/**
 * Social look: near-black glass, white primary buttons, one soft gold accent.
 * Shared pieces for the Social screens.
 */
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { mediaSrc, type Author } from "@/lib/socialApi";

export const S = {
  bg: "#0A0A0C",
  surf: "#141417",
  surf2: "#1B1B20",
  line: "rgba(255,255,255,0.08)",
  line2: "rgba(255,255,255,0.13)",
  ink: "#F5F5F7",
  ink2: "#B0B0B8",
  ink3: "#8C8C95",
  gold: "#E2C17E",
  goldSoft: "rgba(226,193,126,0.14)",
  goldLine: "rgba(226,193,126,0.4)",
  heart: "#FF4D67",
  btn: "#F5F5F7",
  btnText: "#0A0A0C",
};

export const card: React.CSSProperties = { background: S.surf, border: `1px solid ${S.line}`, borderRadius: 20 };

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
export function Sheet({ open, onClose, title, children, maxWidth = 520, label }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; maxWidth?: number; label: string }) {
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
      style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <style>{`@keyframes apexSheetUp{from{transform:translateY(24px);opacity:0}to{transform:none;opacity:1}}@media (prefers-reduced-motion: reduce){.apex-sheet{animation:none!important}}`}</style>
      <div className="apex-sheet" onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth, maxHeight: "92vh", display: "flex", flexDirection: "column", background: "#121215", color: S.ink, border: `1px solid ${S.line2}`, borderBottom: 0, borderRadius: "26px 26px 0 0", animation: "apexSheetUp .22s ease-out" }}>
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
export function sceneFor(seed: string | number): string {
  const s = String(seed);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return SCENES[h % SCENES.length]!;
}

export function SectionLabel({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", color: S.ink2, textTransform: "uppercase" }}>{children}</div>
      {sub ? <div style={{ fontSize: 11.5, color: S.ink3, marginTop: 2 }}>{sub}</div> : null}
    </div>
  );
}
