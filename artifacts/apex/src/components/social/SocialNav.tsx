/**
 * Social's own floating glass tab bar. It takes the app's tab bar's place on every Social page
 * (see Layout), with the same size, glass and active circle so the swap feels like one bar changing.
 */
import type { ReactElement } from "react";
import { Link, useLocation } from "wouter";

const HomeIcon = () => (
  <svg viewBox="19.6 11.5 62 62" width={25} height={25} fill="currentColor" aria-hidden>
    <path d="M21.5 49.2 L50.8 18.7 L63.2 31.5 V25 H70.7 V39.6 L79.8 49.2 H72 L50.8 27 L29.3 49.2 Z" />
    <path d="M31.3 53 L38.6 45.5 V65 L31.3 66.3 Z" />
    <path d="M63.2 45.5 L70.4 53 V66.3 L63.2 65 Z" />
    <rect x="45.5" y="36.8" width="4.1" height="4.1" /><rect x="51.8" y="36.8" width="4.1" height="4.1" />
    <rect x="45.5" y="42.3" width="4.1" height="4.1" /><rect x="51.8" y="42.3" width="4.1" height="4.1" />
    <rect x="47.5" y="54.5" width="6.4" height="12.2" rx="0.6" />
  </svg>
);

/** One binocular lens: thick ring, a curved shine and two reflection dots. */
const Lens = ({ cx }: { cx: number }) => (
  <>
    <path fillRule="evenodd" d={`M${cx - 120} 488 a120 120 0 1 0 240 0 a120 120 0 1 0 -240 0 Z M${cx - 97} 488 a97 97 0 1 1 194 0 a97 97 0 1 1 -194 0 Z`} />
    <path d={`M${cx - 62} 540 A80 80 0 0 1 ${cx + 14} 418`} fill="none" stroke="currentColor" strokeWidth={15} strokeLinecap="round" />
    <circle cx={cx + 34} cy={452} r={20} />
    <circle cx={cx + 68} cy={492} r={11} />
  </>
);
const ExploreIcon = () => (
  <svg viewBox="484 360 568 256" width={36} height={16} fill="currentColor" aria-hidden>
    <Lens cx={612} />
    <Lens cx={924} />
    <circle cx={768} cy={428} r={30} fill="none" stroke="currentColor" strokeWidth={14} />
    <rect x={757} y={455} width={22} height={40} rx={6} />
    <circle cx={768} cy={515} r={22} fill="none" stroke="currentColor" strokeWidth={13} />
  </svg>
);

const CreateIcon = () => (
  <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={2.3} strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>
);
const ReelsIcon = () => (
  <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinejoin="round" aria-hidden><rect x="3" y="3" width="18" height="18" rx="5" /><path d="M10 9v6l5-3z" /></svg>
);

/** The guy in the backwards cap, hoodie and chain. */
const ProfileIcon = () => (
  <svg viewBox="16 14 68 70" width={25} height={25} fill="none" stroke="currentColor" strokeWidth={4.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M35 37.5 V30 A15 12.5 0 0 1 65 30 V36" />
    <path d="M47.5 17.6 Q50 15.6 52.5 17.6" />
    <path d="M43 35.5 V33 A7 5.5 0 0 1 57 33 V35.5" />
    <path d="M35 37.5 Q50 33.5 65 36 L69.5 39.5 Q70.5 42.5 66.5 43.2" />
    <path d="M38.5 39.5 A3.8 4.5 0 0 0 39.3 47.5" /><path d="M61.5 39.5 A3.8 4.5 0 0 1 60.7 47.5" />
    <path d="M39.3 47.5 Q42.5 58 50 58 Q57.5 58 60.7 47.5" />
    <path d="M41 55.5 Q35 57.5 34.5 61.5 Q42 67 50 68 Q58 67 65.5 61.5 Q65 57.5 59 55.5" />
    <path d="M33 62.5 Q22.5 65 22.5 72 V78.5 H77.5 V72 Q77.5 65 67 62.5" />
    <path d="M40.5 66 V75" /><path d="M59.5 66 V75" />
    <path d="M44.5 67 Q50 78 55.5 67" />
  </svg>
);

type Item = { href: string; label: string; Icon: () => ReactElement; active: (path: string) => boolean; create?: boolean };
const ITEMS: Item[] = [
  { href: "/feed", label: "Social home", Icon: HomeIcon, active: (p) => p === "/feed" || p.startsWith("/feed/post/") || p.startsWith("/feed/debate/") || p.startsWith("/feed/moments") || p.startsWith("/feed/challenges") },
  { href: "/feed/explore", label: "Explore", Icon: ExploreIcon, active: (p) => p.startsWith("/feed/explore") },
  { href: "/feed/create", label: "Create", Icon: CreateIcon, active: (p) => p.startsWith("/feed/create"), create: true },
  { href: "/feed/reels", label: "Reels", Icon: ReelsIcon, active: (p) => p.startsWith("/feed/reels") },
  { href: "/u/me", label: "Your profile", Icon: ProfileIcon, active: (p) => p === "/u/me" },
];

export function SocialNav() {
  const [location] = useLocation();
  return (
    <div
      className="social-nav-in"
      // The reels player covers the screen (z 9400); the bar stays on top of it there
      style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: location.startsWith("/feed/reels") ? 9450 : 50, display: "flex", justifyContent: "center", pointerEvents: "none", paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))" }}
    >
      <nav
        aria-label="Social"
        className="mg-glass"
        style={{ pointerEvents: "auto", display: "flex", alignItems: "center", justifyContent: "space-around", width: "min(100% - 28px, 420px)", height: 64, padding: "0 8px", borderRadius: 32 }}
      >
        {ITEMS.map(({ href, label, Icon, active, create }) => {
          const on = active(location);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={on ? "page" : undefined}
              className="mg-press mg-focus"
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                color: on ? "#120F2A" : "#F3F0FF",
                background: on ? "rgba(255,255,255,0.9)" : create ? "rgba(255,255,255,0.08)" : "transparent",
                border: create && !on ? "1px solid rgba(255,255,255,0.28)" : "1px solid transparent",
                transition: "background 0.25s, color 0.25s",
              }}
            >
              <Icon />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
