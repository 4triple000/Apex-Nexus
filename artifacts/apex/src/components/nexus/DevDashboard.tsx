import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Module, GlobalSettings, AppEnvironment } from "./types";

// ── Live Test Mode ─────────────────────────────────────────────────────────────

interface ChatMsg { role: "user" | "ai"; content: string; ts: number; }

function buildAIReply(input: string, modules: Module[], globalSettings: GlobalSettings, env: AppEnvironment): string {
  const aiMod     = modules.find((m) => m.id === "ai-engine");
  const dmMod     = modules.find((m) => m.id === "dm-system");
  const voiceMod  = modules.find((m) => m.id === "voice-system");
  const battleMod = modules.find((m) => m.id === "battle-mode");

  if (!aiMod?.enabled) return "⚠️ AI Engine is disabled. Enable it in Modules Manager.";

  const toneMap: Record<string, string> = {
    Friendly: "Hey! ", Professional: "Thank you. ", Casual: "Yo! ",
    Assertive: "Listen — ", Empathetic: "I hear you. ",
  };
  const personalityMap: Record<string, string> = {
    Balanced: "Here's a balanced take: ", Playful: "Ooh fun question! ",
    Professional: "Based on analysis: ", Aggressive: "Real talk: ",
    Empathetic: "I totally get that. ", Genius: "Fascinating. Analyzing...",
  };

  const prefix  = dmMod?.enabled ? (toneMap[String(dmMod.settings.tone)] ?? "") : "";
  const persona = personalityMap[globalSettings.personality] ?? "";
  const envTag  = env === "sandbox" ? "[SANDBOX] " : "";
  const model   = aiMod.settings.model ?? "gpt-4o";
  const voice   = voiceMod?.enabled ? `🔊 Voice: ${voiceMod.settings.voiceId}` : "";
  const battle  = battleMod?.enabled ? ` ⚔️ Battle: ${battleMod.settings.difficulty}` : "";

  const replies = [
    `${envTag}${prefix}${persona}Running on ${model}. Responding to: "${input}"${voice ? ` · ${voice}` : ""}`,
    `${envTag}${persona}I processed your message through ${model} with ${globalSettings.personality} personality.${battle}`,
    `${envTag}${prefix}Memory is ${globalSettings.memoryEnabled ? "active — I remember our context" : "off — fresh start"}.${voice ? ` ${voice}.` : ""}`,
    `${envTag}${persona}Mode: ${globalSettings.appMode} · "${input}" received and processed.`,
  ];
  return replies[Math.floor(Math.random() * replies.length)]!;
}

export function LiveTestScreen({
  modules, globalSettings, environment,
}: {
  modules: Module[]; globalSettings: GlobalSettings; environment: AppEnvironment;
}) {
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "ai", content: `Apex Nexus LIVE [${environment.toUpperCase()}]. All active modules synced. Send a message to test.`, ts: Date.now() },
  ]);
  const [input, setInput]   = useState("");
  const [typing, setTyping] = useState(false);
  const bottomRef           = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  // Re-announce environment changes
  useEffect(() => {
    setMessages((m) => [
      ...m,
      { role: "ai", content: `⟳ Switched to ${environment.toUpperCase()} environment.`, ts: Date.now() },
    ]);
  }, [environment]);

  const send = () => {
    const text = input.trim(); if (!text) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text, ts: Date.now() }]);
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMessages((m) => [...m, {
        role: "ai",
        content: buildAIReply(text, modules, globalSettings, environment),
        ts: Date.now(),
      }]);
    }, 800 + Math.random() * 600);
  };

  const activeCount = modules.filter((m) => m.enabled && m.status === "Active").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Status bar */}
      <div style={{
        padding: "8px 16px",
        background: environment === "sandbox" ? "rgba(253,203,110,0.08)" : "rgba(0,184,148,0.08)",
        borderBottom: `1px solid ${environment === "sandbox" ? "rgba(253,203,110,0.15)" : "rgba(0,184,148,0.15)"}`,
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <div style={{
          width: 7, height: 7, borderRadius: "50%",
          background: environment === "sandbox" ? "#fdcb6e" : "#00b894",
          boxShadow: `0 0 5px ${environment === "sandbox" ? "#fdcb6e" : "#00b894"}`,
        }} />
        <span style={{ color: environment === "sandbox" ? "#fdcb6e" : "#00b894", fontSize: 11, fontWeight: 700 }}>
          {environment.toUpperCase()} — {activeCount} module{activeCount !== 1 ? "s" : ""} active
        </span>
        <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, marginLeft: "auto" }}>
          {modules.find((m) => m.id === "ai-engine")?.settings.model ?? "—"} · {globalSettings.personality}
        </span>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px", display: "flex", flexDirection: "column", gap: 10 }}>
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: "82%", padding: "10px 14px",
                borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                background: msg.role === "user"
                  ? "linear-gradient(135deg, #7c5ce7, #a29bfe)"
                  : "rgba(255,255,255,0.06)",
                color: "#fff", fontSize: 13, lineHeight: 1.5,
                border: msg.role === "ai" ? "1px solid rgba(255,255,255,0.08)" : "none",
              }}>
                {msg.content}
              </div>
            </motion.div>
          ))}
          {typing && (
            <motion.div key="typing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: "flex" }}>
              <div style={{
                padding: "10px 16px", background: "rgba(255,255,255,0.06)",
                borderRadius: "18px 18px 18px 4px", border: "1px solid rgba(255,255,255,0.08)",
              }}>
                <div style={{ display: "flex", gap: 4 }}>
                  {[0, 1, 2].map((i) => (
                    <motion.div key={i} animate={{ y: [0, -5, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                      style={{ width: 6, height: 6, borderRadius: "50%", background: "#a29bfe" }} />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "10px 14px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Type a test message..."
          style={{
            flex: 1, background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12, padding: "11px 14px",
            color: "#fff", fontSize: 14, outline: "none",
          }}
        />
        <motion.button whileTap={{ scale: 0.9 }} onClick={send} style={{
          width: 44, height: 44, borderRadius: 12, border: "none",
          background: "linear-gradient(135deg, #7c5ce7, #a29bfe)",
          color: "#fff", fontSize: 18, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>➤</motion.button>
      </div>
    </div>
  );
}

// ── Deploy Center ──────────────────────────────────────────────────────────────

export function DeployScreen({
  modules, environment, onSaveConfig, onReset,
}: {
  modules: Module[]; environment: AppEnvironment; onSaveConfig: () => void; onReset: () => void;
}) {
  const [deployStatus, setDeployStatus] = useState<"idle" | "deploying" | "done">("idle");
  const [lastSaved, setLastSaved]       = useState<string | null>(null);

  const handleDeploy = () => {
    if (environment === "sandbox") return;
    setDeployStatus("deploying");
    setTimeout(() => { setDeployStatus("done"); setTimeout(() => setDeployStatus("idle"), 3000); }, 2200);
  };

  const handleSave = () => { onSaveConfig(); setLastSaved(new Date().toLocaleTimeString()); };

  const active = modules.filter((m) => m.enabled && m.status === "Active");

  return (
    <div style={{ padding: "0 16px 80px" }}>
      {/* Env warning */}
      {environment === "sandbox" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{
            background: "rgba(253,203,110,0.1)", border: "1px solid rgba(253,203,110,0.3)",
            borderRadius: 12, padding: "12px 14px", marginBottom: 16,
            color: "#fdcb6e", fontSize: 12,
          }}>
          🧪 You're in Sandbox mode. Switch to Production to deploy.
        </motion.div>
      )}

      {/* Config summary */}
      <div style={{
        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16, padding: 16, marginBottom: 16,
      }}>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", margin: "0 0 12px" }}>
          CONFIG SUMMARY
        </p>
        {modules.map((m) => (
          <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0" }}>
            <span style={{ fontSize: 14 }}>{m.icon}</span>
            <span style={{ color: "#fff", fontSize: 13, flex: 1 }}>{m.name}</span>
            <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 10 }}>v{m.version}</span>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
              background: m.enabled && m.status === "Active" ? "rgba(0,184,148,0.15)" : "rgba(255,255,255,0.05)",
              color: m.enabled && m.status === "Active" ? "#00b894" : "#636e72",
            }}>
              {m.status === "Coming Soon" ? "SOON" : m.enabled ? "ON" : "OFF"}
            </span>
          </div>
        ))}
        <div style={{
          marginTop: 12, padding: "10px 12px",
          background: "rgba(124,92,231,0.1)", border: "1px solid rgba(124,92,231,0.2)",
          borderRadius: 10, color: "#a29bfe", fontSize: 12,
        }}>
          {active.length} / {modules.length} active
          {lastSaved && ` · Saved ${lastSaved}`}
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <motion.button whileTap={{ scale: 0.97 }} onClick={handleSave} style={{
          width: "100%", padding: "15px", borderRadius: 14,
          border: "1px solid rgba(124,92,231,0.3)", background: "rgba(124,92,231,0.12)",
          color: "#a29bfe", fontWeight: 700, fontSize: 15, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}>
          <span>💾</span> Save Configuration
        </motion.button>

        <motion.button whileTap={{ scale: 0.97 }} onClick={handleDeploy}
          disabled={deployStatus !== "idle" || environment === "sandbox"}
          style={{
            width: "100%", padding: "15px", borderRadius: 14, border: "none",
            background: environment === "sandbox"
              ? "rgba(255,255,255,0.05)"
              : deployStatus === "done"
              ? "linear-gradient(135deg, #00b894, #00cec9)"
              : deployStatus === "deploying"
              ? "rgba(255,255,255,0.08)"
              : "linear-gradient(135deg, #7c5ce7, #a29bfe)",
            color: environment === "sandbox" ? "#636e72" : "#fff",
            fontWeight: 800, fontSize: 15,
            cursor: (deployStatus !== "idle" || environment === "sandbox") ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            transition: "background 0.4s",
          }}>
          {deployStatus === "deploying"
            ? <><motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} style={{ display: "inline-block" }}>⟳</motion.span> Deploying...</>
            : deployStatus === "done"
            ? <>✓ Deployed!</>
            : <><span>🚀</span> Deploy Update</>
          }
        </motion.button>

        <motion.button whileTap={{ scale: 0.97 }} onClick={onReset} style={{
          width: "100%", padding: "15px", borderRadius: 14,
          border: "1px solid rgba(214,48,49,0.3)", background: "rgba(214,48,49,0.08)",
          color: "#ff7675", fontWeight: 700, fontSize: 15, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}>
          <span>↺</span> Reset to Default
        </motion.button>
      </div>
    </div>
  );
}
