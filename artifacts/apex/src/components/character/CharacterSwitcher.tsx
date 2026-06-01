/**
 * CharacterSwitcher — Full character selection UI.
 * Shows all characters as glass cards with gradient avatars,
 * active glow, trait tags, and premium/marketplace lock states.
 */
import { useState } from 'react';
import { Lock, Download, Star, Sparkles, Check } from 'lucide-react';
import { useCharacterSwitch } from '@/contexts/CharacterContext';
import type { ApexCharacter } from '@/lib/characterProfiles';

const IOS    = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)';
const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

// ── Single character card ─────────────────────────────────────────────────────

function CharacterCard({
  character,
  active,
  onSelect,
  animIdx,
}: {
  character: ApexCharacter;
  active:    boolean;
  onSelect:  () => void;
  animIdx:   number;
}) {
  const [pressed, setPressed] = useState(false);
  const locked = character.tier !== 'free';

  return (
    <button
      onClick={locked ? undefined : onSelect}
      onMouseDown={() => !locked && setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      disabled={locked}
      style={{
        position:   'relative',
        display:    'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap:        10,
        padding:    '18px 12px 14px',
        borderRadius: 22,
        cursor:     locked ? 'default' : 'pointer',
        border:     `1px solid ${active ? character.accentColor + '55' : 'rgba(255,255,255,0.07)'}`,
        background: active
          ? `linear-gradient(160deg, ${character.gradient[0]}18 0%, ${character.gradient[1]}0C 100%)`
          : 'rgba(18,20,30,0.80)',
        boxShadow:  active ? `0 0 24px ${character.glowColor}, inset 0 1px 0 rgba(255,255,255,0.07)` : 'none',
        backdropFilter: 'blur(12px)',
        opacity:    locked ? 0.65 : 1,
        transform:  pressed ? 'scale(0.96)' : 'scale(1)',
        transition: `all 0.22s ${SPRING}`,
        animation:  `cs-card-in 0.30s ${animIdx * 0.06}s ${SPRING} both`,
        textAlign:  'center',
        minHeight:  160,
      }}
    >
      {/* Active check */}
      {active && (
        <div style={{
          position: 'absolute', top: 10, right: 10,
          width: 18, height: 18, borderRadius: '50%',
          background: character.accentColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 8px ${character.glowColor}`,
        }}>
          <Check size={10} color="white" strokeWidth={3} />
        </div>
      )}

      {/* Lock / premium badge */}
      {character.tier === 'premium' && (
        <div style={{
          position: 'absolute', top: 10, left: 10,
          display: 'flex', alignItems: 'center', gap: 3,
          padding: '2px 7px', borderRadius: 99,
          background: 'rgba(245,158,11,0.18)',
          border: '1px solid rgba(245,158,11,0.30)',
          fontSize: 8, fontWeight: 800, color: '#F59E0B',
          letterSpacing: '0.05em',
        }}>
          <Star size={8} fill="#F59E0B" />
          PRO
        </div>
      )}
      {character.tier === 'marketplace' && (
        <div style={{
          position: 'absolute', top: 10, left: 10,
          display: 'flex', alignItems: 'center', gap: 3,
          padding: '2px 7px', borderRadius: 99,
          background: 'rgba(107,114,128,0.18)',
          border: '1px solid rgba(107,114,128,0.25)',
          fontSize: 8, fontWeight: 800, color: '#9CA3AF',
          letterSpacing: '0.05em',
        }}>
          <Download size={8} />
          SOON
        </div>
      )}

      {/* Avatar orb */}
      <div style={{
        width: 56, height: 56, borderRadius: 18,
        background: active
          ? `linear-gradient(135deg, ${character.gradient[0]}, ${character.gradient[1]})`
          : `linear-gradient(135deg, ${character.gradient[0]}55, ${character.gradient[1]}33)`,
        border: `1.5px solid ${active ? character.accentColor + '60' : 'rgba(255,255,255,0.09)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22,
        boxShadow: active ? `0 4px 20px ${character.glowColor}` : 'none',
        transition: `all 0.28s ${IOS}`,
        color: active ? 'white' : character.accentColor,
        fontFamily: 'monospace',
      }}>
        {locked ? <Lock size={20} opacity={0.5} /> : character.avatar}
      </div>

      {/* Name */}
      <div style={{
        fontSize:   13,
        fontWeight: 800,
        color:      active ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.72)',
        letterSpacing: '-0.01em',
        transition: `color 0.20s ${IOS}`,
      }}>
        {character.name}
      </div>

      {/* Tagline */}
      <div style={{
        fontSize:  9,
        color:     active ? character.accentColor : 'rgba(255,255,255,0.30)',
        lineHeight: 1.4,
        maxWidth:   '100%',
        transition: `color 0.20s ${IOS}`,
      }}>
        {character.tagline}
      </div>

      {/* Trait pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
        {character.traits.slice(0, 2).map((trait) => (
          <span key={trait} style={{
            fontSize: 8, fontWeight: 700,
            padding: '2px 7px', borderRadius: 99,
            background: active ? `${character.accentColor}20` : 'rgba(255,255,255,0.05)',
            border: `1px solid ${active ? character.accentColor + '35' : 'rgba(255,255,255,0.08)'}`,
            color: active ? character.accentColor : 'rgba(255,255,255,0.28)',
            letterSpacing: '0.03em',
            transition: `all 0.20s ${IOS}`,
          }}>
            {trait}
          </span>
        ))}
      </div>
    </button>
  );
}

// ── Active character detail banner ────────────────────────────────────────────

function ActiveBanner({ character }: { character: ApexCharacter }) {
  return (
    <div style={{
      padding:    '14px 16px',
      borderRadius: 18,
      background: `linear-gradient(135deg, ${character.gradient[0]}18 0%, ${character.gradient[1]}0D 100%)`,
      border:     `1px solid ${character.accentColor}30`,
      display:    'flex', alignItems: 'center', gap: 14,
      marginBottom: 4,
      animation: `cs-card-in 0.28s ${SPRING} both`,
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 16, flexShrink: 0,
        background: `linear-gradient(135deg, ${character.gradient[0]}, ${character.gradient[1]})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, color: 'white', fontFamily: 'monospace',
        boxShadow: `0 4px 18px ${character.glowColor}`,
      }}>
        {character.avatar}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: character.accentColor }}>
          {character.name} — Active
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.50)', marginTop: 3, lineHeight: 1.5 }}>
          {character.description}
        </div>
        <div style={{ display: 'flex', gap: 5, marginTop: 8 }}>
          {character.traits.map((trait) => (
            <span key={trait} style={{
              fontSize: 8, fontWeight: 700,
              padding: '2px 7px', borderRadius: 99,
              background: `${character.accentColor}18`,
              border: `1px solid ${character.accentColor}30`,
              color: character.accentColor, letterSpacing: '0.04em',
            }}>
              {trait}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function CharacterSwitcher() {
  const { activeCharacter, allCharacters, switchCharacter, isActive } = useCharacterSwitch();

  const free      = allCharacters.filter((c) => c.tier === 'free');
  const premium   = allCharacters.filter((c) => c.tier === 'premium');
  const mkt       = allCharacters.filter((c) => c.tier === 'marketplace');

  return (
    <>
      <style>{`
        @keyframes cs-card-in {
          from { opacity: 0; transform: translateY(10px) scale(0.94); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
      `}</style>

      {/* Currently active */}
      <ActiveBanner character={activeCharacter} />

      {/* Free characters */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 10,
        marginBottom: 14,
      }}>
        {free.map((char, idx) => (
          <CharacterCard
            key={char.id}
            character={char}
            active={isActive(char.id)}
            onSelect={() => switchCharacter(char.id)}
            animIdx={idx + 1}
          />
        ))}
      </div>

      {/* Premium */}
      {premium.length > 0 && (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
          }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(245,158,11,0.15)' }} />
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 9, fontWeight: 800, color: '#F59E0B',
              letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>
              <Star size={10} fill="#F59E0B" />
              Premium
            </div>
            <div style={{ flex: 1, height: 1, background: 'rgba(245,158,11,0.15)' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 14 }}>
            {premium.map((char, idx) => (
              <CharacterCard
                key={char.id}
                character={char}
                active={isActive(char.id)}
                onSelect={() => switchCharacter(char.id)}
                animIdx={idx}
              />
            ))}
          </div>
          <div style={{
            padding: '10px 14px', borderRadius: 12, marginBottom: 14,
            background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.14)',
            fontSize: 10, color: 'rgba(255,255,255,0.38)', lineHeight: 1.55,
          }}>
            <span style={{ color: '#F59E0B', fontWeight: 700 }}>Premium characters</span> unlock with an Apex Pro subscription.
            More characters added every month.
          </div>
        </>
      )}

      {/* Marketplace */}
      {mkt.length > 0 && (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
          }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(99,102,241,0.15)' }} />
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 9, fontWeight: 800, color: '#818CF8',
              letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>
              <Sparkles size={10} />
              Marketplace
            </div>
            <div style={{ flex: 1, height: 1, background: 'rgba(99,102,241,0.15)' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {mkt.map((char, idx) => (
              <CharacterCard
                key={char.id}
                character={char}
                active={false}
                onSelect={() => {}}
                animIdx={idx}
              />
            ))}
          </div>
          <div style={{
            marginTop: 12, padding: '10px 14px', borderRadius: 12,
            background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.14)',
            fontSize: 10, color: 'rgba(255,255,255,0.38)', lineHeight: 1.55,
          }}>
            <span style={{ color: '#818CF8', fontWeight: 700 }}>Community characters</span> are built by creators and downloadable from the Marketplace.
            Coming soon.
          </div>
        </>
      )}
    </>
  );
}
