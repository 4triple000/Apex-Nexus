import { useEffect, useState } from 'react';
import { Emotion } from '@/lib/emotionController';
import { AvatarAppearance } from '@/hooks/useAvatarStore';
import { cn } from '@/lib/utils';

interface AvatarFaceProps {
  appearance: AvatarAppearance;
  emotion: Emotion;
  isThinking: boolean;
  size?: number;
  className?: string;
  animated?: boolean;
}

export const SKIN_TONES = [
  { label: 'Ivory', value: '#FDDBB4' },
  { label: 'Fair', value: '#F1C27D' },
  { label: 'Golden', value: '#C68642' },
  { label: 'Brown', value: '#8D5524' },
  { label: 'Deep', value: '#5C3317' },
  { label: 'Ebony', value: '#2C1503' },
];

export const HAIR_STYLES = [
  { label: 'Waves', value: 'waves' },
  { label: 'Afro', value: 'afro' },
  { label: 'Fade', value: 'fade' },
  { label: 'Locs', value: 'locs' },
  { label: 'Braids', value: 'braids' },
  { label: 'Natural', value: 'natural' },
  { label: 'Bald', value: 'none' },
];

export const HAIR_COLORS = [
  { label: 'Black', value: '#0a0600' },
  { label: 'Dark Brown', value: '#2c1503' },
  { label: 'Brown', value: '#6b3a2a' },
  { label: 'Blonde', value: '#c8a96e' },
  { label: 'Red', value: '#8b2500' },
  { label: 'Auburn', value: '#922b21' },
  { label: 'Silver', value: '#a8a8a8' },
  { label: 'Blue', value: '#1a3a6b' },
];

export const EYE_COLORS = [
  { label: 'Dark Brown', value: '#2c1503' },
  { label: 'Brown', value: '#6b3a0a' },
  { label: 'Hazel', value: '#7b6514' },
  { label: 'Green', value: '#2d6a2d' },
  { label: 'Blue', value: '#1a4a8b' },
  { label: 'Grey', value: '#5a6a7a' },
];

export const OUTFITS = [
  { label: 'Hoodie', value: 'hoodie', main: '#1e1e1e', accent: '#2d2d2d', collar: '#333' },
  { label: 'Suit', value: 'suit', main: '#1a2436', accent: '#253450', collar: '#f0f0f0' },
  { label: 'Tee', value: 'tee', main: '#1e3a5f', accent: '#2555a0', collar: '#1e3a5f' },
  { label: 'Jersey', value: 'jersey', main: '#7b0000', accent: '#b01010', collar: '#7b0000' },
  { label: 'Bomber', value: 'bomber', main: '#1a3014', accent: '#28501e', collar: '#c8a040' },
];

export const BODY_TYPES = [
  { label: 'Regular', value: 'regular', desc: 'Balanced build' },
  { label: 'Athletic', value: 'athletic', desc: 'Broad shoulders, V-taper' },
  { label: 'Slim', value: 'slim', desc: 'Lean, narrow frame' },
];

export const ACCESSORIES_LIST = [
  { label: 'Glasses', value: 'glasses' },
  { label: 'Gold Chain', value: 'chain' },
  { label: 'Snapback', value: 'hat' },
  { label: 'Earrings', value: 'earrings' },
];

function lighten(hex: string, amount: number): string {
  const clean = hex.replace('#', '');
  const num = parseInt(clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean, 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `rgb(${r},${g},${b})`;
}

function getMouthPath(emotion: Emotion): { d: string; open?: boolean } {
  switch (emotion) {
    case 'happy':
      return { d: 'M 68 132 Q 100 158 132 132' };
    case 'excited':
      return { d: 'M 64 130 Q 100 165 136 130', open: true };
    case 'concerned':
      return { d: 'M 72 142 Q 100 128 128 142' };
    case 'serious':
      return { d: 'M 72 135 L 128 135' };
    case 'thinking':
      return { d: 'M 78 136 Q 108 130 126 140' };
    default:
      return { d: 'M 70 135 Q 100 150 130 135' };
  }
}

function getEyebrowPath(emotion: Emotion, side: 'left' | 'right'): string {
  const isLeft = side === 'left';
  switch (emotion) {
    case 'concerned':
      return isLeft
        ? 'M 48 76 Q 67 68 82 73'
        : 'M 118 73 Q 133 68 152 76';
    case 'excited':
      return isLeft
        ? 'M 48 68 Q 65 58 82 63'
        : 'M 118 63 Q 135 58 152 68';
    case 'serious':
      return isLeft
        ? 'M 50 74 Q 65 70 82 72'
        : 'M 118 72 Q 135 70 150 74';
    default:
      return isLeft
        ? 'M 48 76 Q 65 66 82 70'
        : 'M 118 70 Q 135 66 152 76';
  }
}

function renderHair(style: string, color: string): React.ReactNode {
  const darkerColor = lighten(color, -20);
  switch (style) {
    case 'afro':
      return (
        <g>
          <ellipse cx="100" cy="52" rx="96" ry="72" fill={color} />
          <ellipse cx="60" cy="80" rx="30" ry="40" fill={color} />
          <ellipse cx="140" cy="80" rx="30" ry="40" fill={color} />
          <ellipse cx="100" cy="52" rx="90" ry="66" fill={lighten(color, 10)} opacity="0.4" />
        </g>
      );
    case 'waves':
      return (
        <g>
          <path d="M 14 88 Q 28 24 100 12 Q 172 24 186 88 Q 162 60 136 72 Q 110 58 84 72 Q 58 60 32 76 Z" fill={color} />
          <path d="M 32 76 Q 58 62 84 74 Q 110 60 136 74 Q 155 64 172 82" stroke={darkerColor} strokeWidth="2.5" fill="none" opacity="0.5" />
          <path d="M 22 85 Q 48 70 74 82 Q 100 68 126 80 Q 152 68 176 82" stroke={darkerColor} strokeWidth="2" fill="none" opacity="0.4" />
        </g>
      );
    case 'fade':
      return (
        <path
          d="M 18 92 Q 26 22 100 12 Q 174 22 182 92 Q 160 52 130 48 Q 100 44 70 48 Q 40 52 18 92 Z"
          fill={color}
        />
      );
    case 'locs':
      return (
        <g>
          <path d="M 18 80 Q 26 24 100 12 Q 174 24 182 80 Q 162 50 130 46 Q 100 42 70 46 Q 38 50 18 80 Z" fill={color} />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <rect
              key={i}
              x={22 + i * 21}
              y="52"
              width="9"
              height={30 + (i % 3) * 8}
              rx="4.5"
              fill={lighten(color, i % 2 === 0 ? 5 : -5)}
              opacity="0.9"
            />
          ))}
        </g>
      );
    case 'braids':
      return (
        <g>
          <path d="M 18 82 Q 26 24 100 12 Q 174 24 182 82 Q 162 52 132 48 Q 100 44 68 48 Q 38 52 18 82 Z" fill={color} />
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i}>
              <path
                d={`M ${32 + i * 28} 50 Q ${28 + i * 28} 70 ${32 + i * 28} 90 Q ${28 + i * 28} 105 ${32 + i * 28} 118`}
                stroke={darkerColor}
                strokeWidth="6"
                fill="none"
                strokeLinecap="round"
                opacity="0.85"
              />
              <path
                d={`M ${32 + i * 28} 50 Q ${36 + i * 28} 70 ${32 + i * 28} 90 Q ${36 + i * 28} 105 ${32 + i * 28} 118`}
                stroke={lighten(color, 15)}
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                opacity="0.6"
              />
            </g>
          ))}
        </g>
      );
    case 'natural':
      return (
        <path
          d="M 12 90 Q 16 24 55 12 Q 100 4 145 12 Q 184 24 188 90 Q 168 56 136 50 Q 100 44 64 50 Q 32 56 12 90 Z"
          fill={color}
        />
      );
    case 'none':
    default:
      return null;
  }
}

export function AvatarFace({
  appearance,
  emotion,
  isThinking,
  size = 120,
  className,
  animated = true,
}: AvatarFaceProps) {
  const [blink, setBlink] = useState(false);
  const [thinkDot, setThinkDot] = useState(0);
  const uid = `av-${size}`;

  useEffect(() => {
    if (!animated) return;
    let timeoutId: ReturnType<typeof setTimeout>;
    const scheduleNextBlink = () => {
      const delay = 2800 + Math.random() * 2200;
      timeoutId = setTimeout(() => {
        setBlink(true);
        setTimeout(() => {
          setBlink(false);
          scheduleNextBlink();
        }, 130);
      }, delay);
    };
    scheduleNextBlink();
    return () => clearTimeout(timeoutId);
  }, [animated]);

  useEffect(() => {
    if (!isThinking) { setThinkDot(0); return; }
    const id = setInterval(() => setThinkDot((d) => (d + 1) % 4), 380);
    return () => clearInterval(id);
  }, [isThinking]);

  const skin = appearance.skinTone;
  const hair = appearance.hairColor;
  const eye = appearance.eyeColor;

  const outfitDef = OUTFITS.find((o) => o.value === appearance.outfit) || OUTFITS[0];
  const mouth = getMouthPath(emotion);

  return (
    <div
      className={cn(
        'relative select-none',
        animated && 'avatar-breathe',
        className
      )}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 200 220"
        width={size}
        height={size}
        style={{ overflow: 'visible' }}
      >
        <defs>
          <radialGradient id={`sg-${uid}`} cx="38%" cy="32%" r="65%">
            <stop offset="0%" stopColor={lighten(skin, 28)} />
            <stop offset="100%" stopColor={skin} />
          </radialGradient>
          <radialGradient id={`outfitGrad-${uid}`} cx="50%" cy="0%" r="80%">
            <stop offset="0%" stopColor={lighten(outfitDef.accent, 20)} />
            <stop offset="100%" stopColor={outfitDef.main} />
          </radialGradient>
          <filter id={`shadow-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="rgba(0,0,0,0.35)" />
          </filter>
        </defs>

        {/* Outfit / body */}
        <path
          d="M 30 195 Q 30 175 50 172 L 80 170 L 100 178 L 120 170 L 150 172 Q 170 175 170 195 L 170 220 L 30 220 Z"
          fill={`url(#outfitGrad-${uid})`}
        />
        {/* Collar */}
        <path
          d="M 80 170 Q 100 185 120 170"
          stroke={outfitDef.collar}
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
          opacity="0.9"
        />

        {/* Neck */}
        <path
          d="M 82 162 Q 82 178 100 180 Q 118 178 118 162"
          fill={skin}
        />

        {/* Head shadow */}
        <ellipse
          cx="102"
          cy="104"
          rx="89"
          ry="89"
          fill="rgba(0,0,0,0.18)"
          filter={`url(#shadow-${uid})`}
        />

        {/* Ears */}
        <ellipse cx="11" cy="108" rx="13" ry="17" fill={`url(#sg-${uid})`} />
        <ellipse cx="189" cy="108" rx="13" ry="17" fill={`url(#sg-${uid})`} />
        <ellipse cx="11" cy="108" rx="7" ry="10" fill={lighten(skin, -18)} />
        <ellipse cx="189" cy="108" rx="7" ry="10" fill={lighten(skin, -18)} />

        {/* Hair behind head (for styles that wrap) */}
        {(appearance.hairStyle === 'afro' ||
          appearance.hairStyle === 'locs' ||
          appearance.hairStyle === 'braids') &&
          renderHair(appearance.hairStyle, hair)}

        {/* Head */}
        <circle
          cx="100"
          cy="100"
          r="90"
          fill={`url(#sg-${uid})`}
        />

        {/* Hair on top */}
        {appearance.hairStyle !== 'afro' &&
          appearance.hairStyle !== 'locs' &&
          appearance.hairStyle !== 'braids' &&
          renderHair(appearance.hairStyle, hair)}

        {/* Eyebrows */}
        <path
          d={getEyebrowPath(emotion, 'left')}
          stroke={hair}
          strokeWidth="5.5"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d={getEyebrowPath(emotion, 'right')}
          stroke={hair}
          strokeWidth="5.5"
          strokeLinecap="round"
          fill="none"
        />

        {/* Left eye white */}
        <ellipse cx="70" cy="100" rx="19" ry={blink ? 2.5 : 19} fill="white" />
        {!blink && (
          <>
            <circle cx="72" cy="101" r="13" fill={eye} />
            <circle cx="76" cy="98" r="5.5" fill="#0a0a0a" />
            <circle cx="79" cy="95" r="3" fill="white" opacity="0.85" />
            <circle cx="73" cy="104" r="1.5" fill="white" opacity="0.4" />
          </>
        )}

        {/* Right eye white */}
        <ellipse cx="130" cy="100" rx="19" ry={blink ? 2.5 : 19} fill="white" />
        {!blink && (
          <>
            <circle cx="132" cy="101" r="13" fill={eye} />
            <circle cx="136" cy="98" r="5.5" fill="#0a0a0a" />
            <circle cx="139" cy="95" r="3" fill="white" opacity="0.85" />
            <circle cx="133" cy="104" r="1.5" fill="white" opacity="0.4" />
          </>
        )}

        {/* Nose */}
        <ellipse cx="94" cy="122" rx="5" ry="3.5" fill={lighten(skin, -22)} opacity="0.7" />
        <ellipse cx="106" cy="122" rx="5" ry="3.5" fill={lighten(skin, -22)} opacity="0.7" />
        <path
          d="M 94 119 Q 100 128 106 119"
          stroke={lighten(skin, -25)}
          strokeWidth="2.5"
          fill="none"
          opacity="0.5"
        />

        {/* Mouth / thinking dots */}
        {isThinking ? (
          <>
            {[0, 1, 2].map((i) => (
              <circle
                key={i}
                cx={82 + i * 18}
                cy="140"
                r={thinkDot === i + 1 ? 6 : 4}
                fill={lighten(skin, -35)}
                opacity={thinkDot === i + 1 ? 1 : 0.45}
              />
            ))}
          </>
        ) : (
          <>
            {mouth.open && (
              <path
                d={mouth.d.replace('Q', 'Q').replace('130', '136')}
                fill={lighten(skin, -45)}
                opacity="0.7"
              />
            )}
            <path
              d={mouth.d}
              stroke={lighten(skin, -40)}
              strokeWidth="4.5"
              strokeLinecap="round"
              fill="none"
            />
          </>
        )}

        {/* Accessory: Snapback hat */}
        {appearance.accessories.includes('hat') && (
          <g>
            <rect x="18" y="24" width="164" height="52" rx="10" fill={hair} />
            <rect x="6" y="68" width="188" height="17" rx="7" fill={lighten(hair, -12)} />
            <rect x="90" y="24" width="20" height="10" rx="3" fill={lighten(hair, 15)} opacity="0.6" />
          </g>
        )}

        {/* Accessory: Glasses */}
        {appearance.accessories.includes('glasses') && (
          <g>
            <rect x="44" y="87" width="40" height="28" rx="12" stroke="#1a1a1a" strokeWidth="3.5" fill="rgba(120,200,255,0.12)" />
            <rect x="116" y="87" width="40" height="28" rx="12" stroke="#1a1a1a" strokeWidth="3.5" fill="rgba(120,200,255,0.12)" />
            <line x1="84" y1="101" x2="116" y2="101" stroke="#1a1a1a" strokeWidth="3" />
            <line x1="10" y1="101" x2="44" y2="101" stroke="#1a1a1a" strokeWidth="2.5" />
            <line x1="156" y1="101" x2="190" y2="101" stroke="#1a1a1a" strokeWidth="2.5" />
          </g>
        )}

        {/* Accessory: Gold chain */}
        {appearance.accessories.includes('chain') && (
          <g>
            <path
              d="M 55 192 Q 100 208 145 192"
              stroke="#FFD700"
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
              opacity="0.95"
            />
            <circle cx="100" cy="208" r="5" fill="#FFD700" opacity="0.9" />
            <circle cx="100" cy="208" r="3" fill="#FFA500" opacity="0.7" />
          </g>
        )}

        {/* Accessory: Earrings */}
        {appearance.accessories.includes('earrings') && (
          <g>
            <circle cx="3" cy="118" r="6" fill="#FFD700" />
            <circle cx="3" cy="118" r="3.5" fill="#FFA500" opacity="0.7" />
            <circle cx="197" cy="118" r="6" fill="#FFD700" />
            <circle cx="197" cy="118" r="3.5" fill="#FFA500" opacity="0.7" />
          </g>
        )}

        {/* Cheek blush (happy/excited) */}
        {(emotion === 'happy' || emotion === 'excited') && (
          <>
            <ellipse cx="52" cy="120" rx="16" ry="9" fill="#ff8080" opacity="0.22" />
            <ellipse cx="148" cy="120" rx="16" ry="9" fill="#ff8080" opacity="0.22" />
          </>
        )}
      </svg>
    </div>
  );
}
