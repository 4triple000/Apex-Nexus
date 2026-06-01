// ── Anime-style 2D character renderer ─────────────────────────
// Draws a full anime character using Canvas 2D API.
// All coordinates designed for a 400×720 internal canvas.

import type { AvatarAppearance } from '@/hooks/useAvatarStore';
import type { Emotion } from '@/lib/emotionController';

export type AvatarState = 'idle' | 'walking' | 'waving' | 'dancing';

export interface AnimeAnimState {
  t: number;
  // head
  headTiltX: number; headTiltY: number;
  tHeadTiltX: number; tHeadTiltY: number;
  // brows
  browL: number; browR: number;
  // mouth
  mouthOpen: number; mouthSmile: number;
  talkPhase: number;
  // blink
  blinkTimer: number; blinking: boolean; blinkPhase: number; eyeOpen: number;
  // body
  breathPhase: number;
  // character state animation
  avatarState: AvatarState;
  walkPhase: number;
  wavePhase: number;
  dancePhase: number;
}

export function createAnimState(): AnimeAnimState {
  return {
    t: 0,
    headTiltX: 0, headTiltY: 0,
    tHeadTiltX: 0, tHeadTiltY: 0,
    browL: 0, browR: 0,
    mouthOpen: 0, mouthSmile: 0.5,
    talkPhase: 0,
    blinkTimer: 2.5 + Math.random() * 2,
    blinking: false, blinkPhase: 0, eyeOpen: 1,
    breathPhase: 0,
    avatarState: 'idle',
    walkPhase: 0,
    wavePhase: 0,
    dancePhase: 0,
  };
}

export function tickAnimState(
  a: AnimeAnimState,
  dt: number,
  emotion: Emotion,
  isThinking: boolean,
  personality: string,
  avatarState: AvatarState = 'idle',
): void {
  a.avatarState = avatarState;

  // ── State-driven animation phases ──
  if (avatarState === 'walking') {
    a.walkPhase += dt * 6.5;
  } else {
    // Decay walk phase back to neutral
    const decay = Math.sign(a.walkPhase) * Math.min(Math.abs(a.walkPhase), dt * 10);
    a.walkPhase -= decay;
  }

  if (avatarState === 'waving') {
    a.wavePhase += dt * 5.5;
  } else {
    const decay = Math.sign(a.wavePhase) * Math.min(Math.abs(a.wavePhase), dt * 10);
    a.wavePhase -= decay;
  }

  if (avatarState === 'dancing') {
    a.dancePhase += dt * 9;
    a.walkPhase += dt * 11; // fast leg bounce for dancing
  }
  a.t += dt;
  a.breathPhase += dt * 0.9;
  const sp = Math.min(dt * 3.5, 0.22);

  // ── Idle head movement by personality ──
  const p = personality.toLowerCase();
  if (p.includes('pro')) {
    a.tHeadTiltY = Math.sin(a.t * 0.3) * 2;
    a.tHeadTiltX = -2 + Math.sin(a.t * 0.5) * 1;
  } else if (p.includes('bro') || p.includes('big')) {
    a.tHeadTiltY = 4 + Math.sin(a.t * 0.4) * 2.5;
    a.tHeadTiltX = -4 + Math.sin(a.t * 0.55) * 1.5;
  } else {
    a.tHeadTiltY = -3 + Math.sin(a.t * 0.35) * 3;
    a.tHeadTiltX = 2 + Math.sin(a.t * 0.5) * 1.5;
  }
  if (isThinking) { a.tHeadTiltY += -5; a.tHeadTiltX += 6; }

  a.headTiltY += (a.tHeadTiltY - a.headTiltY) * sp;
  a.headTiltX += (a.tHeadTiltX - a.headTiltX) * sp;

  // ── Brows from emotion ──
  let tBL = 0, tBR = 0;
  switch (emotion) {
    case 'happy':    tBL =  0.7; tBR =  0.7; break;
    case 'excited':  tBL =  1.1; tBR =  1.1; break;
    case 'thinking': tBL = -0.5; tBR =  0.6; break;
    case 'concerned':tBL = -1.0; tBR = -1.0; break;
    case 'serious':  tBL = -0.5; tBR = -0.5; break;
  }
  if (isThinking) { tBL -= 0.4; tBR += 0.5; }
  a.browL += (tBL - a.browL) * sp;
  a.browR += (tBR - a.browR) * sp;

  // ── Mouth ──
  const targetSmile = (emotion === 'happy' || emotion === 'excited') ? 0.9
    : emotion === 'concerned' ? -0.4 : emotion === 'serious' ? 0.1 : 0.45;
  a.mouthSmile += (targetSmile - a.mouthSmile) * sp;
  if (isThinking) {
    a.talkPhase += dt * 8;
    const target = (Math.sin(a.talkPhase) * 0.5 + 0.5) * 0.5;
    a.mouthOpen += (target - a.mouthOpen) * sp * 3;
  } else {
    a.mouthOpen += (0 - a.mouthOpen) * sp * 2;
    a.talkPhase = 0;
  }

  // ── Blink ──
  a.blinkTimer -= dt;
  if (a.blinkTimer <= 0 && !a.blinking) {
    a.blinking = true; a.blinkPhase = 0;
    a.blinkTimer = 2.8 + Math.random() * 4;
  }
  if (a.blinking) {
    a.blinkPhase += dt * 9;
    if (a.blinkPhase >= Math.PI) { a.blinking = false; a.blinkPhase = 0; }
  }
  a.eyeOpen = a.blinking ? Math.max(0.02, 1 - Math.sin(a.blinkPhase)) : 1;
}

// ── Color helpers ──────────────────────────────────────────────
function hex(h: string) { return h; }
function darken(h: string, f: number): string {
  const r = parseInt(h.slice(1,3), 16);
  const g = parseInt(h.slice(3,5), 16);
  const b = parseInt(h.slice(5,7), 16);
  return `rgb(${Math.round(r*f)},${Math.round(g*f)},${Math.round(b*f)})`;
}
function lighten(h: string, f: number): string { return darken(h, f); }
function alpha(h: string, a: number): string {
  const r = parseInt(h.slice(1,3), 16);
  const g = parseInt(h.slice(3,5), 16);
  const b = parseInt(h.slice(5,7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

const OUTLINE = '#1a1222';
const OUTLINE_THIN = '#2a1a30';

// ── Outfit data ──────────────────────────────────────────────
const OUTFIT_COLORS: Record<string, { primary: string; secondary: string; collar?: string; accent?: string }> = {
  hoodie:  { primary: '#1e1e30', secondary: '#2a2a44', collar: '#141422', accent: '#5555aa' },
  suit:    { primary: '#1a2436', secondary: '#253450', collar: '#f0f0ee', accent: '#c8a050' },
  tee:     { primary: '#2244aa', secondary: '#3355cc', collar: '#2244aa', accent: '#7799ee' },
  jersey:  { primary: '#8b0000', secondary: '#b01010', collar: '#c8c8c8', accent: '#ffffff' },
  bomber:  { primary: '#1a3014', secondary: '#2a4a20', collar: '#c8a040', accent: '#4a7a30' },
  athletic:{ primary: '#0d1828', secondary: '#1a2a44', collar: '#0d1828', accent: '#4488ff' },
};

// ── Main draw function ─────────────────────────────────────────
export function drawAnimeCharacter(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  appearance: AvatarAppearance,
  anim: AnimeAnimState,
) {
  const cx = W / 2;

  // ── Body type proportions ──
  const bt = appearance.bodyType || 'regular';
  const shoulderMult = bt === 'athletic' ? 1.22 : bt === 'slim' ? 0.82 : 1;
  const waistMult    = bt === 'athletic' ? 0.88 : bt === 'slim' ? 0.80 : 1;
  const hipMult      = bt === 'athletic' ? 1.12 : bt === 'slim' ? 0.88 : 1;
  const legWidthMult = bt === 'athletic' ? 1.1  : bt === 'slim' ? 0.88 : 1;

  // ── Animation offsets ──
  const breathOffset = Math.sin(anim.breathPhase) * 1.8;

  // Scale for canvas size (designed for 400×720)
  const sx = W / 400;
  const sy = H / 720;
  function s(x: number) { return x * sx; }
  function sv(y: number) { return y * sy + breathOffset * sy * 0.4; }

  const skin     = appearance.skinTone  || '#8D5524';
  const skinDark = darken(skin, 0.72);
  const skinMid  = darken(skin, 0.88);
  const hairCol  = appearance.hairColor || '#1a0a00';
  const hairDark = darken(hairCol, 0.6);
  const eyeCol   = appearance.eyeColor  || '#4a2c0a';
  const outfit   = appearance.outfit    || 'hoodie';
  const oc       = OUTFIT_COLORS[outfit] || OUTFIT_COLORS.hoodie;

  // Pants color (always slightly different from top)
  const pantsColor = bt === 'athletic' ? '#0a1222' : outfit === 'suit' ? '#141e2e' : '#101018';

  // ── Coordinate anchors (at 400×720 scale) ──
  const HEAD_CY = 115;
  const HEAD_RX = 68;
  const HEAD_RY = 78;
  const CHIN_Y  = HEAD_CY + HEAD_RY; // ~193
  const NECK_BOT = 228;
  const SHOULDER_Y = NECK_BOT;
  const SHOULDER_W = 170 * shoulderMult;
  const TORSO_BOT = 415;
  const WAIST_W   = 100 * waistMult;
  const HIP_Y     = 445;
  const HIP_W     = 120 * hipMult;
  const LEG_BOT   = 650;
  const SHOE_BOT  = 685;
  const LEG_W     = 52 * legWidthMult;
  const LEG_SEP   = 28 * legWidthMult;
  const ARM_W     = 38 * shoulderMult;

  // ── 1. LEGS / PANTS (3D cel-shaded) ──
  const legShadow = darken(pantsColor, 0.62);
  const legMid    = darken(pantsColor, 0.80);

  function drawLeg(legSide: number) {
    // legSide: -1 = left leg (positioned on left), +1 = right leg
    const lx = cx + legSide * (LEG_SEP + LEG_W * 0.5 - LEG_W * 0.05);

    // Walking/dancing: alternate foot lift using half-rectified sine per leg side
    const legPhaseOffset = legSide < 0 ? 0 : Math.PI;
    const stepAmp = anim.avatarState === 'dancing' ? 60 : anim.avatarState === 'walking' ? 38 : 0;
    const legLift = Math.max(0, -Math.sin(anim.walkPhase + legPhaseOffset)) * stepAmp;

    const lTop = HIP_Y + legLift * 0.15; // slight hip rise with step
    const lBot = LEG_BOT - legLift;

    // Leg path (slightly rounded trapezoid)
    const legPath = () => {
      ctx.beginPath();
      ctx.moveTo(s(lx - LEG_W * 0.55), sv(lTop));
      ctx.lineTo(s(lx + LEG_W * 0.55), sv(lTop));
      ctx.lineTo(s(lx + LEG_W * 0.48), sv(lBot));
      ctx.lineTo(s(lx - LEG_W * 0.48), sv(lBot));
      ctx.closePath();
    };

    // Base
    ctx.fillStyle = pantsColor;
    legPath();
    ctx.fill();

    // Cel-shade clipped
    ctx.save();
    legPath();
    ctx.clip();

    // Right side shadow (inner seam side for left leg, outer for right)
    const shadowSide = legSide; // shadow on inner seam side
    ctx.fillStyle = legShadow;
    ctx.beginPath();
    ctx.ellipse(
      s(lx + shadowSide * LEG_W * 0.32), sv(lTop + (lBot - lTop) * 0.5),
      s(LEG_W * 0.42), s((lBot - lTop) * 0.6),
      0, 0, Math.PI * 2
    );
    ctx.fill();

    // Mid tone
    ctx.fillStyle = legMid;
    ctx.beginPath();
    ctx.ellipse(
      s(lx + shadowSide * LEG_W * 0.12), sv(lTop + (lBot - lTop) * 0.5),
      s(LEG_W * 0.16), s((lBot - lTop) * 0.52),
      0, 0, Math.PI * 2
    );
    ctx.fill();

    // Specular on lit outer edge
    const legSpec = ctx.createLinearGradient(
      s(lx - shadowSide * LEG_W * 0.45), sv(lTop),
      s(lx - shadowSide * LEG_W * 0.1),  sv(lTop + 60)
    );
    legSpec.addColorStop(0, 'rgba(255,255,255,0.10)');
    legSpec.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = legSpec;
    ctx.fillRect(s(lx - LEG_W), sv(lTop), s(LEG_W * 2), s(60));

    ctx.restore();
  }

  drawLeg(-1);
  drawLeg(1);

  // ── 2. SHOES ──
  const shoeCol  = outfit === 'athletic' ? '#e8e8ec' : '#1e1a18';
  const shoeAcc  = outfit === 'athletic' ? '#e02020' : '#2e2a28';
  const shoeSole = darken(shoeCol, 0.5);

  for (const side of [-1, 1]) {
    const sx2 = cx + side * (LEG_SEP + LEG_W * 0.5 - LEG_W * 0.1);
    const shoeW = LEG_W * 1.05;
    // Shoe body
    ctx.fillStyle = shoeCol;
    ctx.beginPath();
    ctx.moveTo(s(sx2 - shoeW * 0.8), sv(LEG_BOT - 2));
    ctx.lineTo(s(sx2 + shoeW * (side > 0 ? 0.8 : 0.5)), sv(LEG_BOT - 2));
    ctx.bezierCurveTo(
      s(sx2 + shoeW * (side > 0 ? 1.2 : 0.7)), sv(LEG_BOT + 5),
      s(sx2 + shoeW * (side > 0 ? 1.1 : 0.6)), sv(SHOE_BOT - 4),
      s(sx2 + shoeW * (side > 0 ? 0.9 : 0.4)), sv(SHOE_BOT)
    );
    ctx.lineTo(s(sx2 - shoeW * 0.8), sv(SHOE_BOT));
    ctx.closePath();
    ctx.fill();
    // Sole stripe
    ctx.fillStyle = shoeSole;
    ctx.beginPath();
    ctx.moveTo(s(sx2 - shoeW * 0.8), sv(SHOE_BOT - 8));
    ctx.lineTo(s(sx2 + shoeW * (side > 0 ? 0.9 : 0.4)), sv(SHOE_BOT - 8));
    ctx.lineTo(s(sx2 + shoeW * (side > 0 ? 0.9 : 0.4)), sv(SHOE_BOT));
    ctx.lineTo(s(sx2 - shoeW * 0.8), sv(SHOE_BOT));
    ctx.closePath();
    ctx.fill();
    // Shoe lace/accent stripe
    ctx.fillStyle = shoeAcc;
    ctx.beginPath();
    ctx.roundRect(s(sx2 - shoeW * 0.5), sv(LEG_BOT + 2), s(shoeW * 0.6), sv(8) - sv(0), s(2));
    ctx.fill();
  }

  // ── 3. ARMS (behind torso, cel-shaded cylinders) ──
  const armColor = oc.primary;
  const armDark  = darken(oc.primary, 0.65);
  const armMid   = darken(oc.primary, 0.82);

  function drawArm(side: number) {
    const sign = side; // -1 left, +1 right

    // ── Waving: right arm raised and bent ──
    const isWavingArm = sign === 1 && anim.avatarState === 'waving';

    // Walking arm swing (opposite to leg on same side)
    const armPhaseOffset = sign < 0 ? Math.PI : 0;
    const swingAmp = anim.avatarState === 'walking' ? 18 : anim.avatarState === 'dancing' ? 30 : 0;
    const armSwingY = Math.sin(anim.walkPhase + armPhaseOffset) * swingAmp;

    // Dancing: both arms raised
    const danceRaise = anim.avatarState === 'dancing' ? Math.abs(Math.sin(anim.dancePhase * 0.5)) * 80 : 0;

    const sx0 = cx + sign * SHOULDER_W / 2;

    if (isWavingArm) {
      // Right arm raised — elbow up, forearm angled out with wave oscillation
      const waveOsc = Math.sin(anim.wavePhase) * 22; // forearm wiggle
      const armPath = () => {
        ctx.beginPath();
        ctx.moveTo(s(sx0), sv(SHOULDER_Y));
        // Elbow goes up and out
        ctx.bezierCurveTo(
          s(sx0 + 30), sv(SHOULDER_Y - 30),
          s(sx0 + 55), sv(SHOULDER_Y - 80),
          s(sx0 + 40 + waveOsc), sv(SHOULDER_Y - 130)
        );
        ctx.lineTo(s(sx0 + 40 + waveOsc - ARM_W * 0.7), sv(SHOULDER_Y - 130));
        ctx.bezierCurveTo(
          s(sx0 + 20), sv(SHOULDER_Y - 80),
          s(sx0 + sign * (ARM_W * 0.3)), sv(SHOULDER_Y - 30),
          s(sx0 - sign * ARM_W), sv(SHOULDER_Y)
        );
        ctx.closePath();
      };

      ctx.fillStyle = armColor;
      armPath();
      ctx.fill();
      ctx.save();
      armPath();
      ctx.clip();

      ctx.fillStyle = armDark;
      ctx.beginPath();
      ctx.ellipse(s(sx0 + 28), sv(SHOULDER_Y - 80), s(ARM_W * 0.5), s(65), 0.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = armMid;
      ctx.beginPath();
      ctx.ellipse(s(sx0 + 15), sv(SHOULDER_Y - 80), s(ARM_W * 0.18), s(55), 0.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
      return;
    }

    const botX = sx0 + sign * (sign < 0 ? -8 : 8);
    // Apply swing: shift wrist endpoint vertically
    const wristSwingY = armSwingY + danceRaise * 0.6;

    // Define arm path
    const armPath = () => {
      ctx.beginPath();
      ctx.moveTo(s(sx0), sv(SHOULDER_Y));
      ctx.bezierCurveTo(
        s(sx0 + sign * 12), sv(SHOULDER_Y + 40 + armSwingY * 0.3),
        s(sx0 + sign * 18), sv(SHOULDER_Y + 180 - wristSwingY),
        s(botX),            sv(SHOULDER_Y + 230 - wristSwingY)
      );
      ctx.lineTo(s(botX - sign * ARM_W), sv(SHOULDER_Y + 230 - wristSwingY));
      ctx.bezierCurveTo(
        s(sx0 - sign * (ARM_W - 6)), sv(SHOULDER_Y + 180 - wristSwingY),
        s(sx0 - sign * ARM_W),       sv(SHOULDER_Y + 40 + armSwingY * 0.3),
        s(sx0 - sign * ARM_W),       sv(SHOULDER_Y)
      );
      ctx.closePath();
    };

    // Base fill
    ctx.fillStyle = armColor;
    armPath();
    ctx.fill();

    // Cel-shade: clip + shadow on inner (torso-facing) side
    ctx.save();
    armPath();
    ctx.clip();

    // Shadow on the inner edge (gives cylindrical illusion)
    ctx.fillStyle = armDark;
    ctx.beginPath();
    const shadowCX = sx0 + sign * ARM_W * 0.38;
    ctx.ellipse(s(shadowCX), sv(SHOULDER_Y + 115), s(ARM_W * 0.55), s(120), 0, 0, Math.PI * 2);
    ctx.fill();

    // Mid tone band
    ctx.fillStyle = armMid;
    ctx.beginPath();
    ctx.ellipse(s(sx0 + sign * ARM_W * 0.18), sv(SHOULDER_Y + 115), s(ARM_W * 0.22), s(110), 0, 0, Math.PI * 2);
    ctx.fill();

    // Specular highlight on outer edge
    const specGrad = ctx.createLinearGradient(
      s(sx0 + sign * 4), sv(SHOULDER_Y),
      s(sx0 - sign * ARM_W * 0.35), sv(SHOULDER_Y + 60)
    );
    specGrad.addColorStop(0, 'rgba(255,255,255,0.12)');
    specGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = specGrad;
    ctx.fillRect(
      s(Math.min(sx0, sx0 - sign * ARM_W) - 20),
      sv(SHOULDER_Y),
      s(ARM_W + 40),
      s(80)
    );

    ctx.restore();
  }

  drawArm(-1);
  drawArm(1);

  // ── Forearms / wrists (skin color) ──
  // Left arm bottom center: cx - SHOULDER_W/2 - 8 + ARM_W/2
  // Right arm bottom center: cx + SHOULDER_W/2 + 8 - ARM_W/2
  for (const side of [-1, 1]) {
    const ax = cx + side * (SHOULDER_W / 2 + 8 - ARM_W * 0.5);
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.ellipse(s(ax), sv(SHOULDER_Y + 220), s(ARM_W * 0.44), s(26), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skinDark;
    ctx.beginPath();
    ctx.ellipse(s(ax + side * ARM_W * 0.08), sv(SHOULDER_Y + 222), s(ARM_W * 0.18), s(22), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = alpha(OUTLINE, 0.5);
    ctx.lineWidth = s(1.2);
    ctx.beginPath();
    ctx.ellipse(s(ax), sv(SHOULDER_Y + 220), s(ARM_W * 0.44), s(26), 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // ── 4. TORSO ──
  ctx.fillStyle = oc.primary;
  ctx.beginPath();
  ctx.moveTo(s(cx - SHOULDER_W / 2), sv(SHOULDER_Y));
  ctx.bezierCurveTo(
    s(cx - SHOULDER_W / 2 - 8), sv(SHOULDER_Y + 40),
    s(cx - WAIST_W / 2 - 4),    sv(TORSO_BOT - 40),
    s(cx - WAIST_W / 2),         sv(TORSO_BOT)
  );
  ctx.lineTo(s(cx + WAIST_W / 2), sv(TORSO_BOT));
  ctx.bezierCurveTo(
    s(cx + WAIST_W / 2 + 4),    sv(TORSO_BOT - 40),
    s(cx + SHOULDER_W / 2 + 8), sv(SHOULDER_Y + 40),
    s(cx + SHOULDER_W / 2),     sv(SHOULDER_Y)
  );
  ctx.closePath();
  ctx.fill();

  // ── Torso 3D cel-shade (clipped) ──
  ctx.save();
  // Clip to torso shape
  ctx.beginPath();
  ctx.moveTo(s(cx - SHOULDER_W / 2), sv(SHOULDER_Y));
  ctx.bezierCurveTo(s(cx - SHOULDER_W / 2 - 8), sv(SHOULDER_Y + 40), s(cx - WAIST_W / 2 - 4), sv(TORSO_BOT - 40), s(cx - WAIST_W / 2), sv(TORSO_BOT));
  ctx.lineTo(s(cx + WAIST_W / 2), sv(TORSO_BOT));
  ctx.bezierCurveTo(s(cx + WAIST_W / 2 + 4), sv(TORSO_BOT - 40), s(cx + SHOULDER_W / 2 + 8), sv(SHOULDER_Y + 40), s(cx + SHOULDER_W / 2), sv(SHOULDER_Y));
  ctx.closePath();
  ctx.clip();

  // Hard right-side shadow band
  ctx.fillStyle = darken(oc.primary, 0.68);
  ctx.beginPath();
  ctx.ellipse(
    s(cx + SHOULDER_W * 0.52), sv(SHOULDER_Y + (TORSO_BOT - SHOULDER_Y) * 0.5),
    s(SHOULDER_W * 0.65), s((TORSO_BOT - SHOULDER_Y) * 0.7),
    0, 0, Math.PI * 2
  );
  ctx.fill();

  // Left highlight band (lit side)
  ctx.fillStyle = alpha(oc.accent || oc.secondary, 0.22);
  ctx.beginPath();
  ctx.ellipse(
    s(cx - SHOULDER_W * 0.26), sv(SHOULDER_Y + (TORSO_BOT - SHOULDER_Y) * 0.38),
    s(SHOULDER_W * 0.22), s((TORSO_BOT - SHOULDER_Y) * 0.55),
    0, 0, Math.PI * 2
  );
  ctx.fill();

  // Top specular glint
  const torsoSpec = ctx.createLinearGradient(s(cx - SHOULDER_W * 0.2), sv(SHOULDER_Y), s(cx + SHOULDER_W * 0.15), sv(SHOULDER_Y + 60));
  torsoSpec.addColorStop(0, 'rgba(255,255,255,0.10)');
  torsoSpec.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = torsoSpec;
  ctx.fillRect(s(cx - SHOULDER_W / 2), sv(SHOULDER_Y), s(SHOULDER_W), s(60));

  ctx.restore();

  // ── Outfit details ──
  if (outfit === 'hoodie') {
    // Kangaroo pocket
    ctx.fillStyle = darken(oc.primary, 0.8);
    ctx.beginPath();
    ctx.roundRect(s(cx - 38), sv(TORSO_BOT - 100), s(76), sv(80) - sv(0), s(12));
    ctx.fill();
    // Hood collar draping behind neck
    ctx.fillStyle = oc.primary;
    ctx.beginPath();
    ctx.moveTo(s(cx - 44), sv(SHOULDER_Y));
    ctx.bezierCurveTo(s(cx - 30), sv(SHOULDER_Y - 30), s(cx + 30), sv(SHOULDER_Y - 30), s(cx + 44), sv(SHOULDER_Y));
    ctx.lineTo(s(cx + 28), sv(SHOULDER_Y + 20));
    ctx.bezierCurveTo(s(cx + 20), sv(SHOULDER_Y), s(cx - 20), sv(SHOULDER_Y), s(cx - 28), sv(SHOULDER_Y + 20));
    ctx.closePath();
    ctx.fill();
  } else if (outfit === 'suit') {
    // Lapels
    ctx.fillStyle = darken(oc.secondary, 0.85);
    // Left lapel
    ctx.beginPath();
    ctx.moveTo(s(cx - 12), sv(SHOULDER_Y + 10));
    ctx.lineTo(s(cx - 42), sv(SHOULDER_Y + 30));
    ctx.lineTo(s(cx - 22), sv(TORSO_BOT - 60));
    ctx.lineTo(s(cx - 5),  sv(TORSO_BOT - 10));
    ctx.closePath();
    ctx.fill();
    // Right lapel
    ctx.beginPath();
    ctx.moveTo(s(cx + 12), sv(SHOULDER_Y + 10));
    ctx.lineTo(s(cx + 42), sv(SHOULDER_Y + 30));
    ctx.lineTo(s(cx + 22), sv(TORSO_BOT - 60));
    ctx.lineTo(s(cx + 5),  sv(TORSO_BOT - 10));
    ctx.closePath();
    ctx.fill();
    // Shirt / tie
    ctx.fillStyle = '#f0f0ee';
    ctx.beginPath();
    ctx.moveTo(s(cx - 12), sv(SHOULDER_Y + 10));
    ctx.lineTo(s(cx + 12), sv(SHOULDER_Y + 10));
    ctx.lineTo(s(cx + 5), sv(TORSO_BOT - 10));
    ctx.lineTo(s(cx - 5), sv(TORSO_BOT - 10));
    ctx.closePath();
    ctx.fill();
    // Tie
    ctx.fillStyle = '#c8a050';
    ctx.beginPath();
    ctx.moveTo(s(cx - 6), sv(SHOULDER_Y + 14));
    ctx.lineTo(s(cx + 6), sv(SHOULDER_Y + 14));
    ctx.lineTo(s(cx + 10), sv(TORSO_BOT - 40));
    ctx.lineTo(s(cx), sv(TORSO_BOT - 20));
    ctx.lineTo(s(cx - 10), sv(TORSO_BOT - 40));
    ctx.closePath();
    ctx.fill();
  } else if (outfit === 'jersey') {
    // Side stripes
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(s(cx - SHOULDER_W * 0.4), sv(SHOULDER_Y));
    ctx.lineTo(s(cx - SHOULDER_W * 0.3), sv(SHOULDER_Y));
    ctx.lineTo(s(cx - WAIST_W * 0.35), sv(TORSO_BOT));
    ctx.lineTo(s(cx - WAIST_W * 0.45), sv(TORSO_BOT));
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(s(cx + SHOULDER_W * 0.4), sv(SHOULDER_Y));
    ctx.lineTo(s(cx + SHOULDER_W * 0.3), sv(SHOULDER_Y));
    ctx.lineTo(s(cx + WAIST_W * 0.35), sv(TORSO_BOT));
    ctx.lineTo(s(cx + WAIST_W * 0.45), sv(TORSO_BOT));
    ctx.closePath();
    ctx.fill();
    // Number "1"
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = `bold ${s(42)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('1', s(cx), sv(TORSO_BOT - 60));
  } else if (outfit === 'bomber') {
    // Collar
    ctx.fillStyle = '#c8a040';
    ctx.beginPath();
    ctx.moveTo(s(cx - 44), sv(SHOULDER_Y));
    ctx.bezierCurveTo(s(cx - 30), sv(SHOULDER_Y - 25), s(cx + 30), sv(SHOULDER_Y - 25), s(cx + 44), sv(SHOULDER_Y));
    ctx.lineTo(s(cx + 30), sv(SHOULDER_Y + 22));
    ctx.bezierCurveTo(s(cx + 16), sv(SHOULDER_Y + 8), s(cx - 16), sv(SHOULDER_Y + 8), s(cx - 30), sv(SHOULDER_Y + 22));
    ctx.closePath();
    ctx.fill();
    // Zip line
    ctx.strokeStyle = darken('#c8a040', 0.7);
    ctx.lineWidth = s(3);
    ctx.beginPath();
    ctx.moveTo(s(cx), sv(SHOULDER_Y + 20));
    ctx.lineTo(s(cx), sv(TORSO_BOT));
    ctx.stroke();
  } else if (outfit === 'athletic') {
    // Side panels
    ctx.fillStyle = '#4488ff';
    ctx.beginPath();
    ctx.moveTo(s(cx - SHOULDER_W * 0.46), sv(SHOULDER_Y));
    ctx.lineTo(s(cx - SHOULDER_W * 0.32), sv(SHOULDER_Y));
    ctx.lineTo(s(cx - WAIST_W * 0.4), sv(TORSO_BOT));
    ctx.lineTo(s(cx - WAIST_W * 0.52), sv(TORSO_BOT));
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(s(cx + SHOULDER_W * 0.46), sv(SHOULDER_Y));
    ctx.lineTo(s(cx + SHOULDER_W * 0.32), sv(SHOULDER_Y));
    ctx.lineTo(s(cx + WAIST_W * 0.4), sv(TORSO_BOT));
    ctx.lineTo(s(cx + WAIST_W * 0.52), sv(TORSO_BOT));
    ctx.closePath();
    ctx.fill();
  }

  // ── 5. HIPS/WAISTBAND ──
  ctx.fillStyle = darken(pantsColor, 1.25);
  ctx.beginPath();
  ctx.moveTo(s(cx - WAIST_W / 2 - 5), sv(TORSO_BOT));
  ctx.lineTo(s(cx + WAIST_W / 2 + 5), sv(TORSO_BOT));
  ctx.lineTo(s(cx + HIP_W / 2), sv(HIP_Y));
  ctx.lineTo(s(cx - HIP_W / 2), sv(HIP_Y));
  ctx.closePath();
  ctx.fill();

  // Belt (for suit/bomber)
  if (outfit === 'suit' || outfit === 'bomber') {
    ctx.fillStyle = '#302010';
    ctx.beginPath();
    ctx.roundRect(s(cx - HIP_W * 0.4), sv(TORSO_BOT - 6), s(HIP_W * 0.8), sv(18) - sv(0), s(4));
    ctx.fill();
    ctx.fillStyle = '#c8a040';
    ctx.beginPath();
    ctx.roundRect(s(cx - 12), sv(TORSO_BOT - 4), s(24), sv(14) - sv(0), s(3));
    ctx.fill();
  }

  // ── 6. NECK ──
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.moveTo(s(cx - 22), sv(CHIN_Y));
  ctx.lineTo(s(cx + 22), sv(CHIN_Y));
  ctx.lineTo(s(cx + 20), sv(NECK_BOT));
  ctx.lineTo(s(cx - 20), sv(NECK_BOT));
  ctx.closePath();
  ctx.fill();
  // neck shadow side
  ctx.fillStyle = skinDark;
  ctx.beginPath();
  ctx.moveTo(s(cx + 8), sv(CHIN_Y));
  ctx.lineTo(s(cx + 22), sv(CHIN_Y));
  ctx.lineTo(s(cx + 20), sv(NECK_BOT));
  ctx.lineTo(s(cx + 8), sv(NECK_BOT));
  ctx.closePath();
  ctx.fill();

  // ── 7. HEAD (base skin) ──
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(s(cx), sv(HEAD_CY), s(HEAD_RX), s(HEAD_RY), 0, 0, Math.PI * 2);
  ctx.fill();

  // ── 3D cel-shade pass (clipped to head) ──
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(s(cx), sv(HEAD_CY), s(HEAD_RX), s(HEAD_RY), 0, 0, Math.PI * 2);
  ctx.clip();

  // Hard right-side shadow (classic anime cel-shading)
  ctx.fillStyle = skinDark;
  ctx.beginPath();
  ctx.ellipse(s(cx + HEAD_RX * 0.62), sv(HEAD_CY + 6), s(HEAD_RX * 0.82), s(HEAD_RY * 0.92), 0, 0, Math.PI * 2);
  ctx.fill();

  // Mid-tone band between light and shadow
  ctx.fillStyle = skinMid;
  ctx.beginPath();
  ctx.ellipse(s(cx + HEAD_RX * 0.28), sv(HEAD_CY + 3), s(HEAD_RX * 0.28), s(HEAD_RY * 0.88), 0, 0, Math.PI * 2);
  ctx.fill();

  // Upper-left highlight bloom
  const fHL = ctx.createRadialGradient(
    s(cx - HEAD_RX * 0.28), sv(HEAD_CY - HEAD_RY * 0.42), 0,
    s(cx - HEAD_RX * 0.28), sv(HEAD_CY - HEAD_RY * 0.42), s(HEAD_RX * 0.68)
  );
  fHL.addColorStop(0, 'rgba(255,255,230,0.16)');
  fHL.addColorStop(1, 'rgba(255,255,230,0)');
  ctx.fillStyle = fHL;
  ctx.fillRect(0, 0, s(cx), sv(HEAD_CY + HEAD_RY));

  // Under-chin ambient occlusion
  const chinAO = ctx.createLinearGradient(
    s(cx - HEAD_RX), sv(HEAD_CY + HEAD_RY * 0.6),
    s(cx + HEAD_RX), sv(HEAD_CY + HEAD_RY)
  );
  chinAO.addColorStop(0, 'rgba(0,0,0,0)');
  chinAO.addColorStop(0.5, 'rgba(0,0,0,0.10)');
  chinAO.addColorStop(1, 'rgba(0,0,0,0.20)');
  ctx.fillStyle = chinAO;
  ctx.fillRect(s(cx - HEAD_RX), sv(HEAD_CY + HEAD_RY * 0.5), s(HEAD_RX * 2), s(HEAD_RY * 0.6));

  ctx.restore();

  // ── 8. EARS ──
  for (const side of [-1, 1]) {
    ctx.fillStyle = skinMid;
    ctx.beginPath();
    ctx.ellipse(s(cx + side * HEAD_RX * 0.96), sv(HEAD_CY + 8), s(12), s(18), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skinDark;
    ctx.beginPath();
    ctx.ellipse(s(cx + side * HEAD_RX * 0.96), sv(HEAD_CY + 8), s(7), s(12), 0, 0, Math.PI * 2);
    ctx.fill();
    // ear outline
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = s(1.5);
    ctx.beginPath();
    ctx.ellipse(s(cx + side * HEAD_RX * 0.96), sv(HEAD_CY + 8), s(12), s(18), 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // ── 9. HAIR ──
  drawHair(ctx, s, sv, cx, HEAD_CY, HEAD_RX, HEAD_RY, appearance.hairStyle, hairCol, hairDark, outfit);

  // ── 10. FACE FEATURES ──
  const eyeCenters = [cx - 44, cx + 44];
  const eyeY = HEAD_CY - 2;
  const eyeRX = 20;
  const eyeRY = 18;

  for (let i = 0; i < 2; i++) {
    const ex = eyeCenters[i];
    const browOffset = (i === 0 ? anim.browL : anim.browR) * 8;

    // ── Eye white ──
    const eyeSY = sv(eyeY) * anim.eyeOpen + sv(eyeY + eyeRY * (1 - anim.eyeOpen)) * (1 - anim.eyeOpen);
    ctx.fillStyle = '#f8f8fc';
    ctx.beginPath();
    ctx.ellipse(s(ex), eyeSY, s(eyeRX), s(eyeRY * anim.eyeOpen + 1), 0, 0, Math.PI * 2);
    ctx.fill();

    if (anim.eyeOpen > 0.1) {
      // ── Iris ──
      ctx.fillStyle = eyeCol;
      ctx.beginPath();
      ctx.ellipse(s(ex), sv(eyeY + 3), s(eyeRX * 0.74), s(eyeRX * 0.8 * anim.eyeOpen), 0, 0, Math.PI * 2);
      ctx.fill();

      // Iris depth gradient
      const irisGrad = ctx.createRadialGradient(
        s(ex - 4), sv(eyeY - 1), s(1),
        s(ex), sv(eyeY + 3), s(eyeRX * 0.74)
      );
      irisGrad.addColorStop(0, 'rgba(255,255,255,0.20)');
      irisGrad.addColorStop(0.35, 'rgba(0,0,0,0)');
      irisGrad.addColorStop(1, 'rgba(0,0,0,0.32)');
      ctx.fillStyle = irisGrad;
      ctx.beginPath();
      ctx.ellipse(s(ex), sv(eyeY + 3), s(eyeRX * 0.74), s(eyeRX * 0.8 * anim.eyeOpen), 0, 0, Math.PI * 2);
      ctx.fill();

      // ── Pupil ──
      ctx.fillStyle = '#08060f';
      ctx.beginPath();
      ctx.ellipse(s(ex), sv(eyeY + 4), s(eyeRX * 0.38), s(eyeRX * 0.46 * anim.eyeOpen), 0, 0, Math.PI * 2);
      ctx.fill();

      // ── Highlights ──
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath();
      ctx.ellipse(s(ex - 6), sv(eyeY - 2), s(5.5), s(5.5 * anim.eyeOpen), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.52)';
      ctx.beginPath();
      ctx.ellipse(s(ex + 5), sv(eyeY + 5), s(3), s(3 * anim.eyeOpen), 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Upper eyelid (thick, anime) ──
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = s(2.5);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.ellipse(s(ex), sv(eyeY), s(eyeRX), s(eyeRY * anim.eyeOpen + 1), 0, Math.PI, Math.PI * 2);
    ctx.stroke();
    // ── Lower lash line (thinner) ──
    ctx.lineWidth = s(1.3);
    ctx.beginPath();
    ctx.ellipse(s(ex), sv(eyeY), s(eyeRX * 0.94), s(eyeRY * anim.eyeOpen * 0.7 + 1), 0, 0, Math.PI);
    ctx.stroke();

    // ── Eyelashes ──
    if (anim.eyeOpen > 0.5) {
      ctx.strokeStyle = '#18081e';
      ctx.lineWidth = s(2);
      ctx.lineCap = 'round';
      for (let li = 0; li < 5; li++) {
        const ang = Math.PI + (li / 4) * Math.PI;
        const lx = ex + Math.cos(ang) * eyeRX * 0.9;
        const ly = eyeY - Math.sin(ang) * eyeRY * 0.8 * anim.eyeOpen;
        const lx2 = lx + Math.cos(ang - 0.15) * 7;
        const ly2 = ly - Math.sin(ang - 0.15) * 7 * anim.eyeOpen;
        ctx.beginPath();
        ctx.moveTo(s(lx), sv(ly));
        ctx.lineTo(s(lx2), sv(ly2));
        ctx.stroke();
      }
    }

    // ── Eyebrow ──
    const brY = eyeY - eyeRY - 11 - browOffset;
    const brCol = hairCol !== '#2c1400' && hairCol !== '#0a0600' ? hairCol : '#2a1830';
    ctx.strokeStyle = brCol;
    ctx.lineWidth = s(4);
    ctx.lineCap = 'round';
    ctx.beginPath();
    const brW = eyeRX * 1.08;
    const arcDir = i === 0 ? 1 : -1;
    ctx.moveTo(s(ex - brW), sv(brY + 3 * arcDir));
    ctx.bezierCurveTo(
      s(ex - brW * 0.25), sv(brY - 5 * arcDir),
      s(ex + brW * 0.2),  sv(brY - 4 * arcDir),
      s(ex + brW),        sv(brY + 4 * arcDir)
    );
    ctx.stroke();
    // Brow sheen
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = s(1.4);
    ctx.beginPath();
    ctx.moveTo(s(ex - brW * 0.55), sv(brY - 0.5 * arcDir));
    ctx.bezierCurveTo(
      s(ex), sv(brY - 5 * arcDir),
      s(ex + brW * 0.1), sv(brY - 5 * arcDir),
      s(ex + brW * 0.5), sv(brY)
    );
    ctx.stroke();
  }

  // ── Nose (anime 3D) ──
  const noseY = HEAD_CY + 38;
  // Tiny shadow under nose tip (right side = shadow side)
  ctx.fillStyle = darken(skin, 0.7);
  ctx.beginPath();
  ctx.ellipse(s(cx + 4), sv(noseY + 7), s(7), s(4), 0.3, 0, Math.PI * 2);
  ctx.fill();
  // Nose bottom line
  ctx.strokeStyle = darken(skin, 0.55);
  ctx.lineWidth = s(2);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(s(cx - 8), sv(noseY));
  ctx.quadraticCurveTo(s(cx - 3), sv(noseY + 8), s(cx), sv(noseY + 8));
  ctx.quadraticCurveTo(s(cx + 3), sv(noseY + 8), s(cx + 8), sv(noseY));
  ctx.stroke();
  // Small nose bridge shadow line (gives 3D bridge illusion)
  ctx.strokeStyle = alpha(darken(skin, 0.65), 0.55);
  ctx.lineWidth = s(1.5);
  ctx.beginPath();
  ctx.moveTo(s(cx + 2), sv(noseY - 12));
  ctx.lineTo(s(cx + 5), sv(noseY + 2));
  ctx.stroke();

  // ── Mouth ──
  ctx.strokeStyle = darken(skin, 0.5);
  ctx.lineWidth = s(2.5);
  ctx.lineCap = 'round';
  const mouthY = HEAD_CY + 56;
  const mouthW = 26;
  const smileAmt = anim.mouthSmile;
  const mouthOpen = anim.mouthOpen;

  ctx.beginPath();
  ctx.moveTo(s(cx - mouthW), sv(mouthY));
  ctx.bezierCurveTo(
    s(cx - mouthW * 0.3), sv(mouthY + smileAmt * 12),
    s(cx + mouthW * 0.3), sv(mouthY + smileAmt * 12),
    s(cx + mouthW),       sv(mouthY)
  );
  ctx.stroke();

  if (mouthOpen > 0.05) {
    ctx.fillStyle = '#3a0a15';
    ctx.beginPath();
    ctx.ellipse(s(cx), sv(mouthY + 4), s(mouthW * 0.7), s(10 * mouthOpen), 0, 0, Math.PI);
    ctx.fill();
    // teeth
    ctx.fillStyle = '#f8f8f6';
    ctx.beginPath();
    ctx.ellipse(s(cx), sv(mouthY + 4), s(mouthW * 0.6), s(5 * mouthOpen), 0, 0, Math.PI);
    ctx.fill();
  }

  // ── Cheek blush (subtle) ──
  for (const side of [-1, 1]) {
    const bx = cx + side * 54;
    const by = HEAD_CY + 22;
    const blushGrad = ctx.createRadialGradient(s(bx), sv(by), 0, s(bx), sv(by), s(22));
    blushGrad.addColorStop(0, `rgba(255,100,100,0.18)`);
    blushGrad.addColorStop(1, 'rgba(255,100,100,0)');
    ctx.fillStyle = blushGrad;
    ctx.beginPath();
    ctx.ellipse(s(bx), sv(by), s(22), s(14), 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── 11. OUTLINES ──
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = s(2.5);
  ctx.lineJoin = 'round';

  // Head outline
  ctx.beginPath();
  ctx.ellipse(s(cx), sv(HEAD_CY), s(HEAD_RX), s(HEAD_RY), 0, 0, Math.PI * 2);
  ctx.stroke();

  // Torso outline
  ctx.beginPath();
  ctx.moveTo(s(cx - SHOULDER_W / 2), sv(SHOULDER_Y));
  ctx.bezierCurveTo(s(cx - SHOULDER_W / 2 - 8), sv(SHOULDER_Y + 40), s(cx - WAIST_W / 2 - 4), sv(TORSO_BOT - 40), s(cx - WAIST_W / 2), sv(TORSO_BOT));
  ctx.lineTo(s(cx + WAIST_W / 2), sv(TORSO_BOT));
  ctx.bezierCurveTo(s(cx + WAIST_W / 2 + 4), sv(TORSO_BOT - 40), s(cx + SHOULDER_W / 2 + 8), sv(SHOULDER_Y + 40), s(cx + SHOULDER_W / 2), sv(SHOULDER_Y));
  ctx.stroke();

  // Shoe outlines
  for (const side of [-1, 1]) {
    const sx2 = cx + side * (LEG_SEP + LEG_W * 0.5 - LEG_W * 0.1);
    const shoeW = LEG_W * 1.05;
    ctx.lineWidth = s(1.8);
    ctx.beginPath();
    ctx.moveTo(s(sx2 - shoeW * 0.8), sv(LEG_BOT - 2));
    ctx.lineTo(s(sx2 + shoeW * (side > 0 ? 0.8 : 0.5)), sv(LEG_BOT - 2));
    ctx.bezierCurveTo(
      s(sx2 + shoeW * (side > 0 ? 1.2 : 0.7)), sv(LEG_BOT + 5),
      s(sx2 + shoeW * (side > 0 ? 1.1 : 0.6)), sv(SHOE_BOT - 4),
      s(sx2 + shoeW * (side > 0 ? 0.9 : 0.4)), sv(SHOE_BOT)
    );
    ctx.lineTo(s(sx2 - shoeW * 0.8), sv(SHOE_BOT));
    ctx.closePath();
    ctx.stroke();
  }
}

// ── Hair drawer ─────────────────────────────────────────────────
function drawHair(
  ctx: CanvasRenderingContext2D,
  s: (x: number) => number,
  sv: (y: number) => number,
  cx: number,
  headCY: number,
  headRX: number,
  headRY: number,
  style: string,
  hairCol: string,
  hairDark: string,
  outfit: string,
) {
  const OUTLINE = '#1a1222';
  const hairLight = lighten(hairCol, 1.35);

  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  switch (style) {
    case 'waves': {
      // Long wavy hair, flowing past shoulders
      ctx.fillStyle = hairCol;
      ctx.beginPath();
      // Crown + sides + long back
      ctx.moveTo(s(cx - headRX + 10), sv(headCY + 5));
      ctx.bezierCurveTo(
        s(cx - headRX - 10), sv(headCY - headRY * 1.6),
        s(cx - headRX * 0.2), sv(headCY - headRY * 1.25),
        s(cx), sv(headCY - headRY * 1.15)
      );
      ctx.bezierCurveTo(
        s(cx + headRX * 0.2), sv(headCY - headRY * 1.25),
        s(cx + headRX + 10), sv(headCY - headRY * 1.6),
        s(cx + headRX - 10), sv(headCY + 5)
      );
      // Right side waves going down
      ctx.bezierCurveTo(
        s(cx + headRX + 30), sv(headCY + 60),
        s(cx + headRX + 25), sv(headCY + 120),
        s(cx + headRX + 15), sv(headCY + 190)
      );
      // Bottom
      ctx.lineTo(s(cx - headRX - 15), sv(headCY + 190));
      // Left side waves back up
      ctx.bezierCurveTo(
        s(cx - headRX - 25), sv(headCY + 120),
        s(cx - headRX - 30), sv(headCY + 60),
        s(cx - headRX + 10), sv(headCY + 5)
      );
      ctx.closePath();
      ctx.fill();
      // Wave highlight
      ctx.strokeStyle = alpha(hairLight, 0.4);
      ctx.lineWidth = s(4);
      ctx.beginPath();
      ctx.moveTo(s(cx - headRX * 0.2), sv(headCY - headRY * 1.1));
      ctx.bezierCurveTo(s(cx + headRX * 0.1), sv(headCY - headRY * 0.95), s(cx + headRX * 0.4), sv(headCY - headRY * 0.7), s(cx + headRX * 0.35), sv(headCY));
      ctx.stroke();
      // Sheen always visible
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = s(3.5);
      ctx.beginPath();
      ctx.moveTo(s(cx - headRX * 0.35), sv(headCY - headRY * 1.08));
      ctx.bezierCurveTo(s(cx), sv(headCY - headRY * 1.18), s(cx + headRX * 0.3), sv(headCY - headRY * 0.95), s(cx + headRX * 0.4), sv(headCY - headRY * 0.6));
      ctx.stroke();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = s(2);
      ctx.beginPath();
      ctx.moveTo(s(cx - headRX + 10), sv(headCY + 5));
      ctx.bezierCurveTo(s(cx - headRX - 10), sv(headCY - headRY * 1.6), s(cx - headRX * 0.2), sv(headCY - headRY * 1.25), s(cx), sv(headCY - headRY * 1.15));
      ctx.bezierCurveTo(s(cx + headRX * 0.2), sv(headCY - headRY * 1.25), s(cx + headRX + 10), sv(headCY - headRY * 1.6), s(cx + headRX - 10), sv(headCY + 5));
      ctx.stroke();
      break;
    }

    case 'afro': {
      ctx.fillStyle = hairCol;
      ctx.beginPath();
      ctx.ellipse(s(cx), sv(headCY - headRY * 0.3), s(headRX * 1.55), s(headRY * 1.5), 0, 0, Math.PI * 2);
      ctx.fill();
      // Shadow underside
      ctx.fillStyle = hairDark;
      ctx.beginPath();
      ctx.ellipse(s(cx), sv(headCY + headRY * 0.3), s(headRX * 1.55), s(headRY * 0.4), 0, 0, Math.PI * 2);
      ctx.fill();
      // Texture dots
      ctx.fillStyle = alpha(hairDark, 0.35);
      for (let d = 0; d < 22; d++) {
        const ang = (d / 22) * Math.PI * 2;
        const dr = 0.6 + Math.sin(d * 13.7) * 0.35;
        const dx = cx + Math.cos(ang) * headRX * 1.2 * dr;
        const dy = headCY - headRY * 0.3 + Math.sin(ang) * headRY * 1.2 * dr;
        ctx.beginPath();
        ctx.arc(s(dx), sv(dy), s(7 + Math.sin(d * 3.3) * 4), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = s(2);
      ctx.beginPath();
      ctx.ellipse(s(cx), sv(headCY - headRY * 0.3), s(headRX * 1.55), s(headRY * 1.5), 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }

    case 'fade': {
      // Very short on sides, medium on top
      ctx.fillStyle = hairCol;
      ctx.beginPath();
      ctx.ellipse(s(cx), sv(headCY - headRY * 0.85), s(headRX * 0.7), s(headRY * 0.32), 0, 0, Math.PI * 2);
      ctx.fill();
      // Side fade gradient
      for (const side of [-1, 1]) {
        const fadeGrad = ctx.createLinearGradient(
          s(cx), sv(headCY - headRY),
          s(cx + side * headRX), sv(headCY - headRY * 0.4)
        );
        fadeGrad.addColorStop(0, alpha(hairCol, 0.9));
        fadeGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = fadeGrad;
        ctx.beginPath();
        ctx.ellipse(s(cx + side * headRX * 0.55), sv(headCY - headRY * 0.6), s(headRX * 0.7), s(headRY * 0.55), 0.1 * side, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = s(1.5);
      ctx.beginPath();
      ctx.ellipse(s(cx), sv(headCY - headRY * 0.85), s(headRX * 0.7), s(headRY * 0.32), 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }

    case 'locs': {
      // Dreadlocks: multiple thick strands hanging down
      const numLocs = 9;
      for (let i = 0; i < numLocs; i++) {
        const t2 = i / (numLocs - 1);
        const lx = cx - headRX * 1.1 + t2 * headRX * 2.2;
        const topY = headCY - headRY * (0.9 - Math.abs(t2 - 0.5) * 0.4);
        const botY = headCY + headRY * 2.1 + Math.sin(i * 2.3) * 20;
        const thick = 14 - Math.abs(t2 - 0.5) * 6;
        const col = i % 2 === 0 ? hairCol : darken(hairCol, 0.8);
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(s(lx - thick / 2), sv(topY));
        ctx.bezierCurveTo(
          s(lx - thick / 2 - 4 * (t2 - 0.5)), sv(topY + (botY - topY) * 0.4),
          s(lx - thick / 2 - 3 * (t2 - 0.5)), sv(topY + (botY - topY) * 0.8),
          s(lx), sv(botY)
        );
        ctx.bezierCurveTo(
          s(lx + thick / 2 + 3 * (t2 - 0.5)), sv(topY + (botY - topY) * 0.8),
          s(lx + thick / 2 + 4 * (t2 - 0.5)), sv(topY + (botY - topY) * 0.4),
          s(lx + thick / 2), sv(topY)
        );
        ctx.closePath();
        ctx.fill();
        // highlight
        ctx.strokeStyle = alpha(hairLight, 0.3);
        ctx.lineWidth = s(2);
        ctx.beginPath();
        ctx.moveTo(s(lx - thick * 0.1), sv(topY));
        ctx.lineTo(s(lx - thick * 0.1), sv(botY - 12));
        ctx.stroke();
      }
      // crown cap
      ctx.fillStyle = hairCol;
      ctx.beginPath();
      ctx.ellipse(s(cx), sv(headCY - headRY * 0.9), s(headRX * 1.05), s(headRY * 0.25), 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'braids': {
      // Box braids: thick braids, top + hanging
      const numBraids = 7;
      for (let i = 0; i < numBraids; i++) {
        const t2 = i / (numBraids - 1);
        const bx = cx - headRX * 0.95 + t2 * headRX * 1.9;
        const topY = headCY - headRY * (0.88 - Math.abs(t2 - 0.5) * 0.5);
        const botY = headCY + headRY * 1.9 + Math.sin(i * 1.8) * 15;
        const thick = 18;
        ctx.fillStyle = i % 3 === 0 ? hairCol : darken(hairCol, 0.85);
        ctx.beginPath();
        ctx.roundRect(s(bx - thick / 2), sv(topY), s(thick), sv(botY) - sv(topY), s(thick / 2));
        ctx.fill();
        // braid pattern
        ctx.strokeStyle = alpha(hairDark, 0.55);
        ctx.lineWidth = s(1.5);
        const segments = 8;
        for (let seg = 0; seg < segments; seg++) {
          const segY = topY + (botY - topY) * (seg / segments);
          ctx.beginPath();
          ctx.moveTo(s(bx - thick / 2 + 2), sv(segY));
          ctx.lineTo(s(bx + thick / 2 - 2), sv(segY));
          ctx.stroke();
        }
      }
      // Crown
      ctx.fillStyle = hairCol;
      ctx.beginPath();
      ctx.ellipse(s(cx), sv(headCY - headRY * 0.88), s(headRX * 1.0), s(headRY * 0.22), 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'natural': {
      // Big natural coily hair
      ctx.fillStyle = hairCol;
      ctx.beginPath();
      ctx.ellipse(s(cx), sv(headCY - headRY * 0.5), s(headRX * 1.42), s(headRY * 1.35), 0, 0, Math.PI * 2);
      ctx.fill();
      // Curl texture
      ctx.strokeStyle = hairDark;
      ctx.lineWidth = s(3);
      ctx.lineCap = 'round';
      for (let c = 0; c < 18; c++) {
        const ang = (c / 18) * Math.PI * 2;
        const cr = 0.55 + Math.sin(c * 7.3) * 0.3;
        const ccx = cx + Math.cos(ang) * headRX * 1.1 * cr;
        const ccy = headCY - headRY * 0.5 + Math.sin(ang) * headRY * 1.05 * cr;
        ctx.beginPath();
        ctx.arc(s(ccx), sv(ccy), s(8 + Math.sin(c * 2.3) * 4), 0, Math.PI * 1.5);
        ctx.stroke();
      }
      // Highlight sheen
      ctx.fillStyle = alpha(hairLight, 0.22);
      ctx.beginPath();
      ctx.ellipse(s(cx - headRX * 0.3), sv(headCY - headRY * 0.9), s(headRX * 0.55), s(headRY * 0.4), -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = s(2);
      ctx.beginPath();
      ctx.ellipse(s(cx), sv(headCY - headRY * 0.5), s(headRX * 1.42), s(headRY * 1.35), 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }

    case 'none': {
      // Bald / clean shaved — just a slight darker top
      const baldShade = ctx.createLinearGradient(s(cx - headRX), sv(headCY - headRY), s(cx + headRX * 0.2), sv(headCY - headRY * 0.5));
      baldShade.addColorStop(0, alpha(hairCol, 0.12));
      baldShade.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = baldShade;
      ctx.beginPath();
      ctx.ellipse(s(cx), sv(headCY), s(headRX), s(headRY), 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    default: break; // 'fade' fallback
  }
}

// ── Dedicated hair-only mini renderer for pickers ──────────────
export function drawMiniHair(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, r: number,
  style: string, hairCol: string,
) {
  const s = (v: number) => v;
  const sv = (v: number) => v;
  const hairDark = darken(hairCol, 0.65);
  drawHair(ctx, s, sv, x, y, r, r * 1.1, style, hairCol, hairDark, 'hoodie');
  // Face circle
  ctx.fillStyle = '#c8875080';
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 1.1, 0, 0, Math.PI * 2);
  ctx.fill();
}
