import { useLocation, Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import {
  MessageSquare, Bot, Network, Camera, Mic, Brain,
  Swords, Users, Archive, User, Terminal, Settings,
  Hammer, Zap, Home, Gamepad2,
} from "lucide-react";
import { ApexLogo } from "@/components/ui/ApexLogo";
import { useDailyStreak } from "@/lib/dailyStreak";

const NAV_ITEMS = [
  { href: "/",               icon: Home,          label: "Home"           },
  { href: "/dm",             icon: MessageSquare, label: "Messages"       },
  { href: "/builder",        icon: Hammer,        label: "Builder"        },
  { href: "/games",          icon: Gamepad2,      label: "Apex Games"     },
  { href: "/studio",         icon: Network,       label: "Hive Mode"      },
  { href: "/screenshot",     icon: Camera,        label: "Screenshot AI"  },
  { href: "/apex-os",        icon: Mic,           label: "Voice & Audio"  },
  { href: "/workflows",      icon: Brain,         label: "AI Coach"       },
  { href: "/arena",          icon: Swords,        label: "Battle Mode"    },
  { href: "/feed",           icon: Users,         label: "Social"         },
  { href: "/profile",        icon: Archive,       label: "Memory"         },
  { href: "/avatar",         icon: User,          label: "Identity"       },
  { href: "/dev-cockpit",    icon: Terminal,      label: "Dev Cockpit",   ownerOnly: true },
];

export function Sidebar() {
  const [location] = useLocation();
  const isOwner = !!useAuth().user?.isOwner;
  const streak = useDailyStreak()?.streak ?? 0;

  const isActive = (href: string) =>
    href === "/" ? location === "/" : location.startsWith(href);

  return (
    <div
      className="hidden lg:flex flex-col shrink-0 border-r"
      style={{
        width: 224,
        height: "100dvh",
        background: "linear-gradient(180deg, rgba(30,26,64,0.55), rgba(12,10,28,0.7))",
        backdropFilter: "blur(22px) saturate(180%)",
        WebkitBackdropFilter: "blur(22px) saturate(180%)",
        borderColor: "rgba(255,255,255,0.1)",
        position: "sticky",
        zIndex: 2,
        top: 0,
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-3 px-4 shrink-0 border-b"
        style={{ height: 56, borderColor: "rgba(255,255,255,0.05)" }}
      >
        <ApexLogo size={28} radius={9} />
        <span
          className="font-bold text-sm tracking-widest"
          style={{ background: "linear-gradient(90deg,#fff,rgba(255,255,255,0.6))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
        >
          APEX NEXUS
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 flex flex-col gap-0.5" style={{ paddingLeft: 8, paddingRight: 8 }}>
        {NAV_ITEMS.filter((item) => !("ownerOnly" in item) || isOwner).map(({ href, icon: Icon, label }) => {
          const active = isActive(href);
          return (
            <Link key={href} href={href}>
              <div
                className="flex items-center gap-3 px-3 py-2.5 rounded-full cursor-pointer transition-all text-sm"
                style={{
                  background: active ? "rgba(255,255,255,0.92)" : "transparent",
                  boxShadow: active ? "0 6px 18px rgba(139,123,255,0.35)" : "none",
                  color: active ? "#120F2A" : "var(--mg-ink-2)",
                }}
              >
                <Icon
                  size={15}
                  style={{ color: active ? "#120F2A" : "var(--mg-ink-3)", flexShrink: 0 }}
                />
                <span style={{ fontWeight: active ? 500 : 400 }}>{label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="shrink-0 p-3 flex flex-col gap-2 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
          style={{ background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.2)" }}
        >
          <span style={{ fontSize: 12 }}>🔥</span>
          <span className="text-xs font-medium" style={{ color: "#FED7AA" }}>Daily Streak — {streak} {streak === 1 ? "Day" : "Days"}</span>
        </div>
        <Link href="/settings">
          <div
            className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            <Settings size={15} style={{ color: "rgba(255,255,255,0.4)" }} />
            <span className="text-sm">Settings</span>
          </div>
        </Link>
      </div>
    </div>
  );
}
