/**
 * useCharacter — React hook wrapping the Character Engine.
 * Provides reactive character state, memory, and interaction callbacks.
 */
import { useState, useCallback, useRef, useMemo } from 'react';
import { usePrivacy } from '@/contexts/PrivacyContext';
import {
  CharacterState,
  MemoryStore,
  loadCharacterState,
  saveCharacterState,
  loadMemoryStore,
  saveMemoryStore,
  detectUserEmotion,
  moodFromUserEmotion,
  extractMemory,
  buildCharacterContext,
  getProactiveSuggestions,
  getCharacterLevel,
  getLevelProgress,
  LEVEL_LABELS,
  MOOD_LABELS,
  MOOD_EMOJI,
  calculateXpGain,
  addMemoryItem,
  updateMemoryItem,
  deleteMemoryItem,
} from '@/lib/characterEngine';

export interface CharacterAPI {
  // State
  state: CharacterState;
  memory: MemoryStore;

  // Derived
  level: number;
  levelLabel: string;
  levelProgress: number; // 0–1
  moodLabel: string;
  moodEmoji: string;
  proactiveSuggestions: string[];

  // Actions
  onInteraction: (userInput: string, aiResponse: string) => void;
  getContextForPrompt: () => string;
  clearMemory: () => void;
  addMemory: (category: keyof Omit<MemoryStore, 'emotionalPatterns'>, value: string) => void;
  updateMemory: (category: keyof Omit<MemoryStore, 'emotionalPatterns'>, index: number, value: string) => void;
  deleteMemory: (category: keyof Omit<MemoryStore, 'emotionalPatterns'>, index: number) => void;
}

export function useCharacter(): CharacterAPI {
  const { privacyMode } = usePrivacy();
  const [state,  setState]  = useState<CharacterState>(() => loadCharacterState());
  const [memory, setMemory] = useState<MemoryStore>(()  => loadMemoryStore());

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const level         = getCharacterLevel(state.xp);
  const levelLabel    = LEVEL_LABELS[level] ?? 'Regular';
  const levelProgress = getLevelProgress(state.xp);
  const moodLabel     = MOOD_LABELS[state.mood];
  const moodEmoji     = MOOD_EMOJI[state.mood];

  const proactiveSuggestions = useMemo(
    () => getProactiveSuggestions(state, memory),
    [state, memory],
  );

  const onInteraction = useCallback((userInput: string, aiResponse: string) => {
    const userEmotion = detectUserEmotion(userInput);
    const newMood     = moodFromUserEmotion(userEmotion);
    const xpGain      = calculateXpGain(userInput);

    // In privacy mode: skip memory extraction & persistence entirely
    if (!privacyMode) {
      setMemory((prev) => {
        const updated = extractMemory(userInput, aiResponse, prev);
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => saveMemoryStore(updated), 600);
        return updated;
      });
    }

    setState((prev) => {
      const next: CharacterState = {
        ...prev,
        mood: newMood,
        relationshipLevel: Math.min(10, +(prev.relationshipLevel + 0.12).toFixed(2)),
        xp: prev.xp + xpGain,
        lastInteraction: Date.now(),
        totalInteractions: prev.totalInteractions + 1,
      };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      // In privacy mode: still track XP/relationship but don't persist state
      if (!privacyMode) {
        saveTimer.current = setTimeout(() => saveCharacterState(next), 600);
      }
      return next;
    });
  }, [privacyMode]);

  const getContextForPrompt = useCallback(
    () => privacyMode ? '' : buildCharacterContext(state, memory),
    [state, memory, privacyMode],
  );

  const clearMemory = useCallback(() => {
    const blank: MemoryStore = {
      facts: [], preferences: [], goals: [], pastTopics: [], emotionalPatterns: [],
    };
    setMemory(blank);
    saveMemoryStore(blank);
  }, []);

  const addMemory = useCallback((
    category: keyof Omit<MemoryStore, 'emotionalPatterns'>,
    value: string,
  ) => {
    if (privacyMode) return;
    setMemory((prev) => {
      const next = addMemoryItem(prev, category, value);
      saveMemoryStore(next);
      return next;
    });
  }, [privacyMode]);

  const updateMemory = useCallback((
    category: keyof Omit<MemoryStore, 'emotionalPatterns'>,
    index: number,
    value: string,
  ) => {
    if (privacyMode) return;
    setMemory((prev) => {
      const next = updateMemoryItem(prev, category, index, value);
      saveMemoryStore(next);
      return next;
    });
  }, [privacyMode]);

  const deleteMemory = useCallback((
    category: keyof Omit<MemoryStore, 'emotionalPatterns'>,
    index: number,
  ) => {
    setMemory((prev) => {
      const next = deleteMemoryItem(prev, category, index);
      // Allow deletes even in privacy mode — user should be able to purge old data
      saveMemoryStore(next);
      return next;
    });
  }, []);

  return {
    state, memory,
    level, levelLabel, levelProgress,
    moodLabel, moodEmoji,
    proactiveSuggestions,
    onInteraction,
    getContextForPrompt,
    clearMemory,
    addMemory,
    updateMemory,
    deleteMemory,
  };
}
