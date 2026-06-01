/**
 * OnboardingBackground — shared background components for the FTUE screens.
 * Kept in a separate .tsx file so the hook (useOnboarding.ts) stays JSX-free.
 */

export function StarField() {
  const stars = Array.from({ length: 55 }, (_, i) => ({
    id:  i,
    x:   (i * 37.3 + 11) % 100,
    y:   (i * 51.7 + 7)  % 100,
    r:   0.4 + (i % 3) * 0.5,
    dur: 2 + (i % 4),
    del: (i * 0.17) % 4,
  }));

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      {stars.map((s) => (
        <div key={s.id} style={{
          position: "absolute",
          left: `${s.x}%`, top: `${s.y}%`,
          width: s.r * 2, height: s.r * 2,
          borderRadius: "50%",
          background: "#fff",
          animation: `ob-star ${s.dur}s ${s.del}s ease-in-out infinite`,
        }} />
      ))}
    </div>
  );
}

export function AmbientOrbs() {
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      {([
        { c: "#6C5CE7", x: "12%",  y: "22%", sz: 320, bl: 130 },
        { c: "#A29BFE", x: "82%",  y: "68%", sz: 260, bl: 110 },
        { c: "#FD79A8", x: "58%",  y: "8%",  sz: 190, bl:  80 },
      ] as const).map((o, i) => (
        <div key={i} style={{
          position: "absolute",
          left: o.x, top: o.y,
          width: o.sz, height: o.sz,
          borderRadius: "50%",
          background: o.c,
          filter: `blur(${o.bl}px)`,
          opacity: 0.07,
          transform: "translate(-50%,-50%)",
        }} />
      ))}
    </div>
  );
}
