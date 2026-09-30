/**
 * Prompt history and saved prompts (same idea as the website): kept on this
 * device and synced to the account when signed in.
 */
import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { promptsApi } from "@/services/api";

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

async function write(key: string, list: PromptEntry[], push = true) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(list));
  } catch {
    /* history is a convenience */
  }
  listeners.forEach((l) => l());
  if (push) schedulePush();
}

// ── Account sync ──────────────────────────────────────────────────────────────

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pulled = false;

function merge(a: PromptEntry[], b: PromptEntry[], max: number): PromptEntry[] {
  const byKey = new Map<string, PromptEntry>();
  for (const p of [...a, ...b]) {
    const k = `${p.kind}\u0000${p.text}`;
    const prev = byKey.get(k);
    if (!prev || p.at > prev.at) byKey.set(k, p);
  }
  return [...byKey.values()].sort((x, y) => y.at - x.at).slice(0, max);
}

function schedulePush() {
  if (!promptsApi.signedIn()) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    try {
      await promptsApi.put((await read(HISTORY_KEY)).slice(0, 200), (await read(SAVED_KEY)).slice(0, 200));
    } catch { /* offline: the next change retries */ }
  }, 1500);
}

async function pullOnce() {
  if (pulled || !promptsApi.signedIn()) return;
  pulled = true;
  try {
    const remote = await promptsApi.get();
    await write(HISTORY_KEY, merge(await read(HISTORY_KEY), remote.history, MAX_HISTORY), false);
    await write(SAVED_KEY, merge(await read(SAVED_KEY), remote.saved, 200), false);
    schedulePush();
  } catch {
    pulled = false;
  }
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
    pullOnce();
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
