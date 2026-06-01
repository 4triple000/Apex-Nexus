/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  APEX ENGINE 3D — Mission System                            ║
 * ║                                                             ║
 * ║  4 mission types: goto · eliminate · deliver · survive      ║
 * ║  State machine: idle → active → complete / fail             ║
 * ║  Dynamic spawning + 3D world markers + minimap icons        ║
 * ║  Cash rewards + score on completion                         ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
import * as THREE from "three";
import type { NPC } from "./npc";

// ── Mission Types ─────────────────────────────────────────────────────────────

export type MissionType  = "goto" | "eliminate" | "deliver" | "survive";
export type MissionPhase = "idle" | "active" | "complete" | "fail";

// ── Mission Definition ────────────────────────────────────────────────────────

export interface MissionDef {
  id:     string;
  type:   MissionType;
  title:  string;
  desc:   string;
  /** Number of objectives needed to complete */
  target: number;
  /** Cash reward on success */
  reward: number;
  /** Where the mission takes place (world position hint) */
  zone?:  THREE.Vector3;
}

// ── Mission Instance ──────────────────────────────────────────────────────────

export interface Mission {
  def:     MissionDef;
  phase:   MissionPhase;
  /** Objectives completed so far */
  progress: number;

  // ── 3D world markers (managed by MissionSystem) ──────────────────────────
  /** Goal markers (goto pillars / survive zone ring) */
  markerMeshes: THREE.Mesh[];

  // ── Deliver-specific ─────────────────────────────────────────────────────
  itemPickedUp:  boolean;
  itemMesh?:     THREE.Mesh;
  dropoffMesh?:  THREE.Mesh;
  itemPos?:      THREE.Vector3;
  dropoffPos?:   THREE.Vector3;

  // ── Survive-specific ─────────────────────────────────────────────────────
  /** Seconds elapsed while surviving */
  surviveTimer:  number;
  /** Wave number for survive-waves sub-type */
  wave:          number;
}

// ── Fixed waypoints spread across the 384×384m world ─────────────────────────

const WAYPOINTS: THREE.Vector3[] = [
  new THREE.Vector3(-60, 0, -60),
  new THREE.Vector3( 80, 0,  20),
  new THREE.Vector3(-10, 0,  90),
  new THREE.Vector3( 50, 0, -80),
  new THREE.Vector3(-90, 0,  30),
  new THREE.Vector3( 10, 0, -10),
  new THREE.Vector3( 70, 0,  70),
  new THREE.Vector3(-50, 0, -20),
];

// ── Mission Pool (static definitions) ─────────────────────────────────────────

export const MISSION_POOL: MissionDef[] = [
  // ── Goto ──────────────────────────────────────────────────────────────────
  { id: "goto_1", type: "goto", title: "City Tour",      desc: "Reach 3 marked checkpoints",   target: 3, reward: 500,  zone: WAYPOINTS[0] },
  { id: "goto_2", type: "goto", title: "Scouting Run",   desc: "Reach 2 distant waypoints",    target: 2, reward: 350,  zone: WAYPOINTS[1] },
  { id: "goto_3", type: "goto", title: "Border Patrol",  desc: "Visit 2 city outpost markers", target: 2, reward: 400,  zone: WAYPOINTS[4] },

  // ── Eliminate ─────────────────────────────────────────────────────────────
  { id: "elim_1", type: "eliminate", title: "Street Cleanup",  desc: "Eliminate 5 hostiles",        target: 5, reward: 750,  zone: WAYPOINTS[2] },
  { id: "elim_2", type: "eliminate", title: "Gang Takedown",   desc: "Take out 3 gang members",     target: 3, reward: 600,  zone: WAYPOINTS[3] },
  { id: "elim_3", type: "eliminate", title: "Hostile Purge",   desc: "Eliminate 8 hostiles",        target: 8, reward: 1000, zone: WAYPOINTS[5] },

  // ── Deliver ───────────────────────────────────────────────────────────────
  { id: "del_1",  type: "deliver",   title: "Package Run",     desc: "Pick up & deliver the package", target: 1, reward: 800,  zone: WAYPOINTS[6] },
  { id: "del_2",  type: "deliver",   title: "Hot Cargo",       desc: "Deliver the stolen goods",      target: 1, reward: 1000, zone: WAYPOINTS[7] },

  // ── Survive ───────────────────────────────────────────────────────────────
  { id: "sur_1",  type: "survive",   title: "Last Stand",      desc: "Survive 30 seconds",   target: 30, reward: 900,  zone: WAYPOINTS[2] },
  { id: "sur_2",  type: "survive",   title: "Holdout",         desc: "Survive 45 seconds",   target: 45, reward: 1100, zone: WAYPOINTS[5] },
];

// ── Marker helpers ────────────────────────────────────────────────────────────

const GEO_PILLAR = new THREE.CylinderGeometry(0.4, 0.4, 6, 8);
const GEO_HALO   = new THREE.RingGeometry(1.6, 2.4, 16);
const GEO_BOX    = new THREE.BoxGeometry(0.7, 0.7, 0.7);
const GEO_RING   = new THREE.RingGeometry(4, 5, 32);

function makePillar(pos: THREE.Vector3, color: number, scene: THREE.Scene): THREE.Mesh {
  const mat  = new THREE.MeshBasicMaterial({ color });
  const mesh = new THREE.Mesh(GEO_PILLAR, mat);
  mesh.position.set(pos.x, 3, pos.z);
  scene.add(mesh);

  const halo = new THREE.Mesh(
    GEO_HALO,
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.set(pos.x, 0.05, pos.z);
  scene.add(halo);

  // Store halo ref on mesh userData so we can remove both
  mesh.userData.halo = halo;
  return mesh;
}

function removeMarkerMesh(mesh: THREE.Mesh, scene: THREE.Scene): void {
  scene.remove(mesh);
  if (mesh.userData.halo) scene.remove(mesh.userData.halo as THREE.Mesh);
}

// ── MissionSystem ─────────────────────────────────────────────────────────────

export interface MissionEvents {
  onComplete: (mission: Mission, reward: number) => void;
  onFail:     (mission: Mission) => void;
  onMessage:  (text: string, ttl?: number) => void;
}

export class MissionSystem {
  private scene:    THREE.Scene;
  private events:   MissionEvents;

  /** All running missions (up to MAX_ACTIVE) */
  missions: Mission[] = [];

  /** Running pool index — tracks which defs have been used */
  private poolIdx = 0;

  /** Total objectives across all missions */
  totalCompleted = 0;
  totalEarned    = 0;

  private static MAX_ACTIVE = 3;

  constructor(scene: THREE.Scene, events: MissionEvents) {
    this.scene  = scene;
    this.events = events;
    // Initialise with first 3 missions from pool
    for (let i = 0; i < MissionSystem.MAX_ACTIVE; i++) {
      this.activateNext();
    }
  }

  // ── Internal helpers ────────────────────────────────────────────────────────

  private activateNext(): void {
    if (this.poolIdx >= MISSION_POOL.length) return;
    const def = MISSION_POOL[this.poolIdx++]!;
    const m   = this.buildMission(def);
    this.missions.push(m);
  }

  private buildMission(def: MissionDef): Mission {
    const m: Mission = {
      def, phase: "active", progress: 0,
      markerMeshes: [],
      itemPickedUp:  false,
      surviveTimer:  0,
      wave:          0,
    };

    const zone = def.zone ?? new THREE.Vector3(0, 0, 0);

    switch (def.type) {
      case "goto": {
        // Distribute waypoints evenly around the zone
        const pts = selectWaypoints(zone, def.target);
        for (const wp of pts) {
          m.markerMeshes.push(makePillar(wp, 0xffcc00, this.scene));
        }
        break;
      }
      case "eliminate": {
        // Place a red zone ring at the mission zone
        const ring = new THREE.Mesh(
          GEO_RING,
          new THREE.MeshBasicMaterial({ color: 0xff2200, transparent: true, opacity: 0.30, side: THREE.DoubleSide }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(zone.x, 0.05, zone.z);
        this.scene.add(ring);
        m.markerMeshes.push(ring as unknown as THREE.Mesh);
        break;
      }
      case "deliver": {
        // Green pickup box
        const iPos = zone.clone().add(new THREE.Vector3(5, 0, 5));
        const item = new THREE.Mesh(
          GEO_BOX,
          new THREE.MeshStandardMaterial({ color: 0x00ff88, emissive: 0x00ff88, emissiveIntensity: 0.3 }),
        );
        item.position.set(iPos.x, 0.7, iPos.z);
        this.scene.add(item);
        m.itemMesh = item;
        m.itemPos  = iPos;

        // Blue dropoff pillar (offset the other way)
        const dPos = zone.clone().add(new THREE.Vector3(-15, 0, -10));
        const dropoff = makePillar(dPos, 0x4488ff, this.scene);
        m.markerMeshes.push(dropoff);
        m.dropoffMesh = dropoff;
        m.dropoffPos  = dPos;
        break;
      }
      case "survive": {
        // Orange survive zone ring
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(8, 10, 32),
          new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.25, side: THREE.DoubleSide }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(zone.x, 0.05, zone.z);
        this.scene.add(ring);
        m.markerMeshes.push(ring as unknown as THREE.Mesh);
        break;
      }
    }

    return m;
  }

  private completeMission(m: Mission): void {
    m.phase = "complete";
    this.totalCompleted++;
    this.totalEarned  += m.def.reward;
    this.cleanupMarkers(m);
    this.events.onComplete(m, m.def.reward);
    // Delay next mission activation so UI isn't immediately clobbered
    setTimeout(() => {
      this.missions = this.missions.filter((x) => x !== m);
      this.activateNext();
    }, 4000);
  }

  private failMission(m: Mission): void {
    m.phase = "fail";
    this.cleanupMarkers(m);
    this.events.onFail(m);
    setTimeout(() => {
      this.missions = this.missions.filter((x) => x !== m);
      this.activateNext();
    }, 3000);
  }

  private cleanupMarkers(m: Mission): void {
    for (const mesh of m.markerMeshes) removeMarkerMesh(mesh, this.scene);
    m.markerMeshes = [];
    if (m.itemMesh)    { this.scene.remove(m.itemMesh);    m.itemMesh    = undefined; }
    if (m.dropoffMesh) { this.scene.remove(m.dropoffMesh); m.dropoffMesh = undefined; }
  }

  // ── Per-frame update ────────────────────────────────────────────────────────

  update(
    dt:        number,
    now:       number,
    playerPos: THREE.Vector3,
    killsThisFrame: number,   // hostile NPCs killed this frame
    npcs:      NPC[],
  ): void {
    for (const m of this.missions) {
      if (m.phase !== "active") continue;

      switch (m.def.type) {

        // ── Goto ─────────────────────────────────────────────────────────────
        case "goto": {
          for (let i = m.markerMeshes.length - 1; i >= 0; i--) {
            const mesh = m.markerMeshes[i]!;
            mesh.rotation.y += dt * 1.8;
            const mPos = new THREE.Vector3(mesh.position.x, 0, mesh.position.z);
            if (playerPos.distanceTo(mPos) < 5) {
              // Reached — green flash then remove
              (mesh.material as THREE.MeshBasicMaterial).color.set(0x00ff88);
              removeMarkerMesh(mesh, this.scene);
              m.markerMeshes.splice(i, 1);
              m.progress++;
              this.events.onMessage(`📍 Checkpoint ${m.progress}/${m.def.target} reached!`, 2.5);
              if (m.progress >= m.def.target) this.completeMission(m);
            }
          }
          break;
        }

        // ── Eliminate ────────────────────────────────────────────────────────
        case "eliminate": {
          if (killsThisFrame > 0) {
            m.progress = Math.min(m.progress + killsThisFrame, m.def.target);
            this.events.onMessage(`☠ Eliminated: ${m.progress}/${m.def.target}`, 2);
            if (m.progress >= m.def.target) this.completeMission(m);
          }
          // Pulse the zone ring
          if (m.markerMeshes[0]) {
            (m.markerMeshes[0].material as THREE.MeshBasicMaterial).opacity =
              0.20 + Math.sin(now * 0.003) * 0.12;
          }
          break;
        }

        // ── Deliver ──────────────────────────────────────────────────────────
        case "deliver": {
          if (!m.itemPickedUp && m.itemMesh && m.itemPos) {
            m.itemMesh.rotation.y += dt * 2;
            m.itemMesh.position.y  = 0.7 + Math.sin(now * 0.002) * 0.1;
            if (playerPos.distanceTo(m.itemPos) < 2.5) {
              m.itemPickedUp = true;
              m.itemMesh.visible = false;
              this.events.onMessage("📦 Package picked up! Deliver it now.", 3);
            }
          } else if (m.itemPickedUp && m.dropoffPos) {
            const dp = new THREE.Vector3(m.dropoffPos.x, 0, m.dropoffPos.z);
            if (playerPos.distanceTo(dp) < 5) {
              m.progress = 1;
              this.completeMission(m);
            }
          }
          // Spin dropoff pillar
          if (m.dropoffMesh) m.dropoffMesh.rotation.y += dt * 1.5;
          break;
        }

        // ── Survive ──────────────────────────────────────────────────────────
        case "survive": {
          m.surviveTimer += dt;
          const pct = m.surviveTimer / m.def.target;
          m.progress = Math.floor(m.surviveTimer);

          // Pulse survive ring
          if (m.markerMeshes[0]) {
            (m.markerMeshes[0].material as THREE.MeshBasicMaterial).opacity =
              0.20 + pct * 0.15 + Math.sin(now * 0.005) * 0.08;
          }

          if (m.surviveTimer >= m.def.target) {
            this.completeMission(m);
          }
          break;
        }
      }
    }
  }

  // ── Minimap data ─────────────────────────────────────────────────────────────

  getMinimapMarkers(): Array<{ pos: THREE.Vector3; color: string; label: string }> {
    const out: Array<{ pos: THREE.Vector3; color: string; label: string }> = [];
    for (const m of this.missions) {
      if (m.phase !== "active") continue;
      switch (m.def.type) {
        case "goto":
          for (const mesh of m.markerMeshes)
            out.push({ pos: new THREE.Vector3(mesh.position.x, 0, mesh.position.z), color: "#ffcc00", label: "G" });
          break;
        case "eliminate":
          out.push({ pos: m.def.zone ?? new THREE.Vector3(), color: "#ff2200", label: "E" });
          break;
        case "deliver":
          if (!m.itemPickedUp && m.itemPos)
            out.push({ pos: m.itemPos, color: "#00ff88", label: "P" });
          if (m.dropoffPos)
            out.push({ pos: m.dropoffPos, color: "#4488ff", label: "D" });
          break;
        case "survive":
          out.push({ pos: m.def.zone ?? new THREE.Vector3(), color: "#ff8800", label: "S" });
          break;
      }
    }
    return out;
  }

  dispose(): void {
    for (const m of this.missions) this.cleanupMarkers(m);
    this.missions = [];
  }
}

// ── Utility ───────────────────────────────────────────────────────────────────

function selectWaypoints(zone: THREE.Vector3, count: number): THREE.Vector3[] {
  // Pick the closest `count` waypoints to the zone
  return [...WAYPOINTS]
    .sort((a, b) => a.distanceTo(zone) - b.distanceTo(zone))
    .slice(0, count);
}
