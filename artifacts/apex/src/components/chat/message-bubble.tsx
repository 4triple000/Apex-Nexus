import { useState, useEffect, useRef } from "react";
import { RiOpenaiFill } from "react-icons/ri";
import { SiClaude, SiPerplexity } from "react-icons/si";
import { Volume2, VolumeX, ThumbsUp, Check, Sparkles, Zap, Copy, CheckCheck, Share2 } from "lucide-react";
import { ShareModal } from "@/components/share/ShareModal";
import { ApexLogoMini } from "@/components/ui/ApexLogo";

// ── Design tokens ──────────────────────────────────────────────────────────────
const EASE_IOS    = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";
const EASE_SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

// ── Streaming text hook ────────────────────────────────────────────────────────
// Reveals text character-by-character like ChatGPT streaming.
// CHUNK controls chars-per-frame at ~60fps. 8 chars/frame ≈ smooth feel.
function useStreamText(content: string, enabled: boolean) {
  const [displayed, setDisplayed] = useState(enabled ? "" : content);
  const doneRef  = useRef(!enabled);
  const indexRef = useRef(0);

  useEffect(() => {
    if (!enabled || !content) {
      setDisplayed(content);
      doneRef.current = true;
      return;
    }
    // Reset for this message
    indexRef.current = 0;
    setDisplayed("");
    doneRef.current = false;

    const CHUNK = 7; // chars per tick — faster = snappier, lower = more dramatic
    const TICK  = 14; // ms between ticks (14ms ≈ 60fps feel)

    const id = setInterval(() => {
      indexRef.current = Math.min(indexRef.current + CHUNK, content.length);
      setDisplayed(content.slice(0, indexRef.current));
      if (indexRef.current >= content.length) {
        doneRef.current = true;
        clearInterval(id);
      }
    }, TICK);

    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentional — run once on mount

  return { displayed, isDone: doneRef.current };
}

// ── Provider config ────────────────────────────────────────────────────────────
interface ProviderCfg {
  name: string;
  color: string;
  glow: string;
  glowStrong: string;
  icon: React.ComponentType<{ style?: React.CSSProperties }>;
  gradient: string;
  border: string;
  rankBorder: string; // for battle cards
}

export const PROVIDER_CONFIG: Record<string, ProviderCfg> = {
  openai: {
    name: "ChatGPT",
    color: "#10A37F",
    glow: "rgba(16,163,127,0.28)",
    glowStrong: "rgba(16,163,127,0.55)",
    icon: RiOpenaiFill,
    gradient: "linear-gradient(135deg, rgba(16,163,127,0.10) 0%, rgba(16,163,127,0.04) 100%)",
    border: "rgba(16,163,127,0.22)",
    rankBorder: "#10A37F",
  },
  claude: {
    name: "Claude",
    color: "#D97757",
    glow: "rgba(217,119,87,0.28)",
    glowStrong: "rgba(217,119,87,0.55)",
    icon: SiClaude,
    gradient: "linear-gradient(135deg, rgba(217,119,87,0.10) 0%, rgba(217,119,87,0.04) 100%)",
    border: "rgba(217,119,87,0.22)",
    rankBorder: "#D97757",
  },
  perplexity: {
    name: "Perplexity",
    color: "#228BE6",
    glow: "rgba(34,139,230,0.28)",
    glowStrong: "rgba(34,139,230,0.55)",
    icon: SiPerplexity,
    gradient: "linear-gradient(135deg, rgba(34,139,230,0.10) 0%, rgba(34,139,230,0.04) 100%)",
    border: "rgba(34,139,230,0.22)",
    rankBorder: "#228BE6",
  },
  hive: {
    name: "Hive Mind",
    color: "#BE4BDB",
    glow: "rgba(190,75,219,0.28)",
    glowStrong: "rgba(190,75,219,0.55)",
    icon: Zap,
    gradient: "linear-gradient(135deg, rgba(190,75,219,0.10) 0%, rgba(190,75,219,0.04) 100%)",
    border: "rgba(190,75,219,0.22)",
    rankBorder: "#BE4BDB",
  },
  auto: {
    name: "Apex AI",
    color: "#A29BFE",
    glow: "rgba(162,155,254,0.28)",
    glowStrong: "rgba(162,155,254,0.55)",
    icon: Sparkles,
    gradient: "linear-gradient(135deg, rgba(108,92,231,0.10) 0%, rgba(162,155,254,0.04) 100%)",
    border: "rgba(162,155,254,0.22)",
    rankBorder: "#A29BFE",
  },
};

// ── Props ─────────────────────────────────────────────────────────────────────
interface MessageBubbleProps {
  role: "user" | "ai";
  content: string;
  prompt?: string;       // optional: user's question before this response
  provider?: string;
  responseTime?: number;
  error?: string;
  showVoteButton?: boolean;
  onVote?: () => void;
  stream?: boolean; // enable typing animation (default true for ai)
}

// ── USER BUBBLE ────────────────────────────────────────────────────────────────
function UserBubble({ content }: { content: string }) {
  return (
    <div
      className="flex justify-end w-full"
      style={{ animation: `msg-slide-in-right 0.26s ${EASE_IOS} both` }}
    >
      <div
        data-testid="text-user-message"
        style={{
          maxWidth: "80%",
          background: "linear-gradient(135deg, #6C5CE7 0%, #8B7CF6 45%, #FD79A8 100%)",
          borderRadius: "20px 20px 5px 20px",
          padding: "11px 16px",
          fontSize: 14.5,
          lineHeight: 1.58,
          color: "white",
          fontWeight: 420,
          letterSpacing: "0.005em",
          boxShadow: [
            "0 4px 24px rgba(108,92,231,0.42)",
            "0 2px 8px rgba(253,121,168,0.22)",
            "inset 0 1px 0 rgba(255,255,255,0.22)",
          ].join(", "),
          wordBreak: "break-word",
          whiteSpace: "pre-wrap",
        }}
      >
        {content}
      </div>
    </div>
  );
}

// ── AI BUBBLE ─────────────────────────────────────────────────────────────────
function AiBubble({
  content,
  prompt,
  provider,
  responseTime,
  error,
  showVoteButton,
  onVote,
  stream = true,
}: Omit<MessageBubbleProps, "role">) {
  const [isPlaying,  setIsPlaying]  = useState(false);
  const [hasVoted,   setHasVoted]   = useState(false);
  const [copied,     setCopied]     = useState(false);
  const [showShare,  setShowShare]  = useState(false);

  const safeProvider = (provider && provider in PROVIDER_CONFIG) ? provider : "auto";
  const cfg = PROVIDER_CONFIG[safeProvider];
  const ProviderIcon = cfg.icon;

  const { displayed, isDone } = useStreamText(error ? (error || content) : content, stream && !error);

  const toggleSpeech = () => {
    if (isPlaying) { window.speechSynthesis.cancel(); setIsPlaying(false); }
    else {
      const u = new SpeechSynthesisUtterance(content);
      u.onend = u.onerror = () => setIsPlaying(false);
      window.speechSynthesis.speak(u);
      setIsPlaying(true);
    }
  };

  const handleVote = () => {
    if (hasVoted) return;
    setHasVoted(true);
    onVote?.();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const textToShow = error ? (error || content) : displayed;

  return (
    <>
    <div
      className="flex justify-start w-full"
      style={{ animation: `msg-slide-in-left 0.28s ${EASE_IOS} both` }}
    >
      <div
        data-testid={`text-ai-message-${safeProvider}`}
        style={{
          maxWidth: "91%",
          background: error ? "rgba(239,68,68,0.07)" : cfg.gradient,
          border: `1px solid ${error ? "rgba(239,68,68,0.25)" : cfg.border}`,
          borderRadius: "5px 20px 20px 20px",
          padding: "12px 14px 12px 14px",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          boxShadow: error
            ? "0 4px 20px rgba(239,68,68,0.15)"
            : `0 4px 24px rgba(0,0,0,0.22), 0 0 0 1px ${cfg.border}, 0 0 20px ${cfg.glow}`,
          wordBreak: "break-word",
        }}
      >
        {/* Provider header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9, gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {safeProvider === "auto" ? (
              <ApexLogoMini size={14} state="idle" />
            ) : (
              <>
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: cfg.color,
                    boxShadow: `0 0 8px ${cfg.glow}, 0 0 16px ${cfg.glow}`,
                    flexShrink: 0,
                  }}
                />
                <ProviderIcon style={{ width: 10, height: 10, color: cfg.color, opacity: 0.85 }} />
              </>
            )}
            <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color, textTransform: "uppercase", letterSpacing: "0.07em" }}>
              {cfg.name}
            </span>
            {responseTime !== undefined && (
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", letterSpacing: "0.02em" }}>
                {responseTime}ms
              </span>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
            {showVoteButton && (
              <button
                data-testid={`button-vote-${safeProvider}`}
                onClick={handleVote}
                className="haptic-sm"
                title={hasVoted ? "Voted" : "Vote best"}
                style={{
                  width: 26, height: 26, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: hasVoted ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.06)",
                  border: hasVoted ? "1px solid rgba(74,222,128,0.30)" : "1px solid rgba(255,255,255,0.08)",
                  transition: `all 0.22s ${EASE_IOS}`,
                  cursor: hasVoted ? "default" : "pointer",
                }}
              >
                {hasVoted
                  ? <Check style={{ width: 10, height: 10, color: "#4ADE80" }} />
                  : <ThumbsUp style={{ width: 10, height: 10, color: "rgba(255,255,255,0.38)" }} />}
              </button>
            )}
            {isDone && (
              <button
                onClick={handleCopy}
                className="haptic-sm"
                title="Copy"
                style={{
                  width: 26, height: 26, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: copied ? "rgba(162,155,254,0.15)" : "rgba(255,255,255,0.06)",
                  border: copied ? "1px solid rgba(162,155,254,0.30)" : "1px solid rgba(255,255,255,0.08)",
                  transition: `all 0.22s ${EASE_IOS}`,
                  cursor: "pointer",
                }}
              >
                {copied
                  ? <CheckCheck style={{ width: 10, height: 10, color: "#A29BFE" }} />
                  : <Copy style={{ width: 10, height: 10, color: "rgba(255,255,255,0.35)" }} />}
              </button>
            )}
            <button
              onClick={toggleSpeech}
              className="haptic-sm"
              title={isPlaying ? "Stop" : "Read aloud"}
              style={{
                width: 26, height: 26, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: isPlaying ? "rgba(162,155,254,0.15)" : "rgba(255,255,255,0.06)",
                border: isPlaying ? "1px solid rgba(162,155,254,0.30)" : "1px solid rgba(255,255,255,0.08)",
                transition: `all 0.20s ${EASE_IOS}`,
                cursor: "pointer",
              }}
            >
              {isPlaying
                ? <VolumeX style={{ width: 10, height: 10, color: "#A29BFE" }} />
                : <Volume2  style={{ width: 10, height: 10, color: "rgba(255,255,255,0.32)" }} />}
            </button>

            {/* Share button */}
            {isDone && !error && (
              <button
                onClick={() => setShowShare(true)}
                className="haptic-sm"
                title="Share"
                style={{
                  width: 26, height: 26, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  transition: `all 0.20s ${EASE_IOS}`,
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(162,155,254,0.15)";
                  e.currentTarget.style.border = "1px solid rgba(162,155,254,0.30)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                  e.currentTarget.style.border = "1px solid rgba(255,255,255,0.08)";
                }}
              >
                <Share2 style={{ width: 10, height: 10, color: "rgba(255,255,255,0.35)" }} />
              </button>
            )}
          </div>
        </div>

        {/* Message content + cursor */}
        <div
          style={{
            fontSize: 14.5,
            lineHeight: 1.65,
            color: error ? "#FCA5A5" : "rgba(255,255,255,0.90)",
            whiteSpace: "pre-wrap",
            letterSpacing: "0.005em",
            fontWeight: error ? 500 : 400,
          }}
        >
          {textToShow}
          {/* Blinking cursor while streaming */}
          {!isDone && (
            <span
              aria-hidden
              style={{
                display: "inline-block",
                width: 2,
                height: 15,
                background: cfg.color,
                borderRadius: 1,
                marginLeft: 2,
                verticalAlign: "text-bottom",
                animation: "cursor-blink 0.75s step-end infinite",
                boxShadow: `0 0 6px ${cfg.glow}`,
              }}
            />
          )}
        </div>
      </div>
    </div>

    {/* Share modal — portal-style, renders over app */}
    {showShare && (
      <ShareModal
        prompt={prompt}
        response={content}
        provider={safeProvider}
        responseTime={responseTime}
        context="chat"
        onClose={() => setShowShare(false)}
      />
    )}
    </>
  );
}

// ── Hive Mind bubble — special collaborative AI card ──────────────────────────
export function HiveBubble({ content }: { content: string }) {
  const { displayed, isDone } = useStreamText(content, true);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      className="flex justify-start w-full"
      style={{ animation: `hive-expand 0.42s ${EASE_SPRING} both` }}
    >
      <div
        data-testid="text-ai-message-hive"
        style={{
          width: "100%",
          maxWidth: "96%",
          position: "relative",
          overflow: "hidden",
          borderRadius: "8px 20px 20px 20px",
          border: "1px solid rgba(190,75,219,0.30)",
          background: [
            "linear-gradient(135deg, rgba(108,28,224,0.14) 0%, rgba(190,75,219,0.10) 50%, rgba(109,40,217,0.08) 100%)",
          ].join(", "),
          backdropFilter: "blur(28px)",
          WebkitBackdropFilter: "blur(28px)",
          boxShadow: [
            "0 0 0 1px rgba(190,75,219,0.18)",
            "0 0 32px rgba(190,75,219,0.18)",
            "0 0 64px rgba(108,28,224,0.10)",
            "0 8px 32px rgba(0,0,0,0.28)",
            "inset 0 1px 0 rgba(255,255,255,0.08)",
          ].join(", "),
          padding: "14px 16px 14px 16px",
          wordBreak: "break-word",
        }}
      >
        {/* Animated honeycomb nodes background */}
        <div aria-hidden style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", opacity: 0.06 }}>
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                width: 48,
                height: 48,
                borderRadius: "50%",
                border: "1px solid rgba(190,75,219,1)",
                top:  `${[8, 20, 50, 30, 65, 10][i]}%`,
                left: `${[5, 60, 30, 85, 70, 40][i]}%`,
                animation: `hive-node-pulse ${1.8 + i * 0.3}s ease-in-out ${i * 0.25}s infinite`,
              }}
            />
          ))}
          {/* Connecting lines simulation */}
          <div style={{
            position: "absolute", inset: 0,
            background: "repeating-linear-gradient(60deg, transparent, transparent 18px, rgba(190,75,219,0.5) 18px, rgba(190,75,219,0.5) 19px)",
            opacity: 0.18,
          }} />
        </div>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {/* 3 animated node dots */}
            <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
              {[
                { c: "#10A37F", delay: "0s" },
                { c: "#D97757", delay: "0.2s" },
                { c: "#228BE6", delay: "0.4s" },
              ].map((dot, i) => (
                <div
                  key={i}
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: dot.c,
                    boxShadow: `0 0 6px ${dot.c}80`,
                    animation: `live-dot-pulse 2s ease-in-out ${dot.delay} infinite`,
                  }}
                />
              ))}
            </div>
            <Zap style={{ width: 11, height: 11, color: "#BE4BDB" }} />
            <span style={{ fontSize: 10, fontWeight: 800, background: "linear-gradient(90deg, #BE4BDB, #A29BFE)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", letterSpacing: "0.07em", textTransform: "uppercase" }}>
              Hive Mind
            </span>
            <span style={{ fontSize: 8.5, color: "rgba(190,75,219,0.55)", fontWeight: 600, letterSpacing: "0.04em" }}>
              · synthesized
            </span>
          </div>

          {isDone && (
            <button
              onClick={handleCopy}
              className="haptic-sm"
              title="Copy"
              style={{
                width: 26, height: 26, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: copied ? "rgba(190,75,219,0.15)" : "rgba(255,255,255,0.06)",
                border: copied ? "1px solid rgba(190,75,219,0.30)" : "1px solid rgba(255,255,255,0.08)",
                transition: `all 0.22s ${EASE_IOS}`, cursor: "pointer",
              }}
            >
              {copied
                ? <CheckCheck style={{ width: 10, height: 10, color: "#BE4BDB" }} />
                : <Copy style={{ width: 10, height: 10, color: "rgba(255,255,255,0.35)" }} />}
            </button>
          )}
        </div>

        {/* Divider line */}
        <div style={{ height: 1, background: "linear-gradient(90deg, rgba(190,75,219,0.30), transparent)", marginBottom: 11 }} />

        {/* Content */}
        <div style={{ fontSize: 14.5, lineHeight: 1.68, color: "rgba(255,255,255,0.92)", whiteSpace: "pre-wrap", letterSpacing: "0.005em", fontWeight: 400, position: "relative", zIndex: 1 }}>
          {displayed}
          {!isDone && (
            <span
              aria-hidden
              style={{
                display: "inline-block", width: 2, height: 15,
                background: "#BE4BDB", borderRadius: 1, marginLeft: 2,
                verticalAlign: "text-bottom",
                animation: "cursor-blink 0.75s step-end infinite",
                boxShadow: "0 0 6px rgba(190,75,219,0.60)",
              }}
            />
          )}
        </div>

        {/* Source attribution bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
            powered by
          </span>
          {[
            { label: "ChatGPT", color: "#10A37F" },
            { label: "Claude", color: "#D97757" },
            { label: "Perplexity", color: "#228BE6" },
          ].map((src) => (
            <span
              key={src.label}
              style={{
                fontSize: 9, fontWeight: 700, color: src.color,
                padding: "1.5px 6px", borderRadius: 99,
                background: `${src.color}14`, border: `1px solid ${src.color}30`,
              }}
            >
              {src.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Public MessageBubble ───────────────────────────────────────────────────────
export function MessageBubble({
  role,
  content,
  prompt,
  provider,
  responseTime,
  error,
  showVoteButton,
  onVote,
  stream = true,
}: MessageBubbleProps) {
  if (role === "user") return <UserBubble content={content} />;
  return (
    <AiBubble
      content={content}
      prompt={prompt}
      provider={provider}
      responseTime={responseTime}
      error={error}
      showVoteButton={showVoteButton}
      onVote={onVote}
      stream={stream}
    />
  );
}

// ── Typing indicator (3 bouncing dots) ────────────────────────────────────────
export function TypingIndicator({ provider }: { provider?: string }) {
  const safeP = (provider && provider in PROVIDER_CONFIG) ? provider : "auto";
  const cfg   = PROVIDER_CONFIG[safeP as keyof typeof PROVIDER_CONFIG] ?? PROVIDER_CONFIG.auto;
  const isApex = safeP === "auto";

  return (
    <div className="flex justify-start w-full">
      <div
        style={{
          background: cfg.gradient,
          border: `1px solid ${cfg.border}`,
          borderRadius: "5px 18px 18px 18px",
          padding: "11px 14px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          boxShadow: `0 0 16px ${cfg.glow}`,
        }}
      >
        {isApex ? (
          <ApexLogoMini size={18} state="thinking" />
        ) : null}
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: 7, height: 7, borderRadius: "50%",
                background: cfg.color,
                opacity: 0.75,
                animation: `typing-dot 1.1s ease-in-out ${i * 0.16}s infinite`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Skeleton (shimmer) ────────────────────────────────────────────────────────
export function MessageSkeleton() {
  return (
    <div className="flex justify-start w-full">
      <TypingIndicator />
    </div>
  );
}

// ── Named exports for other components ───────────────────────────────────────
export const providerColors = {
  openai:     "text-[#10a37f] border-[#10a37f]/30 bg-[#10a37f]/5",
  claude:     "text-[#d97757] border-[#d97757]/30 bg-[#d97757]/5",
  perplexity: "text-[#228be6] border-[#228be6]/30 bg-[#228be6]/5",
  hive:       "text-[#be4bdb] border-[#be4bdb]/30 bg-[#be4bdb]/5",
  auto:       "text-muted-foreground border-border bg-card",
};

export const providerAccents = {
  openai: "#10a37f", claude: "#d97757", perplexity: "#228be6", hive: "#be4bdb", auto: "currentColor",
};

export const providerNames = {
  openai: "ChatGPT", claude: "Claude", perplexity: "Perplexity", hive: "Hive Mind", auto: "AI",
};
