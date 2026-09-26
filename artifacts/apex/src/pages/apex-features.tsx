/**
 * Apex Features — Production "Coming Soon" showcase page
 *
 * Apple-level feature showcase with:
 * - LOCKED → PREVIEW → EARLY ACCESS → LIVE state machine per feature
 * - Hero section with animated feature highlights
 * - Full searchable/filterable feature grid (17 features)
 * - Cinematic preview modals per feature
 * - Hidden dev panel (tap page title 5x)
 * - Unlock toast notifications
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Search, X, Sparkles, Rocket, Zap } from "lucide-react";
import { APEX_FEATURES, PHASE_META, type ApexFeature, type FeaturePhase } from "@/data/features";
import { getFeatureState, STATE_META, type FeatureState } from "@/systems/featureAccess";
import { startUnlockEngine, onFeatureUnlock, stateLabel } from "@/systems/unlockEngine";
import { FeatureCard } from "@/components/features/FeatureCard";
import { FeatureModal } from "@/components/features/FeatureModal";
import { DevPanel } from "@/components/features/DevPanel";

const IOS    = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";
const IOS_EASE = [0.25, 0.46, 0.45, 0.94] as const;
const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

// ── Hero carousel ─────────────────────────────────────────────────────────────

const HERO_FEATURES = APEX_FEATURES.filter(f => [
  "autopilot", "workflows", "multiplayer-fps", "game-studio", "marketplace",
].includes(f.id));

function HeroCarousel({ onPreview }: { onPreview: (f: ApexFeature) => void }) {
  const [active, setActive] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function start() {
    timerRef.current = setInterval(() => setActive(a => (a + 1) % HERO_FEATURES.length), 3200);
  }
  function stop() { if (timerRef.current) clearInterval(timerRef.current); }

  useEffect(() => { start(); return stop; }, []);

  const feature = HERO_FEATURES[active]!;

  return (
    <div style={{ position: "relative" }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={feature.id}
          initial={{ opacity: 0, x: 24, scale: 0.97 }}
          animate={{ opacity: 1, x: 0,  scale: 1 }}
          exit={{ opacity: 0, x: -24, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 340, damping: 30 }}
          onClick={() => onPreview(feature)}
          style={{
            borderRadius: 22, padding: "22px 22px 20px", cursor: "pointer",
            background: `linear-gradient(145deg, ${feature.accent}18 0%, rgba(255,255,255,0.03) 60%, ${feature.accent}08 100%)`,
            border: `1px solid ${feature.accent}35`,
            boxShadow: `0 4px 40px ${feature.accent}18, 0 0 0 1px rgba(255,255,255,0.04) inset`,
            position: "relative", overflow: "hidden",
          }}>

          <div style={{
            position: "absolute", top: -40, right: -40, width: 200, height: 200,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${feature.accent}18 0%, transparent 70%)`,
            pointerEvents: "none",
          }} />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{
              fontSize: 9, fontWeight: 900, color: feature.accent,
              padding: "3px 10px", borderRadius: 99, letterSpacing: "0.08em",
              background: `${feature.accent}18`, border: `1px solid ${feature.accent}35`,
              textTransform: "uppercase",
            }}>
              {PHASE_META[feature.phase].label} · Coming Soon
            </div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.30)", fontWeight: 600 }}>
              Tap to preview →
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
            <motion.div
              animate={{ scale: [1, 1.06, 1], rotate: [0, 2, -2, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              style={{ fontSize: 38 }}>
              {feature.icon}
            </motion.div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1.2, marginBottom: 4 }}>
                {feature.title}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.40)", lineHeight: 1.5 }}>
                {feature.description.split(" ").slice(0, 14).join(" ")}…
              </div>
            </div>
          </div>

          <div style={{ height: 3, borderRadius: 99, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
            <motion.div
              animate={{ width: `${feature.readiness}%` }}
              transition={{ duration: 1.0, ease: IOS_EASE }}
              style={{
                height: "100%", borderRadius: 99,
                background: `linear-gradient(90deg, ${feature.accent}, ${feature.accent}99)`,
                boxShadow: `0 0 8px ${feature.accent}60`,
              }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", fontWeight: 600 }}>BUILD PROGRESS</span>
            <span style={{ fontSize: 9, fontWeight: 900, color: feature.accent }}>{feature.readiness}%</span>
          </div>
        </motion.div>
      </AnimatePresence>

      <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 12 }}>
        {HERO_FEATURES.map((f, i) => (
          <button key={f.id}
            onClick={() => { setActive(i); stop(); start(); }}
            style={{
              width: i === active ? 18 : 6, height: 6, borderRadius: 99, border: "none",
              background: i === active ? HERO_FEATURES[active]!.accent : "rgba(255,255,255,0.15)",
              cursor: "pointer",
              transition: `all 0.35s ${SPRING}`,
              boxShadow: i === active ? `0 0 8px ${HERO_FEATURES[active]!.accent}70` : "none",
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Stats strip ───────────────────────────────────────────────────────────────

function StatsStrip() {
  const stats = [
    { icon: <Rocket style={{ width: 12, height: 12 }} />, label: "Features",  value: "17" },
    { icon: <Zap     style={{ width: 12, height: 12 }} />, label: "In Dev",    value: "12" },
    { icon: <Sparkles style={{ width: 12, height: 12 }} />, label: "Phase 2", value: "7"  },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
      {stats.map((s, i) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08, type: "spring", stiffness: 380, damping: 28 }}
          style={{
            borderRadius: 14, padding: "12px 10px", textAlign: "center",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 4, color: "#A29BFE" }}>{s.icon}</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{s.value}</div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontWeight: 700, marginTop: 2, letterSpacing: "0.04em" }}>
            {s.label.toUpperCase()}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ── Phase filter tabs ─────────────────────────────────────────────────────────

type PhaseFilter = "all" | FeaturePhase;
const PHASE_FILTERS: { id: PhaseFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: 1,     label: "Phase 1" },
  { id: 2,     label: "Phase 2" },
  { id: 3,     label: "Phase 3" },
];

// ── Unlock toast ──────────────────────────────────────────────────────────────

interface UnlockToast {
  id:       number;
  featureId: string;
  newState: FeatureState;
}

// ── Main page ─────────────────────────────────────────────────────────────────

function buildStateMap(): Record<string, FeatureState> {
  const m: Record<string, FeatureState> = {};
  for (const f of APEX_FEATURES) m[f.id] = getFeatureState(f.id);
  return m;
}

export function ApexFeaturesPage() {
  const [, nav]             = useLocation();
  const [modal,  setModal]  = useState<ApexFeature | null>(null);
  const [search, setSearch] = useState("");
  const [phase,  setPhase]  = useState<PhaseFilter>("all");

  // Feature state map — re-read from storage whenever overrides change
  const [stateMap, setStateMap] = useState<Record<string, FeatureState>>(buildStateMap);
  const [newIds,   setNewIds]   = useState<Record<string, boolean>>({});

  // Dev panel — hidden, revealed by 5 taps on the title
  const [devOpen,   setDevOpen]   = useState(false);
  const [tapCount,  setTapCount]  = useState(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Unlock toasts
  const [toasts, setToasts] = useState<UnlockToast[]>([]);
  const toastId = useRef(0);

  function refreshStates() {
    setStateMap(buildStateMap());
  }

  // Listen for state changes from dev panel
  useEffect(() => {
    const handler = () => refreshStates();
    window.addEventListener("apex:statechange", handler);
    return () => window.removeEventListener("apex:statechange", handler);
  }, []);

  // Start unlock engine + subscribe to unlock events
  useEffect(() => {
    const stop = startUnlockEngine();
    const unsub = onFeatureUnlock((featureId, newState, _oldState) => {
      // Show glow on card
      setNewIds(prev => ({ ...prev, [featureId]: true }));
      setTimeout(() => setNewIds(prev => ({ ...prev, [featureId]: false })), 2500);

      // Show toast
      const tid = ++toastId.current;
      const feature = APEX_FEATURES.find(f => f.id === featureId);
      setToasts(prev => [...prev, { id: tid, featureId, newState }]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== tid)), 4000);

      // Refresh state map
      refreshStates();

      void feature; // suppress unused var warning
    });
    return () => { stop(); unsub(); };
  }, []);

  // Secret 5-tap dev panel trigger on the title text
  const handleTitleTap = useCallback(() => {
    if (tapTimer.current) clearTimeout(tapTimer.current);
    setTapCount(c => {
      const next = c + 1;
      if (next >= 5) {
        setDevOpen(true);
        return 0;
      }
      tapTimer.current = setTimeout(() => setTapCount(0), 1200);
      return next;
    });
  }, []);

  const filtered = APEX_FEATURES.filter(f => {
    const matchPhase  = phase === "all" || f.phase === phase;
    const q = search.toLowerCase();
    const matchSearch = !q || f.title.toLowerCase().includes(q) || f.description.toLowerCase().includes(q) || f.tags.some(t => t.toLowerCase().includes(q));
    return matchPhase && matchSearch;
  });

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      display: "flex", flexDirection: "column",
      background: "linear-gradient(180deg, #080A14 0%, #050710 100%)",
      fontFamily: "inherit",
    }}>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0, padding: "16px 18px 0",
        background: "rgba(8,10,20,0.95)", backdropFilter: "blur(20px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <button onClick={() => window.history.back()} style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)",
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            color: "rgba(255,255,255,0.60)", flexShrink: 0,
          }}>
            <ArrowLeft style={{ width: 15, height: 15 }} />
          </button>

          {/* Tappable title — 5 taps opens dev panel */}
          <div style={{ flex: 1 }} onClick={handleTitleTap} role="button" tabIndex={-1}>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1.2, userSelect: "none" }}>
              Apex Features
              {tapCount >= 2 && tapCount < 5 && (
                <span style={{ fontSize: 10, color: "#A29BFE", marginLeft: 6, fontWeight: 600 }}>
                  ({5 - tapCount} more…)
                </span>
              )}
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.30)", marginTop: 1 }}>
              Preview the future before it arrives
            </div>
          </div>

          {/* Live indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 99, background: "rgba(108,92,231,0.14)", border: "1px solid rgba(108,92,231,0.30)" }}>
            <motion.div
              animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
              transition={{ repeat: Infinity, duration: 1.8 }}
              style={{ width: 6, height: 6, borderRadius: "50%", background: "#A29BFE" }}
            />
            <span style={{ fontSize: 9, fontWeight: 800, color: "#A29BFE", letterSpacing: "0.04em" }}>LIVE ROADMAP</span>
          </div>
        </div>

        {/* Search */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "rgba(255,255,255,0.05)", borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.08)", padding: "9px 12px",
          marginBottom: 10,
        }}>
          <Search style={{ width: 13, height: 13, color: "rgba(255,255,255,0.30)", flexShrink: 0 }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search features…"
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              fontSize: 12, color: "#fff", fontFamily: "inherit",
            }}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.40)", padding: 0, display: "flex" }}>
              <X style={{ width: 12, height: 12 }} />
            </button>
          )}
        </div>

        {/* Phase filter tabs */}
        <div style={{ display: "flex", gap: 6, paddingBottom: 12 }}>
          {PHASE_FILTERS.map(f => {
            const isActive = phase === f.id;
            const meta = f.id !== "all" ? PHASE_META[f.id as FeaturePhase] : null;
            return (
              <motion.button key={f.id} whileTap={{ scale: 0.94 }}
                onClick={() => setPhase(f.id)}
                style={{
                  padding: "5px 12px", borderRadius: 99, cursor: "pointer", fontSize: 10, fontWeight: 800,
                  background: isActive ? (meta ? meta.bg : "rgba(255,255,255,0.10)") : "rgba(255,255,255,0.04)",
                  border: `1px solid ${isActive ? (meta ? meta.color + "50" : "rgba(255,255,255,0.20)") : "rgba(255,255,255,0.07)"}`,
                  color: isActive ? (meta ? meta.color : "#fff") : "rgba(255,255,255,0.35)",
                  transition: `all 0.22s ${IOS}`,
                }}>
                {f.label}
              </motion.button>
            );
          })}
          <div style={{ marginLeft: "auto", fontSize: 10, color: "rgba(255,255,255,0.25)", alignSelf: "center", fontWeight: 600 }}>
            {filtered.length} feature{filtered.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* ── Scrollable content ──────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px 100px", scrollbarWidth: "none" }}>

        {phase === "all" && !search && (
          <motion.section
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: IOS_EASE }}
            style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase" }}>Featured</span>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
            </div>
            <HeroCarousel onPreview={setModal} />
          </motion.section>
        )}

        {phase === "all" && !search && (
          <div style={{ marginBottom: 22 }}>
            <StatsStrip />
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase" }}>
            {phase === "all" ? "All Features" : PHASE_META[phase as FeaturePhase].label}
          </span>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
        </div>

        {/* Feature grid */}
        <AnimatePresence mode="popLayout">
          {filtered.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {filtered.map((feature, i) => (
                <FeatureCard
                  key={feature.id}
                  feature={feature}
                  state={stateMap[feature.id] ?? "locked"}
                  index={i}
                  isNew={newIds[feature.id] ?? false}
                  onPreview={setModal}
                />
              ))}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ textAlign: "center", padding: "48px 20px", color: "rgba(255,255,255,0.30)" }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🔍</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>No features match</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>Try a different search or phase filter</div>
            </motion.div>
          )}
        </AnimatePresence>

        {filtered.length > 0 && (
          <div style={{ textAlign: "center", marginTop: 28, padding: "14px 20px", borderRadius: 16, background: "rgba(108,92,231,0.07)", border: "1px solid rgba(108,92,231,0.15)" }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: "#A29BFE", letterSpacing: "0.08em", marginBottom: 4 }}>ROADMAP UPDATE</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", lineHeight: 1.6 }}>
              Features ship in phases. Enable notifications on the ones you want most.
            </div>
          </div>
        )}
      </div>

      {/* Feature preview modal */}
      <FeatureModal feature={modal} onClose={() => setModal(null)} />

      {/* Dev panel (hidden, 5 taps to reveal) */}
      <AnimatePresence>
        {devOpen && (
          <DevPanel
            onClose={() => setDevOpen(false)}
            onReset={refreshStates}
          />
        )}
      </AnimatePresence>

      {/* Unlock toasts */}
      <div style={{
        position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
        zIndex: 9800, display: "flex", flexDirection: "column", gap: 8, alignItems: "center",
        pointerEvents: "none",
      }}>
        <AnimatePresence>
          {toasts.map(t => {
            const feature  = APEX_FEATURES.find(f => f.id === t.featureId);
            const stateMeta = STATE_META[t.newState];
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 20, scale: 0.88 }}
                animate={{ opacity: 1, y: 0,  scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.92 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                style={{
                  display: "flex", alignItems: "center", gap: 9,
                  padding: "10px 16px", borderRadius: 99, whiteSpace: "nowrap",
                  background: "rgba(8,10,22,0.96)",
                  border: `1px solid ${stateMeta.border}`,
                  boxShadow: `0 8px 32px rgba(0,0,0,0.60), 0 0 20px ${stateMeta.glow}`,
                  backdropFilter: "blur(20px)",
                }}>
                <span style={{ fontSize: 16 }}>{feature?.icon ?? "✨"}</span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 900, color: "#fff" }}>
                    {feature?.title} unlocked!
                  </div>
                  <div style={{ fontSize: 9, color: stateMeta.color, fontWeight: 700 }}>
                    {stateMeta.icon} Now in {stateLabel(t.newState)}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
