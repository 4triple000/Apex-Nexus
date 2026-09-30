/**
 * The game's characters, each with an ElevenLabs voice you can pick and hear.
 */
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2, Volume2, Loader2 } from "lucide-react";
import { authHeaders } from "@/lib/authSession";
import type { GamePlan } from "@/lib/engineApi";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
type Character = GamePlan["characters"][number];
interface Voice { id: string; name: string; style: string }

export function CharacterList({ characters, onChange }: { characters: Character[]; onChange: (c: Character[]) => void }) {
  const voices = useQuery({
    queryKey: ["character-voices"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/voices/characters`);
      const json = await res.json();
      return json.data as { voices: Voice[]; connected: boolean };
    },
    staleTime: 5 * 60_000,
  });
  const [playing, setPlaying] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  const set = (i: number, patch: Partial<Character>) => onChange(characters.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  const hear = async (i: number) => {
    const c = characters[i];
    if (!c.voiceId) { setNote("Pick a voice first."); return; }
    setNote(null);
    setPlaying(i);
    try {
      const line = `I'm ${c.name || "ready"}. ${c.role || "Let's go."}`.slice(0, 300);
      const res = await fetch(`${BASE}/api/voices/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ voiceId: c.voiceId, text: line }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(json?.error ?? "Couldn't play that voice.");
      }
      const url = URL.createObjectURL(await res.blob());
      audio.current?.pause();
      audio.current = new Audio(url);
      audio.current.onended = () => { setPlaying(null); URL.revokeObjectURL(url); };
      await audio.current.play();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Couldn't play that voice.");
      setPlaying(null);
    }
  };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <span style={label}>Characters</span>
      <p style={{ margin: "-6px 0 0", fontSize: 12.5, color: "var(--mg-ink-3)" }}>
        Give each character a voice from ElevenLabs.{voices.data && !voices.data.connected ? " Voices play once ElevenLabs is connected." : ""}
      </p>
      {characters.map((c, i) => (
        <div key={i} style={{ display: "grid", gap: 6, padding: 10, borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={c.name} placeholder="Name" aria-label={`Name ${i + 1}`} onChange={(e) => set(i, { name: e.target.value.slice(0, 80) })} style={{ ...box, fontWeight: 700 }} />
            <button onClick={() => onChange(characters.filter((_, j) => j !== i))} aria-label={`Remove character ${i + 1}`} className="mg-cc mg-focus" style={{ width: 38, height: 38 }}><Trash2 size={14} /></button>
          </div>
          <input value={c.role} placeholder="Role" aria-label={`Role ${i + 1}`} onChange={(e) => set(i, { role: e.target.value.slice(0, 240) })} style={box} />
          <div style={{ display: "flex", gap: 8 }}>
            <select value={c.voiceId ?? ""} aria-label={`Voice for ${c.name || `character ${i + 1}`}`}
              onChange={(e) => { const v = voices.data?.voices.find((x) => x.id === e.target.value); set(i, { voiceId: v?.id, voiceName: v?.name }); }}
              style={{ ...box, cursor: "pointer" }}>
              <option value="">No voice</option>
              {voices.data?.voices.map((v) => <option key={v.id} value={v.id}>{v.name}: {v.style}</option>)}
            </select>
            <button onClick={() => hear(i)} disabled={playing !== null} aria-label={`Hear ${c.name || "this character"}`} className="mg-cc mg-focus" style={{ width: 38, height: 38, flexShrink: 0 }}>
              {playing === i ? <Loader2 size={15} className="animate-spin" /> : <Volume2 size={15} />}
            </button>
          </div>
        </div>
      ))}
      {note && <p role="status" style={{ margin: 0, fontSize: 12.5, color: "#FFB3CF" }}>{note}</p>}
      {characters.length < 16 && (
        <button onClick={() => onChange([...characters, { name: "", role: "" }])} className="mg-focus"
          style={{ height: 36, borderRadius: 18, border: "1px dashed rgba(255,255,255,0.25)", background: "transparent", color: "var(--mg-ink-2)", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Plus size={14} /> Add character
        </button>
      )}
    </div>
  );
}

const label: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mg-ink-3)" };
const box: React.CSSProperties = { height: 38, borderRadius: 12, padding: "0 12px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", color: "var(--mg-ink)", fontSize: 14, fontFamily: "inherit", outline: "none", width: "100%", minWidth: 0 };
