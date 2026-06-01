export type ApexEmotionMode = "idle" | "listening" | "thinking" | "responding" | "active" | "error";

export interface ApexEmotion {
  glow: string;
  glowHex: number;
  glowIntensity: number;
  speed: number;
  expression: string;
  eyeColor: string;
  eyeHex: number;
  coreColor: string;
  coreHex: number;
  particleSpeed: number;
  pupilDilation: number;
}

export function getApexEmotion(mode: ApexEmotionMode): ApexEmotion {
  switch (mode) {
    case "idle":
      return {
        glow: "#4f7cff",
        glowHex: 0x4f7cff,
        glowIntensity: 1.2,
        speed: 1,
        expression: "neutral",
        eyeColor: "#4f7cff",
        eyeHex: 0x4f7cff,
        coreColor: "#7C3AED",
        coreHex: 0x7c3aed,
        particleSpeed: 0.3,
        pupilDilation: 0.5,
      };
    case "listening":
      return {
        glow: "#00ffff",
        glowHex: 0x00ffff,
        glowIntensity: 2.2,
        speed: 1.5,
        expression: "focused",
        eyeColor: "#00ffff",
        eyeHex: 0x00ffff,
        coreColor: "#06B6D4",
        coreHex: 0x06b6d4,
        particleSpeed: 0.8,
        pupilDilation: 0.7,
      };
    case "thinking":
      return {
        glow: "#a855f7",
        glowHex: 0xa855f7,
        glowIntensity: 1.8,
        speed: 2,
        expression: "processing",
        eyeColor: "#a855f7",
        eyeHex: 0xa855f7,
        coreColor: "#8B5CF6",
        coreHex: 0x8b5cf6,
        particleSpeed: 1.2,
        pupilDilation: 0.3,
      };
    case "responding":
      return {
        glow: "#22c55e",
        glowHex: 0x22c55e,
        glowIntensity: 2.2,
        speed: 1.2,
        expression: "speaking",
        eyeColor: "#22c55e",
        eyeHex: 0x22c55e,
        coreColor: "#10B981",
        coreHex: 0x10b981,
        particleSpeed: 0.9,
        pupilDilation: 0.6,
      };
    case "active":
      return {
        glow: "#EC4899",
        glowHex: 0xec4899,
        glowIntensity: 2.5,
        speed: 1.8,
        expression: "engaged",
        eyeColor: "#EC4899",
        eyeHex: 0xec4899,
        coreColor: "#EC4899",
        coreHex: 0xec4899,
        particleSpeed: 1.5,
        pupilDilation: 0.8,
      };
    default:
      return {
        glow: "#ffffff",
        glowHex: 0xffffff,
        glowIntensity: 1,
        speed: 1,
        expression: "neutral",
        eyeColor: "#ffffff",
        eyeHex: 0xffffff,
        coreColor: "#ffffff",
        coreHex: 0xffffff,
        particleSpeed: 0.3,
        pupilDilation: 0.5,
      };
  }
}
