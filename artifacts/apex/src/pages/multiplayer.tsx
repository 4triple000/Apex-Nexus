import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { io, type Socket } from "socket.io-client";
import { Gamepad2, ArrowLeft, Swords, Trophy, Signal } from "lucide-react";
import { GameModeSelector, type GameMode } from "@/components/multiplayer/GameModeSelector";
import { PartyPanel, type PartyMember } from "@/components/multiplayer/PartyPanel";
import { MatchmakingPanel } from "@/components/multiplayer/MatchmakingPanel";
import { QueueStatus, type QueueState } from "@/components/multiplayer/QueueStatus";

// ── Easing ──────────────────────────────────────────────────────────────────
const IOS    = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";
const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

// ── API ──────────────────────────────────────────────────────────────────────
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
function api(path: string) { return `${BASE}/api${path}`; }

// ── Fake player identity (persisted) ────────────────────────────────────────
function getPlayerIdentity(): { playerId: string; playerName: string; rank: string } {
  const stored = localStorage.getItem("apex_mp_identity");
  if (stored) return JSON.parse(stored) as { playerId: string; playerName: string; rank: string };
  const NAMES = ["Phantom", "Vortex", "Shadow", "Apex", "Cipher", "Blaze", "Nova", "Ghost"];
  const RANKS = ["Silver", "Gold", "Platinum", "Diamond"];
  const id = `player_${Math.random().toString(36).slice(2, 10)}`;
  const name = NAMES[Math.floor(Math.random() * NAMES.length)]! + Math.floor(Math.random() * 999);
  const rank = RANKS[Math.floor(Math.random() * RANKS.length)]!;
  const identity = { playerId: id, playerName: name, rank };
  localStorage.setItem("apex_mp_identity", JSON.stringify(identity));
  return identity;
}

// ── Match found overlay ──────────────────────────────────────────────────────
function MatchFoundOverlay({
  players,
  countdown,
  onComplete,
}: {
  players: string[];
  countdown: number;
  onComplete: () => void;
}) {
  useEffect(() => {
    if (countdown <= 0) onComplete();
  }, [countdown, onComplete]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.92)",
      backdropFilter: "blur(20px)",
      animation: `fadeIn 0.35s ${IOS} both`,
    }}>
      {/* Neon ring */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse at 50% 40%, rgba(108,92,231,0.18) 0%, transparent 65%)",
      }} />

      {/* Header */}
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: "0.18em",
        color: "#10B981", textTransform: "uppercase",
        marginBottom: 12, opacity: 0.8,
        animation: `slideUp 0.4s ${SPRING} 0.1s both`,
      }}>
        ✦ Match Ready
      </div>

      <div style={{
        fontSize: 42, fontWeight: 900, color: "#fff",
        letterSpacing: "-0.02em", lineHeight: 1,
        textShadow: "0 0 40px rgba(162,155,254,0.60), 0 0 80px rgba(108,92,231,0.30)",
        animation: `slideUp 0.4s ${SPRING} 0.15s both`,
      }}>
        MATCH FOUND
      </div>

      <div style={{
        marginTop: 24, marginBottom: 28,
        width: 240, height: 2,
        background: "linear-gradient(90deg, transparent, #6C5CE7, #A29BFE, #6C5CE7, transparent)",
        boxShadow: "0 0 12px rgba(162,155,254,0.50)",
        animation: `slideUp 0.4s ${IOS} 0.2s both`,
      }} />

      {/* Player list */}
      <div style={{
        display: "flex", flexDirection: "column", gap: 8,
        width: "100%", maxWidth: 280,
        animation: `slideUp 0.4s ${IOS} 0.25s both`,
      }}>
        {players.slice(0, 6).map((name, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "10px 16px", borderRadius: 12,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            animation: `slideUp 0.35s ${SPRING} ${0.28 + i * 0.05}s both`,
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: "linear-gradient(135deg, #10B981, #06B6D4)",
              flexShrink: 0,
              boxShadow: "0 0 8px rgba(16,185,129,0.60)",
            }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>
              {name}
            </span>
          </div>
        ))}
      </div>

      {/* Countdown */}
      <div style={{
        marginTop: 28, textAlign: "center",
        animation: `slideUp 0.4s ${IOS} 0.4s both`,
      }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 500,
          letterSpacing: "0.08em", marginBottom: 8 }}>
          STARTING IN
        </div>
        <div style={{
          fontSize: 72, fontWeight: 900, color: "#EF4444",
          fontVariantNumeric: "tabular-nums",
          textShadow: "0 0 30px rgba(239,68,68,0.70)",
          lineHeight: 1,
          animation: `countPop 0.5s ${SPRING} both`,
        }}>
          {countdown}
        </div>
      </div>
    </div>
  );
}

// ── Kill feed entry ───────────────────────────────────────────────────────────
interface KillEntry {
  id: number;
  killer: string;
  victim: string;
  ts: number;
  isMe: boolean;
  iGotKilled: boolean;
}

// ── Networked Game Session ─────────────────────────────────────────────────────
function GameSession({
  roomId, onLeave, socket, myPlayerId, myName,
}: {
  roomId: string;
  onLeave: () => void;
  socket: Socket | null;
  myPlayerId: string;
  myName: string;
}) {
  const [pingMs, setPingMs]     = useState(0);
  const [kills, setKills]       = useState(0);
  const [deaths, setDeaths]     = useState(0);
  const [timeLeft, setTimeLeft] = useState(600);
  const [alive, setAlive]       = useState(true);
  const [respawnMs, setRespawnMs] = useState(0);
  const [connected, setConnected] = useState(!!socket?.connected);
  const [playerCount, setPlayerCount] = useState(1);
  const [scoreboard, setScoreboard] = useState<Record<string, { kills: number; deaths: number; name?: string }>>({});
  const [killFeed, setKillFeed] = useState<KillEntry[]>([]);
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [hitFlash, setHitFlash] = useState(false);
  const killIdRef = useRef(0);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pingTsRef = useRef(0);
  const isSimRoom = roomId.startsWith("sim_");

  // ── Socket wiring ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    setConnected(socket.connected);

    // Join the room
    socket.emit("join_room", { roomId, playerId: myPlayerId, name: myName });

    const onConnect    = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    // Full state update from server (20 Hz)
    const onStateUpdate = (data: {
      players: Record<string, { playerId: string; name: string; kills: number; deaths: number; alive: boolean; hp: number }>;
      scoreboard: Record<string, { kills: number; deaths: number }>;
    }) => {
      const count = Object.keys(data.players).length;
      setPlayerCount(count);

      const me = data.players[myPlayerId];
      if (me) {
        setAlive(me.alive);
      }

      // Merge names into scoreboard for display
      const board: Record<string, { kills: number; deaths: number; name: string }> = {};
      for (const [pid, score] of Object.entries(data.scoreboard)) {
        const p = data.players[pid];
        board[pid] = { ...score, name: p?.name ?? pid.slice(0, 8) };
        if (pid === myPlayerId) {
          setKills(score.kills);
          setDeaths(score.deaths);
        }
      }
      setScoreboard(board);
    };

    // Player killed event
    const onPlayerKilled = (data: { killerId: string; victimId: string; scoreboard: Record<string, { kills: number; deaths: number }> }) => {
      const id = ++killIdRef.current;
      const killerName = data.killerId === myPlayerId ? "You" : `Player_${data.killerId.slice(-4)}`;
      const victimName = data.victimId === myPlayerId ? "You"  : `Player_${data.victimId.slice(-4)}`;
      const isMe       = data.killerId === myPlayerId;
      const iGotKilled = data.victimId === myPlayerId;

      setKillFeed(prev => [
        { id, killer: killerName, victim: victimName, ts: Date.now(), isMe, iGotKilled },
        ...prev.slice(0, 7),
      ]);

      if (iGotKilled) {
        setAlive(false);
        setHitFlash(true);
        setTimeout(() => setHitFlash(false), 200);
      }
    };

    // Hit on me
    const onHitConfirmed = (data: { valid: boolean }) => {
      if (data.valid) {
        setHitFlash(true);
        setTimeout(() => setHitFlash(false), 100);
      }
    };

    // Respawn
    const onRespawnOk = () => {
      setAlive(true);
      setRespawnMs(0);
    };
    const onRespawnDenied = (data: { remainingMs: number }) => {
      setRespawnMs(data.remainingMs);
    };

    // Ping/pong RTT
    const onPong = (data: { clientTs: number }) => {
      const rtt = Date.now() - data.clientTs;
      setPingMs(rtt);
    };

    // Player join/leave counts
    const onPlayerJoined = (data: { playerCount: number }) => setPlayerCount(data.playerCount);
    const onPlayerLeft   = (data: { playerCount: number }) => setPlayerCount(data.playerCount);

    socket.on("connect",        onConnect);
    socket.on("disconnect",     onDisconnect);
    socket.on("state_update",   onStateUpdate);
    socket.on("player_killed",  onPlayerKilled);
    socket.on("hit_confirmed",  onHitConfirmed);
    socket.on("respawn_ok",     onRespawnOk);
    socket.on("respawn_denied", onRespawnDenied);
    socket.on("ame_pong",       onPong);
    socket.on("player_joined",  onPlayerJoined);
    socket.on("player_left",    onPlayerLeft);

    // Ping every 2s
    pingIntervalRef.current = setInterval(() => {
      pingTsRef.current = Date.now();
      socket.emit("ame_ping", { ts: pingTsRef.current });
    }, 2000);

    return () => {
      socket.off("connect",        onConnect);
      socket.off("disconnect",     onDisconnect);
      socket.off("state_update",   onStateUpdate);
      socket.off("player_killed",  onPlayerKilled);
      socket.off("hit_confirmed",  onHitConfirmed);
      socket.off("respawn_ok",     onRespawnOk);
      socket.off("respawn_denied", onRespawnDenied);
      socket.off("ame_pong",       onPong);
      socket.off("player_joined",  onPlayerJoined);
      socket.off("player_left",    onPlayerLeft);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    };
  }, [socket, roomId, myPlayerId, myName]);

  // ── Match timer ───────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setTimeLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Simulated events for demo rooms (no real server room) ─────────────────
  useEffect(() => {
    if (!isSimRoom) return;
    const NAMES = ["Vortex", "Shadow", "Ghost", "Cipher", "Nova", "Blaze"];
    const t = setInterval(() => {
      if (Math.random() < 0.10) {
        const id = ++killIdRef.current;
        const isKill = Math.random() < 0.55;
        const other  = NAMES[Math.floor(Math.random() * NAMES.length)]!;
        if (isKill) {
          setKills(k => k + 1);
          setKillFeed(prev => [
            { id, killer: "You", victim: other, ts: Date.now(), isMe: true, iGotKilled: false },
            ...prev.slice(0, 7),
          ]);
        } else {
          setDeaths(d => d + 1);
          setKillFeed(prev => [
            { id, killer: other, victim: "You", ts: Date.now(), isMe: false, iGotKilled: true },
            ...prev.slice(0, 7),
          ]);
          setHitFlash(true);
          setTimeout(() => setHitFlash(false), 200);
        }
      }
    }, 1500);

    // Simulated ping
    const pingT = setInterval(() => {
      setPingMs(12 + Math.floor(Math.random() * 24));
    }, 2500);

    // Simulated player count
    setPlayerCount(4 + Math.floor(Math.random() * 4));
    setConnected(true);

    return () => { clearInterval(t); clearInterval(pingT); };
  }, [isSimRoom]);

  // ── Respawn request ───────────────────────────────────────────────────────
  const handleRespawn = useCallback(() => {
    if (isSimRoom) { setAlive(true); return; }
    socket?.emit("player_respawn", { roomId, playerId: myPlayerId });
  }, [socket, roomId, myPlayerId, isSimRoom]);

  // ── Derived values ────────────────────────────────────────────────────────
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const kd = deaths === 0 ? kills.toFixed(1) : (kills / deaths).toFixed(2);
  const pingColor = pingMs < 60 ? "#10B981" : pingMs < 120 ? "#F59E0B" : "#EF4444";

  // Sorted scoreboard for display
  const sbEntries = Object.entries(scoreboard)
    .sort((a, b) => b[1].kills - a[1].kills)
    .slice(0, 8);

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      background: "#07080E", position: "relative",
      animation: `fadeIn 0.4s ${IOS} both`,
    }}>

      {/* ── Hit flash overlay ────────────────────────────────────── */}
      {hitFlash && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 100,
          background: "rgba(239,68,68,0.18)",
          pointerEvents: "none",
          animation: `fadeIn 0.05s ${IOS} both`,
        }} />
      )}

      {/* ── HUD Top ───────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 16px 10px",
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        zIndex: 10,
      }}>
        {/* Leave */}
        <button onClick={onLeave} style={{
          all: "unset", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 6,
          fontSize: 11, color: "rgba(255,255,255,0.45)", fontWeight: 600,
        }}>
          <ArrowLeft size={13} /> Leave
        </button>

        {/* Timer */}
        <div style={{
          fontSize: 20, fontWeight: 900, letterSpacing: "0.03em",
          fontVariantNumeric: "tabular-nums",
          color: timeLeft < 60 ? "#EF4444" : "#fff",
        }}>
          {minutes}:{seconds.toString().padStart(2, "0")}
        </div>

        {/* Ping + players */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4,
            fontSize: 11, fontWeight: 700,
            color: connected ? pingColor : "rgba(255,255,255,0.30)" }}>
            <Signal size={11} />
            {connected ? `${pingMs}ms` : "—"}
          </div>
          <div style={{
            fontSize: 10, fontWeight: 600,
            color: "rgba(255,255,255,0.30)",
          }}>
            {playerCount}P
          </div>
        </div>
      </div>

      {/* ── Viewport ──────────────────────────────────────────────── */}
      <div style={{
        flex: 1, position: "relative", overflow: "hidden",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>

        {/* Battlefield grid bg */}
        <div style={{ position: "absolute", inset: 0,
          background: "radial-gradient(ellipse at 50% 40%, rgba(239,68,68,0.05) 0%, transparent 60%)" }} />
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px)
          `,
          backgroundSize: "52px 52px",
        }} />

        {/* Crosshair */}
        {alive && (
          <div style={{ position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)", pointerEvents: "none", zIndex: 5 }}>
            <div style={{
              width: 2, height: 14,
              background: "rgba(255,255,255,0.75)",
              position: "absolute", top: -7, left: -1,
            }} />
            <div style={{
              width: 14, height: 2,
              background: "rgba(255,255,255,0.75)",
              position: "absolute", top: -1, left: -7,
            }} />
          </div>
        )}

        {/* ── Kill feed (top-right) ─────────────────────────────── */}
        <div style={{
          position: "absolute", top: 12, right: 12,
          display: "flex", flexDirection: "column", gap: 4,
          zIndex: 10, maxWidth: 220,
        }}>
          {killFeed.slice(0, 5).map((k) => (
            <div key={k.id} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "5px 8px", borderRadius: 8,
              background: k.iGotKilled
                ? "rgba(239,68,68,0.15)"
                : k.isMe
                  ? "rgba(16,185,129,0.15)"
                  : "rgba(0,0,0,0.50)",
              border: k.isMe ? "1px solid rgba(16,185,129,0.25)"
                : k.iGotKilled ? "1px solid rgba(239,68,68,0.25)"
                : "1px solid rgba(255,255,255,0.05)",
              animation: `slideIn 0.25s ${SPRING} both`,
              backdropFilter: "blur(8px)",
            }}>
              <span style={{
                fontSize: 11, fontWeight: 700,
                color: k.isMe ? "#10B981" : "rgba(255,255,255,0.75)",
                maxWidth: 72, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{k.killer}</span>
              <Swords size={9} color="rgba(255,255,255,0.35)" />
              <span style={{
                fontSize: 11, fontWeight: 600,
                color: k.iGotKilled ? "#EF4444" : "rgba(255,255,255,0.45)",
                maxWidth: 72, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{k.victim}</span>
            </div>
          ))}
        </div>

        {/* ── Dead screen ──────────────────────────────────────── */}
        {!alive && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 20,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(8px)",
            animation: `fadeIn 0.3s ${IOS} both`,
          }}>
            <div style={{
              fontSize: 36, fontWeight: 900, color: "#EF4444",
              textShadow: "0 0 30px rgba(239,68,68,0.70)", marginBottom: 8,
              letterSpacing: "0.04em",
            }}>ELIMINATED</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.40)", marginBottom: 24 }}>
              {respawnMs > 0 ? `Respawn in ${Math.ceil(respawnMs / 1000)}s` : "Waiting for respawn…"}
            </div>
            <button onClick={handleRespawn} style={{
              all: "unset", cursor: "pointer",
              padding: "12px 28px", borderRadius: 14,
              background: "linear-gradient(135deg, #6C5CE7, #4F46E5)",
              fontSize: 13, fontWeight: 800, color: "#fff",
              boxShadow: "0 0 24px rgba(108,92,231,0.50)",
            }}>
              RESPAWN
            </button>
          </div>
        )}

        {/* ── Scoreboard overlay (TAB) ──────────────────────────── */}
        {showScoreboard && sbEntries.length > 0 && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 30,
            background: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(16px)",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            animation: `fadeIn 0.2s ${IOS} both`,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.14em",
              color: "rgba(255,255,255,0.40)", marginBottom: 14, textTransform: "uppercase" }}>
              Scoreboard
            </div>
            {sbEntries.map(([pid, s], i) => (
              <div key={pid} style={{
                display: "flex", alignItems: "center",
                width: "100%", maxWidth: 300,
                padding: "8px 16px",
                borderRadius: 10,
                background: pid === myPlayerId ? "rgba(108,92,231,0.12)" : "transparent",
                border: pid === myPlayerId ? "1px solid rgba(108,92,231,0.25)" : "1px solid transparent",
                marginBottom: 4,
              }}>
                <span style={{
                  width: 20, fontSize: 11, color: "rgba(255,255,255,0.30)", fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                }}>#{i + 1}</span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600,
                  color: pid === myPlayerId ? "#A29BFE" : "rgba(255,255,255,0.75)" }}>
                  {s.name ?? pid.slice(0, 8)}
                </span>
                <span style={{ fontSize: 13, fontWeight: 800, color: "#10B981",
                  fontVariantNumeric: "tabular-nums", marginRight: 12 }}>{s.kills}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.30)",
                  fontVariantNumeric: "tabular-nums" }}>{s.deaths}</span>
              </div>
            ))}
            <div style={{ marginTop: 16, fontSize: 10, color: "rgba(255,255,255,0.20)" }}>
              Room: {roomId.slice(0, 8)}… · {playerCount} players
            </div>
          </div>
        )}

        {/* ── Central info (no scoreboard open) ────────────────── */}
        {!alive ? null : (
          <div style={{
            textAlign: "center", position: "relative", zIndex: 2,
            opacity: killFeed.length > 0 ? 0.4 : 0.7,
          }}>
            <div style={{
              fontSize: 11, color: "rgba(255,255,255,0.30)", fontFamily: "monospace",
              letterSpacing: "0.06em",
            }}>
              {connected
                ? `LIVE · ${playerCount} PLAYERS ONLINE`
                : "CONNECTING…"}
            </div>
          </div>
        )}
      </div>

      {/* ── HUD Bottom stats ──────────────────────────────────────── */}
      <div style={{
        display: "flex", gap: 0,
        background: "rgba(0,0,0,0.80)",
        backdropFilter: "blur(12px)",
        borderTop: "1px solid rgba(255,255,255,0.05)",
        zIndex: 10,
      }}>
        {[
          { label: "KILLS",  value: kills,           color: "#10B981", icon: <Swords size={11} /> },
          { label: "DEATHS", value: deaths,           color: "#EF4444" },
          { label: "K/D",    value: kd,               color: "#A29BFE", icon: <Trophy size={11} /> },
          { label: "PING",   value: connected ? `${pingMs}ms` : "—",
            color: pingColor, icon: <Signal size={11} /> },
        ].map((stat, i) => (
          <div key={i} style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            padding: "11px 4px",
            borderRight: i < 3 ? "1px solid rgba(255,255,255,0.04)" : "none",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 3,
              color: stat.color, marginBottom: 2 }}>
              {stat.icon}
              <span style={{ fontSize: 17, fontWeight: 900,
                fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                {stat.value}
              </span>
            </div>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.28)",
              fontWeight: 600, letterSpacing: "0.06em" }}>
              {stat.label}
            </span>
          </div>
        ))}
      </div>

      {/* ── Scoreboard toggle button ──────────────────────────────── */}
      <div style={{
        position: "absolute", bottom: 72, right: 16, zIndex: 40,
      }}>
        <button
          onPointerDown={() => setShowScoreboard(true)}
          onPointerUp={()   => setShowScoreboard(false)}
          onPointerLeave={() => setShowScoreboard(false)}
          style={{
            all: "unset", cursor: "pointer",
            padding: "8px 12px", borderRadius: 10,
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.10)",
            fontSize: 10, fontWeight: 700,
            color: "rgba(255,255,255,0.50)",
            letterSpacing: "0.06em",
            userSelect: "none",
          }}
        >
          SCORE
        </button>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function MultiplayerPage() {
  const [, navigate] = useLocation();
  const identity = useRef(getPlayerIdentity());
  const socketRef = useRef<Socket | null>(null);

  // ── State ─────────────────────────────────────────────────────────────────
  const [gameMode, setGameMode] = useState<GameMode>("tdm");
  const [selectedRegion, setSelectedRegion] = useState("us-east");
  const [isReady, setIsReady] = useState(false);
  const [queueState, setQueueState] = useState<QueueState>({ phase: "idle" });
  const [queueSize, setQueueSize] = useState(847);
  const [isSearching, setIsSearching] = useState(false);

  // Match found overlay
  const [matchFound, setMatchFound] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [matchPlayers, setMatchPlayers] = useState<string[]>([]);
  const [foundRoomId, setFoundRoomId] = useState("");

  // In-game session
  const [inGame, setInGame] = useState(false);
  const [activeRoomId, setActiveRoomId] = useState("");

  // Party (mock) — starts with just the current player as host
  const [party, setParty] = useState<PartyMember[]>([
    {
      playerId: identity.current.playerId,
      name: identity.current.playerName,
      ready: false,
      isHost: true,
      rank: identity.current.rank,
      ping: 14,
    },
  ]);

  // ── Simulated queue counter ───────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => {
      setQueueSize(s => s + Math.floor((Math.random() - 0.3) * 8));
    }, 2000);
    return () => clearInterval(t);
  }, []);

  // ── Socket setup ──────────────────────────────────────────────────────────
  const connectSocket = useCallback(() => {
    if (socketRef.current?.connected) return;

    const socket = io("/ame", {
      path: `${BASE}/api/socket.io`,
      query: {
        playerId: identity.current.playerId,
        playerName: identity.current.playerName,
      },
      transports: ["websocket", "polling"],
      autoConnect: true,
    });

    socket.on("connect", () => {
      console.log("[AME] Socket connected:", socket.id);
    });

    // Match was assigned by matchmaker
    socket.on("match_assigned", (data: { roomId: string; mode: string; map: string }) => {
      const players = party.map(p => p.name);
      // Pad with fake names to show a fuller lobby feel
      while (players.length < 6) {
        const names = ["Vortex", "Shadow", "Ghost", "Cipher", "Nova", "Blaze"];
        players.push(names[players.length % names.length]! + Math.floor(Math.random() * 999));
      }
      setMatchPlayers(players);
      setFoundRoomId(data.roomId);
      setQueueState({ phase: "found", roomId: data.roomId, playerCount: players.length });
      setMatchFound(true);
      setCountdown(5);
    });

    // Real-time queue update from server
    socket.on("queue_update", (data: { playersFound: number; playersNeeded: number }) => {
      setQueueState(prev =>
        prev.phase === "searching"
          ? { ...prev, playersFound: data.playersFound, playersNeeded: data.playersNeeded }
          : prev
      );
    });

    socket.on("disconnect", () => {
      console.log("[AME] Socket disconnected");
    });

    socketRef.current = socket;
  }, [party]);

  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  // ── Countdown timer after match found ─────────────────────────────────────
  useEffect(() => {
    if (!matchFound) return;
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [matchFound, countdown]);

  const handleMatchStart = useCallback(() => {
    setMatchFound(false);
    setIsSearching(false);
    setQueueState({ phase: "idle" });
    setActiveRoomId(foundRoomId);
    setInGame(true);
  }, [foundRoomId]);

  // ── Simulated local matchmaking when real match isn't found in 8s ─────────
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const simulateMatchFound = useCallback(() => {
    const players = party.map(p => p.name);
    const names = ["Vortex", "Shadow", "Ghost", "Cipher", "Nova", "Blaze"];
    while (players.length < 4) {
      players.push(names[players.length % names.length]! + Math.floor(Math.random() * 999));
    }
    const roomId = `sim_${Math.random().toString(36).slice(2, 10)}`;
    setMatchPlayers(players);
    setFoundRoomId(roomId);
    setQueueState({ phase: "found", roomId, playerCount: players.length });
    setMatchFound(true);
    setCountdown(5);
  }, [party]);

  // ── Find Match ────────────────────────────────────────────────────────────
  const handleFindMatch = useCallback(async () => {
    if (isSearching) {
      // Cancel search
      try {
        await fetch(api("/ame/leave-matchmaking"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId: identity.current.playerId }),
        });
      } catch (_) {}
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      setIsSearching(false);
      setQueueState({ phase: "idle" });
      socketRef.current?.disconnect();
      socketRef.current = null;
      return;
    }

    // Connect socket first
    connectSocket();

    try {
      const res = await fetch(api("/ame/start-matchmaking"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: identity.current.playerId,
          playerName: identity.current.playerName,
          mode: gameMode === "conquest" ? "tdm" : gameMode === "custom" ? "ffa" : gameMode,
          region: selectedRegion,
        }),
      });
      if (!res.ok) throw new Error("Matchmaking failed");

      const data = await res.json() as { ok: boolean; position: number };
      if (!data.ok) throw new Error("Matchmaking rejected");

      setIsSearching(true);

      const needed = gameMode === "conquest" ? 8 : gameMode === "tdm" ? 6 : 4;
      setQueueState({
        phase: "searching",
        waitMs: 0,
        playersFound: 1,
        playersNeeded: needed,
      });

      // Simulate match found after 6–10s (real backend needs more players)
      searchTimeoutRef.current = setTimeout(
        simulateMatchFound,
        6000 + Math.random() * 4000
      );

    } catch (err) {
      console.error("[AME] Matchmaking error:", err);
      setQueueState({ phase: "error", message: "Could not connect to matchmaking. Retry." });
      setIsSearching(false);
    }
  }, [isSearching, gameMode, selectedRegion, connectSocket, simulateMatchFound]);

  // ── Toggle ready ──────────────────────────────────────────────────────────
  const handleToggleReady = useCallback(() => {
    const next = !isReady;
    setIsReady(next);
    setParty(prev => prev.map(p =>
      p.playerId === identity.current.playerId ? { ...p, ready: next } : p
    ));
  }, [isReady]);

  const handleKick = useCallback((playerId: string) => {
    setParty(prev => prev.filter(p => p.playerId !== playerId));
  }, []);

  const handleInvite = useCallback(() => {
    // Mock invite — add a bot friend
    if (party.length >= 4) return;
    const NAMES = ["Vortex", "Shadow", "Cipher", "Blaze", "Nova"];
    const RANKS = ["Gold", "Platinum", "Diamond"];
    const name = NAMES[party.length % NAMES.length]! + Math.floor(Math.random() * 99);
    setParty(prev => [
      ...prev,
      {
        playerId: `bot_${Math.random().toString(36).slice(2, 8)}`,
        name,
        ready: Math.random() > 0.5,
        isHost: false,
        rank: RANKS[Math.floor(Math.random() * RANKS.length)],
        ping: 20 + Math.floor(Math.random() * 60),
      },
    ]);
  }, [party.length]);

  // ── In-game ───────────────────────────────────────────────────────────────
  if (inGame) {
    return (
      <GameSession
        roomId={activeRoomId}
        socket={socketRef.current}
        myPlayerId={identity.current.playerId}
        myName={identity.current.playerName}
        onLeave={() => {
          setInGame(false);
          setActiveRoomId("");
          setIsSearching(false);
          setQueueState({ phase: "idle" });
          setParty(prev => prev.map(p => ({ ...p, ready: false })));
          setIsReady(false);
        }}
      />
    );
  }

  // ── Main UI ───────────────────────────────────────────────────────────────
  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      background: "#07080E", overflowY: "auto",
      position: "relative",
    }}>
      {/* Global styles */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: none } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(-12px) } to { opacity: 1; transform: none } }
        @keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.55 } }
        @keyframes dotBounce {
          0%,100% { transform: translateY(0); opacity: 0.4 }
          40% { transform: translateY(-5px); opacity: 1 }
        }
        @keyframes countPop {
          0% { transform: scale(1.4); opacity: 0 }
          100% { transform: scale(1); opacity: 1 }
        }
        @keyframes scanLine {
          from { transform: translateY(-100%) }
          to   { transform: translateY(100vh) }
        }
      `}</style>

      {/* Ambient bg */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(ellipse at 50% 0%, rgba(108,92,231,0.10) 0%, transparent 60%)",
      }} />

      {/* ── Header ────────────────────────────────────────────── */}
      <div style={{
        position: "sticky", top: 0, zIndex: 20,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "18px 20px 14px",
        background: "rgba(7,8,14,0.90)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(135deg, #6C5CE7 0%, #4F46E5 50%, #7C3AED 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 16px rgba(108,92,231,0.50)",
          }}>
            <Gamepad2 size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", lineHeight: 1 }}>
              Multiplayer
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 500, marginTop: 2 }}>
              {isSearching ? "Searching…" : "Ready to fight"}
            </div>
          </div>
        </div>

        {/* Rank badge */}
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 12px", borderRadius: 10,
          background: "rgba(255,215,0,0.08)",
          border: "1px solid rgba(255,215,0,0.20)",
        }}>
          <Trophy size={12} color="#FFD700" />
          <span style={{ fontSize: 12, fontWeight: 700, color: "#FFD700" }}>
            {identity.current.rank}
          </span>
        </div>
      </div>

      {/* ── Scrollable body ────────────────────────────────────── */}
      <div style={{
        flex: 1, overflowY: "auto",
        padding: "16px 16px 120px",
        display: "flex", flexDirection: "column", gap: 20,
        position: "relative", zIndex: 10,
      }}>
        {/* Game mode */}
        <GameModeSelector
          selected={gameMode}
          onSelect={setGameMode}
          disabled={isSearching}
        />

        {/* Party */}
        <PartyPanel
          members={party}
          currentPlayerId={identity.current.playerId}
          onKick={handleKick}
          onToggleReady={handleToggleReady}
          onInvite={handleInvite}
          isReady={isReady}
          disabled={isSearching}
        />

        {/* Matchmaking panel */}
        <MatchmakingPanel
          selectedRegion={selectedRegion}
          onRegionChange={setSelectedRegion}
          queueSize={queueSize}
          disabled={isSearching}
        />

        {/* Queue status */}
        <QueueStatus state={queueState} />
      </div>

      {/* ── Find Match CTA ────────────────────────────────────── */}
      <div style={{
        position: "fixed", bottom: 96, left: 0, right: 0, zIndex: 30,
        display: "flex", justifyContent: "center",
        padding: "0 16px",
        pointerEvents: "none",
      }}>
        <button
          onClick={handleFindMatch}
          style={{
            all: "unset",
            pointerEvents: "auto",
            cursor: "pointer",
            width: "100%", maxWidth: 420,
            padding: "17px 0",
            borderRadius: 18,
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: 10,
            fontWeight: 800, fontSize: 15,
            letterSpacing: "0.06em",
            color: "#fff",
            background: isSearching
              ? "linear-gradient(135deg, rgba(239,68,68,0.80), rgba(220,38,38,0.70))"
              : "linear-gradient(135deg, #6C5CE7 0%, #4F46E5 40%, #7C3AED 100%)",
            boxShadow: isSearching
              ? "0 0 24px rgba(239,68,68,0.40), 0 8px 24px rgba(0,0,0,0.50)"
              : "0 0 32px rgba(108,92,231,0.55), 0 0 64px rgba(108,92,231,0.20), 0 8px 24px rgba(0,0,0,0.50)",
            border: isSearching
              ? "1px solid rgba(239,68,68,0.40)"
              : "1px solid rgba(162,155,254,0.30)",
            transform: "scale(1)",
            transition: `all 0.28s ${SPRING}`,
          }}
          onPointerDown={e => { (e.currentTarget as HTMLElement).style.transform = "scale(0.97)"; }}
          onPointerUp={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
          onPointerLeave={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
        >
          {isSearching ? (
            <>
              <div style={{
                width: 8, height: 8, borderRadius: "50%", background: "#fff",
                animation: "pulse 1s ease-in-out infinite",
              }} />
              CANCEL SEARCH
            </>
          ) : (
            <>
              <Gamepad2 size={18} strokeWidth={2.5} />
              FIND MATCH
            </>
          )}
        </button>
      </div>

      {/* ── Match Found Overlay ───────────────────────────────── */}
      {matchFound && (
        <MatchFoundOverlay
          players={matchPlayers}
          countdown={countdown}
          onComplete={handleMatchStart}
        />
      )}
    </div>
  );
}
