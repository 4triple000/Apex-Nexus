// ── Minimal 3D software renderer (no WebGL) ───────────────────
// Painter's algorithm, Phong shading, perspective projection

export interface Vec3 { x: number; y: number; z: number }
export interface RGB  { r: number; g: number; b: number }

export interface Tri {
  v: [Vec3, Vec3, Vec3]; // world-space verts
  color: RGB;            // base diffuse color
  roughness?: number;    // 0=specular, 1=diffuse (default 0.8)
  emissive?: RGB;        // additive emission
}

// ── Lights ───────────────────────────────────────────────────
export interface DirLight { dir: Vec3; color: RGB; intensity: number }
export interface PointLight { pos: Vec3; color: RGB; intensity: number }
export interface Scene {
  ambientColor: RGB;
  ambientIntensity: number;
  dirLights: DirLight[];
  pointLights: PointLight[];
}

// ── Math helpers ──────────────────────────────────────────────
export function v3(x: number, y: number, z: number): Vec3 { return { x, y, z } }
export function vadd(a: Vec3, b: Vec3): Vec3 { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z } }
export function vsub(a: Vec3, b: Vec3): Vec3 { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z } }
export function vscale(a: Vec3, s: number): Vec3 { return { x: a.x * s, y: a.y * s, z: a.z * s } }
export function vdot(a: Vec3, b: Vec3): number { return a.x * b.x + a.y * b.y + a.z * b.z }
export function vcross(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }
}
export function vlen(a: Vec3): number { return Math.sqrt(vdot(a, a)) }
export function vnorm(a: Vec3): Vec3 { const l = vlen(a) || 1; return vscale(a, 1 / l) }
export function vmix(a: RGB, b: RGB, t: number): RGB {
  return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t }
}
export function vclamp(a: RGB): RGB {
  return { r: Math.min(255, Math.max(0, a.r)), g: Math.min(255, Math.max(0, a.g)), b: Math.min(255, Math.max(0, a.b)) }
}
export function rgbStyle(c: RGB, a = 1): string {
  return `rgba(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)},${a})`
}
export function cscale(c: RGB, s: number): RGB { return { r: c.r * s, g: c.g * s, b: c.b * s } }
export function cadd(a: RGB, b: RGB): RGB { return { r: a.r + b.r, g: a.g + b.g, b: a.b + b.b } }

// ── Triangle normal ───────────────────────────────────────────
export function triNormal(v: [Vec3, Vec3, Vec3]): Vec3 {
  return vnorm(vcross(vsub(v[1], v[0]), vsub(v[2], v[0])))
}

// ── Face centroid ─────────────────────────────────────────────
export function triCentroid(v: [Vec3, Vec3, Vec3]): Vec3 {
  return { x: (v[0].x + v[1].x + v[2].x) / 3, y: (v[0].y + v[1].y + v[2].y) / 3, z: (v[0].z + v[1].z + v[2].z) / 3 }
}

// ── Phong lighting ────────────────────────────────────────────
export function computeLight(
  normal: Vec3,
  centroid: Vec3,
  base: RGB,
  roughness: number,
  scene: Scene,
  viewDir: Vec3
): RGB {
  // Ambient
  let r = scene.ambientColor.r * scene.ambientIntensity * (base.r / 255);
  let g = scene.ambientColor.g * scene.ambientIntensity * (base.g / 255);
  let b = scene.ambientColor.b * scene.ambientIntensity * (base.b / 255);

  const specPow = Math.max(1, (1 - roughness) * 60);

  for (const l of scene.dirLights) {
    const ld  = vnorm(vscale(l.dir, -1)); // direction toward light
    const diff = Math.max(0, vdot(normal, ld));
    const refl = vsub(vscale(normal, 2 * vdot(normal, ld)), ld);
    const spec = roughness < 0.95 ? Math.pow(Math.max(0, vdot(refl, viewDir)), specPow) * (1 - roughness) * 0.6 : 0;
    const lt = diff + spec;
    r += (l.color.r / 255) * l.intensity * lt * base.r;
    g += (l.color.g / 255) * l.intensity * lt * base.g;
    b += (l.color.b / 255) * l.intensity * lt * base.b;
  }

  for (const l of scene.pointLights) {
    const toLight = vsub(l.pos, centroid);
    const dist    = vlen(toLight);
    const ld      = vscale(toLight, 1 / (dist || 1));
    const atten   = l.intensity / (1 + dist * dist * 0.4);
    const diff    = Math.max(0, vdot(normal, ld));
    const refl    = vsub(vscale(normal, 2 * vdot(normal, ld)), ld);
    const spec    = roughness < 0.95 ? Math.pow(Math.max(0, vdot(refl, viewDir)), specPow) * (1 - roughness) * 0.5 : 0;
    const lt = diff + spec;
    r += (l.color.r / 255) * atten * lt * base.r;
    g += (l.color.g / 255) * atten * lt * base.g;
    b += (l.color.b / 255) * atten * lt * base.b;
  }

  return vclamp({ r, g, b });
}

// ── Perspective project ───────────────────────────────────────
// Camera at camZ (negative), objects at z≈0 are in front.
// d is POSITIVE (depth divisor). +worldX → right, +worldY → up on screen.
export function project(v: Vec3, camZ: number, fovScale: number, cx: number, cy: number): [number, number, number] {
  const zd = v.z - camZ; // positive for objects in front of camera
  const d  = fovScale / (zd + 0.001); // positive
  return [cx + v.x * d, cy - v.y * d, zd];
}

// ── Rasterize sorted triangle list ────────────────────────────
export function render(
  ctx: CanvasRenderingContext2D,
  tris: Tri[],
  scene: Scene,
  cx: number,
  cy: number,
  canvasW: number,
  canvasH: number,
  camZ = -4,
  fov = 42
) {
  const fovScale = (canvasW * 0.5) / Math.tan((fov * Math.PI) / 360);
  const viewDir  = vnorm(v3(0, 0, -1));

  // Project & shade each tri
  interface ProjTri {
    pts: [number, number][];
    depth: number;
    color: RGB;
    alpha: number;
  }

  const projected: ProjTri[] = [];

  for (const tri of tris) {
    const n  = triNormal(tri.v);
    const c  = triCentroid(tri.v);

    // Backface cull: camera is at negative-z, faces with +z normals face the camera.
    // Skip tris that face strongly away (n.z strongly positive means pointing away from cam).
    // We keep a loose threshold so sides/edges stay visible.
    if (n.z > 0.92) continue;

    const lit = computeLight(n, c, tri.color, tri.roughness ?? 0.8, scene, viewDir);
    const finalColor: RGB = tri.emissive ? cadd(lit, tri.emissive) : lit;

    const p0 = project(tri.v[0], camZ, fovScale, cx, cy);
    const p1 = project(tri.v[1], camZ, fovScale, cx, cy);
    const p2 = project(tri.v[2], camZ, fovScale, cx, cy);
    const depth = (p0[2] + p1[2] + p2[2]) / 3;

    projected.push({
      pts: [[p0[0], p0[1]], [p1[0], p1[1]], [p2[0], p2[1]]],
      depth,
      color: vclamp(finalColor),
      alpha: 1,
    });
  }

  // Painter's sort (far to near)
  projected.sort((a, b) => b.depth - a.depth);

  for (const t of projected) {
    ctx.fillStyle = rgbStyle(t.color);
    ctx.beginPath();
    ctx.moveTo(t.pts[0][0], t.pts[0][1]);
    ctx.lineTo(t.pts[1][0], t.pts[1][1]);
    ctx.lineTo(t.pts[2][0], t.pts[2][1]);
    ctx.closePath();
    ctx.fill();
  }
}
