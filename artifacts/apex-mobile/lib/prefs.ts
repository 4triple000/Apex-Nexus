/**
 * Settings the user picks on the Settings screen, saved on this device.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

export interface ApexPrefs {
  wakePhrase: string;
  voiceMode: boolean;
  darkMode: boolean;
  memoryEnabled: boolean;
  handsFree: boolean;
  personality: "friend" | "assistant" | "formal" | "creative";
  /** Apex's speaking volume, 0–1 */
  volume: number;
  /** Apex's speaking speed, 0.5–2 */
  speechRate: number;
}

const KEY = "apex_prefs_v1";
const DEFAULTS: ApexPrefs = {
  wakePhrase: "Hey Apex", voiceMode: false, darkMode: true, memoryEnabled: true,
  handsFree: false, personality: "friend", volume: 0.8, speechRate: 1,
};

let prefs: ApexPrefs = DEFAULTS;
const listeners = new Set<() => void>();

AsyncStorage.getItem(KEY)
  .then((raw) => {
    if (!raw) return;
    prefs = { ...DEFAULTS, ...JSON.parse(raw) };
    listeners.forEach((l) => l());
  })
  .catch(() => undefined);

export function getPrefs() {
  return prefs;
}

export function setPref<K extends keyof ApexPrefs>(key: K, value: ApexPrefs[K]) {
  prefs = { ...prefs, [key]: value };
  listeners.forEach((l) => l());
  AsyncStorage.setItem(KEY, JSON.stringify(prefs)).catch(() => undefined);
}

export function usePrefs(): ApexPrefs {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => prefs,
    () => prefs,
  );
}
