/**
 * DevPanel — Hidden developer control panel.
 * Reveal: tap the "Apex Features" page title 5 times.
 *
 * Allows toggling any feature's state, resetting all overrides,
 * and viewing the user's current referral + waitlist stats.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, RotateCcw, Shield } from "lucide-react";
import { APEX_FEATURES } from "@/data/features";
import {
  getFeatureState,
  setDevOverride,
  clearDevOverrides,
  getDevOverride,
  STATE_META,
  type FeatureState,
} from "@/systems/featureAccess";

const STATES: FeatureState[] = ["locked", "preview", "early", "live"];

function getTotalReferrals(): number {
  try {
    const store: Record<string, { referralCount?: number }> =
      JSON.parse(localStorage.getItem("apex_viral_waitlist") ?? "{}");
    return Object.values(store).reduce((s, e) => s + (e.referralCount ?? 0), 0);
  } catch { return 0; }
}

function getJoinedCount(): number {
  try {
    const joined: string[] = JSON.parse(localStorage.getItem("apex_viral_joined") ?? "[]");
    return joined.length;
  } catch { return 0; }
}

interface DevPanelProps {
  onClose:  () => void;
  onReset:  () => void;
}

export function DevPanel({ onClose, onReset }: DevPanelProps) {
  const [stateMap, setStateMap] = useState<Record<string, FeatureState>>(() => {
    const m: Record<string, FeatureState> = {};
    for (const f of APEX_FEATURES) m[f.id] = getFeatureState(f.id);
    return m;
  });
  const [toast, setToast] = useState("");

  function handleSetState(featureId: string, newState: FeatureState) {
    setDevOverride(featureId, newState);
    setStateMap(prev => ({ ...prev, [featureId]: newState }));
    const feature = APEX_FEATURES.find(f => f.id === featureId);
    setToast(`${feature?.icon ?? ""} ${feature?.title} → ${STATE_META[newState].label}`);
    setTimeout(() => setToast(""), 2200);
  }

  function handleReset() {
    clearDevOverrides();
    const fresh: Record<string, FeatureState> = {};
    for (const f of APEX_FEATURES) fresh[f.id] = getFeatureState(f.id);
    setStateMap(fresh);
    onReset();
    setToast("All overrides cleared");
    setTimeout(() => setToast(""), 2200);
  }

  const totalRefs  = getTotalReferrals();
  const joinedCount = getJoinedCount();
  const overrideCount = APEX_FEATURES.filter(f => getDevOverride(f.id) !== null).length;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 10000,
          background: "rgba(0,0,0,0.82)",
          backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: "100%", scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: "100%", scale: 0.97 }}
        transition={{ type: "spring", stiffness: 360, damping: 32 }}
        onClick={e => e.stopPropagation()}
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 10001,
          maxHeight: "90vh", display: "flex", flexDirection: "column",
          borderRadius: "24px 24px 0 0",
          background: "linear-gradient(180deg, #0A0C1A 0%, #06080F 100%)",
          border: "1px solid rgba(162,155,254,0.25)",
          borderBottom: "none",
          boxShadow: "0 -12px 60px rgba(0,0,0,0.80), 0 0 0 1px rgba(255,255,255,0.04) inset",
          overflow: "hidden",
        }}>

        {/* Accent strip */}
        <div style={{
          height: 3, flexShrink: 0,
          background: "linear-gradient(90deg, #6C5CE7, #A29BFE, #FD79A8)",
          boxShadow: "0 0 14px rgba(108,92,231,0.80)",
        }} />

        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0", flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 99, background: "rgba(255,255,255,0.12)" }} />
        </div>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "12px 20px 10px", flexShrink: 0,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10, background: "rgba(108,92,231,0.18)",
            border: "1px solid rgba(108,92,231,0.35)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Shield style={{ width: 16, height: 16, color: "#A29BFE" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: "#A29BFE", letterSpacing: "-0.01em" }}>
              Developer Panel
            </div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.30)", marginTop: 1 }}>
              {overrideCount > 0 ? `${overrideCount} override${overrideCount !== 1 ? "s" : ""} active` : "No active overrides"}
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 30, height: 30, borderRadius: 9,
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)",
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            color: "rgba(255,255,255,0.50)",
          }}>
            <X style={{ width: 13, height: 13 }} />
          </button>
        </div>

        {/* Stats row */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8,
          padding: "10px 20px 0", flexShrink: 0,
        }}>
          {[
            { label: "Referrals",    value: totalRefs    },
            { label: "On Waitlists", value: joinedCount  },
            { label: "Overrides",    value: overrideCount },
          ].map(s => (
            <div key={s.label} style={{
              padding: "8px 10px", borderRadius: 11, textAlign: "center",
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
            }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.30)", fontWeight: 700, marginTop: 2, letterSpacing: "0.04em" }}>
                {s.label.toUpperCase()}
              </div>
            </div>
          ))}
        </div>

        {/* Reset button */}
        <div style={{ padding: "10px 20px 0", flexShrink: 0 }}>
          <motion.button whileTap={{ scale: 0.96 }} onClick={handleReset} style={{
            width: "100%", padding: "10px 0", borderRadius: 12, cursor: "pointer",
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.22)",
            color: "#EF4444", fontSize: 11, fontWeight: 800,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            <RotateCcw style={{ width: 12, height: 12 }} />
            Reset All Overrides
          </motion.button>
        </div>

        {/* Feature list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px 32px", scrollbarWidth: "none", display: "flex", flexDirection: "column", gap: 8 }}>
          {APEX_FEATURES.map(feature => {
            const current  = stateMap[feature.id] ?? "locked";
            const override = getDevOverride(feature.id);
            return (
              <div key={feature.id} style={{
                borderRadius: 14, padding: "11px 13px",
                background: override ? "rgba(108,92,231,0.08)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${override ? "rgba(108,92,231,0.25)" : "rgba(255,255,255,0.06)"}`,
              }}>
                {/* Feature header */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{feature.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#fff", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {feature.title}
                    </div>
                    {override && (
                      <div style={{ fontSize: 8, color: "#A29BFE", fontWeight: 700, marginTop: 1 }}>DEV OVERRIDE ACTIVE</div>
                    )}
                  </div>
                </div>

                {/* State selector */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 5 }}>
                  {STATES.map(s => {
                    const meta    = STATE_META[s];
                    const active  = current === s;
                    return (
                      <motion.button
                        key={s} whileTap={{ scale: 0.92 }}
                        onClick={() => handleSetState(feature.id, s)}
                        style={{
                          padding: "6px 4px", borderRadius: 9, cursor: "pointer",
                          background: active ? meta.bg : "rgba(255,255,255,0.03)",
                          border: `1px solid ${active ? meta.border : "rgba(255,255,255,0.06)"}`,
                          boxShadow: active ? `0 0 10px ${meta.glow}` : "none",
                          display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                        }}>
                        <span style={{ fontSize: 12 }}>{meta.icon}</span>
                        <span style={{
                          fontSize: 7, fontWeight: 900,
                          color: active ? meta.color : "rgba(255,255,255,0.25)",
                          letterSpacing: "0.04em",
                        }}>
                          {s === "early" ? "EARLY" : s.toUpperCase()}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
              style={{
                position: "absolute", bottom: 70, left: "50%", transform: "translateX(-50%)",
                whiteSpace: "nowrap", background: "rgba(10,12,26,0.96)",
                border: "1px solid rgba(162,155,254,0.30)", color: "#A29BFE",
                fontSize: 11, fontWeight: 700, padding: "8px 16px",
                borderRadius: 99, zIndex: 100,
                backdropFilter: "blur(12px)", boxShadow: "0 8px 24px rgba(0,0,0,0.60)",
              }}>
              {toast}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
