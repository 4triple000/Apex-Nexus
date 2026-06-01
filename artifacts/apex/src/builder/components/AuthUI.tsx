import { useState } from "react";
import { useCanvasAuth } from "../useCanvasAuth";
import GoogleSignInButton from "./GoogleSignInButton";

const GRAD   = "linear-gradient(135deg,#6C5CE7,#A29BFE,#FD79A8)";
const PURPLE = "#A29BFE";
const PINK   = "#FD79A8";
const GREEN  = "#55EFC4";
const BG3    = "#12131F";

type Mode = "login" | "signup";

export default function AuthUI() {
  const { user, loading, error, isAuthed, signup, login, logout, clearError } = useCanvasAuth();
  const [mode, setMode]       = useState<Mode>("login");
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    clearError();
    setSubmitting(true);
    try {
      if (mode === "signup") {
        await signup(email, password, username || undefined);
      } else {
        await login(email, password);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Logged-in view ─────────────────────────────────────────────────────────
  if (isAuthed && user) {
    return (
      <div style={{ background: "#0A0A12", borderRadius: 12, padding: "14px 12px", display: "flex", flexDirection: "column", gap: 12 }}
           onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: GRAD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
            {user.username.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#E8EAED", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.username}</div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
          </div>
          <div style={{ fontSize: 8, fontWeight: 700, color: GREEN, background: "rgba(85,239,196,0.12)", borderRadius: 99, padding: "2px 7px", flexShrink: 0 }}>
            ● Active
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {[
            { icon: "🏗️", label: "Projects",  value: "3"    },
            { icon: "💬", label: "Messages",  value: "12"   },
            { icon: "⚡", label: "Score",     value: "1,240" },
            { icon: "🔑", label: "Session",   value: "Active" },
          ].map(s => (
            <div key={s.label} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 9, padding: "7px 9px", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ fontSize: 13, marginBottom: 3 }}>{s.icon}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: PURPLE }}>{s.value}</div>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)" }}>{s.label}</div>
            </div>
          ))}
        </div>

        <button
          onClick={e => { e.stopPropagation(); logout(); }}
          style={{ width: "100%", padding: "8px 0", borderRadius: 10, border: "1px solid rgba(253,121,168,0.2)", background: "rgba(253,121,168,0.06)", color: PINK, fontSize: 10, fontWeight: 700, cursor: "pointer" }}
        >
          Sign Out
        </button>
      </div>
    );
  }

  // ── Auth form ──────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} style={{ background: "#0A0A12", borderRadius: 12, overflow: "hidden" }}
          onClick={e => e.stopPropagation()}>
      {/* Header */}
      <div style={{ background: "rgba(108,92,231,0.08)", padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: "#E8EAED", marginBottom: 4 }}>
          {mode === "login" ? "🔑 Sign In" : "✨ Create Account"}
        </div>
        <div style={{ display: "flex", gap: 0, background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: 2 }}>
          {(["login", "signup"] as Mode[]).map(m => (
            <button key={m} type="button"
              onClick={e => { e.stopPropagation(); setMode(m); clearError(); }}
              style={{ flex: 1, padding: "4px 0", borderRadius: 6, border: "none", background: mode === m ? "rgba(162,155,254,0.2)" : "transparent", color: mode === m ? PURPLE : "rgba(255,255,255,0.3)", fontSize: 9, fontWeight: 700, cursor: "pointer" }}>
              {m === "login" ? "Login" : "Sign Up"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Error */}
        {error && (
          <div style={{ background: "rgba(255,95,109,0.1)", border: "1px solid rgba(255,95,109,0.2)", borderRadius: 8, padding: "6px 9px", fontSize: 9, color: "#FF5F6D" }}>
            ⚠️ {error}
          </div>
        )}

        {/* Username (signup only) */}
        {mode === "signup" && (
          <input
            type="text" value={username} onChange={e => setUsername(e.target.value)}
            placeholder="Username (optional)"
            style={{ width: "100%", padding: "7px 10px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.08)", background: BG3, color: "#E8EAED", fontSize: 10, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
          />
        )}

        <input
          type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="Email address"
          required
          style={{ width: "100%", padding: "7px 10px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.08)", background: BG3, color: "#E8EAED", fontSize: 10, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
        />

        <input
          type="password" value={password} onChange={e => setPassword(e.target.value)}
          placeholder={mode === "signup" ? "Password (min. 8 chars)" : "Password"}
          required
          style={{ width: "100%", padding: "7px 10px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.08)", background: BG3, color: "#E8EAED", fontSize: 10, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
        />

        <button
          type="submit"
          disabled={submitting || loading}
          style={{ width: "100%", padding: "10px 0", borderRadius: 10, border: "none", background: GRAD, color: "white", fontSize: 11, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: submitting ? 0.7 : 1 }}
        >
          {submitting
            ? <div style={{ width: 12, height: 12, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
            : mode === "login" ? "Sign In →" : "Create Account →"}
        </button>

        {/* Google divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
          <span style={{ fontSize: 8, color: "rgba(255,255,255,0.2)" }}>OR</span>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
        </div>

        <GoogleSignInButton />

        <div style={{ textAlign: "center", fontSize: 8, color: "rgba(255,255,255,0.2)" }}>
          {mode === "signup" ? "By signing up, you agree to our Terms" : "Secure session · Auto-expires in 30 days"}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </form>
  );
}
