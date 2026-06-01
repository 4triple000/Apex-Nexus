import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  getEmotionFromAIState,
  getZeroWeights,
  type AIEmotionState,
  type EmotionWeights,
} from "@/components/apex/apexEmotionEngine";
import { type Visemes } from "./useVoiceLipSync";

type GLBNodes = Record<string, THREE.Mesh>;

// ─── Lerp helper ──────────────────────────────────────────────────────────────
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function setMorphKey(
  mesh: THREE.Mesh | undefined,
  key: string,
  value: number,
  lerpSpeed: number,
  delta: number,
) {
  if (!mesh?.morphTargetDictionary || !mesh?.morphTargetInfluences) return;
  const idx = mesh.morphTargetDictionary[key];
  if (idx === undefined) return;
  mesh.morphTargetInfluences[idx] = lerp(
    mesh.morphTargetInfluences[idx],
    value,
    lerpSpeed * delta * 60,
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// useApexFace — drives GLB morphTargets + micro-behaviors
// ═══════════════════════════════════════════════════════════════════════════════
export function useApexFace(
  nodes: GLBNodes,
  mode: AIEmotionState,
  visemes: Visemes,
  groupRef?: React.RefObject<THREE.Group>,
) {
  // Thought delay before speaking starts
  const thoughtDelayRef = useRef(0);
  const prevModeRef     = useRef<AIEmotionState>("idle");
  const isSpeakingRef   = useRef(false);

  // Eye saccade targets
  const saccadeTarget = useRef({ x: 0, y: 0 });
  const saccadeTimer  = useRef(0);

  // Blink timer
  const blinkTimer    = useRef(2 + Math.random() * 3);
  const blinkProgress = useRef(0);

  useFrame((state, delta) => {
    const faceMesh = nodes.Face as THREE.Mesh | undefined;
    const headMesh = nodes.Head as THREE.Mesh | undefined;
    const eyesMesh = nodes.Eyes as THREE.Mesh | undefined;
    const t = state.clock.elapsedTime;

    // ── Thought delay gate ────────────────────────────────────────────────────
    if (prevModeRef.current !== mode) {
      if (mode === "responding" || mode === "active") {
        thoughtDelayRef.current = 0.3 + Math.random() * 0.5;
        isSpeakingRef.current = false;
      } else {
        isSpeakingRef.current = true;
      }
      prevModeRef.current = mode;
    }

    if (thoughtDelayRef.current > 0) {
      thoughtDelayRef.current -= delta;
      if (thoughtDelayRef.current <= 0) {
        isSpeakingRef.current = true;
      }
    }

    // ── Emotion weights → morphTargets ────────────────────────────────────────
    const emotion = getEmotionFromAIState(mode);
    const zero    = getZeroWeights();

    // Reset all to zero target, then apply emotion weights
    const targets: EmotionWeights = { ...zero, ...emotion };
    Object.entries(targets).forEach(([key, value]) => {
      // Skip jaw — handled by lip sync below
      if (key === "jawOpen") return;
      setMorphKey(faceMesh, key, value ?? 0, 0.08, delta);
    });

    // ── Lip sync override (mouth always wins during speech) ───────────────────
    const jawValue =
      isSpeakingRef.current && visemes.jawOpen > 0
        ? visemes.jawOpen
        : 0;
    setMorphKey(faceMesh, "jawOpen", jawValue, 0.2, delta);

    // ── Autonomous blink ──────────────────────────────────────────────────────
    blinkTimer.current -= delta;
    if (blinkTimer.current <= 0) {
      blinkProgress.current = 1;
      blinkTimer.current = 2.5 + Math.random() * 4;
    }
    if (blinkProgress.current > 0) {
      blinkProgress.current = Math.max(0, blinkProgress.current - delta * 8);
      const blinkVal = Math.sin(blinkProgress.current * Math.PI);
      setMorphKey(faceMesh, "blinkLeft",  blinkVal, 1, delta);
      setMorphKey(faceMesh, "blinkRight", blinkVal, 1, delta);
    }

    // ── Eye saccades (micro-movement to prevent "dead mannequin") ────────────
    saccadeTimer.current -= delta;
    if (saccadeTimer.current <= 0) {
      saccadeTimer.current = 1.2 + Math.random() * 2.5;
      // Tiny random offset — 0.5–2° in radians
      saccadeTarget.current = {
        x: (Math.random() - 0.5) * 0.055,
        y: (Math.random() - 0.5) * 0.035,
      };
    }

    if (eyesMesh) {
      eyesMesh.rotation.x = lerp(
        eyesMesh.rotation.x,
        saccadeTarget.current.y,
        delta * 4,
      );
      eyesMesh.rotation.y = lerp(
        eyesMesh.rotation.y,
        saccadeTarget.current.x,
        delta * 4,
      );
    }

    // ── Breathing ─────────────────────────────────────────────────────────────
    if (headMesh) {
      headMesh.scale.y = 1 + Math.sin(t * 1.5) * 0.008;
      headMesh.scale.x = 1 - Math.sin(t * 1.5) * 0.003;
    }

    // ── Head micro-tilt (state-driven) ────────────────────────────────────────
    const headGroup = groupRef?.current;
    if (headGroup) {
      let targetTiltX = 0;
      let targetTiltY = 0;

      if (mode === "thinking") {
        targetTiltX = 0.06 + Math.sin(t * 0.8) * 0.02;
        targetTiltY = -0.08;
      } else if (mode === "listening") {
        targetTiltX = -0.04;
        targetTiltY = Math.sin(t * 0.5) * 0.04;
      } else if (mode === "responding" && isSpeakingRef.current) {
        targetTiltX = Math.sin(t * 1.8) * 0.025;
        targetTiltY = Math.sin(t * 0.9) * 0.03;
      }

      headGroup.rotation.x = lerp(headGroup.rotation.x, targetTiltX, delta * 3);
      headGroup.rotation.y = lerp(headGroup.rotation.y, targetTiltY, delta * 3);
    }
  });
}
