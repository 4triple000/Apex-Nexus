/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  useSpeechOutput                                         ║
 * ║  Voice playback hook — ElevenLabs preferred, Web Speech ║
 * ║  API fallback                                           ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * Call speak(text, voiceStyle?, emotion?, mood?) from any component.
 *
 * Engine selection:
 *   1. ElevenLabs (API server proxy) — HD, recognisable Apex voice identity
 *      Automatically falls back to Web Speech if:
 *        - API key not configured  (503 from /api/tts/status)
 *        - Network request fails
 *        - Audio context blocked
 *   2. Web Speech API — universal browser fallback, zero latency
 *
 * Layered voice modulation (applied before playback in both engines):
 *   1. Personality VoiceStyle  (pitch, speed, tone)
 *   2. Mood override            (applyMoodToVoiceStyle)
 *   3. Emotion delta            (getEmotionVoiceModifier)
 */
import { useState, useRef, useCallback, useEffect } from "react";
import {
  VoiceStyle,
  getGlobalVoiceStyle,
  MoodId,
  applyMoodToVoiceStyle,
} from "@/lib/voicePersonality";
import { Emotion, getEmotionVoiceModifier } from "@/lib/emotionController";
import { speechPrefs } from "@/contexts/ApexStateContext";
import {
  isElevenLabsAvailable,
  speakWithElevenLabs,
  stopElevenLabsSpeech,
  getVoiceProfileForTone,
} from "@/lib/elevenLabsVoice";

const STORAGE_KEY      = "apex_voice_tts_enabled";
const STORAGE_ENGINE   = "apex_voice_engine";  // "elevenlabs" | "webspeech"

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

/** Split on sentence boundaries without lookbehind (max compat) */
function splitSentences(text: string): string[] {
  return text
    .replace(/([.!?])\s+/g, "$1\n")
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
}

/** Strip markdown/code blocks so TTS doesn't read syntax */
function cleanForTTS(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/g, "code block")
    .replace(/[*_~`>#]/g, "")
    .trim()
    .slice(0, 800);
}

// ── Engine availability (singleton check, refreshed once per session) ─────────

let _elevenLabsReady: boolean | null = null;

async function checkElevenLabs(): Promise<boolean> {
  if (_elevenLabsReady !== null) return _elevenLabsReady;
  _elevenLabsReady = await isElevenLabsAvailable();
  return _elevenLabsReady;
}

// ─────────────────────────────────────────────────────────────────────────────

export type VoiceEngine = "elevenlabs" | "webspeech";

export function useSpeechOutput() {
  const [isEnabled, setIsEnabled] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) !== "false"; } catch { return true; }
  });
  const [isSpeaking,       setIsSpeaking]       = useState(false);
  const [amplitude,        setAmplitude]         = useState(0);
  const [activeEngine,     setActiveEngine]      = useState<VoiceEngine>("webspeech");

  const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const pauseRef      = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const voicesRef     = useRef<SpeechSynthesisVoice[]>([]);
  const isEnabledRef  = useRef(isEnabled);
  useEffect(() => { isEnabledRef.current = isEnabled; }, [isEnabled]);

  // Load Web Speech voices
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const load = () => { voicesRef.current = window.speechSynthesis.getVoices(); };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  // Probe ElevenLabs availability once on mount
  useEffect(() => {
    checkElevenLabs().then((ok) => {
      if (ok) setActiveEngine("elevenlabs");
    });
  }, []);

  // ── Internal helpers ────────────────────────────────────────────────────────

  const stopInternal = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current);  intervalRef.current = null; }
    if (pauseRef.current)    { clearTimeout(pauseRef.current);      pauseRef.current    = null; }
    setAmplitude(0);
    setIsSpeaking(false);
  }, []);

  /** Amplitude oscillator used by the Web Speech fallback path */
  const startOscillator = useCallback((speed: number) => {
    let phase = 0;
    const oscSpeed = speed > 1.1 ? 0.24 : speed < 0.9 ? 0.14 : 0.18;
    intervalRef.current = setInterval(() => {
      phase += oscSpeed;
      const wave  = Math.sin(phase) * 0.35 + 0.65;
      const noise = Math.random() * 0.35;
      setAmplitude(Math.min(1, wave * 0.65 + noise));
    }, 55);
  }, []);

  // ── ElevenLabs path ─────────────────────────────────────────────────────────

  const speakElevenLabs = useCallback(
    async (text: string, vs: VoiceStyle): Promise<boolean> => {
      const available = await checkElevenLabs();
      if (!available) return false;

      setIsSpeaking(true);
      startOscillator(vs.speed);

      try {
        await speakWithElevenLabs(text, {
          tone:        vs.tone,
          profile:     getVoiceProfileForTone(vs.tone),
          onAmplitude: (v) => setAmplitude(v),
          onEnd:       () => stopInternal(),
          onError:     () => {
            stopInternal();
            _elevenLabsReady = false;
          },
        });
        return true;
      } catch {
        stopInternal();
        _elevenLabsReady = false;
        return false;
      }
    },
    [startOscillator, stopInternal]
  );

  // ── Web Speech fallback path ────────────────────────────────────────────────

  const speakWebSpeech = useCallback(
    (text: string, vs: VoiceStyle, mod: ReturnType<typeof getEmotionVoiceModifier>) => {
      if (typeof window === "undefined" || !window.speechSynthesis) return;
      window.speechSynthesis.cancel();

      const pitch   = clamp(vs.pitch  + mod.pitchDelta, 0.5, 1.8);
      const speed   = clamp(vs.speed  + mod.speedDelta, 0.5, 1.8);
      const volume  = clamp(vs.volume, 0.5, 1.0);
      const pauseMs = mod.pauseMs;

      const voices   = voicesRef.current;
      const wantFem  = vs.tone === "warm" || vs.tone === "energetic" || vs.tone === "clear";
      const preferred =
        voices.find((v) => v.name.includes("Samantha")) ||
        (wantFem
          ? voices.find((v) => /female|samantha|karen|victoria|moira/i.test(v.name) && v.lang.startsWith("en"))
          : voices.find((v) => /male|alex|daniel|fred/i.test(v.name) && v.lang.startsWith("en"))
        ) ||
        voices.find((v) => v.name.includes("Google US English")) ||
        voices.find((v) => v.name.includes("Alex")) ||
        voices.find((v) => v.lang.startsWith("en") && !v.localService) ||
        voices.find((v) => v.lang.startsWith("en")) ||
        voices[0];

      setIsSpeaking(true);
      startOscillator(speed);

      const sentences = splitSentences(text);
      if (sentences.length === 0) { stopInternal(); return; }

      let idx = 0;
      const next = () => {
        if (!isEnabledRef.current || idx >= sentences.length) { stopInternal(); return; }
        const utter = new SpeechSynthesisUtterance(sentences[idx++]);
        if (preferred) utter.voice = preferred;
        const sp = speechPrefs({ rate: speed, volume });
        utter.rate   = sp.rate;
        utter.pitch  = pitch;
        utter.volume = sp.volume;
        utter.onboundary = (e) => { if (e.name === "word") setAmplitude(0.55 + Math.random() * 0.45); };
        utter.onend  = () => {
          if (idx < sentences.length) { pauseRef.current = setTimeout(next, pauseMs); }
          else                        { stopInternal(); }
        };
        utter.onerror = () => stopInternal();
        window.speechSynthesis.speak(utter);
      };
      next();
    },
    [startOscillator, stopInternal]
  );

  // ── Public speak API ────────────────────────────────────────────────────────

  /**
   * Speak text with layered voice modulation.
   *
   * Layer order:
   *   1. personality VoiceStyle  — pitch, speed, tone from current blend
   *   2. mood override            — replaces speed, adjusts pitch (excited/calm/focused)
   *   3. emotion delta            — fine-tunes pitch/speed/pause from detected text sentiment
   *
   * Engine selection:
   *   ElevenLabs → if configured and available
   *   Web Speech → fallback (always works)
   */
  const speak = useCallback(
    async (text: string, voiceStyle?: VoiceStyle, emotion?: Emotion, mood?: MoodId) => {
      if (!isEnabledRef.current || !text) return;

      // Build the modulated voice style
      let vs  = voiceStyle ?? getGlobalVoiceStyle();
      if (mood) vs = applyMoodToVoiceStyle(vs, mood);
      const mod = emotion
        ? getEmotionVoiceModifier(emotion)
        : { pitchDelta: 0, speedDelta: 0, pauseMs: 220 };

      const cleaned = cleanForTTS(text);
      if (!cleaned) return;

      // Cancel any in-progress speech
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
      stopElevenLabsSpeech();
      stopInternal();

      // Prefer ElevenLabs; fall back to Web Speech if unavailable or errored
      const usedEleven = await speakElevenLabs(cleaned, vs);
      if (!usedEleven) {
        setActiveEngine("webspeech");
        speakWebSpeech(cleaned, vs, mod);
      } else {
        setActiveEngine("elevenlabs");
      }
    },
    [speakElevenLabs, speakWebSpeech, stopInternal]
  );

  // ── stop / toggle ───────────────────────────────────────────────────────────

  const stop = useCallback(() => {
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    stopElevenLabsSpeech();
    stopInternal();
  }, [stopInternal]);

  const toggle = useCallback(() => {
    setIsEnabled((prev) => {
      const next = !prev;
      isEnabledRef.current = next;
      try { localStorage.setItem(STORAGE_KEY, String(next)); } catch {}
      if (!next) {
        if (typeof window !== "undefined") window.speechSynthesis?.cancel();
        stopElevenLabsSpeech();
        stopInternal();
      }
      return next;
    });
  }, [stopInternal]);

  return { isSpeaking, amplitude, speak, stop, isEnabled, toggle, activeEngine };
}
