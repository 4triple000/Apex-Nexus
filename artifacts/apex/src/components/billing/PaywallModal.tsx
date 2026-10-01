/**
 * PaywallModal — "Upgrade to unlock this feature" bottom sheet.
 *
 * Shows the user:
 * - Which feature they're trying to unlock
 * - Their current tier vs. required tier
 * - A clean 3-tier comparison table (Free / Pro / Elite)
 * - One-tap upgrade buttons that invoke the existing checkout flow
 *
 * Design: glass morphism dark, Apple-quality, z-index 9200.
 */
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, ArrowRight, Crown, Zap } from "lucide-react";
import { useLocation } from "wouter";
import {
  TIER_DISPLAY, TIER_ORDER, getTierDisplayMeta,
  getRequiredTierForFeature, normalizeTierClient,
  type ApexBillingTier,
} from "@/systems/tierAccess";
import { useBillingStatus } from "@/hooks/useBillingStatus";
import { usePlans, useCheckout } from "@/hooks/useMonetization";

const SPRING = { type: "spring", stiffness: 340, damping: 32 } as const;

function formatPrice(cents: number | null | undefined): string {
  if (!cents) return "$0";
  return `$${(cents / 100).toFixed(0)}`;
}

interface PaywallModalProps {
  featureId:            string;
  featureName:          string;
  featureIcon:          string;
  requiredTierOverride?: ApexBillingTier;
  onClose:              () => void;
}

export function PaywallModal({
  featureId, featureName, featureIcon,
  requiredTierOverride, onClose,
}: PaywallModalProps) {
  const [, nav]   = useLocation();
  const { data: billing } = useBillingStatus();
  const { data: plansData } = usePlans();
  const checkout = useCheckout();

  const currentTier  = billing?.tier ?? "free";
  const requiredTier = requiredTierOverride ?? getRequiredTierForFeature(featureId);
  const requiredMeta = getTierDisplayMeta(requiredTier);
  const currentMeta  = getTierDisplayMeta(currentTier);

  function handleUpgrade(tier: ApexBillingTier) {
    if (tier === "free") return;
    const plan = plansData?.plans.find(p =>
      normalizeTierClient(p.tier) === tier
    );
    void plan;
    if (tier === "pro") {
      checkout.mutate({ successPath: "/pricing", cancelPath: "/pricing" });
    } else {
      nav("/pricing");
    }
    onClose();
  }

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="paywall-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 9200,
          background: "rgba(0,0,0,0.75)",
          backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
        }}
      />

      {/* Bottom sheet */}
      <motion.div
        key="paywall-sheet"
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={SPRING}
        onClick={e => e.stopPropagation()}
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9201,
          borderRadius: "28px 28px 0 0",
          background: "linear-gradient(180deg, rgba(34,29,70,0.94), rgba(16,13,38,0.95))",
          border: `1px solid ${requiredMeta.border}`,
          borderBottom: "none",
          boxShadow: `0 -16px 60px rgba(0,0,0,0.80), 0 0 0 1px rgba(255,255,255,0.04) inset`,
          maxHeight: "92dvh",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}>

        {/* Accent stripe */}
        <div style={{
          height: 3, flexShrink: 0,
          background: `linear-gradient(90deg, ${requiredMeta.color}00, ${requiredMeta.color}, ${requiredMeta.color}00)`,
          boxShadow: `0 0 16px ${requiredMeta.glow}`,
        }} />

        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0", flexShrink: 0 }}>
          <div style={{ width: 40, height: 4, borderRadius: 99, background: "rgba(255,255,255,0.10)" }} />
        </div>

        {/* Header */}
        <div style={{ padding: "12px 20px 0", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            {/* Feature info */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <motion.div
                initial={{ scale: 0.7, rotate: -12 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                style={{
                  width: 52, height: 52, borderRadius: 16, flexShrink: 0,
                  background: requiredMeta.bg, border: `1px solid ${requiredMeta.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 26, boxShadow: `0 0 20px ${requiredMeta.glow}`,
                }}>
                {featureIcon}
              </motion.div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: requiredMeta.color, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 3 }}>
                  {requiredMeta.icon} {requiredMeta.name} Required
                </div>
                <div style={{ fontSize: 17, fontWeight: 900, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
                  Unlock {featureName}
                </div>
              </div>
            </div>
            <button onClick={onClose} style={{
              width: 32, height: 32, borderRadius: 10,
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "rgba(255,255,255,0.45)", flexShrink: 0,
            }}>
              <X style={{ width: 13, height: 13 }} />
            </button>
          </div>

          {/* Current plan badge */}
          <div style={{
            marginTop: 12, padding: "7px 12px", borderRadius: 10,
            background: currentMeta.bg, border: `1px solid ${currentMeta.border}`,
            display: "flex", alignItems: "center", gap: 7,
          }}>
            <span style={{ fontSize: 13 }}>{currentMeta.icon}</span>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.40)", fontWeight: 600 }}>
                Your plan: </span>
              <span style={{ fontSize: 10, fontWeight: 900, color: currentMeta.color }}>
                {currentMeta.name}
              </span>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.40)", fontWeight: 600 }}>
                {" "}— {featureName} requires {requiredMeta.name}
              </span>
            </div>
          </div>
        </div>

        {/* Tier comparison table */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px 0", scrollbarWidth: "none" }}>

          {/* Section label */}
          <div style={{ fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.25)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
            Choose your plan
          </div>

          {/* Tier cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {TIER_DISPLAY.map(tier => {
              const isCurrent  = tier.id === currentTier;
              const isRequired = TIER_ORDER.indexOf(tier.id) >= TIER_ORDER.indexOf(requiredTier);
              const isUpgrade  = TIER_ORDER.indexOf(tier.id) > TIER_ORDER.indexOf(currentTier);

              return (
                <motion.div
                  key={tier.id}
                  whileTap={{ scale: isUpgrade ? 0.98 : 1 }}
                  style={{
                    borderRadius: 18, padding: "14px 14px 12px",
                    background: isRequired ? tier.bg : "rgba(255,255,255,0.025)",
                    border: `1px solid ${isRequired ? tier.border : "rgba(255,255,255,0.07)"}`,
                    boxShadow: isCurrent ? `0 0 18px ${tier.glow}` : "none",
                    position: "relative", overflow: "hidden",
                  }}>

                  {/* Current / recommended badge */}
                  {isCurrent && (
                    <div style={{
                      position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
                      fontSize: 8, fontWeight: 900, color: "#000",
                      background: tier.color, padding: "2px 10px",
                      borderRadius: "0 0 8px 8px", letterSpacing: "0.04em",
                    }}>
                      CURRENT PLAN
                    </div>
                  )}
                  {!isCurrent && tier.id === requiredTier && (
                    <div style={{
                      position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
                      fontSize: 8, fontWeight: 900, color: "#000",
                      background: tier.color, padding: "2px 10px",
                      borderRadius: "0 0 8px 8px", letterSpacing: "0.04em",
                    }}>
                      RECOMMENDED
                    </div>
                  )}

                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: isCurrent || tier.id === requiredTier ? 8 : 0 }}>
                    {/* Icon */}
                    <div style={{
                      width: 38, height: 38, borderRadius: 12, flexShrink: 0,
                      background: `${tier.color}18`, border: `1px solid ${tier.border}`,
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
                    }}>
                      {tier.icon}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 900, color: isRequired ? tier.color : "rgba(255,255,255,0.45)", lineHeight: 1.2 }}>
                        {tier.name}
                      </div>
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.30)", marginTop: 1, lineHeight: 1.4 }}>
                        {tier.tagline}
                      </div>
                    </div>

                    {/* Price */}
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      {tier.priceMonthly !== null ? (
                        <>
                          <div style={{ fontSize: 16, fontWeight: 900, color: isRequired ? tier.color : "rgba(255,255,255,0.30)", lineHeight: 1 }}>
                            ${tier.priceMonthly}
                          </div>
                          <div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", fontWeight: 600 }}>/mo</div>
                        </>
                      ) : (
                        <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.30)" }}>Custom</div>
                      )}
                    </div>
                  </div>

                  {/* Feature highlights */}
                  {isRequired && (
                    <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: "4px 8px" }}>
                      {tier.highlights.slice(0, 4).map(h => (
                        <div key={h} style={{
                          display: "flex", alignItems: "center", gap: 4,
                          fontSize: 9, color: isRequired ? "rgba(255,255,255,0.60)" : "rgba(255,255,255,0.25)",
                        }}>
                          <Check style={{ width: 8, height: 8, color: tier.color, flexShrink: 0 }} />
                          {h}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* CTA */}
                  {isUpgrade && (
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      onClick={() => handleUpgrade(tier.id)}
                      disabled={checkout.isPending}
                      style={{
                        marginTop: 12, width: "100%", padding: "10px 0",
                        borderRadius: 12, cursor: "pointer",
                        background: `linear-gradient(135deg, ${tier.color}EE, ${tier.color}BB)`,
                        border: "none", color: "#000",
                        fontSize: 11, fontWeight: 900,
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        boxShadow: `0 4px 20px ${tier.glow}`,
                      }}>
                      {tier.id === "enterprise" ? <Crown style={{ width: 12, height: 12 }} /> : <Zap style={{ width: 12, height: 12 }} />}
                      Upgrade to {tier.name} — ${tier.priceMonthly}/mo
                      <ArrowRight style={{ width: 11, height: 11 }} />
                    </motion.button>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Footer */}
          <div style={{ padding: "14px 0 32px", textAlign: "center" }}>
            <button
              onClick={() => { nav("/pricing"); onClose(); }}
              style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: 700,
                textDecoration: "underline", textUnderlineOffset: 3,
              }}>
              View full pricing comparison →
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
