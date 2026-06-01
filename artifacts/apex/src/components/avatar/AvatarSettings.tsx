import { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { AvatarStore } from '@/hooks/useAvatarStore';
import { SKIN_TONES, HAIR_STYLES, HAIR_COLORS, EYE_COLORS, OUTFITS, BODY_TYPES } from './AvatarFace';
import { Personality, buildPersonalityPrompt, DEFAULT_PERSONALITIES } from '@/lib/personalityEngine';
import { Avatar3DScene } from '@/components/avatar3d/Avatar3DScene';
import { cn } from '@/lib/utils';

interface AvatarSettingsProps {
  store: AvatarStore;
  onClose: () => void;
}

type Tab = 'appearance' | 'personality' | 'general';

function resolvePersonalitySlug(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('professional') || n.includes('pro')) return 'professional';
  if (n.includes('bro') || n.includes('big')) return 'bigbro';
  return 'hood';
}

function rimColor(slug: string) {
  if (slug === 'professional') return '#82a5ff';
  if (slug === 'bigbro') return '#ff6941';
  return '#416eff';
}

// ── Mini hair style canvas preview ──────────────────────────────
function HairStyleCard({
  hairStyle, hairColor, label, selected, accent, onClick,
}: {
  hairStyle: string; hairColor: string; label: string;
  selected: boolean; accent: string; onClick: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = selected ? `${accent}15` : 'rgba(255,255,255,0.04)';
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, 12);
    ctx.fill();

    // Face circle
    const cx = W / 2;
    const cy = H * 0.55;
    const fr = W * 0.32;
    ctx.fillStyle = '#8D5524';
    ctx.beginPath();
    ctx.ellipse(cx, cy, fr, fr * 1.1, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hair — simple inline preview
    ctx.fillStyle = hairColor;
    ctx.strokeStyle = hairColor;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    if (hairStyle === 'bald') {
      // No hair
    } else if (hairStyle === 'afro' || hairStyle === 'natural') {
      ctx.beginPath();
      ctx.arc(cx, cy - fr * 0.85, fr * 0.95, Math.PI, 0);
      ctx.fill();
    } else if (hairStyle === 'locs' || hairStyle === 'braids') {
      ctx.beginPath();
      ctx.arc(cx, cy - fr * 0.8, fr * 0.82, Math.PI, 0);
      ctx.fill();
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(cx + i * fr * 0.28, cy + fr * 0.1);
        ctx.lineTo(cx + i * fr * 0.28 + (i % 2 === 0 ? 3 : -3), cy + fr * 0.55);
        ctx.stroke();
      }
    } else if (hairStyle === 'fade') {
      ctx.beginPath();
      ctx.arc(cx, cy - fr * 0.72, fr * 0.68, Math.PI, 0);
      ctx.fill();
    } else {
      // waves / default
      ctx.beginPath();
      ctx.arc(cx, cy - fr * 0.78, fr * 0.76, Math.PI, 0);
      ctx.fill();
    }
  }, [hairStyle, hairColor, selected, accent]);

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 p-1 rounded-xl transition-all"
      style={{
        border: selected ? `1.5px solid ${accent}` : '1.5px solid rgba(255,255,255,0.08)',
        boxShadow: selected ? `0 0 10px ${accent}44` : 'none',
      }}
    >
      <canvas ref={canvasRef} width={68} height={68} style={{ borderRadius: 10, display: 'block' }} />
      <span className="text-[9px] font-mono tracking-wide pb-1"
        style={{ color: selected ? accent : 'rgba(255,255,255,0.45)' }}>
        {label}
      </span>
    </button>
  );
}

// ── Body type silhouette card ────────────────────────────────────
function BodyTypeCard({
  label, value, desc, selected, accent, onClick,
}: {
  label: string; value: string; desc: string;
  selected: boolean; accent: string; onClick: () => void;
}) {
  // SVG silhouette for each body type
  const shoulder = value === 'athletic' ? 38 : value === 'slim' ? 22 : 30;
  const waist    = value === 'athletic' ? 18 : value === 'slim' ? 14 : 20;
  const hip      = value === 'athletic' ? 24 : value === 'slim' ? 18 : 22;

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 py-3 px-2 rounded-xl transition-all"
      style={{
        border: selected ? `1.5px solid ${accent}` : '1.5px solid rgba(255,255,255,0.08)',
        background: selected ? `${accent}15` : 'rgba(255,255,255,0.03)',
        boxShadow: selected ? `0 0 12px ${accent}44` : 'none',
        flex: 1,
      }}
    >
      <svg width="48" height="80" viewBox="0 0 60 100">
        {/* Head */}
        <ellipse cx="30" cy="11" rx="10" ry="11" fill={selected ? accent : 'rgba(255,255,255,0.35)'} />
        {/* Neck */}
        <rect x="27" y="21" width="6" height="7" fill={selected ? accent : 'rgba(255,255,255,0.28)'} />
        {/* Torso */}
        <path
          d={`M ${30 - shoulder} 28 L ${30 + shoulder} 28 L ${30 + waist} 55 L ${30 - waist} 55 Z`}
          fill={selected ? accent : 'rgba(255,255,255,0.28)'}
        />
        {/* Hips */}
        <path
          d={`M ${30 - waist} 55 L ${30 + waist} 55 L ${30 + hip} 65 L ${30 - hip} 65 Z`}
          fill={selected ? `${accent}cc` : 'rgba(255,255,255,0.2)'}
        />
        {/* Legs */}
        <rect x={30 - hip + 1} y="65" width={hip * 0.88} height="30" rx="3" fill={selected ? `${accent}99` : 'rgba(255,255,255,0.18)'} />
        <rect x={30 + 1} y="65" width={hip * 0.88} height="30" rx="3" fill={selected ? `${accent}99` : 'rgba(255,255,255,0.18)'} />
      </svg>
      <div className="text-center">
        <p className="text-[11px] font-semibold" style={{ color: selected ? accent : 'rgba(255,255,255,0.7)' }}>{label}</p>
        <p className="text-[9px] font-mono mt-0.5 leading-tight" style={{ color: 'rgba(255,255,255,0.35)' }}>{desc}</p>
      </div>
    </button>
  );
}

// ── Outfit mini illustration ─────────────────────────────────────
function OutfitCard({
  outfit, label, selected, accent, onClick,
}: {
  outfit: typeof OUTFITS[number]; label: string;
  selected: boolean; accent: string; onClick: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    ctx.fillStyle = selected ? `${accent}15` : 'rgba(255,255,255,0.04)';
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, 12);
    ctx.fill();

    const cx = W / 2;

    // Head
    ctx.fillStyle = '#8D5524';
    ctx.beginPath();
    ctx.ellipse(cx, 18, 11, 13, 0, 0, Math.PI * 2);
    ctx.fill();

    // Torso base
    ctx.fillStyle = outfit.main;
    ctx.beginPath();
    ctx.moveTo(cx - 18, 31);
    ctx.lineTo(cx + 18, 31);
    ctx.lineTo(cx + 13, 65);
    ctx.lineTo(cx - 13, 65);
    ctx.closePath();
    ctx.fill();

    // Outfit detail
    if (outfit.value === 'hoodie') {
      // Pocket
      ctx.fillStyle = `${outfit.main}88`;
      ctx.beginPath();
      ctx.roundRect(cx - 10, 52, 20, 12, 4);
      ctx.fill();
    } else if (outfit.value === 'suit') {
      // Lapels
      ctx.fillStyle = outfit.accent;
      ctx.beginPath();
      ctx.moveTo(cx - 3, 33); ctx.lineTo(cx - 15, 40); ctx.lineTo(cx - 6, 65); ctx.lineTo(cx - 1, 65); ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx + 3, 33); ctx.lineTo(cx + 15, 40); ctx.lineTo(cx + 6, 65); ctx.lineTo(cx + 1, 65); ctx.closePath();
      ctx.fill();
      // Tie
      ctx.fillStyle = '#c8a050';
      ctx.beginPath();
      ctx.moveTo(cx - 3, 35); ctx.lineTo(cx + 3, 35);
      ctx.lineTo(cx + 4, 55); ctx.lineTo(cx, 65); ctx.lineTo(cx - 4, 55); ctx.closePath();
      ctx.fill();
    } else if (outfit.value === 'jersey') {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(cx - 16, 31, 5, 34);
      ctx.fillRect(cx + 11, 31, 5, 34);
    } else if (outfit.value === 'bomber') {
      ctx.fillStyle = outfit.collar;
      ctx.beginPath();
      ctx.moveTo(cx - 17, 31); ctx.lineTo(cx + 17, 31); ctx.lineTo(cx + 12, 40); ctx.lineTo(cx - 12, 40); ctx.closePath();
      ctx.fill();
    } else if (outfit.value === 'athletic') {
      ctx.fillStyle = '#4488ff';
      ctx.fillRect(cx - 18, 31, 5, 34);
      ctx.fillRect(cx + 13, 31, 5, 34);
    } else if (outfit.value === 'tee') {
      // Collar
      ctx.fillStyle = outfit.accent;
      ctx.beginPath();
      ctx.arc(cx, 33, 7, Math.PI, 0);
      ctx.stroke();
    }

    // Collar
    ctx.strokeStyle = outfit.collar || '#fff';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';

    // Pants
    ctx.fillStyle = '#101018';
    ctx.beginPath();
    ctx.moveTo(cx - 13, 65); ctx.lineTo(cx + 13, 65);
    ctx.lineTo(cx + 10, 88); ctx.lineTo(cx + 1, 88);
    ctx.lineTo(cx, 73); ctx.lineTo(cx - 1, 88);
    ctx.lineTo(cx - 10, 88); ctx.closePath();
    ctx.fill();

    // Shoes
    ctx.fillStyle = '#1e1a18';
    ctx.beginPath(); ctx.ellipse(cx - 7, 92, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + 7, 92, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
  }, [outfit, selected, accent]);

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 p-1 rounded-xl transition-all"
      style={{
        border: selected ? `1.5px solid ${accent}` : '1.5px solid rgba(255,255,255,0.08)',
        boxShadow: selected ? `0 0 10px ${accent}44` : 'none',
      }}
    >
      <canvas ref={canvasRef} width={80} height={100} style={{ borderRadius: 10, display: 'block' }} />
      <span className="text-[9px] font-mono tracking-wide pb-1"
        style={{ color: selected ? accent : 'rgba(255,255,255,0.45)' }}>
        {label}
      </span>
    </button>
  );
}

export function AvatarSettings({ store, onClose }: AvatarSettingsProps) {
  const [tab, setTab] = useState<Tab>('appearance');
  const [expandedCustom, setExpandedCustom] = useState(false);
  const [newPersonalityName, setNewPersonalityName] = useState('');
  const [draftWeights, setDraftWeights] = useState({ hood: 33, professional: 33, bigbro: 34 });

  const pSlug = resolvePersonalitySlug(store.activePersonality.name);
  const accent = rimColor(pSlug);

  const handleSaveCustomPersonality = () => {
    const name = newPersonalityName.trim() || 'Custom';
    const id = `custom-${Date.now()}`;
    const newP: Personality = { id, name, emoji: '🎯', weights: draftWeights };
    store.setPersonalities([...store.personalities, newP]);
    store.setActivePersonalityId(id);
    setNewPersonalityName('');
    setExpandedCustom(false);
  };

  const handleDeletePersonality = (id: string) => {
    const filtered = store.personalities.filter((p) => p.id !== id);
    store.setPersonalities(filtered);
    if (store.activePersonalityId === id) store.setActivePersonalityId('hood');
  };

  const isDefault = (id: string) => DEFAULT_PERSONALITIES.some((p) => p.id === id);

  return (
    <div className="absolute inset-0 z-40 flex flex-col pointer-events-none">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm pointer-events-auto"
        onClick={onClose}
      />

      <div className="relative pointer-events-auto flex flex-col h-full mt-[3%] rounded-t-3xl overflow-hidden animate-in slide-in-from-bottom-6 duration-300"
        style={{ background: 'linear-gradient(180deg, #0e0e1c 0%, #08080f 100%)' }}
      >
        {/* ── Avatar preview area ─────────────────────────────── */}
        <div
          className="relative flex-none flex flex-col items-center justify-end pb-3"
          style={{ height: '40%', minHeight: 210 }}
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-4 z-10 w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white/90 hover:bg-white/10 transition-all"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="absolute top-3 left-4">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">AVATAR CREATOR</p>
          </div>

          <div
            className="absolute inset-0"
            style={{ background: `radial-gradient(ellipse at 50% 60%, ${accent}22 0%, transparent 65%)` }}
          />

          <div className="relative z-10" style={{ width: 150, height: 260 }}>
            <div
              className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[100px] h-[10px] rounded-full blur-lg"
              style={{ background: `radial-gradient(ellipse, ${accent}55 0%, transparent 70%)` }}
            />
            <div className="w-full h-full overflow-hidden">
              <Avatar3DScene
                appearance={store.appearance}
                emotion="happy"
                isThinking={false}
                personality={pSlug}
                fullBody
              />
            </div>
          </div>

          <div
            className="mt-2 px-3 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-widest"
            style={{
              background: 'rgba(0,0,0,0.5)',
              border: `1px solid ${accent}44`,
              color: accent,
            }}
          >
            {store.activePersonality.emoji} {store.activePersonality.name}
          </div>
        </div>

        {/* ── Tabs ──────────────────────────────────────────────── */}
        <div className="flex border-b border-white/8 flex-none">
          {(['appearance', 'personality', 'general'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-2.5 text-[11px] font-mono uppercase tracking-widest transition-colors"
              style={{
                color: tab === t ? accent : 'rgba(255,255,255,0.38)',
                borderBottom: tab === t ? `2px solid ${accent}` : '2px solid transparent',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* ── Tab content ───────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* ── APPEARANCE ── */}
          {tab === 'appearance' && (
            <div className="p-4 space-y-6 pb-8">

              {/* Skin Tone */}
              <CreatorSection label="Skin Tone" accent={accent}>
                <div className="flex flex-wrap gap-3">
                  {SKIN_TONES.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => store.setAppearance({ skinTone: s.value })}
                      title={s.label}
                      className="relative w-11 h-11 rounded-full transition-transform"
                      style={{
                        backgroundColor: s.value,
                        boxShadow: store.appearance.skinTone === s.value
                          ? `0 0 0 3px ${accent}, 0 0 12px ${accent}88`
                          : '0 0 0 2px rgba(255,255,255,0.08)',
                        transform: store.appearance.skinTone === s.value ? 'scale(1.1)' : 'scale(1)',
                      }}
                    >
                      {store.appearance.skinTone === s.value && (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <Check className="w-4 h-4 text-white drop-shadow" />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </CreatorSection>

              {/* Body Type */}
              <CreatorSection label="Body Type" accent={accent}>
                <div className="flex gap-3">
                  {BODY_TYPES.map((bt) => (
                    <BodyTypeCard
                      key={bt.value}
                      label={bt.label}
                      value={bt.value}
                      desc={bt.desc}
                      selected={store.appearance.bodyType === bt.value}
                      accent={accent}
                      onClick={() => store.setAppearance({ bodyType: bt.value })}
                    />
                  ))}
                </div>
              </CreatorSection>

              {/* Hair Style */}
              <CreatorSection label="Hair Style" accent={accent}>
                <div className="grid grid-cols-4 gap-2">
                  {HAIR_STYLES.map((h) => (
                    <HairStyleCard
                      key={h.value}
                      hairStyle={h.value}
                      hairColor={store.appearance.hairColor || '#1a0a00'}
                      label={h.label}
                      selected={store.appearance.hairStyle === h.value}
                      accent={accent}
                      onClick={() => store.setAppearance({ hairStyle: h.value })}
                    />
                  ))}
                </div>
              </CreatorSection>

              {/* Hair Color */}
              <CreatorSection label="Hair Color" accent={accent}>
                <div className="flex flex-wrap gap-3">
                  {HAIR_COLORS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => store.setAppearance({ hairColor: c.value })}
                      title={c.label}
                      className="w-11 h-11 rounded-full transition-transform"
                      style={{
                        backgroundColor: c.value,
                        boxShadow: store.appearance.hairColor === c.value
                          ? `0 0 0 3px ${accent}, 0 0 12px ${accent}88`
                          : '0 0 0 2px rgba(255,255,255,0.08)',
                        transform: store.appearance.hairColor === c.value ? 'scale(1.1)' : 'scale(1)',
                      }}
                    />
                  ))}
                </div>
              </CreatorSection>

              {/* Eye Color */}
              <CreatorSection label="Eye Color" accent={accent}>
                <div className="flex flex-wrap gap-3">
                  {EYE_COLORS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => store.setAppearance({ eyeColor: c.value })}
                      title={c.label}
                      className="relative w-11 h-11 rounded-full transition-transform"
                      style={{
                        backgroundColor: c.value,
                        boxShadow: store.appearance.eyeColor === c.value
                          ? `0 0 0 3px ${accent}, 0 0 12px ${accent}88`
                          : '0 0 0 2px rgba(255,255,255,0.08)',
                        transform: store.appearance.eyeColor === c.value ? 'scale(1.1)' : 'scale(1)',
                      }}
                    >
                      {store.appearance.eyeColor === c.value && (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <Check className="w-4 h-4 text-white drop-shadow" />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </CreatorSection>

              {/* Outfit */}
              <CreatorSection label="Outfit" accent={accent}>
                <div className="grid grid-cols-3 gap-2">
                  {OUTFITS.map((o) => (
                    <OutfitCard
                      key={o.value}
                      outfit={o}
                      label={o.label}
                      selected={store.appearance.outfit === o.value}
                      accent={accent}
                      onClick={() => store.setAppearance({ outfit: o.value })}
                    />
                  ))}
                </div>
              </CreatorSection>
            </div>
          )}

          {/* ── PERSONALITY ── */}
          {tab === 'personality' && (
            <div className="p-4 space-y-4 pb-8">
              <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Select Mode
              </p>
              <div className="space-y-2">
                {store.personalities.map((p) => {
                  const pAccent = rimColor(resolvePersonalitySlug(p.name));
                  const active = store.activePersonalityId === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => store.setActivePersonalityId(p.id)}
                      className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all text-left"
                      style={
                        active
                          ? { background: `${pAccent}18`, border: `1px solid ${pAccent}55` }
                          : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }
                      }
                    >
                      <span className="text-2xl shrink-0">{p.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white/90">{p.name}</p>
                        <p className="text-[10px] font-mono mt-0.5 text-white/35 truncate">
                          Hood {p.weights.hood}% · Pro {p.weights.professional}% · Coach {p.weights.bigbro}%
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {active && <Check className="w-4 h-4" style={{ color: pAccent }} />}
                        {!isDefault(p.id) && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeletePersonality(p.id); }}
                            className="text-white/25 hover:text-red-400 p-0.5 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Custom builder */}
              <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                <button
                  onClick={() => setExpandedCustom(!expandedCustom)}
                  className="w-full flex items-center justify-between px-4 py-3.5 text-sm font-semibold text-white/70 hover:text-white/90 hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Plus className="w-4 h-4" style={{ color: accent }} />
                    Build Custom Personality
                  </div>
                  {expandedCustom ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {expandedCustom && (
                  <div className="px-4 pb-4 space-y-4 border-t border-white/8 pt-4">
                    <input
                      type="text"
                      placeholder="Name this personality..."
                      value={newPersonalityName}
                      onChange={(e) => setNewPersonalityName(e.target.value)}
                      className="w-full bg-white/5 border border-white/12 rounded-xl px-3 py-2.5 text-sm text-white/80 outline-none focus:border-white/25 placeholder:text-white/25 transition-colors"
                    />
                    {[
                      { key: 'hood', label: '🔵 Hood / Homie', color: '#416eff' },
                      { key: 'professional', label: '💼 Professional', color: '#82a5ff' },
                      { key: 'bigbro', label: '💪 Big Bro / Coach', color: '#ff6941' },
                    ].map(({ key, label, color }) => (
                      <div key={key}>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-mono" style={{ color }}>{label}</span>
                          <span className="text-xs font-mono font-bold text-white/80">
                            {draftWeights[key as keyof typeof draftWeights]}%
                          </span>
                        </div>
                        <input
                          type="range" min={0} max={100}
                          value={draftWeights[key as keyof typeof draftWeights]}
                          onChange={(e) => setDraftWeights((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                          className="w-full h-1.5"
                          style={{ accentColor: color }}
                        />
                      </div>
                    ))}
                    <div className="flex justify-between text-[10px] font-mono text-white/35">
                      <span>Total</span>
                      <span className={cn(
                        draftWeights.hood + draftWeights.professional + draftWeights.bigbro === 100
                          ? 'text-green-400' : 'text-yellow-400'
                      )}>
                        {draftWeights.hood + draftWeights.professional + draftWeights.bigbro}%
                      </span>
                    </div>
                    <button
                      onClick={handleSaveCustomPersonality}
                      className="w-full py-3 rounded-xl text-sm font-semibold transition-all"
                      style={{ background: accent, color: '#fff' }}
                    >
                      Save & Activate
                    </button>
                  </div>
                )}
              </div>

              {/* Preview */}
              <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-[9px] font-mono uppercase tracking-widest text-white/30 mb-1.5">Active Tone Preview</p>
                <p className="text-[11px] font-mono text-white/50 leading-relaxed">
                  {buildPersonalityPrompt(store.activePersonality).split('\n')[0]}
                </p>
              </div>
            </div>
          )}

          {/* ── GENERAL ── */}
          {tab === 'general' && (
            <div className="p-4 space-y-5 pb-8">
              <div
                className="flex items-center justify-between rounded-2xl px-4 py-4"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <div>
                  <p className="text-sm font-semibold text-white/85">Show Avatar</p>
                  <p className="text-[11px] text-white/40 mt-0.5">Display your character on the home screen</p>
                </div>
                <button
                  onClick={() => store.setAvatarVisible(!store.avatarVisible)}
                  className="relative w-12 h-6 rounded-full transition-all duration-200"
                  style={{ background: store.avatarVisible ? accent : 'rgba(255,255,255,0.12)' }}
                >
                  <span
                    className="absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-200"
                    style={{ left: store.avatarVisible ? '26px' : '4px' }}
                  />
                </button>
              </div>

              <div
                className="rounded-2xl px-4 py-4"
                style={{ background: `${accent}12`, border: `1px solid ${accent}30` }}
              >
                <p className="text-[9px] font-mono uppercase tracking-widest mb-1" style={{ color: `${accent}99` }}>Active Personality</p>
                <p className="text-sm font-semibold text-white/90">
                  {store.activePersonality.emoji} {store.activePersonality.name}
                </p>
                <p className="text-[11px] font-mono mt-1 text-white/40">
                  Hood {store.activePersonality.weights.hood}% · Pro {store.activePersonality.weights.professional}% · Coach {store.activePersonality.weights.bigbro}%
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CreatorSection({ label, accent, children }: { label: string; accent: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-mono uppercase tracking-[0.18em] mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>
        {label}
      </p>
      {children}
    </div>
  );
}
