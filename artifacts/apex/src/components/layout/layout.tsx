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
        style={{ background: "#0A0A0F", borderColor: "rgba(108,92,231,0.12)" }}
      >
        {/* Ambient gradient orbs */}
        <div aria-hidden style={{ position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)", width: 640, height: 320, background: "radial-gradient(ellipse at 50% 0%, rgba(108,92,231,0.16) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
        <div aria-hidden style={{ position: "fixed", top: "35%", left: -60, width: 280, height: 280, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,210,211,0.06) 0%, transparent 70%)", filter: "blur(48px)", pointerEvents: "none", zIndex: 0 }} />
        <div aria-hidden style={{ position: "fixed", top: "68%", right: -40, width: 220, height: 220, borderRadius: "50%", background: "radial-gradient(circle, rgba(253,121,168,0.07) 0%, transparent 70%)", filter: "blur(48px)", pointerEvents: "none", zIndex: 0 }} />
        <div aria-hidden style={{ position: "fixed", inset: 0, backgroundImage: "linear-gradient(rgba(108,92,231,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(108,92,231,0.03) 1px, transparent 1px)", backgroundSize: "48px 48px", pointerEvents: "none", zIndex: 0 }} />
        <div aria-hidden style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: 160, background: "linear-gradient(to top, rgba(10,10,15,0.90) 0%, transparent 100%)", pointerEvents: "none", zIndex: 5 }} />

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
