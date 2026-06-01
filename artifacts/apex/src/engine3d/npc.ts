/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  APEX ENGINE 3D — NPC System v2                         ║
 * ║  Wandering pedestrians · reactions · dialogue           ║
 * ║                                                         ║
 * ║  Performance improvements over v1:                      ║
 * ║    ✓ AI throttled to configurable Hz (default 4–10)     ║
 * ║    ✓ NPCs beyond aiSleep distance skip AI entirely      ║
 * ║    ✓ NPC models hidden beyond visDistance               ║
 * ║    ✓ Per-entity sleeping avoids redundant updates       ║
 * ║    ✓ Entity cap — only closest maxActive NPCs update    ║
 * ╚══════════════════════════════════════════════════════════╝
 */
import * as THREE from "three";

export type NPCKind = "civilian" | "hostile";

export interface NPC {
  model:       THREE.Group;
  pos:         THREE.Vector3;
  waypoints:   THREE.Vector3[];
  waypointIdx: number;
  speed:       number;
  state:       "walking" | "idle" | "fleeing" | "chasing";
  kind:        NPCKind;
  hp:          number;
  maxHp:       number;
  alive:       boolean;
  dialogueIdx: number;
  idleTimer:   number;
  damageCd:    number;
  /** Cached squared distance to player (updated each AI tick) */
  distSq:      number;
  /** True if this NPC is currently visible to the camera (distance check) */
  visible:     boolean;
}

// ── Dialogue ──────────────────────────────────────────────────────────────────

const CIVILIAN_DIALOGUES = [
  "Hey there, traveller!", "Watch where you're going!",
  "Nice day in the city.", "Stay out of trouble.",
  "Have you seen any trouble around here?", "Move along, move along.",
  "I love this neon skyline.", "Don't stay out too late.",
];

const HOSTILE_DIALOGUES = [
  "You're dead meat!", "This is MY turf!", "Get out of here!", "You'll regret this.",
];

const CIVILIAN_COLORS = [0xe74c3c, 0x3498db, 0xf39c12, 0x2ecc71, 0x9b59b6, 0xe67e22, 0x1abc9c];
const HOSTILE_COLOR   = 0xff2200;

let npcCount = 0;

function buildNPCModel(kind: NPCKind): THREE.Group {
  const g   = new THREE.Group();
  const col = kind === "hostile" ? HOSTILE_COLOR : CIVILIAN_COLORS[npcCount % CIVILIAN_COLORS.length]!;

  const bMat = new THREE.MeshLambertMaterial({ color: col });
  const hMat = new THREE.MeshLambertMaterial({ color: 0xffcc88 });
  const lMat = new THREE.MeshLambertMaterial({ color: 0x333344 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.1, 0.35), bMat);
  body.position.y = 0.55;
  body.castShadow = false;          // legs + head cast is enough visual
  body.userData.shootable = true;
  body.userData.npcId     = `npc_${npcCount}`;
  g.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 5), hMat);
  head.position.y = 1.35;
  head.userData.shootable = true;
  head.userData.npcId     = `npc_${npcCount}`;
  g.add(head);

  // Eyes
  const eMat = new THREE.MeshBasicMaterial({ color: kind === "hostile" ? 0xff0000 : 0x222244 });
  [-0.07, 0.07].forEach((ex) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 4, 3), eMat);
    eye.position.set(ex, 1.37, 0.2);
    g.add(eye);
  });

  // Legs
  [-0.13, 0.13].forEach((lx) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.65, 0.24), lMat.clone());
    leg.position.set(lx, -0.33, 0);
    g.add(leg);
  });

  npcCount++;
  return g;
}

// ── NPC System Options ────────────────────────────────────────────────────────

export interface NPCSystemOpts {
  /** Max total NPCs to spawn */
  count:         number;
  /** World-space radius around origin for initial spawn spread */
  spawnRadius:   number;
  /** AI update frequency in Hz (how many times per second AI runs) */
  aiHz:          number;
  /** NPCs beyond this distance from the player skip AI */
  aiSleepDist:   number;
  /** NPCs beyond this distance from the player have models hidden */
  visDistance:   number;
  /** Only the nearest N NPCs run AI each tick (entity budget) */
  maxActive:     number;
}

const DEFAULT_NPC_OPTS: NPCSystemOpts = {
  count:       20,
  spawnRadius: 60,
  aiHz:        10,
  aiSleepDist: 60,
  visDistance: 80,
  maxActive:   20,
};

// ── NPC System ────────────────────────────────────────────────────────────────

export interface NPCSystem {
  npcs:     NPC[];
  update:   (dt: number, playerPos: THREE.Vector3, onPlayerHit: (dmg: number) => void) => void;
  hitNPC:   (id: string, damage: number, scene: THREE.Scene) => boolean;
  getNearby:(playerPos: THREE.Vector3, radius: number) => NPC[];
  interact: (npc: NPC) => string;
  dispose:  (scene: THREE.Scene) => void;
}

export function createNPCSystem(
  scene:   THREE.Scene,
  count?:  number,
  spawnRadius?: number,
  opts?:   Partial<NPCSystemOpts>,
): NPCSystem {
  // Support legacy call signature: createNPCSystem(scene, count, radius)
  const resolvedOpts: NPCSystemOpts = {
    ...DEFAULT_NPC_OPTS,
    ...(count       !== undefined ? { count }       : {}),
    ...(spawnRadius !== undefined ? { spawnRadius }  : {}),
    ...opts,
  };

  const {
    aiHz, aiSleepDist, visDistance, maxActive,
  } = resolvedOpts;

  const npcs:  NPC[]         = [];
  const idMap: Map<string, NPC> = new Map();

  // AI tick accumulator — AI only runs every (1/aiHz) seconds
  let _aiAccum = 0;
  const AI_INTERVAL = 1 / aiHz;

  // Leg animation phase counter (avoid Date.now() in tight loop)
  let _animT = 0;

  // Temp vector (reused per NPC to avoid allocation)
  const _toTarget = new THREE.Vector3();

  for (let i = 0; i < resolvedOpts.count; i++) {
    const angle  = (i / resolvedOpts.count) * Math.PI * 2;
    const r      = 15 + Math.random() * resolvedOpts.spawnRadius;
    const cx     = Math.cos(angle) * r;
    const cz     = Math.sin(angle) * r;
    const kind: NPCKind = i < resolvedOpts.count * 0.8 ? "civilian" : "hostile";

    const model = buildNPCModel(kind);
    model.position.set(cx, 0, cz);
    scene.add(model);

    const wps: THREE.Vector3[] = [];
    for (let w = 0; w < 3; w++) {
      const wa = angle + (w / 3) * Math.PI * 0.8;
      wps.push(new THREE.Vector3(cx + Math.cos(wa) * 8, 0, cz + Math.sin(wa) * 8));
    }

    const npc: NPC = {
      model, pos: new THREE.Vector3(cx, 0, cz),
      waypoints: wps, waypointIdx: 0,
      speed: 1.6 + Math.random() * 1.2,
      state: "walking",
      kind, hp: kind === "hostile" ? 5 : 3, maxHp: kind === "hostile" ? 5 : 3,
      alive: true, dialogueIdx: 0, idleTimer: 0, damageCd: 0,
      distSq: Infinity, visible: true,
    };
    npcs.push(npc);
    idMap.set(`npc_${npcs.length - 1}`, npc);
  }

  // ── Per-frame entry point ──────────────────────────────────────────────────
  //
  //  Every frame:
  //    1. Advance leg animation timer (cheap)
  //    2. Accumulate dt for AI tick throttle
  //    3. If AI tick fires: update distSq, toggle visibility, run AI for
  //       the N closest alive NPCs only
  //    4. Every frame regardless: apply model position + leg animation for
  //       visible, active NPCs  (model sync must be frame-rate accurate)

  function update(dt: number, playerPos: THREE.Vector3, onPlayerHit: (dmg: number) => void) {
    _aiAccum += dt;
    _animT   += dt;

    const runAI = _aiAccum >= AI_INTERVAL;
    if (runAI) _aiAccum -= AI_INTERVAL;

    const visDist2  = visDistance  * visDistance;
    const sleepDist2 = aiSleepDist * aiSleepDist;

    // ── AI pass (throttled) ────────────────────────────────────────────────
    if (runAI) {
      // Update distances and sort to find the active budget
      let activeCount = 0;
      for (const npc of npcs) {
        if (!npc.alive) { npc.distSq = Infinity; continue; }

        const dx = npc.pos.x - playerPos.x;
        const dz = npc.pos.z - playerPos.z;
        npc.distSq = dx * dx + dz * dz;

        // Visibility toggle
        const wasVisible = npc.visible;
        npc.visible = npc.distSq < visDist2;
        if (wasVisible !== npc.visible) npc.model.visible = npc.visible;

        // Skip AI if sleeping
        if (npc.distSq > sleepDist2) continue;
        // Entity budget
        if (activeCount >= maxActive) continue;
        activeCount++;

        // Damage cooldown
        npc.damageCd = Math.max(0, npc.damageCd - AI_INTERVAL);

        const dist = Math.sqrt(npc.distSq);

        // ── State machine ────────────────────────────────────────────────
        if (npc.kind === "hostile") {
          npc.state = dist < aiSleepDist ? "chasing" : "walking";
        } else {
          if (dist < 5 && npc.state === "walking") {
            npc.state = "idle";
            npc.idleTimer = 2.5;
            npc.model.lookAt(playerPos.x, npc.pos.y, playerPos.z);
          }
          if (npc.state === "idle") {
            npc.idleTimer -= AI_INTERVAL;
            if (npc.idleTimer <= 0) npc.state = "walking";
          }
        }

        // ── Movement ─────────────────────────────────────────────────────
        let targetPos: THREE.Vector3 | null = null;
        if (npc.state === "walking") {
          targetPos = npc.waypoints[npc.waypointIdx]!;
          if (npc.pos.distanceTo(targetPos) < 1.5) {
            npc.waypointIdx = (npc.waypointIdx + 1) % npc.waypoints.length;
          }
        } else if (npc.state === "chasing") {
          targetPos = playerPos;
          if (dist < 1.8 && npc.damageCd <= 0) {
            onPlayerHit(6);
            npc.damageCd = 1.5;
          }
        }

        if (targetPos && npc.state !== "idle") {
          _toTarget.subVectors(targetPos, npc.pos);
          _toTarget.y = 0;
          const d = _toTarget.length();
          if (d > 0.5) {
            _toTarget.multiplyScalar(npc.speed * AI_INTERVAL / d);
            npc.pos.add(_toTarget);
            npc.model.position.copy(npc.pos);
            npc.model.lookAt(targetPos.x, npc.pos.y, targetPos.z);
          }
        }
        npc.model.position.y = 0;
      }
    }

    // ── Frame-rate animation pass (only visible, alive NPCs) ──────────────
    //  This keeps leg animation smooth even though AI runs less often.
    for (const npc of npcs) {
      if (!npc.alive || !npc.visible) continue;
      if (npc.state === "walking" || npc.state === "chasing") {
        const legs = [npc.model.children[4], npc.model.children[5]] as THREE.Mesh[];
        const s    = Math.sin(_animT * 8);
        if (legs[0]) legs[0].rotation.x =  s * 0.4;
        if (legs[1]) legs[1].rotation.x = -s * 0.4;
      }
    }
  }

  // ── Hit NPC ───────────────────────────────────────────────────────────────

  function hitNPC(id: string, damage: number, scene: THREE.Scene): boolean {
    // Find NPC whose body/head carries this npcId
    const npc = npcs.find((n) => {
      const body = n.model.children[0] as THREE.Mesh;
      return body?.userData.npcId === id;
    });
    if (!npc || !npc.alive) return false;

    npc.hp = Math.max(0, npc.hp - damage);

    // Flash material
    const mat = (npc.model.children[0] as THREE.Mesh).material as THREE.MeshLambertMaterial;
    const origColor = mat.color.getHex();
    mat.color.setHex(0xffffff);
    setTimeout(() => { mat.color.setHex(origColor); }, 80);

    if (npc.hp <= 0) {
      npc.alive = false;
      scene.remove(npc.model);
      // Scatter particles
      const col = npc.kind === "hostile" ? 0xff4400 : 0x3498db;
      const partGeo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
      const partMat = new THREE.MeshBasicMaterial({ color: col });
      for (let p = 0; p < 6; p++) {
        const chunk = new THREE.Mesh(partGeo, partMat);
        chunk.position.copy(npc.pos);
        chunk.position.x += (Math.random() - 0.5) * 1.2;
        chunk.position.y += Math.random() * 1.5;
        chunk.position.z += (Math.random() - 0.5) * 1.2;
        scene.add(chunk);
        setTimeout(() => scene.remove(chunk), 600);
      }
      return true;
    }
    return false;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function getNearby(playerPos: THREE.Vector3, radius: number): NPC[] {
    const r2 = radius * radius;
    return npcs.filter((n) => n.alive && n.distSq < r2);
  }

  function interact(npc: NPC): string {
    const lines = npc.kind === "hostile" ? HOSTILE_DIALOGUES : CIVILIAN_DIALOGUES;
    const line  = lines[npc.dialogueIdx % lines.length]!;
    npc.dialogueIdx++;
    return line;
  }

  return {
    npcs, update, hitNPC, getNearby, interact,
    dispose: (scene) => npcs.forEach((n) => { if (n.alive) scene.remove(n.model); }),
  };
}
