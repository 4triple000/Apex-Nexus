import { useState, useCallback } from "react";
import type { BuildMemoryEntry, AIEnhancement, DetectedIntent } from "@/data/blockSystem";

const MEMORY_KEY = "apex-builder-memory";
const MAX_ENTRIES = 6;

export function useBuilderMemory() {
  const [memory, setMemory] = useState<BuildMemoryEntry[]>(() => {
    try {
      const raw = localStorage.getItem(MEMORY_KEY);
      return raw ? (JSON.parse(raw) as BuildMemoryEntry[]) : [];
    } catch {
      return [];
    }
  });

  const saveBuild = useCallback(
    (entry: Omit<BuildMemoryEntry, "id" | "timestamp">) => {
      const newEntry: BuildMemoryEntry = {
        ...entry,
        id: `build-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: Date.now(),
      };
      setMemory((prev) => {
        const updated = [newEntry, ...prev].slice(0, MAX_ENTRIES);
        try { localStorage.setItem(MEMORY_KEY, JSON.stringify(updated)); } catch {}
        return updated;
      });
    },
    [],
  );

  const clearMemory = useCallback(() => {
    try { localStorage.removeItem(MEMORY_KEY); } catch {}
    setMemory([]);
  }, []);

  // Returns last 2 builds as context for the AI prompt
  const getRecentContext = useCallback(
    (): Pick<BuildMemoryEntry, "appName" | "features" | "enhancement">[] =>
      memory.slice(0, 2).map(({ appName, features, enhancement }) => ({
        appName,
        features,
        enhancement,
      })),
    [memory],
  );

  // Derived style preference from recent builds
  const styleProfile = (() => {
    if (memory.length === 0) return null;
    const tones = memory.map((b) => b.enhancement?.tone).filter(Boolean);
    const scales = memory.map((b) => b.enhancement?.scale).filter(Boolean);
    const styles = memory.map((b) => b.enhancement?.uiStyle).filter(Boolean);
    const mode = <T>(arr: T[]): T | null => {
      if (!arr.length) return null;
      return arr.reduce((a, b, _, arr) =>
        arr.filter((v) => v === a).length >= arr.filter((v) => v === b).length ? a : b
      );
    };
    return {
      tone:    mode(tones),
      scale:   mode(scales),
      uiStyle: mode(styles),
      totalBuilds: memory.length,
    };
  })();

  return { memory, saveBuild, clearMemory, getRecentContext, styleProfile };
}
