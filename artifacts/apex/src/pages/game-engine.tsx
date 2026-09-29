/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  APEX GAME ENGINE v2 — Full-Screen Page                 ║
 * ║  Tabs: Studio | Play | Multiplayer                      ║
 * ╚══════════════════════════════════════════════════════════╝
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { io, type Socket } from "socket.io-client";
import { ApexGameRuntime } from "@/components/game/ApexGameRuntime";
import { GameCanvas }      from "@/components/game/GameCanvas";
import { BuilderTab }      from "@/components/builder/BuilderTab";
import GameStudioPanel     from "@/components/game-studio/GameStudioPanel";
import { useEngine }        from "@/engine/EngineContext";
import { DEMO_GAMES, generateGameFromPrompt } from "@/engine/demoGames";
import {
  consumePendingGame, consumeEditorGame,
  saveUserGameEntry, deleteUserGame,
  getUserGames, getGameMeta,
  GAME_CREATED_EVENT, GAME_DELETED_EVENT,
} from "@/data/gameRegistry";
import type { GameConfig, RemotePlayer } from "@/engine/types";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
function api(p: string) { return `${BASE}${p}`; }

// ── Design tokens ─────────────────────────────────────────────────────────────

const BG     = "#07080E";
const CARD   = "rgba(255,255,255,0.04)";
const BORDER = "rgba(255,255,255,0.08)";
const GRAD   = "linear-gradient(135deg,#6C5CE7,#A29BFE,#FD79A8)";

type Tab = "studio" | "play" | "multiplayer" | "builder" | "ai-studio" | "community";

// ── Session ID (persistent per browser, used for like dedup) ──────────────────
function getSessionId(): string {
  const k = "apex_session_id";
  const s = localStorage.getItem(k);
  if (s) return s;
  const id = `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem(k, id);
  return id;
}

// ── Load saved games (delegated to registry) ─────────────────────────────────

function loadSavedGames(): GameConfig[] { return getUserGames(); }

// ── Player identity ───────────────────────────────────────────────────────────

function getIdentity() {
  const k = "apex_game_identity";
  const s = localStorage.getItem(k);
  if (s) return JSON.parse(s) as { id: string; name: string };
  const NAMES = ["Phantom", "Vortex", "Shadow", "Nova", "Cipher", "Ghost", "Blaze"];
  const identity = {
    id:   `player_${Math.random().toString(36).slice(2, 10)}`,
    name: NAMES[Math.floor(Math.random() * NAMES.length)]! + Math.floor(Math.random() * 999),
  };
  localStorage.setItem(k, JSON.stringify(identity));
  return identity;
}

// ── Descriptions for demo games ───────────────────────────────────────────────

const DEMO_DESCRIPTIONS: Record<string, string> = {
  "Neon Platformer": "Collect all coins, stomp enemies, climb to the top. Classic platformer with glowing neon visuals.",
  "Sky Jumper":      "Race across floating islands to reach the goal flag. Watch out for patrolling guards.",
  "Dodge Blitz":     "Survive 30 seconds as waves of enemies rain from above. Move fast, stay alive.",
  "Neon Ops":        "Top-down shooter. Eliminate all enemies. Move with d-pad, aim by facing direction, tap 🔫 to fire.",
  "Street Hoops":    "Arcade basketball. Score 10 points before time runs out. Jump + tap 🏀 to arc-shoot toward the basket.",
  "Neon Warzone":    "3D first-person shooter powered by WebGL. WASD + mouse look. Click to shoot. Eliminate all 8 enemies to win.",
};

const DEMO_ICONS: Record<string, string> = {
  "Neon Platformer": "🟣",
  "Sky Jumper":      "🔵",
  "Dodge Blitz":     "🟢",
  "Neon Ops":        "🔫",
  "Street Hoops":    "🏀",
  "Neon Warzone":    "🎯",
};

// ─────────────────────────────────────────────────────────────────────────────

export default function GameEnginePage() {
  const [, setLocation] = useLocation();
  const [tab, setTab]   = useState<Tab>("studio");

  // ── Engine bridge ─────────────────────────────────────────────────────────
  const { sendToEngine, stopGame, status: engineStatus } = useEngine();

  // ── Active game (kept for local state; engine bridge owns the runtime) ────

  const [activeGame, setActiveGame] = useState<GameConfig | null>(null);

  // ── Studio state ──────────────────────────────────────────────────────────

  const [prompt,             setPrompt]             = useState("");
  const [generating,         setGenerating]         = useState(false);
  const [editorCfg,          setEditorCfg]          = useState<GameConfig | null>(null);
  const [showJson,           setShowJson]           = useState(false);
  /** When true, the AI-generated game is previewed inline in the Studio tab. */
  const [showInlinePreview,  setShowInlinePreview]  = useState(false);
  const [genError,     setGenError]     = useState<string | null>(null);
  const [savedGames,   setSavedGames]   = useState<GameConfig[]>(() => loadSavedGames());
  const editorRef = useRef<HTMLDivElement>(null);

  // ── Sync with registry events (real-time Me tab updates) ──────────────────
  useEffect(() => {
    const onCreated = () => setSavedGames(getUserGames());
    const onDeleted = () => setSavedGames(getUserGames());
    window.addEventListener(GAME_CREATED_EVENT, onCreated);
    window.addEventListener(GAME_DELETED_EVENT, onDeleted);
    return () => {
      window.removeEventListener(GAME_CREATED_EVENT, onCreated);
      window.removeEventListener(GAME_DELETED_EVENT, onDeleted);
    };
  }, []);

  // ── Consume cross-page game queues (from Me tab / registry) ──────────────
  useEffect(() => {
    // Check for ?launch= URL param (from Dev Cockpit "Test it" link)
    const urlParams = new URLSearchParams(window.location.search);
    const launchName = urlParams.get("launch");
    if (launchName) {
      const game = DEMO_GAMES.find(
        (g) => g.name.toLowerCase() === launchName.toLowerCase() ||
               g.name.toLowerCase().replace(/\s+/g, "-") === launchName.toLowerCase().replace(/\s+/g, "-")
      );
      if (game) {
        console.log(`[GameEngine] Auto-launching from URL param: "${game.name}"`);
        setActiveGame(game as GameConfig);
        sendToEngine(game as GameConfig);
        setTab("play");
        return;
      }
    }

    // Check for a pending play game (from Me tab "Play" button)
    const pending = consumePendingGame();
    if (pending) {
      console.log(`[GameEngine] Auto-launching game from registry: "${pending.name}"`);
      setActiveGame(pending);
      setTab("play");
      return;
    }
    // Check for a pending editor game (from Me tab "Edit in Studio" button)
    const editGame = consumeEditorGame();
    if (editGame) {
      console.log(`[GameEngine] Loading game into editor: "${editGame.name}"`);
      setEditorCfg(editGame);
      setShowJson(true);
      setTab("studio");
    }
  }, [sendToEngine]);

  // ── Multiplayer state ─────────────────────────────────────────────────────

  const socketRef       = useRef<Socket | null>(null);
  const [roomId,        setRoomId]        = useState("");
  const [roomInput,     setRoomInput]     = useState("");
  const [inRoom,        setInRoom]        = useState(false);
  const [remotePlayers, setRemotePlayers] = useState<RemotePlayer[]>([]);
  const [playerCount,   setPlayerCount]  = useState(0);
  const identity = useRef(getIdentity());

  // ── Actions ───────────────────────────────────────────────────────────────

  /** Launch a game into the Play tab — drives the engine bridge */
  const launchGame = (cfg: GameConfig) => {
    setActiveGame(cfg);
    sendToEngine(cfg);   // load + start via ApexEngine
    setTab("play");
  };

  /** Load a game config into the editor panel (scrolls to editor) */
  const loadIntoEditor = (cfg: GameConfig) => {
    setEditorCfg(cfg);
    setShowJson(true);
    setTab("studio");
    // Give React a tick to re-render, then scroll to editor
    setTimeout(() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  /** Save a generated game to registry (triggers GAME_CREATED_EVENT for Me tab sync) */
  const saveGame = (cfg: GameConfig, createdBy: "ai" | "user" = "user", desc = "") => {
    saveUserGameEntry(cfg, createdBy, desc);
    setSavedGames(getUserGames()); // refresh local state immediately
  };

  /** Delete a saved game via registry */
  const deleteGame = (name: string) => {
    deleteUserGame(name);
    setSavedGames(getUserGames());
  };

  // ── Share state ──────────────────────────────────────────────────────────────
  const [sharing,     setSharing]     = useState<string | null>(null); // game name being shared
  const [shareToast,  setShareToast]  = useState<string | null>(null);

  /** Publish a game to the community feed */
  const shareGame = async (cfg: GameConfig, creatorName = "Player") => {
    setSharing(cfg.name);
    try {
      const res = await fetch(api("/api/game-feed/publish"), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-session-id": getSessionId() },
        body: JSON.stringify({
          name:        cfg.name,
          creatorName,
          createdBy:   "user",
          gameConfig:  cfg,
          tags:        [cfg.gameMode ?? "platformer", cfg.winCondition],
          remixable:   true,
        }),
      });
      if (!res.ok) throw new Error("publish failed");
      setShareToast(`🚀 "${cfg.name}" shared to Community!`);
      setTimeout(() => setShareToast(null), 3500);
    } catch {
      setShareToast("⚠️ Couldn't share — try again.");
      setTimeout(() => setShareToast(null), 3000);
    } finally {
      setSharing(null);
    }
  };

  // ── AI Generator ──────────────────────────────────────────────────────────

  const generateGame = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setGenError(null);
    try {
      let config: GameConfig;
      try {
        const res  = await fetch(api("/api/game/generate"), {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ prompt }),
        });
        const data = await res.json();
        config = data.config ?? generateGameFromPrompt(prompt);
      } catch {
        config = generateGameFromPrompt(prompt);
        setGenError("Using offline generator — AI unavailable.");
      }

      console.log(`%c[GameEngine] AI GAME GENERATED: "${config.name}"`, "color:#6C5CE7;font-weight:bold");

      // ── Auto-save to registry immediately (no manual step needed) ──────────
      saveUserGameEntry(config, "ai", `AI-generated from: "${prompt.slice(0, 60)}"`);
      setSavedGames(getUserGames());
      console.log(`%c[GameEngine] GAME READY TO PLAY: "${config.name}"`, "color:#10B981;font-weight:bold");

      setEditorCfg(config);
      setShowJson(false);

      // ── Send directly to engine → preview appears inline in Studio tab ──────
      sendToEngine(config);         // load + start via bridge (no tab switch)
      setShowInlinePreview(true);   // reveal the inline preview panel

    } finally {
      setGenerating(false);
    }
  };

  // ── Multiplayer socket ─────────────────────────────────────────────────────

  const connectSocket = useCallback(() => {
    if (socketRef.current?.connected) return;
    // socket.io takes the namespace from the URL path, not an option
    const sock = io(`${window.location.origin}/game`, {
      path:      "/api/socket.io",
      transports: ["websocket", "polling"],
    });
    socketRef.current = sock;

    sock.on("roomState", ({ players }: { players: RemotePlayer[] }) => {
      setRemotePlayers(players);
      setPlayerCount(players.length + 1);
    });
    sock.on("playerJoined", (p: RemotePlayer) => {
      setRemotePlayers((prev) => [...prev, p]);
      setPlayerCount((c) => c + 1);
    });
    sock.on("playerLeft", ({ id }: { id: string }) => {
      setRemotePlayers((prev) => prev.filter((p) => p.id !== id));
      setPlayerCount((c) => Math.max(1, c - 1));
    });
    sock.on("playerMoved", ({ id, x, y }: RemotePlayer) => {
      setRemotePlayers((prev) => prev.map((p) => p.id === id ? { ...p, x, y } : p));
    });
  }, []);

  const joinRoom = () => {
    const rid = roomInput.trim() || `room_${Math.random().toString(36).slice(2, 8)}`;
    connectSocket();
    socketRef.current?.emit("joinRoom", {
      roomId: rid, playerName: identity.current.name,
      color: "#6C5CE7", width: 32, height: 32,
    });
    setRoomId(rid);
    setInRoom(true);
    setActiveGame(DEMO_GAMES[0]!);
    setTab("play");
  };

  const handlePlayerMove = useCallback((x: number, y: number, vx: number, vy: number) => {
    socketRef.current?.emit("playerMove", { x, y, vx, vy });
  }, []);

  useEffect(() => () => { socketRef.current?.disconnect(); }, []);

  // ── Full-screen game runtime (driven by ApexEngine bridge) ──────────────

  if (tab === "play") {
    return (
      <div style={{ position: "fixed", inset: 0, background: BG, display: "flex", flexDirection: "column" }}>
        <ApexGameRuntime
          visible
          onClose={() => {
            stopGame();
            setActiveGame(null);
            setTab("studio");
          }}
          style={{ width: "100%", height: "100%" }}
        />
      </div>
    );
  }

  // ── Main page ──────────────────────────────────────────────────────────────

  return (
    <div style={{
      minHeight: "100dvh", background: BG,
      display: "flex", flexDirection: "column",
      color: "#fff", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>

      {/* ── Header ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "16px 20px", borderBottom: `1px solid ${BORDER}`,
        background: "rgba(7,8,14,0.9)", backdropFilter: "blur(14px)",
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <button
          onClick={() => setLocation("/")}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#888", fontSize: 22, padding: 4, lineHeight: 1 }}
        >‹</button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: GRAD,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
          }}>🎮</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.01em" }}>Apex Game Engine</div>
            <div style={{ fontSize: 11, color: "#555" }}>AI Maps · Multiplayer</div>
          </div>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div style={{ display: "flex", gap: 2, padding: "12px 16px 0", borderBottom: `1px solid ${BORDER}`, overflowX: "auto" }}>
        {(["studio", "play", "multiplayer", "builder", "ai-studio"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "8px 14px", borderRadius: "10px 10px 0 0",
            border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12,
            transition: "all 0.2s", whiteSpace: "nowrap", flexShrink: 0,
            background: tab === t ? "rgba(108,92,231,0.12)" : "transparent",
            color: tab === t ? "#A29BFE" : "#555",
            borderBottom: tab === t
              ? t === "builder"    ? "2px solid #ffcc33"
              : t === "ai-studio"  ? "2px solid #00b894"
              : "2px solid #6C5CE7"
              : "2px solid transparent",
          }}>
            {t === "studio"    ? "🛠 Studio"
              : t === "play"   ? "▶ Play"
              : t === "multiplayer" ? "🌐 Multiplayer"
              : t === "builder" ? "⚡ Builder"
              : "🤖 AI Studio"}
          </button>
        ))}
        <button key="community" onClick={() => setTab("community")} style={{
          padding: "8px 14px", borderRadius: "10px 10px 0 0",
          border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12,
          transition: "all 0.2s", whiteSpace: "nowrap", flexShrink: 0,
          background: tab === "community" ? "rgba(253,121,168,0.12)" : "transparent",
          color: tab === "community" ? "#FD79A8" : "#555",
          borderBottom: tab === "community" ? "2px solid #FD79A8" : "2px solid transparent",
        }}>🌟 Community</button>
      </div>

      {/* ── Share toast notification ── */}
      {shareToast && (
        <div style={{
          position: "fixed", bottom: 24, left: 0, right: 0, margin: "0 auto", width: "fit-content",
          background: "rgba(20,20,32,0.96)", border: "1px solid rgba(108,92,231,0.4)",
          borderRadius: 12, padding: "12px 20px", fontSize: 14, fontWeight: 600,
          color: "#A29BFE", zIndex: 9999, backdropFilter: "blur(16px)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          animation: "apex-fade-in 0.25s ease",
        }}>{shareToast}</div>
      )}

      {/* ── Content ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px 100px" }}>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ STUDIO ━━━━━━━━━━━━━━━━ */}
        {tab === "studio" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

            {/* ── Demo Games (always shown) ── */}
            <section>
              <SectionHeader
                title="🎮 Demo Games"
                subtitle="3 games ready to play — always available"
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {DEMO_GAMES.map((game, i) => (
                  <GameCard
                    key={i}
                    game={game}
                    icon={DEMO_ICONS[game.name] ?? "🎮"}
                    description={DEMO_DESCRIPTIONS[game.name]}
                    onPlay={() => launchGame(game)}
                    onLoadEditor={() => loadIntoEditor(game)}
                  />
                ))}
              </div>
            </section>

            {/* ── My Saved Games (shown only if any exist) ── */}
            {savedGames.length > 0 && (
              <section>
                <SectionHeader
                  title="⭐ My Games"
                  subtitle={`${savedGames.length} saved game${savedGames.length !== 1 ? "s" : ""}`}
                />
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {savedGames.map((game, i) => (
                    <GameCard
                      key={i}
                      game={game}
                      icon="🤖"
                      badge="Saved"
                      onPlay={() => launchGame(game)}
                      onLoadEditor={() => loadIntoEditor(game)}
                      onDelete={() => deleteGame(game.name)}
                      onShare={() => shareGame(game)}
                      sharing={sharing === game.name}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* ── AI Generator ── */}
            <section ref={editorRef}>
              <SectionHeader
                title="🧠 AI Game Generator"
                subtitle="Describe a game — AI builds a playable config instantly"
              />
              <div style={{
                background: CARD, borderRadius: 16, border: `1px solid ${BORDER}`,
                padding: 16, display: "flex", flexDirection: "column", gap: 12,
              }}>
                {/* Quick prompt chips */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {[
                    { label: "🎯 3D FPS",         prompt: "make a 3D first person shooter like call of duty" },
                    { label: "🔫 Top-Down",        prompt: "top-down arena shooter game" },
                    { label: "🏀 Basketball",      prompt: "make a basketball game like NBA 2K" },
                    { label: "🗺 Open World",      prompt: "make an open world GTA style exploration game" },
                    { label: "⚡ Fast Platformer", prompt: "fast neon platformer with heavy gravity" },
                    { label: "🌊 Wave Survival",   prompt: "survive waves of enemies for 45 seconds" },
                  ].map((chip) => (
                    <button
                      key={chip.label}
                      onClick={() => setPrompt(chip.prompt)}
                      style={{
                        padding: "5px 12px", borderRadius: 20,
                        border: "1px solid rgba(162,155,254,0.28)",
                        background: "rgba(108,92,231,0.10)",
                        color: "#A29BFE", fontSize: 11, fontWeight: 600,
                        cursor: "pointer", transition: "all 0.15s",
                      }}
                    >{chip.label}</button>
                  ))}
                </div>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generateGame(); }}
                  placeholder='e.g. "make a call of duty shooter" or "basketball game"'
                  rows={3}
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: `1px solid ${BORDER}`, borderRadius: 12,
                    color: "#fff", padding: "10px 14px", fontSize: 14,
                    resize: "vertical", outline: "none", fontFamily: "inherit", lineHeight: 1.5,
                  }}
                />
                <button
                  onClick={generateGame}
                  disabled={generating || !prompt.trim()}
                  style={{
                    padding: "12px", borderRadius: 12, border: "none",
                    background: generating || !prompt.trim() ? "rgba(255,255,255,0.06)" : GRAD,
                    color: generating || !prompt.trim() ? "#555" : "#fff",
                    fontWeight: 700, fontSize: 15,
                    cursor: generating || !prompt.trim() ? "not-allowed" : "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  {generating ? "⚙️ Generating..." : "✨ Generate Game"}
                </button>

                {genError && <p style={{ margin: 0, fontSize: 12, color: "#ff8c00" }}>{genError}</p>}

                {/* ── Generating skeleton: visible while AI is working ── */}
                {generating && (
                  <div style={{
                    borderRadius: 14,
                    border: "1px solid rgba(108,92,231,0.30)",
                    background: "rgba(108,92,231,0.06)",
                    padding: "20px 16px",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
                    animation: "apex-fade-in 0.3s ease",
                  }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12,
                      background: "linear-gradient(135deg,#6C5CE7,#A29BFE,#FD79A8)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 22,
                      animation: "apex-boot 1.1s ease-in-out infinite",
                    }}>⚙️</div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontWeight: 700, color: "#A29BFE", fontSize: 14, marginBottom: 4 }}>
                        Building your game…
                      </div>
                      <div style={{ fontSize: 12, color: "#555" }}>
                        AI is crafting the world, entities, and config
                      </div>
                    </div>
                    {/* Pulse bar */}
                    <div style={{ width: "100%", height: 3, borderRadius: 2, background: "rgba(108,92,231,0.15)", overflow: "hidden" }}>
                      <div style={{
                        height: "100%",
                        background: "linear-gradient(90deg,#6C5CE7,#A29BFE,#FD79A8)",
                        animation: "apex-scan 1.6s linear infinite",
                      }} />
                    </div>
                    <style>{`
                      @keyframes apex-scan {
                        0%   { width: 0%;   margin-left: 0% }
                        50%  { width: 60%;  margin-left: 20% }
                        100% { width: 0%;   margin-left: 100% }
                      }
                      @keyframes apex-fade-in {
                        from { opacity: 0; transform: translateY(8px) }
                        to   { opacity: 1; transform: translateY(0) }
                      }
                    `}</style>
                  </div>
                )}

                {/* ── Generated config card ── */}
                {editorCfg && (
                  <div style={{
                    background: "rgba(108,92,231,0.08)",
                    borderRadius: 14, border: "1px solid rgba(108,92,231,0.28)",
                    padding: 14, display: "flex", flexDirection: "column", gap: 12,
                  }}>
                    {/* Title + tags */}
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>
                        ✅ {editorCfg.name}
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <Tag style={{ background: "rgba(108,92,231,0.20)", color: "#A29BFE" }}>{gameModeLabel(editorCfg.gameMode)}</Tag>
                        <Tag>{modeLabel(editorCfg.winCondition)}</Tag>
                        {editorCfg.gameMode !== "shooter" && editorCfg.gameMode !== "topdown" && editorCfg.gameMode !== "basketball" && (
                          <Tag>⚖️ gravity {editorCfg.gravity}</Tag>
                        )}
                        {(editorCfg.coins ?? []).length > 0 && <Tag>🪙 {(editorCfg.coins ?? []).length} coins</Tag>}
                        {editorCfg.enemies.length > 0 && <Tag>👹 {editorCfg.enemies.length} enemies</Tag>}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => launchGame(editorCfg)}
                        style={{
                          flex: 1, padding: "11px", borderRadius: 10, border: "none",
                          background: GRAD, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer",
                        }}
                      >▶ Play Now</button>
                      <button
                        onClick={() => { saveGame(editorCfg); launchGame(editorCfg); }}
                        style={{
                          flex: 1, padding: "11px", borderRadius: 10,
                          border: "1px solid rgba(108,92,231,0.4)",
                          background: "rgba(108,92,231,0.12)",
                          color: "#A29BFE", fontWeight: 700, fontSize: 14, cursor: "pointer",
                        }}
                      >💾 Save & Play</button>
                      <button
                        onClick={() => shareGame(editorCfg)}
                        disabled={sharing === editorCfg.name}
                        style={{
                          padding: "11px 14px", borderRadius: 10,
                          border: "1px solid rgba(253,121,168,0.4)",
                          background: sharing === editorCfg.name ? "rgba(253,121,168,0.05)" : "rgba(253,121,168,0.12)",
                          color: "#FD79A8", fontWeight: 700, fontSize: 14, cursor: sharing === editorCfg.name ? "not-allowed" : "pointer",
                          flexShrink: 0,
                        }}
                      >{sharing === editorCfg.name ? "…" : "🚀"}</button>
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => setShowJson(!showJson)}
                        style={{
                          flex: 1, padding: "9px", borderRadius: 10,
                          border: `1px solid ${BORDER}`,
                          background: "rgba(255,255,255,0.04)",
                          color: "#888", fontSize: 12, cursor: "pointer",
                        }}
                      >{showJson ? "▲ Hide JSON" : "{ } View JSON Config"}</button>
                      {!savedGames.some((g) => g.name === editorCfg.name) && (
                        <button
                          onClick={() => saveGame(editorCfg)}
                          style={{
                            padding: "9px 14px", borderRadius: 10,
                            border: `1px solid ${BORDER}`,
                            background: "rgba(255,255,255,0.04)",
                            color: "#888", fontSize: 12, cursor: "pointer",
                          }}
                        >⭐ Save</button>
                      )}
                    </div>

                    {/* JSON viewer */}
                    {showJson && (
                      <pre style={{
                        margin: 0, fontSize: 10, color: "#A29BFE",
                        background: "rgba(0,0,0,0.45)", borderRadius: 10,
                        padding: "12px 14px", overflowX: "auto", maxHeight: 220,
                        lineHeight: 1.6,
                      }}>
                        {JSON.stringify(editorCfg, null, 2)}
                      </pre>
                    )}
                  </div>
                )}

                {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                 *  INLINE PREVIEW — game runs here the moment AI finishes.
                 *  No tab switch required; tap ⛶ to go full-screen.
                 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
                {showInlinePreview && editorCfg && !generating && (
                  <InlinePreviewPanel
                    config={editorCfg}
                    onFullScreen={() => launchGame(editorCfg)}
                    onClose={() => { stopGame(); setShowInlinePreview(false); }}
                    onSave={() => saveGame(editorCfg)}
                    alreadySaved={savedGames.some((g) => g.name === editorCfg.name)}
                    engineStatus={engineStatus}
                  />
                )}

              </div>
            </section>

          </div>
        )}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ MULTIPLAYER ━━━━ */}
        {tab === "multiplayer" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <SectionHeader title="🌐 Multiplayer Lobby" subtitle="Play with friends in real-time" />

            <div style={{
              background: CARD, borderRadius: 16, border: `1px solid ${BORDER}`,
              padding: 16, display: "flex", flexDirection: "column", gap: 14,
            }}>
              <p style={{ margin: 0, fontSize: 13, color: "#777", lineHeight: 1.55 }}>
                Enter a room code to join friends, or leave blank to create a new room.
                Player positions sync in real-time — you'll see ghost avatars of other players.
              </p>

              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && joinRoom()}
                  placeholder="Room code (or leave blank to create)"
                  style={{
                    flex: 1, background: "rgba(255,255,255,0.06)",
                    border: `1px solid ${BORDER}`, borderRadius: 10,
                    color: "#fff", padding: "10px 14px", fontSize: 14,
                    outline: "none", fontFamily: "inherit",
                  }}
                />
                <button onClick={joinRoom} style={{
                  padding: "10px 18px", borderRadius: 10, border: "none",
                  background: GRAD, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer",
                }}>{roomInput ? "Join" : "Create"}</button>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#555" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: inRoom ? "#44ff88" : "#444" }} />
                {inRoom ? `In room "${roomId}" · ${playerCount} player${playerCount !== 1 ? "s" : ""}` : "Not connected"}
              </div>
            </div>

            <div style={{ background: CARD, borderRadius: 16, border: `1px solid ${BORDER}`, padding: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: "#A29BFE" }}>How it works</div>
              {[
                ["🚪", "Create or join a room with any code"],
                ["👻", "See other players as ghost avatars"],
                ["📡", "Positions sync live via WebSocket"],
                ["🎮", "Each player controls their own character"],
              ].map(([icon, text], i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
                  <span style={{ fontSize: 18 }}>{icon}</span>
                  <span style={{ fontSize: 13, color: "#777", lineHeight: 1.4 }}>{text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ BUILDER ━━━━━━ */}
        {tab === "builder" && (
          <BuilderTab api={api} />
        )}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ AI STUDIO ━━━━━━ */}
        {tab === "ai-studio" && (
          <GameStudioPanel onPlay={(cfg) => { launchGame(cfg); saveGame(cfg, "ai", `AI Studio: ${cfg.name}`); }} />
        )}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ COMMUNITY ━━━━━━ */}
        {tab === "community" && (
          <CommunityTab
            api={api}
            sessionId={getSessionId()}
            onPlay={(cfg) => { launchGame(cfg); }}
          />
        )}

      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function modeLabel(m: string) {
  return m === "collect_all"  ? "🪙 Collect All"
    :    m === "reach_end"    ? "🏁 Reach End"
    :    m === "survive"      ? "⏱ Survive"
    :    m === "defeat_all"   ? "☠ Defeat All"
    :    m === "score_limit"  ? "🏀 Score Limit"
    :    m;
}

function gameModeLabel(mode?: string) {
  return mode === "fps"        ? "🎯 3D FPS"
    :   mode === "shooter"    ? "🔫 Shooter"
    :   mode === "basketball" ? "🏀 Basketball"
    :   mode === "topdown"    ? "🗺 Top-Down"
    :   "🎮 Platformer";
}

// ── Sub-components ────────────────────────────────────────────────────────────

/**
 * InlinePreviewPanel
 * Renders the live game in a fixed-height card inside the Studio tab.
 * Driven by the EngineContext; engineStatus drives what is shown.
 */
function InlinePreviewPanel({
  config, onFullScreen, onClose, onSave, alreadySaved, engineStatus,
}: {
  config: GameConfig;
  onFullScreen: () => void;
  onClose: () => void;
  onSave: () => void;
  alreadySaved: boolean;
  engineStatus: string;
}) {
  const isLoading = engineStatus === "loading" || engineStatus === "idle";
  const isPlaying = engineStatus === "playing";
  const isDone    = engineStatus === "won" || engineStatus === "lost";

  return (
    <div style={{
      borderRadius: 16,
      border: "1px solid rgba(108,92,231,0.45)",
      background: "#0a0b12",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      animation: "apex-fade-in 0.35s cubic-bezier(0.22,1,0.36,1)",
      boxShadow: "0 0 32px rgba(108,92,231,0.18)",
    }}>

      {/* ── Header bar ── */}
      <div style={{
        display: "flex", alignItems: "center", padding: "9px 14px",
        background: "rgba(108,92,231,0.10)",
        borderBottom: "1px solid rgba(108,92,231,0.20)",
        gap: 8, minHeight: 40,
      }}>
        {/* Live / loading dot */}
        <div style={{
          width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
          background: isPlaying ? "#10B981" : isLoading ? "#FFB703" : "#FF4444",
          boxShadow: isPlaying
            ? "0 0 6px #10B981"
            : isLoading ? "0 0 6px #FFB703" : "0 0 6px #FF4444",
        }} />
        <span style={{
          fontWeight: 700, fontSize: 12, flex: 1,
          color: "#A29BFE", letterSpacing: "0.02em",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {isLoading ? "LOADING…" : isPlaying ? "LIVE" : isDone ? "GAME OVER" : "PREVIEW"}&nbsp;·&nbsp;{config.name}
        </span>
        <button
          onClick={onClose}
          title="Close preview"
          style={{
            background: "none", border: "none", color: "#555",
            cursor: "pointer", fontSize: 15, padding: "2px 6px", lineHeight: 1,
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#ff5555")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#555")}
        >✕</button>
      </div>

      {/* ── Game canvas area ── */}
      <div style={{
        height: 440, position: "relative", overflow: "hidden",
        background: "#060810",
      }}>
        {/* Loading overlay */}
        {isLoading && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 10,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 16,
            background: "rgba(7,8,14,0.92)",
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: "linear-gradient(135deg,#6C5CE7,#A29BFE,#FD79A8)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 26,
            }}>🎮</div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontWeight: 700, color: "#A29BFE", fontSize: 14 }}>
                Launching game…
              </div>
              <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
                Engine initializing
              </div>
            </div>
            <div style={{ width: 160, height: 3, borderRadius: 2, background: "rgba(108,92,231,0.15)", overflow: "hidden" }}>
              <div style={{
                height: "100%",
                background: "linear-gradient(90deg,#6C5CE7,#A29BFE,#FD79A8)",
                animation: "apex-scan 1.4s linear infinite",
              }} />
            </div>
          </div>
        )}

        {/* Done overlay */}
        {isDone && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 10,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 12,
            background: "rgba(7,8,14,0.85)",
          }}>
            <div style={{ fontSize: 48 }}>{engineStatus === "won" ? "🏆" : "💀"}</div>
            <div style={{ fontWeight: 800, fontSize: 20, color: "#fff" }}>
              {engineStatus === "won" ? "You Won!" : "Game Over"}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={onFullScreen}
                style={{
                  padding: "9px 18px", borderRadius: 10, border: "none",
                  background: "linear-gradient(135deg,#6C5CE7,#A29BFE)",
                  color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
                }}
              >▶ Full Screen</button>
              <button
                onClick={onClose}
                style={{
                  padding: "9px 18px", borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.04)",
                  color: "#888", fontWeight: 600, fontSize: 13, cursor: "pointer",
                }}
              >Close</button>
            </div>
          </div>
        )}

        {/* Live game canvas — parent div (440px) constrains its size */}
        <GameCanvas
          config={config}
          onBack={onClose}
        />
      </div>

      {/* ── Footer actions ── */}
      <div style={{
        display: "flex", gap: 8, padding: "10px 14px",
        background: "rgba(0,0,0,0.35)",
        borderTop: "1px solid rgba(108,92,231,0.18)",
      }}>
        <button
          onClick={onFullScreen}
          style={{
            flex: 1, padding: "9px 14px", borderRadius: 10, border: "none",
            background: "linear-gradient(135deg,#6C5CE7,#A29BFE)",
            color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}
        >⛶ Full Screen</button>

        {!alreadySaved && (
          <button
            onClick={onSave}
            style={{
              padding: "9px 16px", borderRadius: 10,
              border: "1px solid rgba(108,92,231,0.35)",
              background: "rgba(108,92,231,0.08)",
              color: "#A29BFE", fontWeight: 700, fontSize: 13, cursor: "pointer",
            }}
          >💾 Save</button>
        )}
      </div>

    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em" }}>
        {title}
      </div>
      {subtitle && (
        <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>{subtitle}</div>
      )}
    </div>
  );
}

function Tag({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span style={{
      padding: "3px 10px", borderRadius: 20,
      background: "rgba(108,92,231,0.13)",
      border: "1px solid rgba(108,92,231,0.28)",
      fontSize: 11, color: "#A29BFE", fontWeight: 600,
      ...style,
    }}>{children}</span>
  );
}

function GameCard({
  game, icon, description, badge, onPlay, onLoadEditor, onDelete, onShare, sharing,
}: {
  game: GameConfig;
  icon: string;
  description?: string;
  badge?: string;
  onPlay: () => void;
  onLoadEditor: () => void;
  onDelete?: () => void;
  onShare?: () => void;
  sharing?: boolean;
}) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      borderRadius: 16,
      border: `1px solid ${BORDER}`,
      padding: 14,
      display: "flex",
      flexDirection: "column",
      gap: 12,
      transition: "border-color 0.2s",
    }}>
      {/* Top row: icon + info + delete */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{
          width: 50, height: 50, borderRadius: 13, flexShrink: 0,
          background: "rgba(108,92,231,0.14)",
          border: "1px solid rgba(108,92,231,0.22)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 26,
        }}>{icon}</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
            <span style={{ fontWeight: 800, fontSize: 15 }}>{game.name}</span>
            {badge && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 8,
                background: "rgba(253,121,168,0.18)", color: "#FD79A8",
              }}>{badge}</span>
            )}
          </div>
          {description && (
            <p style={{ margin: 0, fontSize: 12, color: "#666", lineHeight: 1.45, marginBottom: 6 }}>
              {description}
            </p>
          )}
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {game.gameMode && game.gameMode !== "platformer" && (
              <Tag style={{ background: "rgba(108,92,231,0.20)", color: "#A29BFE" }}>{gameModeLabel(game.gameMode)}</Tag>
            )}
            <Tag>{modeLabel(game.winCondition)}</Tag>
            {!game.gameMode || game.gameMode === "platformer" ? <Tag>⚖️ {game.gravity}g</Tag> : null}
            {(game.coins?.length ?? 0) > 0 && <Tag>🪙 {game.coins!.length}</Tag>}
            {game.enemies.length > 0 && <Tag>👹 {game.enemies.length}</Tag>}
            {game.surviveSecs && <Tag>⏱ {game.surviveSecs}s</Tag>}
          </div>
        </div>

        {onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            title="Remove"
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "#444", fontSize: 16, padding: 4, lineHeight: 1,
              transition: "color 0.15s",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#ff4444")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#444")}
          >✕</button>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onPlay}
          style={{
            flex: 1, padding: "10px 14px", borderRadius: 10, border: "none",
            background: "linear-gradient(135deg,#6C5CE7,#A29BFE)",
            color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}
        >
          <span style={{ fontSize: 14 }}>▶</span> Play
        </button>
        <button
          onClick={onLoadEditor}
          style={{
            flex: 1, padding: "10px 14px", borderRadius: 10,
            border: "1px solid rgba(108,92,231,0.3)",
            background: "rgba(108,92,231,0.08)",
            color: "#A29BFE", fontWeight: 700, fontSize: 13, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}
        >
          <span style={{ fontSize: 14 }}>📝</span> Load into Editor
        </button>
        {onShare && (
          <button
            onClick={onShare}
            disabled={sharing}
            title="Share to Community"
            style={{
              padding: "10px 13px", borderRadius: 10,
              border: "1px solid rgba(253,121,168,0.35)",
              background: sharing ? "rgba(253,121,168,0.05)" : "rgba(253,121,168,0.10)",
              color: "#FD79A8", fontWeight: 700, fontSize: 14,
              cursor: sharing ? "not-allowed" : "pointer", flexShrink: 0,
            }}
          >{sharing ? "…" : "🚀"}</button>
        )}
      </div>
    </div>
  );
}

// ── CommunityTab ──────────────────────────────────────────────────────────────

type FeedEntry = {
  id: number;
  name: string;
  creatorName: string;
  createdBy: string;
  gameConfig: unknown;
  likeCount: number;
  playCount: number;
  tags: string[];
  isLiked: boolean;
  createdAt: string;
};

function CommunityTab({
  api, sessionId, onPlay,
}: {
  api: (p: string) => string;
  sessionId: string;
  onPlay: (cfg: GameConfig) => void;
}) {
  const [games,   setGames]   = useState<FeedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [liking,  setLiking]  = useState<number | null>(null);
  const [playing, setPlaying] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(api("/api/game-feed"), {
        headers: { "x-session-id": sessionId },
      });
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      setGames(data.games ?? []);
    } catch {
      setError("Couldn't load community games. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleLike = async (entry: FeedEntry) => {
    if (liking === entry.id) return;
    setLiking(entry.id);
    // Optimistic update
    setGames((prev) => prev.map((g) =>
      g.id === entry.id
        ? { ...g, isLiked: !g.isLiked, likeCount: g.likeCount + (g.isLiked ? -1 : 1) }
        : g
    ));
    try {
      await fetch(api(`/api/game-feed/${entry.id}/like`), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-session-id": sessionId },
        body: JSON.stringify({ sessionId }),
      });
    } catch {
      // Roll back on failure
      setGames((prev) => prev.map((g) =>
        g.id === entry.id
          ? { ...g, isLiked: entry.isLiked, likeCount: entry.likeCount }
          : g
      ));
    } finally {
      setLiking(null);
    }
  };

  const playGame = async (entry: FeedEntry) => {
    setPlaying(entry.id);
    // Fire-and-forget play count
    fetch(api(`/api/game-feed/${entry.id}/play`), { method: "POST" }).catch(() => {});
    onPlay(entry.gameConfig as GameConfig);
    setTimeout(() => setPlaying(null), 1000);
  };

  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 16 }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: GRAD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, animation: "apex-boot 1.1s ease-in-out infinite" }}>🌟</div>
      <div style={{ fontSize: 14, color: "#555" }}>Loading community games…</div>
      <style>{`@keyframes apex-boot { 0%,100%{transform:scale(1)} 50%{transform:scale(1.12)} }`}</style>
    </div>
  );

  if (error) return (
    <div style={{ textAlign: "center", paddingTop: 60, color: "#ff6b6b", fontSize: 14 }}>
      {error}
      <br /><button onClick={load} style={{ marginTop: 12, padding: "8px 18px", borderRadius: 8, border: "none", background: CARD, color: "#A29BFE", cursor: "pointer", fontWeight: 700 }}>Retry</button>
    </div>
  );

  if (games.length === 0) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 60, gap: 16 }}>
      <div style={{ fontSize: 52 }}>🎮</div>
      <div style={{ fontWeight: 800, fontSize: 18, color: "#fff" }}>No games shared yet</div>
      <div style={{ fontSize: 13, color: "#555", textAlign: "center", maxWidth: 280, lineHeight: 1.55 }}>
        Be the first! Generate a game in the Studio tab, then hit the&nbsp;
        <span style={{ color: "#FD79A8", fontWeight: 700 }}>🚀 Share</span> button.
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <SectionHeader title="🌟 Community Games" subtitle={`${games.length} game${games.length !== 1 ? "s" : ""} shared by players`} />
        <button onClick={load} style={{ background: "none", border: "none", color: "#555", fontSize: 18, cursor: "pointer", padding: 4 }} title="Refresh">↻</button>
      </div>

      {games.map((entry) => (
        <div key={entry.id} style={{
          background: "rgba(255,255,255,0.03)",
          borderRadius: 16,
          border: `1px solid ${BORDER}`,
          padding: 14,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          transition: "border-color 0.2s",
        }}>
          {/* Top row */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{
              width: 50, height: 50, borderRadius: 13, flexShrink: 0,
              background: entry.createdBy === "ai" ? "rgba(108,92,231,0.18)" : "rgba(253,121,168,0.14)",
              border: `1px solid ${entry.createdBy === "ai" ? "rgba(108,92,231,0.3)" : "rgba(253,121,168,0.28)"}`,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24,
            }}>{entry.createdBy === "ai" ? "🤖" : "🎮"}</div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {entry.name}
              </div>
              <div style={{ fontSize: 11, color: "#555", marginBottom: 6 }}>
                by {entry.creatorName} · {new Date(entry.createdAt).toLocaleDateString()}
              </div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {entry.tags.slice(0, 3).map((tag) => (
                  <Tag key={tag}>{tag}</Tag>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
              <span style={{ fontSize: 12, color: "#555" }}>▶ {entry.playCount}</span>
              <span style={{ fontSize: 12, color: entry.isLiked ? "#FD79A8" : "#555" }}>♥ {entry.likeCount}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => playGame(entry)}
              disabled={playing === entry.id}
              style={{
                flex: 1, padding: "10px 14px", borderRadius: 10, border: "none",
                background: playing === entry.id ? "rgba(108,92,231,0.3)" : "linear-gradient(135deg,#6C5CE7,#A29BFE)",
                color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >{playing === entry.id ? "⚙️ Loading…" : "▶ Play"}</button>

            <button
              onClick={() => toggleLike(entry)}
              disabled={liking === entry.id}
              style={{
                padding: "10px 16px", borderRadius: 10,
                border: `1px solid ${entry.isLiked ? "rgba(253,121,168,0.5)" : "rgba(255,255,255,0.1)"}`,
                background: entry.isLiked ? "rgba(253,121,168,0.15)" : "rgba(255,255,255,0.04)",
                color: entry.isLiked ? "#FD79A8" : "#666",
                fontWeight: 700, fontSize: 13, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 5,
                transition: "all 0.2s",
              }}
            >
              {entry.isLiked ? "♥" : "♡"} {entry.likeCount}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
