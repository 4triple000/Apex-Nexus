import { useState, useEffect } from "react";
import { useApexState } from "@/contexts/ApexStateContext";
import ApexArc from "./ApexArc";
import ApexOverlay from "./ApexOverlay";

// ─── Mode type shared by all Apex sub-components ───────────────────────────────
export type ApexEdgeMode = "idle" | "listening" | "thinking" | "active";

// ─── Sync map: ApexState → ApexEdgeMode ───────────────────────────────────────
const STATE_TO_MODE: Record<string, ApexEdgeMode> = {
  idle:       "idle",
  listening:  "listening",
  thinking:   "thinking",
  responding: "active",
  active:     "active",
};

// ═══════════════════════════════════════════════════════════════════════════════
// APEX CORE — orchestrates Arc + Overlay + Blob
// ═══════════════════════════════════════════════════════════════════════════════
export function ApexCore() {
  const { state, setState } = useApexState();
  const [mode, setMode]     = useState<ApexEdgeMode>("idle");

  // Keep mode in sync with global apex state
  useEffect(() => {
    const mapped = STATE_TO_MODE[state] ?? "idle";
    setMode(mapped);
  }, [state]);

  // Write back to global state when user taps
  const handleSetMode = (m: ApexEdgeMode) => {
    setMode(m);
    if (m === "idle")      setState("idle");
    if (m === "listening") setState("listening");
    if (m === "thinking")  setState("thinking");
    if (m === "active")    setState("active");
  };

  return (
    <>
      <ApexArc     mode={mode} setMode={handleSetMode} />
      <ApexOverlay mode={mode} setMode={handleSetMode} />
    </>
  );
}
