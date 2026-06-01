/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  APEX — Engine React Context                                ║
 * ║                                                             ║
 * ║  Bridges the ApexEngine singleton into React.              ║
 * ║                                                             ║
 * ║  Usage:                                                     ║
 * ║    // Wrap the app once (already done in main.tsx):        ║
 * ║    <EngineProvider><App /></EngineProvider>                ║
 * ║                                                             ║
 * ║    // Inside any component:                                 ║
 * ║    const { status, loadGame, startGame } = useEngine();    ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { ApexEngine }             from "./ApexEngine";
import type { EngineGameState }   from "./ApexEngine";
import type { GameConfig }        from "./types";

// ── Context value shape ───────────────────────────────────────────────────────

export interface EngineContextValue extends EngineGameState {
  /** Stage a game config (transitions to "loading"). */
  loadGame:     (config: GameConfig) => void;
  /** Begin / resume the staged game (transitions to "playing"). */
  startGame:    () => void;
  /** Pause or reset depending on current state. */
  stopGame:     () => void;
  /** Hot-patch the active config without resetting score. */
  updateGame:   (updates: Partial<GameConfig>) => void;
  /** AI-generate a game from a text prompt then load it. */
  generateGame: (prompt: string) => Promise<GameConfig>;
  /** loadGame + startGame in one call — most common entry point. */
  sendToEngine: (config: GameConfig) => void;
  /** Called by game canvases when the game ends. */
  notifyGameEnd: (result: "won" | "lost", score: number) => void;
  /** Called each frame to keep score / wave / kills in sync. */
  notifyUpdate:  (data: { wave?: number; kills?: number; score?: number }) => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

const EngineContext = createContext<EngineContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function EngineProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<EngineGameState>(() => ApexEngine.snapshot);

  // Mirror ApexEngine → React state whenever the engine emits stateChange
  useEffect(() => {
    const unsub = ApexEngine.on((event) => {
      if (event.type === "stateChange") setState(event.state);
    });
    return unsub;
  }, []);

  // ── Stable action callbacks ───────────────────────────────────────────────

  const loadGame     = useCallback((config: GameConfig) => ApexEngine.loadGame(config), []);
  const startGame    = useCallback(() => ApexEngine.startGame(), []);
  const stopGame     = useCallback(() => ApexEngine.stopGame(), []);
  const updateGame   = useCallback((u: Partial<GameConfig>) => ApexEngine.updateGame(u), []);
  const generateGame = useCallback((p: string) => ApexEngine.generateGame(p), []);
  const sendToEngine = useCallback((c: GameConfig) => ApexEngine.sendToEngine(c), []);
  const notifyGameEnd = useCallback(
    (r: "won" | "lost", s: number) => ApexEngine.notifyGameEnd(r, s), []
  );
  const notifyUpdate = useCallback(
    (d: { wave?: number; kills?: number; score?: number }) => ApexEngine.notifyUpdate(d), []
  );

  const value: EngineContextValue = {
    ...state,
    loadGame,
    startGame,
    stopGame,
    updateGame,
    generateGame,
    sendToEngine,
    notifyGameEnd,
    notifyUpdate,
  };

  return <EngineContext.Provider value={value}>{children}</EngineContext.Provider>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Access the Apex engine from any component.
 *
 * @example
 * const { status, config, sendToEngine, stopGame } = useEngine();
 */
export function useEngine(): EngineContextValue {
  const ctx = useContext(EngineContext);
  if (!ctx) throw new Error("useEngine() must be used inside <EngineProvider>");
  return ctx;
}
