/**
 * Prompt history and saved prompts, kept on this device.
 * One store for chat and builder prompts so Home and Builder can share it.
 */
import { useCallback, useEffect, useState } from "react";

export type PromptKind = "chat" | "build";
export interface PromptEntry { text: string; kind: PromptKind; at: number }

const HISTORY_KEY = "apex_prompt_history";
const SAVED_KEY = "apex_saved_prompts";
const MAX_HISTORY = 40;
const EVENT = "apex-prompts-changed";

function read(key: string): PromptEntry[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function write(key: string, list: PromptEntry[]) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    /* storage full or blocked: history is a convenience */
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Record a prompt the user sent. Repeats move to the top instead of duplicating. */
export function recordPrompt(text: string, kind: PromptKind) {
  const t = text.trim();
  if (!t) return;
  const rest = read(HISTORY_KEY).filter((p) => !(p.text === t && p.kind === kind));
  write(HISTORY_KEY, [{ text: t, kind, at: Date.now() }, ...rest].slice(0, MAX_HISTORY));
}

export function usePromptLibrary(kind: PromptKind) {
  const [history, setHistory] = useState<PromptEntry[]>([]);
  const [saved, setSaved] = useState<PromptEntry[]>([]);

  useEffect(() => {
    const load = () => {
      setHistory(read(HISTORY_KEY).filter((p) => p.kind === kind));
      setSaved(read(SAVED_KEY).filter((p) => p.kind === kind));
    };
    load();
    window.addEventListener(EVENT, load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener(EVENT, load);
      window.removeEventListener("storage", load);
    };
  }, [kind]);

  const isSaved = useCallback((text: string) => saved.some((p) => p.text === text), [saved]);

  const toggleSaved = useCallback((text: string) => {
    const all = read(SAVED_KEY);
    const exists = all.some((p) => p.text === text && p.kind === kind);
    write(SAVED_KEY, exists
      ? all.filter((p) => !(p.text === text && p.kind === kind))
      : [{ text, kind, at: Date.now() }, ...all]);
  }, [kind]);

  const clearHistory = useCallback(() => {
    write(HISTORY_KEY, read(HISTORY_KEY).filter((p) => p.kind !== kind));
  }, [kind]);

  return { history, saved, isSaved, toggleSaved, clearHistory };
}
