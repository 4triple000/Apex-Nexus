import { useState, useRef, useEffect } from 'react';
import { Settings2 } from 'lucide-react';
import { AvatarSettings } from './AvatarSettings';
import { LazyAvatar3DScene as Avatar3DScene } from '@/components/avatar3d/LazyAvatar3DScene';
import { AvatarStore, AvatarState, moodFromState, energyFromState } from '@/hooks/useAvatarStore';
import { cn } from '@/lib/utils';

interface AvatarOverlayProps {
  store: AvatarStore;
}

function resolvePersonalitySlug(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('professional') || n.includes('pro')) return 'professional';
  if (n.includes('bro') || n.includes('big')) return 'bigbro';
  return 'hood';
}

// This component is only responsible for the global settings button (when avatar is off)
// and the settings sheet. The full-body avatar display lives inside home.tsx.
export function AvatarOverlay({ store }: AvatarOverlayProps) {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <>
      {!store.avatarVisible && (
        <button
          onClick={() => setShowSettings(true)}
          className="absolute bottom-20 right-3 z-20 w-10 h-10 rounded-full bg-card border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all shadow-lg"
          title="Avatar Settings"
        >
          <Settings2 className="w-4 h-4" />
        </button>
      )}
      {showSettings && (
        <AvatarSettings store={store} onClose={() => setShowSettings(false)} />
      )}
    </>
  );
}

// ── GTA-Style standing avatar for the home screen ─────────────
interface StandingAvatarProps {
  store: AvatarStore;
  hasMessages: boolean;
}

type StateBtn = { id: AvatarState; label: string; emoji: string };
const STATE_BUTTONS: StateBtn[] = [
  { id: 'idle',    label: 'Idle',   emoji: '😐' },
  { id: 'walking', label: 'Walk',   emoji: '🚶' },
  { id: 'waving',  label: 'Wave',   emoji: '👋' },
  { id: 'dancing', label: 'Dance',  emoji: '🕺' },
];

export function StandingAvatar({ store, hasMessages }: StandingAvatarProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [localName, setLocalName] = useState(store.avatarName);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const pSlug = resolvePersonalitySlug(store.activePersonality.name);

  // Keep localName in sync when store changes from outside
  useEffect(() => { setLocalName(store.avatarName); }, [store.avatarName]);

  if (!store.avatarVisible) return null;

  const mood   = moodFromState(store.avatarState);
  const energy = energyFromState(store.avatarState);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalName(e.target.value);
    store.setAvatarName(e.target.value);
  };

  const handleSave = () => {
    store.setAvatarName(localName);
    // Brief visual confirm — shake or just highlight handled via CSS
  };

  return (
    <>
      <div
        className="flex flex-col items-center w-full max-w-sm mx-auto gap-0"
        style={{
          opacity: hasMessages ? 0.1 : 1,
          transition: 'opacity 0.5s ease',
          pointerEvents: hasMessages ? 'none' : 'auto',
        }}
      >
        {/* ── Title ─────────────────────── */}
        <div className="text-center mb-3 select-none">
          <div
            className="text-lg font-black tracking-[0.22em] uppercase"
            style={{ color: '#A29BFE', textShadow: '0 0 18px rgba(162,155,254,0.45)' }}
          >
            APEX AVATAR
          </div>
          <div className="text-[10px] font-mono text-white/40 tracking-widest uppercase mt-0.5">
            GTA-STYLE CHARACTER SYSTEM
          </div>
        </div>

        {/* ── Avatar box with gold border ── */}
        <div className="relative w-full" style={{ maxWidth: 340 }}>
          {/* Customize / Settings gear */}
          <button
            onClick={() => setShowSettings(true)}
            className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all"
            style={{
              background: 'rgba(0,0,0,0.5)',
              border: '1px solid rgba(162,155,254,0.3)',
              color: 'rgba(162,155,254,0.6)',
            }}
            title="Customize Avatar"
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>

          {/* Thinking ring */}
          {store.isThinking && (
            <span
              className="absolute inset-0 rounded-xl border-2 animate-ping pointer-events-none z-10"
              style={{ borderColor: 'rgba(162,155,254,0.5)' }}
            />
          )}

          <div
            className="relative overflow-hidden"
            style={{
              border: '2px solid #A29BFE',
              borderRadius: 10,
              background: 'linear-gradient(145deg, #111827, #0a0f1a)',
              boxShadow: '0 0 28px rgba(162,155,254,0.15), inset 0 0 20px rgba(0,0,0,0.4)',
              height: 320,
            }}
          >
            {/* Ground glow inside box */}
            <div
              className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[180px] h-[20px] rounded-full blur-xl pointer-events-none"
              style={{ background: 'radial-gradient(ellipse, rgba(162,155,254,0.18) 0%, transparent 70%)' }}
            />

            <Avatar3DScene
              appearance={store.appearance}
              emotion={store.emotion}
              isThinking={store.isThinking}
              personality={pSlug}
              avatarState={store.avatarState}
              fullBody
            />
          </div>
        </div>

        {/* ── Control panel ───────────────── */}
        <div
          className="w-full mt-3 rounded-xl p-3 space-y-3"
          style={{
            background: 'rgba(30,26,62,0.62)',
            border: '1px solid rgba(162,155,254,0.22)',
            maxWidth: 340,
          }}
        >
          {/* Name input */}
          <div>
            <label className="block text-[10px] font-mono text-yellow-400/70 uppercase tracking-widest mb-1">
              Avatar Name
            </label>
            <div className="flex gap-2">
              <input
                ref={nameInputRef}
                value={localName}
                onChange={handleNameChange}
                placeholder="Enter name..."
                className="flex-1 px-3 py-2 rounded-lg text-sm font-mono outline-none"
                style={{
                  background: 'rgba(162,155,254,0.06)',
                  border: '1px solid rgba(162,155,254,0.2)',
                  color: '#f5e070',
                  caretColor: '#A29BFE',
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              />
              <button
                onClick={handleSave}
                className="px-3 py-2 rounded-lg text-xs font-bold font-mono uppercase tracking-wider transition-all active:scale-95"
                style={{ background: '#A29BFE', color: '#000' }}
              >
                Save
              </button>
            </div>
          </div>

          {/* State buttons */}
          <div>
            <label className="block text-[10px] font-mono text-yellow-400/70 uppercase tracking-widest mb-1.5">
              State
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {STATE_BUTTONS.map((btn) => {
                const active = store.avatarState === btn.id;
                return (
                  <button
                    key={btn.id}
                    onClick={() => store.setAvatarState(btn.id)}
                    className={cn(
                      'py-2 rounded-lg text-xs font-bold font-mono flex flex-col items-center gap-0.5 transition-all active:scale-95',
                      active ? 'scale-105' : 'opacity-70 hover:opacity-100'
                    )}
                    style={
                      active
                        ? { background: '#A29BFE', color: '#000' }
                        : {
                            background: 'rgba(162,155,254,0.08)',
                            border: '1px solid rgba(162,155,254,0.18)',
                            color: '#A29BFE',
                          }
                    }
                  >
                    <span className="text-base leading-none">{btn.emoji}</span>
                    <span className="text-[9px] uppercase tracking-wider">{btn.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stats */}
          <div
            className="rounded-lg p-2.5 grid grid-cols-2 gap-x-4 gap-y-1"
            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.04)' }}
          >
            {[
              { label: 'Name',   value: localName || 'Apex Player' },
              { label: 'State',  value: store.avatarState.charAt(0).toUpperCase() + store.avatarState.slice(1) },
              { label: 'Mood',   value: mood },
              { label: 'Energy', value: `${energy}%` },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-baseline gap-1.5">
                <span className="text-[10px] font-mono text-white/40 uppercase">{label}:</span>
                <span className="text-[11px] font-mono font-bold" style={{ color: '#A29BFE' }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showSettings && (
        <AvatarSettings store={store} onClose={() => setShowSettings(false)} />
      )}
    </>
  );
}
