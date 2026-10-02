/** Search people, hashtags and public circles. */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Search as SearchIcon, Hash, Loader2 } from "lucide-react";
import { socialApi, compact } from "@/lib/socialApi";
import { S, Sheet, Avatar, SectionLabel } from "./ui";

export function SearchSheet({ open, onClose, onTag, onCircle }: { open: boolean; onClose: () => void; onTag: (tag: string) => void; onCircle: (id: number) => void }) {
  const [, nav] = useLocation();
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => { if (open) { setQ(""); setTerm(""); } }, [open]);
  useEffect(() => { const t = setTimeout(() => setTerm(q.trim()), 250); return () => clearTimeout(t); }, [q]);
  const { data, isFetching } = useQuery({ queryKey: ["social-search", term], enabled: open && term.length > 0, queryFn: () => socialApi.search(term) });
  const empty = data && !data.people.length && !data.tags.length && !data.circles.length;
  const row: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12, padding: "8px 4px", background: "none", border: 0, color: S.ink, cursor: "pointer", textAlign: "left", width: "100%", fontFamily: "Manrope, sans-serif" };

  return (
    <Sheet open={open} onClose={onClose} label="Search" title="Search">
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 10, height: 46, padding: "0 14px", borderRadius: 23, background: S.surf, border: `1px solid ${S.line2}` }}>
          <SearchIcon size={18} color={S.ink3} />
          <span style={{ position: "absolute", left: -9999 }}>Search</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus placeholder="People, #tags, circles" style={{ flexGrow: 1, background: "none", border: 0, outline: "none", color: S.ink, fontFamily: "Manrope, sans-serif", fontSize: 15 }} />
          {isFetching ? <Loader2 size={16} className="animate-spin" color={S.ink3} /> : null}
        </label>
        {!term ? <div style={{ fontSize: 13, color: S.ink3 }}>Find people to follow, hashtags to explore and circles to join.</div> : null}
        {empty ? <div style={{ fontSize: 13.5, color: S.ink2 }}>Nothing found for “{term}”.</div> : null}
        {data?.people.length ? (
          <div>
            <SectionLabel>People</SectionLabel>
            {data.people.map((p) => (
              <button key={p.id} onClick={() => { onClose(); nav(`/u/${p.id}`); }} style={row}>
                <Avatar user={p} size={40} />
                <span style={{ flexGrow: 1 }}><span style={{ display: "block", fontSize: 14, fontWeight: 800 }}>{p.username}</span><span style={{ display: "block", fontSize: 12, color: S.ink3 }}>{compact(p.followersCount ?? 0)} followers</span></span>
              </button>
            ))}
          </div>
        ) : null}
        {data?.tags.length ? (
          <div>
            <SectionLabel>Hashtags</SectionLabel>
            {data.tags.map((t) => (
              <button key={t.tag} onClick={() => { onClose(); onTag(t.tag); }} style={row}>
                <span style={{ width: 40, height: 40, borderRadius: "50%", background: S.goldSoft, display: "flex", alignItems: "center", justifyContent: "center" }}><Hash size={18} color={S.gold} /></span>
                <span style={{ flexGrow: 1 }}><span style={{ display: "block", fontSize: 14, fontWeight: 800 }}>#{t.tag}</span><span style={{ display: "block", fontSize: 12, color: S.ink3 }}>{compact(t.count)} posts</span></span>
              </button>
            ))}
          </div>
        ) : null}
        {data?.circles.length ? (
          <div>
            <SectionLabel>Circles</SectionLabel>
            {data.circles.map((c) => (
              <button key={c.id} onClick={() => { onClose(); onCircle(c.id); }} style={row}>
                <span style={{ width: 40, height: 40, borderRadius: 13, background: "linear-gradient(145deg,#2A2722,#16161A)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{c.emoji}</span>
                <span style={{ flexGrow: 1 }}><span style={{ display: "block", fontSize: 14, fontWeight: 800 }}>{c.name}</span><span style={{ display: "block", fontSize: 12, color: S.ink3 }}>{compact(c.memberCount)} members</span></span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}
