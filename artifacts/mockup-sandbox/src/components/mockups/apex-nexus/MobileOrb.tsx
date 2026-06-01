import React from 'react';
import { X, MoreVertical, Brain } from 'lucide-react';

// Waveform — bars go both up AND down from center axis
const WAVE_ORB = [3, 5, 8, 13, 19, 26, 34, 38, 34, 26, 19, 13, 8, 5, 3];

export function MobileOrb() {
  return (
    <div style={{ width: 390, height: 844, background: "#07070E", color: "white", fontFamily: "'Inter', sans-serif", overflow: "hidden", display: "flex", flexDirection: "column", position: "relative" }}>

      {/* Deep ambient glow behind orb */}
      <div style={{ position: "absolute", top: 120, left: "50%", transform: "translateX(-50%)", width: 380, height: 380, background: "radial-gradient(circle, rgba(80,30,200,0.5) 0%, rgba(50,40,180,0.25) 40%, transparent 68%)", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "absolute", top: 160, left: "50%", transform: "translateX(-50%)", width: 220, height: 220, background: "radial-gradient(circle, rgba(130,50,255,0.4) 0%, transparent 70%)", filter: "blur(24px)", pointerEvents: "none", zIndex: 0 }} />

      {/* Top Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "50px 22px 0", position: "relative", zIndex: 10, flexShrink: 0 }}>
        <button style={{ width: 38, height: 38, borderRadius: 19, background: "transparent", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <X style={{ width: 22, height: 22, color: "rgba(255,255,255,0.8)" }} />
        </button>
        <h2 style={{ fontSize: 17, fontWeight: 600, margin: 0, letterSpacing: 0.2 }}>Apex Orb</h2>
        <button style={{ width: 38, height: 38, borderRadius: 19, background: "transparent", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative" }}>
          <MoreVertical style={{ width: 22, height: 22, color: "rgba(255,255,255,0.8)" }} />
          <div style={{ position: "absolute", top: 7, right: 7, width: 7, height: 7, borderRadius: 4, background: "#60A5FA", border: "1.5px solid #07070E" }} />
        </button>
      </div>

      {/* Orb SVG */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: 22, position: "relative", zIndex: 10, flexShrink: 0 }}>
        <svg width="260" height="260" viewBox="0 0 260 260" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="orb-bloom" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="14" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="orb-glow-md" x="-35%" y="-35%" width="170%" height="170%">
              <feGaussianBlur stdDeviation="7" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="orb-glow-sm" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3.5" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <radialGradient id="orb-fill" cx="40%" cy="35%" r="65%">
              <stop offset="0%" stopColor="rgba(130,55,230,0.55)"/>
              <stop offset="45%" stopColor="rgba(60,20,140,0.5)"/>
              <stop offset="100%" stopColor="rgba(7,5,20,0.97)"/>
            </radialGradient>
            <linearGradient id="orb-ring" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#A855F7"/>
              <stop offset="35%" stopColor="#7C3AED"/>
              <stop offset="65%" stopColor="#4F46E5"/>
              <stop offset="100%" stopColor="#3B82F6"/>
            </linearGradient>
            <radialGradient id="orb-inner" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(150,90,255,0.35)"/>
              <stop offset="100%" stopColor="transparent"/>
            </radialGradient>
          </defs>

          {/* Outermost faint dot ring */}
          <circle cx="130" cy="130" r="122" fill="none" stroke="rgba(100,120,255,0.25)" strokeWidth="1" strokeDasharray="3 9"/>

          {/* Outer bloom ring */}
          <circle cx="130" cy="130" r="112" fill="none" stroke="#7C3AED" strokeWidth="3" opacity="0.55" filter="url(#orb-bloom)"/>

          {/* Main glowing ring */}
          <circle cx="130" cy="130" r="108" fill="none" stroke="url(#orb-ring)" strokeWidth="3.5" filter="url(#orb-glow-md)"/>

          {/* Secondary inner ring */}
          <circle cx="130" cy="130" r="100" fill="none" stroke="rgba(180,120,255,0.3)" strokeWidth="1.5"/>

          {/* Orb fill */}
          <circle cx="130" cy="130" r="96" fill="url(#orb-fill)"/>

          {/* Inner glow overlay */}
          <circle cx="130" cy="130" r="96" fill="url(#orb-inner)"/>

          {/* Inner accent ring */}
          <circle cx="130" cy="130" r="74" fill="none" stroke="rgba(160,100,255,0.15)" strokeWidth="1"/>

          {/* Small blue dot top-right of orb area */}
          <circle cx="198" cy="66" r="5" fill="#60A5FA" filter="url(#orb-glow-sm)"/>

          {/* Apex A logo */}
          <g filter="url(#orb-glow-sm)">
            <line x1="130" y1="96" x2="104" y2="164" stroke="white" strokeWidth="5" strokeLinecap="round"/>
            <line x1="130" y1="96" x2="156" y2="164" stroke="white" strokeWidth="5" strokeLinecap="round"/>
            <line x1="113" y1="140" x2="147" y2="140" stroke="white" strokeWidth="4.5" strokeLinecap="round"/>
          </g>

          {/* Highlight glint */}
          <ellipse cx="104" cy="105" rx="16" ry="9" fill="rgba(255,255,255,0.055)" transform="rotate(-30 104 105)"/>
        </svg>
      </div>

      {/* Status text */}
      <div style={{ textAlign: "center", position: "relative", zIndex: 10, flexShrink: 0, marginTop: 12 }}>
        <h3 style={{ fontSize: 26, fontWeight: 500, margin: "0 0 5px", letterSpacing: 1.2, color: "rgba(255,255,255,0.95)" }}>Listening...</h3>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", margin: 0 }}>Tap to stop</p>
      </div>

      {/* Mirrored waveform */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: 16, position: "relative", zIndex: 10, flexShrink: 0 }}>
        <svg width="280" height="40" viewBox="0 0 280 40" fill="none">
          <defs>
            <linearGradient id="orbWave" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#6D28D9" stopOpacity="0.3"/>
              <stop offset="25%" stopColor="#9333EA" stopOpacity="0.9"/>
              <stop offset="50%" stopColor="#A855F7" stopOpacity="1"/>
              <stop offset="75%" stopColor="#9333EA" stopOpacity="0.9"/>
              <stop offset="100%" stopColor="#6D28D9" stopOpacity="0.3"/>
            </linearGradient>
          </defs>
          {WAVE_ORB.map((h, i) => (
            <g key={i}>
              <rect x={i * 17 + 5} y={20 - h} width={7} height={h} rx="3.5" fill="url(#orbWave)" opacity="0.9"/>
              <rect x={i * 17 + 5} y={20} width={7} height={h} rx="3.5" fill="url(#orbWave)" opacity="0.55"/>
            </g>
          ))}
        </svg>
      </div>

      {/* Control buttons — 3 equal square buttons */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 20, marginTop: 22, position: "relative", zIndex: 10, flexShrink: 0 }}>
        {/* Mic */}
        <button style={{ width: 54, height: 54, borderRadius: 16, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        </button>
        {/* Keyboard / grid */}
        <button style={{ width: 54, height: 54, borderRadius: 16, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2"/>
            <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M8 16h8"/>
          </svg>
        </button>
        {/* Settings */}
        <button style={{ width: 54, height: 54, borderRadius: 16, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>
          </svg>
        </button>
      </div>

      {/* Bottom sheet */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(10,8,24,0.98)", borderTop: "1px solid rgba(255,255,255,0.07)", borderRadius: "0px", padding: "20px 24px 40px", zIndex: 20 }}>

        {/* Apex Personality section */}
        <div style={{ marginBottom: 6 }}>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.38)", textTransform: "uppercase", letterSpacing: 1.3, margin: "0 0 5px", fontWeight: 600 }}>Apex Personality</p>
          <p style={{ fontSize: 14, fontWeight: 500, margin: "0 0 14px", color: "rgba(255,255,255,0.85)" }}>Relentless. Intelligent. Loyal.</p>
          <button style={{
            width: "100%",
            padding: "12px 0",
            borderRadius: 10,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.85)",
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
            letterSpacing: 0.2,
          }}>Customize</button>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "18px 0" }} />

        {/* Memory Status */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.38)", textTransform: "uppercase", letterSpacing: 1.3, margin: "0 0 5px", fontWeight: 600 }}>Memory Status</p>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.75)", margin: 0 }}>Always learning. Always evolving.</p>
          </div>
          <Brain style={{ width: 28, height: 28, color: "rgba(255,255,255,0.18)", flexShrink: 0, marginLeft: 12 }} />
        </div>
      </div>

    </div>
  );
}
