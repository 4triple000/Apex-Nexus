/**
 * MemoryManager — Full CRUD UI for Apex's memory system.
 * Users can view, edit, delete, and manually add memory items per category.
 */
import { useState, useRef, useEffect } from "react";
import { Trash2, Plus, Check, X, ChevronDown, ChevronRight, Brain, Sparkles, Target, Clock, Pencil } from "lucide-react";
import { useCharacter } from "@/hooks/useCharacter";
import { MemoryStore } from "@/lib/characterEngine";

const IOS    = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";
const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

type MemoryCategory = keyof Omit<MemoryStore, "emotionalPatterns">;

const CATEGORIES: {
  key:   MemoryCategory;
  label: string;
  icon:  React.ReactNode;
  color: string;
  glow:  string;
  desc:  string;
  placeholder: string;
}[] = [
  {
    key:   "facts",
    label: "Facts",
    icon:  <Brain size={13} />,
    color: "#A29BFE",
    glow:  "rgba(162,155,254,0.20)",
    desc:  "Things Apex knows about you",
    placeholder: "e.g. I work in software engineering",
  },
  {
    key:   "preferences",
    label: "Preferences",
    icon:  <Sparkles size={13} />,
    color: "#FD79A8",
    glow:  "rgba(253,121,168,0.20)",
    desc:  "Your likes, dislikes & style",
    placeholder: "e.g. I prefer concise answers",
  },
  {
    key:   "goals",
    label: "Goals",
    icon:  <Target size={13} />,
    color: "#10B981",
    glow:  "rgba(16,185,129,0.20)",
    desc:  "What you're working towards",
    placeholder: "e.g. Launch my SaaS by Q3",
  },
  {
    key:   "pastTopics",
    label: "Past Topics",
    icon:  <Clock size={13} />,
    color: "#F59E0B",
    glow:  "rgba(245,158,11,0.20)",
    desc:  "Conversations you've had",
    placeholder: "e.g. React performance optimization",
  },
];

// ── Inline editable memory item ───────────────────────────────────────────────

function MemoryItem({
  value,
  color,
  onSave,
  onDelete,
  animIdx,
}: {
  value:     string;
  color:     string;
  onSave:    (v: string) => void;
  onDelete:  () => void;
  animIdx:   number;
}) {
  const [editing,  setEditing]  = useState(false);
  const [draft,    setDraft]    = useState(value);
  const [deleting, setDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  function handleSave() {
    if (draft.trim()) onSave(draft.trim());
    setEditing(false);
  }

  function handleDelete() {
    setDeleting(true);
    setTimeout(onDelete, 260);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") { setDraft(value); setEditing(false); }
  }

  return (
    <div style={{
      display:    "flex",
      alignItems: "center",
      gap:        8,
      padding:    "8px 10px",
      borderRadius: 10,
      background: editing ? `${color}10` : "rgba(255,255,255,0.03)",
      border:     `1px solid ${editing ? color + "35" : "rgba(255,255,255,0.07)"}`,
      transition: `all 0.22s ${IOS}`,
      opacity:    deleting ? 0 : 1,
      transform:  deleting ? "translateX(12px)" : "translateX(0)",
      animation:  `mm-item-in 0.28s ${animIdx * 0.04}s ${SPRING} both`,
    }}>
      {editing ? (
        <>
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              flex:        1,
              background:  "transparent",
              border:      "none",
              outline:     "none",
              color:       "rgba(255,255,255,0.90)",
              fontSize:    11,
              fontFamily:  "inherit",
              padding:     0,
            }}
          />
          <button
            onClick={handleSave}
            style={{ background: "none", border: "none", cursor: "pointer", color: color, padding: 2, borderRadius: 5 }}
          >
            <Check size={13} />
          </button>
          <button
            onClick={() => { setDraft(value); setEditing(false); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.30)", padding: 2, borderRadius: 5 }}
          >
            <X size={13} />
          </button>
        </>
      ) : (
        <>
          <div style={{
            width: 5, height: 5, borderRadius: "50%",
            background: color, flexShrink: 0, opacity: 0.75,
          }} />
          <span style={{
            flex: 1, fontSize: 11, color: "rgba(255,255,255,0.72)",
            lineHeight: 1.45, wordBreak: "break-word",
          }}>
            {value}
          </span>
          <button
            onClick={() => setEditing(true)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "rgba(255,255,255,0.22)", padding: 2, borderRadius: 5,
              transition: `color 0.15s ${IOS}`,
              flexShrink: 0,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = color; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.22)"; }}
          >
            <Pencil size={11} />
          </button>
          <button
            onClick={handleDelete}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "rgba(255,255,255,0.22)", padding: 2, borderRadius: 5,
              transition: `color 0.15s ${IOS}`,
              flexShrink: 0,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#FF6B6B"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.22)"; }}
          >
            <Trash2 size={11} />
          </button>
        </>
      )}
    </div>
  );
}

// ── Add memory input row ───────────────────────────────────────────────────────

function AddMemoryRow({
  color,
  placeholder,
  onAdd,
}: {
  color:       string;
  placeholder: string;
  onAdd:       (v: string) => void;
}) {
  const [open,  setOpen]  = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  function handleSubmit() {
    if (draft.trim()) { onAdd(draft.trim()); setDraft(""); setOpen(false); }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSubmit();
    if (e.key === "Escape") { setDraft(""); setOpen(false); }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          display:    "flex",
          alignItems: "center",
          gap:        6,
          width:      "100%",
          padding:    "7px 10px",
          borderRadius: 10,
          background:   "transparent",
          border:       `1px dashed ${color}40`,
          color:        color,
          fontSize:     11,
          fontWeight:   600,
          cursor:       "pointer",
          transition:   `all 0.18s ${IOS}`,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = `${color}10`; e.currentTarget.style.borderColor = `${color}70`; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = `${color}40`; }}
      >
        <Plus size={12} />
        Add memory
      </button>
    );
  }

  return (
    <div style={{
      display:    "flex",
      alignItems: "center",
      gap:        6,
      padding:    "7px 10px",
      borderRadius: 10,
      background:   `${color}10`,
      border:       `1px solid ${color}50`,
      animation:    `mm-item-in 0.20s ${SPRING} both`,
    }}>
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKey}
        placeholder={placeholder}
        style={{
          flex:        1,
          background:  "transparent",
          border:      "none",
          outline:     "none",
          color:       "rgba(255,255,255,0.90)",
          fontSize:    11,
          fontFamily:  "inherit",
          padding:     0,
        }}
      />
      <button
        onClick={handleSubmit}
        disabled={!draft.trim()}
        style={{
          background: draft.trim() ? color : "rgba(255,255,255,0.10)",
          border:     "none", cursor: draft.trim() ? "pointer" : "default",
          color:      "white", padding: "3px 8px", borderRadius: 6,
          fontSize:   10, fontWeight: 700,
          transition: `background 0.15s ${IOS}`,
        }}
      >
        Save
      </button>
      <button
        onClick={() => { setDraft(""); setOpen(false); }}
        style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.30)", padding: 2 }}
      >
        <X size={12} />
      </button>
    </div>
  );
}

// ── Category section card ──────────────────────────────────────────────────────

function CategoryCard({
  cat,
  items,
  onAdd,
  onUpdate,
  onDelete,
  defaultOpen,
}: {
  cat:       typeof CATEGORIES[number];
  items:     string[];
  onAdd:     (v: string) => void;
  onUpdate:  (i: number, v: string) => void;
  onDelete:  (i: number) => void;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{
      borderRadius: 16,
      background:   "rgba(18,20,30,0.85)",
      border:       `1px solid ${open ? cat.color + "30" : "rgba(255,255,255,0.07)"}`,
      overflow:     "hidden",
      transition:   `border-color 0.22s ${IOS}`,
      backdropFilter: "blur(12px)",
    }}>
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width:      "100%",
          display:    "flex",
          alignItems: "center",
          gap:        10,
          padding:    "12px 14px",
          background: open ? `${cat.glow}` : "transparent",
          border:     "none",
          cursor:     "pointer",
          textAlign:  "left",
          transition: `background 0.22s ${IOS}`,
        }}
      >
        <div style={{
          width: 30, height: 30, borderRadius: 10,
          background: `${cat.color}18`,
          border:     `1px solid ${cat.color}30`,
          display:    "flex", alignItems: "center", justifyContent: "center",
          color:      cat.color, flexShrink: 0,
        }}>
          {cat.icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.90)" }}>{cat.label}</div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>{cat.desc}</div>
        </div>
        <div style={{
          minWidth: 22, height: 22, borderRadius: 8,
          background: items.length > 0 ? `${cat.color}20` : "rgba(255,255,255,0.05)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, fontWeight: 700,
          color: items.length > 0 ? cat.color : "rgba(255,255,255,0.25)",
        }}>
          {items.length}
        </div>
        <div style={{
          color: "rgba(255,255,255,0.30)",
          transition: `transform 0.22s ${SPRING}`,
          transform: open ? "rotate(0deg)" : "rotate(-90deg)",
          marginLeft: 2,
        }}>
          <ChevronDown size={13} />
        </div>
      </button>

      {/* Body */}
      {open && (
        <div style={{
          padding: "0 12px 12px",
          display: "flex", flexDirection: "column", gap: 6,
          animation: `mm-section-in 0.22s ${IOS} both`,
        }}>
          {items.length === 0 ? (
            <div style={{
              padding: "14px 10px", textAlign: "center",
              fontSize: 10, color: "rgba(255,255,255,0.22)",
              borderRadius: 10, background: "rgba(255,255,255,0.02)",
              border: "1px dashed rgba(255,255,255,0.07)",
            }}>
              No {cat.label.toLowerCase()} remembered yet
            </div>
          ) : (
            items.map((item, idx) => (
              <MemoryItem
                key={`${item}-${idx}`}
                value={item}
                color={cat.color}
                animIdx={idx}
                onSave={(v) => onUpdate(idx, v)}
                onDelete={() => onDelete(idx)}
              />
            ))
          )}
          <AddMemoryRow color={cat.color} placeholder={cat.placeholder} onAdd={onAdd} />
        </div>
      )}
    </div>
  );
}

// ── Main MemoryManager component ──────────────────────────────────────────────

export function MemoryManager() {
  const { memory, addMemory, updateMemory, deleteMemory, clearMemory } = useCharacter();
  const [confirmClear, setConfirmClear] = useState(false);

  const totalItems =
    memory.facts.length + memory.preferences.length +
    memory.goals.length + memory.pastTopics.length;

  function handleClearAll() {
    if (confirmClear) { clearMemory(); setConfirmClear(false); }
    else { setConfirmClear(true); setTimeout(() => setConfirmClear(false), 3500); }
  }

  return (
    <>
      <style>{`
        @keyframes mm-item-in {
          from { opacity: 0; transform: translateY(6px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
        @keyframes mm-section-in {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
      `}</style>

      {/* Header row */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 10,
      }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.80)" }}>
            Memory Manager
          </div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.28)", marginTop: 2 }}>
            {totalItems === 0
              ? "Nothing remembered yet — start chatting!"
              : `${totalItems} item${totalItems !== 1 ? "s" : ""} stored across ${CATEGORIES.length} categories`}
          </div>
        </div>
        {totalItems > 0 && (
          <button
            onClick={handleClearAll}
            style={{
              padding: "5px 10px", borderRadius: 9,
              background:  confirmClear ? "rgba(255,80,80,0.18)" : "rgba(255,255,255,0.04)",
              border:      `1px solid ${confirmClear ? "rgba(255,80,80,0.40)" : "rgba(255,255,255,0.09)"}`,
              color:       confirmClear ? "#FF6B6B" : "rgba(255,255,255,0.38)",
              fontSize:    10, fontWeight: 700, cursor: "pointer",
              transition:  `all 0.20s ${IOS}`,
              whiteSpace:  "nowrap",
            }}
          >
            {confirmClear ? "⚠️ Confirm clear?" : "Clear all"}
          </button>
        )}
      </div>

      {/* Category cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {CATEGORIES.map((cat, idx) => (
          <CategoryCard
            key={cat.key}
            cat={cat}
            items={(memory[cat.key] as string[])}
            defaultOpen={idx === 0}
            onAdd={(v) => addMemory(cat.key, v)}
            onUpdate={(i, v) => updateMemory(cat.key, i, v)}
            onDelete={(i) => deleteMemory(cat.key, i)}
          />
        ))}
      </div>
    </>
  );
}
