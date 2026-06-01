import { Suspense, useState, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { ApexModel } from "./ApexModel";
import { getApexEmotion } from "./apexEmotionController";
import { type AIEmotionState } from "./apexEmotionEngine";
import { useSimulatedLipSync, type Visemes } from "@/hooks/useVoiceLipSync";

interface ApexSceneProps {
  mode: AIEmotionState;
  height?: number | string;
  allowOrbit?: boolean;
}

function SceneContent({ mode }: { mode: AIEmotionState }) {
  const [visemes, setVisemes] = useState<Visemes>({ jawOpen: 0, volume: 0 });
  const emotion = getApexEmotion(mode);

  const isSpeaking = mode === "responding" || mode === "active";
  const setVisemesCb = useCallback((v: Visemes) => setVisemes(v), []);

  useSimulatedLipSync(isSpeaking, setVisemesCb);

  return (
    <>
      {/* Ambient base */}
      <ambientLight intensity={0.07} />

      {/* Key light — slight warm top-front */}
      <directionalLight position={[1.5, 3, 2]} intensity={0.35} color="#ffffffee" />

      {/* Rim light from behind for depth */}
      <pointLight
        position={[0, 0.5, -3]}
        color={emotion.eyeColor}
        intensity={emotion.glowIntensity * 0.25}
        distance={7}
        decay={2}
      />

      {/* Subtle blue top fill */}
      <pointLight position={[0, 4.5, 0.5]} color="#6688ff" intensity={0.2} distance={9} decay={2} />

      <Suspense fallback={null}>
        <ApexModel
          mode={mode}
          emotion={emotion}
          visemes={visemes}
          useGlb={false}
        />
      </Suspense>
    </>
  );
}

export function ApexScene({
  mode,
  height = 320,
  allowOrbit = true,
}: ApexSceneProps) {
  return (
    <div
      style={{
        width: "100%",
        height,
        position: "relative",
        borderRadius: 24,
        overflow: "hidden",
      }}
    >
      <Canvas
        camera={{ position: [0, -0.15, 3.1], fov: 44 }}
        gl={{
          alpha: true,
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.25,
        }}
        style={{ background: "transparent" }}
        shadows={false}
      >
        <SceneContent mode={mode} />
        {allowOrbit && (
          <OrbitControls
            enableZoom={false}
            enablePan={false}
            minPolarAngle={Math.PI * 0.28}
            maxPolarAngle={Math.PI * 0.72}
            rotateSpeed={0.35}
            autoRotate={false}
          />
        )}
      </Canvas>
    </div>
  );
}
