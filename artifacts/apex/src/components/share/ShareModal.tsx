/**
 * ShareModal — bottom-sheet modal for sharing an Apex AI response.
 *
 * Renders the ShareCard, auto-generates a PNG on mount, then shows:
 *   • Live card preview
 *   • Copy Image  (ClipboardItem)
 *   • Download    (PNG file)
 *   • Share       (Web Share API → falls back to download on desktop)
 *
 * Usage:
 *   <ShareModal
 *     prompt="How should I grow my app?"
 *     response="You need a viral loop…"
 *     provider="openai"
 *     onClose={() => setShow(false)}
 *   />
 */
import { useRef, useEffect } from "react";
import { X, Download, Copy, CheckCheck, Share2, Loader2 } from "lucide-react";
import { usePersonality } from "@/contexts/PersonalityContext";
import { useShareCard }   from "@/hooks/useShareCard";
import { ShareCard }      from "./ShareCard";
import { PROVIDER_CONFIG } from "@/components/chat/message-bubble";

interface ShareModalProps {
  prompt?:       string;
  response:      string;
  provider?:     string;
  responseTime?: number;
  context?:      "chat" | "dm" | "battle";
  onClose:       () => void;
}

const IOS    = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";
const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

const PERSONALITY_LABELS: Record<string, string> = {
  friend:     "Casual Mode",
  strategist: "Strategist Mode",
  innovator:  "Creative Mode",
  mentor:     "Mentor Mode",
  debater:    "Debater Mode",
};

export function ShareModal({ prompt, response, provider, responseTime, context = "chat", onClose }: ShareModalProps) {
  const { personalityId } = usePersonality();
  const cardRef = useRef<HTMLDivElement>(null);
  const { status, dataUrl, generateImage, copyAsImage, downloadImage, nativeShare } = useShareCard();

  const safeProvider = provider && provider in PROVIDER_CONFIG ? provider : "auto";
  const cfg          = PROVIDER_CONFIG[safeProvider];

  const personalityTag = personalityId ? PERSONALITY_LABELS[personalityId] ?? undefined : undefined;

  // Auto-generate the card image as soon as the modal mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      if (cardRef.current) generateImage(cardRef.current);
    }, 120); // tiny delay so paint is complete
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const shareText = `"${response.slice(0, 140)}…"\n\n— Apex AI (${cfg.name})\napex.app`;

  const isGenerating = status === "generating" || status === "idle";
  const isCopied     = status === "copied";

  return (
    <>
      {/* ── CSS ────────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes share-backdrop-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes share-sheet-in {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes share-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        .share-action-btn:hover {
          opacity: 0.85;
          transform: scale(1.03);
        }
        .share-action-btn:active {
          transform: scale(0.95);
        }
      `}</style>

      {/* ── Backdrop ─────────────────────────────────────────────────── */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 99990,
          background: "rgba(0,0,0,0.75)",
          backdropFilter: "blur(8px)",
          animation: "share-backdrop-in 0.2s ease both",
        }}
      />

      {/* ── Bottom sheet ─────────────────────────────────────────────── */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        zIndex: 99991,
        padding: "0 0 max(env(safe-area-inset-bottom, 0px), 12px)",
        display: "flex", flexDirection: "column", alignItems: "center",
        animation: `share-sheet-in 0.34s ${SPRING} both`,
      }}>
        <div style={{
          width: "100%", maxWidth: 480,
          background: "#10121D",
          borderRadius: "28px 28px 0 0",
          border: "1px solid rgba(255,255,255,0.08)",
          borderBottom: "none",
          overflow: "hidden",
          boxShadow: "0 -8px 48px rgba(0,0,0,0.60)",
        }}>

          {/* Header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "18px 20px 4px",
          }}>
            <div>
              <p style={{ fontSize: 16, fontWeight: 800, color: "#fff", margin: 0 }}>
                Share this{context === "battle" ? " battle result" : " response"}
              </p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.30)", margin: "3px 0 0" }}>
                Powered by Apex · apex.app
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                width: 32, height: 32, borderRadius: "50%",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.10)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
                transition: `all 0.15s ${IOS}`,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
            >
              <X style={{ width: 14, height: 14, color: "rgba(255,255,255,0.55)" }} />
            </button>
          </div>

          {/* ── Card preview area ──────────────────────────────────────── */}
          <div style={{
            padding: "16px 20px",
            display: "flex", flexDirection: "column", alignItems: "center",
            position: "relative",
          }}>
            {/* Live card (source for html2canvas + visual preview) */}
            <div style={{
              width: "100%", maxWidth: 380,
              borderRadius: 20,
              overflow: "hidden",
              boxShadow: "0 8px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.07)",
              transform: "scale(0.96)",
              transformOrigin: "top center",
            }}>
              <ShareCard
                ref={cardRef}
                prompt={prompt}
                response={response}
                providerName={cfg.name}
                providerColor={cfg.color}
                personalityTag={personalityTag}
                responseTime={responseTime}
                context={context}
              />
            </div>

            {/* Generating overlay */}
            {isGenerating && (
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "rgba(7,8,14,0.60)",
                borderRadius: 20,
                backdropFilter: "blur(4px)",
              }}>
                <div style={{ textAlign: "center" }}>
                  <Loader2 style={{
                    width: 22, height: 22, color: "#A29BFE",
                    animation: "share-spin 0.9s linear infinite",
                    margin: "0 auto 8px",
                  }} />
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", margin: 0 }}>
                    Generating card…
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── Action buttons ─────────────────────────────────────────── */}
          <div style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 10 }}>

            {/* Primary row: Copy Image + Download */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>

              {/* Copy as image */}
              <button
                className="share-action-btn"
                disabled={!dataUrl || isGenerating}
                onClick={() => dataUrl && copyAsImage(dataUrl)}
                style={{
                  padding: "14px 8px",
                  borderRadius: 16,
                  background: isCopied
                    ? "rgba(74,222,128,0.12)"
                    : "rgba(162,155,254,0.10)",
                  border: `1px solid ${isCopied ? "rgba(74,222,128,0.30)" : "rgba(162,155,254,0.22)"}`,
                  display: "flex", flexDirection: "column",
                  alignItems: "center", gap: 7,
                  cursor: dataUrl ? "pointer" : "not-allowed",
                  opacity: dataUrl && !isGenerating ? 1 : 0.45,
                  transition: `all 0.22s ${SPRING}`,
                }}
              >
                {isCopied
                  ? <CheckCheck style={{ width: 18, height: 18, color: "#4ADE80" }} />
                  : <Copy style={{ width: 18, height: 18, color: "#A29BFE" }} />}
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  color: isCopied ? "#4ADE80" : "#A29BFE",
                  letterSpacing: "0.02em",
                }}>
                  {isCopied ? "Copied!" : "Copy Image"}
                </span>
              </button>

              {/* Download */}
              <button
                className="share-action-btn"
                disabled={!dataUrl || isGenerating}
                onClick={() => dataUrl && downloadImage(dataUrl, `apex-${context}-${Date.now()}.png`)}
                style={{
                  padding: "14px 8px",
                  borderRadius: 16,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", gap: 7,
                  cursor: dataUrl ? "pointer" : "not-allowed",
                  opacity: dataUrl && !isGenerating ? 1 : 0.45,
                  transition: `all 0.22s ${SPRING}`,
                }}
              >
                <Download style={{ width: 18, height: 18, color: "rgba(255,255,255,0.60)" }} />
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  color: "rgba(255,255,255,0.60)",
                  letterSpacing: "0.02em",
                }}>
                  Download
                </span>
              </button>
            </div>

            {/* Native Share (full-width) */}
            <button
              className="share-action-btn"
              disabled={!dataUrl || isGenerating}
              onClick={() => dataUrl && nativeShare(dataUrl, shareText)}
              style={{
                width: "100%", padding: "16px",
                borderRadius: 16,
                background: "linear-gradient(135deg, #6C5CE7, #A29BFE 55%, #FD79A8)",
                border: "none",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
                cursor: dataUrl ? "pointer" : "not-allowed",
                opacity: dataUrl && !isGenerating ? 1 : 0.45,
                transition: `all 0.22s ${SPRING}`,
              }}
            >
              <Share2 style={{ width: 16, height: 16, color: "#fff" }} />
              <span style={{
                fontSize: 14, fontWeight: 800, color: "#fff",
                letterSpacing: "0.01em",
              }}>
                Share
              </span>
            </button>

            {/* Micro caption */}
            <p style={{
              fontSize: 10, color: "rgba(255,255,255,0.18)",
              textAlign: "center", margin: 0,
              letterSpacing: "0.02em",
            }}>
              Every share helps grow Apex · apex.app
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
