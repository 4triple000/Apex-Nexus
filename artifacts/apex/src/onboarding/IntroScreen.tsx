/**
 * IntroScreen — Step 1 of FTUE
 *
 * Plays two sub-phases automatically:
 *   phase A: Apex logo materializes + "Welcome to Apex Nexus" fades in  (2.4s)
 *   phase B: "This isn't just AI…" + "this is your AI."           (2.8s)
 *
 * Calls onNext() after both phases complete.
 * Respects an exiting prop to play the exit animation on demand.
 */
import { useState, useEffect } from "react";
import { IOS, SPRING } from "./useOnboarding";
import { ApexLogo } from "@/components/ui/ApexLogo";

interface IntroScreenProps {
  exiting: boolean;
  onNext:  () => void;
}

export function IntroScreen({ exiting, onNext }: IntroScreenProps) {
  const [phase, setPhase] = useState<"welcome" | "tagline">("welcome");
  const [subExiting, setSubExiting] = useState(false);

  // Auto-advance welcome → tagline → call onNext
  useEffect(() => {
    if (phase === "welcome") {
      const t = setTimeout(() => {
        setSubExiting(true);
        setTimeout(() => {
          setSubExiting(false);
          setPhase("tagline");
        }, 360);
      }, 2400);
      return () => clearTimeout(t);
    }

    if (phase === "tagline") {
      const t = setTimeout(() => onNext(), 2800);
      return () => clearTimeout(t);
    }
  }, [phase, onNext]);

  const wrapAnim = (exiting || subExiting)
    ? "ob-fade-out 0.36s ease forwards"
    : "ob-fade-in  0.55s ease both";

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      width: "100%", padding: "0 32px",
      animation: wrapAnim,
      textAlign: "center",
    }}>

      {phase === "welcome" && (
        <>
          {/* Apex logo */}
          <div style={{
            marginBottom: 32,
            animation: `ob-logo-in 0.95s ${SPRING} both`,
          }}>
            <ApexLogo size={96} state="active" radius={26} />
          </div>

          {/* Welcome text */}
          <div style={{
            fontSize: 40, fontWeight: 900, color: "#fff",
            letterSpacing: "-0.03em", lineHeight: 1.12,
            animation: "ob-fade-in 0.75s 0.55s both",
          }}>
            Welcome to Apex Nexus
          </div>

          {/* Sub-tagline */}
          <div style={{
            fontSize: 14, color: "rgba(255,255,255,0.35)",
            marginTop: 12, fontWeight: 500,
            animation: "ob-fade-in 0.6s 1.0s both",
            letterSpacing: "0.01em",
          }}>
            Your personal AI, built around you.
          </div>
        </>
      )}

      {phase === "tagline" && (
        <>
          {/* Line 1 */}
          <div style={{
            fontSize: 30, fontWeight: 800,
            color: "rgba(255,255,255,0.55)",
            letterSpacing: "-0.025em", lineHeight: 1.3,
            animation: "ob-fade-in 0.65s 0.05s both",
            marginBottom: 10,
          }}>
            This isn't just AI…
          </div>

          {/* Line 2 — gradient shimmer */}
          <div style={{
            fontSize: 34, fontWeight: 900,
            letterSpacing: "-0.03em", lineHeight: 1.2,
            background: "linear-gradient(135deg, #6C5CE7, #A29BFE 50%, #FD79A8)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundSize: "200% auto",
            animation: "ob-fade-in 0.75s 0.5s both, ob-shimmer 3.5s 0.5s linear infinite",
          }}>
            this is your AI.
          </div>

          {/* Small rule */}
          <div style={{
            width: 44, height: 2, borderRadius: 1,
            background: "linear-gradient(90deg, #6C5CE7, #FD79A8)",
            margin: "22px auto 0",
            animation: "ob-fade-in 0.5s 0.9s both",
          }} />
        </>
      )}
    </div>
  );
}
