import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface CinematicLightingProps {
  personality: 'hood' | 'professional' | 'bigbro';
  isThinking: boolean;
}

// GTA V-style 3-point cinematic lighting
export function CinematicLighting({ personality, isThinking }: CinematicLightingProps) {
  const rimRef = useRef<THREE.PointLight>(null);

  // Per-personality color temperature
  const keyColor   = personality === 'professional' ? '#ffe8c8' : personality === 'bigbro' ? '#ffd4a0' : '#ffcc88';
  const fillColor  = '#a8c4e8';
  const rimColor   = personality === 'hood' ? '#5588ff' : personality === 'bigbro' ? '#ff6633' : '#88aaff';

  useFrame((_, delta) => {
    if (!rimRef.current) return;
    // Subtle rim light flicker when thinking
    if (isThinking) {
      rimRef.current.intensity = 1.6 + Math.sin(Date.now() * 0.004) * 0.4;
    } else {
      rimRef.current.intensity += (1.4 - rimRef.current.intensity) * delta * 3;
    }
  });

  return (
    <>
      {/* Ambient - low for cinematic contrast */}
      <ambientLight intensity={0.22} color="#2a2a3a" />

      {/* Key light - warm, top-right, strong */}
      <directionalLight
        position={[2.5, 4.0, 3.0]}
        intensity={2.8}
        color={keyColor}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={12}
      />

      {/* Fill light - cool, left, softer */}
      <directionalLight
        position={[-2.0, 2.5, 1.5]}
        intensity={0.7}
        color={fillColor}
      />

      {/* Rim / separation light - from behind, punchy */}
      <pointLight
        ref={rimRef}
        position={[0.4, 1.8, -2.8]}
        intensity={1.4}
        color={rimColor}
        distance={6}
        decay={2}
      />

      {/* Under fill - very subtle warm bounce */}
      <pointLight
        position={[0, -1.2, 1.5]}
        intensity={0.18}
        color="#ff9966"
        distance={4}
        decay={2}
      />

      {/* Screen glow if thinking */}
      {isThinking && (
        <pointLight
          position={[0, 1.5, 1.8]}
          intensity={0.5}
          color="#4488ff"
          distance={3}
          decay={2}
        />
      )}
    </>
  );
}
