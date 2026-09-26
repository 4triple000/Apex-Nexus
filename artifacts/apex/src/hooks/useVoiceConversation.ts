/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  useVoiceConversation                                        ║
 * ║  Apex Real-Time Voice Conversation System v1                 ║
 * ║                                                              ║
 * ║  Layers:                                                     ║
 * ║   1. Speech input  (Web Speech API — continuous / PTT)       ║
 * ║   2. Intent engine (POST /api/voice/intent)                  ║
 * ║   3. System router (builder / game / chat / command)         ║
 * ║   4. AI response   (POST /api/voice/respond)                 ║
 * ║   5. TTS output    (useSpeechOutput — ElevenLabs / WebSpeech)║
 * ║   6. Context memory (session-scoped, last 20 turns)          ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { useSpeechOutput } from "@/hooks/useSpeechOutput";

// ── Types ─────────────────────────────────────────────────────────────────────

export type VoiceMode    = "builder" | "game" | "chat" | "command";
export type VoiceState   = "idle" | "listening" | "processing" | "speaking" | "error";
export type VoiceIntent  =
  | "builder_command"
  | "game_action"
  | "ai_assistance"
  | "general_conversation"
  | "system_navigation"
  | "code_execution";

export interface VoiceTurn {
  id:        string;
  role:      "user" | "apex";
  text:      string;
  intent?:   VoiceIntent;
  mode?:     VoiceMode;
  timestamp: number;
}

export interface IntentResult {
  intent:     VoiceIntent;
  mode:       VoiceMode;
  confidence: number;
  action?:    string;
  params?:    Record<string, string>;
}

interface ConversationOptions {
  initialMode?:      VoiceMode;
  pushToTalk?:       boolean;
  projectContext?:   string;
  onIntentDetected?: (intent: IntentResult, text: string) => void;
  onBuilderCommand?: (action: string, params: Record<string, string>) => void;
  onGameAction?:     (action: string, params: Record<string, string>) => void;
  onNavigation?:     (destination: string) => void;
}

const API_BASE    = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const MAX_HISTORY = 20;

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useVoiceConversation(opts: ConversationOptions = {}) {
  const {
    initialMode     = "chat",
    pushToTalk      = false,
    projectContext  = "",
    onIntentDetected,
    onBuilderCommand,
    onGameAction,
    onNavigation,
  } = opts;

  const [state,         setState]         = useState<VoiceState>("idle");
  const [mode,          setMode]          = useState<VoiceMode>(initialMode);
  const [transcript,    setTranscript]    = useState("");
  const [interimText,   setInterimText]   = useState("");
  const [history,       setHistory]       = useState<VoiceTurn[]>([]);
  const [lastIntent,    setLastIntent]    = useState<IntentResult | null>(null);
  const [errorMsg,      setErrorMsg]      = useState<string | null>(null);
  const [isSupported,   setIsSupported]   = useState(false);
  const [amplitude,     setAmplitude]     = useState(0);

  const recognitionRef   = useRef<SpeechRecognition | null>(null);
  const isListeningRef   = useRef(false);
  const historyRef       = useRef<VoiceTurn[]>([]);
  const modeRef          = useRef<VoiceMode>(initialMode);
  const processingRef    = useRef(false);
  const pttActiveRef     = useRef(false);
  const amplitudeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { speak, isSpeaking, stop: stopTTS, amplitude: ttsAmplitude } = useSpeechOutput();

  // Sync refs
  useEffect(() => { historyRef.current = history; }, [history]);
  useEffect(() => { modeRef.current    = mode;    }, [mode]);

  // ── Check support ───────────────────────────────────────────────────────────

  useEffect(() => {
    const supported = typeof window !== "undefined" &&
      ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
    setIsSupported(supported);
  }, []);

  // ── Amplitude oscillator (listening visual feedback) ────────────────────────

  const startAmplitudeOsc = useCallback(() => {
    if (amplitudeTimerRef.current) clearInterval(amplitudeTimerRef.current);
    let ph = 0;
    amplitudeTimerRef.current = setInterval(() => {
      ph += 0.2;
      setAmplitude(Math.abs(Math.sin(ph)) * 0.6 + 0.4 * Math.random());
    }, 60);
  }, []);

  const stopAmplitudeOsc = useCallback(() => {
    if (amplitudeTimerRef.current) { clearInterval(amplitudeTimerRef.current); amplitudeTimerRef.current = null; }
    setAmplitude(0);
  }, []);

  // ── API calls ───────────────────────────────────────────────────────────────

  const detectIntent = useCallback(async (text: string): Promise<IntentResult | null> => {
    try {
      const res = await fetch(`${API_BASE}/api/voice/intent`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          text,
          currentMode: modeRef.current,
          context:     projectContext,
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.result ?? null;
    } catch { return null; }
  }, [projectContext]);

  const generateResponse = useCallback(async (
    text:   string,
    intent: IntentResult | null,
  ): Promise<string> => {
    try {
      const apiHistory = historyRef.current
        .slice(-12)
        .map((t) => ({ role: t.role === "apex" ? "assistant" : "user", content: t.text }));

      const res = await fetch(`${API_BASE}/api/voice/respond`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          text,
          intent,
          mode:           modeRef.current,
          history:        apiHistory,
          projectContext,
        }),
      });
      if (!res.ok) return "On it.";
      const data = await res.json();
      return data.reply ?? "Got it.";
    } catch { return "Got it."; }
  }, [projectContext]);

  // ── Process a completed utterance ───────────────────────────────────────────

  const processUtterance = useCallback(async (text: string) => {
    if (!text.trim() || processingRef.current) return;
    processingRef.current = true;
    setState("processing");
    setTranscript(text);
    setInterimText("");

    // Add user turn to history
    const userTurn: VoiceTurn = {
      id:        crypto.randomUUID(),
      role:      "user",
      text,
      timestamp: Date.now(),
    };
    setHistory((prev) => [...prev.slice(-(MAX_HISTORY - 1)), userTurn]);

    // Intent detection
    const intent = await detectIntent(text);
    if (intent) {
      setLastIntent(intent);
      onIntentDetected?.(intent, text);

      // Auto-switch mode based on intent
      if (intent.mode && intent.mode !== modeRef.current) {
        setMode(intent.mode);
      }

      // Route to system callbacks
      if (intent.intent === "builder_command" && intent.action) {
        onBuilderCommand?.(intent.action, intent.params ?? {});
      }
      if (intent.intent === "game_action" && intent.action) {
        onGameAction?.(intent.action, intent.params ?? {});
      }
      if (intent.intent === "system_navigation" && intent.action) {
        onNavigation?.(intent.action);
      }
    }

    // Generate AI response
    const reply = await generateResponse(text, intent);

    // Add Apex turn
    const apexTurn: VoiceTurn = {
      id:        crypto.randomUUID(),
      role:      "apex",
      text:      reply,
      intent:    intent?.intent,
      mode:      modeRef.current,
      timestamp: Date.now(),
    };
    setHistory((prev) => [...prev.slice(-(MAX_HISTORY - 1)), apexTurn]);

    // Speak the response
    setState("speaking");
    const moodMap: Record<VoiceMode, "excited" | "calm" | "neutral"> = {
      builder: "neutral",
      game:    "excited",
      chat:    "calm",
      command: "neutral",
    };
    await speak(reply, undefined, undefined, moodMap[modeRef.current] as any);

    processingRef.current = false;
    setState(isListeningRef.current ? "listening" : "idle");
  }, [detectIntent, generateResponse, speak, onIntentDetected, onBuilderCommand, onGameAction, onNavigation]);

  // ── Build SpeechRecognition instance ────────────────────────────────────────

  const buildRecognition = useCallback((): SpeechRecognition | null => {
    if (typeof window === "undefined") return null;
    const SpeechRecognitionCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return null;

    const r: SpeechRecognition = new SpeechRecognitionCtor();
    r.lang       = "en-US";
    r.continuous = !pushToTalk;
    r.interimResults = true;

    r.onstart  = () => { setState("listening"); startAmplitudeOsc(); };
    r.onend    = () => {
      stopAmplitudeOsc();
      if (isListeningRef.current && !pushToTalk) {
        // Restart for continuous mode
        try { r.start(); } catch {}
      } else {
        setState("idle");
        isListeningRef.current = false;
      }
    };
    r.onerror  = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      setErrorMsg(`Mic error: ${e.error}`);
      setState("error");
      stopAmplitudeOsc();
      isListeningRef.current = false;
    };
    r.onresult = (e) => {
      let interim = "";
      let final   = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else                       interim += t;
      }
      setInterimText(interim);
      if (final.trim()) processUtterance(final.trim());
    };

    return r;
  }, [pushToTalk, startAmplitudeOsc, stopAmplitudeOsc, processUtterance]);

  // ── Start / stop listening ───────────────────────────────────────────────────

  const startListening = useCallback(() => {
    if (isListeningRef.current) return;
    stopTTS();
    setErrorMsg(null);

    const r = buildRecognition();
    if (!r) {
      setErrorMsg("Speech recognition not supported in this browser");
      setState("error");
      return;
    }
    recognitionRef.current = r;
    isListeningRef.current = true;
    try { r.start(); } catch {}
  }, [buildRecognition, stopTTS]);

  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    stopAmplitudeOsc();
    if (!processingRef.current) setState("idle");
  }, [stopAmplitudeOsc]);

  const toggleListening = useCallback(() => {
    if (isListeningRef.current) stopListening();
    else                        startListening();
  }, [startListening, stopListening]);

  // ── Push-to-talk handlers ────────────────────────────────────────────────────

  const pttStart = useCallback(() => {
    if (!pushToTalk || pttActiveRef.current) return;
    pttActiveRef.current = true;
    startListening();
  }, [pushToTalk, startListening]);

  const pttEnd = useCallback(() => {
    if (!pushToTalk || !pttActiveRef.current) return;
    pttActiveRef.current = false;
    stopListening();
  }, [pushToTalk, stopListening]);

  // ── Interrupt ────────────────────────────────────────────────────────────────

  const interrupt = useCallback(() => {
    stopTTS();
    processingRef.current = false;
    if (isListeningRef.current) setState("listening");
    else                        setState("idle");
  }, [stopTTS]);

  // ── Clear history ────────────────────────────────────────────────────────────

  const clearHistory = useCallback(() => {
    setHistory([]);
    historyRef.current = [];
    setLastIntent(null);
    setTranscript("");
  }, []);

  // ── Cleanup ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      isListeningRef.current = false;
      recognitionRef.current?.stop();
      stopAmplitudeOsc();
    };
  }, [stopAmplitudeOsc]);

  // ── Combined amplitude (listening or speaking) ───────────────────────────────

  const combinedAmplitude = isSpeaking ? ttsAmplitude : amplitude;

  return {
    // State
    state,
    mode,
    transcript,
    interimText,
    history,
    lastIntent,
    errorMsg,
    isSupported,
    amplitude: combinedAmplitude,
    isListening:   isListeningRef.current,
    isProcessing:  processingRef.current,
    isSpeaking,

    // Actions
    startListening,
    stopListening,
    toggleListening,
    pttStart,
    pttEnd,
    interrupt,
    setMode,
    clearHistory,
    speak,
  };
}
