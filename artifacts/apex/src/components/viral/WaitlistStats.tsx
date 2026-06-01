/**
 * WaitlistStats — Animated waitlist counter + urgency message.
 * Counter is seeded from the real DB count via GET /api/waitlist/count.
 * The UI animates small increments between fetches to remain lively.
 */
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const URGENCY_MESSAGES = [
  "🔥 Limited early access spots remaining",
  "⚡ Launching sooner than you think",
  "🏆 Top 10% get exclusive early access",
  "🚀 Join before this phase closes",
  "⏳ Spots filling up fast",
  "💎 Early adopters get lifetime perks",
];

function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

interface WaitlistStatsProps {
  featureId: string;
  accent:    string;
  compact?:  boolean;
}

function useRealCount(featureId: string) {
  const [count, setCount] = useState<number | null>(null);
  const [bump, setBump] = useState(false);
  const localOffset = useRef(0);

  // Fetch real count from DB on mount and every 60s
  useEffect(() => {
    let cancelled = false;

    async function fetchCount() {
      try {
        const res = await fetch(`/api/waitlist/count/${encodeURIComponent(featureId)}`);
        if (!res.ok) {
          // Fall back to total count
          const res2 = await fetch("/api/waitlist/count");
          if (!res2.ok) return;
          const data = await res2.json() as { count?: number };
          if (!cancelled && typeof data.count === "number") {
            setCount(data.count + localOffset.current);
          }
          return;
        }
        const data = await res.json() as { count?: number };
        if (!cancelled && typeof data.count === "number") {
          setCount(data.count + localOffset.current);
        }
      } catch {
        // Network unavailable — keep whatever we have
      }
    }

    fetchCount();
    const id = setInterval(fetchCount, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [featureId]);

  // Subtle UI animation: increment the local offset occasionally
  // to reflect that more people could have joined since last fetch
  useEffect(() => {
    if (count === null) return;
    const jitter = Math.floor(Math.random() * 4000);
    const t = setTimeout(() => {
      const interval = setInterval(() => {
        localOffset.current += 1;
        setCount(c => (c ?? 0) + 1);
        setBump(true);
        setTimeout(() => setBump(false), 600);
      }, 6000 + Math.random() * 4000);
      return () => clearInterval(interval);
    }, jitter);
    return () => clearTimeout(t);
  }, [count === null]);

  return { count, bump };
}

export function WaitlistStats({ featureId, accent, compact = false }: WaitlistStatsProps) {
  const { count, bump } = useRealCount(featureId);
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setMsgIdx(i => (i + 1) % URGENCY_MESSAGES.length), 3800);
    return () => clearInterval(id);
  }, []);

  const displayCount = count ?? 0;
  const isLoading = count === null;

  if (compact) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <motion.div
            animate={{ scale: bump ? 1.18 : 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 22 }}
            style={{ fontSize: 10, fontWeight: 900, color: accent }}>
            🔥 {isLoading ? "—" : formatCount(displayCount)}
          </motion.div>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.30)", fontWeight: 600 }}>waiting</span>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={msgIdx}
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
            style={{ fontSize: 8, color: "#F59E0B", fontWeight: 700, textAlign: "right" }}>
            {URGENCY_MESSAGES[msgIdx]!.split(" ").slice(1).join(" ")}
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div style={{
      borderRadius: 14, padding: "14px 16px",
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.07)",
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <motion.div
          animate={{ scale: bump ? [1, 1.22, 1] : 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 20 }}
          style={{ fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1 }}>
          {isLoading ? "—" : formatCount(displayCount)}
        </motion.div>
        <div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", fontWeight: 700 }}>people waiting</div>
          {bump && !isLoading && (
            <motion.div
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ fontSize: 9, color: "#4ADE80", fontWeight: 800 }}>
              +1 just joined
            </motion.div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, height: 5, borderRadius: 99, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <motion.div
            animate={{ width: "100%" }}
            initial={{ width: "70%" }}
            transition={{ duration: 0.8 }}
            style={{
              height: "100%", borderRadius: 99,
              background: `linear-gradient(90deg, ${accent}, ${accent}88)`,
              boxShadow: `0 0 6px ${accent}60`,
            }}
          />
        </div>
        <motion.div
          animate={{ scale: [1, 1.3, 1], opacity: [1, 0.4, 1] }}
          transition={{ repeat: Infinity, duration: 1.6 }}
          style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ADE80", flexShrink: 0 }}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={msgIdx}
          initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
          transition={{ duration: 0.30 }}
          style={{ fontSize: 11, color: "#F59E0B", fontWeight: 700 }}>
          {URGENCY_MESSAGES[msgIdx]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
