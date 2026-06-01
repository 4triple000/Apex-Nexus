import { useState, useEffect } from "react";

const GRAD = "linear-gradient(135deg,#6C5CE7,#A29BFE,#FD79A8)";
const PURPLE = "#A29BFE";
const GREEN = "#55EFC4";

export default function VoiceUI() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("Tap the mic to start talking…");
  const [bars, setBars] = useState([0.3, 0.5, 0.4, 0.6, 0.5]);

  useEffect(() => {
    if (!listening) return;
    const interval = setInterval(() => {
      setBars(prev => prev.map(() => 0.2 + Math.random() * 0.8));
    }, 100);
    return () => clearInterval(interval);
  }, [listening]);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (listening) {
      setListening(false);
      setBars([0.3, 0.5, 0.4, 0.6, 0.5]);
      setTranscript("How's the weather today?");
      setResponse("It's 72°F and sunny in San Francisco! ☀️ Perfect day to build with Apex.");
    } else {
      setListening(true);
      setTranscript("");
      setResponse("");
    }
  };

  return (
    <div style={{ background: "#0A0A12", borderRadius: 12, padding: "14px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}
         onClick={e => e.stopPropagation()}>
      <button
        onClick={toggle}
        style={{
          width: 56, height: 56, borderRadius: "50%", border: "none",
          background: listening ? "rgba(253,121,168,0.2)" : GRAD,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer",
          boxShadow: listening ? "0 0 24px rgba(253,121,168,0.5)" : "0 4px 20px rgba(108,92,231,0.5)",
          animation: listening ? "micPulse 1.2s ease-in-out infinite" : "none",
        }}
      >
        <span style={{ fontSize: 22 }}>{listening ? "⏹" : "🎙️"}</span>
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 3, height: 28 }}>
        {bars.map((h, i) => (
          <div key={i} style={{ width: 3, borderRadius: 2, background: listening ? `hsl(${260 + i * 15},80%,70%)` : "rgba(255,255,255,0.1)", height: listening ? `${h * 28}px` : "4px", transition: "height 0.1s ease", }} />
        ))}
      </div>

      <div style={{ textAlign: "center", width: "100%" }}>
        {listening && (
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#FD79A8", animation: "blink 1s ease-in-out infinite" }} />
            Listening…
          </div>
        )}
        {transcript && <div style={{ fontSize: 10, color: PURPLE, fontStyle: "italic", marginBottom: 6 }}>"{transcript}"</div>}
        {response && <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.65)", lineHeight: 1.5 }}>{response}</div>}
      </div>
      <style>{`@keyframes micPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}@keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
    </div>
  );
}
