import { useState, useEffect } from "react";

const GRAD = "linear-gradient(135deg,#6C5CE7,#A29BFE)";
const GOLD = "#FFCC33";
const GREEN = "#55EFC4";

const QUICK_ACTIONS = ["Summarize", "Translate", "Write code", "Analyze"];
const AUTO_MSGS = [
  "Hello! I'm your AI assistant. Ask me anything 🚀",
  "I can write code, answer questions, and more!",
  "Try one of the quick actions below ⬇️",
];

export default function AIAssistant() {
  const [msgIdx, setMsgIdx] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [charIdx, setCharIdx] = useState(0);
  const [activeAction, setActiveAction] = useState<string | null>(null);

  useEffect(() => {
    const msg = AUTO_MSGS[msgIdx];
    if (charIdx < msg.length) {
      const t = setTimeout(() => { setDisplayText(msg.slice(0, charIdx + 1)); setCharIdx(c => c + 1); }, 30);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => {
        setMsgIdx(i => (i + 1) % AUTO_MSGS.length);
        setCharIdx(0);
        setDisplayText("");
      }, 2500);
      return () => clearTimeout(t);
    }
  }, [charIdx, msgIdx]);

  const handleAction = (action: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveAction(action);
    setDisplayText("");
    setCharIdx(0);
    setTimeout(() => {
      const responses: Record<string, string> = {
        "Summarize": "I'll condense that into key points for you! 📝",
        "Translate":  "Which language? I support 50+ languages 🌍",
        "Write code": "Share your requirements and I'll code it! 💻",
        "Analyze":    "Drop in your data and I'll find patterns 📊",
      };
      const full = responses[action] || "On it!";
      let i = 0;
      const interval = setInterval(() => {
        i++;
        setDisplayText(full.slice(0, i));
        if (i >= full.length) clearInterval(interval);
      }, 30);
    }, 400);
  };

  return (
    <div style={{ background: "#0A0A12", borderRadius: 12, overflow: "hidden" }}
         onClick={e => e.stopPropagation()}>
      <div style={{ padding: "10px 12px", background: "rgba(108,92,231,0.08)", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: GRAD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>✨</div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#E8EAED" }}>Apex AI Assistant</div>
          <div style={{ fontSize: 8, color: GOLD }}>● GPT-4 powered</div>
        </div>
      </div>

      <div style={{ padding: "14px 12px 10px", minHeight: 60 }}>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", lineHeight: 1.6, minHeight: 36 }}>
          {displayText}<span style={{ display: "inline-block", width: 2, height: 12, background: "#A29BFE", marginLeft: 1, animation: "blink 1s step-end infinite", verticalAlign: "text-bottom" }} />
        </div>
      </div>

      <div style={{ padding: "0 12px 12px", display: "flex", flexWrap: "wrap", gap: 5 }}>
        {QUICK_ACTIONS.map(a => (
          <button
            key={a}
            onClick={e => handleAction(a, e)}
            style={{
              fontSize: 9, fontWeight: 700, padding: "4px 10px", borderRadius: 99,
              border: `1px solid ${activeAction === a ? "#A29BFE44" : "rgba(255,255,255,0.08)"}`,
              background: activeAction === a ? "rgba(162,155,254,0.15)" : "rgba(255,255,255,0.04)",
              color: activeAction === a ? "#A29BFE" : "rgba(255,255,255,0.4)",
              cursor: "pointer", transition: "all 0.15s ease",
            }}
          >
            {a}
          </button>
        ))}
      </div>
      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}`}</style>
    </div>
  );
}
