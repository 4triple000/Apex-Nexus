/**
 * PaywallContext — global paywall state manager.
 *
 * Any component in the tree can call:
 *   const { showPaywall } = usePaywall();
 *   showPaywall({ featureId: "autopilot", featureName: "AI Autopilot", featureIcon: "🤖" });
 *
 * The PaywallProvider renders the PaywallModal in-tree at the App root.
 */
import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { PaywallModal } from "@/components/billing/PaywallModal";
import type { ApexBillingTier } from "@/systems/tierAccess";

export interface PaywallOptions {
  featureId:   string;
  featureName: string;
  featureIcon: string;
  requiredTier?: ApexBillingTier;  // override auto-detection
}

interface PaywallContextValue {
  showPaywall: (opts: PaywallOptions) => void;
  hidePaywall: () => void;
}

const PaywallContext = createContext<PaywallContextValue>({
  showPaywall: () => {},
  hidePaywall: () => {},
});

export function PaywallProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<PaywallOptions | null>(null);

  const showPaywall = useCallback((opts: PaywallOptions) => setOptions(opts), []);
  const hidePaywall = useCallback(() => setOptions(null), []);

  return (
    <PaywallContext.Provider value={{ showPaywall, hidePaywall }}>
      {children}
      {options && (
        <PaywallModal
          featureId={options.featureId}
          featureName={options.featureName}
          featureIcon={options.featureIcon}
          requiredTierOverride={options.requiredTier}
          onClose={hidePaywall}
        />
      )}
    </PaywallContext.Provider>
  );
}

export function usePaywall(): PaywallContextValue {
  return useContext(PaywallContext);
}
