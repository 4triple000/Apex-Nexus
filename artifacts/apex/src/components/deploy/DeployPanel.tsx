/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  DEPLOY PANEL — One-Click Deploy UI                                      ║
 * ║  Bottom-sheet component used inside the Runtime Engine                   ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { authHeaders } from "@/lib/authSession";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Deployment {
  id:        number;
  slug:      string;
  name:      string;
  status:    "pending" | "building" | "live" | "failed";
  url:       string | null;
  version:   number;
  language:  string;
  error:     string | null;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  projectId:  number;
  projectName:string;
  sessionId:  string;
  onClose:    () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SESSION_KEY = "apex-runtime-session";
function getSessionId(): string {
  return localStorage.getItem(SESSION_KEY) ?? "runtime-default";
}

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", "x-session-id": getSessionId() },
    ...opts,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

const LANG_COLOR: Record<string, string> = {
  html: "#e44d26", javascript: "#f7df1e", python: "#3776ab",
};
const LANG_ICON: Record<string, string> = {
  html: "🌐", javascript: "⚡", python: "🐍",
};
const STATUS_COLOR: Record<string, string> = {
  live:     "#00b894",
  building: "#fdcb6e",
  pending:  "#a29bfe",
  failed:   "#ff7675",
};
const STATUS_ICON: Record<string, string> = {
  live:     "✓",
  building: "⟳",
  pending:  "◎",
  failed:   "✗",
};

function copyToClipboard(text: string): void {
  navigator.clipboard.writeText(text).catch(() => {
    const el = document.createElement("textarea");
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
  });
}

// ── Main Component ────────────────────────────────────────────────────────────

export function DeployPanel({ projectId, projectName, onClose }: Props) {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [deploying,   setDeploying]   = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [copied,      setCopied]      = useState<number | null>(null);
  const [expandedId,  setExpandedId]  = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load deployments ────────────────────────────────────────────────────────
  const loadDeployments = useCallback(async () => {
    try {
      const data = await apiFetch<{ deployments: Deployment[] }>(
        `/api/deploy/projects/${projectId}/deployments`
      );
      setDeployments(data.deployments);
    } catch { /**/ }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { loadDeployments(); }, [loadDeployments]);

  // ── Poll building deployments ───────────────────────────────────────────────
  const pollBuilding = useCallback(async (depId: number) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const data = await apiFetch<{ id: number; status: string; url: string | null; error: string | null }>(
          `/api/deploy/status/${depId}`
        );
        setDeployments(prev => prev.map(d =>
          d.id === depId
            ? { ...d, status: data.status as Deployment["status"], url: data.url, error: data.error }
            : d
        ));
        if (data.status === "live" || data.status === "failed") {
          if (pollRef.current) clearInterval(pollRef.current);
          setDeploying(false);
        }
      } catch { /**/ }
    }, 1000);
  }, []);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // ── One-click deploy ────────────────────────────────────────────────────────
  const deploy = async () => {
    setDeploying(true);
    try {
      const data = await apiFetch<{ deploymentId: number; slug: string; status: string; version: number }>(
        `/api/deploy/projects/${projectId}`,
        { method: "POST", headers: { "Content-Type": "application/json", "x-session-id": getSessionId(), ...authHeaders() } }
      );

      // Optimistically add/update deployment in list
      const optimistic: Deployment = {
        id:        data.deploymentId,
        slug:      data.slug,
        name:      projectName,
        status:    "building",
        url:       null,
        version:   data.version,
        language:  "html",
        error:     null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setDeployments(prev => {
        const exists = prev.find(d => d.id === data.deploymentId);
        if (exists) return prev.map(d => d.id === data.deploymentId ? { ...d, status: "building", url: null } : d);
        return [optimistic, ...prev];
      });
      setExpandedId(data.deploymentId);
      await pollBuilding(data.deploymentId);
    } catch (e) {
      console.error(e);
      setDeploying(false);
    }
  };

  const copy = (url: string, id: number) => {
    copyToClipboard(url);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const liveDeployment = deployments.find(d => d.status === "live");
  const isBuilding     = deployments.some(d => d.status === "building");

  return (
    <>
      {/* Backdrop */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 100, backdropFilter: "blur(4px)" }}
      />

      {/* Panel */}
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 36 }}
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 101,
          background: "rgba(30,26,62,0.62)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "22px 22px 0 0",
          maxHeight: "88vh", overflowY: "auto",
          paddingBottom: "env(safe-area-inset-bottom, 20px)",
          fontFamily: "'Inter', -apple-system, sans-serif",
        }}
      >
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 12 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)" }} />
        </div>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center",
          padding: "14px 20px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
              <span style={{ fontSize: 18 }}>🚀</span>
              <span style={{ color: "#fff", fontWeight: 800, fontSize: 17 }}>One-Click Deploy</span>
            </div>
            <div style={{ color: "#636e72", fontSize: 12 }}>
              {projectName} · Apex Hosted · Public URL
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: "50%", border: "none",
            background: "rgba(255,255,255,0.08)", color: "#fff", fontSize: 18,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          }}>×</button>
        </div>

        <div style={{ padding: "16px 20px 0" }}>

          {/* Live URL hero card */}
          <AnimatePresence>
            {liveDeployment?.url && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                style={{
                  background: "linear-gradient(135deg, rgba(0,184,148,0.12), rgba(0,206,201,0.08))",
                  border: "1px solid rgba(0,184,148,0.3)",
                  borderRadius: 16, padding: "14px 16px", marginBottom: 16,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%", background: "#00b894",
                    boxShadow: "0 0 8px #00b894",
                    animation: "livePulse 2s ease-in-out infinite",
                  }} />
                  <span style={{ color: "#00b894", fontWeight: 800, fontSize: 13 }}>LIVE v{liveDeployment.version}</span>
                </div>
                <div style={{
                  background: "rgba(0,0,0,0.3)", borderRadius: 10,
                  padding: "10px 12px", marginBottom: 10,
                  fontFamily: "monospace", fontSize: 12, color: "#00b894",
                  wordBreak: "break-all",
                }}>
                  {liveDeployment.url}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <motion.button whileTap={{ scale: 0.95 }}
                    onClick={() => copy(liveDeployment.url!, liveDeployment.id)}
                    style={{
                      flex: 1, padding: "10px", borderRadius: 10, border: "none",
                      background: copied === liveDeployment.id ? "rgba(0,184,148,0.3)" : "rgba(255,255,255,0.08)",
                      color: copied === liveDeployment.id ? "#00b894" : "#b2bec3",
                      fontWeight: 700, fontSize: 12, cursor: "pointer",
                    }}>
                    {copied === liveDeployment.id ? "✓ Copied!" : "📋 Copy URL"}
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.95 }}
                    onClick={() => window.open(liveDeployment.url!, "_blank")}
                    style={{
                      flex: 1, padding: "10px", borderRadius: 10, border: "none",
                      background: "rgba(0,184,148,0.15)", color: "#00b894",
                      fontWeight: 700, fontSize: 12, cursor: "pointer",
                    }}>
                    🌐 Open App
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Building status card */}
          <AnimatePresence>
            {isBuilding && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                style={{
                  background: "rgba(253,203,110,0.08)",
                  border: "1px solid rgba(253,203,110,0.25)",
                  borderRadius: 14, padding: "14px 16px", marginBottom: 16,
                  overflow: "hidden",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                    style={{
                      width: 20, height: 20, borderRadius: "50%",
                      border: "2px solid #fdcb6e", borderTopColor: "transparent",
                    }}
                  />
                  <div>
                    <div style={{ color: "#fdcb6e", fontWeight: 700, fontSize: 13 }}>Building…</div>
                    <div style={{ color: "rgba(253,203,110,0.6)", fontSize: 11, marginTop: 1 }}>
                      Packaging files and going live
                    </div>
                  </div>
                </div>

                {/* Progress dots */}
                <div style={{ display: "flex", gap: 6, marginTop: 12, paddingLeft: 2 }}>
                  {["Packaging files", "Validating code", "Publishing", "Going live"].map((step, i) => (
                    <div key={step} style={{ flex: 1, textAlign: "center" }}>
                      <motion.div
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
                        style={{
                          height: 3, borderRadius: 2, background: "#fdcb6e",
                          marginBottom: 4,
                        }}
                      />
                      <span style={{ fontSize: 9, color: "rgba(253,203,110,0.5)" }}>{step}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Deploy / Re-deploy button */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={deploy}
            disabled={deploying}
            style={{
              width: "100%", padding: "16px", borderRadius: 14, border: "none",
              background: deploying
                ? "rgba(255,255,255,0.06)"
                : liveDeployment
                ? "linear-gradient(135deg, #00b894, #00cec9)"
                : "linear-gradient(135deg, #7c5ce7, #a29bfe)",
              color: deploying ? "#636e72" : "#fff",
              fontWeight: 800, fontSize: 16,
              cursor: deploying ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              boxShadow: deploying ? "none" : "0 6px 24px rgba(124,92,231,0.3)",
              marginBottom: 20,
              transition: "all 0.3s",
            }}
          >
            {deploying ? (
              <>
                <motion.span animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  style={{ display: "inline-block" }}>⟳</motion.span>
                Deploying…
              </>
            ) : liveDeployment ? (
              <><span>🔄</span> Re-deploy Latest Changes</>
            ) : (
              <><span>🚀</span> Deploy Now — Go Live</>
            )}
          </motion.button>

          {/* How it works */}
          {deployments.length === 0 && !loading && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 10 }}>
                HOW IT WORKS
              </p>
              {[
                ["1", "Click Deploy Now", "Your project files are packaged instantly"],
                ["2", "Build runs", "Code is validated and prepared for serving"],
                ["3", "Live URL generated", "A public URL is created on the Apex domain"],
                ["4", "Share anywhere", "Copy the URL and share your running app"],
              ].map(([num, title, desc]) => (
                <div key={num} style={{
                  display: "flex", gap: 12, padding: "8px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                    background: "rgba(124,92,231,0.2)", border: "1px solid rgba(124,92,231,0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#a29bfe", fontWeight: 800, fontSize: 11,
                  }}>{num}</div>
                  <div>
                    <div style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{title}</div>
                    <div style={{ color: "#636e72", fontSize: 11 }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Deployment history */}
          {deployments.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 10 }}>
                DEPLOYMENT HISTORY
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {deployments.map(dep => (
                  <motion.div key={dep.id} layout
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: `1px solid ${dep.status === "live" ? "rgba(0,184,148,0.2)" : dep.status === "failed" ? "rgba(255,118,117,0.2)" : "rgba(255,255,255,0.07)"}`,
                      borderRadius: 12, overflow: "hidden",
                    }}
                  >
                    <div
                      onClick={() => setExpandedId(expandedId === dep.id ? null : dep.id)}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "10px 12px", cursor: "pointer",
                      }}
                    >
                      {/* Status dot */}
                      <div style={{
                        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                        background: `${STATUS_COLOR[dep.status] ?? "#636e72"}18`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: STATUS_COLOR[dep.status] ?? "#636e72",
                        fontSize: dep.status === "building" ? 14 : 13,
                      }}>
                        {dep.status === "building" ? (
                          <motion.span animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            style={{ display: "inline-block" }}>⟳</motion.span>
                        ) : STATUS_ICON[dep.status]}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ color: "#fff", fontWeight: 600, fontSize: 13 }}>
                            v{dep.version}
                          </span>
                          <span style={{
                            fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 20,
                            background: `${STATUS_COLOR[dep.status] ?? "#636e72"}18`,
                            color: STATUS_COLOR[dep.status] ?? "#636e72",
                          }}>
                            {dep.status.toUpperCase()}
                          </span>
                          <span style={{ fontSize: 10 }}>{LANG_ICON[dep.language] ?? "⚡"}</span>
                        </div>
                        <div style={{ color: "#636e72", fontSize: 11, marginTop: 2 }}>
                          {new Date(dep.updatedAt).toLocaleString()}
                        </div>
                      </div>

                      <span style={{ color: "#636e72", fontSize: 12 }}>
                        {expandedId === dep.id ? "▲" : "▼"}
                      </span>
                    </div>

                    <AnimatePresence>
                      {expandedId === dep.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          style={{
                            borderTop: "1px solid rgba(255,255,255,0.06)",
                            overflow: "hidden",
                          }}
                        >
                          <div style={{ padding: "10px 12px" }}>
                            {dep.url ? (
                              <>
                                <div style={{
                                  background: "rgba(0,0,0,0.3)", borderRadius: 8,
                                  padding: "8px 10px", marginBottom: 8,
                                  fontFamily: "monospace", fontSize: 11, color: "#00b894",
                                  wordBreak: "break-all",
                                }}>
                                  {dep.url}
                                </div>
                                <div style={{ display: "flex", gap: 6 }}>
                                  <button onClick={() => copy(dep.url!, dep.id)} style={{
                                    flex: 1, padding: "8px", borderRadius: 8, border: "none",
                                    background: copied === dep.id ? "rgba(0,184,148,0.2)" : "rgba(255,255,255,0.07)",
                                    color: copied === dep.id ? "#00b894" : "#b2bec3",
                                    fontSize: 11, fontWeight: 700, cursor: "pointer",
                                  }}>
                                    {copied === dep.id ? "✓ Copied" : "📋 Copy"}
                                  </button>
                                  <button onClick={() => window.open(dep.url!, "_blank")} style={{
                                    flex: 1, padding: "8px", borderRadius: 8, border: "none",
                                    background: "rgba(0,184,148,0.12)", color: "#00b894",
                                    fontSize: 11, fontWeight: 700, cursor: "pointer",
                                  }}>
                                    🌐 Open
                                  </button>
                                </div>
                              </>
                            ) : dep.status === "failed" ? (
                              <div style={{
                                padding: "8px 10px", borderRadius: 8,
                                background: "rgba(255,118,117,0.08)", color: "#ff7675", fontSize: 11,
                              }}>
                                ✗ {dep.error ?? "Deployment failed"}
                              </div>
                            ) : (
                              <div style={{ color: "#636e72", fontSize: 11, textAlign: "center", padding: "8px 0" }}>
                                Building…
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>

      <style>{`
        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.6; transform: scale(0.8); }
        }
      `}</style>
    </>
  );
}
