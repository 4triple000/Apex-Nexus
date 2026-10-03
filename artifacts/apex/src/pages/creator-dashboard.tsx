import { useLocation } from "wouter";
import { ArrowLeft, TrendingUp, DollarSign, ShoppingBag, Crown, BarChart3, ExternalLink } from "lucide-react";
import { NotificationBell } from "@/components/social/NotificationBell";
import { useCreatorEarnings, useSubscriptionStatus, useCustomerPortal } from "@/hooks/useMonetization";
import { useMyProfile } from "@/hooks/useSocial";
import { Button } from "@/components/ui/button";
import { UpgradeModal } from "@/components/monetization/UpgradeModal";
import { useState } from "react";
import { goBackInTab } from "@/lib/tabHistory";

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function CreatorDashboardPage() {
  const [, nav] = useLocation();
  const { data: earningsData, isLoading } = useCreatorEarnings();
  const { data: subData } = useSubscriptionStatus();
  const { data: meData } = useMyProfile();
  const portal = useCustomerPortal();
  const [showUpgrade, setShowUpgrade] = useState(false);

  const isCreatorPro = subData?.tier === "creator_pro" && subData?.status === "active";
  const earnings = earningsData?.earnings ?? [];
  const byProject = earningsData?.byProject ?? [];
  const totalNet = earningsData?.totalNet ?? 0;
  const totalGross = earningsData?.totalGross ?? 0;

  return (
    <div className="flex flex-col h-full bg-transparent overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => goBackInTab(nav)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-white">Creator Dashboard</h1>
            <p className="text-xs text-white/40">Your earnings & analytics</p>
          </div>
        </div>
        <NotificationBell />
      </div>

      {/* Not a Creator Pro user — show upgrade prompt */}
      {!isCreatorPro && (
        <div className="mx-4 mb-5 p-5 rounded-2xl border border-purple-500/30 bg-purple-500/8 text-center">
          <Crown size={28} className="text-purple-400 mx-auto mb-2" />
          <h3 className="font-bold text-white mb-1">Unlock Creator Monetization</h3>
          <p className="text-xs text-white/50 mb-4 leading-relaxed">
            Set prices on your projects, track earnings, and get paid via Stripe. Platform keeps 20%, you keep 80%.
          </p>
          <Button
            className="w-full font-bold rounded-xl h-9"
            style={{ background: "#a78bfa", color: "#000" }}
            onClick={() => setShowUpgrade(true)}
          >
            Upgrade to Creator Pro — $19.99/mo
          </Button>
        </div>
      )}

      {/* Creator Pro — Stats */}
      {isCreatorPro && (
        <>
          <div className="grid grid-cols-3 gap-3 px-4 mb-5">
            {[
              { label: "Net Earnings", value: formatCents(totalNet), icon: <DollarSign size={14} className="text-green-400" />, color: "#34d399" },
              { label: "Gross Revenue", value: formatCents(totalGross), icon: <TrendingUp size={14} className="text-[#A29BFE]" />, color: "#A29BFE" },
              { label: "Total Sales", value: String(earnings.length), icon: <ShoppingBag size={14} className="text-blue-400" />, color: "#38bdf8" },
            ].map(({ label, value, icon, color }) => (
              <div key={label} className="p-3 bg-[rgba(30,26,62,0.62)] border border-white/5 rounded-2xl text-center">
                <div className="flex justify-center mb-1">{icon}</div>
                <p className="text-base font-bold text-white">{value}</p>
                <p className="text-[10px] text-white/40">{label}</p>
              </div>
            ))}
          </div>

          {/* Platform fee notice */}
          <div className="mx-4 mb-4 p-3 rounded-xl bg-[rgba(30,26,62,0.62)] border border-white/5 flex items-center justify-between">
            <p className="text-xs text-white/40">Platform fee (20%) charged</p>
            <p className="text-xs font-bold text-white/60">{formatCents(totalGross - totalNet)}</p>
          </div>

          {/* Revenue by project */}
          <div className="px-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 size={14} className="text-[#A29BFE]" />
              <h2 className="text-sm font-bold text-white">Revenue by Project</h2>
            </div>

            {isLoading && (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" />)}
              </div>
            )}

            {byProject.length === 0 && !isLoading && (
              <div className="text-center py-8">
                <div className="text-3xl mb-2">💰</div>
                <p className="text-sm text-white/40">No sales yet — publish a paid project to start earning!</p>
                <button
                  onClick={() => nav("/studio")}
                  className="mt-3 px-4 py-2 rounded-full text-xs font-bold"
                  style={{ background: "#A29BFE", color: "#000" }}
                >
                  Open Studio
                </button>
              </div>
            )}

            {byProject.map((p) => (
              <div key={p.projectId} className="flex items-center justify-between p-3 bg-[rgba(30,26,62,0.62)] border border-white/5 rounded-xl mb-2">
                <div>
                  <p className="text-xs font-bold text-white">Project #{p.projectId}</p>
                  <p className="text-[10px] text-white/40">{p.sales} sale{p.sales !== 1 ? "s" : ""}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-green-400">{formatCents(p.net)}</p>
                  <p className="text-[10px] text-white/30">net ({formatCents(p.gross)} gross)</p>
                </div>
              </div>
            ))}
          </div>

          {/* Recent transactions */}
          {earnings.length > 0 && (
            <div className="px-4 mb-4">
              <h2 className="text-sm font-bold text-white mb-3">Recent Transactions</h2>
              {earnings.slice(0, 10).map((e) => (
                <div key={e.id} className="flex items-center justify-between py-2.5 border-b border-white/5">
                  <div>
                    <p className="text-xs text-white">Project #{e.sourceProjectId}</p>
                    <p className="text-[10px] text-white/30">{timeAgo(e.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-green-400">+{formatCents(e.netAmount)}</p>
                    <p className="text-[10px] text-white/30">{formatCents(e.grossAmount)} gross</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Stripe connect / manage */}
          <div className="mx-4 mb-6">
            <Button
              className="w-full font-bold rounded-xl h-10 flex items-center justify-center gap-2"
              style={{ background: "rgba(30,26,62,0.62)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}
              onClick={() => portal.mutate()}
              disabled={portal.isPending}
            >
              <ExternalLink size={14} />
              Manage Billing & Payouts
            </Button>
          </div>
        </>
      )}

      <UpgradeModal
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        reason="creator"
      />
    </div>
  );
}
