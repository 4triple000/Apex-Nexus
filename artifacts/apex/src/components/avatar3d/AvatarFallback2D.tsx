import { useEffect, useRef } from 'react';
import { AvatarAppearance } from '@/hooks/useAvatarStore';
import { Emotion } from '@/lib/emotionController';
import {
  drawAnimeCharacter,
  createAnimState,
  tickAnimState,
  type AnimeAnimState,
  type AvatarState,
} from './AnimeCharacter';

interface Props {
  appearance: AvatarAppearance;
  emotion: Emotion;
  isThinking: boolean;
  personality: string;
  expanded?: boolean;
  fullBody?: boolean;
  avatarState?: AvatarState;
}

function rimRgb(personality: string): { r: number; g: number; b: number } {
  const p = (personality || '').toLowerCase();
  if (p.includes('pro')) return { r: 130, g: 165, b: 255 };
  if (p.includes('big') || p.includes('bro')) return { r: 255, g: 105, b: 65 };
  return { r: 65, g: 110, b: 255 };
}

export function AvatarFallback2D({ appearance, emotion, isThinking, personality, expanded, fullBody, avatarState = 'idle' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const animRef   = useRef<AnimeAnimState>(createAnimState());

  useEffect(() => {
    // Reset anim on mount
    animRef.current = createAnimState();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const rim = rimRgb(personality);

    let lastTs = performance.now();

    function frame(ts: number) {
      if (!ctx || !canvas) return;
      const dt = Math.min((ts - lastTs) / 1000, 0.05);
      lastTs = ts;

      const a = animRef.current;
      tickAnimState(a, dt, emotion, isThinking, personality, avatarState);

      ctx.clearRect(0, 0, W, H);

      // ── Background ──
      const pulse = 0.7 + Math.sin(a.t * 1.6) * 0.3;

      if (fullBody) {
        // Clean studio backdrop
        const bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0,   '#0e0e1c');
        bg.addColorStop(0.6, '#080812');
        bg.addColorStop(1,   '#040408');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        // Side personality glow
        const sideGlow = ctx.createRadialGradient(0, H * 0.45, 0, 0, H * 0.45, W * 0.85);
        sideGlow.addColorStop(0,   `rgba(${rim.r},${rim.g},${rim.b},${0.22 * pulse})`);
        sideGlow.addColorStop(0.4, `rgba(${rim.r},${rim.g},${rim.b},${0.07 * pulse})`);
        sideGlow.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.fillStyle = sideGlow;
        ctx.fillRect(0, 0, W, H);

        // Warm top-right key glow
        const keyGlow = ctx.createRadialGradient(W, H * 0.15, 0, W, H * 0.15, W * 1.1);
        keyGlow.addColorStop(0,   'rgba(255,215,140,0.20)');
        keyGlow.addColorStop(0.5, 'rgba(255,200,100,0.06)');
        keyGlow.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.fillStyle = keyGlow;
        ctx.fillRect(0, 0, W, H);

        // Ground shadow ellipse
        const groundY = H * 0.94;
        const groundGrd = ctx.createRadialGradient(W / 2, groundY, 0, W / 2, groundY, W * 0.42);
        groundGrd.addColorStop(0, 'rgba(0,0,0,0.55)');
        groundGrd.addColorStop(0.5, 'rgba(0,0,0,0.18)');
        groundGrd.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = groundGrd;
        ctx.beginPath();
        ctx.ellipse(W / 2, groundY, W * 0.38, H * 0.035, 0, 0, Math.PI * 2);
        ctx.fill();

      } else {
        const bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0,   '#0a0a18');
        bg.addColorStop(0.5, '#060610');
        bg.addColorStop(1,   '#020208');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        const bloom = ctx.createRadialGradient(0, H * 0.35, 2, 0, H * 0.35, W * 1.1);
        bloom.addColorStop(0,   `rgba(${rim.r},${rim.g},${rim.b},${0.32 * pulse})`);
        bloom.addColorStop(0.3, `rgba(${rim.r},${rim.g},${rim.b},${0.10 * pulse})`);
        bloom.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.fillStyle = bloom;
        ctx.fillRect(0, 0, W, H);

        const keyGlow = ctx.createRadialGradient(W, 0, 2, W, 0, W * 1.3);
        keyGlow.addColorStop(0,   'rgba(255,220,160,0.14)');
        keyGlow.addColorStop(0.5, 'rgba(255,200,120,0.05)');
        keyGlow.addColorStop(1,   'rgba(255,200,120,0)');
        ctx.fillStyle = keyGlow;
        ctx.fillRect(0, 0, W, H);
      }

      // ── Draw anime character ──
      drawAnimeCharacter(ctx, W, H, appearance, a);

      // ── Post-processing ──
      // Vignette
      const vigY = fullBody ? H * 0.5 : H * 0.45;
      const vigR = fullBody ? W * 0.75 : W * 0.7;
      const vig = ctx.createRadialGradient(W / 2, vigY, vigR * 0.2, W / 2, vigY, vigR);
      vig.addColorStop(0,   'rgba(0,0,0,0)');
      vig.addColorStop(0.65,'rgba(0,0,0,0.06)');
      vig.addColorStop(1,   `rgba(0,0,0,${fullBody ? 0.4 : 0.65})`);
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);

      // Left personality strip
      const strip = ctx.createLinearGradient(0, 0, W * 0.08, 0);
      strip.addColorStop(0, `rgba(${rim.r},${rim.g},${rim.b},${0.28 * pulse})`);
      strip.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = strip;
      ctx.fillRect(0, 0, W * 0.08, H);

      // Thinking dots
      if (isThinking) {
        const dotY = H * (fullBody ? 0.965 : 0.94);
        for (let i = 0; i < 3; i++) {
          const dotX = W / 2 + (i - 1) * W * 0.06;
          const dotPulse = (Math.sin(a.t * 6 + i * 1.1) * 0.5 + 0.5);
          ctx.fillStyle = `rgba(${rim.r},${rim.g},${rim.b},${0.4 + dotPulse * 0.5})`;
          ctx.beginPath();
          ctx.arc(dotX, dotY, W * 0.018, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [appearance, emotion, isThinking, personality, expanded, fullBody, avatarState]);

  if (fullBody) {
    return (
      <canvas
        ref={canvasRef}
        width={400}
        height={720}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    );
  }

  const w = expanded ? 152 : 100;
  const h = expanded ? 188 : 124;
  return (
    <canvas
      ref={canvasRef}
      width={w * 2}
      height={h * 2}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
}
