import { useState, useEffect } from "react";
import { useCanvasAuth } from "../useCanvasAuth";
import { getMyProjects, deleteProject, type CanvasProject } from "../authApi";

const GRAD   = "linear-gradient(135deg,#6C5CE7,#A29BFE,#FD79A8)";
const PURPLE = "#A29BFE";
const PINK   = "#FD79A8";
const GREEN  = "#55EFC4";
const CYAN   = "#00D2D3";

export default function UserProfile() {
  const { user, isAuthed, logout } = useCanvasAuth();
  const [projects, setProjects]    = useState<CanvasProject[]>([]);
  const [loading, setLoading]      = useState(false);

  useEffect(() => {
    if (!isAuthed) return;
    setLoading(true);
    getMyProjects().then(setProjects).catch(() => {}).finally(() => setLoading(false));
  }, [isAuthed]);

  const removeProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteProject(id).catch(() => {});
    setProjects(prev => prev.filter(p => p.id !== id));
  };

  if (!isAuthed || !user) {
    return (
      <div style={{ background: "#0A0A12", borderRadius: 12, padding: 18, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}
           onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 28 }}>🔒</div>
        <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>Sign in to view your profile</div>
        <div style={{ fontSize: 8, color: "rgba(255,255,255,0.2)" }}>Add an Auth block to enable sign-in</div>
      </div>
    );
  }

  const STAT_COLORS = [PURPLE, CYAN, GREEN, PINK];

  return (
    <div style={{ background: "#0A0A12", borderRadius: 12, overflow: "hidden" }}
         onClick={e => e.stopPropagation()}>
      {/* Profile header */}
      <div style={{ background: "linear-gradient(135deg,rgba(108,92,231,0.15),rgba(162,155,254,0.08))", padding: "12px 12px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: GRAD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0, boxShadow: "0 0 16px rgba(108,92,231,0.4)" }}>
            {user.username.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#E8EAED" }}>{user.username}</div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
            <div style={{ fontSize: 8, color: GREEN, marginTop: 2, fontWeight: 600 }}>● Session active</div>
          </div>
          <button onClick={e => { e.stopPropagation(); logout(); }} style={{ background: "rgba(253,121,168,0.1)", border: "1px solid rgba(253,121,168,0.2)", borderRadius: 8, padding: "4px 8px", color: PINK, fontSize: 9, cursor: "pointer", fontWeight: 600, flexShrink: 0 }}>
            Logout
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        {[
          { icon: "🏗️", v: projects.length, label: "Apps"    },
          { icon: "🔑", v: 1,               label: "Session" },
          { icon: "⚡", v: 24,              label: "Hours"   },
          { icon: "🛡️", v: 100,            label: "Secure"  },
        ].map((s, i) => (
          <div key={i} style={{ padding: "8px 4px", textAlign: "center", borderRight: i < 3 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
            <div style={{ fontSize: 13 }}>{s.icon}</div>
            <div style={{ fontSize: 11, fontWeight: 800, color: STAT_COLORS[i] }}>{s.v}</div>
            <div style={{ fontSize: 7, color: "rgba(255,255,255,0.25)" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Projects */}
      <div style={{ padding: "8px 10px" }}>
        <div style={{ fontSize: 8, fontWeight: 800, color: "rgba(255,255,255,0.25)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6 }}>
          Your Saved Apps ({projects.length})
        </div>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "8px 0" }}>
            <div style={{ width: 14, height: 14, border: "2px solid rgba(162,155,254,0.2)", borderTopColor: PURPLE, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
          </div>
        ) : projects.length === 0 ? (
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", textAlign: "center", padding: "8px 0" }}>
            No saved apps yet — generate one and save it!
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {projects.slice(0, 3).map(p => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", background: "rgba(255,255,255,0.03)", borderRadius: 9, border: "1px solid rgba(255,255,255,0.05)" }}>
                <span style={{ fontSize: 14 }}>{p.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#E8EAED", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                  <div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)" }}>{p.blockIds.length} blocks</div>
                </div>
                <button onClick={e => removeProject(p.id, e)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer", fontSize: 11, padding: "2px 4px" }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
