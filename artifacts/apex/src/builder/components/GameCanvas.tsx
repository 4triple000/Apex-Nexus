import { useState, useEffect, useRef, useCallback } from "react";
import { canvasApi } from "../api";

const CYAN = "#00D2D3";
const PURPLE = "#A29BFE";
const PLAYER_NAME = `Player_${Math.floor(Math.random() * 900 + 100)}`;

interface Enemy { id: number; x: number; y: number; alive: boolean; }

export default function GameCanvas() {
  const [score, setScore]   = useState(0);
  const [playerX, setPlayerX] = useState(50);
  const [bullets, setBullets] = useState<{ id: number; x: number; y: number }[]>([]);
  const [enemies, setEnemies] = useState<Enemy[]>([
    { id: 1, x: 15, y: 15, alive: true }, { id: 2, x: 45, y: 15, alive: true },
    { id: 3, x: 75, y: 15, alive: true }, { id: 4, x: 30, y: 30, alive: true },
    { id: 5, x: 60, y: 30, alive: true },
  ]);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon]           = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const scoreRef = useRef(0);
  scoreRef.current = score;

  const shoot = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (gameOver || won) return;
    setBullets(prev => [...prev, { id: Date.now(), x: playerX, y: 75 }]);
  }, [playerX, gameOver, won]);

  const moveLeft  = (e: React.MouseEvent) => { e.stopPropagation(); setPlayerX(p => Math.max(5, p - 15)); };
  const moveRight = (e: React.MouseEvent) => { e.stopPropagation(); setPlayerX(p => Math.min(90, p + 15)); };

  useEffect(() => {
    if (gameOver || won) return;
    const interval = setInterval(() => {
      setBullets(prev => {
        const moved = prev.map(b => ({ ...b, y: b.y - 8 })).filter(b => b.y > 0);
        setEnemies(enems => {
          let pts = 0;
          const next = enems.map(en => {
            if (!en.alive) return en;
            const hit = moved.some(b => Math.abs(b.x - en.x) < 8 && Math.abs(b.y - en.y) < 8);
            if (hit) { pts += 10; return { ...en, alive: false }; }
            return en;
          });
          if (pts > 0) setScore(s => s + pts);
          if (next.every(e => !e.alive)) setWon(true);
          return next;
        });
        return moved;
      });
    }, 80);
    return () => clearInterval(interval);
  }, [gameOver, won]);

  // Submit score when game ends
  useEffect(() => {
    if ((gameOver || won) && !submitted && scoreRef.current > 0) {
      setSubmitted(true);
      canvasApi.submitScore(PLAYER_NAME, scoreRef.current, "🚀").catch(() => {});
    }
  }, [gameOver, won, submitted]);

  const reset = (e: React.MouseEvent) => {
    e.stopPropagation();
    setScore(0); setPlayerX(50); setBullets([]); setGameOver(false); setWon(false); setSubmitted(false);
    setEnemies([
      { id: Date.now()+1, x: 15, y: 15, alive: true }, { id: Date.now()+2, x: 45, y: 15, alive: true },
      { id: Date.now()+3, x: 75, y: 15, alive: true }, { id: Date.now()+4, x: 30, y: 30, alive: true },
      { id: Date.now()+5, x: 60, y: 30, alive: true },
    ]);
  };

  return (
    <div style={{ background: "#05060F", borderRadius: 12, overflow: "hidden", userSelect: "none" }}
         onClick={e => e.stopPropagation()}>
      <div style={{ padding: "6px 10px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between" }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: CYAN }}>⚡ {score} pts</div>
        <div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)" }}>{PLAYER_NAME}</div>
      </div>

      <div style={{ position: "relative", height: 110, background: "radial-gradient(ellipse at 50% 0%, rgba(108,92,231,0.15) 0%, transparent 70%)", overflow: "hidden" }}>
        {[10,25,40,55,70,85,15,60,80,35].map((x, i) => (
          <div key={i} style={{ position: "absolute", left: `${x}%`, top: `${(i * 23) % 80}%`, width: 1.5, height: 1.5, borderRadius: "50%", background: "rgba(255,255,255,0.3)" }} />
        ))}
        {enemies.map(en => en.alive && (
          <div key={en.id} style={{ position: "absolute", left: `${en.x}%`, top: `${en.y}%`, fontSize: 14, transform: "translate(-50%,-50%)" }}>👾</div>
        ))}
        {bullets.map(b => (
          <div key={b.id} style={{ position: "absolute", left: `${b.x}%`, top: `${b.y}%`, width: 3, height: 8, borderRadius: 99, background: CYAN, transform: "translate(-50%,-50%)", boxShadow: `0 0 6px ${CYAN}` }} />
        ))}
        <div style={{ position: "absolute", left: `${playerX}%`, bottom: 6, fontSize: 16, transform: "translateX(-50%)" }}>🚀</div>

        {(gameOver || won) && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <div style={{ fontSize: 14 }}>{won ? "🏆" : "💀"}</div>
            <div style={{ fontSize: 10, fontWeight: 800, color: won ? "#FFCC33" : "#FD79A8" }}>{won ? "YOU WIN!" : "GAME OVER"}</div>
            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.4)" }}>{score} pts saved to leaderboard</div>
            <button onClick={reset} style={{ fontSize: 9, fontWeight: 700, padding: "3px 10px", borderRadius: 99, border: "none", background: PURPLE, color: "white", cursor: "pointer", marginTop: 2 }}>Play Again</button>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 6, padding: "8px 10px" }}>
        <button onClick={moveLeft}  style={{ flex: 1, padding: "6px 0", borderRadius: 8, border: "none", background: "rgba(162,155,254,0.12)", color: PURPLE, fontSize: 14, cursor: "pointer", fontWeight: 700 }}>◀</button>
        <button onClick={shoot}     style={{ flex: 2, padding: "6px 0", borderRadius: 8, border: "none", background: "rgba(0,210,211,0.12)", color: CYAN, fontSize: 11, cursor: "pointer", fontWeight: 800 }}>FIRE 🔥</button>
        <button onClick={moveRight} style={{ flex: 1, padding: "6px 0", borderRadius: 8, border: "none", background: "rgba(162,155,254,0.12)", color: PURPLE, fontSize: 14, cursor: "pointer", fontWeight: 700 }}>▶</button>
      </div>
    </div>
  );
}
