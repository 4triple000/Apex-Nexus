import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  MessageSquare, Hammer, Swords, User,
} from "lucide-react";

const SPRING  = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const IOS     = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";
const FAST_IN = "cubic-bezier(0.55, 0, 1, 0.45)";

const NAV_ITEMS = [
  { href: "/",               icon: MessageSquare, label: "AI Chat"  },
  { href: "/ai-studio",      icon: Hammer,        label: "Builder"  },
  { href: "/arena",          icon: Swords,        label: "Battle"   },
  { href: "/avatar",         icon: User,          label: "Identity" },
] as const;

type NavItem = (typeof NAV_ITEMS)[number];

function NavItem({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const [pressed, setPressed] = useState(false);
  const Icon = item.icon;

  /* ── REGULAR TAB ──────────────────────────────────────────────────────── */
  return (
    <Link href={item.href}>
      <div
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          padding: "6px 12px",
          borderRadius: 16,
          cursor: "pointer",
          transform: pressed ? "scale(0.91)" : "scale(1)",
          transition: pressed
            ? `transform 0.11s ${FAST_IN}`
            : `transform 0.38s ${SPRING}`,
          willChange: "transform",
          position: "relative",
          minWidth: 52,
        }}
      >
        {/* Active indicator pill */}
        {isActive && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: 32,
              height: 3,
              borderRadius: 2,
              background: "linear-gradient(90deg, #6C5CE7, #A29BFE)",
              boxShadow: "0 0 8px rgba(108,92,231,0.7), 0 0 16px rgba(162,155,254,0.4)",
            }}
          />
        )}

        {/* Icon glow halo */}
        {isActive && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(108,92,231,0.22) 0%, transparent 70%)",
              filter: "blur(6px)",
              pointerEvents: "none",
            }}
          />
        )}

        <div style={{ position: "relative", zIndex: 1 }}>
          <Icon
            style={{
              width: 22,
              height: 22,
              color: isActive ? "#A29BFE" : "rgba(255,255,255,0.38)",
              strokeWidth: isActive ? 2.3 : 1.9,
              filter: isActive
                ? "drop-shadow(0 0 6px rgba(162,155,254,0.65))"
                : "none",
              transform: isActive ? "scale(1.08)" : "scale(1)",
              transition: [
                `color 0.25s ${IOS}`,
                `transform 0.38s ${SPRING}`,
                `filter 0.25s ${IOS}`,
                `stroke-width 0.25s ${IOS}`,
              ].join(", "),
            }}
          />
        </div>

        <span
          style={{
            fontSize: 10,
            fontWeight: isActive ? 700 : 500,
            color: isActive ? "#A29BFE" : "rgba(255,255,255,0.32)",
            letterSpacing: isActive ? "0.02em" : "0.01em",
            transition: `color 0.25s ${IOS}, font-weight 0.25s ${IOS}`,
            position: "relative",
            zIndex: 1,
            lineHeight: 1,
          }}
        >
          {item.label}
        </span>
      </div>
    </Link>
  );
}

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
      }}
    >
      <nav
        style={{
          pointerEvents: "auto",
          display: "flex",
          alignItems: "center",
          gap: 0,
          padding: "6px 10px",
          borderRadius: 9999,
          marginBottom: 24,
          marginLeft: 16,
          marginRight: 16,
          background:
            "linear-gradient(180deg, rgba(30,28,48,0.94) 0%, rgba(14,12,24,0.98) 100%)",
          backdropFilter:       "blur(36px) saturate(200%)",
          WebkitBackdropFilter: "blur(36px) saturate(200%)",
          border: "1px solid rgba(108,92,231,0.15)",
          boxShadow: [
            "inset 0 0.5px 0 rgba(255,255,255,0.08)",
            "inset 0 -0.5px 0 rgba(0,0,0,0.20)",
            "0 0 0 1px rgba(108,92,231,0.08)",
            "0 24px 56px rgba(0,0,0,0.72)",
            "0 8px 20px rgba(0,0,0,0.44)",
            "0 0 40px rgba(108,92,231,0.1)",
          ].join(", "),
        }}
      >
        {NAV_ITEMS.map((item) => {
          const isActive =
            location === item.href ||
            (item.href !== "/" && location.startsWith(item.href));
          return <NavItem key={item.href} item={item as any} isActive={isActive} />;
        })}
      </nav>
    </div>
  );
}
