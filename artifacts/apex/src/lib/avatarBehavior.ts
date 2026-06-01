/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  AVATAR BEHAVIOR ENGINE                                  ║
 * ║  Maps personality blend → avatar expression/animation   ║
 * ╚══════════════════════════════════════════════════════════╝
 */
import { BlendSlot, APEX_PERSONALITIES, ApexPersonalityId } from './personalityEngine';
import { Emotion } from './emotionController';
import { AvatarState } from '@/hooks/useAvatarStore';

// ── Behavior definitions per personality ──────────────────────────────────────

export type AvatarExpression = 'focused' | 'smiling' | 'calm' | 'intense' | 'curious';
export type AvatarAnimation  = 'minimal' | 'bouncy' | 'steady' | 'fast' | 'dynamic';
export type AvatarMovement   = 'sharp' | 'relaxed' | 'guided' | 'aggressive' | 'exploratory';

export interface AvatarBehaviorProfile {
  expression: AvatarExpression;
  animation:  AvatarAnimation;
  movement:   AvatarMovement;
  /** Maps to the Emotion type for AvatarFace */
  emotion:    Emotion;
  /** Maps to AvatarState for Avatar3DScene */
  avatarState: AvatarState;
  /** CSS animation speed multiplier (applied as --anim-speed CSS var) */
  animationSpeed: number;  // 1.0 = normal
  /** Idle bounce intensity 0–1 */
  bounceIntensity: number;
}

export const AVATAR_BEHAVIOR: Record<ApexPersonalityId, AvatarBehaviorProfile> = {
  strategist: {
    expression:     'focused',
    animation:      'minimal',
    movement:       'sharp',
    emotion:        'serious',
    avatarState:    'idle',
    animationSpeed: 0.8,
    bounceIntensity: 0.2,
  },
  friend: {
    expression:     'smiling',
    animation:      'bouncy',
    movement:       'relaxed',
    emotion:        'happy',
    avatarState:    'waving',
    animationSpeed: 1.15,
    bounceIntensity: 0.9,
  },
  mentor: {
    expression:     'calm',
    animation:      'steady',
    movement:       'guided',
    emotion:        'thinking',
    avatarState:    'walking',
    animationSpeed: 0.9,
    bounceIntensity: 0.4,
  },
  debater: {
    expression:     'intense',
    animation:      'fast',
    movement:       'aggressive',
    emotion:        'concerned',
    avatarState:    'idle',
    animationSpeed: 1.3,
    bounceIntensity: 0.6,
  },
  innovator: {
    expression:     'curious',
    animation:      'dynamic',
    movement:       'exploratory',
    emotion:        'excited',
    avatarState:    'dancing',
    animationSpeed: 1.2,
    bounceIntensity: 0.85,
  },
  // Legacy personalities (backward compat)
  hood: {
    expression:     'focused',
    animation:      'bouncy',
    movement:       'relaxed',
    emotion:        'happy',
    avatarState:    'waving',
    animationSpeed: 1.1,
    bounceIntensity: 0.7,
  },
  professional: {
    expression:     'calm',
    animation:      'minimal',
    movement:       'sharp',
    emotion:        'serious',
    avatarState:    'idle',
    animationSpeed: 0.75,
    bounceIntensity: 0.1,
  },
  bigbro: {
    expression:     'smiling',
    animation:      'steady',
    movement:       'guided',
    emotion:        'happy',
    avatarState:    'waving',
    animationSpeed: 0.95,
    bounceIntensity: 0.5,
  },
};

// ── Weighted mixing utilities ─────────────────────────────────────────────────

/** Weighted average for numeric behavior fields */
function weightedNum(blend: BlendSlot[], field: 'animationSpeed' | 'bounceIntensity'): number {
  const total = blend.reduce((sum, s) => sum + s.weight, 0);
  if (total === 0) return 1;
  return blend.reduce((sum, s) => {
    const b = AVATAR_BEHAVIOR[s.id] ?? AVATAR_BEHAVIOR.strategist;
    return sum + b[field] * (s.weight / total);
  }, 0);
}

/** Dominant value for categorical fields (expression/animation/movement/emotion/avatarState) */
function weightedDominant<T>(blend: BlendSlot[], field: keyof AvatarBehaviorProfile): T {
  const active = blend.filter((s) => s.weight > 0).sort((a, b) => b.weight - a.weight);
  const dominant = active[0] ?? { id: 'strategist' as ApexPersonalityId };
  const b = AVATAR_BEHAVIOR[dominant.id] ?? AVATAR_BEHAVIOR.strategist;
  return b[field] as T;
}

/** Full blended avatar behavior from a personality blend array */
export function getAvatarBehavior(blend: BlendSlot[]): AvatarBehaviorProfile {
  const active = blend.filter((s) => s.weight > 0);
  if (active.length === 0) return AVATAR_BEHAVIOR.strategist;
  if (active.length === 1) return AVATAR_BEHAVIOR[active[0].id] ?? AVATAR_BEHAVIOR.strategist;

  return {
    expression:     weightedDominant<AvatarExpression>(active, 'expression'),
    animation:      weightedDominant<AvatarAnimation>(active, 'animation'),
    movement:       weightedDominant<AvatarMovement>(active, 'movement'),
    emotion:        weightedDominant<Emotion>(active, 'emotion'),
    avatarState:    weightedDominant<AvatarState>(active, 'avatarState'),
    animationSpeed: weightedNum(active, 'animationSpeed'),
    bounceIntensity: weightedNum(active, 'bounceIntensity'),
  };
}

/** CSS vars string to inject for animation overrides */
export function getAvatarCSSVars(behavior: AvatarBehaviorProfile): Record<string, string> {
  return {
    '--avatar-anim-speed':    `${(1 / behavior.animationSpeed).toFixed(2)}s`,
    '--avatar-bounce':        `${(behavior.bounceIntensity * 12).toFixed(1)}px`,
    '--avatar-pulse-scale':   `${(1 + behavior.bounceIntensity * 0.04).toFixed(3)}`,
  };
}
