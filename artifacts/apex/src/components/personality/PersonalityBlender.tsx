/**
 * PersonalityBlender — Multi-personality mix UI
 * Sliders for each personality, auto-normalization, presets, live preview
 */
import { useState } from "react";
import { usePersonality } from "@/contexts/PersonalityContext";
import { APEX_PERSONALITIES, BLEND_PERSONALITY_ORDER, BlendPreset } from "@/lib/personalityEngine";
import { ApexPersonalityId } from "@/lib/personalityEngine";
import { describeVoiceStyle } from "@/lib/voicePersonality";

const IOS    = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";
const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

// ── Thumb-drag slider ─────────────────────────────────────────────────────────
interface SliderProps {
  value: number;   // 0–100
  color: string;
  onChange: (v: number) => void;
  disabled?: boolean;
}

function BlendSlider({ value, color, onChange, disabled }: SliderProps) {
  return (
    <div style={{ position: "relative", height: 20, display: "flex", alignItems: "center", flex: 1 }}>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: "100%",
          height: 6,
          appearance: "none",
          WebkitAppearance: "none",
          borderRadius: 6,
          outline: "none",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.35 : 1,
          background: `linear-gradient(to right, ${color} 0%, ${color} ${value}%, rgba(255,255,255,0.10) ${value}%, rgba(255,255,255,0.10) 100%)`,
          transition: `background 0.08s ${IOS}`,
        }}
      />
      <style>{`
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          cursor: pointer;
          transition: transform 0.12s ${SPRING}, box-shadow 0.12s ease;
        }
        input[type=range]::-webkit-slider-thumb:active {
          transform: scale(1.25);
          box-shadow: 0 0 0 4px ${value > 0 ? 'rgba(255,255,255,0.15)' : 'transparent'}, 0 2px 8px rgba(0,0,0,0.4);
        }
        input[type=range]::-moz-range-thumb {
          width: 18px; height: 18px;
          border-radius: 50%;
          background: white;
          border: none;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}

// ── Weight badge ──────────────────────────────────────────────────────────────
function WeightBadge({ value, color }: { value: number; color: string }) {
  const isActive = value > 0;
  return (
    <div style={{
      minWidth: 36, height: 22, borderRadius: 8,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: isActive ? `${color}22` : "rgba(255,255,255,0.04)",
      border: `1px solid ${isActive ? color + "40" : "rgba(255,255,255,0.07)"}`,
      fontSize: 10, fontWeight: 800,
      color: isActive ? color : "rgba(255,255,255,0.25)",
      transition: `all 0.15s ${IOS}`,
      fontVariantNumeric: "tabular-nums",
    }}>
      {value}%
    </div>
  );
}

// ── Live preview bar ──────────────────────────────────────────────────────────
function BlendPreviewBar({ blend }: { blend: { id: ApexPersonalityId; weight: number }[] }) {
  const active = blend.filter((s) => s.weight > 0).sort((a, b) => b.weight - a.weight);
  if (active.length === 0) return null;

  let offset = 0;
  return (
    <div style={{
      height: 8, borderRadius: 99, overflow: "hidden",
      background: "rgba(255,255,255,0.06)",
      display: "flex",
    }}>
      {active.map((s, i) => {
        const p = APEX_PERSONALITIES[s.id];
        const seg = (
          <div
            key={s.id}
            style={{
              width: `${s.weight}%`,
              height: "100%",
              background: p.color,
              opacity: 0.85,
              transition: `width 0.25s ${IOS}`,
              borderRadius: i === 0 ? "99px 0 0 99px" : i === active.length - 1 ? "0 99px 99px 0" : "0",
            }}
          />
        );
        offset += s.weight;
        return seg;
      })}
    </div>
  );
}

// ── Preset chip ───────────────────────────────────────────────────────────────
function PresetChip({ preset, isActive, onApply }: { preset: BlendPreset; isActive: boolean; onApply: () => void }) {
  const [pressed, setPressed] = useState(false);

  return (
    <button
      onClick={() => { setPressed(true); setTimeout(() => setPressed(false), 250); onApply(); }}
      style={{
        padding: "7px 12px", borderRadius: 99, cursor: "pointer",
        display: "flex", alignItems: "center", gap: 5,
        background: isActive ? "rgba(162,155,254,0.18)" : "rgba(255,255,255,0.04)",
        border: `1px solid ${isActive ? "rgba(162,155,254,0.45)" : "rgba(255,255,255,0.09)"}`,
        transition: `all 0.18s ${SPRING}`,
        transform: pressed ? "scale(0.93)" : isActive ? "scale(1.04)" : "scale(1)",
        boxShadow: isActive ? "0 0 14px rgba(162,155,254,0.20)" : "none",
        flexShrink: 0,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontSize: 12 }}>{preset.emoji}</span>
      <span style={{ fontSize: 10, fontWeight: 700, color: isActive ? "#A29BFE" : "rgba(255,255,255,0.55)" }}>
        {preset.name}
      </span>
    </button>
  );
}

// ── Active personality chips (blend summary) ──────────────────────────────────
function ActiveChips({ blend }: { blend: { id: ApexPersonalityId; weight: number }[] }) {
  const active = blend.filter((s) => s.weight > 0).sort((a, b) => b.weight - a.weight);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
      {active.map((s) => {
        const p = APEX_PERSONALITIES[s.id];
        return (
          <div key={s.id} style={{
            display: "flex", alignItems: "center", gap: 4,
            padding: "3px 8px", borderRadius: 99,
            background: `${p.color}14`,
            border: `1px solid ${p.color}30`,
            fontSize: 9, fontWeight: 700, color: p.color,
          }}>
            <span style={{ fontSize: 11 }}>{p.emoji}</span>
            {s.weight}%
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface PersonalityBlenderProps {
  compact?: boolean; // minimal chrome for embedding in panels
}

export function PersonalityBlender({ compact = false }: PersonalityBlenderProps) {
  const { blend, setSlotWeight, applyPreset, blendDescription, presets, avatarBehavior, voiceStyle, profile } = usePersonality();

  const total = blend.reduce((sum, s) => sum + s.weight, 0);

  // Detect which preset is currently active (if any)
  const activePresetId = presets.find((preset) => {
    const fullBlend: Record<string, number> = {};
    blend.forEach((s) => { fullBlend[s.id] = s.weight; });
    return preset.blend.every((ps) => Math.abs((fullBlend[ps.id] ?? 0) - ps.weight) < 3) &&
      preset.blend.reduce((sum, ps) => sum + ps.weight, 0) === total;
  })?.id ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? 12 : 18 }}>

      {/* ── Presets ── */}
      <div>
        {!compact && (
          <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.30)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 9 }}>
            Quick Presets
          </div>
        )}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
          {presets.map((preset) => (
            <PresetChip
              key={preset.id}
              preset={preset}
              isActive={activePresetId === preset.id}
              onApply={() => applyPreset(preset)}
            />
          ))}
        </div>
      </div>

      {/* ── Slider rows ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {!compact && (
          <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.30)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 2 }}>
            Custom Mix
          </div>
        )}
        {BLEND_PERSONALITY_ORDER.map((id) => {
          const slot = blend.find((s) => s.id === id) ?? { id, weight: 0 };
          const p = APEX_PERSONALITIES[id];
          return (
            <div key={id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* emoji + name */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, width: compact ? 68 : 80, flexShrink: 0 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
                  background: slot.weight > 0 ? `${p.color}18` : "rgba(255,255,255,0.04)",
                  border: `1px solid ${slot.weight > 0 ? p.color + "30" : "rgba(255,255,255,0.06)"}`,
                  transition: `all 0.15s ${IOS}`,
                  filter: slot.weight > 0 ? `drop-shadow(0 0 4px ${p.color}60)` : "none",
                }}>
                  {p.emoji}
                </div>
                <div style={{
                  fontSize: compact ? 8 : 9, fontWeight: 700,
                  color: slot.weight > 0 ? p.color : "rgba(255,255,255,0.30)",
                  transition: `color 0.15s ${IOS}`,
                  lineHeight: 1.2, maxWidth: compact ? 38 : 48,
                }}>
                  {p.name}
                </div>
              </div>

              {/* slider */}
              <BlendSlider
                value={slot.weight}
                color={p.color}
                onChange={(v) => setSlotWeight(id, v)}
              />

              {/* weight badge */}
              <WeightBadge value={slot.weight} color={p.color} />
            </div>
          );
        })}
      </div>

      {/* ── Live preview bar ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <BlendPreviewBar blend={blend} />
        <ActiveChips blend={blend} />
        <div style={{
          fontSize: compact ? 9 : 10, color: "rgba(255,255,255,0.45)",
          fontStyle: "italic", lineHeight: 1.5,
          padding: compact ? "8px 10px" : "10px 12px",
          borderRadius: 10,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
          transition: `all 0.3s ${IOS}`,
        }}>
          <span style={{ color: "rgba(162,155,254,0.7)", fontStyle: "normal", fontWeight: 700, marginRight: 4 }}>
            Preview:
          </span>
          {blendDescription}
        </div>
      </div>

      {/* ── Avatar + Voice live status ── */}
      <div style={{ display: "flex", gap: 6 }}>
        <div style={{
          flex: 1, padding: compact ? "8px 10px" : "10px 12px", borderRadius: 10,
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: "rgba(255,255,255,0.25)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 4 }}>
            Avatar
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: compact ? 12 : 14 }}>{
              avatarBehavior.expression === 'smiling' ? '😊'
              : avatarBehavior.expression === 'calm' ? '😌'
              : avatarBehavior.expression === 'intense' ? '😤'
              : avatarBehavior.expression === 'curious' ? '🤔'
              : '🎯'
            }</span>
            <div>
              <div style={{ fontSize: compact ? 8 : 9, fontWeight: 700, color: profile.color, lineHeight: 1.3 }}>
                {avatarBehavior.expression}
              </div>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.30)", lineHeight: 1.3 }}>
                {avatarBehavior.animation} · {avatarBehavior.movement}
              </div>
            </div>
          </div>
        </div>
        <div style={{
          flex: 1, padding: compact ? "8px 10px" : "10px 12px", borderRadius: 10,
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: "rgba(255,255,255,0.25)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 4 }}>
            Voice
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: compact ? 12 : 14 }}>🎙️</span>
            <div>
              <div style={{ fontSize: compact ? 8 : 9, fontWeight: 700, color: profile.color, lineHeight: 1.3 }}>
                {voiceStyle.tone}
              </div>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.30)", lineHeight: 1.3 }}>
                {describeVoiceStyle(voiceStyle).split(',').slice(1).join(',').trim()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Total indicator ── */}
      {total !== 100 && (
        <div style={{
          fontSize: 9, fontWeight: 700, color: "#EF4444",
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.20)",
          borderRadius: 8, padding: "5px 10px", textAlign: "center",
        }}>
          Total: {total}% — must equal 100%
        </div>
      )}
    </div>
  );
}
