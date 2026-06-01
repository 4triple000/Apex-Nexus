import { useState } from "react";

export default function VideoPlayer() {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [liked, setLiked] = useState(false);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPlaying(p => {
      if (!p) {
        const interval = setInterval(() => {
          setProgress(prev => {
            if (prev >= 100) { clearInterval(interval); return 100; }
            return prev + 0.5;
          });
        }, 50);
      }
      return !p;
    });
  };

  const THUMBNAILS = ["#6C5CE7", "#FD79A8", "#00D2D3"];

  return (
    <div style={{ background: "#0A0A12", borderRadius: 12, overflow: "hidden" }}
         onClick={e => e.stopPropagation()}>
      <div style={{ position: "relative", height: 80, background: "linear-gradient(135deg,#1A0E2E,#0D1A2E)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
           onClick={toggle}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg,rgba(108,92,231,0.3),rgba(0,210,211,0.2))" }} />
        {!playing && (
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.15)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, position: "relative", zIndex: 2 }}>
            ▶
          </div>
        )}
        {playing && (
          <div style={{ display: "flex", gap: 3, position: "relative", zIndex: 2 }}>
            {[0,1,2,3,5].map(i => (
              <div key={i} style={{ width: 3, borderRadius: 2, background: "white", height: 8 + Math.random() * 20, animation: `barPulse ${0.5 + i * 0.15}s ease-in-out infinite alternate` }} />
            ))}
          </div>
        )}
        <div style={{ position: "absolute", bottom: 6, right: 8, fontSize: 8, color: "rgba(255,255,255,0.5)", zIndex: 2 }}>
          {progress >= 100 ? "2:34 / 2:34" : `${Math.floor(progress * 1.54 / 100)}:${String(Math.floor((progress * 154 / 100) % 60)).padStart(2,"0")} / 2:34`}
        </div>
      </div>

      <div style={{ padding: "4px 8px 6px" }}>
        <div style={{ height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 99, overflow: "hidden", marginBottom: 8, cursor: "pointer" }}
             onClick={e => { e.stopPropagation(); const rect = e.currentTarget.getBoundingClientRect(); setProgress(((e.clientX - rect.left) / rect.width) * 100); }}>
          <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg,#6C5CE7,#A29BFE)", borderRadius: 99, transition: "width 0.1s linear" }} />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#E8EAED" }}>Epic Game Cinematic</div>
            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)" }}>ApexStudios · 12K views</div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={e => { e.stopPropagation(); setLiked(l => !l); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14 }}>
              {liked ? "❤️" : "🤍"}
            </button>
            <button onClick={e => e.stopPropagation()} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>↗</button>
          </div>
        </div>
      </div>
      <style>{`@keyframes barPulse{from{height:8px}to{height:22px}}`}</style>
    </div>
  );
}
