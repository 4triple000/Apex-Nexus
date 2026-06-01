/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  APEX GAME ENGINE — HUD Overlays                        ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * Score, lives, timer, win/lose screens — all HTML overlays
 * on top of the canvas (no canvas drawing required).
 */

interface HUDProps {
  score:       number;
  lives:       number;
  timer?:      number;  // seconds remaining (survive mode)
  phase:       "playing" | "won" | "lost" | "idle";
  gameTitle:   string;
  onRestart:   () => void;
  onBack:      () => void;
}

export function GameHUD({ score, lives, timer, phase, gameTitle, onRestart, onBack }: HUDProps) {
  const GOLD = "#ffcc33";
  const GRAD = "linear-gradient(135deg,#6C5CE7,#A29BFE,#FD79A8)";

  return (
    <>
      {/* ── Top bar (always visible during play) ──────────────────────────── */}
      {phase === "playing" && (
        <div style={{
          position:       "absolute",
          top:            0,
          left:           0,
          right:          0,
          height:         48,
          background:     "rgba(7,8,14,0.75)",
          backdropFilter: "blur(10px)",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          padding:        "0 16px",
          zIndex:         10,
        }}>
          {/* Back */}
          <button
            onClick={onBack}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "#888", fontSize: 20, padding: 4,
            }}
          >‹</button>

          {/* Score */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: GOLD, fontWeight: 700, fontSize: 15 }}>◆ {score}</span>
          </div>

          {/* Lives + timer */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {timer !== undefined && (
              <span style={{
                color: timer < 10 ? "#ff4444" : "#A29BFE",
                fontWeight: 700, fontSize: 14,
                transition: "color 0.3s",
              }}>{Math.ceil(timer)}s</span>
            )}
            <span style={{ color: "#ff6b6b", fontSize: 14 }}>
              {"❤️".repeat(Math.max(0, lives))}
            </span>
          </div>
        </div>
      )}

      {/* ── Win screen ──────────────────────────────────────────────────────── */}
      {phase === "won" && (
        <EndScreen
          icon="🏆"
          title="YOU WIN!"
          titleColor={GOLD}
          subtitle={`Score: ${score}`}
          message="Incredible run. The engine is yours."
          gradient={GRAD}
          onRestart={onRestart}
          onBack={onBack}
        />
      )}

      {/* ── Lose screen ─────────────────────────────────────────────────────── */}
      {phase === "lost" && (
        <EndScreen
          icon="💀"
          title="GAME OVER"
          titleColor="#ff6b6b"
          subtitle={`Final Score: ${score}`}
          message="Every loss is data. Come back sharper."
          gradient="linear-gradient(135deg,#2d1b1b,#4a1515)"
          onRestart={onRestart}
          onBack={onBack}
        />
      )}
    </>
  );
}

// ── End screen ────────────────────────────────────────────────────────────────

function EndScreen({
  icon, title, titleColor, subtitle, message, gradient, onRestart, onBack,
}: {
  icon: string; title: string; titleColor: string; subtitle: string;
  message: string; gradient: string; onRestart: () => void; onBack: () => void;
}) {
  return (
    <div style={{
      position:       "absolute",
      inset:          0,
      background:     "rgba(7,8,14,0.92)",
      backdropFilter: "blur(16px)",
      display:        "flex",
      flexDirection:  "column",
      alignItems:     "center",
      justifyContent: "center",
      gap:            20,
      zIndex:         20,
    }}>
      <div style={{ fontSize: 64, lineHeight: 1 }}>{icon}</div>

      <div style={{
        fontSize:   28,
        fontWeight: 900,
        color:      titleColor,
        letterSpacing: "0.08em",
      }}>{title}</div>

      <div style={{
        fontSize:   18,
        fontWeight: 700,
        background: gradient,
        WebkitBackgroundClip: "text",
        WebkitTextFillColor:  "transparent",
      }}>{subtitle}</div>

      <p style={{ color: "#aaa", fontSize: 13, textAlign: "center", maxWidth: 240, margin: 0 }}>
        {message}
      </p>

      <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
        <button
          onClick={onRestart}
          style={{
            padding:      "12px 28px",
            borderRadius: 14,
            border:       "none",
            background:   gradient,
            color:        "#fff",
            fontWeight:   700,
            fontSize:     15,
            cursor:       "pointer",
          }}
        >Play Again</button>
        <button
          onClick={onBack}
          style={{
            padding:      "12px 24px",
            borderRadius: 14,
            border:       "1px solid rgba(255,255,255,0.15)",
            background:   "rgba(255,255,255,0.06)",
            color:        "#ccc",
            fontWeight:   600,
            fontSize:     15,
            cursor:       "pointer",
          }}
        >Back</button>
      </div>
    </div>
  );
}
