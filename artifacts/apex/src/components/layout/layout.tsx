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
        className="lg:hidden min-h-[100dvh] flex flex-col w-full mx-auto max-w-md border-x relative overflow-hidden shadow-2xl"
        style={{ background: "var(--mg-bg)", borderColor: "rgba(139,123,255,0.12)", color: "var(--mg-ink)" }}
      >
        {/* Midnight Glass: soft moving light that the frosted surfaces pick up */}
        <div aria-hidden className="mg-blob" style={{ width: 280, height: 280, top: 60, left: -90, background: "rgba(108,92,231,0.55)" }} />
        <div aria-hidden className="mg-blob" style={{ width: 240, height: 240, top: "42%", right: -80, background: "rgba(0,194,255,0.32)", animationDelay: "-5s" }} />
        <div aria-hidden className="mg-blob" style={{ width: 220, height: 220, bottom: 40, left: 10, background: "rgba(255,79,163,0.26)", animationDelay: "-10s" }} />

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
        style={{ background: "#07070F" }}
      >
        {/* Subtle purple gradient top-left bloom */}
        <div aria-hidden style={{ position: "fixed", top: 0, left: 0, width: 600, height: 400, background: "radial-gradient(ellipse at 0% 0%, rgba(124,58,237,0.08) 0%, transparent 65%)", pointerEvents: "none", zIndex: 0 }} />
        {/* Bottom-right blue bloom */}
        <div aria-hidden style={{ position: "fixed", bottom: 0, right: 0, width: 500, height: 400, background: "radial-gradient(ellipse at 100% 100%, rgba(59,130,246,0.07) 0%, transparent 65%)", pointerEvents: "none", zIndex: 0 }} />

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
