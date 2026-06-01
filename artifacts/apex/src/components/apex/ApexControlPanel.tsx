import { useState } from "react";
import { useLocation } from "wouter";
import { useApexState } from "@/contexts/ApexStateContext";

interface ComingSoonFeature {
  icon: string;
  name: string;
  desc: string;
  href?: string;
  locked: boolean;
}

const FEATURES: ComingSoonFeature[] = [
  { icon: "🔧", name: "Dev Cockpit",             desc: "Build & update Apex from inside Apex — file editor + AI", href: "/dev-cockpit", locked: false },
  { icon: "⚡", name: "Apex Builder",           desc: "AI app & game creator — build anything with prompts", href: "/apex-builder",  locked: false },
  { icon: "🎮", name: "Game Engine v4",          desc: "Multiplayer AI-powered game ecosystem",               href: "/games",         locked: false },
  { icon: "🤖", name: "AI Arena",                desc: "Battle multiple AIs simultaneously, vote on winner",  href: "/arena",         locked: false },
  { icon: "🌐", name: "AI Studio",               desc: "Full AI model suite with advanced controls",          href: "/ai-studio",     locked: false },
  { icon: "📸", name: "Screenshot Analysis",     desc: "AI-powered image and screenshot intelligence",        href: "/screenshot",    locked: false },
  { icon: "🌍", name: "Domain Settings",         desc: "Connect your custom domain and set up email",         href: "/domain-settings", locked: false },
  { icon: "🎭", name: "Avatar System",           desc: "3D living AI avatar with emotion engine",             href: "/apex-avatar",   locked: false },
  { icon: "🛒", name: "Marketplace",             desc: "Buy and sell AI creations and game assets",           href: "/marketplace",   locked: false },
  { icon: "📊", name: "Creator Dashboard",       desc: "Revenue analytics and audience insights",             href: "/creator-dashboard", locked: false },
  { icon: "🎙️", name: "Real-Time Voice Agent",   desc: "Live voice conversation with Apex AI",               locked: true },
  { icon: "🦾", name: "Autonomous Assistants",   desc: "AI agents that act on your behalf 24/7",             locked: true },
  { icon: "🌐", name: "Multi-Platform Automation", desc: "Control any app from one Apex command",            locked: true },
  { icon: "🤝", name: "Multiplayer AI Co-bots",  desc: "Collaborate with AI and friends in real time",       locked: true },
];

const PERSONALITY_OPTIONS = [
  { id: "friend",     label: "Friend",    emoji: "👋" },
  { id: "assistant",  label: "Assistant", emoji: "🤖" },
  { id: "formal",     label: "Formal",    emoji: "👔" },
  { id: "creative",   label: "Creative",  emoji: "🎨" },
];

export function ApexControlPanel() {
  const [open, setOpen]             = useState(false);
  const [previewFeature, setPreviewFeature] = useState<ComingSoonFeature | null>(null);
  const [, nav]                     = useLocation();
  const { voiceMode, setVoiceMode, darkMode, setDarkMode, memoryEnabled, setMemoryEnabled, wakePhrase, setWakePhrase, personality, setPersonality } = useApexState();

  const close = () => setOpen(false);

  const handleFeatureClick = (f: ComingSoonFeature) => {
    if (f.locked) {
      setPreviewFeature(f);
    } else if (f.href) {
      close();
      nav(f.href);
    }
  };

  return (
    <>
      {/* ── Hamburger Button ───────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Apex Control Panel"
        style={{
          position: "fixed",
          top: 14,
          left: 16,
          zIndex: 55,
          width: 42,
          height: 42,
          borderRadius: 14,
          background: open
            ? "linear-gradient(135deg, rgba(108,92,231,0.4), rgba(162,155,254,0.2))"
            : "rgba(20,18,30,0.75)",
          border: `1px solid ${open ? "rgba(108,92,231,0.5)" : "rgba(255,255,255,0.1)"}`,
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 5,
          padding: 0,
          transition: "all 0.25s cubic-bezier(0.34,1.56,0.64,1)",
          boxShadow: open
            ? "0 0 20px rgba(108,92,231,0.4)"
            : "0 4px 16px rgba(0,0,0,0.4)",
        }}
      >
        {/* Strawberry-menu lines */}
        {[0, 1, 2].map(i => (
          <div
            key={i}
            style={{
              height: 2,
              borderRadius: 2,
              background: open ? "#A29BFE" : "rgba(255,255,255,0.7)",
              transition: "all 0.25s ease",
              width: i === 1 ? 14 : 18,
              transform: open
                ? i === 0 ? "rotate(45deg) translateY(7px)"
                : i === 1 ? "scaleX(0) opacity(0)"
                : "rotate(-45deg) translateY(-7px)"
                : "none",
            }}
          />
        ))}
      </button>

      {/* ── Backdrop ───────────────────────────────────────────────────────── */}
      {open && (
        <div
          onClick={close}
          style={{
            position: "fixed", inset: 0, zIndex: 49,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            animation: "panelFadeIn 0.2s ease",
          }}
        />
      )}

      {/* ── Panel ──────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width: "min(340px, 88vw)",
          zIndex: 60,
          background: "linear-gradient(165deg, rgba(18,15,32,0.98) 0%, rgba(12,10,24,0.99) 100%)",
          backdropFilter: "blur(40px) saturate(200%)",
          WebkitBackdropFilter: "blur(40px) saturate(200%)",
          borderRight: "1px solid rgba(108,92,231,0.2)",
          boxShadow: "0 0 80px rgba(108,92,231,0.15), 8px 0 40px rgba(0,0,0,0.6)",
          overflowY: "auto",
          transform: open ? "translateX(0)" : "translateX(-110%)",
          transition: "transform 0.35s cubic-bezier(0.25,0.46,0.45,0.94)",
          willChange: "transform",
          pointerEvents: open ? "auto" : "none",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "20px 20px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "linear-gradient(180deg, rgba(108,92,231,0.1) 0%, transparent 100%)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 14,
              background: "linear-gradient(135deg, #6C5CE7, #A29BFE)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 20px rgba(108,92,231,0.5)",
              fontSize: 18,
            }}>⚡</div>
            <div>
              <div style={{ color: "white", fontWeight: 800, fontSize: 16, letterSpacing: "-0.02em" }}>Apex Nexus</div>
              <div style={{ color: "rgba(162,155,254,0.7)", fontSize: 11, fontWeight: 600 }}>CONTROL PANEL</div>
            </div>
            <button
              onClick={close}
              style={{
                marginLeft: "auto", width: 30, height: 30,
                borderRadius: "50%", border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)",
                fontSize: 14, cursor: "pointer", display: "flex",
                alignItems: "center", justifyContent: "center",
              }}
            >×</button>
          </div>
        </div>

        <div style={{ padding: "0 20px 100px" }}>

          {/* ─── System Controls ─────────────────────────────────────────── */}
          <SectionTitle>⚙️ System Controls</SectionTitle>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <ToggleRow label="Dark Mode" emoji="🌙" value={darkMode} onChange={setDarkMode} />
            <ToggleRow label="Voice Mode" emoji="🎙️" value={voiceMode} onChange={setVoiceMode} note={voiceMode ? "Active" : "Simulated"} />
            <ToggleRow label="Memory" emoji="🧠" value={memoryEnabled} onChange={setMemoryEnabled} note={memoryEnabled ? "Learning" : "Off"} />
          </div>

          {/* Wake Phrase */}
          <div style={{ marginTop: 12 }}>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
              Wake Phrase
            </div>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "rgba(255,255,255,0.05)", borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.08)", padding: "8px 12px",
            }}>
              <span style={{ fontSize: 14 }}>🎤</span>
              <input
                value={wakePhrase}
                onChange={e => setWakePhrase(e.target.value)}
                style={{
                  flex: 1, background: "transparent", border: "none",
                  color: "white", fontSize: 13, fontWeight: 600, outline: "none",
                }}
                placeholder="Hey Apex"
              />
              <span style={{ color: "rgba(108,92,231,0.7)", fontSize: 10, fontWeight: 700 }}>CUSTOM</span>
            </div>
          </div>

          {/* Personality */}
          <div style={{ marginTop: 14 }}>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
              Apex Tone
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {PERSONALITY_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setPersonality(opt.id)}
                  style={{
                    padding: "8px 10px", borderRadius: 12,
                    background: personality === opt.id ? "rgba(108,92,231,0.25)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${personality === opt.id ? "rgba(108,92,231,0.5)" : "rgba(255,255,255,0.06)"}`,
                    color: personality === opt.id ? "#A29BFE" : "rgba(255,255,255,0.5)",
                    fontSize: 12, fontWeight: 600, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 6,
                    transition: "all 0.2s",
                  }}
                >
                  <span>{opt.emoji}</span>{opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Privacy */}
          <button
            onClick={() => { close(); nav("/profile"); }}
            style={{
              width: "100%", marginTop: 12, padding: "10px 14px",
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 12, color: "rgba(255,255,255,0.5)", fontSize: 12,
              fontWeight: 600, cursor: "pointer", textAlign: "left",
              display: "flex", alignItems: "center", gap: 10,
            }}
          >
            🔒 Privacy & Notifications →
          </button>

          {/* ─── Features ────────────────────────────────────────────────── */}
          <SectionTitle style={{ marginTop: 24 }}>🚀 All Features</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {FEATURES.map(f => (
              <button
                key={f.name}
                onClick={() => handleFeatureClick(f)}
                style={{
                  textAlign: "left", padding: "12px 14px",
                  background: f.locked ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${f.locked ? "rgba(255,255,255,0.05)" : "rgba(108,92,231,0.15)"}`,
                  borderRadius: 14, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 12,
                  transition: "all 0.2s",
                  opacity: f.locked ? 0.65 : 1,
                }}
              >
                <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{f.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    color: f.locked ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.85)",
                    fontWeight: 700, fontSize: 13,
                  }}>
                    {f.name}
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 2, lineHeight: 1.4 }}>
                    {f.desc}
                  </div>
                </div>
                {f.locked ? (
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: "#A29BFE",
                    background: "rgba(108,92,231,0.2)", border: "1px solid rgba(108,92,231,0.3)",
                    borderRadius: 6, padding: "2px 7px", flexShrink: 0,
                  }}>SOON</span>
                ) : (
                  <span style={{ color: "rgba(108,92,231,0.6)", fontSize: 14, flexShrink: 0 }}>→</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Locked Feature Modal ────────────────────────────────────────────── */}
      {previewFeature && (
        <>
          <div
            onClick={() => setPreviewFeature(null)}
            style={{
              position: "fixed", inset: 0, zIndex: 70,
              background: "rgba(0,0,0,0.8)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              animation: "panelFadeIn 0.2s ease",
            }}
          />
          <div
            style={{
              position: "fixed",
              top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 71,
              width: "min(320px, 88vw)",
              background: "linear-gradient(135deg, rgba(20,18,35,0.98), rgba(15,12,28,0.99))",
              border: "1px solid rgba(108,92,231,0.3)",
              borderRadius: 24,
              padding: 28,
              textAlign: "center",
              boxShadow: "0 0 80px rgba(108,92,231,0.3), 0 32px 80px rgba(0,0,0,0.7)",
              animation: "scaleInModal 0.3s cubic-bezier(0.34,1.56,0.64,1)",
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12, animation: "featureGlow 2s ease-in-out infinite" }}>
              {previewFeature.icon}
            </div>
            <div style={{ color: "white", fontWeight: 800, fontSize: 18, marginBottom: 8 }}>
              {previewFeature.name}
            </div>
            <div style={{
              color: "rgba(162,155,254,0.8)", fontSize: 13, lineHeight: 1.6, marginBottom: 20,
            }}>
              This feature is forming in Apex Nexus…
            </div>
            <div style={{
              background: "rgba(108,92,231,0.1)", border: "1px solid rgba(108,92,231,0.2)",
              borderRadius: 14, padding: "12px 16px", marginBottom: 20,
              color: "rgba(255,255,255,0.5)", fontSize: 12, lineHeight: 1.6,
            }}>
              {previewFeature.desc}
            </div>
            <button
              onClick={() => setPreviewFeature(null)}
              style={{
                width: "100%", padding: "12px",
                background: "linear-gradient(135deg, #6C5CE7, #A29BFE)",
                border: "none", borderRadius: 14, color: "white",
                fontWeight: 700, fontSize: 14, cursor: "pointer",
                boxShadow: "0 0 24px rgba(108,92,231,0.5)",
              }}
            >
              Notify Me When Ready
            </button>
          </div>
        </>
      )}

      <style>{`
        @keyframes panelFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleInModal {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.85); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes featureGlow {
          0%, 100% { filter: drop-shadow(0 0 8px rgba(108,92,231,0.6)); }
          50%       { filter: drop-shadow(0 0 20px rgba(162,155,254,0.9)); }
        }
      `}</style>
    </>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionTitle({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: 700,
      textTransform: "uppercase", letterSpacing: "0.1em",
      margin: "20px 0 10px", ...style,
    }}>
      {children}
    </div>
  );
}

function ToggleRow({
  label, emoji, value, onChange, note,
}: {
  label: string; emoji: string; value: boolean;
  onChange: (v: boolean) => void; note?: string;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 12px", borderRadius: 12,
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.06)",
      cursor: "pointer",
    }}
      onClick={() => onChange(!value)}
    >
      <span style={{ fontSize: 15 }}>{emoji}</span>
      <span style={{ flex: 1, color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 600 }}>{label}</span>
      {note && <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>{note}</span>}
      {/* Toggle */}
      <div style={{
        width: 36, height: 20, borderRadius: 99, position: "relative",
        background: value ? "linear-gradient(90deg, #6C5CE7, #A29BFE)" : "rgba(255,255,255,0.1)",
        transition: "background 0.25s",
        boxShadow: value ? "0 0 10px rgba(108,92,231,0.4)" : "none",
      }}>
        <div style={{
          position: "absolute", top: 2,
          left: value ? 18 : 2,
          width: 16, height: 16, borderRadius: "50%",
          background: "white",
          transition: "left 0.25s cubic-bezier(0.34,1.56,0.64,1)",
          boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
        }} />
      </div>
    </div>
  );
}
