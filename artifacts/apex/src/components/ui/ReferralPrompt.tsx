/**
 * ReferralPrompt — Share to unlock modal
 *
 * Shows the user's unique referral link, share options,
 * progress toward unlock threshold, and simulates referral receipt.
 */
import { useState, useEffect } from "react";
import { X, Copy, Check, Share2, Users, ExternalLink, Zap } from "lucide-react";
import {
  getReferralCode,
  getReferralCount,
  getReferralUrl,
  getUnlockThreshold,
  tryUnlockViaReferral,
  getShareText,
} from "@/lib/referralSystem";
import type { FeatureConfig } from "@/lib/featureFlags";

const IOS    = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";
const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

interface ReferralPromptProps {
  feature:    FeatureConfig;
  onClose:    () => void;
  onUnlocked: () => void;
}

export function ReferralPrompt({ feature, onClose, onUnlocked }: ReferralPromptProps) {
  const [count,        setCount]        = useState(getReferralCount());
  const [copied,       setCopied]       = useState(false);
  const [unlockAnim,   setUnlockAnim]   = useState(false);

  const threshold  = getUnlockThreshold(feature.id);
  const code       = getReferralCode();
  const shareUrl   = getReferralUrl(feature.id);
  const shareText  = getShareText(feature.name);
  const [c0, c1]   = feature.borderColors;
  const accent     = feature.accentColor;
  const pct        = Math.min(100, (count / threshold) * 100);
  const canUnlock  = count >= threshold;

  function copyLink() {
    navigator.clipboard.writeText(shareUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function handleUnlock() {
    if (tryUnlockViaReferral(feature.id)) {
      setUnlockAnim(true);
      setTimeout(onUnlocked, 900);
    }
  }

  // Referral count updates come from real backend tracking only (no simulation)

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      display: "flex", alignItems: "flex-end", justifyContent: "center",
      padding: "0 0 0 0",
      background: "rgba(4,5,10,0.80)",
      backdropFilter: "blur(18px)",
      WebkitBackdropFilter: "blur(18px)",
      animation: `ref-bg-in 0.18s ${IOS} both`,
    }}>
      <style>{`
        @keyframes ref-bg-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ref-sheet-in {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        @keyframes ref-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.6; }
        }
        @keyframes ref-unlock {
          0%   { transform: scale(1); }
          30%  { transform: scale(1.06); }
          60%  { transform: scale(0.97); }
          100% { transform: scale(1); }
        }
      `}</style>

      {/* Bottom sheet */}
      <div style={{
        width: "100%", maxWidth: 480,
        background: "rgba(10,11,20,0.98)",
        borderRadius: "24px 24px 0 0",
        border: `1px solid ${accent}25`,
        borderBottom: "none",
        padding: "24px 24px 40px",
        animation: `ref-sheet-in 0.40s ${SPRING} both`,
        boxShadow: `0 -20px 60px rgba(0,0,0,0.60), 0 0 40px ${accent}15`,
        position: "relative",
      }}>
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: 16, right: 16,
            width: 30, height: 30, borderRadius: 8,
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)",
            color: "rgba(255,255,255,0.45)", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        ><X style={{ width: 13, height: 13 }} /></button>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{
            width: 50, height: 50, borderRadius: 14, margin: "0 auto 14px",
            background: `linear-gradient(135deg, ${feature.gradient[0]}, ${feature.gradient[1]})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22,
            boxShadow: `0 0 24px ${accent}50`,
            animation: unlockAnim ? `ref-unlock 0.6s ${SPRING}` : "none",
          }}>
            {unlockAnim ? "🔓" : feature.icon}
          </div>
          <div style={{ fontSize: 17, fontWeight: 900, color: "#fff", letterSpacing: "-0.02em" }}>
            Share to Unlock
          </div>
          <div style={{
            fontSize: 12, color: "rgba(255,255,255,0.40)",
            marginTop: 6, lineHeight: 1.5,
          }}>
            Invite {threshold} friend{threshold !== 1 ? "s" : ""} to unlock{" "}
            <span style={{ color: accent, fontWeight: 700 }}>{feature.name}</span> for free
          </div>
        </div>

        {/* Progress ring + stats */}
        <div style={{
          display: "flex", alignItems: "center", gap: 16, marginBottom: 22,
          padding: "14px 16px", borderRadius: 14,
          background: "rgba(255,255,255,0.03)",
          border: `1px solid ${accent}18`,
        }}>
          {/* Progress circle */}
          <div style={{ position: "relative", width: 58, height: 58, flexShrink: 0 }}>
            <svg width="58" height="58" viewBox="0 0 58 58">
              <circle cx="29" cy="29" r="24" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
              <circle
                cx="29" cy="29" r="24"
                fill="none"
                stroke={accent}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 24}`}
                strokeDashoffset={`${2 * Math.PI * 24 * (1 - pct / 100)}`}
                transform="rotate(-90 29 29)"
                style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.34,1.20,0.64,1) 0.3s", filter: `drop-shadow(0 0 4px ${accent}80)` }}
              />
            </svg>
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontSize: 16, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{count}</span>
              <span style={{ fontSize: 8,  fontWeight: 700, color: "rgba(255,255,255,0.30)", letterSpacing: "0.04em" }}>/ {threshold}</span>
            </div>
          </div>

          {/* Stats */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", marginBottom: 4 }}>
              {count >= threshold
                ? "Ready to unlock!"
                : `${threshold - count} more invite${threshold - count !== 1 ? "s" : ""} needed`}
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", lineHeight: 1.5 }}>
              {canUnlock
                ? `You've reached the unlock threshold for ${feature.name}`
                : "Each friend who joins counts toward your unlock."}
            </div>
            {count > 0 && count < threshold && (
              <div style={{
                marginTop: 6, fontSize: 10, fontWeight: 700,
                color: accent, animation: "ref-pulse 2s ease-in-out infinite",
              }}>
                {count} friend{count !== 1 ? "s" : ""} joined · keep going!
              </div>
            )}
          </div>
        </div>

        {/* Your code */}
        <div style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.28)",
            letterSpacing: "0.08em", marginBottom: 8,
          }}>
            YOUR REFERRAL LINK
          </div>
          <div style={{
            display: "flex", gap: 8, alignItems: "center",
            padding: "10px 14px", borderRadius: 12,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.10)",
          }}>
            <span style={{
              flex: 1, fontSize: 11, color: "rgba(255,255,255,0.50)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              fontFamily: "monospace",
            }}>
              {shareUrl}
            </span>
            <button
              onClick={copyLink}
              style={{
                flexShrink: 0, padding: "5px 10px", borderRadius: 7,
                background: copied ? "rgba(74,222,128,0.12)" : `${accent}15`,
                border: `1px solid ${copied ? "rgba(74,222,128,0.35)" : accent + "30"}`,
                color: copied ? "#4ADE80" : accent,
                fontSize: 10, fontWeight: 800, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 4,
                transition: `all 0.25s ${IOS}`,
              }}
            >
              {copied ? <><Check style={{ width: 10, height: 10 }} /> Copied</> : <><Copy style={{ width: 10, height: 10 }} /> Copy</>}
            </button>
          </div>
        </div>

        {/* Share buttons */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[
            {
              label: "Twitter / X", color: "#1DA1F2",
              href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
            },
            {
              label: "WhatsApp", color: "#25D366",
              href: `https://wa.me/?text=${encodeURIComponent(shareText + shareUrl)}`,
            },
          ].map(s => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noreferrer"
              style={{
                flex: 1, padding: "10px 0", borderRadius: 11,
                background: `${s.color}12`,
                border: `1px solid ${s.color}25`,
                color: s.color, fontSize: 11, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                textDecoration: "none",
                transition: `all 0.22s ${IOS}`,
              }}
            >
              <ExternalLink style={{ width: 11, height: 11 }} />
              {s.label}
            </a>
          ))}
        </div>

        {/* Primary CTA */}
        <button
          onClick={canUnlock ? handleUnlock : copyLink}
          disabled={!canUnlock && copied}
          style={{
            width: "100%", padding: "14px 0",
            borderRadius: 14, cursor: "pointer",
            background: canUnlock
              ? `linear-gradient(135deg, #4ADE80, #22C55E)`
              : `linear-gradient(135deg, ${c0}, ${c1})`,
            border: "none", color: "#fff",
            fontSize: 14, fontWeight: 900,
            letterSpacing: "-0.01em",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            boxShadow: canUnlock ? "0 4px 24px rgba(74,222,128,0.45)" : `0 4px 20px ${c0}45`,
            transition: `all 0.40s ${SPRING}`,
          }}
          onPointerDown={e => (e.currentTarget.style.transform = "scale(0.97)")}
          onPointerUp={e   => (e.currentTarget.style.transform = "scale(1)")}
          onPointerLeave={e => (e.currentTarget.style.transform = "scale(1)")}
        >
          {canUnlock
            ? <><Zap style={{ width: 15, height: 15 }} /> Unlock {feature.name} Now</>
            : <><Share2 style={{ width: 15, height: 15 }} /> Share & Unlock Early</>}
        </button>

        {/* Fine print */}
        <div style={{
          marginTop: 12, fontSize: 9, color: "rgba(255,255,255,0.18)",
          textAlign: "center", lineHeight: 1.6,
        }}>
          Your code: <span style={{ fontFamily: "monospace", color: "rgba(255,255,255,0.30)" }}>{code}</span>
          {" · "}Friends get priority access · you get early unlock
        </div>
      </div>
    </div>
  );
}
