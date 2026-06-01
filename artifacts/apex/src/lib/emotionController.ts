export type Emotion = 'neutral' | 'happy' | 'thinking' | 'excited' | 'concerned' | 'serious' | 'focused';
export type Gesture = 'nod' | 'tilt-right' | 'tilt-left' | 'blink-slow' | 'none';

const KEYWORDS: Partial<Record<Emotion, string[]>> = {
  happy: [
    'great', 'awesome', 'nice', 'good job', 'love it', 'perfect', 'yes',
    'exactly', 'cool', 'got it', 'absolutely', 'for sure', 'bet', 'facts',
    'solid', 'no problem', 'of course', 'definitely', 'you got it',
    'wonderful', 'excellent', 'fantastic', 'congrats', 'well done',
  ],
  excited: [
    "let's go", 'fire', 'incredible', 'amazing', 'no cap', 'real talk',
    'period', 'on god', 'dope', 'crazy', 'wild', 'insane', 'bro', '100%',
    'legendary', 'unstoppable', 'huge', 'massive', 'epic', 'goat',
  ],
  concerned: [
    'sorry', 'tough', 'hard', 'difficult', 'challenge', 'worry', 'careful',
    'important', 'make sure', 'be careful', 'watch out', 'unfortunate',
    'struggle', 'pain', 'hurt', 'issue', 'problem', 'risk', 'danger',
    'mistake', 'error', 'wrong', 'concern',
  ],
  serious: [
    'however', 'therefore', 'consider', 'analyze', 'recommend', 'note that',
    'ensure', 'it is important', 'please be aware', 'in addition', 'furthermore',
    'professional', 'formal', 'structured', 'comprehensive', 'critical',
    'essential', 'must', 'require', 'strategy', 'approach',
  ],
  thinking: [
    'hmm', 'well', 'actually', 'on one hand', 'it depends', 'complex',
    'various', 'let me', 'let us consider', 'multiple', 'nuanced',
    'interesting', 'perhaps', 'maybe', 'could be', 'worth considering',
    'another way', 'perspective', 'context',
  ],
  focused: [
    'focus', 'focused', 'concentrate', 'lock in', 'analyze', 'analyze',
    'step by step', 'break it down', 'work through', 'let me think',
    'carefully', 'precisely', 'exactly', 'detail', 'specific', 'thorough',
    'deadline', 'task', 'objective', 'goal', 'plan', 'execute', 'deliver',
    'no distractions', 'in the zone', 'deep work', 'grind', 'crunch',
  ],
};

export function detectEmotion(text: string): Emotion {
  const lower = text.toLowerCase();

  const exclamations = (text.match(/!/g) || []).length;
  if (exclamations >= 3) return 'excited';

  const scores: Record<Emotion, number> = {
    neutral: 0,
    happy: 0,
    thinking: 0,
    excited: 0,
    concerned: 0,
    serious: 0,
    focused: 0,
  };

  for (const [emotion, keywords] of Object.entries(KEYWORDS) as [Emotion, string[]][]) {
    for (const kw of keywords) {
      if (lower.includes(kw)) scores[emotion]++;
    }
  }

  const top = (Object.entries(scores) as [Emotion, number][]).sort(
    ([, a], [, b]) => b - a
  )[0];

  return top[1] > 0 ? top[0] : 'neutral';
}

// ── Voice modifier per emotion ────────────────────────────────────────────────

export interface EmotionVoiceModifier {
  pitchDelta: number;
  speedDelta: number;
  pauseMs: number;
}

export function getEmotionVoiceModifier(emotion: Emotion): EmotionVoiceModifier {
  switch (emotion) {
    case 'excited':   return { pitchDelta: +0.12, speedDelta: +0.15, pauseMs: 140 };
    case 'happy':     return { pitchDelta: +0.07, speedDelta: +0.05, pauseMs: 200 };
    case 'thinking':  return { pitchDelta: -0.03, speedDelta: -0.08, pauseMs: 360 };
    case 'serious':   return { pitchDelta: -0.08, speedDelta: -0.10, pauseMs: 300 };
    case 'concerned': return { pitchDelta: -0.05, speedDelta: -0.05, pauseMs: 280 };
    case 'focused':   return { pitchDelta:  0.00, speedDelta: -0.05, pauseMs: 260 };
    default:          return { pitchDelta:  0,    speedDelta:  0,    pauseMs: 220 };
  }
}

// ── Gesture per emotion ───────────────────────────────────────────────────────

export function getEmotionGesture(emotion: Emotion): Gesture {
  switch (emotion) {
    case 'happy':     return 'nod';
    case 'excited':   return 'nod';
    case 'thinking':  return 'tilt-right';
    case 'focused':   return 'tilt-right';
    case 'serious':   return 'tilt-left';
    case 'concerned': return 'blink-slow';
    default:          return 'none';
  }
}

// ── Context personality detection ────────────────────────────────────────────

export function detectContextPersonality(
  message: string
): 'hood' | 'professional' | 'bigbro' | null {
  const lower = message.toLowerCase();

  const jobKw = [
    'job', 'career', 'interview', 'resume', 'work', 'business', 'salary',
    'hire', 'professional', 'email', 'meeting', 'boss', 'promotion',
  ];
  const lifeKw = [
    'life', 'relationship', 'advice', 'feeling', 'depressed', 'lonely',
    'goal', 'dream', 'motivat', 'mindset', 'decision', 'scared', 'lost',
    'purpose', 'help me',
  ];
  const casualKw = [
    'bro', 'yo ', 'lowkey', 'ngl', 'fr ', 'fam', 'chill', 'vibe', 'what up',
    'wassup', 'no cap', 'deadass',
  ];

  if (jobKw.some((k) => lower.includes(k))) return 'professional';
  if (lifeKw.some((k) => lower.includes(k))) return 'bigbro';
  if (casualKw.some((k) => lower.includes(k))) return 'hood';
  return null;
}
