import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";

// Icons drawn to match the Midnight Glass mockup exactly
const svg = (children: ReactNode) => (
  <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);

const ICONS = {
  home:   svg(<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />),
  chat:   svg(<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />),
  studio: svg(<path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z" />),
  games:  svg(<><rect x="2.5" y="7" width="19" height="11" rx="5.5" /><path d="M7 11v3M5.5 12.5h3M15.5 12h.01M18 13.5h.01" /></>),
  you:    svg(<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>),
};

const NAV_ITEMS: { href: string; icon: keyof typeof ICONS; label: string; match: string[] }[] = [
  { href: "/",          icon: "home",   label: "Home",      match: ["/"] },
  { href: "/dm",        icon: "chat",   label: "Chat",      match: ["/dm"] },
  { href: "/builder",   icon: "studio", label: "Builder",   match: ["/builder", "/ai-studio"] },
  { href: "/games",     icon: "games",  label: "Games",     match: ["/games", "/game-engine"] },
  { href: "/profile",   icon: "you",    label: "You",       match: ["/profile", "/avatar"] },
];

function isActive(location: string, match: string[]) {
  return match.some((m) => (m === "/" ? location === "/" : location === m || location.startsWith(`${m}/`)));
}

/** Floating Midnight Glass tab bar. */
export function BottomNav() {
  const [location] = useLocation();

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
        paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <nav
        aria-label="Main"
        className="mg-glass"
        style={{
          pointerEvents: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
          width: "min(100% - 28px, 420px)",
          height: 64,
          padding: "0 8px",
          borderRadius: 32,
        }}
      >
        {NAV_ITEMS.map(({ href, icon, label, match }) => {
          const active = isActive(location, match);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className="mg-press mg-focus"
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                color: active ? "#120F2A" : "#F3F0FF",
                background: active ? "rgba(255,255,255,0.9)" : "transparent",
                transition: "background 0.25s, color 0.25s",
              }}
            >
              {ICONS[icon]}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
