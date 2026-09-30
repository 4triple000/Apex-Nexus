/**
 * PreviewPane — Live iframe preview of the AI-generated HTML.
 *
 * Renders the preview_html directly in a sandboxed iframe using srcDoc.
 * During generation, shows a detailed step-by-step progress overlay.
 * Exposes Run and Deploy action buttons in the toolbar.
 */

import { useRef, useEffect, useState } from "react";
import type { BuildStep } from "@/pages/ai-studio";

interface PreviewPaneProps {
  html: string;
  isLoading: boolean;
  buildSteps: BuildStep[];
  projectName?: string;
  externalRefreshKey?: number;
  onDownload?: () => void;
  onRun?: () => void;
  onDeploy?: () => void;
}

export function PreviewPane({ html, isLoading, buildSteps, projectName, externalRefreshKey, onDownload, onRun, onDeploy }: PreviewPaneProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [deviceMode, setDeviceMode] = useState<"desktop" | "tablet" | "mobile">("desktop");

  // Refresh when HTML changes
  useEffect(() => {
    setRefreshKey((k) => k + 1);
  }, [html]);

  // Respond to external run triggers
  useEffect(() => {
    if (externalRefreshKey !== undefined && externalRefreshKey > 0) {
      setRefreshKey((k) => k + 1);
    }
  }, [externalRefreshKey]);

  const deviceStyles: Record<typeof deviceMode, React.CSSProperties> = {
    desktop: { width: "100%", height: "100%" },
    tablet: { width: 768, maxWidth: "100%", height: "calc(100% - 20px)", margin: "0 auto" },
    mobile: { width: 390, maxWidth: "100%", height: "calc(100% - 20px)", margin: "0 auto" },
  };

  const activeStep   = buildSteps.find((s) => s.status === "active");
  const doneCount    = buildSteps.filter((s) => s.status === "done").length;
  const totalSteps   = buildSteps.length;
  const progress     = totalSteps > 0 ? Math.round((doneCount / totalSteps) * 100) : 0;
  const showOverlay  = isLoading;

  if (!html && !isLoading) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full text-center gap-4"
        style={{ background: "transparent" }}
      >
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl"
          style={{ background: "#111", border: "1px solid #1C1C1E" }}
        >
          🏗️
        </div>
        <div>
          <h3 className="text-white font-bold text-base mb-1.5">Preview will appear here</h3>
          <p className="text-white/35 text-sm max-w-60 leading-relaxed">
            Describe what you want to build and Apex will generate a live preview instantly.
          </p>
        </div>
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-xl mt-2"
          style={{ background: "rgba(162,155,254,0.06)", border: "1px solid rgba(162,155,254,0.12)" }}
        >
          <span className="text-[#A29BFE] text-xs">⚡</span>
          <span className="text-white/40 text-xs">Powered by GPT-5.2</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col h-full ${isFullscreen ? "fixed inset-0 z-50" : ""}`}
      style={{ background: "transparent" }}
    >
      {/* Preview toolbar */}
      <div
        className="flex items-center gap-2 px-4 py-2.5 flex-shrink-0 border-b"
        style={{ background: "transparent", borderColor: "#1C1C1E" }}
      >
        {/* Browser chrome dots */}
        <div className="flex gap-1.5 flex-shrink-0">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#FF5F56" }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#FEBC2E" }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#28C840" }} />
        </div>

        {/* URL bar / active step */}
        <div
          className="flex-1 px-3 py-1 rounded-lg text-xs truncate mx-2 flex items-center gap-2"
          style={{ background: "rgba(30,26,62,0.62)", border: "1px solid #21262D" }}
        >
          {isLoading && activeStep ? (
            <>
              <div className="w-1.5 h-1.5 rounded-full bg-[#A29BFE] animate-pulse flex-shrink-0" />
              <span className="text-[#A29BFE] font-mono truncate">{activeStep.label}…</span>
            </>
          ) : (
            <span className="text-white/30 font-mono">
              {projectName ? `apex.app — ${projectName}` : "apex.app"}
            </span>
          )}
        </div>

        {/* Device buttons */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {(["desktop", "tablet", "mobile"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setDeviceMode(mode)}
              title={mode}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
              style={{
                background: deviceMode === mode ? "rgba(162,155,254,0.15)" : "transparent",
                color: deviceMode === mode ? "#A29BFE" : "rgba(255,255,255,0.3)",
                border: deviceMode === mode ? "1px solid rgba(162,155,254,0.3)" : "1px solid transparent",
              }}
            >
              {mode === "desktop" ? "🖥" : mode === "tablet" ? "📱" : "📲"}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="w-px h-4 flex-shrink-0" style={{ background: "rgba(30,26,62,0.62)" }} />

        {/* ── Run button ──────────────────────────────────────────────────────── */}
        {onRun && html && !isLoading && (
          <button
            onClick={onRun}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-bold transition-all hover:brightness-110 flex-shrink-0"
            style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)" }}
            title="Re-run the preview"
          >
            <svg width="7" height="8" viewBox="0 0 7 8" fill="currentColor">
              <path d="M0 0L7 4L0 8V0Z" />
            </svg>
            Run
          </button>
        )}

        {/* ── Deploy button ───────────────────────────────────────────────────── */}
        {onDeploy && html && !isLoading && (
          <button
            onClick={onDeploy}
            className="flex items-center gap-1 px-3 py-1 rounded-lg text-[11px] font-bold transition-all hover:brightness-110 flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #A29BFE, #FF8C00)", color: "#000" }}
            title="Deploy your app"
          >
            🚀 Deploy
          </button>
        )}

        {/* Download */}
        {onDownload && !isLoading && (
          <button
            onClick={onDownload}
            title="Download HTML"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white/70 transition-colors text-sm"
          >
            ↓
          </button>
        )}

        {/* Fullscreen */}
        <button
          onClick={() => setIsFullscreen((f) => !f)}
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen preview"}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white/70 transition-colors text-sm"
        >
          {isFullscreen ? "✕" : "⤢"}
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden relative flex items-start" style={{ background: "rgba(30,26,62,0.62)" }}>
        {/* iframe */}
        <div style={{ ...deviceStyles[deviceMode], height: "100%", transition: "width 0.3s ease" }}>
          <iframe
            key={refreshKey}
            ref={iframeRef}
            srcDoc={html}
            title="App Preview"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            className="w-full h-full border-0"
            style={{ background: "#fff", opacity: showOverlay ? 0.15 : 1, transition: "opacity 0.3s" }}
          />
        </div>

        {/* ── Generation overlay ──────────────────────────────────────────── */}
        {showOverlay && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-8"
            style={{ background: "rgba(14,12,32,0.55)" }}
          >
            <div className="relative">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl"
                style={{ background: "rgba(30,26,62,0.62)", border: "1px solid #21262D" }}
              >
                ⚡
              </div>
              <div
                className="absolute -inset-2 rounded-2xl animate-ping"
                style={{ background: "rgba(162,155,254,0.08)", animationDuration: "2s" }}
              />
            </div>

            <div className="text-center">
              <p className="text-white font-bold text-lg mb-1">
                {activeStep?.label ?? "Building your app…"}
              </p>
              <p className="text-white/40 text-sm">
                {activeStep?.detail ?? "Apex is generating your application"}
              </p>
            </div>

            {totalSteps > 0 && (
              <div className="w-full max-w-xs">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-white/30 text-[11px]">Progress</span>
                  <span className="text-[#A29BFE] text-[11px] font-mono font-bold">{progress}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(30,26,62,0.62)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${progress}%`,
                      background: "linear-gradient(90deg, #A29BFE, #FF8C00)",
                    }}
                  />
                </div>
              </div>
            )}

            {buildSteps.length > 0 && (
              <div className="w-full max-w-xs space-y-2">
                {buildSteps.map((step) => (
                  <OverlayStepRow key={step.id} step={step} />
                ))}
              </div>
            )}

            <p className="text-white/20 text-[11px] text-center max-w-48">
              AI is writing code, designing the UI, and building a live preview — this takes about 30 seconds.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Overlay step row (compact) ─────────────────────────────────────────────────

function OverlayStepRow({ step }: { step: BuildStep }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-shrink-0 w-5 flex items-center justify-center">
        {step.status === "done" && (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" fill="rgba(34,197,94,0.15)" />
            <path d="M4 7L6 9L10 5" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {step.status === "active" && (
          <div
            className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "rgba(162,155,254,0.3)", borderTopColor: "#A29BFE" }}
          />
        )}
        {step.status === "pending" && (
          <div className="w-3.5 h-3.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
        )}
        {step.status === "error" && (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" fill="rgba(239,68,68,0.15)" />
            <path d="M5 5L9 9M9 5L5 9" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
      </div>

      <span
        className="text-[12px] font-medium flex-1"
        style={{
          color:
            step.status === "done"   ? "#4ade80" :
            step.status === "active" ? "#A29BFE" :
            step.status === "error"  ? "#f87171" :
            "rgba(255,255,255,0.25)",
        }}
      >
        {step.label}
      </span>

      {step.status === "active" && (
        <div className="w-1.5 h-1.5 rounded-full bg-[#A29BFE] animate-pulse flex-shrink-0" />
      )}
    </div>
  );
}
