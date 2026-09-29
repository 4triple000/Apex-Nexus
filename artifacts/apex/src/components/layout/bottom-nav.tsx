import { Link, useLocation } from "wouter";
import { Home, MessageCircle, Sparkles, Gamepad2, User, type LucideIcon } from "lucide-react";

const NAV_ITEMS: { href: string; icon: LucideIcon; label: string; match: string[] }[] = [
  { href: "/",          icon: Home,          label: "Home",     match: ["/"] },
  { href: "/dm",        icon: MessageCircle, label: "Messages", match: ["/dm"] },
  { href: "/ai-studio", icon: Sparkles,      label: "AI Studio", match: ["/ai-studio"] },
  { href: "/games",     icon: Gamepad2,      label: "Games",    match: ["/games", "/game-engine"] },
  { href: "/profile",   icon: User,          label: "You",      match: ["/profile", "/avatar"] },
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
          justifyContent: "space-between",
          gap: 4,
          width: "min(100% - 28px, 420px)",
          height: 66,
          padding: "0 9px",
          borderRadius: 33,
          background: "linear-gradient(180deg, rgba(40,34,78,0.62), rgba(16,13,36,0.78))",
        }}
      >
        {NAV_ITEMS.map(({ href, icon: Icon, label, match }) => {
          const active = isActive(location, match);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className="mg-press mg-focus"
              style={{
                width: 50,
                height: 50,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                color: active ? "#120F2A" : "var(--mg-ink-2)",
                background: active ? "rgba(255,255,255,0.92)" : "transparent",
                boxShadow: active ? "0 6px 18px rgba(139,123,255,0.4), inset 0 1px 0 #fff" : "none",
                transition: "background 0.28s, color 0.28s, box-shadow 0.28s",
              }}
            >
              <Icon size={22} strokeWidth={active ? 2.3 : 1.9} />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
