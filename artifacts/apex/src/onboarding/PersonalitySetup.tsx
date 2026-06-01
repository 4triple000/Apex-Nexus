/**
 * PersonalitySetup — Step 3 of FTUE
 *
 * Shows 4 personality cards in a 2×2 grid.
 * User selects one → "Enter Apex →" button activates.
 * On confirm, calls setGlobalPersonality(id) + onComplete().
 */
import { useState } from "react";
import { usePersonality } from "@/contexts/PersonalityContext";
import type { ApexPersonalityId } from "@/lib/personalityEngine";
import { IOS, SPRING } from "./useOnboarding";

interface PersonalitySetupProps {
  exiting:    boolean;
  onComplete: () => void;
}

// ── Personality options ───────────────────────────────────────────────────────

interface PersonalityOption {
  id:          ApexPersonalityId;
  label:       string;
  emoji:       string;
  description: string;
  tags:        string[];
  color:       string;
  glow:        string;
}

const OPTIONS: PersonalityOption[] = [
  {
    id:          "strategist",
    label:       "Strategic",
    emoji:       "🎯",
    description: "Sharp, analytical, results-driven. Built to help you execute and win.",
    tags:        ["Focused", "Direct", "Plans"],
    color:       "#6C5CE7",
    glow:        "rgba(108,92,231,0.28)",
  },
  {
    id:          "friend",
    label:       "Casual",
    emoji:       "😊",
    description: "Warm, conversational, and relatable. Like talking to someone who gets you.",
    tags:        ["Chill", "Warm", "Real"],
    color:       "#F59E0B",
    glow:        "rgba(245,158,11,0.28)",
  },
  {
    id:          "innovator",
    label:       "Creative",
    emoji:       "✨",
    description: "Imaginative and exploratory. Perfect for ideas, writing, and building things.",
    tags:        ["Bold", "Curious", "Builds"],
    color:       "#EC4899",
    glow:        "rgba(236,72,153,0.28)",
  },
  {
    id:          "mentor",
    label:       "Mentor",
    emoji:       "🧠",
    description: "Thoughtful and guiding. Pushes you to grow, not just get things done.",
    tags:        ["Wise", "Patient", "Growth"],
    color:       "#10B981",
    glow:        "rgba(16,185,129,0.28)",
  },
];

// ── Personality card ──────────────────────────────────────────────────────────

interface CardProps {
  option:   PersonalityOption;
  selected: boolean;
  delay:    number;
  onSelect: () => void;
}

function PersonalityCard({ option, selected, delay, onSelect }: CardProps) {
  const [pressed, setPressed] = useState(false);

  return (
    <button
      onClick={() => {
        setPressed(true);
        setTimeout(() => setPressed(false), 200);
        onSelect();
      }}
      style={{
        flex:         "1 1 calc(50% - 6px)",
        minWidth:     0,
        padding:      "18px 15px",
        borderRadius: 20,
        border:       `1.5px solid ${selected ? option.color + "65" : "rgba(255,255,255,0.07)"}`,
        background:   selected
          ? `linear-gradient(145deg, ${option.color}16, ${option.color}06)`
          : "rgba(255,255,255,0.026)",
        boxShadow:    selected
          ? `0 0 22px ${option.glow}, 0 6px 28px rgba(0,0,0,0.28)`
          : "none",
        cursor:       "pointer",
        textAlign:    "left",
        transform:    pressed ? "scale(0.94)" : selected ? "scale(1.04)" : "scale(1)",
        transition:   `all 0.22s ${SPRING}`,
        display:      "flex",
        flexDirection:"column",
        gap:          7,
        animation:    `ob-card-in 0.5s ${delay}s both`,
      }}
    >
      <div style={{ fontSize: 30, lineHeight: 1 }}>{option.emoji}</div>

      <div style={{
        fontSize: 15, fontWeight: 800,
        color: selected ? option.color : "#fff",
        transition: `color 0.18s ${IOS}`,
      }}>
        {option.label}
      </div>

      <div style={{
        fontSize: 11.5, color: "rgba(255,255,255,0.42)",
        lineHeight: 1.55,
      }}>
        {option.description}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 2 }}>
        {option.tags.map((tag) => (
          <span key={tag} style={{
            fontSize: 9, fontWeight: 700, letterSpacing: "0.07em",
            textTransform: "uppercase",
            color:      selected ? option.color       : "rgba(255,255,255,0.28)",
            background: selected ? `${option.color}1E` : "rgba(255,255,255,0.06)",
            padding: "2px 7px", borderRadius: 5,
            transition: `all 0.18s ${IOS}`,
          }}>
            {tag}
          </span>
        ))}
      </div>
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PersonalitySetup({ exiting, onComplete }: PersonalitySetupProps) {
  const { setPersonalityId } = usePersonality();
  const [selected,  setSelected]  = useState<ApexPersonalityId | null>(null);
  const [btnPressed, setBtnPressed] = useState(false);

  /** Called by the spec as selectPersonality(type) */
  function selectPersonality(id: ApexPersonalityId) {
    setSelected(id);
    setPersonalityId(id);       // live preview — applies immediately
  }

  function handleEnter() {
    if (!selected) return;
    setBtnPressed(true);
    setTimeout(onComplete, 320);
  }

  const wrapAnim = exiting
    ? "ob-fade-out 0.36s ease forwards"
    : "ob-fade-in  0.55s ease both";

  const selectedOpt = OPTIONS.find((o) => o.id === selected);

  return (
    <div style={{
      width: "100%", maxWidth: 430,
      display: "flex", flexDirection: "column",
      padding: "76px 22px 44px",
      animation: wrapAnim,
      gap: 0,
    }}>

      {/* Header */}
      <div style={{ marginBottom: 24, textAlign: "center" }}>
        <div style={{
          fontSize: 10, fontWeight: 800, letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "#A29BFE", marginBottom: 10,
          animation: "ob-fade-in 0.5s 0.05s both",
        }}>
          Quick Setup
        </div>
        <div style={{
          fontSize: 25, fontWeight: 900, color: "#fff",
          letterSpacing: "-0.022em", lineHeight: 1.25,
          animation: "ob-fade-in 0.6s 0.12s both",
        }}>
          How should I interact<br />with you?
        </div>
        <div style={{
          fontSize: 12.5, color: "rgba(255,255,255,0.33)",
          marginTop: 8, animation: "ob-fade-in 0.5s 0.22s both",
        }}>
          Pick a default style — blend anytime from your profile.
        </div>
      </div>

      {/* 2×2 card grid */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: 11,
        marginBottom: 14,
      }}>
        {OPTIONS.map((opt, i) => (
          <PersonalityCard
            key={opt.id}
            option={opt}
            selected={selected === opt.id}
            delay={0.28 + i * 0.07}
            onSelect={() => selectPersonality(opt.id)}
          />
        ))}
      </div>

      {/* Selected confirmation blurb */}
      {selectedOpt && (
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "12px 16px", borderRadius: 14,
          background: "rgba(255,255,255,0.03)",
          border: `1px solid ${selectedOpt.color}22`,
          marginBottom: 14,
          animation: "ob-confirm-in 0.32s ease both",
        }}>
          <div style={{ fontSize: 20 }}>{selectedOpt.emoji}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.48)", lineHeight: 1.5 }}>
            <strong style={{ color: "#fff" }}>{selectedOpt.label}</strong> mode selected.
            {" "}You can blend personalities anytime from your profile.
          </div>
        </div>
      )}

      {/* Enter Apex button */}
      <button
        onClick={handleEnter}
        disabled={!selected}
        style={{
          width: "100%", padding: "16px",
          borderRadius: 17, border: "none",
          fontSize: 15, fontWeight: 800,
          letterSpacing: "-0.01em",
          cursor: selected ? "pointer" : "not-allowed",
          background: selected
            ? "linear-gradient(135deg, #6C5CE7, #A29BFE 55%, #FD79A8)"
            : "rgba(255,255,255,0.06)",
          color: selected ? "#fff" : "rgba(255,255,255,0.22)",
          transform: btnPressed
            ? "scale(0.96)"
            : selected ? "scale(1)" : "scale(1)",
          transition: `all 0.25s ${SPRING}`,
          animation: selected ? "ob-btn-glow 2.5s ease-in-out infinite" : "none",
          boxShadow: selected ? "0 4px 24px rgba(108,92,231,0.40)" : "none",
        }}
        onMouseEnter={(e) => {
          if (selected) e.currentTarget.style.transform = "scale(1.02)";
        }}
        onMouseLeave={(e) => {
          if (!btnPressed) e.currentTarget.style.transform = "scale(1)";
        }}
      >
        {selected ? "Enter Apex →" : "Choose your style above"}
      </button>

      {/* Micro legal */}
      <p style={{
        fontSize: 10, color: "rgba(255,255,255,0.16)",
        textAlign: "center", marginTop: 14, lineHeight: 1.6,
      }}>
        Apex learns your preferences to personalise your experience.
      </p>
    </div>
  );
}
