/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  APEX CHARACTER PROFILES — Multi-Character Identity System   ║
 * ║  Each character is a named AI identity with a distinct       ║
 * ║  personality blend, visual style, and behavioral profile.    ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
import type { BlendSlot } from './personalityEngine';

// ── Types ─────────────────────────────────────────────────────────────────────

export type CharacterTier = 'free' | 'premium' | 'marketplace';

export interface ApexCharacter {
  id:          string;
  name:        string;
  tagline:     string;
  description: string;
  avatar:      string;           // emoji for avatar fallback
  gradient:    [string, string]; // primary → secondary gradient colors
  accentColor: string;           // single UI accent
  glowColor:   string;           // rgba glow for card
  tier:        CharacterTier;
  blend:       BlendSlot[];      // personality blend — weights must sum to 100
  traits:      string[];         // 3 short trait tags shown on card
  /** Future: marketplace download URL, creator info, etc. */
  marketplace?: {
    creator:   string;
    downloads: number;
    rating:    number;
  };
}

// ── Character Roster ──────────────────────────────────────────────────────────

export const CHARACTER_ROSTER: ApexCharacter[] = [
  {
    id:          'apex',
    name:        'Apex',
    tagline:     'Your all-purpose AI',
    description: 'The original. Perfectly balanced across strategy, warmth, wisdom, and creativity — adapts to anything you throw at it.',
    avatar:      '◆',
    gradient:    ['#6C5CE7', '#A29BFE'],
    accentColor: '#A29BFE',
    glowColor:   'rgba(108,92,231,0.35)',
    tier:        'free',
    traits:      ['Balanced', 'Adaptive', 'Reliable'],
    blend: [
      { id: 'strategist', weight: 25 },
      { id: 'friend',     weight: 25 },
      { id: 'mentor',     weight: 25 },
      { id: 'innovator',  weight: 25 },
    ],
  },
  {
    id:          'nova',
    name:        'Nova',
    tagline:     'Ideas machine, always curious',
    description: 'Bursts with creative energy. Nova sees possibilities others miss, delivers ideas with infectious enthusiasm, and makes every chat feel electric.',
    avatar:      '✦',
    gradient:    ['#EC4899', '#FD79A8'],
    accentColor: '#FD79A8',
    glowColor:   'rgba(236,72,153,0.35)',
    tier:        'free',
    traits:      ['Creative', 'Visionary', 'Energetic'],
    blend: [
      { id: 'innovator',  weight: 60 },
      { id: 'friend',     weight: 25 },
      { id: 'strategist', weight: 15 },
    ],
  },
  {
    id:          'titan',
    name:        'Titan',
    tagline:     'No-nonsense, high-performance',
    description: 'Built for execution. Titan cuts through noise with sharp strategic thinking and fearless debate — your secret weapon for decisions and analysis.',
    avatar:      '⬡',
    gradient:    ['#4F46E5', '#7C3AED'],
    accentColor: '#7C3AED',
    glowColor:   'rgba(79,70,229,0.38)',
    tier:        'free',
    traits:      ['Strategic', 'Direct', 'Analytical'],
    blend: [
      { id: 'strategist', weight: 55 },
      { id: 'debater',    weight: 30 },
      { id: 'innovator',  weight: 15 },
    ],
  },
  {
    id:          'sage',
    name:        'Sage',
    tagline:     'Deep knowledge, thoughtful guidance',
    description: 'Ancient wisdom meets modern clarity. Sage listens deeply, asks the right questions, and guides you to answers you already had inside.',
    avatar:      '◉',
    gradient:    ['#D97706', '#F59E0B'],
    accentColor: '#F59E0B',
    glowColor:   'rgba(217,119,6,0.35)',
    tier:        'free',
    traits:      ['Wise', 'Patient', 'Insightful'],
    blend: [
      { id: 'mentor',     weight: 55 },
      { id: 'strategist', weight: 30 },
      { id: 'friend',     weight: 15 },
    ],
  },
  {
    id:          'echo',
    name:        'Echo',
    tagline:     'Warm, supportive, always there',
    description: 'The companion you wish you had. Echo brings genuine warmth, emotional intelligence, and steady encouragement — feels like talking to your best friend.',
    avatar:      '◎',
    gradient:    ['#059669', '#10B981'],
    accentColor: '#10B981',
    glowColor:   'rgba(5,150,105,0.35)',
    tier:        'free',
    traits:      ['Empathetic', 'Supportive', 'Warm'],
    blend: [
      { id: 'friend',     weight: 65 },
      { id: 'mentor',     weight: 25 },
      { id: 'strategist', weight: 10 },
    ],
  },
  {
    id:          'blaze',
    name:        'Blaze',
    tagline:     'Challenges you to think harder',
    description: 'Fearless and provocative. Blaze pushes back, plays devil\'s advocate, and forces you to defend your ideas — making your thinking bulletproof.',
    avatar:      '◈',
    gradient:    ['#DC2626', '#EF4444'],
    accentColor: '#EF4444',
    glowColor:   'rgba(220,38,38,0.35)',
    tier:        'premium',
    traits:      ['Bold', 'Challenging', 'Unfiltered'],
    blend: [
      { id: 'debater',    weight: 65 },
      { id: 'strategist', weight: 25 },
      { id: 'innovator',  weight: 10 },
    ],
  },
  {
    id:          'cosmos',
    name:        'Cosmos',
    tagline:     'Community creation — coming soon',
    description: 'The first community-designed character. Built by Apex users, for Apex users. Follow the Marketplace to be first in line.',
    avatar:      '✧',
    gradient:    ['#374151', '#4B5563'],
    accentColor: '#6B7280',
    glowColor:   'rgba(107,114,128,0.20)',
    tier:        'marketplace',
    traits:      ['Community', 'Unique', 'Coming Soon'],
    blend: [
      { id: 'innovator',  weight: 40 },
      { id: 'friend',     weight: 40 },
      { id: 'mentor',     weight: 20 },
    ],
    marketplace: {
      creator:   'Apex Community',
      downloads: 0,
      rating:    5.0,
    },
  },
];

export const DEFAULT_CHARACTER_ID = 'apex';
export const CHARACTER_STORAGE_KEY = 'apex_active_character';

// ── Lookup helpers ─────────────────────────────────────────────────────────────

export function getCharacterById(id: string): ApexCharacter {
  return CHARACTER_ROSTER.find((c) => c.id === id) ?? CHARACTER_ROSTER[0];
}

export function loadActiveCharacterId(): string {
  try {
    return localStorage.getItem(CHARACTER_STORAGE_KEY) ?? DEFAULT_CHARACTER_ID;
  } catch {
    return DEFAULT_CHARACTER_ID;
  }
}

export function saveActiveCharacterId(id: string): void {
  try { localStorage.setItem(CHARACTER_STORAGE_KEY, id); } catch {}
}
