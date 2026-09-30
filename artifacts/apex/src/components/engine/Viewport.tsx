/**
 * The Engine's view of your game: a still preview drawn from the game's data, or the live game while playing.
 */
import { useEffect, useRef } from "react";
import { Play } from "lucide-react";
import { ApexGameRuntime } from "@/components/game/ApexGameRuntime";
import type { GameConfig } from "@/engine/types";

const COLORS: Record<string, string> = { red: "#ff4d6d", orange: "#ff9f43", blue: "#4dabff", cyan: "#22d3ee", green: "#4ade80", purple: "#a78bfa", gold: "#ffd166" };
const col = (c?: string, fallback = "#8b7bff") => (c ? COLORS[c] ?? c : fallback);

function drawPreview(canvas: HTMLCanvasElement, cfg: GameConfig) {
  const r = canvas.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = r.width * dpr;
  canvas.height = r.height * dpr;
  const x = canvas.getContext("2d");
  if (!x) return;
  x.scale(dpr, dpr);
  const W = r.width, H = r.height;
  x.fillStyle = "#070612";
  x.fillRect(0, 0, W, H);

  const threeD = cfg.gameMode === "fps" || cfg.gameMode === "openworld" || cfg.gameMode === "gta";
  if (threeD) {
    const hz = H * 0.42;
    const sky = x.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, "#0b0a24");
    sky.addColorStop(1, cfg.worldConfig?.world.skyColor ?? "#2b1d6e");
    x.fillStyle = sky;
    x.fillRect(0, 0, W, hz);
    for (let i = 0; i < 16; i++) {
      const bw = W / 16, bh = 18 + ((i * 37) % 70);
      x.fillStyle = i % 3 ? "#16123a" : "#1d1850";
      x.fillRect(i * bw, hz - bh, bw - 2, bh);
    }
    x.strokeStyle = "rgba(139,123,255,.35)";
    x.lineWidth = 1;
    for (let i = -14; i <= 14; i++) { x.beginPath(); x.moveTo(W / 2 + i * 9, hz); x.lineTo(W / 2 + i * 80, H); x.stroke(); }
    for (let j = 1; j < 10; j++) { const y = hz + (H - hz) * Math.pow(j / 10, 1.8); x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke(); }
    const spawns = cfg.worldConfig?.enemies ?? [];
    spawns.slice(0, 24).forEach((e, i) => {
      // Rough top-down-to-perspective placement of enemy spawns
      const depth = Math.min(1, Math.max(0.08, (e.spawn.z + 40) / 80));
      const px = W / 2 + (e.spawn.x / 40) * W * 0.45 * depth;
      const py = hz + (H - hz) * depth * 0.85;
      const s = 6 + depth * 14;
      x.fillStyle = "#ff4fa3";
      x.shadowColor = "#ff4fa3";
      x.shadowBlur = 10;
      x.fillRect(px - s / 2, py - s * 1.6, s, s * 1.6);
      x.shadowBlur = 0;
      void i;
    });
    x.fillStyle = "#4ade80";
    x.shadowColor = "#4ade80";
    x.shadowBlur = 14;
    x.fillRect(W / 2 - 11, H - 50, 22, 36);
    x.shadowBlur = 0;
    return;
  }

  // 2D games: fit the level into the view
  const LW = cfg.endX ? Math.max(cfg.width ?? 400, cfg.endX + 60) : cfg.width ?? 400;
  const LH = cfg.height ?? 600;
  const s = Math.min(W / LW, H / LH);
  const ox = (W - LW * s) / 2, oy = (H - LH * s) / 2;
  x.fillStyle = cfg.background ?? "#0d0b22";
  x.fillRect(ox, oy, LW * s, LH * s);
  const rect = (rx: number, ry: number, rw: number, rh: number, c: string, glow = false) => {
    x.fillStyle = c;
    if (glow) { x.shadowColor = c; x.shadowBlur = 10; }
    x.fillRect(ox + rx * s, oy + ry * s, Math.max(1, rw * s), Math.max(1, rh * s));
    x.shadowBlur = 0;
  };
  cfg.platforms.forEach((p) => {
    rect(p.x, p.y, p.width, p.height, col(p.color, "#2d3561"));
    // Bright top edge so dark platforms read on a dark background
    rect(p.x, p.y, p.width, Math.max(1.5 / s, 2), "rgba(162,155,254,0.85)");
  });
  (cfg.coins ?? []).forEach((c) => {
    x.fillStyle = col(c.color, "#ffd166");
    x.beginPath();
    x.arc(ox + c.x * s, oy + c.y * s, Math.max(2, c.radius * s), 0, Math.PI * 2);
    x.fill();
  });
  if (cfg.basket) rect(cfg.basket.x, cfg.basket.y, cfg.basket.width, 4, "#ff8a4c", true);
  cfg.enemies.forEach((e) => rect(e.x, Math.max(0, e.y), e.width, e.height, col(e.color, "#ff4d6d"), true));
  rect(cfg.player.x, cfg.player.y, cfg.player.width, cfg.player.height, col(cfg.player.color, "#4ade80"), true);
}

export function Viewport({ config, playing, onPlay, onStop, height }: { config: GameConfig | null; playing: boolean; onPlay: () => void; onStop: () => void; height?: number | string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (playing || !config || !ref.current) return;
    const c = ref.current;
    const draw = () => drawPreview(c, config);
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(c);
    return () => ro.disconnect();
  }, [config, playing]);

  return (
    <div style={{ position: "relative", background: "#070612", overflow: "hidden", height: height ?? "100%", minHeight: 0 }}>
      {playing ? (
        <ApexGameRuntime visible onClose={onStop} style={{ width: "100%", height: "100%", borderRadius: 0 }} />
      ) : (
        <>
          <canvas ref={ref} aria-label={config ? `Preview of ${config.name}` : "No game yet"} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
          {config && (
            <button onClick={onPlay} className="mg-press mg-focus" aria-label="Play your game"
              style={{ position: "absolute", left: "50%", top: "50%", translate: "-50% -50%", height: 52, padding: "0 22px", borderRadius: 26, border: 0, background: "#4ADE80", color: "#06210F", fontWeight: 800, fontSize: 15, display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", boxShadow: "0 10px 30px rgba(74,222,128,0.35)" }}>
              <Play size={17} fill="currentColor" /> Play
            </button>
          )}
        </>
      )}
    </div>
  );
}
