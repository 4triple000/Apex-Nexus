/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  APEX ENGINE 3D — Scene Setup                           ║
 * ║  Three.js scene · renderer · camera · lighting          ║
 * ╚══════════════════════════════════════════════════════════╝
 */
import * as THREE from "three";

export interface EngineScene {
  scene:    THREE.Scene;
  renderer: THREE.WebGLRenderer;
  camera:   THREE.PerspectiveCamera;
  dispose:  () => void;
}

export function createScene(canvas: HTMLCanvasElement): EngineScene {
  // ── Scene ──────────────────────────────────────────────────────────────────
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070a14);
  scene.fog = new THREE.FogExp2(0x070a14, 0.018);

  // ── Renderer ───────────────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  // ── Camera ─────────────────────────────────────────────────────────────────
  const camera = new THREE.PerspectiveCamera(
    75,
    canvas.clientWidth / canvas.clientHeight,
    0.05,
    200,
  );
  camera.position.set(0, 1.7, 0);

  // ── Ambient light ──────────────────────────────────────────────────────────
  const ambient = new THREE.AmbientLight(0x2a2a4a, 0.8);
  scene.add(ambient);

  // ── Directional (sun) light ────────────────────────────────────────────────
  const dir = new THREE.DirectionalLight(0xffffff, 1.2);
  dir.position.set(15, 30, 15);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  dir.shadow.camera.near = 0.5;
  dir.shadow.camera.far = 120;
  dir.shadow.camera.left = -40;
  dir.shadow.camera.right = 40;
  dir.shadow.camera.top = 40;
  dir.shadow.camera.bottom = -40;
  dir.shadow.bias = -0.001;
  scene.add(dir);

  // ── Neon accent point lights ───────────────────────────────────────────────
  const purple = new THREE.PointLight(0x6c5ce7, 3, 35);
  purple.position.set(-12, 5, -12);
  scene.add(purple);

  const pink = new THREE.PointLight(0xfd79a8, 2.5, 28);
  pink.position.set(14, 5, 12);
  scene.add(pink);

  const teal = new THREE.PointLight(0x00cec9, 2, 25);
  teal.position.set(0, 5, -18);
  scene.add(teal);

  // ── Resize handler ─────────────────────────────────────────────────────────
  const onResize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  window.addEventListener("resize", onResize);

  return {
    scene,
    renderer,
    camera,
    dispose: () => {
      window.removeEventListener("resize", onResize);
      renderer.dispose();
    },
  };
}
