import { useState, useRef } from "react";

interface ShareMessageProps {
  message: string;
  score?: number;
  personalityMode?: string;
  contactName?: string;
  onClose: () => void;
}

const PERSONALITY_COLORS: Record<string, string> = {
  smooth: "#8b5cf6",
  funny: "#f59e0b",
  confident: "#ef4444",
  chill: "#10b981",
  romantic: "#ec4899",
  custom: "#6366f1",
};

const PERSONALITY_LABELS: Record<string, string> = {
  smooth: "😎 Smooth",
  funny: "😂 Funny",
  confident: "💪 Confident",
  chill: "🤙 Chill",
  romantic: "💕 Romantic",
  custom: "✨ Custom",
};

export function ShareMessage({ message, score, personalityMode = "smooth", contactName, onClose }: ShareMessageProps) {
  const [copied, setCopied] = useState(false);
  const [withWatermark, setWithWatermark] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);

  const modeColor = PERSONALITY_COLORS[personalityMode] ?? "#8b5cf6";
  const modeLabel = PERSONALITY_LABELS[personalityMode] ?? "✨ AI";

  async function copyToClipboard() {
    const text = withWatermark
      ? `${message}\n\n— Generated with Apex AI`
      : message;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function downloadCard() {
    try {
      const { default: html2canvas } = await import("html2canvas");
      if (!cardRef.current) return;
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: "#0a0a14",
        scale: 2,
      });
      const link = document.createElement("a");
      link.download = "apex-win.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      copyToClipboard();
    }
  }

  const scoreLabel = score != null
    ? score >= 85 ? "🔥 Elite" : score >= 70 ? "✅ Strong" : score >= 55 ? "👍 Good" : "📝 Draft"
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm space-y-3 animate-in slide-in-from-bottom duration-300">
        {/* Branded Card Preview */}
        <div
          ref={cardRef}
          className="rounded-2xl p-5 border"
          style={{
            background: "linear-gradient(135deg, #0d0d1a 0%, #1a0d2e 100%)",
            borderColor: `${modeColor}40`,
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-black font-black text-xs" style={{ background: "#ffcc33" }}>A</div>
              <span className="text-white font-black text-sm tracking-widest">APEX AI</span>
            </div>
            <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: `${modeColor}20`, color: modeColor }}>
              {modeLabel}
            </span>
          </div>

          {/* Message */}
          <div className="bg-white/8 rounded-xl p-4 mb-4 border border-white/10">
            <p className="text-white text-sm leading-relaxed font-medium">"{message}"</p>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {score != null && (
                <div className="flex items-center gap-1.5">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center font-black text-sm" style={{ background: `${modeColor}20`, color: modeColor }}>
                    {score}
                  </div>
                  <div>
                    <p className="text-[9px] text-white/40">Score</p>
                    <p className="text-[10px] font-bold" style={{ color: modeColor }}>{scoreLabel}</p>
                  </div>
                </div>
              )}
              {contactName && (
                <div>
                  <p className="text-[9px] text-white/40">Sent to</p>
                  <p className="text-[10px] text-white/70 font-medium">{contactName}</p>
                </div>
              )}
            </div>
            {withWatermark && (
              <p className="text-[9px] text-white/25 font-medium">apex-ai.app</p>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="bg-[#0d0d1a] rounded-2xl border border-white/10 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-white font-bold text-sm">Share this win</p>
            <button onClick={onClose} className="text-white/40 text-sm hover:text-white">✕</button>
          </div>

          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-white/60 text-xs">Include "Made with Apex" tag</span>
            <button
              onClick={() => setWithWatermark((prev) => !prev)}
              className={`w-10 h-5 rounded-full transition-all relative ${withWatermark ? "bg-[#ffcc33]" : "bg-white/10"}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${withWatermark ? "right-0.5" : "left-0.5"}`} />
            </button>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={copyToClipboard}
              className="py-3 rounded-xl text-sm font-bold border border-white/15 text-white/70 hover:bg-white/5 transition-colors"
            >
              {copied ? "✅ Copied!" : "📋 Copy Text"}
            </button>
            <button
              onClick={downloadCard}
              className="py-3 rounded-xl text-sm font-bold text-black transition-opacity"
              style={{ background: "#ffcc33" }}
            >
              📸 Save Card
            </button>
          </div>

          <p className="text-white/25 text-[10px] text-center">Share on Stories, Notes, or anywhere you want</p>
        </div>
      </div>
    </div>
  );
}
