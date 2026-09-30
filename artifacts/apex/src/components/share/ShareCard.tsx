/**
 * ShareCard — the beautiful branded card that gets captured to PNG.
 *
 * Rendered off-screen (opacity 0, pointer-events none, position absolute)
 * and captured by html2canvas. All styles are inline — NO Tailwind — to ensure
 * correct rendering in the canvas capture.
 *
 * Props:
 *   prompt         — user's question (optional)
 *   response       — AI response text (truncated to ~320 chars automatically)
 *   providerName   — "ChatGPT" | "Claude" | "Perplexity" | "Hive Mind" | "Apex AI"
 *   providerColor  — hex accent colour for the AI badge
 *   personalityTag — "Strategist Mode" | "Casual Mode" | etc.
 *   responseTime   — in ms (optional)
 *   context        — "chat" | "dm" | "battle" — tweaks label copy
 */
import { forwardRef } from "react";
import { PROVIDER_CONFIG } from "@/components/chat/message-bubble";

interface ShareCardProps {
  prompt?:        string;
  response:       string;
  providerName?:  string;
  providerColor?: string;
  personalityTag?: string;
  responseTime?:  number;
  context?:       "chat" | "dm" | "battle";
}

const TRUNCATE = 320;

function truncate(str: string, max: number) {
  if (str.length <= max) return str;
  return str.slice(0, max).trimEnd() + "…";
}

function getProviderInfo(providerName?: string, providerColor?: string) {
  if (!providerName) return { name: "Apex AI", color: "#A29BFE" };
  // Try to match from PROVIDER_CONFIG by name
  const entry = Object.values(PROVIDER_CONFIG).find(
    (c) => c.name.toLowerCase() === providerName.toLowerCase()
  );
  return {
    name:  entry?.name  ?? providerName,
    color: entry?.color ?? providerColor ?? "#A29BFE",
  };
}

// ── Visual card (inline styles only for correct html2canvas rendering) ─────────

export const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(function ShareCard(
  { prompt, response, providerName, providerColor, personalityTag, responseTime, context = "chat" },
  ref
) {
  const provider = getProviderInfo(providerName, providerColor);
  const snippetText = truncate(response, TRUNCATE);

  const contextLabel = context === "battle" ? "Battle Arena" : context === "dm" ? "DM" : "Chat";

  return (
    <div
      ref={ref}
      style={{
        width: 380,
        background: "linear-gradient(180deg, rgba(34,29,70,0.94), rgba(16,13,38,0.95))",
        borderRadius: 20,
        overflow: "hidden",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        border: "1px solid rgba(162,155,254,0.15)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.80), 0 0 0 1px rgba(162,155,254,0.08)",
      }}
    >
      {/* ── Gradient header bar ─────────────────────────────────────────── */}
      <div style={{
        background: "linear-gradient(135deg, #6C5CE7 0%, #A29BFE 52%, #FD79A8 100%)",
        padding: "12px 18px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        {/* Logo + wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 9,
            background: "rgba(255,255,255,0.22)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, color: "#fff",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35)",
          }}>
            ◆
          </div>
          <span style={{
            fontSize: 14, fontWeight: 900, color: "#fff",
            letterSpacing: "0.06em", textTransform: "uppercase",
          }}>
            Apex
          </span>
        </div>

        {/* Personality / context tag */}
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
        }}>
          {personalityTag && (
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: "0.07em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.90)",
              background: "rgba(255,255,255,0.18)",
              padding: "3px 9px", borderRadius: 99,
              border: "1px solid rgba(255,255,255,0.22)",
            }}>
              {personalityTag}
            </span>
          )}
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: "0.07em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.55)",
            background: "rgba(0,0,0,0.20)",
            padding: "3px 8px", borderRadius: 99,
          }}>
            {contextLabel}
          </span>
        </div>
      </div>

      {/* ── Card body ───────────────────────────────────────────────────── */}
      <div style={{ padding: "18px 18px 14px" }}>

        {/* User prompt (optional) */}
        {prompt && prompt.trim().length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{
              fontSize: 9, fontWeight: 800, letterSpacing: "0.11em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.28)",
              marginBottom: 8,
            }}>
              You asked
            </div>
            <div style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 12,
              padding: "10px 13px",
            }}>
              <p style={{
                fontSize: 13, lineHeight: 1.55, color: "rgba(255,255,255,0.65)",
                fontStyle: "italic", margin: 0,
              }}>
                "{truncate(prompt, 120)}"
              </p>
            </div>
          </div>
        )}

        {/* Divider when both sections present */}
        {prompt && (
          <div style={{
            height: 1,
            background: "linear-gradient(90deg, rgba(162,155,254,0.20), transparent)",
            marginBottom: 14,
          }} />
        )}

        {/* AI Response */}
        <div style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 9, fontWeight: 800, letterSpacing: "0.11em",
            textTransform: "uppercase",
            color: provider.color + "CC",
            marginBottom: 8,
          }}>
            {provider.name} says
          </div>
          <p style={{
            fontSize: 14, lineHeight: 1.68, color: "rgba(255,255,255,0.90)",
            margin: 0, whiteSpace: "pre-wrap",
          }}>
            "{snippetText}"
          </p>
        </div>

        {/* Footer divider */}
        <div style={{
          height: 1,
          background: "linear-gradient(90deg, rgba(255,255,255,0.06), transparent)",
          marginBottom: 12,
        }} />

        {/* Footer row: provider badge + watermark */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          {/* Provider badge */}
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <div style={{
              width: 7, height: 7, borderRadius: "50%",
              background: provider.color,
              boxShadow: `0 0 8px ${provider.color}88`,
            }} />
            <span style={{
              fontSize: 10, fontWeight: 700, color: provider.color,
              letterSpacing: "0.06em", textTransform: "uppercase",
            }}>
              {provider.name}
            </span>
            {responseTime !== undefined && (
              <span style={{
                fontSize: 9, color: "rgba(255,255,255,0.22)",
              }}>
                · {(responseTime / 1000).toFixed(2)}s
              </span>
            )}
          </div>

          {/* Watermark */}
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{
              fontSize: 9, color: "rgba(255,255,255,0.20)",
              fontWeight: 600, letterSpacing: "0.05em",
            }}>
              apex.app
            </span>
            <span style={{ fontSize: 10, color: "rgba(162,155,254,0.35)" }}>◆</span>
          </div>
        </div>
      </div>
    </div>
  );
});
