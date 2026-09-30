/**
 * UpgradeGate — wraps any content with tier gating.
 *
 * Usage:
 *   <UpgradeGate featureId="autopilot" featureName="AI Autopilot" featureIcon="🤖">
 *     <AutopilotContent />
 *   </UpgradeGate>
 *
 * If the user's tier can't access the feature, renders a dimmed overlay
 * with an "Upgrade" CTA that opens the PaywallModal.
 */
import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import { useTierCanAccess } from "@/hooks/useBillingStatus";
import { usePaywall } from "@/contexts/PaywallContext";
import { getTierDisplayMeta, getRequiredTierForFeature } from "@/systems/tierAccess";
import type { ReactNode } from "react";

interface UpgradeGateProps {
  featureId:   string;
  featureName: string;
  featureIcon: string;
  children:    ReactNode;
  /** If true, renders children always but overlays a lock icon on top. Default: false (hides children). */
  overlayMode?: boolean;
}

export function UpgradeGate({ featureId, featureName, featureIcon, children, overlayMode = false }: UpgradeGateProps) {
  const canAccess    = useTierCanAccess(featureId);
  const { showPaywall } = usePaywall();

  if (canAccess) return <>{children}</>;

  const requiredTier = getRequiredTierForFeature(featureId);
  const tierMeta     = getTierDisplayMeta(requiredTier);

  if (overlayMode) {
    return (
      <div style={{ position: "relative" }}>
        <div style={{ filter: "blur(2px) brightness(0.4)", pointerEvents: "none", userSelect: "none" }}>
          {children}
        </div>
        <div
          onClick={() => showPaywall({ featureId, featureName, featureIcon })}
          style={{
            position: "absolute", inset: 0, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
          <LockBadge tierMeta={tierMeta} featureName={featureName} featureIcon={featureIcon} />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={() => showPaywall({ featureId, featureName, featureIcon })}
      style={{
        cursor: "pointer", borderRadius: 18,
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.08)",
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", gap: 10, padding: "24px 20px",
        minHeight: 140,
      }}>
      <LockBadge tierMeta={tierMeta} featureName={featureName} featureIcon={featureIcon} />
    </motion.div>
  );
}

function LockBadge({ tierMeta, featureName, featureIcon }: {
  tierMeta: ReturnType<typeof getTierDisplayMeta>;
  featureName: string;
  featureIcon: string;
}) {
  return (
    <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div style={{
        width: 48, height: 48, borderRadius: 14,
        background: tierMeta.bg, border: `1px solid ${tierMeta.border}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 22, position: "relative",
        boxShadow: `0 0 16px ${tierMeta.glow}`,
      }}>
        {featureIcon}
        <div style={{
          position: "absolute", bottom: -6, right: -6,
          width: 18, height: 18, borderRadius: "50%",
          background: "rgba(14,11,32,0.92)", border: `1px solid ${tierMeta.border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Lock style={{ width: 9, height: 9, color: tierMeta.color }} />
        </div>
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>{featureName}</div>
        <div style={{
          marginTop: 4, display: "inline-flex", alignItems: "center", gap: 4,
          fontSize: 9, fontWeight: 700, color: tierMeta.color,
          background: tierMeta.bg, border: `1px solid ${tierMeta.border}`,
          padding: "2px 8px", borderRadius: 99,
        }}>
          {tierMeta.icon} Requires {tierMeta.name}
        </div>
      </div>
      <div style={{
        fontSize: 9, color: "rgba(255,255,255,0.35)", fontWeight: 600,
      }}>
        Tap to upgrade →
      </div>
    </div>
  );
}
