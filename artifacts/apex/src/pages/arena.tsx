import { FeatureGate } from "@/components/ui/FeatureGate";
import { FeaturePreview } from "@/components/ui/FeaturePreview";
import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Swords, Zap, Trophy, RotateCcw, Flame, Share2 } from "lucide-react";
import { ShareModal } from "@/components/share/ShareModal";

// ── Easing ──────────────────────────────────────────────────────────────────
const IOS    = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";
const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

// ── API URL pattern ─────────────────────────────────────────────────────────
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
function api(path: string) { return `${BASE}api${path}`; }

// ── Types ───────────────────────────────────────────────────────────────────
type BattleMode  = "logic" | "debate" | "creative" | "speed";
type Provider    = "openai" | "claude" | "perplexity";
type Phase       = "setup" | "fighting" | "result" | "ko";

interface ScoreBreak {
  total: number; logic: number; relevance: number;
  confidence: number; depth: number; speed: number;
}

interface RoundResponse {
  provider: string; content: string; responseTime: number;
  error?: string; score: ScoreBreak;
}

interface RoundResult {
  round: number; prompt: string;
  responseA: RoundResponse; responseB: RoundResponse;
  winner: "a" | "b" | "tie"; hpDamage: number;
}

// ── Config ──────────────────────────────────────────────────────────────────
const FIGHTERS: { id: Provider; name: string; color: string; glow: string; icon: string }[] = [
  { id: "openai",     name: "GPT-4",      color: "#10A37F", glow: "rgba(16,163,127,0.40)",  icon: "✦" },
  { id: "claude",     name: "Claude",     color: "#D97757", glow: "rgba(217,119,87,0.40)",  icon: "◆" },
  { id: "perplexity", name: "Perplexity", color: "#228BE6", glow: "rgba(34,139,230,0.40)",  icon: "◎" },
];

const MATCHUPS: [Provider, Provider][] = [
  ["openai", "claude"],
  ["openai", "perplexity"],
  ["claude", "perplexity"],
];

const MODES: { id: BattleMode; label: string; icon: string; desc: string }[] = [
  { id: "logic",    label: "Logic",    icon: "🧠", desc: "Who reasons better?"   },
  { id: "debate",   label: "Debate",   icon: "⚖️",  desc: "Who persuades better?" },
  { id: "creative", label: "Creative", icon: "✨", desc: "Who creates better?"   },
  { id: "speed",    label: "Speed",    icon: "⚡", desc: "Who answers fastest?"  },
];

const MAX_ROUNDS = 3;

// ── HP Bar ──────────────────────────────────────────────────────────────────
function HpBar({ hp, color, align }: { hp: number; color: string; align: "left" | "right" }) {
  const pct = Math.max(0, Math.min(100, hp));
  const barColor = hp > 50 ? color : hp > 25 ? "#F59E0B" : "#EF4444";

  return (
    <div style={{ flex: 1, height: 10, background: "rgba(255,255,255,0.08)", borderRadius: 5, overflow: "hidden" }}>
      <div
        style={{
          height: "100%",
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${barColor}cc, ${barColor})`,
          boxShadow: `0 0 8px ${barColor}88`,
          borderRadius: 5,
          float: align === "right" ? "right" : "left",
          transition: `width 0.6s ${IOS}`,
        }}
      />
    </div>
  );
}

// ── Arena Field ─────────────────────────────────────────────────────────────
function ArenaField({ phase, winnerSide, colorA, colorB }: {
  phase: Phase; winnerSide: "a" | "b" | "tie" | null;
  colorA: string; colorB: string;
}) {
  const [shockwave, setShockwave] = useState(false);

  useEffect(() => {
    if (phase === "result") {
      setShockwave(true);
      const t = setTimeout(() => setShockwave(false), 900);
      return () => clearTimeout(t);
    }
  }, [phase]);

  return (
    <div
      style={{
        position: "relative",
        height: 110,
        background: "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.03))",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Grid lines */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: `
          linear-gradient(rgba(108,92,231,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(108,92,231,0.04) 1px, transparent 1px)
        `,
        backgroundSize: "24px 24px",
        pointerEvents: "none",
      }} />

      {/* Left energy beam */}
      <div style={{
        position: "absolute", left: 0, top: "50%",
        transform: "translateY(-50%)",
        width: "40%", height: 2,
        background: `linear-gradient(90deg, transparent, ${colorA}88, ${colorA})`,
        animation: phase === "fighting" ? "arena-beam-l 0.8s ease-in-out infinite alternate" : "none",
        opacity: phase === "fighting" ? 1 : 0.3,
        transition: "opacity 0.4s ease",
      }} />

      {/* Right energy beam */}
      <div style={{
        position: "absolute", right: 0, top: "50%",
        transform: "translateY(-50%)",
        width: "40%", height: 2,
        background: `linear-gradient(270deg, transparent, ${colorB}88, ${colorB})`,
        animation: phase === "fighting" ? "arena-beam-r 0.8s ease-in-out infinite alternate" : "none",
        opacity: phase === "fighting" ? 1 : 0.3,
        transition: "opacity 0.4s ease",
      }} />

      {/* Shockwave rings */}
      {shockwave && (
        <>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{
              position: "absolute",
              width: 20, height: 20,
              borderRadius: "50%",
              border: `2px solid ${winnerSide === "a" ? colorA : colorB}`,
              animation: `arena-shock 0.9s ${i * 0.15}s ease-out forwards`,
              opacity: 1,
              pointerEvents: "none",
            }} />
          ))}
        </>
      )}

      {/* VS Orb */}
      <div style={{
        position: "relative",
        width: 60, height: 60,
        borderRadius: "50%",
        background: phase === "fighting"
          ? `radial-gradient(circle, rgba(255,255,255,0.12), rgba(108,92,231,0.08))`
          : "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.12)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: phase === "fighting"
          ? `0 0 24px rgba(108,92,231,0.35), 0 0 48px rgba(108,92,231,0.15)`
          : "none",
        animation: phase === "fighting" ? "arena-vs-pulse 1.2s ease-in-out infinite" : "none",
        transition: "box-shadow 0.5s ease",
      }}>
        {phase === "fighting" ? (
          <Flame style={{ width: 20, height: 20, color: "#A29BFE", animation: "spin 1s linear infinite" }} />
        ) : (
          <span style={{
            fontSize: 13, fontWeight: 900, letterSpacing: "0.08em",
            background: "linear-gradient(135deg, #6C5CE7, #FD79A8)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>VS</span>
        )}
      </div>
    </div>
  );
}

// ── Score Breakdown Row ──────────────────────────────────────────────────────
function ScoreRow({ label, val, max = 100, color }: { label: string; val: number; max?: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", width: 64, flexShrink: 0, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.07)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${(val / max) * 100}%`, height: "100%", background: color, borderRadius: 2, transition: `width 0.6s ${IOS}` }} />
      </div>
      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", fontFamily: "monospace", width: 22, textAlign: "right" }}>
        {val}
      </span>
    </div>
  );
}

// ── Response Card ────────────────────────────────────────────────────────────
function ResponseCard({ response, isWinner, fighter, rank, prompt }: {
  response: RoundResponse; isWinner: boolean; fighter: typeof FIGHTERS[0]; rank: "a" | "b"; prompt?: string;
}) {
  const [expanded,  setExpanded]  = useState(false);
  const [showShare, setShowShare] = useState(false);

  return (
    <>
    <div
      style={{
        borderRadius: 18,
        border: `1px solid ${isWinner ? fighter.color + "55" : "rgba(255,255,255,0.08)"}`,
        background: isWinner
          ? `linear-gradient(135deg, ${fighter.color}12, ${fighter.color}06)`
          : "rgba(18,20,26,0.90)",
        boxShadow: isWinner
          ? `0 0 24px ${fighter.glow}, 0 4px 16px rgba(0,0,0,0.40)`
          : "0 4px 16px rgba(0,0,0,0.30)",
        overflow: "hidden",
        transition: `all 0.3s ${IOS}`,
        animation: "response-enter 0.35s ease-out both",
      }}
    >
      {/* Card header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px 8px",
        borderBottom: `1px solid ${fighter.color}22`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 9,
            background: `linear-gradient(135deg, ${fighter.color}33, ${fighter.color}18)`,
            border: `1px solid ${fighter.color}44`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13,
          }}>{fighter.icon}</div>
          <div>
            <span style={{ fontSize: 12, fontWeight: 700, color: isWinner ? fighter.color : "rgba(255,255,255,0.80)" }}>
              {fighter.name}
            </span>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.30)", marginTop: 1 }}>
              {(response.responseTime / 1000).toFixed(2)}s
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isWinner && (
            <div style={{
              padding: "2px 8px", borderRadius: 99,
              background: `linear-gradient(135deg, ${fighter.color}, ${fighter.color}aa)`,
              fontSize: 9, fontWeight: 700, color: "white", letterSpacing: "0.06em", textTransform: "uppercase",
            }}>WIN</div>
          )}
          <div style={{
            padding: "3px 10px", borderRadius: 99,
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)",
            fontSize: 14, fontWeight: 800,
            color: isWinner ? fighter.color : "rgba(255,255,255,0.55)",
          }}>
            {response.score.total}
          </div>
        </div>
      </div>

      {/* Response text */}
      <div
        style={{
          padding: "10px 14px",
          maxHeight: expanded ? 600 : 100,
          overflow: "hidden",
          transition: `max-height 0.40s ${IOS}`,
          position: "relative",
        }}
      >
        <p style={{
          fontSize: 13, lineHeight: 1.60, color: "rgba(255,255,255,0.82)",
          whiteSpace: "pre-wrap", margin: 0,
        }}>
          {response.error ? `⚠ ${response.error}` : response.content}
        </p>
        {!expanded && response.content.length > 180 && (
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0, height: 48,
            background: "linear-gradient(transparent, rgba(18,20,26,0.98))",
            pointerEvents: "none",
          }} />
        )}
      </div>

      {/* Expand / Score toggle */}
      <div style={{ padding: "0 14px 10px" }}>
        {response.content.length > 180 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            style={{
              fontSize: 10, color: fighter.color, fontWeight: 600,
              cursor: "pointer", marginBottom: 8, letterSpacing: "0.03em",
            }}
          >
            {expanded ? "▲ Show less" : "▼ Read more"}
          </button>
        )}

        {/* Score breakdown */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 8, marginTop: 4 }}>
          <ScoreRow label="Logic"      val={response.score.logic}      color={fighter.color} />
          <ScoreRow label="Relevance"  val={response.score.relevance}  color={fighter.color} />
          <ScoreRow label="Confidence" val={response.score.confidence} color={fighter.color} />
          <ScoreRow label="Depth"      val={response.score.depth}      color={fighter.color} />
          <ScoreRow label="Speed"      val={response.score.speed}      color={fighter.color} />
        </div>

        {/* Share button */}
        {!response.error && (
          <button
            onClick={() => setShowShare(true)}
            style={{
              marginTop: 10, width: "100%",
              padding: "9px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              cursor: "pointer",
              transition: `all 0.18s ${IOS}`,
              color: "rgba(255,255,255,0.40)",
              fontSize: 11, fontWeight: 600,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = `${fighter.color}14`;
              e.currentTarget.style.border = `1px solid ${fighter.color}35`;
              e.currentTarget.style.color = fighter.color;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.04)";
              e.currentTarget.style.border = "1px solid rgba(255,255,255,0.08)";
              e.currentTarget.style.color = "rgba(255,255,255,0.40)";
            }}
          >
            <Share2 style={{ width: 12, height: 12 }} />
            Share this result
          </button>
        )}
      </div>
    </div>

    {/* Share modal */}
    {showShare && (
      <ShareModal
        prompt={prompt}
        response={response.content}
        provider={response.provider}
        responseTime={response.responseTime}
        context="battle"
        onClose={() => setShowShare(false)}
      />
    )}
    </>
  );
}

// ── KO / Winner Screen ───────────────────────────────────────────────────────
function KoScreen({ winner, fighterA, fighterB, history, onRematch }: {
  winner: "a" | "b" | null;
  fighterA: typeof FIGHTERS[0];
  fighterB: typeof FIGHTERS[0];
  history: RoundResult[];
  onRematch: () => void;
}) {
  const wFighter = winner === "a" ? fighterA : winner === "b" ? fighterB : null;
  const winsA = history.filter((r) => r.winner === "a").length;
  const winsB = history.filter((r) => r.winner === "b").length;
  const avgScoreA = history.length > 0
    ? Math.round(history.reduce((s, r) => s + r.responseA.score.total, 0) / history.length) : 0;
  const avgScoreB = history.length > 0
    ? Math.round(history.reduce((s, r) => s + r.responseB.score.total, 0) / history.length) : 0;

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 50,
      background: "rgba(14,12,32,0.55)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: 24,
      animation: "ko-enter 0.5s ease-out both",
    }}>
      {/* KO text */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{
          fontSize: 80, fontWeight: 900, letterSpacing: "-0.02em",
          background: wFighter
            ? `linear-gradient(135deg, ${wFighter.color}, ${wFighter.color}aa)`
            : "linear-gradient(135deg, #6C5CE7, #A29BFE)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          lineHeight: 1,
          animation: "ko-text 0.6s ease-out both",
          filter: `drop-shadow(0 0 20px ${wFighter?.color ?? "#6C5CE7"}88)`,
        }}>
          {winner === null ? "DRAW" : "K.O."}
        </div>
        {wFighter && (
          <div style={{
            fontSize: 18, fontWeight: 700, color: wFighter.color,
            marginTop: 8, letterSpacing: "0.02em",
            animation: "ko-winner 0.5s 0.2s ease-out both",
            opacity: 0,
          }}>
            {wFighter.icon} {wFighter.name} wins
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{
        width: "100%", borderRadius: 20,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        padding: "16px 20px",
        marginBottom: 24,
        animation: "ko-stats 0.4s 0.4s ease-out both",
        opacity: 0,
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.30)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>
          Battle Statistics
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          {[
            { fighter: fighterA, wins: winsA, score: avgScoreA },
            { fighter: fighterB, wins: winsB, score: avgScoreB },
          ].map(({ fighter, wins, score }) => (
            <div key={fighter.id} style={{
              flex: 1, textAlign: "center",
              padding: "12px 8px",
              borderRadius: 14,
              background: fighter.id === wFighter?.id ? `${fighter.color}10` : "rgba(255,255,255,0.02)",
              border: `1px solid ${fighter.id === wFighter?.id ? fighter.color + "33" : "rgba(255,255,255,0.06)"}`,
            }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{fighter.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: fighter.color, marginBottom: 8 }}>{fighter.name}</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "white", lineHeight: 1 }}>{wins}</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.30)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>rounds won</div>
              <div style={{
                padding: "4px 8px", borderRadius: 99,
                background: "rgba(255,255,255,0.06)", fontSize: 11, fontWeight: 700,
                color: "rgba(255,255,255,0.60)",
              }}>avg {score}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Rematch button */}
      <button
        onClick={onRematch}
        style={{
          width: "100%", padding: "14px",
          borderRadius: 16,
          background: "linear-gradient(135deg, #6C5CE7, #A29BFE)",
          border: "none",
          fontSize: 15, fontWeight: 800, color: "white",
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          boxShadow: "0 4px 20px rgba(108,92,231,0.45)",
          animation: "ko-stats 0.4s 0.6s ease-out both",
          opacity: 0,
        }}
      >
        <RotateCcw style={{ width: 16, height: 16 }} />
        Fight Again
      </button>
    </div>
  );
}

// ── Main Arena Page ──────────────────────────────────────────────────────────
function ArenaPageInner() {
  const [, nav]  = useLocation();
  const [mode, setMode]           = useState<BattleMode>("logic");
  const [matchup, setMatchup]     = useState<[Provider, Provider]>(["openai", "claude"]);
  const [phase, setPhase]         = useState<Phase>("setup");
  const [prompt, setPrompt]       = useState("");
  const [round, setRound]         = useState(1);
  const [hpA, setHpA]             = useState(100);
  const [hpB, setHpB]             = useState(100);
  const [history, setHistory]     = useState<RoundResult[]>([]);
  const [current, setCurrent]     = useState<RoundResult | null>(null);
  const [winner, setWinner]       = useState<"a" | "b" | null>(null);
  const [hitFlash, setHitFlash]   = useState<"a" | "b" | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef   = useRef<HTMLDivElement>(null);

  const fighterA = FIGHTERS.find((f) => f.id === matchup[0]) ?? FIGHTERS[0];
  const fighterB = FIGHTERS.find((f) => f.id === matchup[1]) ?? FIGHTERS[1];

  // Scroll to bottom when results come in
  useEffect(() => {
    if (phase === "result" && scrollRef.current) {
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 200);
    }
  }, [phase, current]);

  const triggerHitFlash = (side: "a" | "b") => {
    setHitFlash(side);
    setTimeout(() => setHitFlash(null), 500);
  };

  const fightRound = useCallback(async () => {
    if (!prompt.trim() || phase === "fighting") return;
    setPhase("fighting");

    try {
      const res = await fetch(api("/battle/round"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          providerA: matchup[0],
          providerB: matchup[1],
          battleMode: mode,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const result: RoundResult = {
        round,
        prompt: prompt.trim(),
        responseA: data.responseA,
        responseB: data.responseB,
        winner: data.winner,
        hpDamage: data.hpDamage,
      };

      // Update HP
      let newHpA = hpA;
      let newHpB = hpB;
      if (data.winner === "a") {
        newHpB = Math.max(0, hpB - data.hpDamage);
        triggerHitFlash("b");
      } else if (data.winner === "b") {
        newHpA = Math.max(0, hpA - data.hpDamage);
        triggerHitFlash("a");
      }

      setHpA(newHpA);
      setHpB(newHpB);
      setCurrent(result);
      setHistory((prev) => [...prev, result]);
      setPhase("result");
      setPrompt("");

      // Check KO / end of rounds
      const isKo = newHpA <= 0 || newHpB <= 0;
      const isLastRound = round >= MAX_ROUNDS;

      if (isKo || isLastRound) {
        setTimeout(() => {
          const w = newHpA > newHpB ? "a" : newHpB > newHpA ? "b" : null;
          setWinner(w);
          setPhase("ko");
        }, 2800);
      } else {
        setRound((r) => r + 1);
      }
    } catch (err) {
      setPhase("result");
      console.error("Battle round error:", err);
    }
  }, [prompt, phase, matchup, mode, round, hpA, hpB]);

  const handleRematch = () => {
    setPhase("setup");
    setRound(1);
    setHpA(100);
    setHpB(100);
    setHistory([]);
    setCurrent(null);
    setWinner(null);
    setPrompt("");
  };

  const canFight = prompt.trim().length > 2 && phase !== "fighting";
  const currentMode = MODES.find((m) => m.id === mode) ?? MODES[0];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      display: "flex", flexDirection: "column",
      background: "transparent",
      fontFamily: "inherit",
    }}>

      {/* ── Header ────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0, padding: "14px 16px 12px",
        background: "rgba(14,12,32,0.55)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <button onClick={() => nav("/")} style={{
          width: 34, height: 34, borderRadius: "50%",
          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", color: "rgba(255,255,255,0.60)", flexShrink: 0,
        }}>
          <ArrowLeft style={{ width: 16, height: 16 }} />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
          <Swords style={{ width: 16, height: 16, color: "#EF4444" }} />
          <span style={{ fontSize: 15, fontWeight: 800, color: "white", letterSpacing: "-0.01em" }}>
            AI BATTLE ARENA
          </span>
        </div>

        {/* Mode picker (pill style) */}
        <div style={{ display: "flex", gap: 4, overflowX: "auto", scrollbarWidth: "none", maxWidth: 190 }}>
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              style={{
                flexShrink: 0,
                padding: "4px 8px", borderRadius: 99,
                fontSize: 10, fontWeight: 700,
                color: mode === m.id ? "white" : "rgba(255,255,255,0.30)",
                background: mode === m.id ? "rgba(108,92,231,0.30)" : "transparent",
                border: mode === m.id ? "1px solid rgba(162,155,254,0.30)" : "1px solid transparent",
                cursor: "pointer", whiteSpace: "nowrap",
                transition: `all 0.18s ${IOS}`,
              }}
            >
              {m.icon} {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Fighter HP row ─────────────────────────────────── */}
      {phase !== "setup" && (
        <div style={{
          flexShrink: 0,
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 16px",
          background: "rgba(14,12,32,0.55)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}>
          {/* Fighter A */}
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{
                fontSize: 11, fontWeight: 800, color: fighterA.color,
                animation: hitFlash === "a" ? "hit-flash 0.5s ease" : "none",
              }}>
                {fighterA.icon} {fighterA.name}
              </span>
              <span style={{ fontSize: 10, color: hpA <= 25 ? "#EF4444" : "rgba(255,255,255,0.45)", fontFamily: "monospace" }}>
                {hpA}
              </span>
            </div>
            <HpBar hp={hpA} color={fighterA.color} align="left" />
          </div>

          {/* Round badge */}
          <div style={{
            flexShrink: 0, textAlign: "center",
            padding: "4px 8px", borderRadius: 8,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}>
            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.06em" }}>RND</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: "white", lineHeight: 1 }}>{round}</div>
          </div>

          {/* Fighter B */}
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, flexDirection: "row-reverse" }}>
              <span style={{
                fontSize: 11, fontWeight: 800, color: fighterB.color,
                animation: hitFlash === "b" ? "hit-flash 0.5s ease" : "none",
              }}>
                {fighterB.icon} {fighterB.name}
              </span>
              <span style={{ fontSize: 10, color: hpB <= 25 ? "#EF4444" : "rgba(255,255,255,0.45)", fontFamily: "monospace" }}>
                {hpB}
              </span>
            </div>
            <HpBar hp={hpB} color={fighterB.color} align="right" />
          </div>
        </div>
      )}

      {/* ── Arena Field ────────────────────────────────────── */}
      {phase !== "setup" && (
        <ArenaField
          phase={phase}
          winnerSide={current?.winner ?? null}
          colorA={fighterA.color}
          colorB={fighterB.color}
        />
      )}

      {/* ── Setup Screen ───────────────────────────────────── */}
      {phase === "setup" && (
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "20px 16px 120px" }}>
          {/* Arena intro */}
          <div style={{
            borderRadius: 20,
            background: "linear-gradient(135deg, rgba(239,68,68,0.08), rgba(251,191,36,0.06))",
            border: "1px solid rgba(239,68,68,0.18)",
            padding: "16px 18px",
            marginBottom: 24,
            textAlign: "center",
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>⚔️</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "white", marginBottom: 4 }}>
              Choose Your Fighters
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.40)" }}>
              Select a battle mode + matchup, then drop a topic to ignite the arena
            </div>
          </div>

          {/* Battle Mode selector */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.30)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
              Battle Mode
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  style={{
                    padding: "12px 14px", borderRadius: 14, cursor: "pointer", textAlign: "left",
                    background: mode === m.id ? "rgba(108,92,231,0.18)" : "rgba(255,255,255,0.04)",
                    border: mode === m.id ? "1px solid rgba(162,155,254,0.35)" : "1px solid rgba(255,255,255,0.07)",
                    transition: `all 0.18s ${IOS}`,
                  }}
                >
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{m.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: mode === m.id ? "#A29BFE" : "rgba(255,255,255,0.70)", marginBottom: 2 }}>
                    {m.label} Mode
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.30)" }}>{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Matchup selector */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.30)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
              Matchup
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {MATCHUPS.map(([a, b]) => {
                const fA = FIGHTERS.find((f) => f.id === a)!;
                const fB = FIGHTERS.find((f) => f.id === b)!;
                const isActive = matchup[0] === a && matchup[1] === b;
                return (
                  <button
                    key={`${a}-${b}`}
                    onClick={() => setMatchup([a, b])}
                    style={{
                      padding: "12px 16px", borderRadius: 14, cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 12,
                      background: isActive ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)",
                      border: isActive ? "1px solid rgba(255,255,255,0.14)" : "1px solid rgba(255,255,255,0.06)",
                      transition: `all 0.18s ${IOS}`,
                    }}
                  >
                    <span style={{ fontSize: 14, color: fA.color, fontWeight: 800 }}>{fA.icon} {fA.name}</span>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.30)", fontWeight: 700 }}>VS</span>
                    <span style={{ fontSize: 14, color: fB.color, fontWeight: 800 }}>{fB.icon} {fB.name}</span>
                    {isActive && (
                      <div style={{
                        marginLeft: "auto",
                        width: 8, height: 8, borderRadius: "50%",
                        background: "#A29BFE", boxShadow: "0 0 8px rgba(162,155,254,0.80)",
                      }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Current selection summary */}
          <div style={{
            padding: "10px 14px", borderRadius: 12,
            background: "rgba(108,92,231,0.08)", border: "1px solid rgba(108,92,231,0.18)",
            fontSize: 11, color: "rgba(162,155,254,0.70)", fontWeight: 500,
          }}>
            {currentMode.icon} {currentMode.label} Battle · {fighterA.name} vs {fighterB.name} · {MAX_ROUNDS} rounds
          </div>
        </div>
      )}

      {/* ── Results scroll area ─────────────────────────────── */}
      {phase !== "setup" && phase !== "ko" && (
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "14px 16px 130px", display: "flex", flexDirection: "column", gap: 12 }}>
          {history.map((r, idx) => (
            <div key={idx} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {history.length > 1 && (
                <div style={{ textAlign: "center", fontSize: 10, color: "rgba(255,255,255,0.20)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  Round {r.round} · {r.winner === "tie" ? "DRAW" : r.winner === "a" ? fighterA.name + " wins" : fighterB.name + " wins"}
                </div>
              )}
              <ResponseCard response={r.responseA} isWinner={r.winner === "a"} fighter={fighterA} rank="a" prompt={r.prompt} />
              <ResponseCard response={r.responseB} isWinner={r.winner === "b"} fighter={fighterB} rank="b" prompt={r.prompt} />
            </div>
          ))}

          {phase === "fighting" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[fighterA, fighterB].map((f) => (
                <div key={f.id} style={{
                  borderRadius: 18, padding: 16,
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid ${f.color}22`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <div style={{ fontSize: 14 }}>{f.icon}</div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: f.color }}>{f.name}</span>
                    <div style={{ display: "flex", gap: 3, marginLeft: 4 }}>
                      {[0,1,2].map((i) => (
                        <div key={i} style={{
                          width: 4, height: 4, borderRadius: "50%", background: f.color,
                          animation: `live-dot-pulse 1.2s ${i * 0.25}s ease-in-out infinite`,
                        }} />
                      ))}
                    </div>
                  </div>
                  {[0.55, 0.70, 0.45, 0.80, 0.60].map((w, i) => (
                    <div key={i} style={{
                      height: 8, borderRadius: 4,
                      background: `${f.color}18`,
                      marginBottom: 6,
                      width: `${w * 100}%`,
                      animation: "skeleton-shimmer 1.5s ease-in-out infinite alternate",
                    }} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── KO Overlay ─────────────────────────────────────── */}
      {phase === "ko" && (
        <div style={{ flex: 1, position: "relative" }}>
          <KoScreen
            winner={winner}
            fighterA={fighterA}
            fighterB={fighterB}
            history={history}
            onRematch={handleRematch}
          />
        </div>
      )}

      {/* ── Bottom Input ────────────────────────────────────── */}
      {phase !== "ko" && (
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          padding: "8px 12px 20px",
          background: "linear-gradient(to top, rgba(5,0,12,1) 65%, transparent 100%)",
        }}>
          <div style={{
            display: "flex", alignItems: "flex-end", gap: 8,
            padding: "8px 8px 8px 14px",
            borderRadius: 22,
            background: "rgba(20,14,30,0.98)",
            border: `1px solid ${canFight ? "rgba(108,92,231,0.35)" : "rgba(255,255,255,0.09)"}`,
            boxShadow: canFight ? "0 0 0 3px rgba(108,92,231,0.10), 0 8px 32px rgba(0,0,0,0.50)" : "0 8px 32px rgba(0,0,0,0.40)",
            transition: `all 0.25s ${IOS}`,
          }}>
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (canFight) {
                    if (phase === "setup") setPhase("result");
                    fightRound();
                  }
                }
              }}
              placeholder={
                phase === "setup" ? "Enter a battle topic... (e.g. Is AI conscious?)" :
                phase === "fighting" ? "AIs are fighting..." :
                `Round ${round + 1} topic...`
              }
              disabled={phase === "fighting"}
              rows={1}
              style={{
                flex: 1, background: "transparent", border: "none", outline: "none",
                resize: "none", maxHeight: 100, minHeight: 36,
                fontSize: 14, lineHeight: 1.55, color: "rgba(255,255,255,0.90)",
                caretColor: "#A29BFE", padding: "8px 0", fontFamily: "inherit",
              }}
            />

            <button
              onClick={() => {
                if (!canFight) return;
                if (phase === "setup") setPhase("result");
                fightRound();
              }}
              disabled={!canFight}
              style={{
                flexShrink: 0, width: 42, height: 42, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: canFight
                  ? "linear-gradient(135deg, #EF4444, #F59E0B)"
                  : "rgba(255,255,255,0.07)",
                border: canFight
                  ? "1px solid rgba(239,68,68,0.40)"
                  : "1px solid rgba(255,255,255,0.08)",
                boxShadow: canFight ? "0 4px 16px rgba(239,68,68,0.45)" : "none",
                cursor: canFight ? "pointer" : "not-allowed",
                transition: `all 0.25s ${SPRING}`,
                transform: canFight ? "scale(1.05)" : "scale(1)",
              }}
            >
              {phase === "fighting"
                ? <Zap style={{ width: 16, height: 16, color: "#F59E0B", animation: "spin 0.8s linear infinite" }} />
                : <Swords style={{ width: 16, height: 16, color: canFight ? "white" : "rgba(255,255,255,0.30)" }} />}
            </button>
          </div>

          {/* Mode hint */}
          <div style={{ textAlign: "center", marginTop: 6, fontSize: 9, color: "rgba(255,255,255,0.18)", letterSpacing: "0.04em" }}>
            {currentMode.icon} {currentMode.label.toUpperCase()} MODE · {fighterA.name} vs {fighterB.name}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ArenaPage() {
  return (
    <FeaturePreview feature="battleMode">
      <ArenaPageInner />
    </FeaturePreview>
  );
}
