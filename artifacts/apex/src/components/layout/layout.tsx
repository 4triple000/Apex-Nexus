import { ReactNode } from "react";
import { useLocation } from "wouter";
import { BottomNav } from "./bottom-nav";
import { Sidebar } from "./sidebar";
import { TopBar } from "./topbar";
import { RightPanel } from "./right-panel";
import { AvatarOverlay } from "@/components/avatar/AvatarOverlay";
import { useAvatar } from "@/contexts/AvatarContext";
import { ApexControlPanel } from "@/components/apex/ApexControlPanel";

function PageTransition({ children, location }: { children: ReactNode; location: string }) {
  return (
    <div
      key={location}
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

  return (
    <>
      {/* ══════════════════════════════════════════════
          MOBILE layout — hidden on lg+ screens
      ══════════════════════════════════════════════ */}
      <div
        className="mg-font lg:hidden min-h-[100dvh] flex flex-col w-full mx-auto max-w-md border-x relative overflow-hidden shadow-2xl"
        style={{ background: "var(--mg-bg)", borderColor: "rgba(139,123,255,0.12)", color: "var(--mg-ink)" }}
      >
        {/* Midnight Glass: bright moving light that the frosted surfaces pick up */}
        <div aria-hidden className="mg-blob" style={{ width: 280, height: 280, top: 120, left: -85, background: "#6C5CE7" }} />
        <div aria-hidden className="mg-blob" style={{ width: 250, height: 250, top: 330, right: -70, background: "#00C2FF", opacity: 0.75, animationDelay: "-5s" }} />
        <div aria-hidden className="mg-blob" style={{ width: 225, height: 225, bottom: 55, left: 25, background: "#FF4FA3", opacity: 0.55, animationDelay: "-9s" }} />

        <ApexControlPanel />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative", zIndex: 10, paddingBottom: 96, paddingTop: 4 }}>
          <PageTransition location={location}>{children}</PageTransition>
        </div>

        <BottomNav />
        <AvatarOverlay store={avatarStore} />
      </div>

      {/* ══════════════════════════════════════════════
          DESKTOP layout — hidden below lg
      ══════════════════════════════════════════════ */}
      <div
        className="hidden lg:flex min-h-[100dvh] w-full relative"
        style={{ background: "var(--mg-bg)", color: "var(--mg-ink)" }}
      >
        {/* Midnight Glass light */}
        <div aria-hidden className="mg-blob" style={{ width: 520, height: 520, top: -80, left: 120, background: "rgba(108,92,231,0.42)" }} />
        <div aria-hidden className="mg-blob" style={{ width: 460, height: 460, top: "40%", right: -120, background: "rgba(0,194,255,0.22)", animationDelay: "-6s" }} />
        <div aria-hidden className="mg-blob" style={{ width: 420, height: 420, bottom: -120, left: "30%", background: "rgba(255,79,163,0.18)", animationDelay: "-11s" }} />

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
