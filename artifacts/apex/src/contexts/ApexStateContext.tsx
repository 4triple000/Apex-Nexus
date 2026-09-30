import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ApexState = "idle" | "listening" | "thinking" | "responding" | "active";

/** Settings the user picks on the Settings page; saved on this device. */
export interface ApexPrefs {
  wakePhrase: string;
  voiceMode: boolean;
  darkMode: boolean;
  memoryEnabled: boolean;
  handsFree: boolean;
  personality: string;
  /** Apex's speaking volume, 0–1 */
  volume: number;
  /** Apex's speaking speed, 0.5–2 */
  speechRate: number;
}

const PREFS_KEY = "apex_prefs_v1";
const DEFAULTS: ApexPrefs = {
  wakePhrase: "Hey Apex", voiceMode: false, darkMode: true, memoryEnabled: true,
  handsFree: false, personality: "friend", volume: 0.8, speechRate: 1,
};

// The chat box's wake-phrase editor saves here too, so both stay in step
const WAKE_KEY = "apex_wake_phrase";

export function loadPrefs(): ApexPrefs {
  try {
    const saved = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") } as ApexPrefs;
    return { ...saved, wakePhrase: localStorage.getItem(WAKE_KEY) || saved.wakePhrase };
  } catch { return DEFAULTS; }
}

const TONES: Record<string, string> = {
  friend: "Talk like a warm, casual friend.",
  assistant: "Be a clear, helpful assistant.",
  formal: "Use a polite, formal, professional tone.",
  creative: "Be playful, imaginative and creative.",
};

/** One line for the chat prompt that sets Apex's tone from Settings. */
export function toneInstruction(personality: string) {
  const t = TONES[personality];
  return t ? `\nTone: ${t}` : "";
}

/** Volume/speed for anything that speaks, scaled by the user's choice. */
export function speechPrefs(base = { rate: 1, volume: 1 }) {
  const p = loadPrefs();
  return { rate: Math.min(2, base.rate * p.speechRate), volume: Math.min(1, base.volume * p.volume) };
}

type Setters = { [K in keyof ApexPrefs as `set${Capitalize<K & string>}`]: (v: ApexPrefs[K]) => void };

type ApexStateCtx = ApexPrefs & Setters & {
  state: ApexState;
  setState: (s: ApexState) => void;
};

const Ctx = createContext<ApexStateCtx | null>(null);

export function ApexStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ApexState>("idle");
  const [prefs, setPrefs] = useState<ApexPrefs>(loadPrefs);

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
      localStorage.setItem(WAKE_KEY, prefs.wakePhrase.trim() || DEFAULTS.wakePhrase);
    } catch { /* private mode */ }
  }, [prefs]);

  const set = <K extends keyof ApexPrefs>(k: K) => (v: ApexPrefs[K]) => setPrefs((p) => ({ ...p, [k]: v }));

  return (
    <Ctx.Provider value={{
      state, setState, ...prefs,
      setWakePhrase: set("wakePhrase"),
      setVoiceMode: set("voiceMode"),
      setDarkMode: set("darkMode"),
      setMemoryEnabled: set("memoryEnabled"),
      setHandsFree: set("handsFree"),
      setPersonality: set("personality"),
      setVolume: set("volume"),
      setSpeechRate: set("speechRate"),
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useApexState() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApexState must be used inside ApexStateProvider");
  return ctx;
}
