import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type ApexState = "idle" | "listening" | "thinking" | "responding" | "active";

interface ApexStateCtx {
  state: ApexState;
  setState: (s: ApexState) => void;
  wakePhrase: string;
  setWakePhrase: (p: string) => void;
  voiceMode: boolean;
  setVoiceMode: (v: boolean) => void;
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
  memoryEnabled: boolean;
  setMemoryEnabled: (v: boolean) => void;
  personality: string;
  setPersonality: (p: string) => void;
}

const Ctx = createContext<ApexStateCtx | null>(null);

export function ApexStateProvider({ children }: { children: ReactNode }) {
  const [state, setState]               = useState<ApexState>("idle");
  const [wakePhrase, setWakePhrase]     = useState("Hey Apex");
  const [voiceMode, setVoiceMode]       = useState(false);
  const [darkMode, setDarkMode]         = useState(true);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [personality, setPersonality]   = useState("assistant");

  return (
    <Ctx.Provider value={{
      state, setState,
      wakePhrase, setWakePhrase,
      voiceMode, setVoiceMode,
      darkMode, setDarkMode,
      memoryEnabled, setMemoryEnabled,
      personality, setPersonality,
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
