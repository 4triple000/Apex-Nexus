import { useState, useCallback } from 'react';
import {
  Personality,
  loadPersonalities,
  savePersonalities,
  loadActivePersonalityId,
  saveActivePersonalityId,
  DEFAULT_PERSONALITIES,
} from '@/lib/personalityEngine';
import { Emotion } from '@/lib/emotionController';
export type AvatarState = 'idle' | 'walking' | 'waving' | 'dancing';

export interface AvatarAppearance {
  skinTone: string;
  hairStyle: string;
  hairColor: string;
  eyeColor: string;
  outfit: string;
  accessories: string[];
  bodyType: string;
}

const DEFAULT_APPEARANCE: AvatarAppearance = {
  skinTone: '#8D5524',
  hairStyle: 'waves',
  hairColor: '#2c1400',
  eyeColor: '#4a2c0a',
  outfit: 'hoodie',
  accessories: [],
  bodyType: 'regular',
};

const APPEARANCE_KEY = 'apex_avatar_appearance';
const VISIBLE_KEY    = 'apex_avatar_visible';
const NAME_KEY       = 'apex_avatar_name';
const STATE_KEY      = 'apex_avatar_state';

function loadAppearance(): AvatarAppearance {
  try {
    const stored = localStorage.getItem(APPEARANCE_KEY);
    return stored ? { ...DEFAULT_APPEARANCE, ...JSON.parse(stored) } : DEFAULT_APPEARANCE;
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

function loadVisible(): boolean {
  try {
    const v = localStorage.getItem(VISIBLE_KEY);
    return v === null ? true : v === 'true';
  } catch {
    return true;
  }
}

function loadAvatarName(): string {
  try { return localStorage.getItem(NAME_KEY) || 'Apex Player'; } catch { return 'Apex Player'; }
}

function loadAvatarStateFromStorage(): AvatarState {
  try {
    const v = localStorage.getItem(STATE_KEY);
    if (v === 'idle' || v === 'walking' || v === 'waving' || v === 'dancing') return v;
  } catch {}
  return 'idle';
}

// Mood/energy derived from avatarState
export function moodFromState(state: AvatarState): string {
  if (state === 'idle')    return 'Neutral';
  if (state === 'walking') return 'Active';
  if (state === 'waving')  return 'Friendly';
  if (state === 'dancing') return 'Happy';
  return 'Neutral';
}

export function energyFromState(state: AvatarState): number {
  if (state === 'idle')    return 100;
  if (state === 'walking') return 75;
  if (state === 'waving')  return 90;
  if (state === 'dancing') return 60;
  return 100;
}

export function useAvatarStore() {
  const [avatarVisible, setAvatarVisibleState] = useState(loadVisible);
  const [appearance, setAppearanceState] = useState<AvatarAppearance>(loadAppearance);
  const [personalities, setPersonalitiesState] = useState<Personality[]>(loadPersonalities);
  const [activePersonalityId, setActiveIdState] = useState<string>(loadActivePersonalityId);
  const [emotion, setEmotion] = useState<Emotion>('neutral');
  const [isThinking, setIsThinking] = useState(false);
  const [avatarName, setAvatarNameState] = useState<string>(loadAvatarName);
  const [avatarState, setAvatarStateState] = useState<AvatarState>(loadAvatarStateFromStorage);

  const activePersonality =
    personalities.find((p) => p.id === activePersonalityId) || DEFAULT_PERSONALITIES[0];

  const setAvatarVisible = useCallback((v: boolean) => {
    setAvatarVisibleState(v);
    try { localStorage.setItem(VISIBLE_KEY, String(v)); } catch {}
  }, []);

  const setAppearance = useCallback((a: Partial<AvatarAppearance>) => {
    setAppearanceState((prev) => {
      const next = { ...prev, ...a };
      try { localStorage.setItem(APPEARANCE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const setPersonalities = useCallback((ps: Personality[]) => {
    setPersonalitiesState(ps);
    savePersonalities(ps);
  }, []);

  const setActivePersonalityId = useCallback((id: string) => {
    setActiveIdState(id);
    saveActivePersonalityId(id);
  }, []);

  const setAvatarName = useCallback((name: string) => {
    setAvatarNameState(name);
    try { localStorage.setItem(NAME_KEY, name); } catch {}
  }, []);

  const setAvatarState = useCallback((state: AvatarState) => {
    setAvatarStateState(state);
    try { localStorage.setItem(STATE_KEY, state); } catch {}
  }, []);

  return {
    avatarVisible,
    setAvatarVisible,
    appearance,
    setAppearance,
    personalities,
    setPersonalities,
    activePersonalityId,
    setActivePersonalityId,
    activePersonality,
    emotion,
    setEmotion,
    isThinking,
    setIsThinking,
    avatarName,
    setAvatarName,
    avatarState,
    setAvatarState,
  };
}

export type AvatarStore = ReturnType<typeof useAvatarStore>;
