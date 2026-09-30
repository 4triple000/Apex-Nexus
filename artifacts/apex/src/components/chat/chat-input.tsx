import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, MicOff, Send, Loader2, Radio, Pencil, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { loadPrefs, speechPrefs } from "@/contexts/ApexStateContext";

// ── Easing ─────────────────────────────────────────────────────────────────────
const EASE_IOS    = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";
const EASE_SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

interface ChatInputProps {
  onSend:          (message: string) => void;
  disabled?:       boolean;
  onVoiceStart?:   (stream: MediaStream) => void;
  onVoiceStop?:    () => void;
}

type HandsFreePhase = "idle" | "wake" | "capture";

const SILENCE_MS       = 2200;
const DEFAULT_WAKE_PHRASE = "Hey Apex";
const STORAGE_KEY      = "apex_wake_phrase";

function speakFeedback(text: string) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  const sp = speechPrefs({ rate: 1.1, volume: 0.6 });
  utt.volume = sp.volume;
  utt.rate = sp.rate;
  window.speechSynthesis.speak(utt);
}

function loadWakePhrase(): string {
  try { return localStorage.getItem(STORAGE_KEY) || DEFAULT_WAKE_PHRASE; }
  catch { return DEFAULT_WAKE_PHRASE; }
}

function saveWakePhrase(phrase: string) {
  try { localStorage.setItem(STORAGE_KEY, phrase); } catch {}
}

export function ChatInput({ onSend, disabled, onVoiceStart, onVoiceStop }: ChatInputProps) {
  const [value, setValue]                     = useState("");
  const [isListening, setIsListening]         = useState(false);
  const [isAvailable, setIsAvailable]         = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [handsFree, setHandsFree]             = useState(false);
  const [hfPhase, setHfPhase]                 = useState<HandsFreePhase>("idle");
  const [wakePhrase, setWakePhrase]           = useState<string>(loadWakePhrase);
  const [editingPhrase, setEditingPhrase]     = useState(false);
  const [phraseInput, setPhraseInput]         = useState("");
  const [focused, setFocused]                 = useState(false);

  const textareaRef         = useRef<HTMLTextAreaElement>(null);
  const phraseInputRef      = useRef<HTMLInputElement>(null);
  const recognitionRef      = useRef<any>(null);
  const hfRecognitionRef    = useRef<any>(null);
  const transcriptRef       = useRef("");
  const silenceTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hfPhaseRef          = useRef<HandsFreePhase>("idle");
  const captureTranscriptRef = useRef("");
  const handsFreeRef        = useRef(false);
  const wakePhraseRef       = useRef(wakePhrase);
  const voiceStreamRef      = useRef<MediaStream | null>(null);

  useEffect(() => { hfPhaseRef.current = hfPhase; }, [hfPhase]);
  useEffect(() => { handsFreeRef.current = handsFree; }, [handsFree]);
  useEffect(() => { wakePhraseRef.current = wakePhrase; }, [wakePhrase]);

  useEffect(() => {
    if (editingPhrase) {
      setPhraseInput(wakePhrase);
      setTimeout(() => phraseInputRef.current?.focus(), 50);
    }
  }, [editingPhrase, wakePhrase]);

  const commitPhrase = () => {
    const trimmed = phraseInput.trim();
    if (trimmed) { setWakePhrase(trimmed); saveWakePhrase(trimmed); }
    setEditingPhrase(false);
  };

  const cancelPhrase = () => setEditingPhrase(false);

  const getSpeechRecognition = () =>
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  useEffect(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) { setIsAvailable(false); return; }
    setIsAvailable(true);
    const recognition = new SpeechRecognition();
    recognition.continuous     = true;
    recognition.interimResults = true;
    recognition.lang           = "en-US";
    recognition.onstart  = () => { setIsListening(true); setPermissionDenied(false); transcriptRef.current = ""; };
    recognition.onresult = (event: any) => {
      let final = "", interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (final) transcriptRef.current += final;
      setValue(transcriptRef.current + interim);
    };
    recognition.onerror = (event: any) => {
      if (event.error === "not-allowed" || event.error === "permission-denied") setPermissionDenied(true);
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    return () => recognition.abort();
  }, []);

  const submitCapture = useCallback(() => {
    const text = captureTranscriptRef.current.trim();
    captureTranscriptRef.current = "";
    setValue("");
    if (text) { speakFeedback("Got it."); onSend(text); }
  }, [onSend]);

  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => {
      submitCapture();
      setHfPhase("wake");
    }, SILENCE_MS);
  }, [submitCapture]);

  const startHfRecognition = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) return;
    if (hfRecognitionRef.current) { try { hfRecognitionRef.current.abort(); } catch {} }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event: any) => {
      if (!handsFreeRef.current) return;
      let final = "", interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      const phase  = hfPhaseRef.current;
      const phrase = wakePhraseRef.current.toLowerCase().trim();
      if (phase === "wake") {
        const combined = (final + interim).toLowerCase().trim();
        if (combined.includes(phrase)) {
          captureTranscriptRef.current = "";
          setValue("");
          setHfPhase("capture");
          speakFeedback("Yes?");
          resetSilenceTimer();
        }
      } else if (phase === "capture") {
        if (final) captureTranscriptRef.current += final;
        setValue(captureTranscriptRef.current + interim);
        resetSilenceTimer();
      }
    };
    recognition.onerror = (event: any) => {
      if (event.error === "not-allowed" || event.error === "permission-denied") {
        setPermissionDenied(true); setHandsFree(false); return;
      }
      if (handsFreeRef.current) setTimeout(() => startHfRecognition(), 500);
    };
    recognition.onend = () => { if (handsFreeRef.current) setTimeout(() => startHfRecognition(), 300); };
    hfRecognitionRef.current = recognition;
    try { recognition.start(); } catch {}
  }, [resetSilenceTimer]);

  const stopHfRecognition = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    try { hfRecognitionRef.current?.abort(); } catch {}
    hfRecognitionRef.current = null;
    captureTranscriptRef.current = "";
    setValue("");
    setHfPhase("idle");
  }, []);

  const toggleHandsFree = async () => {
    if (handsFree) {
      setHandsFree(false);
      stopHfRecognition();
      stopVoiceStream();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceStreamRef.current = stream;
      onVoiceStart?.(stream);
      setPermissionDenied(false);
      setHandsFree(true);
      setHfPhase("wake");
      startHfRecognition();
    } catch { setPermissionDenied(true); }
  };

  useEffect(() => { if (!handsFree) stopHfRecognition(); }, [handsFree, stopHfRecognition]);

  // Hands-free turned on in Settings: start listening for the wake phrase right away
  useEffect(() => {
    if (loadPrefs().handsFree && typeof navigator.mediaDevices?.getUserMedia === "function") void toggleHandsFree();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const resizeTextarea = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, []);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    resizeTextarea();
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!value.trim() || disabled) return;
    if (isListening) recognitionRef.current?.stop();
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    onSend(value.trim());
    setValue("");
    transcriptRef.current = "";
    captureTranscriptRef.current = "";
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    if (handsFree) setHfPhase("wake");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  const stopVoiceStream = useCallback(() => {
    if (voiceStreamRef.current) {
      voiceStreamRef.current.getTracks().forEach((t) => t.stop());
      voiceStreamRef.current = null;
    }
    onVoiceStop?.();
  }, [onVoiceStop]);

  const toggleListen = async () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      stopVoiceStream();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceStreamRef.current = stream;
      onVoiceStart?.(stream);
      transcriptRef.current = value;
      recognitionRef.current.start();
    } catch { setPermissionDenied(true); }
  };

  const placeholderText = () => {
    if (handsFree && hfPhase === "wake")    return `Say "${wakePhrase}" to activate...`;
    if (handsFree && hfPhase === "capture") return "Listening — speak now...";
    if (isListening)                         return "Listening...";
    return "Message Apex...";
  };

  const hasText = value.trim().length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Hands-free status */}
      {handsFree && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "8px 16px",
            borderRadius: 12,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            background: hfPhase === "capture" ? "rgba(108,92,231,0.12)" : "rgba(74,222,128,0.08)",
            border: hfPhase === "capture" ? "1px solid rgba(108,92,231,0.30)" : "1px solid rgba(74,222,128,0.20)",
            color: hfPhase === "capture" ? "#A29BFE" : "#4ADE80",
            transition: `all 0.30s ${EASE_IOS}`,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: hfPhase === "capture" ? "#A29BFE" : "#4ADE80",
              animation: hfPhase === "capture" ? "hf-capture-pulse 0.8s ease-in-out infinite" : undefined,
            }}
          />
          {hfPhase === "wake"
            ? `Waiting for "${wakePhrase}"`
            : "Apex is listening — speak now"}
        </div>
      )}

      {permissionDenied && (
        <p style={{ textAlign: "center", fontSize: 11, color: "#FCA5A5", fontFamily: "monospace" }}>
          Microphone access denied — enable in browser settings
        </p>
      )}

      {/* ── Main pill input bar ───────────────────────────────────────────── */}
      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 8,
          padding: "8px 8px 8px 14px",
          borderRadius: 26,
          background: focused
            ? "linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.07))"
            : "linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0.045))",
          border: focused
            ? "1px solid rgba(139,123,255,0.6)"
            : "1px solid rgba(255,255,255,0.16)",
          backdropFilter:       "blur(22px) saturate(180%)",
          WebkitBackdropFilter: "blur(22px) saturate(180%)",
          boxShadow: focused
            ? [
                "0 0 0 3px rgba(108,92,231,0.12)",
                "0 8px 32px rgba(0,0,0,0.45)",
                "0 2px 8px rgba(0,0,0,0.30)",
              ].join(", ")
            : [
                "inset 0 1px 0 rgba(255,255,255,0.3)",
                "0 10px 30px rgba(0,0,0,0.28)",
              ].join(", "),
          transition: `all 0.25s ${EASE_IOS}`,
        }}
      >
        {/* Mic button */}
        {isAvailable && !handsFree && (
          <button
            type="button"
            data-testid="button-voice"
            onClick={toggleListen}
            disabled={disabled}
            style={{
              flexShrink: 0,
              width: 36,
              height: 36,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: isListening ? "rgba(239,68,68,0.15)" : "transparent",
              border: isListening ? "1px solid rgba(239,68,68,0.35)" : "1px solid transparent",
              boxShadow: isListening ? "0 0 12px rgba(239,68,68,0.30)" : "none",
              transition: `all 0.20s ${EASE_IOS}`,
              cursor: "pointer",
            }}
          >
            {isListening
              ? <MicOff style={{ width: 16, height: 16, color: "#F87171" }} />
              : <Mic    style={{ width: 16, height: 16, color: "rgba(255,255,255,0.35)" }} />}
          </button>
        )}

        {isAvailable && handsFree && (
          <div
            style={{
              flexShrink: 0,
              width: 36,
              height: 36,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: hfPhase === "capture" ? "rgba(108,92,231,0.20)" : "rgba(74,222,128,0.10)",
              border: hfPhase === "capture" ? "1px solid rgba(108,92,231,0.40)" : "1px solid rgba(74,222,128,0.25)",
              animation: hfPhase === "capture" ? "hf-capture-pulse 0.8s ease-in-out infinite" : undefined,
            }}
          >
            <Radio style={{ width: 16, height: 16, color: hfPhase === "capture" ? "#A29BFE" : "#4ADE80" }} />
          </div>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholderText()}
          disabled={disabled}
          data-testid="input-message"
          rows={1}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            resize: "none",
            maxHeight: 140,
            minHeight: 36,
            fontSize: 14,
            lineHeight: 1.55,
            color: "rgba(255,255,255,0.90)",
            caretColor: "#A29BFE",
            padding: "8px 0",
            fontFamily: "inherit",
          }}
          className={cn(
            "placeholder-[rgba(255,255,255,0.28)]",
            isListening && "placeholder-[rgba(248,113,113,0.60)]",
            handsFree && hfPhase === "capture" && "placeholder-[rgba(162,155,254,0.70)]"
          )}
        />

        {/* Send button */}
        <button
          type="submit"
          disabled={!hasText || disabled}
          data-testid="button-send"
          style={{
            flexShrink: 0,
            width: 38,
            height: 38,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: hasText && !disabled
              ? "linear-gradient(135deg, #6C5CE7, #A29BFE)"
              : "rgba(255,255,255,0.07)",
            border: hasText && !disabled
              ? "1px solid rgba(162,155,254,0.40)"
              : "1px solid rgba(255,255,255,0.08)",
            boxShadow: hasText && !disabled
              ? "0 4px 16px rgba(108,92,231,0.45), 0 0 0 1px rgba(162,155,254,0.20)"
              : "none",
            transform: hasText && !disabled ? "scale(1.04)" : "scale(1)",
            transition: [
              `background 0.25s ${EASE_IOS}`,
              `box-shadow 0.25s ${EASE_IOS}`,
              `transform 0.28s ${EASE_SPRING}`,
              `border-color 0.25s ${EASE_IOS}`,
            ].join(", "),
            cursor: hasText && !disabled ? "pointer" : "not-allowed",
            opacity: !hasText && !disabled ? 0.45 : 1,
          }}
        >
          {disabled
            ? <Loader2 style={{ width: 16, height: 16, color: "#A29BFE", animation: "spin 1s linear infinite" }} />
            : <Send    style={{ width: 15, height: 15, color: hasText ? "white" : "rgba(255,255,255,0.50)", transform: "translateX(1px)" }} />}
        </button>
      </form>

      {/* ── Hands-free controls ───────────────────────────────────────────── */}
      {isAvailable && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
          <button
            type="button"
            onClick={toggleHandsFree}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "4px 10px",
              borderRadius: 99,
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: handsFree ? "#4ADE80" : "rgba(255,255,255,0.28)",
              background: handsFree ? "rgba(74,222,128,0.08)" : "transparent",
              border: handsFree ? "1px solid rgba(74,222,128,0.20)" : "1px solid transparent",
              transition: `all 0.20s ${EASE_IOS}`,
              cursor: "pointer",
            }}
          >
            <Radio style={{ width: 10, height: 10 }} />
            {handsFree ? "Hands-Free On" : "Hands-Free Mode"}
          </button>

          {!handsFree && !editingPhrase && (
            <button
              type="button"
              onClick={() => setEditingPhrase(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 10,
                fontWeight: 500,
                color: "rgba(255,255,255,0.18)",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                cursor: "pointer",
                transition: `color 0.20s ${EASE_IOS}`,
              }}
            >
              <Pencil style={{ width: 9, height: 9 }} />
              Phrase
            </button>
          )}
        </div>
      )}

      {/* Wake phrase editor */}
      {editingPhrase && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 14px",
            borderRadius: 14,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.09)",
          }}
        >
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 }}>
            Wake phrase:
          </span>
          <input
            ref={phraseInputRef}
            type="text"
            value={phraseInput}
            onChange={(e) => setPhraseInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); commitPhrase(); }
              if (e.key === "Escape") cancelPhrase();
            }}
            placeholder={DEFAULT_WAKE_PHRASE}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: 13,
              color: "rgba(255,255,255,0.85)",
              minWidth: 0,
              fontFamily: "inherit",
            }}
          />
          <button type="button" onClick={commitPhrase} disabled={!phraseInput.trim()}
            style={{ color: phraseInput.trim() ? "#4ADE80" : "rgba(255,255,255,0.20)", cursor: "pointer" }}>
            <Check style={{ width: 14, height: 14 }} />
          </button>
          <button type="button" onClick={cancelPhrase}
            style={{ color: "rgba(255,255,255,0.35)", cursor: "pointer" }}>
            <X style={{ width: 14, height: 14 }} />
          </button>
        </div>
      )}
    </div>
  );
}
