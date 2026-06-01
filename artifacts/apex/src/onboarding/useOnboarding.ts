/**
 * useOnboarding — hook + shared animation constants for the FTUE system.
 *
 * Background React components (StarField, AmbientOrbs) live in
 * OnboardingBackground.tsx to keep JSX out of this .ts file.
 */

export const ONBOARDED_KEY = "apex_onboarded";

export function useOnboarding() {
  const isFirstTime = !localStorage.getItem(ONBOARDED_KEY);

  function completeOnboarding() {
    localStorage.setItem(ONBOARDED_KEY, "true");
  }

  function resetOnboarding() {
    localStorage.removeItem(ONBOARDED_KEY);
  }

  return { isFirstTime, completeOnboarding, resetOnboarding };
}

// ── Shared easing constants ───────────────────────────────────────────────────

export const IOS    = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";
export const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

// ── Global CSS keyframes (injected by FTUEScreen into <style>) ────────────────

export const ONBOARDING_CSS = `
  @keyframes ob-fade-in {
    from { opacity: 0; transform: translateY(20px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0)    scale(1);    }
  }
  @keyframes ob-fade-out {
    from { opacity: 1; transform: translateY(0)    scale(1);    }
    to   { opacity: 0; transform: translateY(-16px) scale(0.97); }
  }
  @keyframes ob-logo-in {
    0%   { opacity: 0; transform: scale(0.55) rotate(-18deg); }
    60%  { opacity: 1; transform: scale(1.10) rotate(4deg); }
    100% { opacity: 1; transform: scale(1)    rotate(0deg); }
  }
  @keyframes ob-logo-pulse {
    0%, 100% { box-shadow: 0 0 28px rgba(108,92,231,0.55), 0 0 56px rgba(162,155,254,0.28); }
    50%       { box-shadow: 0 0 52px rgba(108,92,231,0.85), 0 0 100px rgba(162,155,254,0.55); }
  }
  @keyframes ob-shimmer {
    0%   { background-position: -200% center; }
    100% { background-position:  200% center; }
  }
  @keyframes ob-orb-breathe {
    0%, 100% { transform: scale(1);    opacity: 0.90; }
    50%       { transform: scale(1.07); opacity: 1;    }
  }
  @keyframes ob-ring-cw {
    from { transform: translate(-50%,-50%) rotate(0deg); }
    to   { transform: translate(-50%,-50%) rotate(360deg); }
  }
  @keyframes ob-ring-ccw {
    from { transform: translate(-50%,-50%) rotate(0deg); }
    to   { transform: translate(-50%,-50%) rotate(-360deg); }
  }
  @keyframes ob-head-idle {
    0%, 100% { transform: rotate(-1.5deg) translateY(0px); }
    33%       { transform: rotate(1.5deg)  translateY(-3px); }
    66%       { transform: rotate(-0.5deg) translateY(-1px); }
  }
  @keyframes ob-wave-bar {
    0%, 100% { transform: scaleY(0.5); }
    50%       { transform: scaleY(1.0); }
  }
  @keyframes ob-star {
    0%, 100% { opacity: 0.08; }
    50%       { opacity: 0.55; }
  }
  @keyframes ob-btn-glow {
    0%, 100% { box-shadow: 0 4px 22px rgba(108,92,231,0.40); }
    50%       { box-shadow: 0 4px 40px rgba(162,155,254,0.70); }
  }
  @keyframes ob-card-in {
    from { opacity: 0; transform: translateY(14px) scale(0.96); }
    to   { opacity: 1; transform: translateY(0)    scale(1);    }
  }
  @keyframes ob-confirm-in {
    from { opacity: 0; transform: scale(0.9) translateY(8px); }
    to   { opacity: 1; transform: scale(1)   translateY(0);   }
  }
`;
