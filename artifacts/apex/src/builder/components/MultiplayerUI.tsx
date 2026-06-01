import { useState, useEffect } from "react";
import { canvasApi, type LeaderEntry } from "../api";

const CYAN = "#00D2D3";
const GREEN = "#55EFC4";

export default function MultiplayerUI() {
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  const [loading, setLoading]         = useState(true);
  const [events, setEvents]           = useState<string[]>([]);

  useEffect(() => {
    canvasApi.getLeaderboard()
      .then(setLeaderboard)
      .catch(() => {})
      .finally(() => setLoading(false));

    const LIVE_EVENTS = [
      "Player_1 eliminated 👾", "DragonX leveled up ⚡", "New match: 3v3 🔥",
      "NeonKnight hit 2840 pts 🏆", "Bonus crate dropped 🎁", "BlazeFox joined the lobby 🦊",
    ];

    const poll = setInterval(async () => {
      canvasApi.getLeaderboard().then(setLeaderboard).catch(() => {});
      setEvents(prev => [...prev.slice(-3), LIVE_EVENTS[Math.floor(Math.random() * LIVE_EVENTS.length)]!]);
    }, 3000);
    return () => clearInterval(poll);
  }, []);

  const RANK_COLORS: Record<number, string> = { 0: "#FFCC33", 1: "rgba(255,255,255,0.5)", 2: "#CD7F32" };

  return (
    <div style={{ background: "#05060F", borderRadius: 12, overflow: "hidden" }}
         onClick={e => e.stopPropagation()}>
      <div style={{ padding: "7px 10px", background: "rgba(0,210,211,0.06)", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: CYAN }}>🌐 Leaderboard</div>
        <div style={{ fontSize: 8, color: GREEN }}>● Live</div>
      </div>

      {loading ? (
        <div style={{ padding: 16, display: "flex", justifyContent: "center" }}>
          <div style={{ width: 14, height: 14, border: "2px solid rgba(0,210,211,0.2)", borderTopColor: CYAN, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        </div>
      ) : (
        <div style={{ padding: "8px 8px 4px", display: "flex", flexDirection: "column", gap: 4 }}>
          {leaderboard.slice(0, 5).map((entry, i) => (
            <div key={entry.id} style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 7px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ fontSize: 11, width: 16, textAlign: "center", color: RANK_COLORS[i] ?? "rgba(255,255,255,0.2)", fontWeight: 800 }}>{i + 1}</div>
              <span style={{ fontSize: 13 }}>{entry.avatar}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#E8EAED" }}>{entry.name}</div>
                <div style={{ fontSize: 7, color: "rgba(255,255,255,0.25)" }}>Lvl {entry.level}</div>
              </div>
              <div style={{ fontSize: 10, fontWeight: 800, color: CYAN }}>{entry.score.toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}

      {events.length > 0 && (
        <div style={{ margin: "4px 8px 8px", padding: "6px 8px", background: "rgba(255,255,255,0.02)", borderRadius: 8 }}>
          {events.slice(-2).map((e, i) => (
            <div key={i} style={{ fontSize: 8, color: "rgba(255,255,255,0.35)", lineHeight: 1.6, opacity: i === 0 ? 0.5 : 1 }}>{e}</div>
          ))}
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
