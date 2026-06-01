/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  APEX — COD-Style Loadout Selector                          ║
 * ║                                                             ║
 * ║  Pre-game screen for FPS + Open World modes                 ║
 * ║  Browse 5 presets + build a custom loadout                  ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
import { useState, useEffect } from "react";
import {
  PRESET_LOADOUTS,
  loadCustomLoadout, saveCustomLoadout,
  loadActiveLoadoutId, saveActiveLoadoutId,
  getLoadoutById, getLoadoutEffects,
  PERKS, EQUIPMENT, LOADOUT_WEAPONS,
  PERK_IDS, EQUIPMENT_IDS,
  DEFAULT_CUSTOM_LOADOUT,
  type Loadout, type PerkId, type EquipmentId, type LoadoutWeaponId,
} from "@/engine3d/LoadoutSystem";

const GRAD   = "linear-gradient(135deg,#6C5CE7,#A29BFE,#FD79A8)";
const BG     = "#07080E";
const BORDER = "rgba(255,255,255,0.07)";

interface Props {
  onDeploy:  (loadout: Loadout) => void;
  onBack:    () => void;
  gameMode?: string;
}

type Screen = "browse" | "custom";

// ─────────────────────────────────────────────────────────────────────────────

export function LoadoutSelector({ onDeploy, onBack, gameMode }: Props) {
  const [screen, setScreen]     = useState<Screen>("browse");
  const [selected, setSelected] = useState<string>(loadActiveLoadoutId());
  const [custom,   setCustom]   = useState<Loadout>(() => loadCustomLoadout());
  const [countdown, setCountdown] = useState(0);  // 0 = not deploying

  // All loadouts for the browse screen
  const allLoadouts = [...PRESET_LOADOUTS, { ...custom, id: "custom" }];

  // Currently highlighted loadout
  const highlighted = selected === "custom"
    ? { ...custom, id: "custom" }
    : getLoadoutById(selected);

  const effects = getLoadoutEffects(highlighted);

  function deploy() {
    saveActiveLoadoutId(selected);
    if (selected === "custom") saveCustomLoadout(custom);
    onDeploy(highlighted);
  }

  function handleSelect(id: string) {
    setSelected(id);
    if (id === "custom") setScreen("custom");
  }

  // ── Custom builder helpers ─────────────────────────────────────────────────

  function togglePerk(id: PerkId) {
    setCustom((prev) => {
      const has = prev.perks.includes(id);
      if (has) return { ...prev, perks: prev.perks.filter((p) => p !== id) };
      if (prev.perks.length >= 3) return prev; // max 3
      return { ...prev, perks: [...prev.perks, id] };
    });
  }

  function setEquipment(id: EquipmentId) {
    setCustom((prev) => ({ ...prev, equipment: id }));
  }

  function setPrimary(id: LoadoutWeaponId) {
    setCustom((prev) => ({ ...prev, primary: id }));
  }

  function setSecondary(id: LoadoutWeaponId) {
    setCustom((prev) => ({ ...prev, secondary: id }));
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{
      position: "fixed", inset: 0, background: BG, zIndex: 100,
      display: "flex", flexDirection: "column",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color: "#fff", overflow: "hidden",
    }}>

      {/* ── Background scanlines ───────────────────────────────────────────── */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.012) 3px, rgba(255,255,255,0.012) 4px)",
      }} />

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{
        position: "relative", zIndex: 1,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "18px 24px 14px",
        borderBottom: "1px solid rgba(108,92,231,0.2)",
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(14px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button
            onClick={screen === "custom" ? () => setScreen("browse") : onBack}
            style={{
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10, color: "#888", fontSize: 18, width: 36, height: 36,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >{screen === "custom" ? "‹" : "✕"}</button>

          <div>
            <div style={{
              fontSize: 18, fontWeight: 900, letterSpacing: "0.08em",
              background: GRAD, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>OPERATOR LOADOUT</div>
            <div style={{ fontSize: 11, color: "#444", fontWeight: 600, letterSpacing: "0.10em" }}>
              {screen === "custom" ? "CUSTOM BUILD" : gameMode === "fps" ? "3D FPS MODE" : "OPEN WORLD MODE"}
            </div>
          </div>
        </div>

        <button
          onClick={deploy}
          style={{
            padding: "10px 28px", borderRadius: 24, border: "none",
            background: GRAD, color: "#fff", fontWeight: 800, fontSize: 14,
            letterSpacing: "0.06em", cursor: "pointer",
            boxShadow: "0 0 20px rgba(108,92,231,0.45)",
          }}
        >DEPLOY ▶</button>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, display: "flex", gap: 0, overflow: "hidden", position: "relative", zIndex: 1,
      }}>

        {/* Left: loadout list / custom builder */}
        <div style={{
          flex: 1, overflowY: "auto", padding: "20px 16px",
          borderRight: "1px solid rgba(255,255,255,0.05)",
        }}>
          {screen === "browse" ? (
            <>
              <div style={{ fontSize: 11, color: "#444", fontWeight: 700, letterSpacing: "0.12em", marginBottom: 14 }}>
                SELECT LOADOUT — {allLoadouts.length} AVAILABLE
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {allLoadouts.map((loadout) => (
                  <LoadoutCard
                    key={loadout.id}
                    loadout={loadout}
                    selected={selected === loadout.id}
                    onSelect={() => handleSelect(loadout.id)}
                    onDeploy={() => { setSelected(loadout.id); deploy(); }}
                  />
                ))}
              </div>
            </>
          ) : (
            <CustomBuilder
              custom={custom}
              onPrimary={setPrimary}
              onSecondary={setSecondary}
              onTogglePerk={togglePerk}
              onEquipment={setEquipment}
            />
          )}
        </div>

        {/* Right: details panel */}
        <div style={{
          width: 260, flexShrink: 0, padding: "20px 18px",
          overflowY: "auto",
          display: "flex", flexDirection: "column", gap: 16,
        }}>
          <DetailsPanel loadout={highlighted} effects={effects} />
        </div>
      </div>

      {/* ── Bottom deploy bar ─────────────────────────────────────────────── */}
      <div style={{
        position: "relative", zIndex: 1,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 24px",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(14px)",
        gap: 12,
      }}>
        <div style={{ fontSize: 11, color: "#444", lineHeight: 1.7 }}>
          <div style={{ color: "#666", fontWeight: 700 }}>{highlighted.emoji} {highlighted.name}</div>
          <div style={{ color: "#333" }}>{highlighted.primary} + {highlighted.secondary} · {highlighted.perks.length} perks</div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {selected !== "custom" && (
            <button
              onClick={() => setScreen("custom")}
              style={{
                padding: "10px 18px", borderRadius: 20,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.04)",
                color: "#888", fontWeight: 700, fontSize: 13, cursor: "pointer",
              }}
            >⚙ Customize</button>
          )}
          <button
            onClick={deploy}
            style={{
              padding: "12px 36px", borderRadius: 24, border: "none",
              background: GRAD, color: "#fff", fontWeight: 900,
              fontSize: 15, letterSpacing: "0.06em", cursor: "pointer",
              boxShadow: "0 0 24px rgba(108,92,231,0.5)",
            }}
          >▶ DEPLOY</button>
        </div>
      </div>
    </div>
  );
}

// ── Loadout Card ──────────────────────────────────────────────────────────────

function LoadoutCard({
  loadout, selected, onSelect, onDeploy,
}: { loadout: Loadout; selected: boolean; onSelect: () => void; onDeploy: () => void }) {
  return (
    <div
      onClick={onSelect}
      style={{
        borderRadius: 14,
        background: selected ? "rgba(108,92,231,0.12)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${selected ? "rgba(108,92,231,0.50)" : BORDER}`,
        padding: "14px 16px",
        cursor: "pointer",
        transition: "all 0.18s ease",
        boxShadow: selected ? "0 0 18px rgba(108,92,231,0.22), inset 0 0 0 1px rgba(162,155,254,0.1)" : "none",
      }}
    >
      {/* Title row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: selected ? "rgba(108,92,231,0.3)" : "rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
        }}>{loadout.emoji}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: selected ? "#A29BFE" : "#fff" }}>
            {loadout.name}
          </div>
          <div style={{ fontSize: 11, color: "#444", lineHeight: 1.4 }}>{loadout.desc}</div>
        </div>
        {selected && (
          <button
            onClick={(e) => { e.stopPropagation(); onDeploy(); }}
            style={{
              padding: "6px 14px", borderRadius: 16, border: "none",
              background: GRAD, color: "#fff", fontWeight: 700, fontSize: 11,
              cursor: "pointer", flexShrink: 0,
            }}
          >▶ Play</button>
        )}
      </div>

      {/* Weapons row */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {[loadout.primary, loadout.secondary].map((wId, i) => {
          const w = LOADOUT_WEAPONS[wId];
          return (
            <div key={i} style={{
              padding: "4px 10px", borderRadius: 8,
              background: i === 0 ? "rgba(108,92,231,0.18)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${i === 0 ? "rgba(108,92,231,0.35)" : "rgba(255,255,255,0.07)"}`,
              fontSize: 10, fontWeight: 700, color: i === 0 ? "#A29BFE" : "#555",
              display: "flex", alignItems: "center", gap: 5,
            }}>
              <span>{w.emoji}</span>
              <span>{w.name}</span>
              {i === 1 && <span style={{ color: "#333", fontSize: 9 }}>· 2°</span>}
            </div>
          );
        })}
      </div>

      {/* Stat bars */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        {Object.entries(loadout.stats).map(([stat, val]) => (
          <div key={stat} style={{ flex: 1 }}>
            <div style={{ fontSize: 7, color: "#333", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 3 }}>
              {stat.toUpperCase().slice(0, 3)}
            </div>
            <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
              <div style={{
                width: `${val}%`, height: "100%", borderRadius: 2,
                background: selected ? "linear-gradient(90deg,#6c5ce7,#a29bfe)" : "rgba(255,255,255,0.25)",
              }} />
            </div>
          </div>
        ))}
      </div>

      {/* Perks + Equipment */}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        {loadout.perks.map((pId) => {
          const p = PERKS[pId];
          return (
            <span key={pId} style={{
              fontSize: 9, padding: "2px 8px", borderRadius: 6,
              background: "rgba(108,92,231,0.15)",
              border: "1px solid rgba(108,92,231,0.25)",
              color: "#A29BFE", fontWeight: 700,
            }}>{p.emoji} {p.name}</span>
          );
        })}
        <span style={{
          fontSize: 9, padding: "2px 8px", borderRadius: 6,
          background: "rgba(253,121,168,0.12)",
          border: "1px solid rgba(253,121,168,0.22)",
          color: "#FD79A8", fontWeight: 700,
        }}>
          {EQUIPMENT[loadout.equipment].emoji} {EQUIPMENT[loadout.equipment].name}
        </span>
      </div>
    </div>
  );
}

// ── Details Panel (right column) ──────────────────────────────────────────────

function DetailsPanel({ loadout, effects }: { loadout: Loadout; effects: ReturnType<typeof getLoadoutEffects> }) {
  const primary   = LOADOUT_WEAPONS[loadout.primary];
  const secondary = LOADOUT_WEAPONS[loadout.secondary];

  return (
    <>
      <div>
        <div style={{ fontSize: 10, color: "#444", fontWeight: 700, letterSpacing: "0.12em", marginBottom: 12 }}>
          ACTIVE LOADOUT
        </div>
        <div style={{ fontSize: 24, marginBottom: 4 }}>{loadout.emoji}</div>
        <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", marginBottom: 4 }}>{loadout.name}</div>
        <div style={{ fontSize: 11, color: "#555", lineHeight: 1.55 }}>{loadout.desc}</div>
      </div>

      {/* Weapons */}
      <Section title="WEAPONS">
        {([{ w: primary, label: "Primary", color: "#A29BFE" }, { w: secondary, label: "Secondary", color: "#555" }] as const).map(({ w, label, color }) => (
          <div key={label} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
            <span style={{ fontSize: 18 }}>{w.emoji}</span>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color }}>{label}</div>
              <div style={{ fontSize: 10, color: "#555" }}>{w.name} · {w.desc}</div>
            </div>
          </div>
        ))}
      </Section>

      {/* Perks */}
      <Section title="PERKS">
        {loadout.perks.map((pId) => {
          const p = PERKS[pId];
          return (
            <div key={pId} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{p.emoji}</span>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#A29BFE" }}>{p.name}</div>
                <div style={{ fontSize: 10, color: "#555", lineHeight: 1.4 }}>{p.desc}</div>
              </div>
            </div>
          );
        })}
      </Section>

      {/* Equipment */}
      <Section title="EQUIPMENT">
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <span style={{ fontSize: 20 }}>{EQUIPMENT[loadout.equipment].emoji}</span>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#FD79A8" }}>
              {EQUIPMENT[loadout.equipment].name}
            </div>
            <div style={{ fontSize: 10, color: "#555" }}>
              {EQUIPMENT[loadout.equipment].desc}
            </div>
          </div>
        </div>
      </Section>

      {/* Live effects summary */}
      <Section title="ACTIVE BONUSES">
        {[
          { label: "Damage",  value: effects.damageMult !== 1 ? `×${effects.damageMult.toFixed(2)}` : "Base",  highlight: effects.damageMult > 1  },
          { label: "Speed",   value: effects.speedMult  !== 1 ? `×${effects.speedMult.toFixed(2)}`  : "Base",  highlight: effects.speedMult  > 1  },
          { label: "Health",  value: effects.extraHealth > 0  ? `+${effects.extraHealth} HP`        : "Base",  highlight: effects.extraHealth > 0 },
          { label: "Reload",  value: effects.reloadMult  < 1  ? `×${effects.reloadMult.toFixed(2)}` : "Base",  highlight: effects.reloadMult  < 1 },
          { label: "Ammo",    value: effects.ammoMult   !== 1 ? `×${effects.ammoMult.toFixed(2)}`   : "Base",  highlight: effects.ammoMult   > 1  },
          ...(effects.mapRadius > 0 ? [{ label: "Map",   value: `+${effects.mapRadius}m`,  highlight: true }] : []),
          ...(effects.startBonusHp > 0 ? [{ label: "Armor", value: `+${effects.startBonusHp} HP`, highlight: true }] : []),
        ].map(({ label, value, highlight }) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 10, color: "#555", fontWeight: 600 }}>{label}</span>
            <span style={{ fontSize: 10, fontWeight: 800, color: highlight ? "#00ff88" : "#444" }}>
              {value}
            </span>
          </div>
        ))}
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: "#333", fontWeight: 700, letterSpacing: "0.12em", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        {title}
      </div>
      {children}
    </div>
  );
}

// ── Custom Builder ────────────────────────────────────────────────────────────

function CustomBuilder({
  custom, onPrimary, onSecondary, onTogglePerk, onEquipment,
}: {
  custom:      Loadout;
  onPrimary:   (id: LoadoutWeaponId) => void;
  onSecondary: (id: LoadoutWeaponId) => void;
  onTogglePerk:(id: PerkId) => void;
  onEquipment: (id: EquipmentId) => void;
}) {
  const WEAPON_IDS: LoadoutWeaponId[] = ["pistol", "rifle", "shotgun", "sniper"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ fontSize: 11, color: "#444", fontWeight: 700, letterSpacing: "0.12em" }}>
        BUILD YOUR LOADOUT
      </div>

      {/* Primary weapon */}
      <div>
        <SectionLabel>PRIMARY WEAPON</SectionLabel>
        <div style={{ display: "flex", gap: 8 }}>
          {WEAPON_IDS.map((wId) => {
            const w = LOADOUT_WEAPONS[wId];
            const active = custom.primary === wId;
            return (
              <button
                key={wId}
                onClick={() => onPrimary(wId)}
                style={{
                  flex: 1, padding: "10px 6px", borderRadius: 10, cursor: "pointer",
                  background: active ? "rgba(108,92,231,0.25)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${active ? "rgba(108,92,231,0.55)" : BORDER}`,
                  color: active ? "#A29BFE" : "#555",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                }}
              >
                <span style={{ fontSize: 18 }}>{w.emoji}</span>
                <span style={{ fontSize: 8, fontWeight: 700 }}>{w.name.toUpperCase().split(" ")[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Secondary weapon */}
      <div>
        <SectionLabel>SECONDARY WEAPON</SectionLabel>
        <div style={{ display: "flex", gap: 8 }}>
          {WEAPON_IDS.map((wId) => {
            const w = LOADOUT_WEAPONS[wId];
            const active = custom.secondary === wId;
            return (
              <button
                key={wId}
                onClick={() => onSecondary(wId)}
                style={{
                  flex: 1, padding: "8px 4px", borderRadius: 10, cursor: "pointer",
                  background: active ? "rgba(253,121,168,0.15)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${active ? "rgba(253,121,168,0.45)" : BORDER}`,
                  color: active ? "#FD79A8" : "#555",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                }}
              >
                <span style={{ fontSize: 16 }}>{w.emoji}</span>
                <span style={{ fontSize: 8, fontWeight: 700 }}>{w.name.toUpperCase().split(" ")[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Perks */}
      <div>
        <SectionLabel>PERKS — SELECT UP TO 3 ({custom.perks.length}/3)</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {PERK_IDS.map((pId) => {
            const p      = PERKS[pId];
            const active = custom.perks.includes(pId);
            const full   = !active && custom.perks.length >= 3;
            return (
              <button
                key={pId}
                onClick={() => onTogglePerk(pId)}
                disabled={full}
                style={{
                  padding: "10px 12px", borderRadius: 10, cursor: full ? "not-allowed" : "pointer",
                  background: active ? "rgba(108,92,231,0.22)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${active ? "rgba(108,92,231,0.50)" : BORDER}`,
                  color: active ? "#A29BFE" : full ? "#333" : "#666",
                  textAlign: "left", opacity: full ? 0.45 : 1,
                }}
              >
                <div style={{ fontSize: 18, marginBottom: 5 }}>{p.emoji}</div>
                <div style={{ fontSize: 10, fontWeight: 800 }}>{p.name}</div>
                <div style={{ fontSize: 9, color: active ? "#7c6fe0" : "#444", lineHeight: 1.4, marginTop: 2 }}>
                  {p.desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Equipment */}
      <div>
        <SectionLabel>EQUIPMENT — SELECT 1</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {EQUIPMENT_IDS.map((eId) => {
            const eq     = EQUIPMENT[eId];
            const active = custom.equipment === eId;
            return (
              <button
                key={eId}
                onClick={() => onEquipment(eId)}
                style={{
                  padding: "10px 8px", borderRadius: 10, cursor: "pointer",
                  background: active ? "rgba(253,121,168,0.18)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${active ? "rgba(253,121,168,0.45)" : BORDER}`,
                  color: active ? "#FD79A8" : "#555",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                }}
              >
                <span style={{ fontSize: 20 }}>{eq.emoji}</span>
                <span style={{ fontSize: 8, fontWeight: 800 }}>{eq.name.split(" ")[0]!.toUpperCase()}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 9, color: "#444", fontWeight: 700, letterSpacing: "0.12em",
      marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.04)",
    }}>
      {children}
    </div>
  );
}
