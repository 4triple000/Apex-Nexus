import { X, Zap, Crown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlans, useCheckout, type SubscriptionTier } from "@/hooks/useMonetization";
import { cn } from "@/lib/utils";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  reason?: "ai_limit" | "paid_project" | "creator" | "general";
  projectTitle?: string;
  projectPrice?: number;
  projectId?: number;
  requiredTier?: SubscriptionTier;
}

const REASON_COPY: Record<string, { title: string; sub: string }> = {
  ai_limit: { title: "You've hit your AI limit", sub: "Upgrade to keep building without limits." },
  paid_project: { title: "This project requires access", sub: "Purchase or subscribe to run this project." },
  creator: { title: "Unlock Creator Monetization", sub: "Start earning from your builds." },
  general: { title: "Upgrade Apex", sub: "Unlock the full platform." },
};

const TIER_ICONS: Record<string, React.ReactNode> = {
  pro: <Zap size={16} className="text-[#ffcc33]" />,
  creator_pro: <Crown size={16} className="text-purple-400" />,
};

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function UpgradeModal({ open, onClose, reason = "general", projectTitle, projectPrice, projectId }: UpgradeModalProps) {
  const { data: plansData, isLoading } = usePlans();
  const checkout = useCheckout();

  if (!open) return null;

  const copy = REASON_COPY[reason] ?? REASON_COPY.general;
  const plans = plansData?.plans ?? [];

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md bg-[#111] border border-white/10 rounded-t-3xl p-6 pb-8 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />

        {/* Close */}
        <button onClick={onClose} className="absolute top-5 right-5 text-white/40 hover:text-white/80 transition-colors">
          <X size={18} />
        </button>

        <h2 className="text-lg font-bold text-white mb-1">{copy.title}</h2>
        <p className="text-sm text-white/50 mb-5">{copy.sub}</p>

        {/* One-time purchase option */}
        {reason === "paid_project" && projectPrice && projectId && (
          <div className="mb-4 p-4 bg-[#1a1a1a] border border-white/10 rounded-2xl">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-bold text-white">Buy once</p>
                <p className="text-xs text-white/50">{projectTitle ?? "This project"}</p>
              </div>
              <span className="text-lg font-bold" style={{ color: "#ffcc33" }}>{formatPrice(projectPrice)}</span>
            </div>
            <p className="text-xs text-white/30 mb-3">Permanent access — run anytime</p>
            <Button
              className="w-full font-bold rounded-xl"
              style={{ background: "#ffcc33", color: "#000" }}
              disabled={checkout.isPending}
              onClick={() => {
                // For one-time project purchase, we'd need a specific price ID
                // For now, redirect to pricing page
                window.location.href = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/pricing`;
              }}
            >
              Purchase for {formatPrice(projectPrice)}
            </Button>
          </div>
        )}

        {/* Subscription plans */}
        {isLoading && (
          <div className="space-y-3">
            {[0, 1].map((i) => <div key={i} className="h-24 rounded-2xl bg-white/5 animate-pulse" />)}
          </div>
        )}

        {plans.length === 0 && !isLoading && (
          <div className="text-center py-8">
            <p className="text-sm text-white/40 mb-4">Upgrade your plan to unlock more features.</p>
            <Button
              className="w-full font-bold rounded-xl"
              style={{ background: "#ffcc33", color: "#000" }}
              onClick={() => { onClose(); window.location.href = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/pricing`; }}
            >
              View Pricing
            </Button>
          </div>
        )}

        <div className="space-y-3">
          {plans.map((plan) => {
            const monthlyPrice = plan.prices.find((p) => p.interval === "month");
            const accent = plan.tier === "creator_pro" ? "#a78bfa" : "#ffcc33";
            return (
              <div
                key={plan.id}
                className="p-4 rounded-2xl border"
                style={{ borderColor: `${accent}33`, background: `${accent}08` }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {TIER_ICONS[plan.tier]}
                    <span className="font-bold text-white text-sm">{plan.name}</span>
                  </div>
                  {monthlyPrice && (
                    <span className="text-sm font-bold" style={{ color: accent }}>
                      {formatPrice(monthlyPrice.amount)}<span className="text-xs text-white/40">/mo</span>
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-1 mb-3">
                  {plan.features.slice(0, 3).map((f) => (
                    <span key={f} className="flex items-center gap-1 text-[10px] text-white/60">
                      <Check size={9} className="text-green-400" /> {f}
                    </span>
                  ))}
                </div>

                <Button
                  className="w-full font-bold rounded-xl text-sm h-9"
                  style={{ background: accent, color: "#000" }}
                  disabled={checkout.isPending || !monthlyPrice}
                  onClick={() => monthlyPrice && checkout.mutate({ priceId: monthlyPrice.id, successPath: "/pricing", cancelPath: "/pricing" })}
                >
                  {checkout.isPending ? "Loading…" : `Subscribe — ${monthlyPrice ? formatPrice(monthlyPrice.amount) + "/mo" : "Contact us"}`}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
