import { motion, AnimatePresence } from "framer-motion";
import type { Module, DepWarning } from "./types";
import { ModuleCard } from "./ModuleCard";

interface Props {
  modules:     Module[];
  depWarnings: DepWarning[];
  onToggle:    (id: string) => void;
  onSelect:    (module: Module) => void;
  onAutoFix:   (id: string) => void;
}

export function ModuleList({ modules, depWarnings, onToggle, onSelect, onAutoFix }: Props) {
  const active   = modules.filter((m) => m.status === "Active");
  const disabled = modules.filter((m) => m.status === "Disabled");
  const soon     = modules.filter((m) => m.status === "Coming Soon");

  const getDepWarning = (id: string): string[] | undefined => {
    const w = depWarnings.find((d) => d.moduleId === id);
    return w && w.missingDeps.length > 0 ? w.missingDeps : undefined;
  };

  const Section = ({ label, items }: { label: string; items: Module[] }) =>
    items.length === 0 ? null : (
      <div style={{ marginBottom: 20 }}>
        <p style={{
          color: "rgba(255,255,255,0.3)", fontSize: 11, fontWeight: 700,
          letterSpacing: "0.1em", marginBottom: 10, paddingLeft: 2,
        }}>
          {label}
        </p>
        <AnimatePresence>
          {items.map((m) => (
            <ModuleCard
              key={m.id}
              module={m}
              depWarning={getDepWarning(m.id)}
              onToggle={onToggle}
              onClick={onSelect}
              onAutoFix={onAutoFix}
            />
          ))}
        </AnimatePresence>
      </div>
    );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ padding: "0 16px 16px" }}
    >
      <Section label="ACTIVE" items={active} />
      <Section label="DISABLED" items={disabled} />
      <Section label="COMING SOON" items={soon} />
    </motion.div>
  );
}
