/**
 * PrivacyContext — Global privacy mode toggle.
 * When enabled: all memory writes, AI context injection, and voice tone
 * storage are blocked. State persists to localStorage.
 */
import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

const KEY = "apex_privacy_mode";

interface PrivacyContextValue {
  privacyMode:       boolean;
  togglePrivacyMode: () => void;
  enablePrivacy:     () => void;
  disablePrivacy:    () => void;
}

const PrivacyContext = createContext<PrivacyContextValue>({
  privacyMode:       false,
  togglePrivacyMode: () => {},
  enablePrivacy:     () => {},
  disablePrivacy:    () => {},
});

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [privacyMode, setPrivacyMode] = useState<boolean>(() => {
    try { return localStorage.getItem(KEY) === "true"; } catch { return false; }
  });

  const set = useCallback((next: boolean) => {
    setPrivacyMode(next);
    try { localStorage.setItem(KEY, String(next)); } catch {}
  }, []);

  const togglePrivacyMode = useCallback(() => set(!privacyMode), [privacyMode, set]);
  const enablePrivacy     = useCallback(() => set(true),  [set]);
  const disablePrivacy    = useCallback(() => set(false), [set]);

  return (
    <PrivacyContext.Provider value={{ privacyMode, togglePrivacyMode, enablePrivacy, disablePrivacy }}>
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy(): PrivacyContextValue {
  return useContext(PrivacyContext);
}
