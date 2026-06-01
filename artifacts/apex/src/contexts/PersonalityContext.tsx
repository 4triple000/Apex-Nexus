/**
 * ╔══════════════════════════════════════════════════════╗
 * ║  GLOBAL PERSONALITY CONTEXT — v3                    ║
 * ║  Single source of truth for AI personality state    ║
 * ║  Supports: single mode + multi-personality blending ║
 * ╚══════════════════════════════════════════════════════╝
 */
import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from "react";
import {
  GlobalPersonalityState,
  DEFAULT_GLOBAL_PERSONALITY,
  DEFAULT_BLEND,
  loadGlobalPersonality,
  saveGlobalPersonality,
  buildGlobalSystemPrompt,
  buildBlendedPrompt,
  describeBlend,
  normalizeBlend,
  getGlobalDmPersonalityMode,
  APEX_PERSONALITIES,
  ApexPersonalityId,
  ApexPersonalityProfile,
  BlendSlot,
  BLEND_PRESETS,
  BlendPreset,
} from "@/lib/personalityEngine";
import { getAvatarBehavior, AvatarBehaviorProfile } from "@/lib/avatarBehavior";
import { getVoiceStyle, VoiceStyle } from "@/lib/voicePersonality";

// ── Context type ──────────────────────────────────────────────────────────────
interface PersonalityContextValue {
  personality: GlobalPersonalityState;

  /** Update any part of the personality state */
  setPersonality: (update: Partial<GlobalPersonalityState>) => void;

  /** Computed system prompt — auto-switches between blend and single mode */
  systemPrompt: string;

  /** DM backend personality mode for the dominant personality */
  dmPersonalityMode: string;

  /** Full profile of the dominant personality */
  profile: ApexPersonalityProfile;

  /** Quick setter for single-mode personality ID (also updates blend to 100% that ID) */
  setPersonalityId: (id: ApexPersonalityId) => void;

  /** Quick setter for intensity (single mode only) */
  setIntensity: (intensity: number) => void;

  // ── Blend API ──────────────────────────────────────────────────────────────
  /** The current blend array */
  blend: BlendSlot[];

  /** Update a single slot's weight — auto-normalizes others */
  setSlotWeight: (id: ApexPersonalityId, weight: number) => void;

  /** Apply a full blend preset */
  applyPreset: (preset: BlendPreset) => void;

  /** Natural language description of the current blend */
  blendDescription: string;

  /** All available presets */
  presets: BlendPreset[];

  // ── Avatar & Voice hooks ────────────────────────────────────────────────────
  /** Avatar behavior driven by the current blend (expression/animation/emotion/state) */
  avatarBehavior: AvatarBehaviorProfile;

  /** Voice style driven by the current blend (pitch/speed/tone) */
  voiceStyle: VoiceStyle;
}

const PersonalityContext = createContext<PersonalityContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────
export function PersonalityProvider({ children }: { children: ReactNode }) {
  const [personality, setPersonalityState] = useState<GlobalPersonalityState>(() =>
    loadGlobalPersonality()
  );

  const syncTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ensure blend always has all 5 main slots
  const normalizedBlend: BlendSlot[] = (() => {
    const ids: ApexPersonalityId[] = ['strategist', 'friend', 'mentor', 'debater', 'innovator'];
    const existing = personality.blend ?? DEFAULT_BLEND;
    return ids.map((id) => {
      const found = existing.find((s) => s.id === id);
      return found ?? { id, weight: 0 };
    });
  })();

  // Derive computed values
  const systemPrompt = personality.useBlend && personality.blend?.some((s) => s.weight > 0)
    ? buildBlendedPrompt(personality.blend)
    : buildGlobalSystemPrompt(personality.id, personality.intensity, personality.traits);

  const dmPersonalityMode = getGlobalDmPersonalityMode();

  const dominantId = personality.useBlend && personality.blend?.length
    ? ([...personality.blend].sort((a, b) => b.weight - a.weight)[0]?.id ?? personality.id)
    : personality.id;

  const profile = APEX_PERSONALITIES[dominantId] ?? APEX_PERSONALITIES.strategist;

  const blendDescription = describeBlend(normalizedBlend);

  // Avatar behavior and voice style — reactive to blend changes
  const avatarBehavior = getAvatarBehavior(normalizedBlend);
  const voiceStyle     = getVoiceStyle(normalizedBlend);

  // Persist to localStorage + debounced backend sync
  useEffect(() => {
    saveGlobalPersonality(personality);

    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    // Personality is persisted in localStorage — no backend sync needed

    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [personality]);

  const setPersonality = useCallback((update: Partial<GlobalPersonalityState>) => {
    setPersonalityState((prev) => ({ ...prev, ...update }));
  }, []);

  const setPersonalityId = useCallback((id: ApexPersonalityId) => {
    setPersonalityState((prev) => {
      // Also update blend so single-personality button selection reflects in blend mode
      const newBlend: BlendSlot[] = ['strategist', 'friend', 'mentor', 'debater', 'innovator'].map(
        (pid) => ({ id: pid as ApexPersonalityId, weight: pid === id ? 100 : 0 })
      );
      return { ...prev, id, blend: newBlend, useBlend: true };
    });
  }, []);

  const setIntensity = useCallback((intensity: number) => {
    setPersonalityState((prev) => ({ ...prev, intensity: Math.min(1, Math.max(0, intensity)) }));
  }, []);

  const setSlotWeight = useCallback((targetId: ApexPersonalityId, newWeight: number) => {
    setPersonalityState((prev) => {
      const ids: ApexPersonalityId[] = ['strategist', 'friend', 'mentor', 'debater', 'innovator'];
      const existing = prev.blend ?? DEFAULT_BLEND;

      // Clamp new weight
      const clamped = Math.max(0, Math.min(100, Math.round(newWeight)));

      // Build updated slots — distribute remaining weight proportionally among others
      const others   = existing.filter((s) => s.id !== targetId);
      const othersTotal = others.reduce((sum, s) => sum + s.weight, 0);
      const remaining   = 100 - clamped;

      let newSlots: BlendSlot[];
      if (othersTotal === 0) {
        // All other slots are 0 — distribute evenly
        const perOther = others.length > 0 ? Math.round(remaining / others.length) : 0;
        newSlots = ids.map((id) => ({
          id,
          weight: id === targetId ? clamped : perOther,
        }));
      } else {
        newSlots = ids.map((id) => {
          if (id === targetId) return { id, weight: clamped };
          const slot = existing.find((s) => s.id === id);
          const oldW = slot?.weight ?? 0;
          const scaled = Math.round((oldW / othersTotal) * remaining);
          return { id, weight: scaled };
        });
      }

      // Normalize to ensure exactly 100
      const finalBlend = normalizeBlend(newSlots);

      // Update primary id to the highest-weight slot
      const dominant = [...finalBlend].sort((a, b) => b.weight - a.weight)[0];

      return { ...prev, blend: finalBlend, id: dominant.id, useBlend: true };
    });
  }, []);

  const applyPreset = useCallback((preset: BlendPreset) => {
    setPersonalityState((prev) => {
      const ids: ApexPersonalityId[] = ['strategist', 'friend', 'mentor', 'debater', 'innovator'];
      // Merge preset blend into full 5-slot array
      const newBlend: BlendSlot[] = ids.map((id) => {
        const slot = preset.blend.find((s) => s.id === id);
        return { id, weight: slot?.weight ?? 0 };
      });
      const normalized = normalizeBlend(newBlend);
      const dominant = [...normalized].sort((a, b) => b.weight - a.weight)[0];
      return { ...prev, blend: normalized, id: dominant.id, useBlend: true };
    });
  }, []);

  return (
    <PersonalityContext.Provider value={{
      personality, setPersonality, systemPrompt,
      dmPersonalityMode, profile,
      setPersonalityId, setIntensity,
      blend: normalizedBlend,
      setSlotWeight, applyPreset,
      blendDescription,
      presets: BLEND_PRESETS,
      avatarBehavior,
      voiceStyle,
    }}>
      {children}
    </PersonalityContext.Provider>
  );
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function usePersonality(): PersonalityContextValue {
  const ctx = useContext(PersonalityContext);
  if (!ctx) throw new Error("usePersonality must be used inside <PersonalityProvider>");
  return ctx;
}

export function usePersonalityPrompt(): string {
  const ctx = useContext(PersonalityContext);
  if (ctx) return ctx.systemPrompt;
  const s = loadGlobalPersonality();
  return buildGlobalSystemPrompt(s.id, s.intensity, s.traits);
}
