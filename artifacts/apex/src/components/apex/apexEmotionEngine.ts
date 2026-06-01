// ─── Shapekey names that must exist in the Blender export ─────────────────────
export type ShapekeyName =
  | "neutral"
  | "happy"
  | "sad"
  | "angry"
  | "surprised"
  | "focused"
  | "thinking"
  | "jawOpen"
  | "mouthSmileLeft"
  | "mouthSmileRight"
  | "mouthFrownLeft"
  | "mouthFrownRight"
  | "mouthStretch"
  | "mouthPucker"
  | "blinkLeft"
  | "blinkRight"
  | "eyeSquint"
  | "eyeWide"
  | "eyebrowUpLeft"
  | "eyebrowUpRight"
  | "eyebrowDown";

export type EmotionWeights = Partial<Record<ShapekeyName, number>>;

export type AIEmotionState =
  | "idle"
  | "listening"
  | "thinking"
  | "responding"
  | "active"
  | "error";

// ─── Base emotion targets per state ───────────────────────────────────────────
export function getEmotionFromAIState(
  state: AIEmotionState,
  intensity = 1,
): EmotionWeights {
  switch (state) {
    case "idle":
      return {
        neutral: 1 * intensity,
        eyeSquint: 0.08,
        eyebrowDown: 0.05,
      };

    case "listening":
      return {
        focused: 0.75 * intensity,
        eyeWide: 0.25,
        eyebrowUpLeft: 0.3,
        eyebrowUpRight: 0.3,
        neutral: 0.2,
      };

    case "thinking":
      return {
        thinking: 0.85 * intensity,
        eyeSquint: 0.4,
        eyebrowDown: 0.25,
        mouthPucker: 0.12,
        neutral: 0.1,
      };

    case "responding":
      return {
        happy: 0.4 * intensity,
        mouthSmileLeft: 0.3 * intensity,
        mouthSmileRight: 0.3 * intensity,
        eyeWide: 0.15,
        eyebrowUpLeft: 0.1,
        eyebrowUpRight: 0.1,
      };

    case "active":
      return {
        focused: 0.5 * intensity,
        happy: 0.3 * intensity,
        eyeWide: 0.3,
        eyebrowUpLeft: 0.35,
        eyebrowUpRight: 0.35,
        mouthSmileLeft: 0.2,
        mouthSmileRight: 0.2,
      };

    case "error":
      return {
        sad: 0.5 * intensity,
        eyebrowDown: 0.55,
        eyeSquint: 0.4,
        mouthFrownLeft: 0.35,
        mouthFrownRight: 0.35,
      };

    default:
      return { neutral: 1 };
  }
}

// ─── Zero-out all shapekeys (useful when resetting face) ──────────────────────
export function getZeroWeights(): EmotionWeights {
  const keys: ShapekeyName[] = [
    "neutral", "happy", "sad", "angry", "surprised", "focused", "thinking",
    "jawOpen", "mouthSmileLeft", "mouthSmileRight", "mouthFrownLeft",
    "mouthFrownRight", "mouthStretch", "mouthPucker", "blinkLeft", "blinkRight",
    "eyeSquint", "eyeWide", "eyebrowUpLeft", "eyebrowUpRight", "eyebrowDown",
  ];
  return Object.fromEntries(keys.map(k => [k, 0])) as EmotionWeights;
}
