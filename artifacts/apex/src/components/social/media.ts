/**
 * On-device media tools for Social: getting a reel ready to upload, recording voice notes, and drawing memes.
 *
 * Reels: up to 60 seconds. Small files (30 MB or less) upload as they are. Bigger ones are re-encoded in the
 * browser to 720p at a bitrate that fits, which takes about as long as the clip itself.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export const REEL_MAX_MS = 60_500;
const UPLOAD_AS_IS_BYTES = 30 * 1024 * 1024;
const TARGET_BYTES = 28 * 1024 * 1024;

export interface PreparedVideo {
  blob: Blob;
  durationMs: number;
  width: number;
  height: number;
  /** First-frame cover as a JPEG data URL */
  poster: { dataUrl: string; width: number; height: number };
  previewUrl: string;
}

function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "auto";
    v.muted = true;
    v.playsInline = true;
    v.src = url;
    v.onloadedmetadata = () => resolve(v);
    v.onerror = () => reject(new Error("This video can't be read here. Try an MP4 from your camera roll."));
  });
}

const seek = (v: HTMLVideoElement, t: number) => new Promise<void>((resolve) => { v.onseeked = () => resolve(); v.currentTime = t; });

/** Some recorded WebM files report no duration until you seek to the end. */
async function durationOf(v: HTMLVideoElement): Promise<number> {
  if (Number.isFinite(v.duration) && v.duration > 0) return v.duration;
  await seek(v, 1e7);
  const d = v.duration;
  await seek(v, 0);
  return Number.isFinite(d) ? d : 0;
}

function frame(v: HTMLVideoElement, max = 720) {
  const scale = Math.min(1, max / Math.max(v.videoWidth, v.videoHeight));
  const w = Math.max(2, Math.round((v.videoWidth * scale) / 2) * 2);
  const h = Math.max(2, Math.round((v.videoHeight * scale) / 2) * 2);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  c.getContext("2d")!.drawImage(v, 0, 0, w, h);
  return { c, w, h };
}

function recorderType(): string {
  const options = ["video/mp4;codecs=avc1,mp4a", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  return options.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) ?? "";
}

export async function prepareVideo(file: File, onProgress?: (p: number, stage: "reading" | "compressing") => void): Promise<PreparedVideo> {
  if (!file.type.startsWith("video/")) throw new Error("Pick a video file.");
  const url = URL.createObjectURL(file);
  const v = await loadVideo(url);
  onProgress?.(0, "reading");
  const seconds = await durationOf(v);
  if (seconds * 1000 > REEL_MAX_MS) throw new Error(`Reels can be up to 60 seconds. This one is ${Math.round(seconds)}s, so trim it first.`);
  await seek(v, Math.min(0.5, seconds / 2));
  const cover = frame(v, 720);
  const poster = { dataUrl: cover.c.toDataURL("image/jpeg", 0.82), width: cover.w, height: cover.h };

  const playable = ["video/mp4", "video/webm", "video/quicktime"].includes(file.type);
  if (playable && file.size <= UPLOAD_AS_IS_BYTES) {
    return { blob: file, durationMs: seconds * 1000, width: v.videoWidth, height: v.videoHeight, poster, previewUrl: url };
  }

  // Too big: re-encode at 720p while the clip plays through once
  const type = recorderType();
  if (!type || !("captureStream" in HTMLCanvasElement.prototype)) throw new Error("This video is over 30 MB and your browser can't shrink it. Try a shorter clip.");
  await seek(v, 0);
  const { c, w, h } = frame(v, 720);
  const g = c.getContext("2d")!;
  const stream = (c as HTMLCanvasElement & { captureStream(fps?: number): MediaStream }).captureStream(30);
  let audioCtx: AudioContext | null = null;
  try {
    audioCtx = new AudioContext();
    const src = audioCtx.createMediaElementSource(v);
    const dest = audioCtx.createMediaStreamDestination();
    src.connect(dest);
    dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    v.muted = false;
  } catch { /* no sound track, or the browser won't share it: the reel is silent */ }

  const bits = Math.max(600_000, Math.min(2_500_000, Math.floor((TARGET_BYTES * 8) / Math.max(1, seconds)) - 128_000));
  const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: bits, audioBitsPerSecond: 96_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<void>((resolve) => (rec.onstop = () => resolve()));
  let raf = 0;
  const draw = () => {
    g.drawImage(v, 0, 0, w, h);
    onProgress?.(Math.min(0.99, v.currentTime / seconds), "compressing");
    if (!v.ended) raf = requestAnimationFrame(draw);
  };
  v.onended = () => { cancelAnimationFrame(raf); rec.stop(); };
  rec.start(1000);
  await v.play();
  draw();
  await done;
  await audioCtx?.close().catch(() => undefined);
  const blob = new Blob(chunks, { type: type.split(";")[0] });
  if (blob.size > 32 * 1024 * 1024) throw new Error("Even shrunk, this video is too big. Try a shorter clip.");
  onProgress?.(1, "compressing");
  return { blob, durationMs: seconds * 1000, width: w, height: h, poster, previewUrl: URL.createObjectURL(blob) };
}

// ── Voice notes ───────────────────────────────────────────────────────────────

export const VOICE_MAX_MS = 60_000;

export function useVoiceRecorder() {
  const [state, setState] = useState<"idle" | "recording" | "done">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<{ blob: Blob; url: string; durationMs: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const timer = useRef<number>(0);

  const stop = useCallback(() => { if (rec.current?.state === "recording") rec.current.stop(); }, []);
  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
      const r = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      const chunks: Blob[] = [];
      const began = Date.now();
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      r.onstop = () => {
        clearInterval(timer.current);
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: (r.mimeType || "audio/webm").split(";")[0] });
        setResult({ blob, url: URL.createObjectURL(blob), durationMs: Math.min(VOICE_MAX_MS, Date.now() - began) });
        setState("done");
      };
      rec.current = r;
      r.start(500);
      setElapsed(0);
      setState("recording");
      timer.current = window.setInterval(() => {
        const ms = Date.now() - began;
        setElapsed(ms);
        if (ms >= VOICE_MAX_MS) r.stop();
      }, 200);
    } catch {
      setError("Apex needs your microphone to record. Allow it in your browser settings and try again.");
    }
  }, []);
  const reset = useCallback(() => { stop(); setResult(null); setElapsed(0); setState("idle"); }, [stop]);
  useEffect(() => () => { clearInterval(timer.current); if (rec.current?.state === "recording") rec.current.stop(); }, []);
  return { state, elapsed, result, error, start, stop, reset };
}

// ── Memes ─────────────────────────────────────────────────────────────────────

export const MEME_BACKDROPS = [
  "linear-gradient(160deg,#24242B,#0A0A0C)",
  "linear-gradient(160deg,#EBCB8B,#8A6A34)",
  "linear-gradient(160deg,#FF9B6B,#9C3B1E)",
  "linear-gradient(160deg,#5F9CC6,#16324A)",
];
const BACKDROP_STOPS: [string, string][] = [["#24242B", "#0A0A0C"], ["#EBCB8B", "#8A6A34"], ["#FF9B6B", "#9C3B1E"], ["#5F9CC6", "#16324A"]];

function wrap(g: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.toUpperCase().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

/** Draws classic meme text (white, black outline) over a photo or a plain backdrop. Returns a JPEG. */
export async function renderMeme(opts: { photo?: string; backdrop?: number; top: string; bottom: string }): Promise<{ dataUrl: string; width: number; height: number }> {
  const W = 1080;
  let H = 1080;
  let img: HTMLImageElement | null = null;
  if (opts.photo) {
    img = await new Promise<HTMLImageElement>((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error("Couldn't read that photo.")); i.src = opts.photo!; });
    H = Math.round(Math.min(1.6, Math.max(0.6, img.height / img.width)) * W);
  }
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  if (img) {
    // Cover-fit the photo
    const s = Math.max(W / img.width, H / img.height);
    g.drawImage(img, (W - img.width * s) / 2, (H - img.height * s) / 2, img.width * s, img.height * s);
  } else {
    const [a, b] = BACKDROP_STOPS[opts.backdrop ?? 0] ?? BACKDROP_STOPS[0]!;
    const grd = g.createLinearGradient(0, 0, W, H); grd.addColorStop(0, a); grd.addColorStop(1, b);
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
  }
  const size = 96;
  g.font = `900 ${size}px Impact, "Anton", "Arial Black", sans-serif`;
  g.textAlign = "center";
  g.lineJoin = "round";
  g.fillStyle = "#fff";
  g.strokeStyle = "#000";
  g.lineWidth = size / 8;
  const draw = (text: string, fromTop: boolean) => {
    const lines = wrap(g, text, W - 80);
    lines.forEach((l, i) => {
      const y = fromTop ? 40 + size + i * size * 1.05 : H - 40 - (lines.length - 1 - i) * size * 1.05;
      g.strokeText(l, W / 2, y);
      g.fillText(l, W / 2, y);
    });
  };
  if (opts.top.trim()) draw(opts.top, true);
  if (opts.bottom.trim()) draw(opts.bottom, false);
  let q = 0.88;
  let dataUrl = c.toDataURL("image/jpeg", q);
  while (dataUrl.length > 1_100_000 && q > 0.5) { q -= 0.08; dataUrl = c.toDataURL("image/jpeg", q); }
  return { dataUrl, width: W, height: H };
}
