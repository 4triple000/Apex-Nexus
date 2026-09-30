/**
 * FTUEScreen — Orchestrator for the First-Time User Experience.
 *
 * Manages transitions between the 3 onboarding steps:
 *   1. IntroScreen    — animated logo + text fade sequence
 *   2. AvatarIntro    — avatar WOW moment + spoken quote
 *   3. PersonalitySetup — pick interaction style → enters app
 *
 * Also exported: FTUEGate — wraps ProtectedLayout, shows FTUE once.
 *
 * Individual screens live in /src/onboarding/:
 *   useOnboarding.ts   PersonalitySetup.tsx
 *   IntroScreen.tsx    AvatarIntro.tsx
 */
import { useState, useCallback } from "react";
import { useOnboarding, ONBOARDING_CSS, SPRING } from "@/onboarding/useOnboarding";
import { StarField, AmbientOrbs } from "@/onboarding/OnboardingBackground";
import { IntroScreen }      from "@/onboarding/IntroScreen";
import { AvatarIntro }      from "@/onboarding/AvatarIntro";
import { PersonalitySetup } from "@/onboarding/PersonalitySetup";

// ── Step type ─────────────────────────────────────────────────────────────────

type Step = "intro" | "avatar" | "personality";

const STEP_ORDER: Step[] = ["intro", "avatar", "personality"];
const STEP_INDEX: Record<Step, number> = { intro: 0, avatar: 1, personality: 2 };

// ── Orchestrator ─────────────────────────────────────────────────────────────

interface FTUEScreenProps {
  onComplete: () => void;
}

export function FTUEScreen({ onComplete }: FTUEScreenProps) {
  const { completeOnboarding } = useOnboarding();
  const [step,    setStep]    = useState<Step>("intro");
  const [exiting, setExiting] = useState(false);

  const advance = useCallback(() => {
    setExiting(true);
    setTimeout(() => {
      setStep((prev) => {
        const idx = STEP_INDEX[prev];
        return idx < STEP_ORDER.length - 1 ? STEP_ORDER[idx + 1] : prev;
      });
      setExiting(false);
    }, 380);
  }, []);

  const skipToPersonality = useCallback(() => {
    setExiting(true);
    setTimeout(() => {
      setStep("personality");
      setExiting(false);
    }, 320);
  }, []);

  // completeOnboarding() is called by FTUEGate.handleComplete via onComplete()
  const handleComplete = useCallback(() => {
    onComplete();
  }, [onComplete]);

  const stepIdx = STEP_INDEX[step];

  return (
    <>
      <style>{ONBOARDING_CSS}</style>

      {/* ── Fullscreen dark backdrop ─────────────────────────────────── */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 99999,
        background: "rgba(14,11,32,0.92)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: step === "personality" ? "flex-start" : "center",
        overflow: step === "personality" ? "auto" : "hidden",
      }}>
        <StarField />
        <AmbientOrbs />

        {/* ── Skip button (hidden on personality step) ─────────────── */}
        {step !== "personality" && (
          <button
            onClick={skipToPersonality}
            style={{
              position: "fixed", top: 20, right: 20, zIndex: 100001,
              padding: "7px 15px", borderRadius: 99,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.11)",
              color: "rgba(255,255,255,0.44)",
              fontSize: 12, fontWeight: 600,
              cursor: "pointer",
              backdropFilter: "blur(10px)",
              transition: `all 0.15s ease`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color      = "rgba(255,255,255,0.80)";
              e.currentTarget.style.background = "rgba(255,255,255,0.11)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color      = "rgba(255,255,255,0.44)";
              e.currentTarget.style.background = "rgba(255,255,255,0.06)";
            }}
          >
            Skip intro
          </button>
        )}

        {/* ── Step dots ────────────────────────────────────────────── */}
        {step !== "personality" && (
          <div style={{
            position: "fixed", bottom: 28,
            display: "flex", gap: 6, zIndex: 100001,
          }}>
            {STEP_ORDER.map((s, i) => (
              <div key={s} style={{
                width:        stepIdx === i ? 22 : 5,
                height:       5,
                borderRadius: 3,
                background:   stepIdx === i
                  ? "linear-gradient(90deg, #6C5CE7, #A29BFE)"
                  : "rgba(255,255,255,0.15)",
                transition: `all 0.38s ${SPRING}`,
              }} />
            ))}
          </div>
        )}

        {/* ── Active screen ────────────────────────────────────────── */}
        {step === "intro" && (
          <IntroScreen exiting={exiting} onNext={advance} />
        )}
        {step === "avatar" && (
          <AvatarIntro exiting={exiting} onNext={advance} />
        )}
        {step === "personality" && (
          <PersonalitySetup exiting={exiting} onComplete={handleComplete} />
        )}
      </div>
    </>
  );
}

// ── FTUEGate — renders FTUE once, then passes through to children ─────────────

export function FTUEGate({ children }: { children: React.ReactNode }) {
  const { isFirstTime, completeOnboarding } = useOnboarding();

  // isFirstTime is read once on mount — stable for the session
  const [showFTUE, setShowFTUE] = useState<boolean>(isFirstTime);

  function handleComplete() {
    completeOnboarding();
    setShowFTUE(false);
  }

  return (
    <>
      {children}
      {showFTUE && <FTUEScreen onComplete={handleComplete} />}
    </>
  );
}
