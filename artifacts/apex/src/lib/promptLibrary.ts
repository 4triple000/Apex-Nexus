/**
 * Prompt history and saved prompts.
 * One store for chat and builder prompts so Home and Builder can share it.
 * Kept on this device and, when signed in, synced to the account so it follows
 * the user between phone and computer.
 */
import { useCallback, useEffect, useState } from "react";
import { authHeaders, getAuthSessionId } from "@/lib/authSession";

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

function write(key: string, list: PromptEntry[], push = true) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    /* storage full or blocked: history is a convenience */
  }
  window.dispatchEvent(new Event(EVENT));
  if (push) schedulePush();
}

// ── Account sync ──────────────────────────────────────────────────────────────

const API = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/prompts`;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pulled = false;

/** Union by text + kind, newest first. */
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
  if (!getAuthSessionId()) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    fetch(API, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ history: read(HISTORY_KEY).slice(0, 200), saved: read(SAVED_KEY).slice(0, 200) }),
    }).catch(() => { /* offline: the next change retries */ });
  }, 1500);
}

/** Once per page load: fold the account's prompts into this device's. */
async function pullOnce() {
  if (pulled || !getAuthSessionId()) return;
  pulled = true;
  try {
    const res = await fetch(API, { headers: authHeaders() });
    if (!res.ok) return;
    const json = await res.json() as { data?: { history: PromptEntry[]; saved: PromptEntry[] } };
    if (!json.data) return;
    const history = merge(read(HISTORY_KEY), json.data.history, MAX_HISTORY);
    const saved = merge(read(SAVED_KEY), json.data.saved, 200);
    write(HISTORY_KEY, history, false);
    write(SAVED_KEY, saved, false);
    schedulePush(); // send back anything only this device had
  } catch {
    pulled = false;
  }
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
    pullOnce();
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
