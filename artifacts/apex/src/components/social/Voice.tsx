/** Voice notes: the player card in posts (styled like the mockup's track card). */
import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, Play, Pause } from "lucide-react";
import { mediaSrc, clock, type Post } from "@/lib/socialApi";
import { S } from "./ui";

/** Fixed bar heights per post, so the waveform looks the same every time it's shown. */
function bars(seed: number, n = 32) {
  let x = seed * 9301 + 49297;
  return Array.from({ length: n }, () => { x = (x * 9301 + 49297) % 233280; return 0.25 + (x / 233280) * 0.75; });
}

export function VoiceCard({ post, src, durationMs, title }: { post?: Post; src?: string; durationMs?: number | null; title?: string }) {
  const url = src ?? (post?.audio ? mediaSrc(post.audio.url) : "");
  const total = durationMs ?? post?.audio?.durationMs ?? 0;
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const shape = useMemo(() => bars(post?.id ?? 7), [post?.id]);
  useEffect(() => () => ref.current?.pause(), []);
  const toggle = () => {
    const a = ref.current;
    if (!a) return;
    if (a.paused) void a.play(); else a.pause();
  };
  const length = (ref.current?.duration && Number.isFinite(ref.current.duration) ? ref.current.duration * 1000 : total) || 1;
  const pct = Math.min(1, time / length);
  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = ref.current;
    if (!a) return;
    const r = e.currentTarget.getBoundingClientRect();
    a.currentTime = ((e.clientX - r.left) / r.width) * (length / 1000);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 10, borderRadius: 14, background: S.surf2, border: `1px solid ${S.line}` }}>
      <audio ref={ref} src={url} preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => { setPlaying(false); setTime(0); }} onTimeUpdate={(e) => setTime(e.currentTarget.currentTime * 1000)} />
      <span style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(145deg, #26262C, #18181C)", color: S.gold }}><Mic size={20} /></span>
      <div style={{ flexGrow: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title ?? (post ? `${post.author.username}'s voice note` : "Voice note")}</div>
        <div role="slider" aria-label="Seek" aria-valuemin={0} aria-valuemax={Math.round(length / 1000)} aria-valuenow={Math.round(time / 1000)} tabIndex={0} onClick={seek}
          style={{ display: "flex", alignItems: "center", gap: 2, height: 20, cursor: "pointer" }}>
          {shape.map((h, i) => <span key={i} style={{ flex: 1, height: `${h * 100}%`, borderRadius: 2, background: i / shape.length <= pct ? S.gold : "rgba(255,255,255,0.18)" }} />)}
        </div>
        <div style={{ fontSize: 11.5, color: S.ink3 }}>{playing || time ? `${clock(time)} / ` : ""}{clock(length)}</div>
      </div>
      <button onClick={toggle} aria-label={playing ? "Pause" : "Play voice note"} style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0, border: `1px solid ${S.line2}`, background: "rgba(255,255,255,0.06)", color: S.ink, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
        {playing ? <Pause size={16} fill={S.ink} /> : <Play size={16} fill={S.ink} style={{ marginLeft: 2 }} />}
      </button>
    </div>
  );
}
