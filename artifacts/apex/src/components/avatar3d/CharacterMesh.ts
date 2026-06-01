// ── Character mesh builder ────────────────────────────────────
// Returns lists of triangles describing a GTA-style character bust
import { Tri, Vec3, RGB, v3 } from './SoftwareRenderer';

function hex2rgb(hex: string): RGB {
  const h = hex.replace('#', '').padEnd(6, '0');
  return { r: parseInt(h.slice(0,2), 16)||0, g: parseInt(h.slice(2,4), 16)||0, b: parseInt(h.slice(4,6), 16)||0 };
}
function scale(c: RGB, f: number): RGB {
  return { r: Math.min(255, c.r * f), g: Math.min(255, c.g * f), b: Math.min(255, c.b * f) };
}

// ── Primitive builders ─────────────────────────────────────────
function uvSphere(
  cx: number, cy: number, cz: number,
  rx: number, ry: number, rz: number,
  color: RGB, roughness: number,
  segsLon = 14, segsLat = 10,
  latStart = 0, latEnd = Math.PI,
  lonStart = 0, lonEnd = Math.PI * 2,
  transform?: (v: Vec3) => Vec3
): Tri[] {
  const tris: Tri[] = [];
  for (let i = 0; i < segsLat; i++) {
    for (let j = 0; j < segsLon; j++) {
      const phi0   = latStart + (i / segsLat) * (latEnd - latStart);
      const phi1   = latStart + ((i + 1) / segsLat) * (latEnd - latStart);
      const theta0 = lonStart + (j / segsLon) * (lonEnd - lonStart);
      const theta1 = lonStart + ((j + 1) / segsLon) * (lonEnd - lonStart);

      const makeV = (phi: number, theta: number): Vec3 => {
        let v: Vec3 = {
          x: cx + rx * Math.sin(phi) * Math.cos(theta),
          y: cy + ry * Math.cos(phi),
          z: cz + rz * Math.sin(phi) * Math.sin(theta),
        };
        if (transform) v = transform(v);
        return v;
      };

      const v00 = makeV(phi0, theta0);
      const v01 = makeV(phi0, theta1);
      const v10 = makeV(phi1, theta0);
      const v11 = makeV(phi1, theta1);

      tris.push({ v: [v00, v10, v11], color, roughness });
      tris.push({ v: [v00, v11, v01], color, roughness });
    }
  }
  return tris;
}

function box(
  cx: number, cy: number, cz: number,
  w: number, h: number, d: number,
  color: RGB, roughness: number,
  transform?: (v: Vec3) => Vec3
): Tri[] {
  const hw = w / 2, hh = h / 2, hd = d / 2;
  const vs: [number, number, number][] = [
    [cx-hw, cy-hh, cz-hd], [cx+hw, cy-hh, cz-hd],
    [cx+hw, cy+hh, cz-hd], [cx-hw, cy+hh, cz-hd],
    [cx-hw, cy-hh, cz+hd], [cx+hw, cy-hh, cz+hd],
    [cx+hw, cy+hh, cz+hd], [cx-hw, cy+hh, cz+hd],
  ].map(([x, y, z]) => {
    const v = v3(x, y, z);
    return transform ? transform(v) : v;
  }) as any;

  const faces: [number, number, number, number][] = [
    [0,1,2,3], // back
    [5,4,7,6], // front
    [1,5,6,2], // right
    [4,0,3,7], // left
    [3,2,6,7], // top
    [0,4,5,1], // bottom
  ];

  const tris: Tri[] = [];
  for (const [a,b,c,d] of faces) {
    tris.push({ v: [vs[a],vs[b],vs[c]], color, roughness });
    tris.push({ v: [vs[a],vs[c],vs[d]], color, roughness });
  }
  return tris;
}

function cylinder(
  x0: number, y0: number, z0: number,
  x1: number, y1: number, z1: number,
  r0: number, r1: number,
  color: RGB, roughness: number,
  segs = 10
): Tri[] {
  const tris: Tri[] = [];
  const ax = x1 - x0, ay = y1 - y0, az = z1 - z0;
  const len = Math.sqrt(ax*ax + ay*ay + az*az) || 1;
  const ux = ax/len, uy = ay/len, uz = az/len;

  // Build perpendicular vectors
  let px = 0, py = 1, pz = 0;
  if (Math.abs(uy) > 0.9) { px = 1; py = 0; pz = 0; }
  const qx = uy*pz - uz*py, qy = uz*px - ux*pz, qz = ux*py - uy*px;
  const ql = Math.sqrt(qx*qx + qy*qy + qz*qz) || 1;
  const bx = qx/ql, by = qy/ql, bz = qz/ql;
  const ex = uy*bz - uz*by, ey = uz*bx - ux*bz, ez = ux*by - uy*bx;

  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2;
    const a1 = ((i + 1) / segs) * Math.PI * 2;
    const c0 = Math.cos(a0), s0 = Math.sin(a0);
    const c1 = Math.cos(a1), s1 = Math.sin(a1);

    const b0x = x0 + r0*(c0*bx + s0*ex), b0y = y0 + r0*(c0*by + s0*ey), b0z = z0 + r0*(c0*bz + s0*ez);
    const b1x = x0 + r0*(c1*bx + s1*ex), b1y = y0 + r0*(c1*by + s1*ey), b1z = z0 + r0*(c1*bz + s1*ez);
    const t0x = x1 + r1*(c0*bx + s0*ex), t0y = y1 + r1*(c0*by + s0*ey), t0z = z1 + r1*(c0*bz + s0*ez);
    const t1x = x1 + r1*(c1*bx + s1*ex), t1y = y1 + r1*(c1*by + s1*ey), t1z = z1 + r1*(c1*bz + s1*ez);

    tris.push({ v: [v3(b0x,b0y,b0z), v3(t0x,t0y,t0z), v3(t1x,t1y,t1z)], color, roughness });
    tris.push({ v: [v3(b0x,b0y,b0z), v3(t1x,t1y,t1z), v3(b1x,b1y,b1z)], color, roughness });
  }
  return tris;
}

// ── Rotation helpers ──────────────────────────────────────────
function rotX(v: Vec3, a: number): Vec3 {
  return v3(v.x, v.y*Math.cos(a) - v.z*Math.sin(a), v.y*Math.sin(a) + v.z*Math.cos(a));
}
function rotY(v: Vec3, a: number): Vec3 {
  return v3(v.x*Math.cos(a) + v.z*Math.sin(a), v.y, -v.x*Math.sin(a) + v.z*Math.cos(a));
}
function rotZ(v: Vec3, a: number): Vec3 {
  return v3(v.x*Math.cos(a) - v.y*Math.sin(a), v.x*Math.sin(a) + v.y*Math.cos(a), v.z);
}

// ── Build head with rotation ──────────────────────────────────
function makeHead(
  ry: number, rx: number, rz: number,
  skinColor: RGB, hairColor: RGB, eyeColor: RGB, hairStyle: string,
  emotion: string, browL: number, browR: number
): Tri[] {
  const tris: Tri[] = [];
  const skinDark = scale(skinColor, 0.62);
  const skinMid  = scale(skinColor, 0.85);

  const rot = (v: Vec3): Vec3 => {
    let u = v3(v.x, v.y - 1.35, v.z); // translate to head center
    u = rotX(u, rx); u = rotY(u, ry); u = rotZ(u, rz);
    return v3(u.x, u.y + 1.35, u.z);  // translate back
  };

  // ── Cranium ──
  tris.push(...uvSphere(0, 1.35, 0, 0.38, 0.43, 0.37, skinColor, 0.78, 18, 12, 0, Math.PI, 0, Math.PI*2, rot));

  // ── Jaw / lower face ──
  tris.push(...uvSphere(0, 1.12, 0.025, 0.32, 0.26, 0.32, skinColor, 0.8, 14, 8, 0, Math.PI/1.6, 0, Math.PI*2, rot));

  // ── Ears ──
  for (const sx of [-1, 1]) {
    tris.push(...uvSphere(sx*0.38, 1.34, 0.02, 0.045, 0.075, 0.04, skinDark, 0.85, 6, 5, 0, Math.PI*2, 0, Math.PI*2, rot));
  }

  // ── Eye socket recesses (darker, slightly forward-facing ellipsoids) ──
  for (const sx of [-1, 1]) {
    tris.push(...uvSphere(sx*0.13, 1.38, 0.34, 0.08, 0.065, 0.04, skinDark, 0.9, 8, 5, 0, Math.PI*2, 0, Math.PI*2, rot));
  }

  // ── Eyeballs (white sclera) ──
  for (const sx of [-1, 1]) {
    tris.push(...uvSphere(sx*0.13, 1.38, 0.35, 0.059, 0.055, 0.059, { r: 242, g: 236, b: 225 }, 0.25, 10, 8, 0, Math.PI*2, 0, Math.PI*2, rot));
  }

  // ── Iris + pupil (combined dark sphere slightly in front) ──
  for (const sx of [-1, 1]) {
    tris.push(...uvSphere(sx*0.13, 1.38, 0.39, 0.038, 0.036, 0.022, eyeColor, 0.12, 8, 6, 0, Math.PI*2, 0, Math.PI*1.4, rot));
    tris.push(...uvSphere(sx*0.13, 1.38, 0.402, 0.022, 0.022, 0.015, { r:8, g:5, b:8 }, 0.05, 6, 4, 0, Math.PI*2, 0, Math.PI*1.4, rot));
  }

  // ── Nose bridge (narrow box) ──
  tris.push(...box(0, 1.34, 0.358, 0.036, 0.1, 0.022, skinMid, 0.82, rot));
  // Nose tip
  tris.push(...uvSphere(0, 1.26, 0.378, 0.048, 0.042, 0.03, skinMid, 0.82, 8, 5, 0, Math.PI*2, 0, Math.PI*2, rot));
  // Nostrils (darker)
  tris.push(...uvSphere(-0.034, 1.25, 0.37, 0.028, 0.022, 0.02, skinDark, 0.9, 5, 4, 0, Math.PI*2, 0, Math.PI*2, rot));
  tris.push(...uvSphere( 0.034, 1.25, 0.37, 0.028, 0.022, 0.02, skinDark, 0.9, 5, 4, 0, Math.PI*2, 0, Math.PI*2, rot));

  // ── Eyebrows ──
  const lipColor = scale(skinColor, 0.64);
  const eBrowLift = (f: number) => f * 0.04;
  tris.push(...box(-0.13, 1.44 + eBrowLift(browL), 0.352, 0.11, 0.016, 0.018, hairColor, 0.9, rot));
  tris.push(...box( 0.13, 1.44 + eBrowLift(browR), 0.352, 0.11, 0.016, 0.018, hairColor, 0.9, rot));

  // ── Lips ──
  tris.push(...box(0, 1.17, 0.355, 0.13, 0.018, 0.017, lipColor, 0.65, rot)); // upper
  tris.push(...box(0, 1.152, 0.355, 0.11, 0.022, 0.019, scale(lipColor, 0.84), 0.65, rot)); // lower

  // ── Hair ──
  if (hairStyle !== 'bald') {
    if (hairStyle === 'afro') {
      tris.push(...uvSphere(0, 1.42, 0, 0.455, 0.42, 0.44, hairColor, 0.92, 16, 10, 0, Math.PI * 1.4, 0, Math.PI*2, rot));
    } else if (hairStyle === 'braids') {
      tris.push(...uvSphere(0, 1.54, -0.02, 0.39, 0.22, 0.38, hairColor, 0.9, 14, 8, 0, Math.PI, 0, Math.PI*2, rot));
      for (let i = 0; i < 5; i++) {
        const bx = -0.16 + i * 0.08;
        for (let j = 0; j < 5; j++) {
          tris.push(...uvSphere(bx, 1.45 - j*0.09, 0.04, 0.022, 0.044, 0.02, hairColor, 0.9, 5, 4, 0, Math.PI*2, 0, Math.PI*2, rot));
        }
      }
    } else if (hairStyle === 'fade') {
      tris.push(...uvSphere(0, 1.56, 0, 0.39, 0.18, 0.38, hairColor, 0.9, 14, 8, 0, Math.PI, 0, Math.PI*2, rot));
    } else {
      // waves / default
      tris.push(...uvSphere(0, 1.52, -0.01, 0.395, 0.225, 0.385, hairColor, 0.88, 14, 9, 0, Math.PI, 0, Math.PI*2, rot));
      // Wave texture bumps
      for (let i = 0; i < 4; i++) {
        tris.push(...uvSphere((i-1.5)*0.08, 1.62, -0.18, 0.04, 0.022, 0.03, scale(hairColor, 0.82), 0.92, 5, 3, 0, Math.PI*2, 0, Math.PI*2, rot));
      }
      // Sideburns
      tris.push(...uvSphere(-0.37, 1.33, 0.04, 0.055, 0.09, 0.045, hairColor, 0.9, 6, 4, 0, Math.PI*2, 0, Math.PI*2, rot));
      tris.push(...uvSphere( 0.37, 1.33, 0.04, 0.055, 0.09, 0.045, hairColor, 0.9, 6, 4, 0, Math.PI*2, 0, Math.PI*2, rot));
    }
  }

  return tris;
}

// ── Build full character ──────────────────────────────────────
export interface CharacterOptions {
  skinTone: string;
  hairStyle: string;
  hairColor: string;
  eyeColor: string;
  outfit: string;
  personality: string;
  emotion: string;
  headRotX: number;
  headRotY: number;
  headRotZ: number;
  browL: number;   // -1..1 brow lift
  browR: number;
  mouthOpen: number; // 0..1
}

export function buildCharacterMesh(opts: CharacterOptions): Tri[] {
  const skin     = hex2rgb(opts.skinTone  || '#8D5524');
  const hair     = hex2rgb(opts.hairColor || '#1a0a00');
  const eye      = hex2rgb(opts.eyeColor  || '#4a2c0a');

  const clothColorMap: Record<string, string> = {
    hoodie: '#16162a', suit: '#1c1c2c', tee: '#252535', athletic: '#0d1828', jersey: '#172244',
    bomber: '#1a2e12',
  };
  const cloth = hex2rgb(clothColorMap[opts.outfit] ?? '#16162a');
  const clothLight = scale(cloth, 1.45);
  const white = { r:220, g:220, b:230 };
  const tieRed = { r:140, g:26, b:26 };
  const skinDark = scale(skin, 0.62);

  const tris: Tri[] = [];

  // ── Torso ──
  tris.push(...box(0, 0.62, 0, 0.72, 0.88, 0.36, cloth, 0.9));
  // Shoulders (wider)
  tris.push(...box(0, 0.94, 0, 1.04, 0.22, 0.36, cloth, 0.9));

  // Upper arms
  tris.push(...cylinder(-0.52, 0.88, 0, -0.66, 0.6, 0.04, 0.105, 0.095, cloth, 0.88, 10));
  tris.push(...cylinder( 0.52, 0.88, 0,  0.66, 0.6, 0.04, 0.105, 0.095, cloth, 0.88, 10));
  // Forearms (skin)
  tris.push(...cylinder(-0.66, 0.6, 0.04, -0.72, 0.32, 0.09, 0.078, 0.072, skin, 0.78, 8));
  tris.push(...cylinder( 0.66, 0.6, 0.04,  0.72, 0.32, 0.09, 0.078, 0.072, skin, 0.78, 8));
  // Hands
  tris.push(...box(-0.74, 0.2,  0.09, 0.1, 0.13, 0.055, skin, 0.8));
  tris.push(...box( 0.74, 0.2,  0.09, 0.1, 0.13, 0.055, skin, 0.8));

  // Outfit detail
  if (opts.outfit === 'hoodie') {
    tris.push(...box(0, 1.06, -0.1, 0.52, 0.3, 0.22, cloth, 0.9));    // hood
    tris.push(...box(0, 0.34, 0.19, 0.28, 0.18, 0.004, scale(cloth, 1.3), 0.92)); // pocket
  } else if (opts.outfit === 'suit') {
    tris.push(...box(-0.09, 0.84, 0.186, 0.08, 0.26, 0.003, white, 0.75)); // lapel L
    tris.push(...box( 0.09, 0.84, 0.186, 0.08, 0.26, 0.003, white, 0.75)); // lapel R
    tris.push(...box(0, 0.62, 0.192, 0.04, 0.44, 0.002, tieRed, 0.55));    // tie
  } else if (opts.outfit === 'jersey') {
    tris.push(...box(0, 0.62, 0.186, 0.5, 0.5, 0.003, clothLight, 0.85)); // number area
  }

  // ── Legs ──
  const pantsColorMap: Record<string, string> = {
    hoodie: '#12121e', suit: '#0e0e1a', tee: '#0f0f1a', athletic: '#0a1222', jersey: '#0d1530',
    bomber: '#111820',
  };
  const pants = hex2rgb(pantsColorMap[opts.outfit] ?? '#12121e');
  const pantsLight = scale(pants, 1.5);
  const shoeBase = opts.outfit === 'athletic'
    ? { r:225, g:225, b:230 } : { r:28, g:24, b:22 };
  const shoeAccent = opts.outfit === 'athletic'
    ? { r:220, g:50, b:50 } : { r:60, g:50, b:45 };

  // Hip/waistband
  tris.push(...box(0, -0.14, 0, 0.76, 0.12, 0.34, pantsLight, 0.9));
  // Upper legs (thighs) — slightly separated
  tris.push(...box(-0.19, -0.44, 0, 0.24, 0.48, 0.26, pants, 0.88));
  tris.push(...box( 0.19, -0.44, 0, 0.24, 0.48, 0.26, pants, 0.88));
  // Lower legs (shins)
  tris.push(...box(-0.18, -0.82, 0, 0.19, 0.36, 0.22, pants, 0.88));
  tris.push(...box( 0.18, -0.82, 0, 0.19, 0.36, 0.22, pants, 0.88));
  // Shoes — extend forward (negative z after flip)
  tris.push(...box(-0.18, -1.04, 0.04, 0.22, 0.12, 0.34, shoeBase, 0.72));
  tris.push(...box( 0.18, -1.04, 0.04, 0.22, 0.12, 0.34, shoeBase, 0.72));
  // Shoe toe accent
  tris.push(...box(-0.18, -1.06, 0.19, 0.22, 0.10, 0.10, shoeAccent, 0.68));
  tris.push(...box( 0.18, -1.06, 0.19, 0.22, 0.10, 0.10, shoeAccent, 0.68));
  // Ankle / sole
  tris.push(...box(-0.18, -1.11, 0.04, 0.24, 0.04, 0.36, scale(shoeBase, 0.6), 0.82));
  tris.push(...box( 0.18, -1.11, 0.04, 0.24, 0.04, 0.36, scale(shoeBase, 0.6), 0.82));

  // ── Neck ──
  tris.push(...cylinder(0, 0.94, 0, 0, 1.22, 0, 0.102, 0.098, skin, 0.78, 12));

  // ── Head ──
  tris.push(...makeHead(
    opts.headRotY, opts.headRotX, opts.headRotZ,
    skin, hair, eye, opts.hairStyle,
    opts.emotion, opts.browL, opts.browR
  ));

  // Cheekbones
  for (const sx of [-1, 1]) {
    tris.push(...uvSphere(sx*0.27, 1.31, 0.27, 0.07, 0.055, 0.065, skin, 0.8, 6, 4, 0, Math.PI*2, 0, Math.PI*2,
      (v) => {
        let u = v3(v.x, v.y - 1.35, v.z);
        u = rotX(u, opts.headRotX); u = rotY(u, opts.headRotY); u = rotZ(u, opts.headRotZ);
        return v3(u.x, u.y + 1.35, u.z);
      }
    ));
  }

  // Flip Z so the face (positive-z) faces the camera at negative-z.
  // Swap v1↔v2 to reverse winding so normals stay outward.
  return tris.map(tri => ({
    ...tri,
    v: [
      v3(tri.v[0].x, tri.v[0].y, -tri.v[0].z),
      v3(tri.v[2].x, tri.v[2].y, -tri.v[2].z),
      v3(tri.v[1].x, tri.v[1].y, -tri.v[1].z),
    ] as [Vec3, Vec3, Vec3],
  }));
}
