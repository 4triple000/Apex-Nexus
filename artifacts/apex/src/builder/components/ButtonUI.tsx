import { useState } from "react";

const GRAD = "linear-gradient(135deg,#6C5CE7,#A29BFE,#FD79A8)";

export default function ButtonUI({ label = "Tap Me", color }: { label?: string; color?: string }) {
  const [pressed, setPressed] = useState(false);
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const [clicks, setClicks] = useState(0);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now();
    setRipples(prev => [...prev, { id, x, y }]);
    setClicks(c => c + 1);
    setTimeout(() => setRipples(prev => prev.filter(r => r.id !== id)), 600);
  };

  const bg = color ? `linear-gradient(135deg,${color},${color}cc)` : GRAD;

  return (
    <div style={{ padding: "16px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, background: "#0A0A12", borderRadius: 12 }}
         onClick={e => e.stopPropagation()}>
      <button
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}
        onClick={handleClick}
        style={{
          width: "100%", padding: "12px 0", borderRadius: 12, border: "none",
          background: bg,
          color: "white", fontSize: 12, fontWeight: 800,
          cursor: "pointer", position: "relative", overflow: "hidden",
          transform: pressed ? "scale(0.95)" : "scale(1)",
          transition: "transform 0.1s ease",
          boxShadow: pressed ? "none" : "0 4px 18px rgba(108,92,231,0.5)",
          fontFamily: "-apple-system,BlinkMacSystemFont,sans-serif",
        }}
      >
        {label}
        {ripples.map(r => (
          <span key={r.id} style={{
            position: "absolute", left: r.x - 20, top: r.y - 20,
            width: 40, height: 40, borderRadius: "50%",
            background: "rgba(255,255,255,0.3)",
            animation: "rippleOut 0.6s ease-out forwards",
            pointerEvents: "none",
          }} />
        ))}
      </button>
      {clicks > 0 && (
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontWeight: 600 }}>
          Tapped {clicks} {clicks === 1 ? "time" : "times"} ✓
        </div>
      )}
      <style>{`@keyframes rippleOut{to{transform:scale(3);opacity:0}}`}</style>
    </div>
  );
}
