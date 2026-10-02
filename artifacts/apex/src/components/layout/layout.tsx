import { ReactNode } from "react";
import { useLocation } from "wouter";
import { BottomNav } from "./bottom-nav";
import { Sidebar } from "./sidebar";
import { TopBar } from "./topbar";
import { RightPanel } from "./right-panel";
import { AvatarOverlay } from "@/components/avatar/AvatarOverlay";
import { useAvatar } from "@/contexts/AvatarContext";
import { ApexControlPanel } from "@/components/apex/ApexControlPanel";
import { useStreakCheckin } from "@/lib/dailyStreak";

/** Pages that paint their own full-screen background, including behind the ☰ button: all of Social. */
const isFullScreen = (path: string) => path === "/feed" || path.startsWith("/feed/") || path.startsWith("/u/");

function PageTransition({ children, location, phone = false }: { children: ReactNode; location: string; phone?: boolean }) {
  return (
    <div
      key={location}
      className={phone ? "apex-page" : undefined}
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        animation: "page-enter 0.28s cubic-bezier(0.25, 0.46, 0.45, 0.94) both",
        willChange: "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const avatarStore = useAvatar();
  const [location] = useLocation();
  useStreakCheckin();
  // Home and Chat leave room for the fixed ☰ button in their own headers; other pages start below it

  return (
    <>
      {/* ══════════════════════════════════════════════
          MOBILE layout — hidden on lg+ screens
      ══════════════════════════════════════════════ */}
      <div
        className="mg-font lg:hidden h-[100dvh] flex flex-col w-full mx-auto max-w-md border-x relative overflow-hidden shadow-2xl"
        style={{ background: "transparent", borderColor: "rgba(139,123,255,0.12)", color: "var(--mg-ink)" }}
      >
        <ApexControlPanel />

        {/* Pages run to the bottom edge so the tab bar floats over them; each page's scroll area leaves room for it (--apex-nav-space).
            Full-screen pages (Social) also paint behind the ☰ button and add their own top space. */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative", zIndex: 10, paddingTop: isFullScreen(location) ? 0 : location === "/" || location.startsWith("/dm") ? 4 : location === "/settings" ? 20 : 64 }}>
          <PageTransition location={location} phone>{children}</PageTransition>
        </div>

        <BottomNav />
        <AvatarOverlay store={avatarStore} />
      </div>

      {/* ══════════════════════════════════════════════
          DESKTOP layout — hidden below lg
      ══════════════════════════════════════════════ */}
      <div
        className="hidden lg:flex min-h-[100dvh] w-full relative"
        style={{ background: "transparent", color: "var(--mg-ink)" }}
      >
        {/* Sidebar */}
        <Sidebar />

        {/* Main area: TopBar + content + right panel */}
        <div className="flex-1 flex flex-col min-w-0 relative" style={{ zIndex: 1 }}>
          <TopBar />

          <div className="flex-1 flex overflow-hidden">
            {/* Page content */}
            <main className="flex-1 flex flex-col overflow-hidden relative">
              <ApexControlPanel />
              <PageTransition location={location}>{children}</PageTransition>
            </main>

            {/* Right panel */}
            <RightPanel />
          </div>
        </div>
      </div>
    </>
  );
}
