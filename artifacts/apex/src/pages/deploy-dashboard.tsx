/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  APEX DEPLOY DASHBOARD                                                   ║
 * ║  All live apps · Status monitor · URL manager                           ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";

interface Deployment {
  id:        number;
  projectId: number;
  slug:      string;
  name:      string;
  status:    "pending" | "building" | "live" | "failed";
  url:       string | null;
  version:   number;
  language:  string;
  createdAt: string;
}

const SESSION_KEY = "apex-runtime-session";
const getSession  = () => localStorage.getItem(SESSION_KEY) ?? "runtime-default";

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "x-session-id": getSession() },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: string; label: string }> = {
  live:     { color: "#00b894", bg: "rgba(0,184,148,0.12)",   icon: "●", label: "Live"     },
  building: { color: "#fdcb6e", bg: "rgba(253,203,110,0.12)", icon: "⟳", label: "Building" },
  pending:  { color: "#a29bfe", bg: "rgba(162,155,254,0.12)", icon: "◎", label: "Pending"  },
  failed:   { color: "#ff7675", bg: "rgba(255,118,117,0.12)", icon: "✗", label: "Failed"   },
};

const LANG_CFG: Record<string, { icon: string; color: string }> = {
  html:       { icon: "🌐", color: "#e44d26" },
  javascript: { icon: "⚡", color: "#f7df1e" },
  python:     { icon: "🐍", color: "#3776ab" },
};

function copyText(text: string) {
  navigator.clipboard.writeText(text).catch(() => {
    const el = document.createElement("textarea");
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
  });
}

export default function DeployDashboardPage() {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [copied,      setCopied]      = useState<number | null>(null);
  const [filter,      setFilter]      = useState<"all" | "live" | "failed">("all");

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ deployments: Deployment[] }>("/deploy/all");
      setDeployments(data.deployments);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Poll for building deployments
  useEffect(() => {
    const building = deployments.filter(d => d.status === "building");
    if (building.length === 0) return;
    const id = setInterval(() => load(), 2000);
    return () => clearInterval(id);
  }, [deployments, load]);

  const copy = (url: string, id: number) => {
    copyText(url);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const filtered = deployments.filter(d =>
    filter === "all" ? true : d.status === filter
  );

  const liveCount     = deployments.filter(d => d.status === "live").length;
  const buildingCount = deployments.filter(d => d.status === "building").length;
  const failedCount   = deployments.filter(d => d.status === "failed").length;

  return (
    <div style={{
      minHeight: "100dvh",
      background: "transparent",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      color: "#fff",
    }}>
      {/* Header */}
      <div style={{
        position: "sticky", top: 0, zIndex: 20,
        background: "rgba(14,12,32,0.55)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        padding: "12px 16px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, maxWidth: 520, margin: "0 auto" }}>
          <Link href="/runtime">
            <button style={{
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8, padding: "6px 12px", color: "#b2bec3", fontSize: 12, cursor: "pointer",
            }}>← Runtime</button>
          </Link>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span>🚀</span>
              <span style={{ fontWeight: 800, fontSize: 15 }}>Deploy Dashboard</span>
            </div>
            <div style={{ color: "#636e72", fontSize: 11, marginTop: 1 }}>
              {liveCount} live · {buildingCount} building · {failedCount} failed
            </div>
          </div>
          <Link href="/runtime">
            <button style={{
              background: "linear-gradient(135deg, #7c5ce7, #a29bfe)",
              border: "none", borderRadius: 10, padding: "8px 14px",
              color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer",
            }}>+ New Deploy</button>
          </Link>
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "16px 16px 80px" }}>

        {/* Stats row */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {[
            { label: "Live",     value: liveCount,     color: "#00b894", icon: "●" },
            { label: "Building", value: buildingCount, color: "#fdcb6e", icon: "⟳" },
            { label: "Failed",   value: failedCount,   color: "#ff7675", icon: "✗" },
            { label: "Total",    value: deployments.length, color: "#a29bfe", icon: "⚡" },
          ].map(s => (
            <div key={s.label} style={{
              flex: 1, padding: "10px 8px", textAlign: "center",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 12,
            }}>
              <div style={{ color: s.color, fontWeight: 800, fontSize: 22 }}>{s.value}</div>
              <div style={{ color: "#636e72", fontSize: 9, fontWeight: 700, marginTop: 2, letterSpacing: "0.08em" }}>
                {s.label.toUpperCase()}
              </div>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {(["all", "live", "failed"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "7px 14px", borderRadius: 20, cursor: "pointer",
              background: filter === f ? "rgba(124,92,231,0.2)" : "rgba(255,255,255,0.05)",
              color: filter === f ? "#a29bfe" : "#636e72",
              fontWeight: filter === f ? 700 : 400, fontSize: 12,
              border: filter === f ? "1px solid rgba(124,92,231,0.4)" : "1px solid rgba(255,255,255,0.06)",
            } as React.CSSProperties}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
          <button onClick={load} style={{
            marginLeft: "auto", padding: "7px 12px", borderRadius: 20,
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
            color: "#636e72", fontSize: 12, cursor: "pointer",
          }}>
            ↻ Refresh
          </button>
        </div>

        {/* Deployment list */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#636e72" }}>Loading deployments…</div>
        ) : filtered.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "60px 24px",
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 20,
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🚀</div>
            <h3 style={{ fontWeight: 800, fontSize: 18, margin: "0 0 8px" }}>No deployments yet</h3>
            <p style={{ color: "#636e72", fontSize: 13, margin: "0 0 20px" }}>
              Open the Runtime Engine, write some code, and click Deploy.
            </p>
            <Link href="/runtime">
              <button style={{
                padding: "12px 24px", borderRadius: 12, border: "none",
                background: "linear-gradient(135deg, #7c5ce7, #a29bfe)",
                color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer",
              }}>
                Open Runtime Engine
              </button>
            </Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <AnimatePresence>
              {filtered.map(dep => {
                const sc   = STATUS_CONFIG[dep.status] ?? STATUS_CONFIG["pending"]!;
                const lang = LANG_CFG[dep.language] ?? LANG_CFG["javascript"]!;

                return (
                  <motion.div
                    key={dep.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: `1px solid ${dep.status === "live" ? "rgba(0,184,148,0.2)" : "rgba(255,255,255,0.07)"}`,
                      borderRadius: 16, overflow: "hidden",
                    }}
                  >
                    {/* Top strip for live apps */}
                    {dep.status === "live" && (
                      <div style={{
                        height: 2,
                        background: "linear-gradient(90deg, #00b894, #00cec9, transparent)",
                      }} />
                    )}

                    <div style={{ padding: "14px 16px" }}>
                      {/* Title row */}
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
                        {/* Lang icon */}
                        <div style={{
                          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                          background: `${lang.color}18`,
                          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
                        }}>
                          {lang.icon}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <span style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>{dep.name}</span>
                            <span style={{
                              padding: "2px 8px", borderRadius: 20, fontSize: 9, fontWeight: 700,
                              background: sc.bg, color: sc.color,
                            }}>
                              {dep.status === "building" ? (
                                <motion.span animate={{ rotate: 360 }}
                                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                  style={{ display: "inline-block", marginRight: 4 }}>⟳</motion.span>
                              ) : `${sc.icon} `}{sc.label.toUpperCase()}
                            </span>
                            <span style={{ color: "#636e72", fontSize: 11 }}>v{dep.version}</span>
                          </div>
                          <div style={{ color: "#636e72", fontSize: 11, marginTop: 2 }}>
                            {dep.slug} · {new Date(dep.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      {/* URL row */}
                      {dep.url && (
                        <div style={{
                          background: "rgba(0,0,0,0.3)", borderRadius: 10,
                          padding: "9px 12px", marginBottom: 10,
                          display: "flex", alignItems: "center", gap: 8,
                        }}>
                          <div style={{
                            width: 6, height: 6, borderRadius: "50%",
                            background: "#00b894",
                            boxShadow: "0 0 6px #00b894",
                            flexShrink: 0,
                            animation: "livePulse 2s ease-in-out infinite",
                          }} />
                          <span style={{
                            fontFamily: "monospace", fontSize: 11, color: "#00b894",
                            flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>
                            {dep.url}
                          </span>
                        </div>
                      )}

                      {/* Actions */}
                      <div style={{ display: "flex", gap: 8 }}>
                        {dep.url && (
                          <>
                            <motion.button whileTap={{ scale: 0.95 }}
                              onClick={() => copy(dep.url!, dep.id)}
                              style={{
                                flex: 1, padding: "9px 6px", borderRadius: 10, border: "none",
                                background: copied === dep.id ? "rgba(0,184,148,0.2)" : "rgba(255,255,255,0.07)",
                                color: copied === dep.id ? "#00b894" : "#b2bec3",
                                fontWeight: 700, fontSize: 12, cursor: "pointer",
                              }}>
                              {copied === dep.id ? "✓ Copied!" : "📋 Copy URL"}
                            </motion.button>
                            <motion.button whileTap={{ scale: 0.95 }}
                              onClick={() => window.open(dep.url!, "_blank")}
                              style={{
                                flex: 1, padding: "9px 6px", borderRadius: 10, border: "none",
                                background: "rgba(0,184,148,0.12)", color: "#00b894",
                                fontWeight: 700, fontSize: 12, cursor: "pointer",
                              }}>
                              🌐 Open Live App
                            </motion.button>
                          </>
                        )}
                        {dep.status === "failed" && (
                          <Link href="/runtime" style={{ flex: 1 }}>
                            <button style={{
                              width: "100%", padding: "9px", borderRadius: 10, border: "none",
                              background: "rgba(255,118,117,0.1)", color: "#ff7675",
                              fontWeight: 700, fontSize: 12, cursor: "pointer",
                            }}>
                              ↺ Re-deploy
                            </button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      <style>{`
        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(0.7); }
        }
        * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
        ::-webkit-scrollbar { width: 0; }
      `}</style>
    </div>
  );
}
