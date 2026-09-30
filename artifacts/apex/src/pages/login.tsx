/**
 * Login / Sign-up page — premium glass card, animated, mobile-first
 */
import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Eye, EyeOff, Mail, Lock, User, Zap, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const IOS    = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";
const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

// ── Animated background orbs ──────────────────────────────────────────────────
function Orbs() {
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }}>
      {/* Primary purple orb */}
      <div style={{
        position: "absolute", top: "-15%", left: "-10%",
        width: "55vw", height: "55vw", borderRadius: "50%",
        background: "radial-gradient(circle, rgba(108,92,231,0.28) 0%, rgba(108,92,231,0.06) 55%, transparent 70%)",
        animation: "orb-float 8s ease-in-out infinite",
        willChange: "transform",
      }} />
      {/* Pink orb */}
      <div style={{
        position: "absolute", bottom: "-10%", right: "-10%",
        width: "50vw", height: "50vw", borderRadius: "50%",
        background: "radial-gradient(circle, rgba(253,121,168,0.22) 0%, rgba(253,121,168,0.05) 55%, transparent 70%)",
        animation: "orb-float 10s 2s ease-in-out infinite reverse",
        willChange: "transform",
      }} />
      {/* Blue orb */}
      <div style={{
        position: "absolute", top: "40%", right: "5%",
        width: "35vw", height: "35vw", borderRadius: "50%",
        background: "radial-gradient(circle, rgba(162,155,254,0.15) 0%, transparent 70%)",
        animation: "orb-float 12s 1s ease-in-out infinite",
        willChange: "transform",
      }} />

      {/* Scanline overlay */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,0.008) 0px, rgba(255,255,255,0.008) 1px, transparent 1px, transparent 4px)",
        pointerEvents: "none",
      }} />
    </div>
  );
}

// ── Input field ───────────────────────────────────────────────────────────────
function AuthInput({
  type, placeholder, value, onChange, icon, rightSlot, error, autoComplete,
}: {
  type: string; placeholder: string; value: string;
  onChange: (v: string) => void; icon: React.ReactNode;
  rightSlot?: React.ReactNode; error?: boolean; autoComplete?: string;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <div style={{
      position: "relative",
      borderRadius: 16,
      background: focused
        ? "rgba(108,92,231,0.10)"
        : "rgba(255,255,255,0.04)",
      border: `1.5px solid ${
        error   ? "rgba(239,68,68,0.60)"
        : focused ? "rgba(108,92,231,0.55)"
        : "rgba(255,255,255,0.08)"
      }`,
      transition: `all 0.22s ${IOS}`,
      boxShadow: focused
        ? "0 0 0 3px rgba(108,92,231,0.12), 0 4px 20px rgba(108,92,231,0.10)"
        : error ? "0 0 0 3px rgba(239,68,68,0.08)" : "none",
    }}>
      {/* Icon */}
      <div style={{
        position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
        color: focused ? "#A29BFE" : "rgba(255,255,255,0.30)",
        transition: `color 0.20s ${IOS}`,
        display: "flex", alignItems: "center",
      }}>{icon}</div>

      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoComplete={autoComplete}
        style={{
          width: "100%", height: 52,
          paddingLeft: 44, paddingRight: rightSlot ? 44 : 16,
          fontSize: 14, color: "white",
          background: "transparent", border: "none", outline: "none",
          caretColor: "#A29BFE", boxSizing: "border-box",
        }}
      />

      {/* Right slot (show/hide password) */}
      {rightSlot && (
        <div style={{
          position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
          display: "flex", alignItems: "center",
        }}>{rightSlot}</div>
      )}
    </div>
  );
}

// ── Password field with show/hide toggle ─────────────────────────────────────
function PasswordInput({ placeholder, value, onChange, error, autoComplete }: {
  placeholder: string; value: string; onChange: (v: string) => void;
  error?: boolean; autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <AuthInput
      type={show ? "text" : "password"}
      placeholder={placeholder} value={value}
      onChange={onChange} error={error}
      autoComplete={autoComplete}
      icon={<Lock size={16} />}
      rightSlot={
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 2,
            color: "rgba(255,255,255,0.35)", display: "flex", alignItems: "center" }}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      }
    />
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const [, nav]  = useLocation();
  const { login, signup, isAuthenticated } = useAuth();

  const [mode, setMode]   = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [pass,  setPass]  = useState("");
  const [passConfirm, setPassConfirm] = useState("");
  const [username, setUsername]       = useState("");
  const [error,  setError]            = useState<string | null>(null);
  const [loading, setLoading]         = useState(false);
  const [success, setSuccess]         = useState(false);

  const cardRef  = useRef<HTMLDivElement>(null);
  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) nav("/");
  }, [isAuthenticated, nav]);

  // Shake animation on error
  useEffect(() => {
    if (!error || !cardRef.current) return;
    cardRef.current.animate(
      [{ transform: "translateX(0)" }, { transform: "translateX(-8px)" }, { transform: "translateX(8px)" },
       { transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "translateX(0)" }],
      { duration: 400, easing: "ease-out" }
    );
  }, [error]);

  function switchMode(m: "login" | "signup") {
    setMode(m); setError(null);
    setEmail(""); setPass(""); setPassConfirm(""); setUsername("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === "signup") {
      if (!email.trim())               { setError("Email is required"); return; }
      if (pass.length < 8)             { setError("Password must be at least 8 characters"); return; }
      if (pass !== passConfirm)        { setError("Passwords don't match"); return; }
    } else {
      if (!email.trim())               { setError("Email is required"); return; }
      if (!pass)                       { setError("Password is required"); return; }
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        await signup(email.trim(), pass, username.trim() || undefined);
      } else {
        await login(email.trim(), pass);
      }
      setSuccess(true);
      setTimeout(() => nav("/"), 600);
    } catch (err: unknown) {
      setError((err as Error).message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const isLogin  = mode === "login";
  const btnLabel = loading ? "" : isLogin ? "Sign In" : "Create Account";

  return (
    <div style={{
      minHeight: "100dvh", width: "100%",
      background: "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.03))",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "24px 16px", position: "relative",
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <Orbs />

      <div ref={cardRef} style={{
        width: "100%", maxWidth: 400, position: "relative", zIndex: 1,
        animation: "auth-card-in 0.50s cubic-bezier(0.34, 1.56, 0.64, 1) both",
      }}>

        {/* ── Logo + Brand ── */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 20, margin: "0 auto 16px",
            background: "linear-gradient(135deg, #6C5CE7 0%, #A29BFE 50%, #FD79A8 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 26, boxShadow: "0 8px 32px rgba(108,92,231,0.50), 0 0 0 1px rgba(162,155,254,0.20)",
            animation: "logo-pulse 3s ease-in-out infinite",
          }}>◆</div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: "white", margin: "0 0 6px", letterSpacing: "-0.03em" }}>
            {isLogin ? "Welcome back" : "Join Apex"}
          </h1>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.38)", margin: 0, letterSpacing: "0.01em" }}>
            {isLogin ? "Sign in to your AI assistant hub" : "Create your premium AI account"}
          </p>
        </div>

        {/* ── Glass card ── */}
        <div style={{
          borderRadius: 28,
          background: "rgba(14,12,32,0.55)",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          border: "1px solid rgba(255,255,255,0.09)",
          boxShadow: [
            "inset 0 0.5px 0 rgba(255,255,255,0.10)",
            "0 32px 80px rgba(0,0,0,0.60)",
            "0 8px 24px rgba(0,0,0,0.40)",
            "0 0 0 1px rgba(108,92,231,0.08)",
          ].join(", "),
          padding: "32px 28px",
          overflow: "hidden",
          position: "relative",
        }}>
          {/* Top accent line */}
          <div style={{
            position: "absolute", top: 0, left: "15%", right: "15%", height: 1,
            background: "linear-gradient(90deg, transparent, rgba(162,155,254,0.40), transparent)",
          }} />

          {/* ── Mode toggle pills ── */}
          <div style={{
            display: "flex", gap: 4, marginBottom: 28,
            background: "rgba(255,255,255,0.04)", borderRadius: 14, padding: 4,
            border: "1px solid rgba(255,255,255,0.06)",
          }}>
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 10, fontSize: 13,
                  fontWeight: 700, border: "none", cursor: "pointer",
                  background: mode === m
                    ? "linear-gradient(135deg, rgba(108,92,231,0.90), rgba(162,155,254,0.85))"
                    : "transparent",
                  color: mode === m ? "white" : "rgba(255,255,255,0.38)",
                  boxShadow: mode === m ? "0 2px 12px rgba(108,92,231,0.35)" : "none",
                  transition: `all 0.25s ${IOS}`,
                  letterSpacing: "0.01em",
                }}
              >
                {m === "login" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>

          {/* ── Form ── */}
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Username — signup only, animated in/out */}
            <div style={{
              maxHeight: !isLogin ? 64 : 0, opacity: !isLogin ? 1 : 0,
              overflow: "hidden",
              transition: `max-height 0.30s ${IOS}, opacity 0.25s ${IOS}`,
              marginBottom: !isLogin ? 0 : -12,
            }}>
              <AuthInput
                type="text" placeholder="Username (optional)"
                value={username} onChange={setUsername}
                icon={<User size={16} />} autoComplete="username"
              />
            </div>

            <AuthInput
              type="email" placeholder="Email address"
              value={email} onChange={setEmail}
              icon={<Mail size={16} />}
              error={!!error && (!email || error.toLowerCase().includes("email"))}
              autoComplete="email"
            />

            <PasswordInput
              placeholder="Password"
              value={pass} onChange={setPass}
              error={!!error && error.toLowerCase().includes("password")}
              autoComplete={isLogin ? "current-password" : "new-password"}
            />

            {/* Confirm password — signup only */}
            <div style={{
              maxHeight: !isLogin ? 64 : 0, opacity: !isLogin ? 1 : 0,
              overflow: "hidden",
              transition: `max-height 0.30s ${IOS}, opacity 0.25s ${IOS}`,
              marginBottom: !isLogin ? 0 : -12,
            }}>
              <PasswordInput
                placeholder="Confirm password"
                value={passConfirm} onChange={setPassConfirm}
                error={!!error && error.toLowerCase().includes("match")}
                autoComplete="new-password"
              />
            </div>

            {/* Error message */}
            {error && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 14px", borderRadius: 12,
                background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)",
                animation: "error-in 0.22s ease-out both",
              }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#EF4444", flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "#FCA5A5", fontWeight: 500, lineHeight: 1.4 }}>{error}</span>
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading || success}
              style={{
                marginTop: 4, height: 52, borderRadius: 16, border: "none",
                fontSize: 15, fontWeight: 800, cursor: loading || success ? "default" : "pointer",
                background: success
                  ? "linear-gradient(135deg, #10B981, #059669)"
                  : "linear-gradient(135deg, #6C5CE7 0%, #A29BFE 50%, #FD79A8 100%)",
                color: "white", letterSpacing: "0.01em",
                boxShadow: success
                  ? "0 4px 20px rgba(16,185,129,0.40)"
                  : "0 4px 24px rgba(108,92,231,0.50), 0 2px 8px rgba(0,0,0,0.30)",
                transition: `all 0.30s ${IOS}`,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                opacity: loading ? 0.80 : 1,
                transform: loading ? "scale(0.98)" : "scale(1)",
              }}
            >
              {loading ? (
                <Loader2 size={20} style={{ animation: "spin 0.8s linear infinite" }} />
              ) : success ? (
                <>✓ Welcome to Apex</>
              ) : (
                <>{btnLabel} <ArrowRight size={16} style={{ marginLeft: 2 }} /></>
              )}
            </button>

            {/* Forgot password — login only */}
            {isLogin && (
              <div style={{ textAlign: "center", marginTop: 4 }}>
                <button
                  type="button"
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: 12, color: "rgba(162,155,254,0.70)",
                    fontWeight: 600, letterSpacing: "0.01em",
                    transition: `color 0.18s ${IOS}`,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#A29BFE")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(162,155,254,0.70)")}
                >
                  Forgot password?
                </button>
              </div>
            )}

          </form>

          {/* ── OR divider ── */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "24px 0" }}>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontWeight: 600, letterSpacing: "0.06em" }}>OR</span>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
          </div>

          {/* ── Google SSO (UI only) ── */}
          <button
            type="button"
            style={{
              width: "100%", height: 50, borderRadius: 14,
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              cursor: "pointer", fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.70)",
              transition: `all 0.20s ${IOS}`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.07)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.04)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)";
            }}
          >
            {/* Google "G" icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

        </div>

        {/* ── Bottom switch ── */}
        <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "rgba(255,255,255,0.30)" }}>
          {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => switchMode(isLogin ? "signup" : "login")}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 700, color: "#A29BFE",
              transition: `opacity 0.18s ${IOS}`,
            }}
          >
            {isLogin ? "Sign up free" : "Sign in"}
          </button>
        </p>

        {/* ── Guest access ── */}
        <div style={{ marginTop: 16, textAlign: "center" }}>
          <button
            type="button"
            onClick={() => nav("/")}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 12, color: "rgba(255,255,255,0.35)",
              letterSpacing: "0.02em", padding: "8px 16px",
              borderRadius: 10,
              transition: `color 0.18s ${IOS}`,
              textDecoration: "underline",
              textDecorationColor: "rgba(255,255,255,0.15)",
              textUnderlineOffset: "3px",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.60)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
          >
            Continue without an account →
          </button>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.18)", margin: "4px 0 0" }}>
            You can always sign in later
          </p>
        </div>

        {/* ── Security note ── */}
        <p style={{ textAlign: "center", marginTop: 12, fontSize: 10, color: "rgba(255,255,255,0.18)" }}>
          🔒 Secured · Your data is encrypted
        </p>
      </div>

      {/* ── CSS animations (injected via style tag) ── */}
      <style>{`
        @keyframes orb-float {
          0%, 100% { transform: translateY(0px) scale(1); }
          33%       { transform: translateY(-18px) scale(1.03); }
          66%       { transform: translateY(10px) scale(0.97); }
        }
        @keyframes auth-card-in {
          from { opacity: 0; transform: translateY(28px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes logo-pulse {
          0%, 100% { box-shadow: 0 8px 32px rgba(108,92,231,0.50), 0 0 0 1px rgba(162,155,254,0.20); }
          50%       { box-shadow: 0 8px 48px rgba(108,92,231,0.75), 0 0 0 1px rgba(162,155,254,0.35), 0 0 0 6px rgba(108,92,231,0.12); }
        }
        @keyframes error-in {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
