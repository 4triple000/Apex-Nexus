import type { Module, DepWarning } from "./types";

/**
 * Returns modules that are required by `moduleId` but currently disabled.
 */
export function getMissingDeps(moduleId: string, modules: Module[]): string[] {
  const mod = modules.find((m) => m.id === moduleId);
  if (!mod) return [];
  return mod.dependencies.filter((depId) => {
    const dep = modules.find((m) => m.id === depId);
    return !dep || !dep.enabled;
  });
}

/**
 * Builds a DepWarning list for all modules that have unmet dependencies.
 */
export function buildDepWarnings(modules: Module[]): DepWarning[] {
  return modules
    .filter((m) => m.enabled)
    .map((m) => ({ moduleId: m.id, missingDeps: getMissingDeps(m.id, modules) }))
    .filter((w) => w.missingDeps.length > 0);
}

/**
 * Returns a new module list with all dependencies of `moduleId` enabled
 * (cascades recursively, up to depth 6 to prevent infinite loops).
 */
export function autoEnableDeps(moduleId: string, modules: Module[], depth = 0): Module[] {
  if (depth > 6) return modules;
  const mod = modules.find((m) => m.id === moduleId);
  if (!mod) return modules;

  let result = modules;
  for (const depId of mod.dependencies) {
    const dep = result.find((m) => m.id === depId);
    if (dep && !dep.enabled) {
      result = result.map((m) =>
        m.id === depId ? { ...m, enabled: true, status: "Active" as const } : m,
      );
      result = autoEnableDeps(depId, result, depth + 1);
    }
  }
  return result;
}

/**
 * Returns modules that depend on `moduleId` (reverse deps).
 */
export function getDependents(moduleId: string, modules: Module[]): Module[] {
  return modules.filter((m) => m.dependencies.includes(moduleId));
}

/**
 * Checks whether enabling a module would satisfy or not satisfy its deps.
 */
export function canEnable(moduleId: string, modules: Module[]): boolean {
  return getMissingDeps(moduleId, modules).length === 0;
}

/**
 * Human-readable label for a module id.
 */
export function moduleLabel(id: string, modules: Module[]): string {
  return modules.find((m) => m.id === id)?.name ?? id;
}
