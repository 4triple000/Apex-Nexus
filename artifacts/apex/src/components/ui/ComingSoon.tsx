/**
 * ComingSoon — Elite premium overlay for locked features.
 * Apex design language: neon border, live countdown, particles, progress bar.
 * UX goal: "I want this NOW" — not "this is locked".
 * Integrated with real waitlist API (POST /api/waitlist/join).
 */
import { useState, useEffect } from 'react';
import { Bell, ArrowLeft, Rocket, Check, Zap } from 'lucide-react';
import { useLocation } from 'wouter';
import type { FeatureConfig } from '@/lib/featureFlags';
import { PHASE_LABELS, PHASE_COLORS } from '@/lib/featureFlags';
import { useWaitlistStatus } from '@/hooks/useWaitlist';
import { WaitlistModal } from './WaitlistModal';

// ── Easing ───────────────────────────────────────────────────────────────────
const IOS    = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)';
const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

// ── Countdown hook ────────────────────────────────────────────────────────────
function useCountdown(target: Date) {
  const calc = () => {
    const diff = Math.max(0, target.getTime() - Date.now());
    return {
      days:    Math.floor(diff / 86_400_000),
      hours:   Math.floor((diff % 86_400_000) / 3_600_000),
      minutes: Math.floor((diff % 3_600_000)  / 60_000),
      seconds: Math.floor((diff % 60_000)     / 1_000),
    };
  };
  const [time, setTime] = useState(calc);
  useEffect(() => {
    const id = setInterval(() => setTime(calc()), 1000);
    return () => clearInterval(id);
  }, [target]);
  return time;
}

// ── Particle config ───────────────────────────────────────────────────────────
const PARTICLE_DEFS = [
  { size: 3, top: 8,  left: 12, delay: 0,    dur: 4.2, dx: 10,  color: 0 },
  { size: 2, top: 15, left: 78, delay: 0.6,  dur: 3.8, dx: -8,  color: 1 },
  { size: 4, top: 22, left: 45, delay: 1.1,  dur: 5.0, dx: 6,   color: 2 },
  { size: 2, top: 35, left: 92, delay: 0.3,  dur: 3.5, dx: -12, color: 0 },
  { size: 3, top: 48, left: 8,  delay: 1.8,  dur: 4.6, dx: 14,  color: 1 },
  { size: 2, top: 55, left: 60, delay: 0.9,  dur: 3.2, dx: -6,  color: 2 },
  { size: 5, top: 68, left: 30, delay: 2.1,  dur: 5.5, dx: 8,   color: 0 },
  { size: 2, top: 75, left: 85, delay: 0.4,  dur: 4.0, dx: -10, color: 1 },
  { size: 3, top: 82, left: 18, delay: 1.5,  dur: 3.9, dx: 6,   color: 2 },
  { size: 2, top: 90, left: 65, delay: 0.7,  dur: 4.3, dx: -4,  color: 0 },
];

interface ComingSoonProps {
  feature: FeatureConfig;
}

export function ComingSoon({ feature }: ComingSoonProps) {
  const [, nav]         = useLocation();
  const [progVisible, setProgVisible] = useState(false);
  const [modalMode, setModalMode]     = useState<'notify' | 'early_access' | null>(null);
  // Local confirmed states — set immediately on modal success
  const [notified, setNotified]       = useState(false);
  const [earlyAccess, setEarlyAccess] = useState(false);

  const countdown   = useCountdown(feature.launchDate);
  const phaseStyle  = PHASE_COLORS[feature.phase];
  const phaseLabel  = PHASE_LABELS[feature.phase];
  const [c0, c1, c2] = feature.borderColors;

  // Check existing waitlist status (restores state after re-mount)
  const { data: wlStatus } = useWaitlistStatus(feature.id);
  const isNotified    = notified    || (wlStatus?.joined === true && !wlStatus.notifyEarlyAccess);
  const isEarlyAccess = earlyAccess || (wlStatus?.joined === true && wlStatus.notifyEarlyAccess === true);

  // Animate the progress bar fill after mount
  useEffect(() => {
    const id = setTimeout(() => setProgVisible(true), 600);
    return () => clearTimeout(id);
  }, []);

  function handleBack() {
    if (window.history.length > 1) window.history.back();
    else nav('/');
  }

  const particleColors = [feature.accentColor, c1, c2];

  return (
    <>
      <style>{`
        /* ── Overlay entrance ──────────────────────────── */
        @keyframes cs-bg-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        /* ── Neon border gradient animation ────────────── */
        @keyframes cs-border-spin {
          0%   { background-position: 0% 50%;   }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%;   }
        }
        /* ── Card pop-in ───────────────────────────────── */
        @keyframes cs-card-in {
          0%   { opacity: 0; transform: translateY(32px) scale(0.88); }
          65%  { opacity: 1; transform: translateY(-4px) scale(1.02); }
          100% { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        /* ── Glow pulse on the border wrapper ──────────── */
        @keyframes cs-glow-pulse {
          0%, 100% { opacity: 1;    filter: blur(0px);   }
          50%       { opacity: 0.75; filter: blur(1.5px); }
        }
        /* ── Floating icon ─────────────────────────────── */
        @keyframes cs-icon-float {
          0%, 100% { transform: translateY(0px)   rotate(0deg);   }
          33%       { transform: translateY(-6px)  rotate(-2deg);  }
          66%       { transform: translateY(-3px)  rotate(2deg);   }
        }
        /* ── Rotating halo ring ────────────────────────── */
        @keyframes cs-ring-spin {
          from { transform: rotate(0deg);   }
          to   { transform: rotate(360deg); }
        }
        /* ── Background orb drift ──────────────────────── */
        @keyframes cs-orb-drift {
          0%, 100% { transform: translate(0, 0)     scale(1);    }
          33%       { transform: translate(20px, -15px) scale(1.05); }
          66%       { transform: translate(-12px, 10px) scale(0.95); }
        }
        /* ── Particle rise ─────────────────────────────── */
        @keyframes cs-ptcl {
          0%   { opacity: 0;    transform: translateY(0)    translateX(0) scale(0);   }
          15%  { opacity: 0.90; transform: translateY(-10px) translateX(0) scale(1); }
          100% { opacity: 0;    transform: translateY(-80px) translateX(var(--dx))  scale(1.6); }
        }
        /* ── Staggered content fade-up ─────────────────── */
        @keyframes cs-el-in {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        /* ── Progress bar fill ─────────────────────────── */
        @keyframes cs-bar-fill {
          from { width: 0%; }
          to   { width: var(--target-w); }
        }
        /* ── Countdown digit flip ──────────────────────── */
        @keyframes cs-digit-in {
          from { transform: translateY(-6px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>

      {/* ══ FULL-SCREEN OVERLAY ═══════════════════════════════════════════════ */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
        background: 'rgba(4,5,10,0.92)',
        backdropFilter: 'blur(22px) saturate(0.5)',
        WebkitBackdropFilter: 'blur(22px) saturate(0.5)',
        animation: `cs-bg-in 0.20s ${IOS} both`,
        overflow: 'hidden',
      }}>

        {/* ── Ambient background orbs ─────────────────────────────────────── */}
        <div style={{
          position: 'absolute', top: '10%', left: '15%',
          width: 280, height: 280, borderRadius: '50%',
          background: `radial-gradient(circle, ${c0}18 0%, transparent 70%)`,
          animation: `cs-orb-drift 8s ease-in-out infinite`,
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '15%', right: '10%',
          width: 220, height: 220, borderRadius: '50%',
          background: `radial-gradient(circle, ${c1}14 0%, transparent 70%)`,
          animation: `cs-orb-drift 11s 2s ease-in-out infinite reverse`,
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', top: '50%', left: '60%',
          width: 160, height: 160, borderRadius: '50%',
          background: `radial-gradient(circle, ${c2}10 0%, transparent 70%)`,
          animation: `cs-orb-drift 14s 4s ease-in-out infinite`,
          pointerEvents: 'none',
        }} />

        {/* ── Floating particles (scattered across overlay) ────────────────── */}
        {PARTICLE_DEFS.map((p, i) => (
          <div key={i} style={{
            position: 'absolute',
            top: `${p.top}%`, left: `${p.left}%`,
            width: p.size, height: p.size, borderRadius: '50%',
            background: particleColors[p.color % particleColors.length],
            boxShadow: `0 0 ${p.size * 3}px ${particleColors[p.color % particleColors.length]}`,
            // @ts-ignore
            '--dx': `${p.dx}px`,
            animation: `cs-ptcl ${p.dur}s ${p.delay}s ease-out infinite`,
            pointerEvents: 'none',
          } as React.CSSProperties} />
        ))}

        {/* ── Back button ─────────────────────────────────────────────────── */}
        <button
          onClick={handleBack}
          style={{
            position: 'absolute', top: 18, left: 18,
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 99,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.10)',
            color: 'rgba(255,255,255,0.50)',
            fontSize: 11, fontWeight: 700, cursor: 'pointer',
            letterSpacing: '0.02em',
            transition: `all 0.15s ${IOS}`,
            animation: `cs-el-in 0.30s 0.40s ${IOS} both`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.09)';
            e.currentTarget.style.color = 'rgba(255,255,255,0.80)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
            e.currentTarget.style.color = 'rgba(255,255,255,0.50)';
          }}
        >
          <ArrowLeft size={11} />
          Back
        </button>

        {/* ══ NEON BORDER CARD WRAPPER ══════════════════════════════════════ */}
        {/* Animated gradient border via background-size trick */}
        <div style={{
          padding: '1.5px',
          borderRadius: 30,
          background: `linear-gradient(135deg, ${c0}, ${c1}, ${c2}, ${c0})`,
          backgroundSize: '300% 300%',
          animation: `cs-border-spin 4s ease infinite, cs-glow-pulse 3s ease-in-out infinite, cs-card-in 0.50s 0.05s ${SPRING} both`,
          boxShadow: [
            `0 0 24px ${c0}50`,
            `0 0 48px ${c1}30`,
            `0 0 80px ${c2}18`,
            `0 40px 80px rgba(0,0,0,0.70)`,
          ].join(', '),
          width: '100%',
          maxWidth: 360,
          flexShrink: 0,
        }}>
          {/* ── Glass card interior ──────────────────────────────────────── */}
          <div style={{
            borderRadius: 29,
            padding: '28px 24px 24px',
            background: 'rgba(10,11,20,0.97)',
            backdropFilter: 'blur(20px)',
            position: 'relative',
            overflow: 'hidden',
            textAlign: 'center',
          }}>

            {/* Top gradient haze */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 100,
              background: `linear-gradient(180deg, ${feature.accentColor}18 0%, transparent 100%)`,
              pointerEvents: 'none',
            }} />

            {/* ── Phase badge ──────────────────────────────────────────── */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 11px', borderRadius: 99,
              background: phaseStyle.bg,
              border: `1px solid ${phaseStyle.border}`,
              color: phaseStyle.text,
              fontSize: 9, fontWeight: 900, letterSpacing: '0.10em',
              textTransform: 'uppercase',
              marginBottom: 20,
              animation: `cs-el-in 0.30s 0.20s ${IOS} both`,
            }}>
              <Zap size={8} />
              {phaseLabel}
            </div>

            {/* ── Floating icon with rotating halo ────────────────────── */}
            <div style={{
              position: 'relative',
              width: 90, height: 90,
              margin: '0 auto 18px',
              animation: `cs-el-in 0.35s 0.25s ${IOS} both`,
            }}>
              {/* Rotating outer ring */}
              <div style={{
                position: 'absolute', inset: -6,
                borderRadius: '50%',
                border: `1.5px solid transparent`,
                borderTopColor: c0,
                borderRightColor: c1,
                animation: `cs-ring-spin 2.4s linear infinite`,
              }} />
              {/* Counter-rotating inner ring */}
              <div style={{
                position: 'absolute', inset: -2,
                borderRadius: '50%',
                border: `1px dashed ${c2}50`,
                animation: `cs-ring-spin 4s linear infinite reverse`,
              }} />
              {/* Icon orb */}
              <div style={{
                width: 90, height: 90, borderRadius: 26,
                background: `linear-gradient(135deg, ${feature.gradient[0]}, ${feature.gradient[1]})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 36,
                boxShadow: `0 6px 28px ${feature.accentColor}50, 0 0 0 1px ${feature.accentColor}30`,
                animation: `cs-icon-float 4s ease-in-out infinite`,
              }}>
                {feature.icon}
              </div>
            </div>

            {/* ── Hype line ────────────────────────────────────────────── */}
            <div style={{
              fontSize: 11, fontWeight: 800,
              color: feature.accentColor,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginBottom: 6,
              animation: `cs-el-in 0.30s 0.30s ${IOS} both`,
            }}>
              {feature.hype}
            </div>

            {/* ── Title ────────────────────────────────────────────────── */}
            <h2 style={{
              fontSize: 26, fontWeight: 900,
              letterSpacing: '-0.03em', lineHeight: 1.15,
              margin: '0 0 10px',
              background: `linear-gradient(135deg, #fff 30%, ${feature.accentColor} 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              animation: `cs-el-in 0.35s 0.32s ${IOS} both`,
            }}>
              {feature.tagline}
            </h2>

            {/* ── Description ──────────────────────────────────────────── */}
            <p style={{
              fontSize: 12, lineHeight: 1.65,
              color: 'rgba(255,255,255,0.42)',
              margin: '0 0 20px',
              animation: `cs-el-in 0.30s 0.38s ${IOS} both`,
            }}>
              {feature.description}
            </p>

            {/* ── Progress bar ─────────────────────────────────────────── */}
            <div style={{
              marginBottom: 20,
              animation: `cs-el-in 0.30s 0.42s ${IOS} both`,
            }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: 6,
              }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.30)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Readiness
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 900,
                  color: feature.accentColor,
                }}>
                  {feature.readiness}%
                </span>
              </div>
              {/* Track */}
              <div style={{
                height: 4, borderRadius: 99,
                background: 'rgba(255,255,255,0.06)',
                overflow: 'hidden',
              }}>
                {/* Fill */}
                <div style={{
                  height: '100%', borderRadius: 99,
                  background: `linear-gradient(90deg, ${c0}, ${c1}, ${c2})`,
                  backgroundSize: '200% 100%',
                  boxShadow: `0 0 8px ${feature.accentColor}70`,
                  width: progVisible ? `${feature.readiness}%` : '0%',
                  transition: `width 1.2s cubic-bezier(0.34,1.20,0.64,1) 0.60s`,
                }} />
              </div>
            </div>

            {/* ── Countdown timer ───────────────────────────────────────── */}
            <div style={{
              display: 'flex', gap: 8, justifyContent: 'center',
              marginBottom: 22,
              animation: `cs-el-in 0.30s 0.46s ${IOS} both`,
            }}>
              {[
                { label: 'Days',  value: countdown.days    },
                { label: 'Hrs',   value: countdown.hours   },
                { label: 'Mins',  value: countdown.minutes },
                { label: 'Secs',  value: countdown.seconds },
              ].map(({ label, value }) => (
                <div key={label} style={{
                  flex: 1, padding: '8px 4px',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  textAlign: 'center',
                }}>
                  <div
                    key={value}
                    style={{
                      fontSize: 18, fontWeight: 900,
                      color: '#fff',
                      letterSpacing: '-0.02em',
                      lineHeight: 1,
                      marginBottom: 3,
                      animation: `cs-digit-in 0.18s ${IOS}`,
                    }}
                  >
                    {String(value).padStart(2, '0')}
                  </div>
                  <div style={{
                    fontSize: 8, fontWeight: 700,
                    color: 'rgba(255,255,255,0.28)',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>

            {/* ── CTA buttons ───────────────────────────────────────────── */}
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 9,
              animation: `cs-el-in 0.30s 0.50s ${IOS} both`,
            }}>

              {/* Primary: Notify Me */}
              <button
                onClick={() => isNotified ? undefined : setModalMode('notify')}
                style={{
                  width: '100%', padding: '13px',
                  borderRadius: 14, cursor: isNotified ? 'default' : 'pointer',
                  background: isNotified
                    ? 'rgba(74,222,128,0.12)'
                    : `linear-gradient(135deg, ${c0}, ${c1})`,
                  border: isNotified
                    ? '1px solid rgba(74,222,128,0.30)'
                    : '1px solid transparent',
                  color: isNotified ? '#4ADE80' : '#fff',
                  fontSize: 13, fontWeight: 800,
                  letterSpacing: '-0.01em',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: `all 0.35s ${SPRING}`,
                  boxShadow: isNotified
                    ? 'none'
                    : `0 4px 20px ${c0}45, 0 0 0 1px ${c0}30 inset`,
                }}
                onMouseEnter={(e) => {
                  if (!isNotified) {
                    e.currentTarget.style.transform = 'translateY(-2px) scale(1.01)';
                    e.currentTarget.style.boxShadow = `0 8px 28px ${c0}60, 0 0 0 1px ${c0}40 inset`;
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = isNotified ? 'none' : `0 4px 20px ${c0}45, 0 0 0 1px ${c0}30 inset`;
                }}
              >
                {isNotified ? <Check size={15} /> : <Bell size={15} />}
                {isNotified ? "You're on the list!" : 'Notify Me'}
              </button>

              {/* Secondary: Join Early Access */}
              <button
                onClick={() => isEarlyAccess ? undefined : setModalMode('early_access')}
                style={{
                  width: '100%', padding: '12px',
                  borderRadius: 14, cursor: isEarlyAccess ? 'default' : 'pointer',
                  background: isEarlyAccess
                    ? 'rgba(168,139,250,0.12)'
                    : 'rgba(255,255,255,0.04)',
                  border: isEarlyAccess
                    ? '1px solid rgba(168,139,250,0.35)'
                    : `1px solid ${c2}35`,
                  color: isEarlyAccess ? '#A78BFA' : 'rgba(255,255,255,0.60)',
                  fontSize: 12, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  transition: `all 0.30s ${SPRING}`,
                }}
                onMouseEnter={(e) => {
                  if (!isEarlyAccess) {
                    e.currentTarget.style.background = `${c2}15`;
                    e.currentTarget.style.color = '#fff';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isEarlyAccess ? 'rgba(168,139,250,0.12)' : 'rgba(255,255,255,0.04)';
                  e.currentTarget.style.color = isEarlyAccess ? '#A78BFA' : 'rgba(255,255,255,0.60)';
                  e.currentTarget.style.transform = 'none';
                }}
              >
                {isEarlyAccess ? <Check size={13} /> : <Rocket size={13} />}
                {isEarlyAccess ? 'Request submitted!' : 'Join Early Access'}
              </button>

              {/* Tertiary: Back */}
              <button
                onClick={handleBack}
                style={{
                  width: '100%', padding: '10px',
                  borderRadius: 12, cursor: 'pointer',
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255,255,255,0.22)',
                  fontSize: 11, fontWeight: 600,
                  transition: `color 0.15s ${IOS}`,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.22)'; }}
              >
                ← Go Back
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Waitlist modal ──────────────────────────────────────────────────── */}
      {modalMode && (
        <WaitlistModal
          feature={feature}
          mode={modalMode}
          onClose={() => setModalMode(null)}
          onSuccess={(_email, earlyAccessFlag) => {
            if (earlyAccessFlag) setEarlyAccess(true);
            else setNotified(true);
            setModalMode(null);
          }}
        />
      )}
    </>
  );
}
