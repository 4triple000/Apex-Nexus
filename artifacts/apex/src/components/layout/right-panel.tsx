import { useLocation, Link } from "wouter";
import { Camera, Swords, Mic, Bot, Brain, ChevronRight } from "lucide-react";

const QUICK_ACTIONS = [
  { icon: Camera,  label: "Screenshot Analyzer", href: "/screenshot"  },
  { icon: Swords,  label: "Battle Mode",          href: "/arena"       },
  { icon: Mic,     label: "Voice Chat",           href: "/apex-os"     },
  { icon: Bot,     label: "DM Automation",        href: "/dm"          },
];

export function RightPanel() {
  const [location] = useLocation();

  const chatPages = ["/", "/dm", "/screenshot", "/arena", "/apex-os", "/workflows", "/studio", "/feed"];
  const visible = chatPages.some((p) => p === "/" ? location === "/" : location.startsWith(p));

  if (!visible) return null;

  return (
    <div
      className="hidden xl:flex flex-col gap-5 shrink-0 overflow-y-auto"
      style={{
        width: 272,
        padding: "20px 16px",
        borderLeft: "1px solid rgba(255,255,255,0.05)",
        background: "#07070F",
      }}
    >
      {/* Quick Actions */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>
          Quick Actions
        </h3>
        <div className="flex flex-col gap-0.5">
          {QUICK_ACTIONS.map(({ icon: Icon, label, href }) => (
            <Link key={href} href={href}>
              <div
                className="flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors group"
                style={{ color: "rgba(255,255,255,0.7)" }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex items-center justify-center rounded-lg"
                    style={{ width: 32, height: 32, background: "rgba(255,255,255,0.05)" }}
                  >
                    <Icon size={15} style={{ color: "rgba(255,255,255,0.55)" }} />
                  </div>
                  <span className="text-sm font-medium">{label}</span>
                </div>
                <ChevronRight size={14} style={{ color: "rgba(255,255,255,0.2)" }} />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Memory Card */}
      <div
        className="mt-auto rounded-2xl p-5 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg,rgba(124,58,237,0.08),rgba(59,130,246,0.06))", border: "1px solid rgba(124,58,237,0.12)" }}
      >
        <Brain size={72} style={{ position: "absolute", right: -16, top: -16, color: "rgba(124,58,237,0.08)" }} />
        <div className="flex items-center gap-2 mb-2 relative z-10">
          <Brain size={15} style={{ color: "#A78BFA" }} />
          <h3 className="font-semibold text-white text-sm">Memory</h3>
        </div>
        <p className="text-xs mb-4 leading-relaxed relative z-10" style={{ color: "rgba(255,255,255,0.55)" }}>
          Apex remembers everything important to you.
        </p>
        <Link href="/profile" className="relative z-10">
          <button
            className="w-full rounded-lg text-xs font-medium py-2"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.85)" }}
          >
            View Memory
          </button>
        </Link>
      </div>
    </div>
  );
}
