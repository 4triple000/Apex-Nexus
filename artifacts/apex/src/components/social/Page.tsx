/** Frame for Social's full-screen pages: dark background edge to edge, a back button and a title. */
import type { ReactNode } from "react";
import { useLocation } from "wouter";
import { ChevronLeft } from "lucide-react";
import { S } from "./ui";

export function SocialPage({ title, subtitle, right, back = "/feed", children, bare = false }: {
  title?: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  /** Where the back arrow goes when there's no history to return to */
  back?: string;
  children: ReactNode;
  /** No top bar (the page draws its own header, like Profile's cover) */
  bare?: boolean;
}) {
  const [, nav] = useLocation();
  const goBack = () => (window.history.length > 1 ? window.history.back() : nav(back));
  return (
    <div className="mg-font" style={{ flex: 1, overflowY: "auto", background: S.bg, color: S.ink }}>
      {bare ? children : (
        <>
          {/* On phones the bar starts below the ☰ button (see .social-bar in index.css) */}
          <div className="social-bar" style={{ position: "sticky", top: 0, zIndex: 6, background: `linear-gradient(${S.bg} 80%, rgba(10,10,12,0))`, padding: "10px 16px 12px", display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={goBack} aria-label="Back" style={{ width: 36, height: 36, marginLeft: -8, borderRadius: "50%", border: 0, background: "none", color: S.ink, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><ChevronLeft size={24} /></button>
            <div style={{ flexGrow: 1, minWidth: 0 }}>
              {title ? <div style={{ fontFamily: "Sora, sans-serif", fontSize: 17, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div> : null}
              {subtitle ? <div style={{ fontSize: 11.5, color: S.ink3, marginTop: 1 }}>{subtitle}</div> : null}
            </div>
            {right}
          </div>
          <div style={{ maxWidth: 620, margin: "0 auto", padding: "0 16px 48px", display: "flex", flexDirection: "column", gap: 14 }}>{children}</div>
        </>
      )}
    </div>
  );
}
