import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Check, Sparkles, Zap, Crown, Flame } from "lucide-react";
import { NotificationBell } from "@/components/social/NotificationBell";
import { useCheckout, useSubscriptionStatus, useCustomerPortal } from "@/hooks/useMonetization";
import { useToast } from "@/hooks/use-toast";

// ── Design tokens ──────────────────────────────────────────────────────────────
const BG = "transparent";
const SURFACE  = "rgba(255,255,255,0.04)";
const BORDER   = "rgba(255,255,255,0.07)";

// ── Plan definitions ──────────────────────────────────────────────────────────
interface PlanDef {
  id:          string;
  name:        string;
  badge:       string;
  dot:         string;
  accent:      string;
  glow:        string;
  priceLabel:  string;
  priceSub:    string;
  icon:        React.ReactNode;
  features:    string[];
  cta:         string;
  recommended?: boolean;
}

const PLANS: PlanDef[] = [
  {
    id: "free",
    name: "Free",
    badge: "🟢",
    dot: "#22c55e",
    accent: "rgba(34,197,94,0.75)",
    glow: "rgba(34,197,94,0.12)",
    priceLabel: "$0",
    priceSub: "forever",
    icon: <Sparkles size={16} />,
    features: [
      "Chat (limited — 20 msgs/day)",
      "Preview features only",
      "Basic referrals & waitlist",
      "Browse Marketplace",
      "Community access",
    ],
    cta: "Get Started Free",
  },
  {
    id: "pro",
    name: "Pro",
    badge: "🔵",
    dot: "#38bdf8",
    accent: "#38bdf8",
    glow: "rgba(56,189,248,0.12)",
    priceLabel: "$9.99",
    priceSub: "per month",
    icon: <Zap size={16} />,
    features: [
      "Higher AI limits (200 msgs/day)",
      "Early feature access",
      "Full Workflows engine",
      "Priority support",
      "Advanced analytics",
    ],
    cta: "Upgrade to Pro",
  },
  {
    id: "creator",
    name: "Creator",
    badge: "🟣",
    dot: "#a78bfa",
    accent: "#a78bfa",
    glow: "rgba(167,139,250,0.14)",
    priceLabel: "$19.99",
    priceSub: "per month",
    icon: <Crown size={16} />,
    features: [
      "AI Game Studio (full access)",
      "Marketplace publishing",
      "Monetization tools",
      "Creator analytics dashboard",
      "80% revenue share",
    ],
    cta: "Become a Creator",
    recommended: true,
  },
  {
    id: "elite",
    name: "Elite",
    badge: "🔴",
    dot: "#f87171",
    accent: "#f87171",
    glow: "rgba(248,113,113,0.12)",
    priceLabel: "$39.99",
    priceSub: "per month",
    icon: <Flame size={16} />,
    features: [
      "Multiplayer & real-time access",
      "AI autopilot (full auto mode)",
      "Priority inference servers",
      "Dedicated support line",
      "All future Elite features",
    ],
    cta: "Go Elite",
  },
];

const SPRING = { type: "spring", stiffness: 340, damping: 28 } as const;

// ── Plan card ─────────────────────────────────────────────────────────────────
function PlanCard({
  plan,
  isCurrent,
  onSelect,
  index,
}: {
  plan: PlanDef;
  isCurrent: boolean;
  onSelect: () => void;
  index: number;
}) {
  const [pressed, setPressed] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING, delay: index * 0.06 }}
      className="relative rounded-2xl overflow-hidden"
      style={{
        background: isCurrent ? `${plan.glow}` : SURFACE,
        border: `1.5px solid ${isCurrent ? plan.accent + "50" : plan.recommended ? plan.accent + "30" : BORDER}`,
        boxShadow: plan.recommended ? `0 0 40px ${plan.glow}, 0 0 0 1px ${plan.accent}20` : undefined,
      }}
    >
      {/* Recommended ribbon */}
      {plan.recommended && (
        <div
          className="absolute top-0 right-0 text-[9px] font-black tracking-widest uppercase px-3 py-1 rounded-bl-xl"
          style={{ background: plan.accent, color: "#fff" }}
        >
          Recommended
        </div>
      )}

      {isCurrent && (
        <div
          className="absolute top-0 left-0 text-[9px] font-black tracking-widest uppercase px-3 py-1 rounded-br-xl"
          style={{ background: plan.dot, color: "#fff" }}
        >
          Your Plan
        </div>
      )}

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${plan.glow}`, border: `1px solid ${plan.accent}25`, color: plan.accent }}
            >
              {plan.icon}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base">{plan.badge}</span>
                <h3 className="text-white font-black text-base">{plan.name}</h3>
              </div>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-black" style={{ color: plan.accent }}>
                  {plan.priceLabel}
                </span>
                <span className="text-white/30 text-xs">{plan.priceSub}</span>
              </div>
            </div>
          </div>
          {/* Live dot */}
          <div className="flex items-center gap-1.5 mt-1">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: plan.dot }} />
          </div>
        </div>

        {/* Features */}
        <ul className="space-y-2 mb-5">
          {plan.features.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-xs text-white/65">
              <Check size={11} className="flex-shrink-0 mt-0.5" style={{ color: plan.accent }} />
              {f}
            </li>
          ))}
        </ul>

        {/* CTA */}
        {plan.id === "free" ? (
          <div
            className="w-full py-3 rounded-xl text-center text-xs font-bold"
            style={{
              background: isCurrent ? `${plan.glow}` : "rgba(255,255,255,0.04)",
              color: isCurrent ? plan.accent : "rgba(255,255,255,0.30)",
              border: `1px solid ${isCurrent ? plan.accent + "30" : BORDER}`,
            }}
          >
            {isCurrent ? "Current Plan" : "Free Forever"}
          </div>
        ) : (
          <motion.button
            onTapStart={() => setPressed(true)}
            onTap={() => { setPressed(false); onSelect(); }}
            onTapCancel={() => setPressed(false)}
            animate={{ scale: pressed ? 0.96 : 1 }}
            transition={{ duration: 0.1 }}
            className="w-full py-3 rounded-xl text-xs font-black transition-all"
            style={
              isCurrent
                ? { background: "transparent", color: plan.accent, border: `1.5px solid ${plan.accent}40` }
                : plan.recommended
                ? { background: plan.accent, color: "#fff", boxShadow: `0 4px 20px ${plan.glow}` }
                : { background: `${plan.glow}`, color: plan.accent, border: `1.5px solid ${plan.accent}30` }
            }
          >
            {isCurrent ? "Manage Plan" : plan.cta}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function PricingPage() {
  const { data: subData } = useSubscriptionStatus();
  const checkout = useCheckout();
  const portal   = useCustomerPortal();
  const { toast } = useToast();

  const rawTier    = subData?.tier ?? "free";
  const currentTier = rawTier === "creator_pro" ? "creator" : rawTier === "enterprise" ? "elite" : rawTier;

  const urlParams     = new URLSearchParams(window.location.search);
  const checkoutResult = urlParams.get("checkout");

  function handleSelect(plan: PlanDef) {
    if (plan.id === currentTier) {
      portal.mutate();
      return;
    }
    // If Stripe checkout is configured, attempt checkout with tier
    // Otherwise fall back to a graceful message
    toast({
      title: `Upgrading to ${plan.name}`,
      description: "Redirecting to checkout…",
    });
    checkout.mutate({
      priceId: `apex_${plan.id}`,
      successPath: "/pricing?checkout=success",
      cancelPath: "/pricing",
    });
  }

  return (
    <div
      className="flex flex-col h-full overflow-y-auto"
      style={{ background: BG }}
    >
      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between px-4 pt-5 pb-4 flex-shrink-0"
        style={{ background: BG, borderBottom: `1px solid ${BORDER}` }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
            style={{ background: SURFACE, border: `1px solid ${BORDER}` }}
          >
            <ArrowLeft size={16} className="text-white/60" />
          </button>
          <div>
            <h1 className="text-lg font-black text-white tracking-tight">Plans & Pricing</h1>
            <p className="text-[11px] text-white/35">Unlock the full Apex experience</p>
          </div>
        </div>
        <NotificationBell />
      </div>

      {/* ── Success banner ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {checkoutResult === "success" && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mx-4 mt-4 p-3 rounded-xl text-sm font-medium text-center"
            style={{
              background: "rgba(34,197,94,0.10)",
              border: "1px solid rgba(34,197,94,0.25)",
              color: "#4ade80",
            }}
          >
            🎉 Payment successful — your plan is now active!
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Hero text ────────────────────────────────────────────────────────── */}
      <div className="px-4 pt-6 pb-4 text-center">
        <p className="text-[11px] font-bold tracking-widest uppercase text-white/30 mb-2">Choose your tier</p>
        <h2 className="text-2xl font-black text-white leading-tight">
          Build, Create &amp; Ship
          <br />
          <span
            style={{ background: "linear-gradient(135deg,#6C5CE7,#A29BFE,#FD79A8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
          >
            Without Limits
          </span>
        </h2>
        <p className="text-xs text-white/35 mt-2 max-w-64 mx-auto">
          Cancel anytime. Upgrades take effect immediately.
        </p>
      </div>

      {/* ── Plan cards ───────────────────────────────────────────────────────── */}
      <div className="px-4 pb-2 space-y-3">
        {PLANS.map((plan, i) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            isCurrent={currentTier === plan.id}
            onSelect={() => handleSelect(plan)}
            index={i}
          />
        ))}
      </div>

      {/* ── Footer note ──────────────────────────────────────────────────────── */}
      <div className="mx-4 mt-3 mb-6 p-3 rounded-xl text-center"
        style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
        <p className="text-[10px] text-white/30 leading-relaxed">
          Platform fee: 20% on Marketplace sales · Creators keep 80% · Payouts via Stripe Connect
        </p>
      </div>
    </div>
  );
}
