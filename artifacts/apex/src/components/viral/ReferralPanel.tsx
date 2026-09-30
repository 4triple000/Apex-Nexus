/**
 * ReferralPanel — shown after joining the waitlist.
 * Displays referral code, share options, and queue position.
 */
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Copy, Share2, Check, Trophy, Users, TrendingUp } from "lucide-react";
import type { WaitlistEntry } from "@/utils/referralGenerator";
import { getPercentileAhead, buildShareText, addReferral, getTotalWaitlist } from "@/utils/referralGenerator";
import { formatCount } from "@/utils/fakeCounter";

const IOS = [0.25, 0.46, 0.45, 0.94] as const;

interface ReferralPanelProps {
  entry:     WaitlistEntry;
  accent:    string;
  onUpdate:  (entry: WaitlistEntry) => void;
}

export function ReferralPanel({ entry, accent, onUpdate }: ReferralPanelProps) {
  const [copied,   setCopied]   = useState(false);
  const [toast,    setToast]    = useState("");
  const [position, setPosition] = useState(entry.position);
  const [refCount, setRefCount] = useState(entry.referralCount);

  // Live total to show dynamic % ahead
  const [total, setTotal] = useState(() => getTotalWaitlist(entry.featureId));
  useEffect(() => {
    const id = setInterval(() => setTotal(getTotalWaitlist(entry.featureId)), 5000);
    return () => clearInterval(id);
  }, [entry.featureId]);

  const percentAhead = getPercentileAhead(position, total);
  const shareText    = buildShareText(entry.referralCode);

  function handleCopy() {
    navigator.clipboard.writeText(entry.referralCode).catch(() => {});
    setCopied(true);
    showToast("Code copied!");
    setTimeout(() => setCopied(false), 2000);
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(shareText).catch(() => {});
    showToast("Share text copied!");
    // Simulate a referral from sharing
    simulateReferral();
  }

  function handleShare() {
    if (navigator.share) {
      navigator.share({ title: "Apex Early Access", text: shareText }).catch(() => {});
    } else {
      handleCopyLink();
    }
    simulateReferral();
  }

  function simulateReferral() {
    const updated = addReferral(entry.featureId);
    if (updated) {
      setPosition(updated.position);
      setRefCount(updated.referralCount);
      onUpdate(updated);
      showToast("You moved up the list!");
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Success header */}
      <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
        <motion.div
          animate={{ rotate: [0, -8, 8, -8, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 0.7, delay: 0.1 }}
          style={{ fontSize: 38, marginBottom: 8 }}>
          🎉
        </motion.div>
        <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", marginBottom: 4, letterSpacing: "-0.02em" }}>
          You're on the list!
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.40)", lineHeight: 1.6 }}>
          Invite friends to move up and unlock early access faster.
        </div>
      </div>

      {/* Position stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {[
          { icon: <Trophy style={{ width: 12, height: 12 }} />, label: "Position",  value: `#${position.toLocaleString()}`, color: accent },
          { icon: <Users  style={{ width: 12, height: 12 }} />, label: "Referrals", value: `${refCount}`,                   color: "#4ADE80" },
          { icon: <TrendingUp style={{ width: 12, height: 12 }} />, label: "Ahead", value: `${percentAhead}%`,             color: "#F59E0B" },
        ].map(s => (
          <div key={s.label} style={{
            borderRadius: 12, padding: "10px 8px", textAlign: "center",
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
          }}>
            <div style={{ color: s.color, display: "flex", justifyContent: "center", marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.30)", fontWeight: 700, marginTop: 2, letterSpacing: "0.04em" }}>
              {s.label.toUpperCase()}
            </div>
          </div>
        ))}
      </div>

      {/* Queue position progress bar */}
      <div style={{
        borderRadius: 14, padding: "13px 14px",
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.40)", fontWeight: 700 }}>Queue Position</span>
          <span style={{ fontSize: 10, fontWeight: 900, color: "#A29BFE" }}>Top 10% get early access</span>
        </div>
        <div style={{ height: 8, borderRadius: 99, background: "rgba(255,255,255,0.06)", overflow: "hidden", position: "relative" }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentAhead}%` }}
            transition={{ duration: 1.2, ease: IOS }}
            style={{
              height: "100%", borderRadius: 99,
              background: `linear-gradient(90deg, ${accent}, ${accent}99)`,
              boxShadow: `0 0 8px ${accent}60`,
            }}
          />
          {/* Top 10% marker */}
          <div style={{
            position: "absolute", top: -2, left: "90%",
            width: 1.5, height: "calc(100% + 4px)",
            background: "#F59E0B", opacity: 0.60,
          }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", fontWeight: 600 }}>You are ahead of {percentAhead}% of users</span>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", fontWeight: 600 }}>{formatCount(total)} total</span>
        </div>
      </div>

      {/* Referral code box */}
      <div style={{
        borderRadius: 14, padding: "12px 14px",
        background: `${accent}10`, border: `1px solid ${accent}30`,
      }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: accent, marginBottom: 6, letterSpacing: "0.08em" }}>
          YOUR REFERRAL CODE
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            flex: 1, fontSize: 18, fontWeight: 900, color: "#fff",
            letterSpacing: "0.10em", fontFamily: "monospace",
          }}>
            {entry.referralCode}
          </div>
          <motion.button whileTap={{ scale: 0.90 }} onClick={handleCopy} style={{
            padding: "7px 12px", borderRadius: 10, cursor: "pointer",
            background: copied ? "#4ADE8020" : `${accent}20`,
            border: `1px solid ${copied ? "#4ADE80" : accent}45`,
            color: copied ? "#4ADE80" : accent,
            fontSize: 11, fontWeight: 800,
            display: "flex", alignItems: "center", gap: 5,
          }}>
            {copied ? <Check style={{ width: 11, height: 11 }} /> : <Copy style={{ width: 11, height: 11 }} />}
            {copied ? "Copied" : "Copy"}
          </motion.button>
        </div>
      </div>

      {/* Share buttons */}
      <div style={{ display: "flex", gap: 8 }}>
        <motion.button whileTap={{ scale: 0.93 }} onClick={handleCopyLink} style={{
          flex: 1, padding: "12px 0", borderRadius: 12, cursor: "pointer",
          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)",
          color: "rgba(255,255,255,0.70)", fontSize: 11, fontWeight: 800,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}>
          <Copy style={{ width: 12, height: 12 }} />
          Copy Link
        </motion.button>

        <motion.button whileTap={{ scale: 0.93 }} onClick={handleShare} style={{
          flex: 1, padding: "12px 0", borderRadius: 12, cursor: "pointer",
          background: `linear-gradient(135deg, ${accent}30, ${accent}18)`,
          border: `1px solid ${accent}50`,
          color: accent, fontSize: 11, fontWeight: 900,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          boxShadow: `0 2px 12px ${accent}20`,
        }}>
          <Share2 style={{ width: 12, height: 12 }} />
          Share Now
        </motion.button>
      </div>

      {refCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          style={{
            borderRadius: 12, padding: "9px 13px", textAlign: "center",
            background: "rgba(74,222,128,0.09)", border: "1px solid rgba(74,222,128,0.22)",
          }}>
          <span style={{ fontSize: 11, color: "#4ADE80", fontWeight: 700 }}>
            🏆 {refCount} referral{refCount !== 1 ? "s" : ""} — you moved up the queue!
          </span>
        </motion.div>
      )}

      {/* Toast */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          style={{
            position: "fixed", bottom: 100, left: "50%", transform: "translateX(-50%)",
            whiteSpace: "nowrap", background: "rgba(14,12,32,0.55)",
            border: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.85)",
            fontSize: 11, fontWeight: 700, padding: "8px 16px", borderRadius: 99, zIndex: 9999,
            backdropFilter: "blur(12px)", boxShadow: "0 8px 24px rgba(0,0,0,0.50)",
          }}>
          {toast}
        </motion.div>
      )}
    </div>
  );
}
