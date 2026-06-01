/**
 * CharacterContext — Active character state & switching logic.
 * Persists the selected character to localStorage and applies its
 * personality blend to the PersonalityContext on load and on switch.
 */
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import {
  ApexCharacter,
  CHARACTER_ROSTER,
  loadActiveCharacterId,
  saveActiveCharacterId,
  getCharacterById,
} from '@/lib/characterProfiles';
import { usePersonality } from '@/contexts/PersonalityContext';
import type { BlendPreset } from '@/lib/personalityEngine';

interface CharacterContextValue {
  activeCharacter:  ApexCharacter;
  allCharacters:    ApexCharacter[];
  switchCharacter:  (id: string) => void;
  isActive:         (id: string) => boolean;
}

const CharacterContext = createContext<CharacterContextValue>({
  activeCharacter: CHARACTER_ROSTER[0],
  allCharacters:   CHARACTER_ROSTER,
  switchCharacter: () => {},
  isActive:        () => false,
});

export function CharacterProvider({ children }: { children: ReactNode }) {
  const { applyPreset } = usePersonality();
  const [activeId, setActiveId] = useState<string>(() => loadActiveCharacterId());

  // Apply the saved character's blend on first mount
  useEffect(() => {
    const character = getCharacterById(activeId);
    if (character.tier !== 'marketplace') {
      const preset: BlendPreset = {
        id:          character.id,
        name:        character.name,
        emoji:       character.avatar,
        description: character.tagline,
        blend:       character.blend,
      };
      applyPreset(preset);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount only

  const switchCharacter = useCallback((id: string) => {
    const character = getCharacterById(id);
    if (character.tier === 'marketplace') return; // locked
    setActiveId(id);
    saveActiveCharacterId(id);
    const preset: BlendPreset = {
      id:          character.id,
      name:        character.name,
      emoji:       character.avatar,
      description: character.tagline,
      blend:       character.blend,
    };
    applyPreset(preset);
  }, [applyPreset]);

  const isActive = useCallback((id: string) => activeId === id, [activeId]);
  const activeCharacter = getCharacterById(activeId);

  return (
    <CharacterContext.Provider value={{ activeCharacter, allCharacters: CHARACTER_ROSTER, switchCharacter, isActive }}>
      {children}
    </CharacterContext.Provider>
  );
}

export function useCharacterSwitch(): CharacterContextValue {
  return useContext(CharacterContext);
}
