/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  APEX NEXUS DEV COCKPIT v2                                   ║
 * ║  Command Center · Dependency Engine · Version Control        ║
 * ║  Sandbox Mode · Global Settings · Mobile-First               ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";

import { DEFAULT_MODULES }      from "@/components/nexus/moduleData";
import { ModuleList }           from "@/components/nexus/ModuleList";
import { ModuleSettingsPanel }  from "@/components/nexus/ModuleSettingsPanel";
import { LiveTestScreen, DeployScreen } from "@/components/nexus/DevDashboard";
import { CommandCenter }        from "@/components/nexus/CommandCenter";
import { VersionControl }       from "@/components/nexus/VersionControl";
import { GlobalSettingsPanel }  from "@/components/nexus/GlobalSettings";
import { buildDepWarnings, autoEnableDeps, moduleLabel } from "@/components/nexus/dependencyEngine";

import type {
  Module, Screen, AppEnvironment,
  VersionSnapshot, GlobalSettings,
} from "@/components/nexus/types";
import { DEFAULT_GLOBAL_SETTINGS } from "@/components/nexus/types";

// ── Persistence ────────────────────────────────────────────────────────────────

const KEY_PROD    = "nexus-v2-prod";
const KEY_SANDBOX = "nexus-v2-sandbox";
const KEY_GLOBAL  = "nexus-v2-global";
const KEY_VERS    = "nexus-v2-versions";

function loadModules(key: string): Module[] {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const s = JSON.parse(raw) as Module[];
      if (Array.isArray(s) && s.length > 0) return s;
    }
  } catch { /**/ }
  return DEFAULT_MODULES.map((m) => ({ ...m }));
}
function save<T>(key: string, val: T) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /**/ }
}
function loadGlobal(): GlobalSettings {
  try {
    const raw = localStorage.getItem(KEY_GLOBAL);
    if (raw) return { ...DEFAULT_GLOBAL_SETTINGS, ...(JSON.parse(raw) as Partial<GlobalSettings>) };
  } catch { /**/ }
  return { ...DEFAULT_GLOBAL_SETTINGS };
}
function loadVersions(): VersionSnapshot[] {
  try {
    const raw = localStorage.getItem(KEY_VERS);
    if (raw) return JSON.parse(raw) as VersionSnapshot[];
  } catch { /**/ }
  return [];
}

// ── Tab Config ─────────────────────────────────────────────────────────────────

const TABS: { id: Screen; icon: string; label: string }[] = [
  { id: "modules",   icon: "⚡", label: "Modules"  },
  { id: "live-test", icon: "💬", label: "Test"     },
  { id: "versions",  icon: "📋", label: "Versions" },
  { id: "settings",  icon: "⚙️", label: "Settings" },
  { id: "deploy",    icon: "🚀", label: "Deploy"   },
];

// ── Main ───────────────────────────────────────────────────────────────────────

export default function NexusCockpit() {
  const [environment, setEnvironment] = useState<AppEnvironment>("sandbox");
  const [prodModules,    setProdModules]    = useState<Module[]>(() => loadModules(KEY_PROD));
  const [sandboxModules, setSandboxModules] = useState<Module[]>(() => loadModules(KEY_SANDBOX));
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>(loadGlobal);
  const [snapshots,  setSnapshots]  = useState<VersionSnapshot[]>(loadVersions);
  const [screen,     setScreen]     = useState<Screen>("modules");
  const [selected,   setSelected]   = useState<Module | null>(null);

  const modules    = environment === "production" ? prodModules : sandboxModules;
  const setModules = environment === "production" ? setProdModules : setSandboxModules;
  const envKey     = environment === "production" ? KEY_PROD : KEY_SANDBOX;

  const depWarnings = buildDepWarnings(modules);
  const activeCount = modules.filter((m) => m.enabled && m.status === "Active").length;

  // ── Module ops ──────────────────────────────────────────────────────────────

  const updateModules = useCallback((next: Module[]) => {
    if (environment === "production") setProdModules(next);
    else setSandboxModules(next);
    save(envKey, next);
  }, [environment, envKey]);

  const toggleModule = useCallback((id: string) => {
    setModules((prev) => {
      const mod    = prev.find((m) => m.id === id);
      if (!mod) return prev;
      const turnOn = !mod.enabled;
      const next   = prev.map((m) =>
        m.id === id ? { ...m, enabled: turnOn, status: (turnOn ? "Active" : "Disabled") as Module["status"] } : m,
      );
      save(envKey, next);
      return next;
    });
  }, [setModules, envKey]);

  const autoFixDeps = useCallback((id: string) => {
    setModules((prev) => {
      const next = autoEnableDeps(id, prev);
      save(envKey, next);
      return next;
    });
  }, [setModules, envKey]);

  const saveSettings = useCallback((id: string, settings: Record<string, string | boolean | number>) => {
    setModules((prev) => {
      const next = prev.map((m) => m.id === id ? { ...m, settings } : m);
      save(envKey, next);
      return next;
    });
    setSelected((sel) => sel?.id === id ? { ...sel, settings } : sel);
  }, [setModules, envKey]);

  const resetModules = useCallback(() => {
    const fresh = DEFAULT_MODULES.map((m) => ({ ...m }));
    updateModules(fresh);
  }, [updateModules]);

  // ── Global settings ─────────────────────────────────────────────────────────

  const updateGlobal = useCallback((g: GlobalSettings) => {
    setGlobalSettings(g);
    save(KEY_GLOBAL, g);
  }, []);

  // ── Version control ─────────────────────────────────────────────────────────

  const saveVersion = useCallback((label: string, note?: string) => {
    const snap: VersionSnapshot = {
      id: `v-${Date.now()}`,
      label,
      createdAt: Date.now(),
      environment,
      modules: modules.map((m) => ({ ...m })),
      globalSettings: { ...globalSettings },
      note,
    };
    setSnapshots((prev) => {
      const next = [snap, ...prev].slice(0, 20);
      save(KEY_VERS, next);
      return next;
    });
  }, [modules, globalSettings, environment]);

  const rollback = useCallback((snap: VersionSnapshot) => {
    updateModules(snap.modules.map((m) => ({ ...m })));
    updateGlobal({ ...snap.globalSettings });
  }, [updateModules, updateGlobal]);

  // ── Environment toggle ──────────────────────────────────────────────────────

  const switchEnv = () => setEnvironment((e) => e === "sandbox" ? "production" : "sandbox");

  const isSandbox = environment === "sandbox";

  return (
    <div style={{
      minHeight: "100dvh", background: "#0a0b14",
      display: "flex", flexDirection: "column",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      color: "#fff", maxWidth: 480, margin: "0 auto", position: "relative",
    }}>

      {/* ── Sticky header ─────────────────────────────────────────────────── */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(10,11,20,0.95)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        {/* Top row */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px 8px" }}>
          <Link href="/">
            <button style={{
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10, padding: "6px 12px", color: "#b2bec3", fontSize: 12, cursor: "pointer",
            }}>← App</button>
          </Link>

          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 16 }}>🛸</span>
              <span style={{ fontWeight: 800, fontSize: 15 }}>Nexus Cockpit</span>
              <span style={{
                fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 20,
                background: "rgba(124,92,231,0.2)", color: "#a29bfe",
                border: "1px solid rgba(124,92,231,0.3)",
              }}>v2</span>
            </div>
            <div style={{ color: "#636e72", fontSize: 10, marginTop: 1 }}>
              {activeCount} active · {globalSettings.personality} · {globalSettings.appMode}
            </div>
          </div>

          {/* Sandbox / Production toggle */}
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={switchEnv}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "6px 12px", borderRadius: 20, border: "none", cursor: "pointer",
              background: isSandbox ? "rgba(253,203,110,0.15)" : "rgba(0,184,148,0.15)",
              transition: "background 0.3s",
            }}
          >
            <motion.div
              animate={{ backgroundColor: isSandbox ? "#fdcb6e" : "#00b894" }}
              style={{ width: 6, height: 6, borderRadius: "50%" }}
            />
            <span style={{
              color: isSandbox ? "#fdcb6e" : "#00b894",
              fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
            }}>
              {isSandbox ? "SANDBOX" : "PROD"}
            </span>
          </motion.button>
        </div>

        {/* Command Center */}
        <CommandCenter
          modules={modules}
          globalSettings={globalSettings}
          onModulesChange={updateModules}
          onGlobalChange={updateGlobal}
        />

        {/* Dep warnings banner */}
        <AnimatePresence>
          {depWarnings.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              style={{
                margin: "8px 16px 0",
                padding: "8px 12px",
                background: "rgba(253,203,110,0.08)",
                border: "1px solid rgba(253,203,110,0.2)",
                borderRadius: 10,
              }}
            >
              <div style={{ color: "#fdcb6e", fontSize: 11, fontWeight: 600 }}>
                ⚠ {depWarnings.length} dependency warning{depWarnings.length > 1 ? "s" : ""}
              </div>
              {depWarnings.map((w) => (
                <div key={w.moduleId} style={{ color: "rgba(253,203,110,0.7)", fontSize: 10, marginTop: 2 }}>
                  {moduleLabel(w.moduleId, modules)} needs: {w.missingDeps.map((d) => moduleLabel(d, modules)).join(", ")}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Screen tabs */}
        <div style={{ display: "flex", gap: 4, padding: "10px 16px 10px", overflowX: "auto" }}>
          {TABS.map((tab) => {
            const active = screen === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setScreen(tab.id)}
                style={{
                  flexShrink: 0, padding: "7px 10px",
                  borderRadius: 10,
                  border: active ? "1px solid rgba(124,92,231,0.4)" : "1px solid rgba(255,255,255,0.06)",
                  background: active ? "rgba(124,92,231,0.15)" : "rgba(255,255,255,0.04)",
                  color: active ? "#a29bfe" : "#636e72",
                  fontWeight: active ? 700 : 500, fontSize: 11,
                  cursor: "pointer", transition: "all 0.2s",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                }}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Screen Content ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", position: "relative" }}>
        <AnimatePresence mode="wait">

          {/* MODULES */}
          {screen === "modules" && (
            <motion.div key="modules"
              initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.18 }}
              style={{ paddingTop: 14 }}
            >
              <div style={{ padding: "0 16px 12px" }}>
                <h2 style={{ fontWeight: 800, fontSize: 20, margin: 0 }}>Modules Manager</h2>
                <p style={{ color: "#636e72", fontSize: 12, margin: "4px 0 0" }}>
                  {isSandbox ? "🧪 Sandbox — changes don't affect production" : "🚀 Production — changes are live"}
                </p>
              </div>

              {/* Stats */}
              <div style={{ display: "flex", gap: 8, padding: "0 16px 14px" }}>
                {[
                  { label: "Active",   value: modules.filter((m) => m.enabled && m.status === "Active").length, color: "#00b894" },
                  { label: "Disabled", value: modules.filter((m) => !m.enabled).length, color: "#636e72" },
                  { label: "Warnings", value: depWarnings.length, color: "#fdcb6e" },
                  { label: "Versions", value: snapshots.length, color: "#a29bfe" },
                ].map((s) => (
                  <div key={s.label} style={{
                    flex: 1, padding: "10px 6px", textAlign: "center",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12,
                  }}>
                    <div style={{ color: s.color, fontWeight: 800, fontSize: 20 }}>{s.value}</div>
                    <div style={{ color: "#636e72", fontSize: 9, fontWeight: 600, marginTop: 2, letterSpacing: "0.06em" }}>
                      {s.label.toUpperCase()}
                    </div>
                  </div>
                ))}
              </div>

              <ModuleList
                modules={modules}
                depWarnings={depWarnings}
                onToggle={toggleModule}
                onSelect={setSelected}
                onAutoFix={autoFixDeps}
              />
            </motion.div>
          )}

          {/* LIVE TEST */}
          {screen === "live-test" && (
            <motion.div key="live-test"
              initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.18 }}
              style={{ height: "calc(100dvh - 200px)", display: "flex", flexDirection: "column" }}
            >
              <div style={{ padding: "14px 16px 8px" }}>
                <h2 style={{ fontWeight: 800, fontSize: 20, margin: 0 }}>Live Test Mode</h2>
                <p style={{ color: "#636e72", fontSize: 12, margin: "4px 0 0" }}>
                  Simulates {isSandbox ? "sandbox" : "production"} pipeline · {globalSettings.personality} personality
                </p>
              </div>
              <div style={{ flex: 1, overflow: "hidden" }}>
                <LiveTestScreen
                  modules={modules}
                  globalSettings={globalSettings}
                  environment={environment}
                />
              </div>
            </motion.div>
          )}

          {/* VERSIONS */}
          {screen === "versions" && (
            <motion.div key="versions"
              initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.18 }}
              style={{ paddingTop: 14 }}
            >
              <div style={{ padding: "0 16px 14px" }}>
                <h2 style={{ fontWeight: 800, fontSize: 20, margin: 0 }}>Version Control</h2>
                <p style={{ color: "#636e72", fontSize: 12, margin: "4px 0 0" }}>
                  Save snapshots · compare configs · roll back
                </p>
              </div>
              <VersionControl
                snapshots={snapshots}
                currentModules={modules}
                globalSettings={globalSettings}
                environment={environment}
                onSave={saveVersion}
                onRollback={rollback}
              />
            </motion.div>
          )}

          {/* GLOBAL SETTINGS */}
          {screen === "settings" && (
            <motion.div key="settings"
              initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.18 }}
              style={{ paddingTop: 14 }}
            >
              <div style={{ padding: "0 16px 14px" }}>
                <h2 style={{ fontWeight: 800, fontSize: 20, margin: 0 }}>Global Settings</h2>
                <p style={{ color: "#636e72", fontSize: 12, margin: "4px 0 0" }}>
                  Personality · mode · memory · system config
                </p>
              </div>
              <GlobalSettingsPanel settings={globalSettings} onChange={updateGlobal} />
            </motion.div>
          )}

          {/* DEPLOY */}
          {screen === "deploy" && (
            <motion.div key="deploy"
              initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.18 }}
              style={{ paddingTop: 14 }}
            >
              <div style={{ padding: "0 16px 14px" }}>
                <h2 style={{ fontWeight: 800, fontSize: 20, margin: 0 }}>Deploy Center</h2>
                <p style={{ color: "#636e72", fontSize: 12, margin: "4px 0 0" }}>
                  {isSandbox ? "Switch to Production to deploy" : "Deploy your live configuration"}
                </p>
              </div>
              <DeployScreen
                modules={modules}
                environment={environment}
                onSaveConfig={() => save(envKey, modules)}
                onReset={resetModules}
              />
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Module settings panel (bottom drawer) */}
      {selected && (
        <ModuleSettingsPanel
          module={selected}
          onClose={() => setSelected(null)}
          onSave={saveSettings}
        />
      )}

      {/* Global styles */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.55; transform: scale(0.82); }
        }
        * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
        input:focus, textarea:focus, select:focus {
          border-color: rgba(124,92,231,0.5) !important;
          box-shadow: 0 0 0 2px rgba(124,92,231,0.12);
        }
        ::-webkit-scrollbar { width: 0; height: 0; }
      `}</style>
    </div>
  );
}
