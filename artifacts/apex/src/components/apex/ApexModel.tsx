import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { type ApexEmotion } from "./apexEmotionController";
import { type AIEmotionState } from "./apexEmotionEngine";
import { useApexFace } from "@/hooks/useApexFace";
import { type Visemes } from "@/hooks/useVoiceLipSync";

// ─── Lerp helper ──────────────────────────────────────────────────────────────
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GLB-BASED MODEL — full shapekey expression + micro-behavior system
// Drop apex_avatar.glb in /public to activate
// ═══════════════════════════════════════════════════════════════════════════════
function GLBModel({
  mode,
  emotion,
  visemes,
}: {
  mode: AIEmotionState;
  emotion: ApexEmotion;
  visemes: Visemes;
}) {
  const { nodes } = useGLTF("/apex_avatar.glb");
  const rootRef = useRef<THREE.Group>(null!);

  // Full expression + micro-behavior system (rootRef drives head tilt)
  useApexFace(nodes as Record<string, THREE.Mesh>, mode, visemes, rootRef);

  // Holistic body movement
  useFrame((state) => {
    if (!rootRef.current) return;
    const t = state.clock.elapsedTime;
    rootRef.current.position.y =
      Math.sin(t * 1.3 * emotion.speed) * 0.025;
  });

  return (
    <group ref={rootRef}>
      {/* Render named GLB nodes — matches Blender export */}
      {(nodes as Record<string, THREE.Object3D>).Head && (
        <primitive object={(nodes as Record<string, THREE.Object3D>).Head} />
      )}
      {(nodes as Record<string, THREE.Object3D>).Eyes && (
        <primitive object={(nodes as Record<string, THREE.Object3D>).Eyes} />
      )}
      {(nodes as Record<string, THREE.Object3D>).Face && (
        <primitive object={(nodes as Record<string, THREE.Object3D>).Face} />
      )}

      {/* Emotion-driven eye glow */}
      <pointLight
        position={[0, 0.18, 1.3]}
        color={emotion.eyeHex}
        intensity={emotion.glowIntensity}
        distance={2}
        decay={2}
      />
    </group>
  );
}

// ─── Particles orbiting the head ──────────────────────────────────────────────
function Particles({ emotion }: { emotion: ApexEmotion }) {
  const ref = useRef<THREE.Points>(null!);
  const COUNT = 140;

  const { positions, phases } = useMemo(() => {
    const pos = new Float32Array(COUNT * 3);
    const ph  = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      const r     = 1.2 + Math.random() * 0.7;
      pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi);
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      ph[i] = Math.random() * Math.PI * 2;
    }
    return { positions: pos, phases: ph };
  }, []);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime * emotion.particleSpeed;
    ref.current.rotation.y = t * 0.12;
    ref.current.rotation.x = Math.sin(t * 0.28) * 0.09;

    const posArr = ref.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < COUNT; i++) {
      const pulse = 1 + Math.sin(t * 1.3 + phases[i]) * 0.09;
      posArr[i * 3]     = positions[i * 3]     * pulse;
      posArr[i * 3 + 1] = positions[i * 3 + 1] * pulse;
      posArr[i * 3 + 2] = positions[i * 3 + 2] * pulse;
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[new Float32Array(positions), 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.022} color={emotion.eyeHex} transparent opacity={0.5} sizeAttenuation />
    </points>
  );
}

// ─── Holographic rings ────────────────────────────────────────────────────────
function HoloRings({ emotion }: { emotion: ApexEmotion }) {
  const r0 = useRef<THREE.Mesh>(null!);
  const r1 = useRef<THREE.Mesh>(null!);
  const r2 = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (r0.current) r0.current.rotation.z = t * 0.38;
    if (r1.current) r1.current.rotation.x = t * 0.27;
    if (r2.current) r2.current.rotation.y = t * 0.22;
  });

  return (
    <>
      {([
        { ref: r0, r: 1.45, opacity: 0.13 },
        { ref: r1, r: 1.85, opacity: 0.08 },
        { ref: r2, r: 2.25, opacity: 0.05 },
      ] as { ref: React.RefObject<THREE.Mesh>; r: number; opacity: number }[]).map(({ ref, r, opacity }, i) => (
        <mesh key={i} ref={ref}>
          <torusGeometry args={[r, 0.007, 4, 80]} />
          <meshBasicMaterial color={emotion.eyeHex} transparent opacity={opacity} />
        </mesh>
      ))}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROCEDURAL FACE — full micro-behavior + expression system (no GLB needed)
// ═══════════════════════════════════════════════════════════════════════════════
function ProceduralFace({
  mode,
  emotion,
  visemes,
}: {
  mode: AIEmotionState;
  emotion: ApexEmotion;
  visemes: Visemes;
}) {
  // Refs
  const groupRef    = useRef<THREE.Group>(null!);
  const headRef     = useRef<THREE.Mesh>(null!);
  const eyeLRef     = useRef<THREE.Mesh>(null!);
  const eyeRRef     = useRef<THREE.Mesh>(null!);
  const pupilLRef   = useRef<THREE.Mesh>(null!);
  const pupilRRef   = useRef<THREE.Mesh>(null!);
  const lidLRef     = useRef<THREE.Mesh>(null!);
  const lidRRef     = useRef<THREE.Mesh>(null!);
  const browLRef    = useRef<THREE.Mesh>(null!);
  const browRRef    = useRef<THREE.Mesh>(null!);
  const jawRef      = useRef<THREE.Mesh>(null!);
  const coreRef     = useRef<THREE.Mesh>(null!);
  const mouthLRef   = useRef<THREE.Mesh>(null!);
  const mouthRRef   = useRef<THREE.Mesh>(null!);

  // Micro-behavior state
  const saccadeTarget = useRef({ x: 0, y: 0 });
  const saccadeTimer  = useRef(1.5 + Math.random() * 2);
  const blinkTimer    = useRef(2.5 + Math.random() * 3.5);
  const blinkProg     = useRef(0);
  const thoughtDelay  = useRef(0);
  const prevMode      = useRef<AIEmotionState>("idle");
  const speakReady    = useRef(true);

  // Materials
  const headMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: 0x080610, roughness: 0.22, metalness: 0.78, envMapIntensity: 1.4,
  }), []);

  const eyeMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: emotion.eyeHex, emissive: emotion.eyeHex, emissiveIntensity: 2.8,
    roughness: 0, metalness: 0,
  }), [emotion.eyeHex]);

  const pupilMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: 0x000000, roughness: 0.1, metalness: 0.4,
  }), []);

  const browMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: emotion.eyeHex, emissive: emotion.eyeHex, emissiveIntensity: 0.6,
    transparent: true, opacity: 0.55, roughness: 0.2, metalness: 0,
  }), [emotion.eyeHex]);

  const mouthMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: emotion.eyeHex, emissive: emotion.eyeHex, emissiveIntensity: 1.5,
    roughness: 0.1, metalness: 0, transparent: true, opacity: 0.85,
  }), [emotion.eyeHex]);

  const coreMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: emotion.coreHex, emissive: emotion.coreHex, emissiveIntensity: 3.2,
    roughness: 0, metalness: 0, transparent: true, opacity: 0.9,
  }), [emotion.coreHex]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const speed = emotion.speed;

    // ── Thought delay gate ──────────────────────────────────────────────────
    if (prevMode.current !== mode) {
      if (mode === "responding" || mode === "active") {
        thoughtDelay.current = 0.3 + Math.random() * 0.5;
        speakReady.current = false;
      } else {
        speakReady.current = true;
      }
      prevMode.current = mode;
    }
    if (thoughtDelay.current > 0) {
      thoughtDelay.current -= delta;
      if (thoughtDelay.current <= 0) speakReady.current = true;
    }

    if (!groupRef.current) return;

    // ── Breathing (head scale) ──────────────────────────────────────────────
    if (headRef.current) {
      headRef.current.scale.y = 1 + Math.sin(t * 1.5) * 0.008;
      headRef.current.scale.x = 1 - Math.sin(t * 1.5) * 0.003;
    }

    // ── Idle float + body movement ──────────────────────────────────────────
    groupRef.current.position.y = Math.sin(t * 1.2 * speed) * 0.03;

    // ── Head tilt per state ─────────────────────────────────────────────────
    let targetRX = 0, targetRY = 0;
    if (mode === "thinking") {
      targetRX = 0.055 + Math.sin(t * 0.8) * 0.018;
      targetRY = -0.07 + Math.sin(t * 0.5) * 0.012;
    } else if (mode === "listening") {
      targetRX = -0.035;
      targetRY = Math.sin(t * 0.45) * 0.045;
    } else if (mode === "responding" && speakReady.current) {
      targetRX = Math.sin(t * 1.7) * 0.022;
      targetRY = Math.sin(t * 0.85) * 0.028;
    } else if (mode === "active") {
      targetRX = Math.sin(t * 2.1) * 0.03;
      targetRY = Math.cos(t * 1.2) * 0.025;
    }
    groupRef.current.rotation.x = lerp(groupRef.current.rotation.x, targetRX, delta * 3.5);
    groupRef.current.rotation.y = lerp(groupRef.current.rotation.y, targetRY, delta * 3.5);

    // ── Eye saccades (random micro-movement) ────────────────────────────────
    saccadeTimer.current -= delta;
    if (saccadeTimer.current <= 0) {
      saccadeTimer.current = 1.3 + Math.random() * 2.8;
      // Listening/active: wider saccade range; thinking: minimal (downward focus)
      const range = mode === "thinking" ? 0.02 : mode === "listening" ? 0.06 : 0.04;
      saccadeTarget.current = {
        x: (Math.random() - 0.5) * range,
        y: (Math.random() - 0.5) * range * 0.65,
      };
    }

    const saccadeSpeed = delta * 4.5;
    if (pupilLRef.current) {
      pupilLRef.current.position.x = lerp(
        pupilLRef.current.position.x,
        -0.26 + saccadeTarget.current.x,
        saccadeSpeed,
      );
      pupilLRef.current.position.y = lerp(
        pupilLRef.current.position.y,
        0.18 + saccadeTarget.current.y,
        saccadeSpeed,
      );
    }
    if (pupilRRef.current) {
      pupilRRef.current.position.x = lerp(
        pupilRRef.current.position.x,
        0.26 + saccadeTarget.current.x,
        saccadeSpeed,
      );
      pupilRRef.current.position.y = lerp(
        pupilRRef.current.position.y,
        0.18 + saccadeTarget.current.y,
        saccadeSpeed,
      );
    }

    // ── Autonomous blink ───────────────────────────────────────────────────
    blinkTimer.current -= delta;
    if (blinkTimer.current <= 0) {
      blinkProg.current = 1;
      blinkTimer.current = 2 + Math.random() * 4;
    }
    if (blinkProg.current > 0) {
      blinkProg.current = Math.max(0, blinkProg.current - delta * 9);
      const blinkAmt = Math.sin(blinkProg.current * Math.PI);
      if (lidLRef.current) lidLRef.current.scale.y = blinkAmt;
      if (lidRRef.current) lidRRef.current.scale.y = blinkAmt;
    } else {
      if (lidLRef.current) lidLRef.current.scale.y = lerp(lidLRef.current.scale.y, 0, delta * 12);
      if (lidRRef.current) lidRRef.current.scale.y = lerp(lidRRef.current.scale.y, 0, delta * 12);
    }

    // ── Expression simulation via transforms ────────────────────────────────
    // Eye glow intensity
    const eyeGlow = 2.2 + Math.sin(t * 1.8 * speed) * 0.9;
    const eyeWideFactor = mode === "listening" || mode === "active"
      ? 1.18 : mode === "thinking" ? 0.9 : 1.0;
    const eyeSquintFactor = mode === "thinking" ? 0.72 : 1.0;

    if (eyeLRef.current?.material instanceof THREE.MeshStandardMaterial) {
      eyeLRef.current.material.emissiveIntensity = eyeGlow;
      eyeLRef.current.scale.setScalar(eyeWideFactor * eyeSquintFactor);
    }
    if (eyeRRef.current?.material instanceof THREE.MeshStandardMaterial) {
      eyeRRef.current.material.emissiveIntensity = eyeGlow;
      eyeRRef.current.scale.setScalar(eyeWideFactor * eyeSquintFactor);
    }

    // Pupil dilation
    const dilation = emotion.pupilDilation + Math.sin(t * 1.6) * 0.04;
    if (pupilLRef.current) pupilLRef.current.scale.setScalar(dilation);
    if (pupilRRef.current) pupilRRef.current.scale.setScalar(dilation);

    // Eyebrows
    if (browLRef.current && browRRef.current) {
      let browY = 0;
      if (mode === "listening" || mode === "active") browY = 0.04;
      if (mode === "thinking")                        browY = -0.03;
      if (mode === "error")                           browY = -0.05;
      browLRef.current.position.y = lerp(browLRef.current.position.y, 0.56 + browY, delta * 4);
      browRRef.current.position.y = lerp(browRRef.current.position.y, 0.56 + browY, delta * 4);

      // Thinking: inner brows converge slightly
      const browX = mode === "thinking" ? 0.01 : 0;
      browLRef.current.position.x = lerp(browLRef.current.position.x, -0.23 + browX, delta * 4);
      browRRef.current.position.x = lerp(browRRef.current.position.x,  0.23 - browX, delta * 4);
    }

    // Mouth corners (smile vs frown)
    if (mouthLRef.current && mouthRRef.current) {
      let cornerY = 0;
      if (mode === "responding" || mode === "active") cornerY =  0.025;
      if (mode === "error")                           cornerY = -0.03;
      mouthLRef.current.position.y = lerp(mouthLRef.current.position.y, -0.34 + cornerY, delta * 3);
      mouthRRef.current.position.y = lerp(mouthRRef.current.position.y, -0.34 + cornerY, delta * 3);
    }

    // Jaw / lip sync
    const jaw = speakReady.current && visemes.jawOpen > 0
      ? visemes.jawOpen
      : 0;

    if (jawRef.current) {
      const targetH = 0.022 + jaw * 0.055;
      jawRef.current.scale.y = lerp(jawRef.current.scale.y, 1 + jaw * 1.6, delta * 18);
      jawRef.current.position.y = lerp(jawRef.current.position.y, -0.35 - jaw * 0.04, delta * 18);
      if (jawRef.current.material instanceof THREE.MeshStandardMaterial) {
        jawRef.current.material.emissiveIntensity = 1.2 + jaw * 2.2;
      }
    }

    // Core pulse
    if (coreRef.current) {
      const coreGlow = 2.8 + Math.sin(t * 3 * speed) * 1.4;
      coreRef.current.scale.setScalar(0.9 + Math.sin(t * 2.3 * speed) * 0.13);
      if (coreRef.current.material instanceof THREE.MeshStandardMaterial) {
        coreRef.current.material.emissiveIntensity = coreGlow;
      }
    }
  });

  return (
    <group ref={groupRef}>

      {/* ── Head ──────────────────────────────────────────────────────── */}
      <mesh ref={headRef} material={headMat}>
        <sphereGeometry args={[0.9, 64, 64]} />
      </mesh>

      {/* ── Forehead seam ─────────────────────────────────────────────── */}
      <mesh position={[0, 0.56, 0.88]}>
        <boxGeometry args={[0.016, 0.42, 0.012]} />
        <meshStandardMaterial
          color={emotion.eyeHex} emissive={emotion.eyeHex}
          emissiveIntensity={0.35} transparent opacity={0.5}
        />
      </mesh>

      {/* ── Left eyebrow ──────────────────────────────────────────────── */}
      <mesh ref={browLRef} position={[-0.23, 0.56, 0.85]}>
        <boxGeometry args={[0.18, 0.022, 0.018]} />
        <primitive object={browMat} />
      </mesh>

      {/* ── Right eyebrow ─────────────────────────────────────────────── */}
      <mesh ref={browRRef} position={[0.23, 0.56, 0.85]}>
        <boxGeometry args={[0.18, 0.022, 0.018]} />
        <primitive object={browMat} />
      </mesh>

      {/* ── Left eye socket ───────────────────────────────────────────── */}
      <mesh ref={eyeLRef} position={[-0.26, 0.18, 0.82]} material={eyeMat}>
        <sphereGeometry args={[0.118, 32, 32]} />
      </mesh>
      {/* Left pupil */}
      <mesh ref={pupilLRef} position={[-0.26, 0.18, 0.925]} material={pupilMat}>
        <sphereGeometry args={[0.063, 16, 16]} />
      </mesh>
      {/* Left eyelid */}
      <mesh ref={lidLRef} position={[-0.26, 0.22, 0.875]} scale={[1, 0, 1]}>
        <sphereGeometry args={[0.122, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={0x080610} roughness={0.35} metalness={0.65} />
      </mesh>

      {/* ── Right eye socket ──────────────────────────────────────────── */}
      <mesh ref={eyeRRef} position={[0.26, 0.18, 0.82]} material={eyeMat}>
        <sphereGeometry args={[0.118, 32, 32]} />
      </mesh>
      {/* Right pupil */}
      <mesh ref={pupilRRef} position={[0.26, 0.18, 0.925]} material={pupilMat}>
        <sphereGeometry args={[0.063, 16, 16]} />
      </mesh>
      {/* Right eyelid */}
      <mesh ref={lidRRef} position={[0.26, 0.22, 0.875]} scale={[1, 0, 1]}>
        <sphereGeometry args={[0.122, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={0x080610} roughness={0.35} metalness={0.65} />
      </mesh>

      {/* ── Nose bridge ───────────────────────────────────────────────── */}
      <mesh position={[0, 0.04, 0.885]}>
        <boxGeometry args={[0.024, 0.19, 0.028]} />
        <meshStandardMaterial color={0x100d1e} roughness={0.28} metalness={0.82} />
      </mesh>

      {/* ── Mouth left corner ─────────────────────────────────────────── */}
      <mesh ref={mouthLRef} position={[-0.08, -0.34, 0.84]}>
        <sphereGeometry args={[0.018, 8, 8]} />
        <primitive object={mouthMat} />
      </mesh>
      {/* ── Mouth right corner ────────────────────────────────────────── */}
      <mesh ref={mouthRRef} position={[0.08, -0.34, 0.84]}>
        <sphereGeometry args={[0.018, 8, 8]} />
        <primitive object={mouthMat} />
      </mesh>
      {/* ── Jaw bar (lip sync) ────────────────────────────────────────── */}
      <mesh ref={jawRef} position={[0, -0.35, 0.842]} material={mouthMat}>
        <boxGeometry args={[0.21, 0.022, 0.01]} />
      </mesh>

      {/* ── Chin accent ───────────────────────────────────────────────── */}
      <mesh position={[0, -0.63, 0.64]}>
        <boxGeometry args={[0.16, 0.006, 0.006]} />
        <meshStandardMaterial
          color={emotion.eyeHex} emissive={emotion.eyeHex}
          emissiveIntensity={0.28} transparent opacity={0.38}
        />
      </mesh>

      {/* ── Neck ──────────────────────────────────────────────────────── */}
      <mesh position={[0, -1.1, 0]}>
        <cylinderGeometry args={[0.27, 0.32, 0.46, 32]} />
        <meshStandardMaterial color={0x060510} roughness={0.28} metalness={0.72} />
      </mesh>

      {/* ── Chest core glow ───────────────────────────────────────────── */}
      <mesh ref={coreRef} position={[0, -1.56, 0]}>
        <sphereGeometry args={[0.17, 32, 32]} />
        <primitive object={coreMat} />
      </mesh>

      {/* ── Dynamic lights ────────────────────────────────────────────── */}
      <pointLight position={[0, 0.25, 1.45]} color={emotion.eyeHex}
        intensity={emotion.glowIntensity * 0.9} distance={3} decay={2} />
      <pointLight position={[0, -1.56, 0.3]} color={emotion.coreHex}
        intensity={emotion.glowIntensity * 1.3} distance={2.5} decay={2} />
      <pointLight position={[-0.5, 0.18, 1.2]} color={emotion.eyeHex}
        intensity={0.55} distance={1} decay={2} />
      <pointLight position={[0.5, 0.18, 1.2]} color={emotion.eyeHex}
        intensity={0.55} distance={1} decay={2} />
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// APEX MODEL — router: GLB (when available) or procedural
// ═══════════════════════════════════════════════════════════════════════════════
interface ApexModelProps {
  mode: AIEmotionState;
  emotion: ApexEmotion;
  visemes: Visemes;
  useGlb?: boolean;
}

export function ApexModel({ mode, emotion, visemes, useGlb = false }: ApexModelProps) {
  if (useGlb) {
    return (
      <>
        <GLBModel mode={mode} emotion={emotion} visemes={visemes} />
        <Particles emotion={emotion} />
        <HoloRings emotion={emotion} />
      </>
    );
  }
  return (
    <>
      <ProceduralFace mode={mode} emotion={emotion} visemes={visemes} />
      <Particles emotion={emotion} />
      <HoloRings emotion={emotion} />
    </>
  );
}
