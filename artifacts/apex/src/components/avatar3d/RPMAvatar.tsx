import { useRef, useEffect, useState } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { AvatarState } from '@/hooks/useAvatarStore';

export const RPM_URL = 'https://models.readyplayer.me/64f1a8d9c3c2a1e5b3b2c123.glb';

interface RPMAvatarProps {
  avatarState: AvatarState;
  isThinking: boolean;
  emotion: string;
}

// Bone name aliases — RPM uses either Mixamo or RPM convention depending on export
function getBone(bones: Record<string, THREE.Bone>, ...names: string[]): THREE.Bone | null {
  for (const n of names) {
    if (bones[n]) return bones[n];
  }
  return null;
}

export function RPMAvatar({ avatarState, isThinking, emotion }: RPMAvatarProps) {
  const { scene } = useGLTF(RPM_URL);
  const bonesRef = useRef<Record<string, THREE.Bone>>({});
  const tRef = useRef(0);
  const cloneRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    if (!scene) return;

    // Clone scene so the cached original isn't mutated
    const clone = scene.clone(true);
    cloneRef.current = clone;

    // Extract all bones
    const bones: Record<string, THREE.Bone> = {};
    clone.traverse((node) => {
      if ((node as THREE.Bone).isBone || node instanceof THREE.Bone) {
        bones[node.name] = node as THREE.Bone;
      }
    });
    bonesRef.current = bones;

    // Ensure materials receive shadows
    clone.traverse((node) => {
      if (node instanceof THREE.SkinnedMesh || node instanceof THREE.Mesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        if (Array.isArray(node.material)) {
          node.material.forEach((m) => { (m as THREE.MeshStandardMaterial).needsUpdate = true; });
        }
      }
    });
  }, [scene]);

  useFrame((_, delta) => {
    tRef.current += delta;
    const t = tRef.current;
    const b = bonesRef.current;

    // ── Helper: smooth set rotation ──
    const set = (bone: THREE.Bone | null, x = 0, y = 0, z = 0) => {
      if (!bone) return;
      bone.rotation.x += (x - bone.rotation.x) * 0.18;
      bone.rotation.y += (y - bone.rotation.y) * 0.18;
      bone.rotation.z += (z - bone.rotation.z) * 0.18;
    };

    // ── Bone references ──
    const hips       = getBone(b, 'Hips', 'mixamorigHips', 'hips');
    const spine      = getBone(b, 'Spine', 'Spine1', 'mixamorigSpine', 'spine');
    const spine2     = getBone(b, 'Spine2', 'mixamorigSpine2', 'spine2');
    const neck       = getBone(b, 'Neck', 'mixamorigNeck', 'neck');
    const head       = getBone(b, 'Head', 'mixamorigHead', 'head');
    const leftUpLeg  = getBone(b, 'LeftUpLeg', 'mixamorigLeftUpLeg', 'LeftThigh');
    const rightUpLeg = getBone(b, 'RightUpLeg', 'mixamorigRightUpLeg', 'RightThigh');
    const leftLeg    = getBone(b, 'LeftLeg', 'mixamorigLeftLeg', 'LeftShin');
    const rightLeg   = getBone(b, 'RightLeg', 'mixamorigRightLeg', 'RightShin');
    const leftFoot   = getBone(b, 'LeftFoot', 'mixamorigLeftFoot');
    const rightFoot  = getBone(b, 'RightFoot', 'mixamorigRightFoot');
    const leftArm    = getBone(b, 'LeftArm', 'mixamorigLeftArm', 'LeftUpperArm');
    const rightArm   = getBone(b, 'RightArm', 'mixamorigRightArm', 'RightUpperArm');
    const leftForeArm  = getBone(b, 'LeftForeArm', 'mixamorigLeftForeArm', 'LeftLowerArm');
    const rightForeArm = getBone(b, 'RightForeArm', 'mixamorigRightForeArm', 'RightLowerArm');
    const leftHand   = getBone(b, 'LeftHand', 'mixamorigLeftHand');
    const rightHand  = getBone(b, 'RightHand', 'mixamorigRightHand');
    const leftShoulder  = getBone(b, 'LeftShoulder', 'mixamorigLeftShoulder');
    const rightShoulder = getBone(b, 'RightShoulder', 'mixamorigRightShoulder');

    if (avatarState === 'idle') {
      // Gentle breathing and subtle idle sway
      const breathX = Math.sin(t * 0.9) * 0.018;
      set(spine,  breathX, 0, 0);
      set(spine2, breathX * 0.6, 0, 0);
      set(head,   0, Math.sin(t * 0.35) * 0.05, Math.sin(t * 0.28) * 0.03);
      set(neck,   0, 0, 0);
      set(hips,   0, 0, 0);
      set(leftArm,  0, 0,  0.06);
      set(rightArm, 0, 0, -0.06);
      set(leftForeArm,  0.1, 0, 0);
      set(rightForeArm, 0.1, 0, 0);
      set(leftUpLeg,  0, 0, 0);
      set(rightUpLeg, 0, 0, 0);
      set(leftLeg,  0.06, 0, 0);
      set(rightLeg, 0.06, 0, 0);
      set(leftFoot,  -0.1, 0, 0);
      set(rightFoot, -0.1, 0, 0);

    } else if (avatarState === 'walking') {
      const w = Math.sin(t * 4.5);
      const kneeBend = Math.max(0, -w);
      set(hips,   0, w * 0.08, Math.sin(t * 4.5 * 2) * 0.04);
      set(spine,  0.06, 0, 0);
      set(head,   0, 0, 0);
      set(leftUpLeg,   w * 0.45,  0, 0.04);
      set(rightUpLeg, -w * 0.45,  0, -0.04);
      set(leftLeg,    Math.max(0,  w) * 0.55, 0, 0);
      set(rightLeg,   Math.max(0, -w) * 0.55, 0, 0);
      set(leftFoot,   -kneeBend * 0.3 - 0.08, 0, 0);
      set(rightFoot,   kneeBend * 0.3 - 0.08, 0, 0);
      // Arms swing opposite to legs
      set(leftArm,  -w * 0.3, 0,  0.08);
      set(rightArm,  w * 0.3, 0, -0.08);
      set(leftForeArm,  0.12, 0, 0);
      set(rightForeArm, 0.12, 0, 0);

    } else if (avatarState === 'waving') {
      // Right arm raised and waving, rest of body gently idle
      const wOsc = Math.sin(t * 5);
      set(hips,  0, 0, 0);
      set(spine, Math.sin(t * 0.8) * 0.015, 0, 0);
      set(head,  0, Math.sin(t * 0.4) * 0.05, 0);
      set(leftArm,  0, 0, 0.08);
      set(leftForeArm, 0.12, 0, 0);
      // Right arm raised
      set(rightShoulder, 0, 0, -0.15);
      set(rightArm,  0.2, 0.1, -1.3);
      set(rightForeArm, -0.1, wOsc * 0.45, 0.1);
      set(rightHand, 0, 0, wOsc * 0.35);
      set(leftUpLeg, 0, 0, 0);
      set(rightUpLeg, 0, 0, 0);
      set(leftLeg,  0.05, 0, 0);
      set(rightLeg, 0.05, 0, 0);

    } else if (avatarState === 'dancing') {
      const d = Math.sin(t * 5);
      const d2 = Math.sin(t * 5 + Math.PI);
      // Hip bounce
      set(hips,  Math.abs(Math.sin(t * 5)) * 0.06, d * 0.2, Math.sin(t * 5 * 2) * 0.08);
      set(spine,  0, 0, d * 0.1);
      set(spine2, 0, 0, d * -0.08);
      set(head,  0, d * 0.12, 0);
      // Arms pumping
      set(leftShoulder,  0, 0, 0.1);
      set(rightShoulder, 0, 0, -0.1);
      set(leftArm,  -0.4 + d * 0.3, 0,  0.9 + d2 * 0.2);
      set(rightArm, -0.4 + d2 * 0.3, 0, -0.9 - d * 0.2);
      set(leftForeArm,  0.3 + d * 0.3, d * 0.3, 0);
      set(rightForeArm, 0.3 + d2 * 0.3, d2 * 0.3, 0);
      // Slight leg bounce
      set(leftUpLeg,  Math.abs(d) * 0.12, 0, 0.04);
      set(rightUpLeg, Math.abs(d2) * 0.12, 0, -0.04);
      set(leftLeg,  Math.abs(d) * 0.15, 0, 0);
      set(rightLeg, Math.abs(d2) * 0.15, 0, 0);
    }

    // Thinking — tilt head forward-right regardless of state
    if (isThinking) {
      if (head) {
        head.rotation.x += (0.15 - head.rotation.x) * 0.12;
        head.rotation.z += (-0.1 - head.rotation.z) * 0.12;
      }
    }
  });

  if (!cloneRef.current && scene) {
    // First render before useEffect fires — use the raw scene
    return <primitive object={scene} position={[0, -0.92, 0]} />;
  }

  return cloneRef.current
    ? <primitive object={cloneRef.current} position={[0, -0.92, 0]} />
    : null;
}

useGLTF.preload(RPM_URL);
