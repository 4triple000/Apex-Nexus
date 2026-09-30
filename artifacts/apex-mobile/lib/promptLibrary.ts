/**
 * Prompt history and saved prompts, kept on this device (same idea as the website).
 */
import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type PromptKind = "chat" | "build";
export interface PromptEntry { text: string; kind: PromptKind; at: number }

const HISTORY_KEY = "apex_prompt_history";
const SAVED_KEY = "apex_saved_prompts";
const MAX_HISTORY = 40;
const listeners = new Set<() => void>();

async function read(key: string): Promise<PromptEntry[]> {
  try {
    const v = JSON.parse((await AsyncStorage.getItem(key)) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

async function write(key: string, list: PromptEntry[]) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(list));
  } catch {
    /* history is a convenience */
  }
  listeners.forEach((l) => l());
}

export async function recordPrompt(text: string, kind: PromptKind) {
  const t = text.trim();
  if (!t) return;
  const rest = (await read(HISTORY_KEY)).filter((p) => !(p.text === t && p.kind === kind));
  await write(HISTORY_KEY, [{ text: t, kind, at: Date.now() }, ...rest].slice(0, MAX_HISTORY));
}

export function usePromptLibrary(kind: PromptKind) {
  const [history, setHistory] = useState<PromptEntry[]>([]);
  const [saved, setSaved] = useState<PromptEntry[]>([]);

  useEffect(() => {
    const load = async () => {
      setHistory((await read(HISTORY_KEY)).filter((p) => p.kind === kind));
      setSaved((await read(SAVED_KEY)).filter((p) => p.kind === kind));
    };
    load();
    listeners.add(load);
    return () => { listeners.delete(load); };
  }, [kind]);

  const isSaved = useCallback((text: string) => saved.some((p) => p.text === text), [saved]);

  const toggleSaved = useCallback(async (text: string) => {
    const all = await read(SAVED_KEY);
    const exists = all.some((p) => p.text === text && p.kind === kind);
    await write(SAVED_KEY, exists
      ? all.filter((p) => !(p.text === text && p.kind === kind))
      : [{ text, kind, at: Date.now() }, ...all]);
  }, [kind]);

  return { history, saved, isSaved, toggleSaved };
}
