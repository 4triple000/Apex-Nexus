import { useState } from "react";
import { useLocation } from "wouter";
import { Search, Bell, ChevronDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

function planLabel(tier?: string, isOwner?: boolean) {
  if (isOwner) return "Owner";
  if (!tier || tier === "free") return "Free plan";
  return `${tier[0].toUpperCase()}${tier.slice(1).replace(/_/g, " ")} plan`;
}

export function TopBar() {
  const { user } = useAuth();
  const [, nav] = useLocation();
  const [query, setQuery] = useState("");

  return (
    <div
      className="hidden lg:flex items-center gap-4 px-6 shrink-0 border-b"
      style={{
        height: 56,
        background: "rgba(14,12,32,0.45)",
        backdropFilter: "blur(22px) saturate(180%)",
        WebkitBackdropFilter: "blur(22px) saturate(180%)",
        borderColor: "rgba(255,255,255,0.08)",
        position: "sticky",
        top: 0,
        zIndex: 20,
      }}
    >
      {/* Search */}
      <div className="flex-1 max-w-md mx-auto relative">
        <Search
          size={14}
          style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.35)", pointerEvents: "none" }}
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search anything..."
          className="w-full text-sm outline-none"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 9999,
            padding: "6px 40px 6px 34px",
            color: "white",
            caretColor: "#A78BFA",
          }}
        />
        <span
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium px-1.5 py-0.5 rounded"
          style={{ color: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          ⌘ K
        </span>
      </div>

      <div className="flex items-center gap-3">
        {/* Bell */}
        <button
          className="relative flex items-center justify-center rounded-full"
          style={{ width: 32, height: 32, color: "rgba(255,255,255,0.5)", background: "transparent" }}
        >
          <Bell size={16} />
          <span
            className="absolute rounded-full"
            style={{ top: 8, right: 8, width: 6, height: 6, background: "#3B82F6" }}
          />
        </button>

        {/* Avatar */}
        <div
          className="flex items-center gap-2 pl-4 cursor-pointer"
          style={{ borderLeft: "1px solid rgba(255,255,255,0.1)" }}
        >
          <div
            className="flex items-center justify-center rounded-full overflow-hidden"
            style={{ width: 32, height: 32, background: "linear-gradient(135deg,#7C3AED,#3B82F6)", padding: 1.5 }}
          >
            <div
              className="w-full h-full rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: "rgba(30,26,62,0.62)", color: "#A78BFA" }}
            >
              {(user?.username?.trim()[0] ?? "A").toUpperCase()}
            </div>
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-sm font-medium text-white">{user?.username || "Guest"}</span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>{planLabel(user?.subscriptionTier, user?.isOwner)}</span>
          </div>
          <ChevronDown size={12} style={{ color: "rgba(255,255,255,0.4)", marginLeft: 2 }} />
        </div>
      </div>
    </div>
  );
}
