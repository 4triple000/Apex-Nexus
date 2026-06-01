/**
 * ╔════════════════════════════════════════════════════╗
 * ║  APEX DEV COCKPIT                                  ║
 * ║  Build, edit, and deploy Apex from inside Apex     ║
 * ║  3-panel layout: File Tree | Code Editor | AI      ║
 * ╚════════════════════════════════════════════════════╝
 */
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useLocation, Link } from "wouter";

// ── Constants ─────────────────────────────────────────────────────────────────
const DEV_KEY  = "apex-dev-2024";
const BASE_URL = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
const API      = `${BASE_URL}/api`;

// ── Types ─────────────────────────────────────────────────────────────────────
interface FileNode {
  name:     string;
  type:     "file" | "dir";
  path:     string;
  children?: FileNode[];
}

interface PlanFile {
  path:        string;
  action:      "create" | "modify";
  description: string;
  code:        string;
}

interface Plan {
  feature:     string;
  description: string;
  complexity:  string;
  files:       PlanFile[];
  risks:       string[];
}

interface Snapshot {
  id:        string;
  label:     string;
  timestamp: number;
}

// ── Root selector options ─────────────────────────────────────────────────────
const ROOTS = [
  { id: "apex",   label: "apex/src",        icon: "⚡" },
  { id: "pages",  label: "pages",           icon: "📄" },
  { id: "comps",  label: "components",      icon: "🧩" },
  { id: "api",    label: "api-server/src",  icon: "🔌" },
  { id: "routes", label: "routes",          icon: "🛤" },
];

// ── Colour helpers ─────────────────────────────────────────────────────────────
const EXT_COLOR: Record<string, string> = {
  tsx: "#61AFEF", ts: "#61AFEF", jsx: "#E5C07B", js: "#E5C07B",
  css: "#98C379", json: "#D19A66", md: "#ABB2BF", sql: "#C678DD",
};
function fileColor(name: string) {
  const ext = name.split(".").pop() ?? "";
  return EXT_COLOR[ext] ?? "#ABB2BF";
}

// ─────────────────────────────────────────────────────────────────────────────
// File Tree Node
// ─────────────────────────────────────────────────────────────────────────────
function TreeNode({
  node, depth = 0, selected, onSelect,
}: {
  node: FileNode; depth?: number; selected: string; onSelect: (path: string) => void;
}) {
  const [open, setOpen] = useState(depth < 2);
  const isSelected = node.path === selected;
  const indent = depth * 14;

  if (node.type === "dir") {
    return (
      <div>
        <div
          onClick={() => setOpen(v => !v)}
          style={{
            paddingLeft: 10 + indent, paddingRight: 8, paddingTop: 3, paddingBottom: 3,
            display: "flex", alignItems: "center", gap: 5, cursor: "pointer",
            color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: 500,
            userSelect: "none",
            borderRadius: 4,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        >
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", minWidth: 10 }}>
            {open ? "▾" : "▸"}
          </span>
          <span style={{ fontSize: 13 }}>📁</span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {node.name}
          </span>
        </div>
        {open && node.children?.map(child => (
          <TreeNode key={child.path} node={child} depth={depth + 1} selected={selected} onSelect={onSelect} />
        ))}
      </div>
    );
  }

  return (
    <div
      onClick={() => onSelect(node.path)}
      style={{
        paddingLeft: 10 + indent, paddingRight: 8, paddingTop: 3, paddingBottom: 3,
        display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
        background: isSelected ? "rgba(97,175,239,0.12)" : "transparent",
        borderLeft: isSelected ? "2px solid #61AFEF" : "2px solid transparent",
        borderRadius: 4, fontSize: 12,
        color: isSelected ? fileColor(node.name) : "rgba(255,255,255,0.50)",
        fontWeight: isSelected ? 600 : 400,
        transition: "all 0.12s",
        userSelect: "none",
      }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
    >
      <span style={{ color: fileColor(node.name), fontSize: 12, minWidth: 14 }}>●</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{node.name}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Code Editor with line numbers
// ─────────────────────────────────────────────────────────────────────────────
function CodeEditor({
  content, onChange, readOnly = false,
}: {
  content: string; onChange?: (v: string) => void; readOnly?: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNosRef  = useRef<HTMLDivElement>(null);
  const lines = content.split("\n");

  const syncScroll = () => {
    if (textareaRef.current && lineNosRef.current) {
      lineNosRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const handleTab = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const ta  = e.currentTarget;
      const s   = ta.selectionStart;
      const end = ta.selectionEnd;
      const v   = ta.value;
      const next = v.slice(0, s) + "  " + v.slice(end);
      onChange?.(next);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = s + 2;
      });
    }
  };

  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative" }}>
      {/* Line numbers */}
      <div
        ref={lineNosRef}
        style={{
          width: 48, flexShrink: 0, overflowY: "hidden",
          background: "#0D1117", borderRight: "1px solid rgba(255,255,255,0.06)",
          paddingTop: 14, paddingBottom: 14, userSelect: "none",
          fontFamily: "'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace",
          fontSize: 12, lineHeight: "20px", color: "rgba(255,255,255,0.18)",
          textAlign: "right", paddingRight: 10,
        }}
      >
        {lines.map((_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>

      {/* Editor textarea */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={e => onChange?.(e.target.value)}
        onKeyDown={handleTab}
        onScroll={syncScroll}
        readOnly={readOnly}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        style={{
          flex: 1, resize: "none", border: "none", outline: "none",
          background: "#0D1117", color: "#ABB2BF",
          fontFamily: "'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace",
          fontSize: 12, lineHeight: "20px",
          padding: "14px 16px", overflowY: "auto",
          caretColor: "#61AFEF",
          cursor: readOnly ? "default" : "text",
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Console
// ─────────────────────────────────────────────────────────────────────────────
function AIConsole({
  currentFile,
  currentContent,
  onApplySuccess,
}: {
  currentFile: string;
  currentContent: string;
  onApplySuccess: (path: string) => void;
}) {
  const [prompt, setPrompt]         = useState("");
  const [plan, setPlan]             = useState<Plan | null>(null);
  const [status, setStatus]         = useState<"idle" | "planning" | "applying" | "done" | "error">("idle");
  const [msg, setMsg]               = useState("");
  const [snapshots, setSnapshots]   = useState<Snapshot[]>([]);
  const [snapsTab, setSnapsTab]     = useState(false);
  const [expandedFile, setExpandedFile] = useState<number | null>(null);
  const [appliedPaths, setAppliedPaths] = useState<string[]>([]);
  const [gameMode, setGameMode]     = useState(false);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  // ── Whole-game context string injected into the prompt when gameMode = true ─
  const GAME_CONTEXT = `WHOLE-GAME CHANGE REQUEST — apply coordinated edits across all relevant Neon Warzone files. Always send COMPLETE file contents for every modified file (full replacement, not snippets).

Key game files for Neon Warzone:
• artifacts/apex/src/engine/demoGames.ts      — PRIMARY CONFIG: Neon Warzone definition (enemy count=8, player speed=7, health=100, background="#070a14"). Edit this for base stats.
• artifacts/apex/src/engine3d/ai.ts           — enemy AI: patrol speed, detection range, attack timing, movement patterns
• artifacts/apex/src/engine3d/weapons.ts      — all weapons: damage, fire rate, reload time, magazine size, bullet speed
• artifacts/apex/src/engine3d/waves.ts        — wave system: enemy count per wave, spawn pacing, difficulty scaling
• artifacts/apex/src/engine3d/player.ts       — player movement, sprint speed, jump, health regen rate
• artifacts/apex/src/engine3d/CombatFeel.ts   — recoil strength, screen shake, aim assist, crosshair spread
• artifacts/apex/src/components/game/FPSCanvas.tsx — main 3D game loop, scoring, HUD elements, spawn logic

User request: `;

  // ── Derive which game pages are relevant to the applied files ─────────────
  const testLinks = useMemo((): Array<{ label: string; path: string; icon: string }> => {
    if (!appliedPaths.length) return [];
    const joined = appliedPaths.join(" ").toLowerCase();
    const links: Array<{ label: string; path: string; icon: string }> = [];
    // FPS / Neon Warzone files — link directly into the game
    if (/fps|shooting|shoot|enemy|ai\.ts|weapon|wave|player|demogames|combatfeel|fpscanvas/.test(joined))
      links.push({ label: "Neon Warzone", path: "/game-engine?launch=Neon+Warzone", icon: "🎯" });
    if (/openworld|gta|open.world|vehicle|world\.ts/.test(joined))
      links.push({ label: "Open World", path: "/game-engine?launch=Neon+City", icon: "🌆" });
    if (/basketball|platformer|shooter/.test(joined))
      links.push({ label: "Games Hub", path: "/game-engine", icon: "🎮" });
    if (/home|feed|social/.test(joined))
      links.push({ label: "Home", path: "/", icon: "🏠" });
    if (/marketplace/.test(joined))
      links.push({ label: "Marketplace", path: "/marketplace", icon: "🛒" });
    if (/studio/.test(joined))
      links.push({ label: "Studio", path: "/studio", icon: "🎬" });
    // Always show game engine as fallback for game-related files
    if (!links.length && /game|canvas|hud|engine/.test(joined))
      links.push({ label: "Neon Warzone", path: "/game-engine?launch=Neon+Warzone", icon: "🎯" });
    // Generic fallback
    if (!links.length)
      links.push({ label: "Home", path: "/", icon: "🏠" });
    return links;
  }, [appliedPaths]);

  const loadSnapshots = useCallback(async () => {
    try {
      const r = await fetch(`${API}/builder/snapshots?key=${DEV_KEY}`);
      const d = await r.json() as { snapshots: Snapshot[] };
      setSnapshots(d.snapshots ?? []);
    } catch { /* silently fail */ }
  }, []);

  useEffect(() => { void loadSnapshots(); }, [loadSnapshots]);

  const handlePlan = async () => {
    if (!prompt.trim()) return;
    setStatus("planning");
    setMsg("Thinking…");
    setPlan(null);
    try {
      let finalPrompt: string;
      if (gameMode) {
        // Whole-game mode: inject full game file map, skip single-file context
        finalPrompt = GAME_CONTEXT + prompt;
      } else {
        const contextPart = currentFile
          ? `\n\nCurrent open file: ${currentFile}\nFirst 200 lines:\n${currentContent.split("\n").slice(0, 200).join("\n")}`
          : "";
        finalPrompt = prompt + contextPart;
      }

      const r = await fetch(`${API}/builder/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: finalPrompt, devMode: true }),
      });
      const d = await r.json() as { plan: Plan; offline?: boolean };
      setPlan(d.plan);
      setStatus("idle");
      setMsg(d.offline ? "⚠ AI offline — placeholder plan" : "");
    } catch {
      setStatus("error");
      setMsg("Failed to connect to AI");
    }
  };

  const handleApply = async () => {
    if (!plan) return;
    setStatus("applying");
    setMsg("Applying changes…");
    try {
      const r = await fetch(`${API}/builder/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: DEV_KEY, plan }),
      });
      const d = await r.json() as { success: boolean; results: Array<{ path: string; status: string }> };
      if (d.success) {
        setStatus("done");
        setMsg(`✓ Applied ${d.results.length} file(s) — Vite HMR is reloading`);
        const paths = d.results.map(r => r.path);
        setAppliedPaths(paths);
        // Reload the first modified file into the editor
        const firstFile = d.results[0];
        if (firstFile) onApplySuccess(firstFile.path);
        setPlan(null);
        setPrompt("");
        void loadSnapshots();
      } else {
        setStatus("error");
        const errs = d.results.filter(r => r.status === "error").map(r => r.path).join(", ");
        setMsg(`Errors in: ${errs}`);
      }
    } catch {
      setStatus("error");
      setMsg("Apply failed — check server");
    }
  };

  const handleRollback = async (snapshotId: string) => {
    setMsg("Rolling back…");
    try {
      await fetch(`${API}/builder/rollback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: DEV_KEY, snapshotId }),
      });
      setMsg("✓ Rolled back — Vite HMR reloading");
      void loadSnapshots();
    } catch { setMsg("Rollback failed"); }
  };

  const statusColor = { idle: "#ABB2BF", planning: "#61AFEF", applying: "#D19A66", done: "#98C379", error: "#E06C75" };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: 16, gap: 12 }}>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        {["AI Builder", "Snapshots"].map((t, i) => (
          <button
            key={t}
            onClick={() => setSnapsTab(i === 1)}
            style={{
              padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 700,
              cursor: "pointer", border: "none", letterSpacing: "0.03em",
              background: snapsTab === (i === 1) ? "rgba(97,175,239,0.15)" : "transparent",
              color: snapsTab === (i === 1) ? "#61AFEF" : "rgba(255,255,255,0.35)",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {!snapsTab ? (
        <>
          {/* ── How to use guide ──────────────────────────────────────────── */}
          {status === "idle" && !plan && (
            <div style={{
              padding: "10px 12px", borderRadius: 8, flexShrink: 0,
              background: "rgba(97,175,239,0.05)", border: "1px solid rgba(97,175,239,0.12)",
            }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#61AFEF", letterSpacing: "0.08em", marginBottom: 6 }}>
                HOW TO USE THIS BUILDER
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {[
                  ["1", "Pick a file", "Click a file in the left tree (e.g. engine3d/ai.ts for enemies)"],
                  ["2", "Describe a change", "Type what you want in the box below, then click Generate Plan"],
                  ["3", "Review & Apply", "Check the plan, then hit Apply Changes"],
                  ["4", "Test it", "Use the \"Go to…\" link that appears — navigate away and back to restart the game loop"],
                ].map(([num, title, desc]) => (
                  <div key={num} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <div style={{
                      width: 16, height: 16, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                      background: "rgba(97,175,239,0.2)", border: "1px solid rgba(97,175,239,0.3)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 8, fontWeight: 900, color: "#61AFEF",
                    }}>{num}</div>
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>{title} — </span>
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.32)" }}>{desc}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 8, fontSize: 10, color: "rgba(255,255,255,0.22)", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 7 }}>
                Key game files: <span style={{ color: "rgba(97,175,239,0.6)" }}>engine3d/ai.ts</span> (enemies) · <span style={{ color: "rgba(97,175,239,0.6)" }}>engine3d/weapons.ts</span> (guns) · <span style={{ color: "rgba(97,175,239,0.6)" }}>engine3d/waves.ts</span> (wave config) · <span style={{ color: "rgba(97,175,239,0.6)" }}>components/game/FPSCanvas.tsx</span> (game logic)
              </div>
            </div>
          )}

          {/* Whole-Game / Single-File mode toggle */}
          <div style={{
            flexShrink: 0, display: "flex", gap: 6, marginBottom: 2,
          }}>
            <button
              onClick={() => setGameMode(false)}
              style={{
                flex: 1, padding: "7px 0", borderRadius: 7, fontSize: 11, fontWeight: 700,
                cursor: "pointer", border: "none",
                background: !gameMode ? "rgba(97,175,239,0.22)" : "rgba(255,255,255,0.05)",
                color: !gameMode ? "#61AFEF" : "rgba(255,255,255,0.30)",
                transition: "all 0.15s",
              }}
            >
              📄 Single File
            </button>
            <button
              onClick={() => setGameMode(true)}
              style={{
                flex: 1, padding: "7px 0", borderRadius: 7, fontSize: 11, fontWeight: 700,
                cursor: "pointer", border: "none",
                background: gameMode ? "rgba(253,121,168,0.22)" : "rgba(255,255,255,0.05)",
                color: gameMode ? "#FD79A8" : "rgba(255,255,255,0.30)",
                transition: "all 0.15s",
              }}
            >
              🎮 Whole Game
            </button>
          </div>
          {gameMode && (
            <div style={{
              padding: "7px 10px", borderRadius: 7, marginBottom: 4,
              background: "rgba(253,121,168,0.07)", border: "1px solid rgba(253,121,168,0.18)",
              fontSize: 10, color: "rgba(253,121,168,0.75)", lineHeight: 1.5,
            }}>
              AI sees all game files — enemies, weapons, waves, player, HUD. Describe any game-wide change and it will update the right files.
            </div>
          )}

          {/* Prompt area */}
          <div style={{ flexShrink: 0 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 6, fontWeight: 600 }}>
              DESCRIBE A CHANGE
            </div>
            <textarea
              ref={promptRef}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handlePlan(); }}
              placeholder={
                gameMode
                  ? `e.g. "Make all enemies twice as fast and double weapon damage" or "Add a shotgun as the starting weapon"`
                  : currentFile
                    ? `e.g. "Make enemies patrol faster" or "Double the wave enemy count"`
                    : `Select a file from the left tree first, then describe your change`
              }
              rows={4}
              style={{
                width: "100%", resize: "none", boxSizing: "border-box",
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8, padding: "10px 12px", color: "#ABB2BF", fontSize: 12,
                fontFamily: "system-ui, -apple-system, sans-serif", lineHeight: 1.5,
                outline: "none",
              }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.18)" }}>⌘+Enter to plan</span>
              <button
                onClick={handlePlan}
                disabled={status === "planning" || !prompt.trim()}
                style={{
                  padding: "7px 16px", borderRadius: 6, fontSize: 12, fontWeight: 700,
                  cursor: status === "planning" || !prompt.trim() ? "not-allowed" : "pointer",
                  border: "none",
                  background: status === "planning" ? "rgba(97,175,239,0.15)" : "rgba(97,175,239,0.25)",
                  color: "#61AFEF",
                  opacity: !prompt.trim() ? 0.4 : 1,
                  transition: "all 0.15s",
                }}
              >
                {status === "planning" ? "Planning…" : "Generate Plan →"}
              </button>
            </div>
          </div>

          {/* Status message */}
          {msg && (
            <div style={{
              padding: "8px 12px", borderRadius: 6, fontSize: 11,
              background: "rgba(255,255,255,0.04)", border: `1px solid ${statusColor[status]}44`,
              color: statusColor[status], flexShrink: 0,
            }}>
              {msg}
            </div>
          )}

          {/* ── Test Changes card — shown after successful apply ─────────── */}
          {status === "done" && testLinks.length > 0 && (
            <div style={{
              borderRadius: 10, border: "1px solid rgba(152,195,121,0.25)",
              background: "rgba(152,195,121,0.05)",
              padding: "12px 14px", flexShrink: 0,
            }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#98C379", letterSpacing: "0.08em", marginBottom: 8 }}>
                WHERE TO TEST YOUR CHANGES
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                {testLinks.map((lnk) => (
                  <Link key={lnk.path} href={lnk.path}>
                    <a style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700,
                      background: "rgba(152,195,121,0.18)",
                      border: "1px solid rgba(152,195,121,0.35)",
                      color: "#98C379", cursor: "pointer",
                      textDecoration: "none",
                    }}>
                      <span>{lnk.icon}</span>
                      <span>Go to {lnk.label} →</span>
                    </a>
                  </Link>
                ))}
              </div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.28)", lineHeight: 1.5 }}>
                Vite auto-reloaded the changed files. Navigate to the game, play it, and your changes should be live. If nothing looks different, try navigating away and back — the game engine needs to restart its loop.
              </div>
              <button
                onClick={() => { setStatus("idle"); setMsg(""); setAppliedPaths([]); }}
                style={{
                  marginTop: 10, padding: "5px 12px", borderRadius: 6,
                  fontSize: 10, fontWeight: 700, cursor: "pointer",
                  background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.35)",
                }}
              >
                Make another change
              </button>
            </div>
          )}

          {/* Plan preview */}
          {plan && (
            <div style={{
              flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 10,
            }}>
              {/* Feature header */}
              <div style={{
                padding: "10px 12px", borderRadius: 8,
                background: "rgba(97,175,239,0.06)", border: "1px solid rgba(97,175,239,0.15)",
                flexShrink: 0,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#61AFEF" }}>{plan.feature}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 3 }}>{plan.description}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                  <span style={{
                    padding: "2px 8px", borderRadius: 99, fontSize: 10, fontWeight: 700,
                    background: plan.complexity === "low" ? "rgba(152,195,121,0.15)" : plan.complexity === "high" ? "rgba(224,108,117,0.15)" : "rgba(209,154,102,0.15)",
                    color: plan.complexity === "low" ? "#98C379" : plan.complexity === "high" ? "#E06C75" : "#D19A66",
                  }}>
                    {plan.complexity?.toUpperCase()} COMPLEXITY
                  </span>
                  <span style={{ padding: "2px 8px", borderRadius: 99, fontSize: 10, fontWeight: 700, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>
                    {plan.files?.length ?? 0} FILE(S)
                  </span>
                </div>
              </div>

              {/* Files list */}
              {plan.files?.map((f, i) => (
                <div key={i} style={{
                  borderRadius: 6, overflow: "hidden", flexShrink: 0,
                  border: "1px solid rgba(255,255,255,0.07)",
                }}>
                  <div
                    onClick={() => setExpandedFile(expandedFile === i ? null : i)}
                    style={{
                      padding: "8px 12px", display: "flex", alignItems: "center", gap: 8,
                      cursor: "pointer",
                      background: "rgba(255,255,255,0.04)",
                    }}
                  >
                    <span style={{
                      fontSize: 10, fontWeight: 800, letterSpacing: "0.04em",
                      padding: "2px 7px", borderRadius: 4,
                      background: f.action === "create" ? "rgba(152,195,121,0.15)" : "rgba(209,154,102,0.15)",
                      color: f.action === "create" ? "#98C379" : "#D19A66",
                    }}>
                      {f.action.toUpperCase()}
                    </span>
                    <span style={{ flex: 1, fontSize: 11, color: "#ABB2BF", wordBreak: "break-all" }}>{f.path}</span>
                    <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)" }}>
                      {expandedFile === i ? "▾" : "▸"}
                    </span>
                  </div>
                  {expandedFile === i && (
                    <>
                      <div style={{ padding: "6px 12px", background: "rgba(0,0,0,0.2)", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                        {f.description}
                      </div>
                      <div style={{
                        maxHeight: 200, overflow: "auto",
                        background: "#0D1117",
                      }}>
                        <pre style={{
                          margin: 0, padding: "10px 14px", fontSize: 11, lineHeight: "18px",
                          fontFamily: "'Fira Code', monospace",
                          color: "#ABB2BF", whiteSpace: "pre-wrap", wordBreak: "break-word",
                        }}>
                          {f.code?.slice(0, 2000)}{f.code?.length > 2000 ? "\n…(truncated)" : ""}
                        </pre>
                      </div>
                    </>
                  )}
                </div>
              ))}

              {/* Risks */}
              {plan.risks?.length > 0 && (
                <div style={{ padding: "8px 12px", borderRadius: 6, background: "rgba(224,108,117,0.06)", border: "1px solid rgba(224,108,117,0.15)", flexShrink: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#E06C75", marginBottom: 4 }}>RISKS</div>
                  {plan.risks.map((r, i) => (
                    <div key={i} style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>• {r}</div>
                  ))}
                </div>
              )}

              {/* Apply button */}
              <button
                onClick={handleApply}
                disabled={status === "applying"}
                style={{
                  padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                  cursor: status === "applying" ? "not-allowed" : "pointer", border: "none",
                  background: status === "applying" ? "rgba(152,195,121,0.15)" : "linear-gradient(135deg, rgba(152,195,121,0.25), rgba(97,175,239,0.15))",
                  color: "#98C379", flexShrink: 0,
                  boxShadow: "0 0 20px rgba(152,195,121,0.12)",
                  transition: "all 0.2s",
                }}
              >
                {status === "applying" ? "Applying…" : "⚡ Apply Changes"}
              </button>
            </div>
          )}
        </>
      ) : (
        /* Snapshots tab */
        <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.30)", marginBottom: 4 }}>
            Auto-saved before every apply. Max 10 kept.
          </div>
          {snapshots.length === 0 && (
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.20)", textAlign: "center", marginTop: 30 }}>
              No snapshots yet
            </div>
          )}
          {snapshots.map((s) => (
            <div key={s.id} style={{
              padding: "10px 12px", borderRadius: 8,
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
              display: "flex", flexDirection: "column", gap: 4,
            }}>
              <div style={{ fontSize: 12, color: "#ABB2BF", fontWeight: 600 }}>{s.label}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>
                {new Date(s.timestamp).toLocaleString()}
              </div>
              <button
                onClick={() => handleRollback(s.id)}
                style={{
                  marginTop: 4, padding: "4px 10px", borderRadius: 5, fontSize: 11,
                  fontWeight: 700, cursor: "pointer", border: "none", alignSelf: "flex-start",
                  background: "rgba(209,154,102,0.14)", color: "#D19A66",
                }}
              >
                ↩ Rollback
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Dev Cockpit page
// ─────────────────────────────────────────────────────────────────────────────
type MobileTab = "ai" | "files" | "editor";

export default function DevCockpitPage() {
  const [, nav]               = useLocation();
  const [root, setRoot]       = useState("pages");
  const [tree, setTree]       = useState<FileNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState("");
  const [fileContent, setFileContent]   = useState("// Select a file from the tree →");
  const [editedContent, setEditedContent] = useState("");
  const [fileLoading, setFileLoading] = useState(false);
  const [savingFile, setSavingFile] = useState(false);
  const [saveMsg, setSaveMsg]       = useState("");
  const [hmrBlink, setHmrBlink]     = useState(false);

  // ── Mobile/Desktop layout ─────────────────────────────────────────────────
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" && window.innerWidth < 768
  );
  const [mobileTab, setMobileTab] = useState<MobileTab>("ai");

  const isDirty = editedContent !== fileContent;

  // Load file tree
  const loadTree = useCallback(async (r: string) => {
    setTreeLoading(true);
    try {
      const res = await fetch(`${API}/builder/tree?key=${DEV_KEY}&root=${r}`);
      const d   = await res.json() as { tree: FileNode[] };
      setTree(d.tree ?? []);
    } catch { setTree([]); }
    setTreeLoading(false);
  }, []);

  useEffect(() => { void loadTree(root); }, [root, loadTree]);

  // Load a file into the editor
  const openFile = useCallback(async (filePath: string) => {
    if (filePath === selectedFile) return;
    setFileLoading(true);
    setSelectedFile(filePath);
    setSaveMsg("");
    try {
      const res = await fetch(`${API}/builder/read?key=${DEV_KEY}&filePath=${encodeURIComponent(filePath)}`);
      const d   = await res.json() as { content: string };
      setFileContent(d.content ?? "");
      setEditedContent(d.content ?? "");
    } catch {
      setFileContent("// Error loading file");
      setEditedContent("// Error loading file");
    }
    setFileLoading(false);
  }, [selectedFile]);

  // Save file
  const saveFile = async () => {
    if (!selectedFile || !isDirty) return;
    setSavingFile(true);
    setSaveMsg("");
    try {
      const res = await fetch(`${API}/builder/write`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: DEV_KEY, filePath: selectedFile, content: editedContent }),
      });
      const d = await res.json() as { success: boolean };
      if (d.success) {
        setFileContent(editedContent);
        setSaveMsg("✓ Saved — HMR triggered");
        setHmrBlink(true);
        setTimeout(() => setHmrBlink(false), 2000);
      } else {
        setSaveMsg("✗ Save failed");
      }
    } catch { setSaveMsg("✗ Network error"); }
    setSavingFile(false);
  };

  // Keyboard save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        void saveFile();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const handleApplySuccess = (path: string) => {
    void openFile(path);
    setHmrBlink(true);
    setTimeout(() => setHmrBlink(false), 2000);
  };

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100dvh",
      background: "#0A0C10", color: "#ABB2BF",
      fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      overflow: "hidden",
    }}>

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0, height: 46, display: "flex", alignItems: "center",
        padding: "0 16px", gap: 12,
        background: "#0D1117", borderBottom: "1px solid rgba(255,255,255,0.07)",
        zIndex: 10,
      }}>
        {/* Back */}
        <button
          onClick={() => nav("/")}
          style={{
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 6, padding: "4px 10px", fontSize: 12, color: "rgba(255,255,255,0.5)",
            cursor: "pointer", fontWeight: 600,
          }}
        >
          ← App
        </button>

        {/* Title */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>🔧</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#FFFFFF", letterSpacing: "-0.01em" }}>
            Dev Cockpit
          </span>
        </div>

        {/* Current file path */}
        {selectedFile && (
          <div style={{
            flex: 1, fontSize: 11, color: "rgba(255,255,255,0.30)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {selectedFile}
          </div>
        )}
        {!selectedFile && <div style={{ flex: 1 }} />}

        {/* Dirty indicator + save */}
        {isDirty && selectedFile && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#D19A66" }} title="Unsaved changes" />
            <button
              onClick={saveFile}
              disabled={savingFile}
              style={{
                background: "rgba(152,195,121,0.15)", border: "1px solid rgba(152,195,121,0.3)",
                borderRadius: 6, padding: "4px 12px", fontSize: 11, fontWeight: 700,
                color: "#98C379", cursor: "pointer",
              }}
            >
              {savingFile ? "Saving…" : "Save ⌘S"}
            </button>
          </div>
        )}

        {/* Save status */}
        {saveMsg && !isDirty && (
          <span style={{ fontSize: 11, color: saveMsg.startsWith("✓") ? "#98C379" : "#E06C75" }}>
            {saveMsg}
          </span>
        )}

        {/* Layout toggle */}
        <button
          onClick={() => setIsMobile(m => !m)}
          title={isMobile ? "Switch to desktop layout" : "Switch to mobile layout"}
          style={{
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 6, padding: "4px 9px", fontSize: 13, cursor: "pointer",
            color: "rgba(255,255,255,0.55)", flexShrink: 0,
          }}
        >
          {isMobile ? "💻" : "📱"}
        </button>

        {/* HMR status dot */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            background: hmrBlink ? "#98C379" : "#4B5263",
            boxShadow: hmrBlink ? "0 0 8px #98C379" : "none",
            transition: "all 0.3s",
          }} />
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.20)" }}>HMR</span>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────────── */}

      {/* ─ Mobile: single-panel + bottom tab bar ─────────────────────────────── */}
      {isMobile && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Files panel */}
          {mobileTab === "files" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#0D1117" }}>
              <div style={{ padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", flexWrap: "wrap", gap: 4, flexShrink: 0 }}>
                {ROOTS.map(r => (
                  <button key={r.id} onClick={() => setRoot(r.id)} style={{ padding: "3px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, cursor: "pointer", border: "none", background: root === r.id ? "rgba(97,175,239,0.18)" : "transparent", color: root === r.id ? "#61AFEF" : "rgba(255,255,255,0.30)" }}>
                    {r.icon} {r.label}
                  </button>
                ))}
              </div>
              <div style={{ flex: 1, overflow: "auto", padding: "6px 4px" }}>
                {treeLoading ? (
                  <div style={{ padding: 16, fontSize: 11, color: "rgba(255,255,255,0.20)", textAlign: "center" }}>Loading…</div>
                ) : tree.length === 0 ? (
                  <div style={{ padding: 16, fontSize: 11, color: "rgba(255,255,255,0.20)", textAlign: "center" }}>Empty</div>
                ) : tree.map(node => (
                  <TreeNode key={node.path} node={node} selected={selectedFile} onSelect={(p) => { void openFile(p); setMobileTab("ai"); }} />
                ))}
              </div>
            </div>
          )}

          {/* Editor panel */}
          {mobileTab === "editor" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ flexShrink: 0, height: 34, display: "flex", alignItems: "center", padding: "0 14px", gap: 10, background: "#0F1319", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {selectedFile ? (
                  <>
                    <span style={{ fontSize: 11, color: fileColor(selectedFile.split("/").pop() ?? "") }}>{selectedFile.split("/").pop()}</span>
                    {isDirty && <span style={{ fontSize: 9, color: "#D19A66" }}>●</span>}
                    {fileLoading && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>Loading…</span>}
                  </>
                ) : <span style={{ fontSize: 11, color: "rgba(255,255,255,0.20)" }}>Select a file from the Files tab</span>}
              </div>
              <CodeEditor content={editedContent || fileContent} onChange={v => setEditedContent(v)} readOnly={!selectedFile || fileLoading} />
            </div>
          )}

          {/* AI panel */}
          {mobileTab === "ai" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#0D1117" }}>
              <div style={{ flexShrink: 0, height: 34, display: "flex", alignItems: "center", padding: "0 16px", gap: 8, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ fontSize: 12 }}>🤖</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.70)" }}>AI Builder</span>
                {selectedFile
                  ? <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginLeft: "auto", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedFile.split("/").pop()}</span>
                  : <span style={{ fontSize: 10, color: "rgba(255,255,255,0.20)", marginLeft: "auto" }}>GPT-4o</span>}
              </div>
              <AIConsole
                currentFile={selectedFile}
                currentContent={editedContent || fileContent}
                onApplySuccess={handleApplySuccess}
              />
            </div>
          )}

          {/* Bottom tab bar */}
          <div style={{ flexShrink: 0, height: 58, display: "flex", background: "#0D1117", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            {([
              { key: "ai",     icon: "🤖", label: "AI Builder" },
              { key: "files",  icon: "📁", label: "Files" },
              { key: "editor", icon: "✏️",  label: "Editor" },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => setMobileTab(tab.key)}
                style={{
                  flex: 1, border: "none", cursor: "pointer",
                  background: mobileTab === tab.key ? "rgba(97,175,239,0.10)" : "transparent",
                  color: mobileTab === tab.key ? "#61AFEF" : "rgba(255,255,255,0.35)",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
                  borderTop: mobileTab === tab.key ? "2px solid #61AFEF" : "2px solid transparent",
                  transition: "all 0.15s",
                }}
              >
                <span style={{ fontSize: 19 }}>{tab.icon}</span>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.03em" }}>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─ Desktop: classic 3-panel ─────────────────────────────────────────── */}
      {!isMobile && <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ── LEFT: File Tree (220px) ───────────────────────────────────────── */}
        <div style={{
          width: 220, flexShrink: 0, display: "flex", flexDirection: "column",
          background: "#0D1117", borderRight: "1px solid rgba(255,255,255,0.07)",
          overflow: "hidden",
        }}>
          {/* Root selector */}
          <div style={{
            padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)",
            display: "flex", flexWrap: "wrap", gap: 4, flexShrink: 0,
          }}>
            {ROOTS.map(r => (
              <button
                key={r.id}
                onClick={() => setRoot(r.id)}
                style={{
                  padding: "3px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700,
                  cursor: "pointer", border: "none",
                  background: root === r.id ? "rgba(97,175,239,0.18)" : "transparent",
                  color: root === r.id ? "#61AFEF" : "rgba(255,255,255,0.30)",
                  transition: "all 0.12s",
                }}
              >
                {r.icon} {r.label}
              </button>
            ))}
          </div>

          {/* Tree */}
          <div style={{ flex: 1, overflow: "auto", padding: "6px 4px" }}>
            {treeLoading ? (
              <div style={{ padding: 16, fontSize: 11, color: "rgba(255,255,255,0.20)", textAlign: "center" }}>
                Loading…
              </div>
            ) : tree.length === 0 ? (
              <div style={{ padding: 16, fontSize: 11, color: "rgba(255,255,255,0.20)", textAlign: "center" }}>
                Empty
              </div>
            ) : (
              tree.map(node => (
                <TreeNode
                  key={node.path} node={node}
                  selected={selectedFile} onSelect={openFile}
                />
              ))
            )}
          </div>
        </div>

        {/* ── CENTER: Code Editor (flex-1) ──────────────────────────────────── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
          {/* Editor top bar */}
          <div style={{
            flexShrink: 0, height: 34, display: "flex", alignItems: "center", padding: "0 14px", gap: 10,
            background: "#0F1319", borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}>
            {selectedFile ? (
              <>
                <span style={{ fontSize: 11, color: fileColor(selectedFile.split("/").pop() ?? "") }}>
                  {selectedFile.split("/").pop()}
                </span>
                {isDirty && <span style={{ fontSize: 9, color: "#D19A66" }}>●</span>}
                {fileLoading && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>Loading…</span>}
              </>
            ) : (
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.20)" }}>
                Select a file from the tree
              </span>
            )}
          </div>

          {/* Editor */}
          <CodeEditor
            content={editedContent || fileContent}
            onChange={v => setEditedContent(v)}
            readOnly={!selectedFile || fileLoading}
          />
        </div>

        {/* ── RIGHT: AI Console (340px) ──────────────────────────────────────── */}
        <div style={{
          width: 340, flexShrink: 0, display: "flex", flexDirection: "column",
          background: "#0D1117", borderLeft: "1px solid rgba(255,255,255,0.07)",
          overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{
            flexShrink: 0, height: 34, display: "flex", alignItems: "center", padding: "0 16px", gap: 8,
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}>
            <span style={{ fontSize: 12 }}>🤖</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.70)" }}>AI Builder</span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.20)", marginLeft: "auto" }}>GPT-4o</span>
          </div>

          <AIConsole
            currentFile={selectedFile}
            currentContent={editedContent || fileContent}
            onApplySuccess={handleApplySuccess}
          />
        </div>
      </div>}

    </div>
  );
}
