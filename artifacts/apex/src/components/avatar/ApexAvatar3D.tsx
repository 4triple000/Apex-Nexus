import { useRef, useMemo, useEffect, useState, Component, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { type Gesture } from "@/lib/emotionController";

// ── WebGL support detection ──────────────────────────────────────────────────
function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

// ── Error boundary to catch R3F crashes ─────────────────────────────────────
interface EBState { hasError: boolean }
class CanvasErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, EBState> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

// ── 2D CSS fallback avatar (when WebGL unavailable) ──────────────────────────
const FALLBACK_COLORS: Record<string, string> = {
  neutral:   "#6C5CE7",
  thinking:  "#4834D4",
  happy:     "#F59E0B",
  excited:   "#EC4899",
  speaking:  "#8B5CF6",
  concerned: "#F97316",
  serious:   "#6366F1",
  intense:   "#EF4444",
};

function AvatarFallback2D({ emotion, isSpeaking, isThinking, amplitude, size, gesture }: {
  emotion: string; isSpeaking: boolean; isThinking: boolean; amplitude: number; size: number; gesture?: Gesture;
}) {
  const color = FALLBACK_COLORS[emotion] ?? FALLBACK_COLORS.neutral;
  const mouthOpen = isSpeaking ? `${6 + amplitude * 10}px` : "4px";

  const gestureTransform =
    gesture === "tilt-right" ? "rotate(8deg)" :
    gesture === "tilt-left"  ? "rotate(-8deg)" :
    "none";

  return (
    <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          width: size * 0.62,
          height: size * 0.62,
          borderRadius: "50%",
          background: `radial-gradient(circle at 38% 35%, ${color}cc, ${color}66)`,
          boxShadow: `0 0 ${isSpeaking ? 40 : 24}px ${color}88, 0 0 60px ${color}33`,
          position: "relative",
          animation: isThinking
            ? "avatar-breathe 0.8s ease-in-out infinite"
            : "avatar-breathe 2.8s ease-in-out infinite",
          transform: gestureTransform,
          transition: "box-shadow 0.2s ease, transform 0.3s cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        <div style={{ position: "absolute", top: "34%", left: "26%", display: "flex", gap: "28%" }}>
          {[0, 1].map((i) => (
            <div
              key={i}
              style={{
                width: size * 0.095,
                height: size * 0.095,
                borderRadius: "50%",
                background: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div style={{
                width: size * 0.055,
                height: size * 0.055,
                borderRadius: "50%",
                background: "#111",
                transform: "translate(1px, 1px)",
              }} />
            </div>
          ))}
        </div>
        <div style={{
          position: "absolute",
          bottom: "25%",
          left: "50%",
          transform: "translateX(-50%)",
          width: size * 0.22,
          height: mouthOpen,
          borderRadius: 99,
          background: "rgba(255,255,255,0.85)",
          transition: "height 0.1s ease",
        }} />
      </div>
    </div>
  );
}

type EmotionKey = "neutral" | "thinking" | "happy" | "excited" | "speaking" | "concerned" | "serious" | "intense";

const PALETTE: Record<EmotionKey, { core: string; glow: string; ring: string; rim: string }> = {
  neutral:   { core: "#6C5CE7", glow: "#A29BFE", ring: "#8B5CF6", rim: "#C4B5FD" },
  thinking:  { core: "#4834D4", glow: "#6655FF", ring: "#5B21B6", rim: "#818CF8" },
  happy:     { core: "#F59E0B", glow: "#FCD34D", ring: "#D97706", rim: "#FDE68A" },
  excited:   { core: "#EC4899", glow: "#F9A8D4", ring: "#DB2777", rim: "#FBCFE8" },
  speaking:  { core: "#8B5CF6", glow: "#C4B5FD", ring: "#7C3AED", rim: "#DDD6FE" },
  concerned: { core: "#F97316", glow: "#FDBA74", ring: "#EA580C", rim: "#FED7AA" },
  serious:   { core: "#6366F1", glow: "#A5B4FC", ring: "#4338CA", rim: "#C7D2FE" },
  intense:   { core: "#EF4444", glow: "#FCA5A5", ring: "#DC2626", rim: "#FECACA" },
};

function resolveEmotion(e: string): EmotionKey {
  return (e in PALETTE) ? e as EmotionKey : "neutral";
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function DynamicLight({ color, isSpeaking, amplitude }: { color: string; isSpeaking: boolean; amplitude: number }) {
  const ref = useRef<THREE.PointLight>(null!);
  useFrame(() => {
    if (!ref.current) return;
    const target = isSpeaking ? 0.6 + amplitude * 1.2 : 0.25;
    ref.current.intensity = lerp(ref.current.intensity, target, 0.18);
  });
  return <pointLight ref={ref} position={[0, 0, 1.8]} intensity={0.25} color={color} />;
}

function CoreOrb({ emotion, isSpeaking, amplitude, isThinking }: {
  emotion: string; isSpeaking: boolean; amplitude: number; isThinking: boolean;
}) {
  const coreRef = useRef<THREE.Mesh>(null!);
  const glowRef = useRef<THREE.Mesh>(null!);
  const matRef = useRef<THREE.MeshStandardMaterial>(null!);
  const pal = PALETTE[resolveEmotion(emotion)];

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (!coreRef.current) return;
    const breathRate = isThinking ? 4.2 : isSpeaking ? 2.8 : 1.6;
    const breathAmt = isThinking ? 0.07 : isSpeaking ? 0.03 + amplitude * 0.09 : 0.025;
    coreRef.current.scale.setScalar(1 + Math.sin(t * breathRate) * breathAmt);
    coreRef.current.rotation.y = Math.sin(t * (isThinking ? 0.9 : 0.3)) * 0.13;
    coreRef.current.rotation.x = Math.sin(t * 0.48) * 0.07;

    if (matRef.current) {
      const target = isSpeaking
        ? 0.65 + amplitude * 0.65
        : isThinking
        ? 0.38 + Math.abs(Math.sin(t * 3.2)) * 0.22
        : 0.50;
      matRef.current.emissiveIntensity = lerp(matRef.current.emissiveIntensity, target, 0.16);
    }

    if (glowRef.current) {
      const gs = 1 + Math.sin(t * 1.9) * 0.055 + (isSpeaking ? amplitude * 0.14 : 0);
      glowRef.current.scale.setScalar(gs);
    }
  });

  return (
    <group>
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.86, 32, 32]} />
        <meshBasicMaterial color={pal.glow} transparent opacity={0.055} side={THREE.BackSide} />
      </mesh>
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.52, 64, 64]} />
        <meshStandardMaterial
          ref={matRef}
          color={pal.core}
          emissive={pal.core}
          emissiveIntensity={0.50}
          roughness={0.12}
          metalness={0.45}
        />
      </mesh>
    </group>
  );
}

function EyePair({ blink }: { blink: boolean }) {
  const leftRef = useRef<THREE.Group>(null!);
  const rightRef = useRef<THREE.Group>(null!);
  const eyeScaleY = blink ? 0.06 : 1;

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const ex = Math.sin(t * 0.65) * 0.018;
    const ey = Math.sin(t * 0.42) * 0.012;
    if (leftRef.current)  leftRef.current.position.set(-0.18 + ex, 0.13 + ey, 0.44);
    if (rightRef.current) rightRef.current.position.set( 0.18 + ex, 0.13 + ey, 0.44);
  });

  return (
    <>
      <group ref={leftRef} position={[-0.18, 0.13, 0.44]}>
        <mesh scale={[1, eyeScaleY, 1]}>
          <sphereGeometry args={[0.072, 16, 16]} />
          <meshBasicMaterial color="#FFFFFF" />
        </mesh>
        {!blink && (
          <mesh position={[0.014, -0.01, 0.048]}>
            <sphereGeometry args={[0.048, 12, 12]} />
            <meshBasicMaterial color="#080808" />
          </mesh>
        )}
      </group>
      <group ref={rightRef} position={[0.18, 0.13, 0.44]}>
        <mesh scale={[1, eyeScaleY, 1]}>
          <sphereGeometry args={[0.072, 16, 16]} />
          <meshBasicMaterial color="#FFFFFF" />
        </mesh>
        {!blink && (
          <mesh position={[0.014, -0.01, 0.048]}>
            <sphereGeometry args={[0.048, 12, 12]} />
            <meshBasicMaterial color="#080808" />
          </mesh>
        )}
      </group>
    </>
  );
}

function Mouth({ amplitude, isSpeaking, isThinking }: {
  amplitude: number; isSpeaking: boolean; isThinking: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const innerRef = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (!groupRef.current) return;
    const target = isSpeaking ? amplitude * 0.14 : 0;
    const currentY = groupRef.current.scale.y;
    groupRef.current.scale.y = lerp(currentY, 1 + target * 4, 0.3);
    groupRef.current.scale.x = lerp(groupRef.current.scale.x, 1 + target * 0.4, 0.3);

    if (isThinking && innerRef.current) {
      innerRef.current.rotation.z = t * 1.5;
    }
  });

  return (
    <group ref={groupRef} position={[0, -0.215, 0.44]}>
      <mesh rotation={[0, 0, Math.PI]}>
        <torusGeometry args={[0.105, 0.018, 8, 24, Math.PI]} />
        <meshBasicMaterial color="rgba(255,255,255,0.88)" />
      </mesh>
      {isThinking && (
        <mesh ref={innerRef} position={[0, 0, 0.005]}>
          <torusGeometry args={[0.055, 0.01, 6, 16]} />
          <meshBasicMaterial color="rgba(162,155,254,0.60)" />
        </mesh>
      )}
    </group>
  );
}

function OrbitalRing({ emotion, isSpeaking, isThinking }: {
  emotion: string; isSpeaking: boolean; isThinking: boolean;
}) {
  const ringRef = useRef<THREE.Mesh>(null!);
  const ring2Ref = useRef<THREE.Mesh>(null!);
  const pal = PALETTE[resolveEmotion(emotion)];

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const speed = isSpeaking ? 2.0 : isThinking ? 1.4 : 0.55;
    if (ringRef.current) {
      ringRef.current.rotation.y = t * speed;
      ringRef.current.rotation.x = Math.sin(t * 0.28) * 0.42 + 0.55;
      ringRef.current.rotation.z = Math.sin(t * 0.20) * 0.14;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.y = -t * speed * 0.65;
      ring2Ref.current.rotation.x = Math.cos(t * 0.22) * 0.35 + 0.3;
      ring2Ref.current.rotation.z = Math.sin(t * 0.15) * 0.22;
    }
  });

  return (
    <>
      <mesh ref={ringRef}>
        <torusGeometry args={[0.86, 0.018, 8, 64]} />
        <meshBasicMaterial color={pal.ring} transparent opacity={0.68} />
      </mesh>
      <mesh ref={ring2Ref}>
        <torusGeometry args={[0.70, 0.010, 8, 48]} />
        <meshBasicMaterial color={pal.rim} transparent opacity={0.35} />
      </mesh>
    </>
  );
}

function FloatingParticles({ emotion, isSpeaking, isThinking }: {
  emotion: string; isSpeaking: boolean; isThinking: boolean;
}) {
  const pal = PALETTE[resolveEmotion(emotion)];
  const refs = useRef<(THREE.Mesh | null)[]>([]);

  const particles = useMemo(() =>
    Array.from({ length: 18 }, (_, i) => ({
      phi: (i / 18) * Math.PI * 2,
      theta: Math.acos(2 * (i / 18) - 1),
      radius: 0.88 + (i % 3) * 0.18,
      speed: 0.22 + (i % 5) * 0.08,
      size: 0.010 + (i % 4) * 0.006,
      offset: (i * 0.618) * Math.PI * 2,
    })),
  []);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const speedMult = isSpeaking ? 2.2 : isThinking ? 1.5 : 1.0;
    particles.forEach((p, i) => {
      const mesh = refs.current[i];
      if (!mesh) return;
      const angle = t * p.speed * speedMult + p.offset;
      const r = p.radius + Math.sin(t * 0.55 + p.offset) * 0.07;
      mesh.position.set(
        Math.sin(angle) * Math.cos(p.theta) * r,
        Math.cos(angle) * r * 0.52,
        Math.sin(angle) * Math.sin(p.theta) * r,
      );
    });
  });

  return (
    <>
      {particles.map((p, i) => (
        <mesh key={i} ref={(el) => { refs.current[i] = el; }}>
          <sphereGeometry args={[p.size, 4, 4]} />
          <meshBasicMaterial color={pal.glow} transparent opacity={0.72} />
        </mesh>
      ))}
    </>
  );
}

function ThinkingRipple({ isThinking }: { isThinking: boolean }) {
  const ref = useRef<THREE.Mesh>(null!);
  const matRef = useRef<THREE.MeshBasicMaterial>(null!);

  useFrame((state) => {
    if (!ref.current || !isThinking || !matRef.current) return;
    const t = state.clock.getElapsedTime();
    const s = 1 + ((t * 0.8) % 1) * 0.9;
    ref.current.scale.setScalar(s);
    matRef.current.opacity = (1 - ((t * 0.8) % 1)) * 0.18;
  });

  if (!isThinking) return null;

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.65, 24, 24]} />
      <meshBasicMaterial ref={matRef} color="#6C5CE7" transparent opacity={0.18} side={THREE.BackSide} />
    </mesh>
  );
}

// ── Gesture physics wrapper ──────────────────────────────────────────────────
function GestureGroup({ gesture, children }: { gesture: Gesture; children: ReactNode }) {
  const groupRef  = useRef<THREE.Group>(null!);
  const nodPhase  = useRef(0);
  const tiltZ     = useRef(0);
  const idlePhase = useRef(0);
  const prevGesture = useRef<Gesture>("none");

  useEffect(() => {
    if (gesture !== prevGesture.current) {
      prevGesture.current = gesture;
      if (gesture === "nod") nodPhase.current = 0;
    }
  }, [gesture]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // ── Nod animation: damped sine along Y ─────────────────────────────────
    if (gesture === "nod") {
      nodPhase.current = Math.min(nodPhase.current + delta * 7, Math.PI * 2.5);
      groupRef.current.position.y = Math.sin(nodPhase.current) * -0.10;
    } else {
      groupRef.current.position.y = lerp(groupRef.current.position.y, 0, delta * 6);
    }

    // ── Tilt animation: spring toward target Z rotation ─────────────────────
    const tiltTarget =
      gesture === "tilt-right" ? -0.22 :
      gesture === "tilt-left"  ?  0.22 : 0;
    tiltZ.current = lerp(tiltZ.current, tiltTarget, delta * 5);

    // ── Idle micro-sway: very subtle continuous sway ─────────────────────────
    idlePhase.current += delta * 0.35;
    const idleSway = Math.sin(idlePhase.current) * 0.022;

    groupRef.current.rotation.z = tiltZ.current + idleSway;
  });

  return <group ref={groupRef}>{children}</group>;
}

// ── Main scene ───────────────────────────────────────────────────────────────
function AvatarScene({ emotion, isSpeaking, amplitude, isThinking, gesture }: {
  emotion: string; isSpeaking: boolean; amplitude: number; isThinking: boolean; gesture: Gesture;
}) {
  const [blink, setBlink] = useState(false);
  const pal = PALETTE[resolveEmotion(emotion)];

  // Normal random blink (fast, 100–130 ms)
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const scheduleBlink = () => {
      const delay = 2500 + Math.random() * 2000;
      timeout = setTimeout(() => {
        setBlink(true);
        setTimeout(() => { setBlink(false); scheduleBlink(); }, 120);
      }, delay);
    };
    scheduleBlink();
    return () => clearTimeout(timeout);
  }, []);

  // Slow blink for "concerned" gesture (400 ms close)
  useEffect(() => {
    if (gesture !== "blink-slow") return;
    setBlink(true);
    const t = setTimeout(() => setBlink(false), 420);
    return () => clearTimeout(t);
  }, [gesture]);

  return (
    <>
      <ambientLight intensity={0.32} />
      <pointLight position={[2.5, 2.0, 2.0]} intensity={1.9} color={pal.glow} />
      <pointLight position={[-2.0, -1.5, 1.0]} intensity={0.85} color="#FD79A8" />
      <DynamicLight color={pal.core} isSpeaking={isSpeaking} amplitude={amplitude} />

      <GestureGroup gesture={gesture}>
        <ThinkingRipple isThinking={isThinking} />
        <CoreOrb emotion={emotion} isSpeaking={isSpeaking} amplitude={amplitude} isThinking={isThinking} />
        <EyePair blink={blink} />
        <Mouth amplitude={amplitude} isSpeaking={isSpeaking} isThinking={isThinking} />
        <OrbitalRing emotion={emotion} isSpeaking={isSpeaking} isThinking={isThinking} />
        <FloatingParticles emotion={emotion} isSpeaking={isSpeaking} isThinking={isThinking} />
      </GestureGroup>
    </>
  );
}

interface ApexAvatar3DProps {
  emotion?: string;
  isSpeaking?: boolean;
  amplitude?: number;
  isThinking?: boolean;
  size?: number;
  gesture?: Gesture;
}

export function ApexAvatar3D({
  emotion = "neutral",
  isSpeaking = false,
  amplitude = 0,
  isThinking = false,
  size = 200,
  gesture = "none",
}: ApexAvatar3DProps) {
  const [webglOk, setWebglOk] = useState<boolean | null>(null);

  useEffect(() => {
    setWebglOk(isWebGLAvailable());
  }, []);

  const fallback = (
    <AvatarFallback2D
      emotion={emotion}
      isSpeaking={isSpeaking}
      isThinking={isThinking}
      amplitude={amplitude}
      size={size}
      gesture={gesture}
    />
  );

  if (webglOk === null) return fallback;
  if (!webglOk) return fallback;

  return (
    <CanvasErrorBoundary fallback={fallback}>
      <Canvas
        camera={{ position: [0, 0, 2.4], fov: 48 }}
        style={{ width: size, height: size, background: "transparent" }}
        gl={{ alpha: true, antialias: true }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
        }}
      >
        <AvatarScene
          emotion={emotion}
          isSpeaking={isSpeaking}
          amplitude={amplitude}
          isThinking={isThinking}
          gesture={gesture}
        />
      </Canvas>
    </CanvasErrorBoundary>
  );
}
