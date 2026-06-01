/**
 * WaitlistModal — Captures email interest for locked features.
 *
 * Behaviour:
 *  • If user is logged in → pre-fills email from localStorage (apex_auth_user)
 *  • Submits to POST /api/waitlist/join
 *  • Shows confirmation state on success
 *  • "Join Early Access" sets notifyEarlyAccess: true
 */
import { useState, useEffect } from "react";
import { Bell, Rocket, Check, X, Mail, Sparkles } from "lucide-react";
import type { FeatureConfig } from "@/lib/featureFlags";
import { useJoinWaitlist } from "@/hooks/useWaitlist";

const IOS    = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";
const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

interface WaitlistModalProps {
  feature:        FeatureConfig;
  mode:           "notify" | "early_access";
  onClose:        () => void;
  onSuccess:      (email: string, earlyAccess: boolean) => void;
}

export function WaitlistModal({ feature, mode, onClose, onSuccess }: WaitlistModalProps) {
  const [email, setEmail]     = useState("");
  const [done, setDone]       = useState(false);
  const [err, setErr]         = useState("");
  const join = useJoinWaitlist();

  const isEarlyAccess = mode === "early_access";
  const [c0, , c2] = feature.borderColors;

  // Pre-fill email from stored auth user
  useEffect(() => {
    try {
      const raw = localStorage.getItem("apex_auth_user");
      if (raw) {
        const user = JSON.parse(raw) as { email?: string };
        if (user.email) setEmail(user.email);
      }
    } catch { /* ignore */ }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!email.trim()) { setErr("Please enter your email."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErr("Please enter a valid email address."); return; }

    try {
      await join.mutateAsync({
        featureId:         feature.id,
        email:             email.trim(),
        notifyEarlyAccess: isEarlyAccess,
      });
      setDone(true);
      setTimeout(() => {
        onSuccess(email.trim(), isEarlyAccess);
        onClose();
      }, 1800);
    } catch (err) {
      console.error("[WaitlistModal] join failed:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setErr(msg.length < 120 ? msg : "Something went wrong. Please try again.");
    }
  }

  return (
    <>
      <style>{`
        @keyframes wl-bg-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes wl-modal-in {
          0%   { opacity: 0; transform: scale(0.90) translateY(20px); }
          70%  { opacity: 1; transform: scale(1.02) translateY(-2px); }
          100% { opacity: 1; transform: scale(1)    translateY(0);    }
        }
        @keyframes wl-success-in {
          0%   { transform: scale(0); opacity: 0; }
          60%  { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes wl-shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-5px); }
          40%, 80% { transform: translateX(5px); }
        }
      `}</style>

      {/* ── Backdrop ────────────────────────────────────────────────────────── */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 10000,
          background: "rgba(0,0,0,0.75)",
          backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "20px",
          animation: `wl-bg-in 0.18s ${IOS} both`,
        }}
        aria-modal="true"
        role="dialog"
      >

        {/* ── Modal card ──────────────────────────────────────────────────── */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "100%", maxWidth: 380,
            borderRadius: 24,
            background: "rgba(12,13,22,0.98)",
            border: `1px solid ${isEarlyAccess ? c2 : c0}35`,
            boxShadow: [
              `0 0 0 1px rgba(255,255,255,0.05)`,
              `0 0 30px ${isEarlyAccess ? c2 : c0}30`,
              `0 40px 80px rgba(0,0,0,0.70)`,
            ].join(", "),
            animation: `wl-modal-in 0.40s 0.02s ${SPRING} both`,
            overflow: "hidden",
          }}
        >
          {/* Gradient haze header */}
          <div style={{
            height: 4,
            background: `linear-gradient(90deg, ${feature.borderColors[0]}, ${feature.borderColors[1]}, ${feature.borderColors[2]})`,
          }} />

          <div style={{ padding: "24px 24px 20px" }}>

            {/* ── Close button ──────────────────────────────────────────── */}
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                position: "absolute", top: 16, right: 16,
                background: "rgba(255,255,255,0.06)",
                border: "none",
                borderRadius: "50%",
                width: 28, height: 28,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
                color: "rgba(255,255,255,0.40)",
                transition: `all 0.14s ${IOS}`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.12)";
                e.currentTarget.style.color = "white";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                e.currentTarget.style.color = "rgba(255,255,255,0.40)";
              }}
            >
              <X size={13} />
            </button>

            {done ? (
              /* ── Success state ─────────────────────────────────────────── */
              <div style={{ textAlign: "center", padding: "12px 0 8px" }}>
                <div style={{
                  width: 64, height: 64, borderRadius: "50%",
                  background: "rgba(74,222,128,0.14)",
                  border: "1px solid rgba(74,222,128,0.35)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 16px",
                  animation: `wl-success-in 0.50s ${SPRING}`,
                }}>
                  <Check size={28} color="#4ADE80" />
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 6 }}>
                  {isEarlyAccess ? "Request received!" : "You're on the list!"}
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.40)", lineHeight: 1.6 }}>
                  {isEarlyAccess
                    ? `We'll reach out at ${email} when early access opens for ${feature.name}.`
                    : `We'll notify ${email} the moment ${feature.name} goes live.`}
                </div>
              </div>
            ) : (
              /* ── Form state ──────────────────────────────────────────── */
              <>
                {/* Header row */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                    background: `linear-gradient(135deg, ${feature.gradient[0]}, ${feature.gradient[1]})`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 20,
                    boxShadow: `0 4px 16px ${feature.accentColor}40`,
                  }}>
                    {feature.icon}
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      <Sparkles size={9} color={isEarlyAccess ? c2 : c0} />
                      <span style={{
                        fontSize: 9, fontWeight: 800, letterSpacing: "0.08em",
                        color: isEarlyAccess ? c2 : c0,
                        textTransform: "uppercase",
                      }}>
                        {isEarlyAccess ? "Early Access" : "Get Notified"}
                      </span>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", lineHeight: 1.2 }}>
                      {feature.name}
                    </div>
                  </div>
                </div>

                {/* Hype copy */}
                <p style={{
                  fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.6,
                  marginBottom: 20,
                }}>
                  {isEarlyAccess
                    ? `Join a limited group who get early access to ${feature.name} before the public launch.`
                    : `You'll be notified the moment ${feature.name} drops. Be first in line.`}
                </p>

                {/* Email form */}
                <form onSubmit={handleSubmit}>
                  <div style={{
                    position: "relative",
                    marginBottom: err ? 8 : 14,
                  }}>
                    <Mail size={13} style={{
                      position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)",
                      color: "rgba(255,255,255,0.25)", pointerEvents: "none",
                    }} />
                    <input
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setErr(""); }}
                      style={{
                        width: "100%", boxSizing: "border-box",
                        padding: "12px 14px 12px 34px",
                        borderRadius: 12,
                        background: "rgba(255,255,255,0.06)",
                        border: `1px solid ${err ? "#EF444460" : "rgba(255,255,255,0.10)"}`,
                        color: "#fff", fontSize: 13,
                        outline: "none",
                        transition: `border-color 0.15s ${IOS}`,
                        animation: err ? `wl-shake 0.35s ease` : "none",
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = `${isEarlyAccess ? c2 : c0}60`;
                        e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = err ? "#EF444460" : "rgba(255,255,255,0.10)";
                        e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                      }}
                    />
                  </div>

                  {/* Error */}
                  {err && (
                    <div style={{
                      fontSize: 11, color: "#F87171",
                      marginBottom: 12, paddingLeft: 2,
                    }}>
                      {err}
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={join.isPending}
                    style={{
                      width: "100%", padding: "13px",
                      borderRadius: 13, cursor: join.isPending ? "wait" : "pointer",
                      background: isEarlyAccess
                        ? `linear-gradient(135deg, ${c2}, ${feature.borderColors[1]})`
                        : `linear-gradient(135deg, ${c0}, ${feature.borderColors[1]})`,
                      border: "none",
                      color: "#fff", fontSize: 13, fontWeight: 800,
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      transition: `all 0.25s ${SPRING}`,
                      opacity: join.isPending ? 0.7 : 1,
                      boxShadow: `0 4px 20px ${isEarlyAccess ? c2 : c0}40`,
                      letterSpacing: "-0.01em",
                    }}
                    onMouseEnter={(e) => { if (!join.isPending) e.currentTarget.style.transform = "translateY(-2px) scale(1.01)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; }}
                  >
                    {join.isPending ? (
                      <>
                        <div style={{
                          width: 13, height: 13, borderRadius: "50%",
                          border: "2px solid rgba(255,255,255,0.30)",
                          borderTopColor: "#fff",
                          animation: "spin 0.8s linear infinite",
                        }} />
                        Saving...
                      </>
                    ) : isEarlyAccess ? (
                      <><Rocket size={14} /> Join Early Access</>
                    ) : (
                      <><Bell size={14} /> Notify Me When Live</>
                    )}
                  </button>
                </form>

                {/* Privacy note */}
                <p style={{
                  fontSize: 10, color: "rgba(255,255,255,0.20)",
                  textAlign: "center", marginTop: 12,
                }}>
                  No spam — just one notification when it's ready.
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
