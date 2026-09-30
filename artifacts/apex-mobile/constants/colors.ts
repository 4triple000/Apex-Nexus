/**
 * Apex Mobile design tokens — Midnight Glass.
 * Deep navy base, frosted glass surfaces, violet / cyan / pink light.
 * Matches the Apex web app.
 */

const colors = {
  light: {
    text: "#F3F0FF",
    tint: "#8B7BFF",
    background: "#0A0918",
    foreground: "#F3F0FF",
    card: "rgba(255,255,255,0.08)",
    cardForeground: "#F3F0FF",
    primary: "#8B7BFF",
    primaryForeground: "#FFFFFF",
    secondary: "rgba(255,255,255,0.07)",
    secondaryForeground: "#F3F0FF",
    muted: "rgba(255,255,255,0.06)",
    mutedForeground: "rgba(243,240,255,0.55)",
    accent: "#00C2FF",
    accentForeground: "#0A0918",
    destructive: "#F87171",
    destructiveForeground: "#FFFFFF",
    border: "rgba(255,255,255,0.14)",
    input: "rgba(255,255,255,0.07)",
    userBubble: "#6C5CE7",
    userBubbleText: "#FFFFFF",
    aiBubble: "rgba(255,255,255,0.09)",
    aiBubbleText: "#F3F0FF",
    success: "#4ADE80",
  },
  radius: 18,
};

/** Midnight Glass palette for screens that style directly. */
export const MG = {
  bg: "#0A0918",
  ink: "#F3F0FF",
  ink2: "rgba(243,240,255,0.62)",
  ink3: "rgba(243,240,255,0.38)",
  violet: "#8B7BFF",
  cyan: "#00C2FF",
  pink: "#FF4FA3",
  glassBorder: "rgba(255,255,255,0.16)",
  glassFill: "rgba(255,255,255,0.08)",
};

/** Midnight Glass fonts (loaded in app/_layout.tsx). */
export const MGFont = {
  display: "Sora_700Bold",
  displaySemi: "Sora_600SemiBold",
  body: "Manrope_400Regular",
  medium: "Manrope_500Medium",
  semi: "Manrope_600SemiBold",
  bold: "Manrope_700Bold",
};

export default colors;
