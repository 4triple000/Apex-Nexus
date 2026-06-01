import { useState, useEffect } from "react";
import { canvasApi, type StatsResult } from "../api";

const GREEN = "#55EFC4";
const PURPLE = "#A29BFE";
const CYAN = "#00D2D3";
const GOLD = "#FFCC33";

const COLORS = [GREEN, PURPLE, CYAN, GOLD];
const BAR_DATA = [42, 68, 55, 80, 73, 90, 78];
const BAR_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

export default function DashboardUI() {
  const [stats, setStats]         = useState<StatsResult | null>(null);
  const [loading, setLoading]     = useState(true);
  const [activeMetric, setActive] = useState(0);

  useEffect(() => {
    canvasApi.getStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));

    const poll = setInterval(() => {
      canvasApi.getStats().then(setStats).catch(() => {});
    }, 5000);
    return () => clearInterval(poll);
  }, []);

  const max = Math.max(...BAR_DATA);

  const metricList = stats
    ? [
        { label: stats.revenue.label,  value: `$${stats.revenue.value}`,  delta: stats.revenue.delta,  icon: stats.revenue.icon,  color: GREEN  },
        { label: stats.orders.label,   value: String(stats.orders.value),  delta: stats.orders.delta,   icon: stats.orders.icon,   color: PURPLE },
        { label: stats.users.label,    value: String(stats.users.value),   delta: stats.users.delta,    icon: stats.users.icon,    color: CYAN   },
        { label: stats.messages.label, value: String(stats.messages.value),delta: stats.messages.delta, icon: stats.messages.icon, color: GOLD   },
      ]
    : null;

  return (
    <div style={{ background: "#0A0A12", borderRadius: 12, overflow: "hidden" }}
         onClick={e => e.stopPropagation()}>
      <div style={{ padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between" }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: "#E8EAED" }}>📊 Analytics</div>
        <div style={{ fontSize: 8, color: GREEN }}>● Live Data</div>
      </div>

      {loading ? (
        <div style={{ padding: 20, display: "flex", justifyContent: "center" }}>
          <div style={{ width: 16, height: 16, border: "2px solid rgba(162,155,254,0.2)", borderTopColor: "#A29BFE", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        </div>
      ) : metricList ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, padding: 8 }}>
            {metricList.map((m, i) => (
              <button key={i} onClick={e => { e.stopPropagation(); setActive(i); }}
                style={{ background: activeMetric === i ? `${m.color}15` : "rgba(255,255,255,0.03)", border: `1px solid ${activeMetric === i ? m.color + "44" : "rgba(255,255,255,0.06)"}`, borderRadius: 9, padding: "7px 8px", cursor: "pointer", textAlign: "left", transition: "all 0.15s ease" }}>
                <div style={{ fontSize: 12, marginBottom: 2 }}>{m.icon}</div>
                <div style={{ fontSize: 11, fontWeight: 800, color: m.color }}>{m.value}</div>
                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.35)" }}>{m.label}</div>
                <div style={{ fontSize: 8, fontWeight: 700, color: m.delta.startsWith("+") ? GREEN : "#FD79A8", marginTop: 2 }}>{m.delta}</div>
              </button>
            ))}
          </div>
          <div style={{ padding: "0 10px 10px" }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: "rgba(255,255,255,0.25)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Weekly</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 44 }}>
              {BAR_DATA.map((v, i) => (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <div style={{ width: "100%", borderRadius: "3px 3px 0 0", height: `${(v / max) * 38}px`, background: i === 5 || i === 6 ? "rgba(255,255,255,0.08)" : COLORS[activeMetric], opacity: i === BAR_DATA.indexOf(Math.max(...BAR_DATA)) ? 1 : 0.55, transition: "height 0.4s ease, background 0.3s" }} />
                  <div style={{ fontSize: 7, color: "rgba(255,255,255,0.2)" }}>{BAR_LABELS[i]}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
