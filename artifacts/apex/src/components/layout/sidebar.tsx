import { useLocation, Link } from "wouter";
import {
  MessageSquare, Bot, Network, Camera, Mic, Brain,
  Swords, PenLine, Archive, User, Terminal, Settings,
  Hammer, Zap,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/",               icon: MessageSquare, label: "AI Chat"        },
  { href: "/dm",             icon: Bot,           label: "DM Automation"  },
  { href: "/studio",         icon: Network,       label: "Hive Mode"      },
  { href: "/screenshot",     icon: Camera,        label: "Screenshot AI"  },
  { href: "/apex-os",        icon: Mic,           label: "Voice & Audio"  },
  { href: "/workflows",      icon: Brain,         label: "AI Coach"       },
  { href: "/arena",          icon: Swords,        label: "Battle Mode"    },
  { href: "/feed",           icon: PenLine,       label: "Content Writer" },
  { href: "/profile",        icon: Archive,       label: "Memory"         },
  { href: "/avatar",         icon: User,          label: "Identity"       },
  { href: "/nexus-builder",  icon: Hammer,        label: "Nexus Builder"  },
  { href: "/dev-cockpit",    icon: Terminal,      label: "Dev Cockpit"    },
];

export function Sidebar() {
  const [location] = useLocation();

  const isActive = (href: string) =>
    href === "/" ? location === "/" : location.startsWith(href);

  return (
    <div
      className="hidden lg:flex flex-col shrink-0 border-r"
      style={{
        width: 224,
        height: "100dvh",
        background: "#0D0D1A",
        borderColor: "rgba(255,255,255,0.05)",
        position: "sticky",
        top: 0,
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-3 px-4 shrink-0 border-b"
        style={{ height: 56, borderColor: "rgba(255,255,255,0.05)" }}
      >
        <div
          className="relative flex items-center justify-center rounded-md"
          style={{
            width: 26, height: 26,
            background: "linear-gradient(135deg, #7C3AED, #3B82F6)",
            boxShadow: "0 0 12px rgba(124,58,237,0.55)",
          }}
        >
          <div
            className="absolute rounded-[5px] flex items-center justify-center"
            style={{ inset: 1.5, background: "#0A0A15" }}
          >
            <span
              className="font-bold text-sm"
              style={{ background: "linear-gradient(135deg,#fff,rgba(255,255,255,0.7))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
            >A</span>
          </div>
        </div>
        <span
          className="font-bold text-sm tracking-widest"
          style={{ background: "linear-gradient(90deg,#fff,rgba(255,255,255,0.6))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
        >
          APEX NEXUS
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 flex flex-col gap-0.5" style={{ paddingLeft: 8, paddingRight: 8 }}>
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = isActive(href);
          return (
            <Link key={href} href={href}>
              <div
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all text-sm"
                style={{
                  background: active ? "linear-gradient(90deg,rgba(124,58,237,0.18),rgba(59,130,246,0.10))" : "transparent",
                  borderLeft: active ? "2px solid #A78BFA" : "2px solid transparent",
                  color: active ? "#EDE9FE" : "rgba(255,255,255,0.55)",
                }}
              >
                <Icon
                  size={15}
                  style={{ color: active ? "#A78BFA" : "rgba(255,255,255,0.45)", flexShrink: 0 }}
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
          <span className="text-xs font-medium" style={{ color: "#FED7AA" }}>Daily Streak — 23 Days</span>
        </div>
        <Link href="/profile">
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
