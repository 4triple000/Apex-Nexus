import { FeatureGate } from '@/components/ui/FeatureGate';
import { FeaturePreview } from '@/components/ui/FeaturePreview';
import { useState } from 'react';
import { Settings2 } from 'lucide-react';
import { useAvatar } from '@/contexts/AvatarContext';
import { AvatarSettings } from '@/components/avatar/AvatarSettings';
import { Avatar3DScene } from '@/components/avatar3d/Avatar3DScene';
import { AvatarState, moodFromState, energyFromState } from '@/hooks/useAvatarStore';
import { cn } from '@/lib/utils';

type StateBtn = { id: AvatarState; label: string; emoji: string };
const STATE_BUTTONS: StateBtn[] = [
  { id: 'idle',    label: 'Idle',   emoji: '😐' },
  { id: 'walking', label: 'Walk',   emoji: '🚶' },
  { id: 'waving',  label: 'Wave',   emoji: '👋' },
  { id: 'dancing', label: 'Dance',  emoji: '🕺' },
];

function resolvePersonalitySlug(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('professional') || n.includes('pro')) return 'professional';
  if (n.includes('bro') || n.includes('big')) return 'bigbro';
  return 'hood';
}

function AvatarPageInner() {
  const store = useAvatar();
  const [showSettings, setShowSettings] = useState(false);
  const [localName, setLocalName] = useState(store.avatarName);

  const pSlug = resolvePersonalitySlug(store.activePersonality.name);
  const mood   = moodFromState(store.avatarState);
  const energy = energyFromState(store.avatarState);

  const handleSave = () => store.setAvatarName(localName);

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-transparent">
      {/* ── Page header ── */}
      <div className="flex-none px-4 pt-5 pb-3 border-b border-border/40">
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-xl font-black tracking-[0.18em] uppercase"
              style={{ color: '#A29BFE', textShadow: '0 0 20px rgba(162,155,254,0.35)' }}
            >
              APEX AVATAR
            </h1>
            <p className="text-[10px] font-mono text-white/35 tracking-widest uppercase mt-0.5">
              GTA-STYLE CHARACTER SYSTEM
            </p>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all active:scale-95"
            style={{
              background: 'rgba(162,155,254,0.08)',
              border: '1px solid rgba(162,155,254,0.25)',
              color: '#A29BFE',
            }}
          >
            <Settings2 className="w-3.5 h-3.5" />
            Customize
          </button>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 flex flex-col items-center px-4 py-4 gap-4 pb-24">

        {/* ── Avatar display box ── */}
        <div className="w-full" style={{ maxWidth: 400 }}>
          <div
            className="relative overflow-hidden"
            style={{
              border: '2px solid #A29BFE',
              borderRadius: 12,
              background: 'linear-gradient(145deg, #111827, #0a0f1a)',
              boxShadow: '0 0 32px rgba(162,155,254,0.12), inset 0 0 24px rgba(0,0,0,0.5)',
              height: 380,
            }}
          >
            {/* Ground glow */}
            <div
              className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[200px] h-[24px] rounded-full blur-2xl pointer-events-none"
              style={{ background: 'radial-gradient(ellipse, rgba(162,155,254,0.2) 0%, transparent 70%)' }}
            />

            {/* Thinking ring */}
            {store.isThinking && (
              <span
                className="absolute inset-0 rounded-xl border-2 animate-ping pointer-events-none z-10"
                style={{ borderColor: 'rgba(162,155,254,0.5)' }}
              />
            )}

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

        {/* ── Control panel ── */}
        <div
          className="w-full rounded-2xl p-4 space-y-4"
          style={{
            background: 'rgba(30,26,62,0.62)',
            border: '1px solid rgba(162,155,254,0.18)',
            maxWidth: 400,
          }}
        >
          {/* Name input */}
          <div>
            <label className="block text-[10px] font-mono text-yellow-400/60 uppercase tracking-widest mb-1.5">
              Avatar Name
            </label>
            <div className="flex gap-2">
              <input
                value={localName}
                onChange={(e) => {
                  setLocalName(e.target.value);
                  store.setAvatarName(e.target.value);
                }}
                placeholder="Enter name…"
                className="flex-1 px-3 py-2.5 rounded-xl text-sm font-mono outline-none"
                style={{
                  background: 'rgba(162,155,254,0.06)',
                  border: '1px solid rgba(162,155,254,0.18)',
                  color: '#f5e070',
                  caretColor: '#A29BFE',
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              />
              <button
                onClick={handleSave}
                className="px-4 py-2.5 rounded-xl text-xs font-black font-mono uppercase tracking-wider transition-all active:scale-95"
                style={{ background: '#A29BFE', color: '#000' }}
              >
                Save
              </button>
            </div>
          </div>

          {/* State buttons */}
          <div>
            <label className="block text-[10px] font-mono text-yellow-400/60 uppercase tracking-widest mb-2">
              State
            </label>
            <div className="grid grid-cols-4 gap-2">
              {STATE_BUTTONS.map((btn) => {
                const active = store.avatarState === btn.id;
                return (
                  <button
                    key={btn.id}
                    onClick={() => store.setAvatarState(btn.id)}
                    className={cn(
                      'py-3 rounded-xl flex flex-col items-center gap-1 transition-all active:scale-95',
                      active ? 'scale-105 shadow-lg' : 'opacity-65 hover:opacity-90'
                    )}
                    style={
                      active
                        ? {
                            background: '#A29BFE',
                            color: '#000',
                            boxShadow: '0 0 16px rgba(162,155,254,0.4)',
                          }
                        : {
                            background: 'rgba(162,155,254,0.07)',
                            border: '1px solid rgba(162,155,254,0.15)',
                            color: '#A29BFE',
                          }
                    }
                  >
                    <span className="text-xl leading-none">{btn.emoji}</span>
                    <span className="text-[9px] font-black uppercase tracking-wider">{btn.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stats */}
          <div
            className="grid grid-cols-2 gap-3 p-3 rounded-xl"
            style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.04)' }}
          >
            {[
              { label: 'Name',   value: localName || 'Apex Player' },
              { label: 'State',  value: store.avatarState.charAt(0).toUpperCase() + store.avatarState.slice(1) },
              { label: 'Mood',   value: mood },
              { label: 'Energy', value: `${energy}%` },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col gap-0.5">
                <span className="text-[9px] font-mono text-white/35 uppercase tracking-widest">{label}</span>
                <span className="text-sm font-black font-mono" style={{ color: '#A29BFE' }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Personality badge ── */}
        <div
          className="px-4 py-2 rounded-full text-[11px] font-mono tracking-widest uppercase"
          style={{
            background: 'rgba(0,0,0,0.4)',
            border: '1px solid rgba(162,155,254,0.2)',
            color: 'rgba(162,155,254,0.7)',
          }}
        >
          {store.activePersonality.emoji} {store.activePersonality.name.split('/')[0].trim()}
        </div>
      </div>

      {/* ── Avatar Settings sheet ── */}
      {showSettings && (
        <AvatarSettings store={store} onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}

export default function AvatarPage() {
  return (
    <FeaturePreview feature="avatarVoice">
      <AvatarPageInner />
    </FeaturePreview>
  );
}
