/**
 * Back buttons that stay inside the current tab.
 *
 * The browser keeps one history for the whole app, so "back" after switching tabs jumps to the other tab.
 * Instead, every page you open is remembered under its tab (Home, Chat, Builder, Games, You, Social), and
 * goBackInTab() returns to the previous page of the same tab, or the tab's main page when there isn't one.
 */
import { useEffect } from "react";
import { useLocation } from "wouter";

type Tab = "home" | "chat" | "builder" | "games" | "you" | "social" | "other";

const ROOT: Record<Tab, string> = { home: "/", chat: "/dm", builder: "/builder", games: "/games", you: "/profile", social: "/feed", other: "/" };

const startsWith = (path: string, prefixes: string[]) => prefixes.some((p) => path === p || path.startsWith(`${p}/`));

export function tabOf(path: string): Tab {
  if (startsWith(path, ["/feed", "/u", "/explore"])) return "social";
  if (path === "/") return "home";
  if (startsWith(path, ["/dm"])) return "chat";
  if (startsWith(path, ["/builder", "/ai-studio", "/studio", "/workflow-builder"])) return "builder";
  if (startsWith(path, ["/games", "/game-engine", "/multiplayer", "/engine", "/arena"])) return "games";
  if (startsWith(path, ["/profile", "/avatar", "/settings", "/usage", "/connectors", "/pricing", "/models", "/insights", "/creator-dashboard", "/domain-settings", "/install"])) return "you";
  return "other";
}

const KEY = "apex_tab_history";
const MAX = 30;

function load(): Partial<Record<Tab, string[]>> {
  try { return JSON.parse(sessionStorage.getItem(KEY) ?? "{}") as Partial<Record<Tab, string[]>>; } catch { return {}; }
}
let stacks = load();
function save() {
  try { sessionStorage.setItem(KEY, JSON.stringify(stacks)); } catch { /* private mode: memory only */ }
}

/** Set while goBackInTab navigates, so that page isn't recorded again as a new visit. */
let goingBack = false;

function record(url: string) {
  const path = url.split("?")[0]!;
  const tab = tabOf(path);
  const stack = stacks[tab] ?? [];
  if (goingBack) {
    goingBack = false;
    return;
  }
  // Coming back to a page already in this tab (e.g. its tab button) trims everything after it
  const at = stack.lastIndexOf(url);
  const next = at >= 0 ? stack.slice(0, at + 1) : [...stack, url].slice(-MAX);
  stacks = { ...stacks, [tab]: next };
  save();
}

/** Records every page visit under its tab. Mount once (Layout). */
export function useTabHistory() {
  const [location] = useLocation();
  useEffect(() => {
    record(`${location}${window.location.search}`);
  }, [location]);
}

/** Go to the previous page in this tab, or `fallback` (default: the tab's main page). */
export function goBackInTab(nav: (to: string, opts?: { replace?: boolean }) => void, fallback?: string) {
  const path = window.location.pathname;
  const tab = tabOf(path);
  const stack = [...(stacks[tab] ?? [])];
  // Drop the current page (and any copies of it at the top)
  while (stack.length && stack[stack.length - 1]!.split("?")[0] === path) stack.pop();
  const prev = stack[stack.length - 1];
  stacks = { ...stacks, [tab]: stack };
  save();
  // The previous page is already on this tab's list; a fallback page gets recorded as a fresh visit
  goingBack = !!prev;
  nav(prev ?? fallback ?? ROOT[tab], { replace: true });
}

/** goBackInTab bound to this component's router. */
export function useBackInTab(fallback?: string) {
  const [, nav] = useLocation();
  return () => goBackInTab(nav, fallback);
}
