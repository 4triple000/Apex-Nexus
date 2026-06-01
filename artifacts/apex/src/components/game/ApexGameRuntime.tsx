/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  APEX — In-App Game Runtime                                 ║
 * ║                                                             ║
 * ║  Full-screen game container that drives itself entirely     ║
 * ║  from the ApexEngine bridge — no external tools needed.    ║
 * ║                                                             ║
 * ║  Features:                                                  ║
 * ║    • Reads engine state from EngineContext                  ║
 * ║    • Native Fullscreen API (desktop + mobile)              ║
 * ║    • Landscape hint banner on portrait mobile              ║
 * ║    • Overlay UI for idle / loading / end states            ║
 * ║    • Notifies engine on game-end / score updates           ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
import {
  useRef,
  useState,
  useEffect,
  useCallback,
  type CSSProperties,
} from "react";
import { useEngine }   from "@/engine/EngineContext";
import { GameCanvas }  from "./GameCanvas";

// ── Design tokens ─────────────────────────────────────────────────────────────

const BG   = "#07080E";
const GRAD = "linear-gradient(135deg,#6C5CE7,#A29BFE,#FD79A8)";
const GOLD = "#ffcc33";

// ── Helpers ───────────────────────────────────────────────────────────────────

function useIsPortrait() {
  const [portrait, setPortrait] = useState(
    () => typeof window !== "undefined" && window.innerHeight > window.innerWidth,
  );
  useEffect(() => {
    const handler = () => setPortrait(window.innerHeight > window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return portrait;
}

function useIsMobile() {
  return typeof navigator !== "undefined" &&
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface ApexGameRuntimeProps {
  /** Whether the runtime panel is visible. */
  visible?: boolean;
  /** Called when the user closes / exits the runtime. */
  onClose?: () => void;
  /** Override style for the outer container. */
  style?: CSSProperties;
}

export function ApexGameRuntime({
  visible = true,
  onClose,
  style,
}: ApexGameRuntimeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const {
    status,
    config,
    score,
    kills,
    wave,
    startGame,
    stopGame,
    notifyGameEnd,
    notifyUpdate,
  } = useEngine();

  const isPortrait = useIsPortrait();
  const isMobile   = useIsMobile();

  // ── Fullscreen API ────────────────────────────────────────────────────────

  const enterFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (el.requestFullscreen)           await el.requestFullscreen();
      else if ((el as any).webkitRequestFullscreen) (el as any).webkitRequestFullscreen();
    } catch { /* permission denied — ignore */ }
  }, []);

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
    } catch { /* ignore */ }
  }, []);

  const toggleFullscreen = useCallback(() => {
    isFullscreen ? exitFullscreen() : enterFullscreen();
  }, [isFullscreen, enterFullscreen, exitFullscreen]);

  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(!!(document.fullscreenElement || (document as any).webkitFullscreenElement));
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!visible) return null;

  const containerStyle: CSSProperties = {
    position:        "relative",
    width:           "100%",
    height:          "100%",
    background:      BG,
    display:         "flex",
    flexDirection:   "column",
    alignItems:      "center",
    justifyContent:  "center",
    overflow:        "hidden",
    borderRadius:    isFullscreen ? 0 : 16,
    ...style,
  };

  // ── Idle / no game loaded ──────────────────────────────────────────────────

  if (status === "idle" || !config) {
    return (
      <div ref={containerRef} style={containerStyle}>
        <div style={{
          textAlign:  "center",
          color:      "rgba(255,255,255,0.35)",
          fontFamily: "'Inter','SF Pro Display',sans-serif",
          padding:    32,
        }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🎮</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "rgba(255,255,255,0.6)", marginBottom: 8 }}>
            No Game Loaded
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>
            Pick a game from the Studio tab or<br />ask the AI to generate one for you.
          </div>
        </div>
        <TopBar onClose={onClose} onFullscreen={toggleFullscreen} isFullscreen={isFullscreen} />
      </div>
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (status === "loading") {
    return (
      <div ref={containerRef} style={containerStyle}>
        <TopBar onClose={onClose} onFullscreen={toggleFullscreen} isFullscreen={isFullscreen} />
        <LoadingOverlay config={config} onStart={startGame} />
      </div>
    );
  }

  // ── Won / Lost ─────────────────────────────────────────────────────────────

  if (status === "won" || status === "lost") {
    return (
      <div ref={containerRef} style={containerStyle}>
        <TopBar onClose={onClose} onFullscreen={toggleFullscreen} isFullscreen={isFullscreen} />
        <EndOverlay
          result={status}
          score={score}
          kills={kills}
          wave={wave}
          onRestart={startGame}
          onExit={() => { stopGame(); onClose?.(); }}
        />
      </div>
    );
  }

  // ── Playing / Paused ───────────────────────────────────────────────────────

  return (
    <div ref={containerRef} style={containerStyle}>
      <TopBar
        onClose={() => { stopGame(); onClose?.(); }}
        onFullscreen={toggleFullscreen}
        isFullscreen={isFullscreen}
        score={score}
        wave={wave}
        kills={kills}
        showStats={status === "playing"}
      />

      {/* Portrait warning on mobile */}
      {isMobile && isPortrait && status === "playing" && (
        <div style={{
          position:      "absolute",
          top:            0, left: 0, right: 0, bottom: 0,
          background:    "rgba(7,8,14,0.92)",
          zIndex:        50,
          display:       "flex",
          flexDirection: "column",
          alignItems:    "center",
          justifyContent:"center",
          gap:           16,
        }}>
          <div style={{ fontSize: 44 }}>📱↔️</div>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 17 }}>
            Rotate for best experience
          </div>
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
            Landscape mode recommended
          </div>
        </div>
      )}

      {/* ── Game Canvas ──────────────────────────────────────────────────── */}
      <div style={{ flex: 1, width: "100%", position: "relative" }}>
        <GameCanvas
          config={config}
          onGameEnd={(result, finalScore) => {
            notifyGameEnd(result, finalScore);
          }}
          onBack={() => { stopGame(); onClose?.(); }}
        />
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface TopBarProps {
  onClose?:       () => void;
  onFullscreen?:  () => void;
  isFullscreen?:  boolean;
  score?:         number;
  wave?:          number;
  kills?:         number;
  showStats?:     boolean;
}

function TopBar({ onClose, onFullscreen, isFullscreen, score, wave, kills, showStats }: TopBarProps) {
  return (
    <div style={{
      position:       "absolute",
      top:             0,
      left:            0,
      right:           0,
      height:          44,
      display:        "flex",
      alignItems:     "center",
      justifyContent: "space-between",
      padding:        "0 12px",
      background:     "linear-gradient(to bottom,rgba(7,8,14,0.85),transparent)",
      zIndex:          20,
      pointerEvents:  "none",
    }}>
      {/* Left: close */}
      <button
        onClick={onClose}
        style={{
          pointerEvents: "all",
          background:    "rgba(255,255,255,0.08)",
          border:        "1px solid rgba(255,255,255,0.12)",
          borderRadius:  20,
          color:         "#fff",
          fontSize:      12,
          fontWeight:    600,
          padding:       "4px 12px",
          cursor:        "pointer",
          backdropFilter:"blur(8px)",
        }}
      >✕ Exit</button>

      {/* Centre: live stats */}
      {showStats && (
        <div style={{
          display:    "flex",
          gap:         16,
          color:       "rgba(255,255,255,0.85)",
          fontSize:    12,
          fontWeight:  700,
          fontFamily:  "monospace",
        }}>
          {score   !== undefined && <span style={{ color: GOLD }}>⭐ {score}</span>}
          {wave    !== undefined && wave > 0 && <span>Wave {wave}</span>}
          {kills   !== undefined && kills > 0 && <span style={{ color: "#fd79a8" }}>💀 {kills}</span>}
        </div>
      )}

      {/* Right: fullscreen toggle */}
      <button
        onClick={onFullscreen}
        style={{
          pointerEvents: "all",
          background:    "rgba(255,255,255,0.08)",
          border:        "1px solid rgba(255,255,255,0.12)",
          borderRadius:  20,
          color:         "#fff",
          fontSize:      12,
          fontWeight:    600,
          padding:       "4px 12px",
          cursor:        "pointer",
          backdropFilter:"blur(8px)",
        }}
      >
        {isFullscreen ? "⊠ Window" : "⛶ Full"}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface LoadingOverlayProps {
  config:   { name: string; gameMode?: string };
  onStart:  () => void;
}

function LoadingOverlay({ config, onStart }: LoadingOverlayProps) {
  const modeLabel: Record<string, string> = {
    fps:        "3D FPS",
    openworld:  "Open World",
    gta:        "GTA Mode",
    platformer: "Platformer",
    shooter:    "Shooter",
    basketball: "Basketball",
    topdown:    "Top-Down",
  };

  return (
    <div style={{
      display:        "flex",
      flexDirection:  "column",
      alignItems:     "center",
      justifyContent: "center",
      gap:             20,
      padding:        40,
      textAlign:      "center",
    }}>
      {/* Game icon */}
      <div style={{
        width:        80,
        height:       80,
        borderRadius: 22,
        background:   GRAD,
        display:      "flex",
        alignItems:   "center",
        justifyContent:"center",
        fontSize:     40,
        boxShadow:    "0 8px 32px rgba(108,92,231,0.5)",
      }}>🎮</div>

      <div>
        <div style={{
          fontSize:   22,
          fontWeight: 800,
          color:      "#fff",
          fontFamily: "'Inter','SF Pro Display',sans-serif",
          marginBottom: 6,
        }}>{config.name}</div>
        {config.gameMode && (
          <div style={{
            fontSize:     12,
            fontWeight:   600,
            color:        "rgba(255,255,255,0.45)",
            letterSpacing:"0.08em",
            textTransform:"uppercase",
          }}>{modeLabel[config.gameMode] ?? config.gameMode}</div>
        )}
      </div>

      <button
        onClick={onStart}
        style={{
          background:   GRAD,
          border:       "none",
          borderRadius: 14,
          color:        "#fff",
          fontWeight:   800,
          fontSize:     16,
          padding:      "14px 40px",
          cursor:       "pointer",
          boxShadow:    "0 4px 24px rgba(108,92,231,0.45)",
          letterSpacing:"0.02em",
        }}
      >▶ Launch Game</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface EndOverlayProps {
  result:     "won" | "lost";
  score:      number;
  kills:      number;
  wave:       number;
  onRestart:  () => void;
  onExit:     () => void;
}

function EndOverlay({ result, score, kills, wave, onRestart, onExit }: EndOverlayProps) {
  const isWin = result === "won";
  return (
    <div style={{
      display:        "flex",
      flexDirection:  "column",
      alignItems:     "center",
      justifyContent: "center",
      gap:             20,
      padding:        40,
      textAlign:      "center",
    }}>
      <div style={{ fontSize: 64 }}>{isWin ? "🏆" : "💀"}</div>

      <div style={{
        fontSize:   28,
        fontWeight: 900,
        background: isWin ? GRAD : "linear-gradient(135deg,#e17055,#fd79a8)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor:  "transparent",
        fontFamily: "'Inter','SF Pro Display',sans-serif",
      }}>
        {isWin ? "VICTORY" : "DEFEATED"}
      </div>

      {/* Stats */}
      <div style={{
        display:      "flex",
        gap:           24,
        background:   "rgba(255,255,255,0.05)",
        borderRadius: 14,
        padding:      "14px 28px",
        border:       "1px solid rgba(255,255,255,0.08)",
      }}>
        {score > 0 && <Stat label="Score" value={score} color={GOLD} />}
        {kills > 0 && <Stat label="Kills" value={kills} color="#fd79a8" />}
        {wave  > 0 && <Stat label="Wave"  value={wave}  color="#a29bfe" />}
      </div>

      {/* Buttons */}
      <div style={{ display: "flex", gap: 12 }}>
        <button
          onClick={onRestart}
          style={{
            background:   GRAD,
            border:       "none",
            borderRadius: 12,
            color:        "#fff",
            fontWeight:   800,
            fontSize:     14,
            padding:      "12px 28px",
            cursor:       "pointer",
            boxShadow:    "0 4px 20px rgba(108,92,231,0.4)",
          }}
        >🔄 Play Again</button>
        <button
          onClick={onExit}
          style={{
            background:   "rgba(255,255,255,0.07)",
            border:       "1px solid rgba(255,255,255,0.12)",
            borderRadius: 12,
            color:        "rgba(255,255,255,0.7)",
            fontWeight:   700,
            fontSize:     14,
            padding:      "12px 24px",
            cursor:       "pointer",
          }}
        >Exit</button>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 22, fontWeight: 900, color }}>{value}</div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</div>
    </div>
  );
}
