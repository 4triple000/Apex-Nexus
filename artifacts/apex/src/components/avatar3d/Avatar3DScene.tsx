import { Suspense, Component, ReactNode, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { AvatarAppearance } from '@/hooks/useAvatarStore';
import { AvatarState } from '@/hooks/useAvatarStore';
import { Emotion } from '@/lib/emotionController';
import { RPMAvatar, RPM_URL } from './RPMAvatar';

interface Avatar3DSceneProps {
  appearance?: AvatarAppearance;
  emotion: Emotion;
  isThinking: boolean;
  personality: string;
  expanded?: boolean;
  fullBody?: boolean;
  avatarState?: AvatarState;
}

// ── WebGL availability check ─────────────────────────────────
function checkWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const ctx =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl');
    if (!ctx) return false;
    (ctx as WebGLRenderingContext).getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

// ── React error boundary ─────────────────────────────────────
interface EBState { hasError: boolean }
class WebGLErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, EBState> {
  state: EBState = { hasError: false };
  static getDerivedStateFromError(): EBState { return { hasError: true }; }
  componentDidCatch() {}
  render() { return this.state.hasError ? this.props.fallback : this.props.children; }
}

// ── Avatar box shown when WebGL is unavailable ────────────────
function NoWebGLPlaceholder() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-4 px-4">
      {/* Human silhouette icon */}
      <svg viewBox="0 0 64 120" width="72" fill="none" style={{ opacity: 0.35 }}>
        <circle cx="32" cy="14" r="12" fill="#A29BFE" />
        <path d="M16 36 Q20 28 32 28 Q44 28 48 36 L52 68 H40 L38 100 H26 L24 68 H12 Z"
              fill="#A29BFE" />
        <path d="M12 40 L4 70 M52 40 L60 70" stroke="#A29BFE" strokeWidth="6"
              strokeLinecap="round" />
      </svg>

      <div className="text-center space-y-1">
        <p className="text-[12px] font-mono font-bold tracking-wider uppercase"
           style={{ color: '#A29BFE' }}>
          Ready Player Me
        </p>
        <p className="text-[10px] font-mono text-white/40 leading-relaxed">
          3D avatar renders in the<br />
          published / deployed app
        </p>
      </div>

      <div
        className="px-3 py-1.5 rounded-lg text-[9px] font-mono text-center break-all"
        style={{ background: 'rgba(162,155,254,0.06)', border: '1px solid rgba(162,155,254,0.15)', color: 'rgba(162,155,254,0.55)', maxWidth: 260 }}
      >
        {RPM_URL}
      </div>
    </div>
  );
}

// ── Loading spinner ───────────────────────────────────────────
function LoadingFallback() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3">
      <div
        className="w-10 h-10 rounded-full border-2 animate-spin"
        style={{ borderColor: 'rgba(162,155,254,0.25)', borderTopColor: '#A29BFE' }}
      />
      <p className="text-[10px] font-mono tracking-widest uppercase"
         style={{ color: 'rgba(162,155,254,0.4)' }}>
        Loading Model…
      </p>
    </div>
  );
}

// ── Three.js scene (only mounted when WebGL confirmed) ────────
function RPMScene({ avatarState, isThinking, emotion, fullBody }: {
  avatarState: AvatarState;
  isThinking: boolean;
  emotion: Emotion;
  fullBody?: boolean;
}) {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 0.85, 2.4], fov: fullBody ? 52 : 44, near: 0.1, far: 20 }}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: 'default',
        failIfMajorPerformanceCaveat: false,
      }}
      style={{ width: '100%', height: '100%', background: 'transparent' }}
      dpr={[1, 1.5]}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[-2, 3.5, 2]} intensity={1.4} color="#fff8e8" castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[3, 1.5, -2]} intensity={0.9} color="#A29BFE" />
      <pointLight position={[-3, 1, 1]} intensity={0.5} color="#8899ff" />
      <pointLight position={[0, -0.5, 1.5]} intensity={0.25} color="#ffeecc" />

      <Environment preset="city" />

      <mesh position={[0, -0.91, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[0.65, 40]} />
        <meshStandardMaterial color="#000" transparent opacity={0.35} roughness={1} />
      </mesh>

      <Suspense fallback={null}>
        <RPMAvatar avatarState={avatarState} isThinking={isThinking} emotion={emotion} />
      </Suspense>

      {fullBody && (
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 1.8}
          minAzimuthAngle={-Math.PI / 4}
          maxAzimuthAngle={Math.PI / 4}
          target={[0, 0.1, 0]}
        />
      )}
    </Canvas>
  );
}

// ── Public export ─────────────────────────────────────────────
export function Avatar3DScene({
  emotion,
  isThinking,
  avatarState = 'idle',
  fullBody,
}: Avatar3DSceneProps) {
  const [webglOk, setWebglOk] = useState<boolean | null>(null);

  useEffect(() => {
    setWebglOk(checkWebGL());
  }, []);

  // Still detecting
  if (webglOk === null) return <LoadingFallback />;

  // No WebGL available (dev sandbox / older device)
  if (!webglOk) return <NoWebGLPlaceholder />;

  // WebGL available — render 3D scene
  return (
    <WebGLErrorBoundary fallback={<NoWebGLPlaceholder />}>
      <Suspense fallback={<LoadingFallback />}>
        <RPMScene
          avatarState={avatarState}
          isThinking={isThinking}
          emotion={emotion}
          fullBody={fullBody}
        />
      </Suspense>
    </WebGLErrorBoundary>
  );
}
