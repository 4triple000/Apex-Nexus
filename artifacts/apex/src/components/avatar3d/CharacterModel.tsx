import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { AvatarAppearance } from '@/hooks/useAvatarStore';
import { Emotion } from '@/lib/emotionController';

interface CharacterModelProps {
  appearance: AvatarAppearance;
  emotion: Emotion;
  isThinking: boolean;
  personality: 'hood' | 'professional' | 'bigbro';
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// ── Skin materials ────────────────────────────────────────────
function useMats(skinTone: string, hairColor: string, eyeColor: string, outfitStyle: string) {
  return useMemo(() => {
    const skin = new THREE.MeshStandardMaterial({ color: new THREE.Color(skinTone), roughness: 0.72 });
    const darkSkin = new THREE.MeshStandardMaterial({
      color: new THREE.Color(skinTone).multiplyScalar(0.76), roughness: 0.78,
    });
    const hair = new THREE.MeshStandardMaterial({ color: new THREE.Color(hairColor), roughness: 0.88 });
    const lip  = new THREE.MeshStandardMaterial({
      color: new THREE.Color(skinTone).multiplyScalar(0.68), roughness: 0.6,
    });
    const white = new THREE.MeshStandardMaterial({ color: '#f0ede8', roughness: 0.3 });
    const iris  = new THREE.MeshStandardMaterial({ color: new THREE.Color(eyeColor), roughness: 0.15, metalness: 0.1 });
    const pupil = new THREE.MeshStandardMaterial({ color: '#040404', roughness: 0.1 });
    const specular = new THREE.MeshStandardMaterial({
      color: 'white', roughness: 0, emissive: new THREE.Color('white'), emissiveIntensity: 0.55,
    });
    const mouthDark = new THREE.MeshStandardMaterial({ color: '#180508', roughness: 1 });

    const clothColors: Record<string, string> = {
      hoodie: '#16162a', suit: '#1c1c2c', tee: '#252535', athletic: '#0d1828', jersey: '#172244',
    };
    const cloth = new THREE.MeshStandardMaterial({
      color: new THREE.Color(clothColors[outfitStyle] ?? '#16162a'), roughness: 0.86,
    });
    const accentWhite = new THREE.MeshStandardMaterial({ color: '#eeeeee', roughness: 0.7 });
    const tieRed = new THREE.MeshStandardMaterial({ color: '#8b1a1a', roughness: 0.5 });

    return { skin, darkSkin, hair, lip, white, iris, pupil, specular, mouthDark, cloth, accentWhite, tieRed };
  }, [skinTone, hairColor, eyeColor, outfitStyle]);
}

// ── Animation targets by personality + emotion ────────────────
function getAnimTarget(personality: string, emotion: Emotion, isThinking: boolean, t: number) {
  const bases: Record<string, any> = {
    hood:         { headY: -0.05, headX: 0.04, headZ: 0.04, shoulderSag: 0.04 },
    professional: { headY: 0,     headX: -0.02, headZ: 0,   shoulderSag: 0 },
    bigbro:       { headY: 0.04,  headX: -0.04, headZ: -0.02, shoulderSag: 0.02 },
  };
  const base = bases[personality] ?? bases.hood;

  let browL = 0, browR = 0, mouthCurve = 0.04, eyeWide = 1.0;
  switch (emotion) {
    case 'happy':    browL = 0.08; browR = 0.08; mouthCurve = 0.14; break;
    case 'excited':  browL = 0.14; browR = 0.14; mouthCurve = 0.2; eyeWide = 1.25; break;
    case 'thinking': browL = -0.05; browR = 0.07; mouthCurve = 0; break;
    case 'concerned':browL = -0.09; browR = -0.09; mouthCurve = -0.1; break;
    case 'serious':  browL = -0.04; browR = -0.04; mouthCurve = -0.02; break;
    default: break;
  }
  if (isThinking) { browL = -0.04; browR = 0.1; }

  const sway = Math.sin(t * 0.38) * 0.014;
  const bob  = Math.sin(t * 0.52) * 0.006;

  return { ...base, browL, browR, mouthCurve, eyeWide, sway, bob };
}

// ── Hair geometry ─────────────────────────────────────────────
function Hair({ style, mat }: { style: string; mat: THREE.Material }) {
  if (style === 'bald') return null;

  if (style === 'waves') return (
    <group>
      <mesh material={mat} position={[0, 0.22, 0]} scale={[1.04, 0.52, 1.02]}>
        <sphereGeometry args={[0.38, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} material={mat} position={[0, 0.27 + i * 0.022, (i % 2 === 0 ? -0.04 : 0.04)]} scale={[0.96, 0.1, 0.7]}>
          <sphereGeometry args={[0.34, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2.5]} />
        </mesh>
      ))}
      {/* Sideburns */}
      {([-1, 1] as const).map((side) => (
        <mesh key={side} material={mat} position={[side * 0.34, 0.04, 0.08]} scale={[0.16, 0.22, 0.18]}>
          <sphereGeometry args={[1, 8, 6]} />
        </mesh>
      ))}
    </group>
  );

  if (style === 'fade') return (
    <group>
      <mesh material={mat} position={[0, 0.24, 0]} scale={[1.02, 0.36, 1.0]}>
        <sphereGeometry args={[0.38, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2.2]} />
      </mesh>
      {([-1, 1] as const).map((side) => (
        <mesh key={side} material={mat} position={[side * 0.36, -0.01, 0]} scale={[0.1, 0.16, 0.16]}>
          <sphereGeometry args={[1, 8, 6]} />
        </mesh>
      ))}
    </group>
  );

  if (style === 'braids') return (
    <group>
      <mesh material={mat} position={[0, 0.22, 0]} scale={[1.04, 0.28, 1.02]}>
        <sphereGeometry args={[0.38, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2.4]} />
      </mesh>
      {([-0.16, -0.06, 0.04, 0.14, 0.22] as number[]).map((bx, i) => (
        <group key={i} position={[bx, 0.35, 0]}>
          {[0, 1, 2, 3, 4, 5].map((j) => (
            <mesh key={j} material={mat} position={[0, -j * 0.09, 0]}>
              <cylinderGeometry args={[0.018, 0.014, 0.08, 6]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );

  if (style === 'afro') return (
    <mesh material={mat} position={[0, 0.18, 0]} scale={[1.2, 1.0, 1.12]}>
      <sphereGeometry args={[0.38, 20, 16, 0, Math.PI * 2, 0, Math.PI / 1.65]} />
    </mesh>
  );

  // low cut / default
  return (
    <mesh material={mat} position={[0, 0.22, 0]} scale={[1.02, 0.26, 1.0]}>
      <sphereGeometry args={[0.38, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2.8]} />
    </mesh>
  );
}

// ── Main character ────────────────────────────────────────────
export function CharacterModel({ appearance, emotion, isThinking, personality }: CharacterModelProps) {
  const mats = useMats(appearance.skinTone, appearance.hairColor, appearance.eyeColor, appearance.outfit);

  // Group & mesh refs for animation
  const rootRef   = useRef<THREE.Group>(null);
  const headRef   = useRef<THREE.Group>(null);
  const eyeLRef   = useRef<THREE.Group>(null);
  const eyeRRef   = useRef<THREE.Group>(null);
  const browLRef  = useRef<THREE.Mesh>(null);
  const browRRef  = useRef<THREE.Mesh>(null);
  const uLipRef   = useRef<THREE.Mesh>(null);
  const lLipRef   = useRef<THREE.Mesh>(null);
  const cavityRef = useRef<THREE.Mesh>(null);
  const lArmGrp   = useRef<THREE.Group>(null);
  const rArmGrp   = useRef<THREE.Group>(null);

  // Mutable animation state
  const anim = useRef({
    headX: 0, headY: 0, headZ: 0,
    bodyBob: 0,
    browLY: 0.09, browRY: 0.09,
    mouthCurve: 0, mouthOpen: 0,
    eyeScaleY: 1,
    blinkTimer: 2 + Math.random() * 3,
    blinkPhase: 0, // 0=open, going towards 1=closed
    blinking: false,
    lArmZ: 0, rArmZ: 0,
    talkPhase: 0,
  });

  const clock = useRef(0);

  useFrame((_, delta) => {
    clock.current += delta;
    const t  = clock.current;
    const a  = anim.current;
    const sp = Math.min(delta * 5, 0.3); // lerp speed, capped
    const tgt = getAnimTarget(personality, emotion, isThinking, t);

    // Head idle + personality lean
    a.headX = lerp(a.headX, tgt.headX + Math.sin(t * 0.44) * 0.012, sp);
    a.headY = lerp(a.headY, tgt.headY + tgt.sway,                     sp);
    a.headZ = lerp(a.headZ, tgt.headZ + Math.sin(t * 0.28) * 0.008,  sp * 0.6);
    a.bodyBob = lerp(a.bodyBob, tgt.bob, sp * 0.4);

    // Brow
    const targetBrowLY = 0.09 + tgt.browL;
    const targetBrowRY = 0.09 + tgt.browR;
    a.browLY = lerp(a.browLY, targetBrowLY, sp);
    a.browRY = lerp(a.browRY, targetBrowRY, sp);

    // Mouth
    if (isThinking) {
      a.talkPhase += delta * 7.5;
      const talk = Math.sin(a.talkPhase) * 0.5 + 0.5;
      a.mouthOpen  = lerp(a.mouthOpen, talk * 0.14, sp * 2.5);
    } else {
      a.talkPhase = 0;
      a.mouthOpen  = lerp(a.mouthOpen, 0, sp * 2);
    }
    a.mouthCurve = lerp(a.mouthCurve, tgt.mouthCurve, sp);

    // Blink
    a.blinkTimer -= delta;
    if (a.blinkTimer <= 0 && !a.blinking) {
      a.blinking = true;
      a.blinkPhase = 0;
      a.blinkTimer = 2.4 + Math.random() * 4;
    }
    if (a.blinking) {
      a.blinkPhase += delta * 8;
      if (a.blinkPhase >= Math.PI) {
        a.blinking = false;
        a.blinkPhase = Math.PI;
      }
    } else if (a.blinkPhase > 0) {
      a.blinkPhase = 0;
    }
    // sin curve: 0→1→0 across [0, PI]
    const blinkClose = Math.max(0, Math.sin(a.blinkPhase));
    a.eyeScaleY = Math.max(0.04, (1 - blinkClose) * tgt.eyeWide);

    // Arm gestures
    let lArmTarget = 0, rArmTarget = 0;
    if (isThinking) {
      lArmTarget = personality === 'hood' ? 0.22 : personality === 'bigbro' ? 0.18 : 0.08;
      rArmTarget = -0.06;
    } else {
      if (personality === 'hood') {
        lArmTarget = Math.sin(t * 0.46) * 0.07;
        rArmTarget = Math.sin(t * 0.46 + 1.1) * 0.06;
      } else if (personality === 'bigbro') {
        lArmTarget = Math.sin(t * 0.35) * 0.05;
        rArmTarget = Math.sin(t * 0.35 + 0.9) * 0.04;
      }
    }
    a.lArmZ = lerp(a.lArmZ, lArmTarget, sp * 0.5);
    a.rArmZ = lerp(a.rArmZ, rArmTarget, sp * 0.5);

    // ── Apply ──
    if (rootRef.current) rootRef.current.position.y = a.bodyBob;
    if (headRef.current) {
      headRef.current.rotation.x = a.headX;
      headRef.current.rotation.y = a.headY;
      headRef.current.rotation.z = a.headZ;
    }
    if (eyeLRef.current)  eyeLRef.current.scale.y  = a.eyeScaleY;
    if (eyeRRef.current)  eyeRRef.current.scale.y  = a.eyeScaleY;
    if (browLRef.current) browLRef.current.position.y = a.browLY;
    if (browRRef.current) browRRef.current.position.y = a.browRY;

    // Mouth lip movement
    if (uLipRef.current) {
      uLipRef.current.position.y  = 0.016 + a.mouthCurve * 0.4;
      uLipRef.current.rotation.x  = a.mouthCurve * 0.35;
    }
    if (lLipRef.current) {
      lLipRef.current.position.y  = -0.022 - a.mouthOpen * 0.024;
      lLipRef.current.rotation.x  = -a.mouthCurve * 0.2;
    }
    if (cavityRef.current) {
      const open = Math.max(0, a.mouthOpen - 0.02);
      cavityRef.current.scale.y   = open * 6;
      cavityRef.current.visible   = open > 0.01;
    }
    if (lArmGrp.current) lArmGrp.current.rotation.z =  a.lArmZ;
    if (rArmGrp.current) rArmGrp.current.rotation.z = -a.rArmZ;
  });

  const clothColor = useMemo(() => {
    const m: Record<string, string> = {
      hoodie: '#16162a', suit: '#1c1c2c', tee: '#252535', athletic: '#0d1828', jersey: '#172244',
    };
    return m[appearance.outfit] ?? '#16162a';
  }, [appearance.outfit]);

  const clothMat  = useMemo(() => new THREE.MeshStandardMaterial({ color: clothColor, roughness: 0.86 }), [clothColor]);
  const accentMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#dddddd', roughness: 0.7 }), []);

  return (
    <group ref={rootRef} position={[0, -0.38, 0]}>

      {/* ══════════ TORSO / BODY ══════════ */}
      <mesh material={clothMat} position={[0, 0.62, 0]}>
        <boxGeometry args={[0.72, 0.88, 0.36]} />
      </mesh>
      {/* Shoulders — wider for GTA proportions */}
      <mesh material={clothMat} position={[0, 0.94, 0]}>
        <boxGeometry args={[1.02, 0.22, 0.36]} />
      </mesh>

      {/* Outfit details */}
      {appearance.outfit === 'hoodie' && <>
        <mesh material={clothMat} position={[0, 1.06, -0.1]}>
          <boxGeometry args={[0.52, 0.3, 0.22]} />
        </mesh>
        <mesh material={accentMat} position={[0, 0.34, 0.19]}>
          <boxGeometry args={[0.28, 0.18, 0.004]} />
        </mesh>
      </>}
      {appearance.outfit === 'suit' && <>
        <mesh material={accentMat} position={[-0.09, 0.84, 0.185]} rotation={[0, 0, 0.38]}>
          <boxGeometry args={[0.08, 0.28, 0.004]} />
        </mesh>
        <mesh material={accentMat} position={[0.09, 0.84, 0.185]} rotation={[0, 0, -0.38]}>
          <boxGeometry args={[0.08, 0.28, 0.004]} />
        </mesh>
        <mesh position={[0, 0.62, 0.192]}>
          <boxGeometry args={[0.04, 0.44, 0.003]} />
          <meshStandardMaterial color="#8b1a1a" roughness={0.5} />
        </mesh>
      </>}

      {/* Neck */}
      <mesh material={mats.skin} position={[0, 1.12, 0]}>
        <cylinderGeometry args={[0.1, 0.115, 0.32, 16]} />
      </mesh>

      {/* ══════════ LEFT ARM ══════════ */}
      <group ref={lArmGrp} position={[-0.51, 0.94, 0]}>
        {/* Upper arm */}
        <mesh material={clothMat} position={[-0.12, -0.2, 0]} rotation={[0, 0, 0.2]}>
          <cylinderGeometry args={[0.1, 0.09, 0.46, 12]} />
        </mesh>
        {/* Forearm */}
        <mesh material={mats.skin} position={[-0.22, -0.52, 0.04]} rotation={[0.28, 0, 0.16]}>
          <cylinderGeometry args={[0.075, 0.068, 0.44, 10]} />
        </mesh>
        {/* Hand */}
        <mesh material={mats.skin} position={[-0.28, -0.74, 0.09]}>
          <boxGeometry args={[0.1, 0.13, 0.055]} />
        </mesh>
      </group>

      {/* ══════════ RIGHT ARM ══════════ */}
      <group ref={rArmGrp} position={[0.51, 0.94, 0]}>
        {/* Upper arm */}
        <mesh material={clothMat} position={[0.12, -0.2, 0]} rotation={[0, 0, -0.2]}>
          <cylinderGeometry args={[0.1, 0.09, 0.46, 12]} />
        </mesh>
        {/* Forearm */}
        <mesh material={mats.skin} position={[0.22, -0.52, 0.04]} rotation={[0.28, 0, -0.16]}>
          <cylinderGeometry args={[0.075, 0.068, 0.44, 10]} />
        </mesh>
        {/* Hand */}
        <mesh material={mats.skin} position={[0.28, -0.74, 0.09]}>
          <boxGeometry args={[0.1, 0.13, 0.055]} />
        </mesh>
      </group>

      {/* ══════════ HEAD ══════════ */}
      <group ref={headRef} position={[0, 1.38, 0]}>

        {/* Cranium */}
        <mesh material={mats.skin} scale={[1, 1.15, 0.94]}>
          <sphereGeometry args={[0.38, 32, 24]} />
        </mesh>

        {/* Lower jaw / chin */}
        <mesh material={mats.skin} position={[0, -0.21, 0.02]} scale={[0.88, 0.6, 0.85]}>
          <sphereGeometry args={[0.38, 24, 18]} />
        </mesh>

        {/* Cheekbones */}
        {([-1, 1] as const).map((side) => (
          <mesh key={side} material={mats.skin} position={[side * 0.27, -0.03, 0.27]} scale={[0.22, 0.16, 0.18]}>
            <sphereGeometry args={[1, 10, 8]} />
          </mesh>
        ))}

        {/* Ears */}
        {([-1, 1] as const).map((side) => (
          <mesh key={side} material={mats.darkSkin} position={[side * 0.38, 0.02, 0.05]} scale={[0.14, 0.22, 0.08]}>
            <sphereGeometry args={[1, 8, 6]} />
          </mesh>
        ))}

        {/* Eye sockets (darker) */}
        {([-1, 1] as const).map((side) => (
          <mesh key={side} material={mats.darkSkin} position={[side * 0.13, 0.07, 0.358]} scale={[0.12, 0.09, 0.04]}>
            <sphereGeometry args={[1, 8, 6]} />
          </mesh>
        ))}

        {/* Left eye — controlled via ref for blinking */}
        <group ref={eyeLRef} position={[-0.13, 0.07, 0.362]}>
          <mesh material={mats.white}><sphereGeometry args={[0.062, 18, 14]} /></mesh>
          <mesh material={mats.iris}  position={[0, 0, 0.042]}><sphereGeometry args={[0.042, 14, 10]} /></mesh>
          <mesh material={mats.pupil} position={[0, 0, 0.055]}><sphereGeometry args={[0.026, 10, 8]} /></mesh>
          <mesh material={mats.specular} position={[0.016, 0.016, 0.068]}><sphereGeometry args={[0.008, 6, 6]} /></mesh>
        </group>

        {/* Right eye */}
        <group ref={eyeRRef} position={[0.13, 0.07, 0.362]}>
          <mesh material={mats.white}><sphereGeometry args={[0.062, 18, 14]} /></mesh>
          <mesh material={mats.iris}  position={[0, 0, 0.042]}><sphereGeometry args={[0.042, 14, 10]} /></mesh>
          <mesh material={mats.pupil} position={[0, 0, 0.055]}><sphereGeometry args={[0.026, 10, 8]} /></mesh>
          <mesh material={mats.specular} position={[0.016, 0.016, 0.068]}><sphereGeometry args={[0.008, 6, 6]} /></mesh>
        </group>

        {/* Eyebrows (animated via refs) */}
        <mesh ref={browLRef} material={mats.hair} position={[-0.13, 0.09, 0.357]} rotation={[0.1, 0, -0.09]}>
          <boxGeometry args={[0.11, 0.016, 0.018]} />
        </mesh>
        <mesh ref={browRRef} material={mats.hair} position={[0.13, 0.09, 0.357]} rotation={[0.1, 0, 0.09]}>
          <boxGeometry args={[0.11, 0.016, 0.018]} />
        </mesh>

        {/* Nose bridge */}
        <mesh material={mats.darkSkin} position={[0, 0.01, 0.369]}>
          <boxGeometry args={[0.036, 0.1, 0.02]} />
        </mesh>
        {/* Nose tip */}
        <mesh material={mats.skin} position={[0, -0.05, 0.386]}>
          <sphereGeometry args={[0.046, 10, 8]} />
        </mesh>
        {/* Nostrils */}
        {([-1, 1] as const).map((side) => (
          <mesh key={side} material={mats.darkSkin} position={[side * 0.033, -0.067, 0.374]} scale={[0.5, 0.36, 0.5]}>
            <sphereGeometry args={[0.04, 6, 6]} />
          </mesh>
        ))}

        {/* Philtrum (nose-to-mouth groove) */}
        <mesh material={mats.darkSkin} position={[0, -0.1, 0.375]} scale={[0.3, 0.5, 0.2]}>
          <sphereGeometry args={[0.04, 6, 5]} />
        </mesh>

        {/* ── Mouth (animated via refs) ── */}
        <group position={[0, -0.145, 0.358]}>
          {/* Upper lip */}
          <mesh ref={uLipRef} material={mats.lip} position={[0, 0.016, 0]}>
            <boxGeometry args={[0.13, 0.019, 0.017]} />
          </mesh>
          {/* Lower lip */}
          <mesh ref={lLipRef} material={mats.lip} position={[0, -0.022, 0]}>
            <boxGeometry args={[0.11, 0.022, 0.019]} />
          </mesh>
          {/* Mouth cavity */}
          <mesh ref={cavityRef} material={mats.mouthDark} position={[0, -0.002, -0.003]} visible={false}>
            <boxGeometry args={[0.1, 0.018, 0.01]} />
          </mesh>
        </group>

        {/* Chin definition */}
        <mesh material={mats.darkSkin} position={[0, -0.3, 0.305]} scale={[0.09, 0.055, 0.045]}>
          <sphereGeometry args={[1, 6, 5]} />
        </mesh>

        {/* Hair */}
        <Hair style={appearance.hairStyle} mat={mats.hair} />
      </group>
    </group>
  );
}
