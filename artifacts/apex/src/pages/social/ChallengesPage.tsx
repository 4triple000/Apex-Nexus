/** Challenges: Discover what's running, the ones you've joined, and your progress in each. */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Check, Plus, Trophy } from "lucide-react";
import { socialApi, compact, endsIn, type Challenge } from "@/lib/socialApi";
import { S, card, sceneFor, iconBtn } from "@/components/social/ui";
import { SocialPage } from "@/components/social/Page";
import { ChallengeSheet } from "@/components/social/Challenges";
import { useCreateFlow } from "@/components/social/CreateFlow";

type Tab = "discover" | "joined" | "progress";

export default function ChallengesPage() {
  const [, nav] = useLocation();
  const create = useCreateFlow({ onPosted: () => void list.refetch() });
  const list = useQuery({ queryKey: ["social-challenges"], queryFn: socialApi.challenges });
  const [tab, setTab] = useState<Tab>("discover");
  const [open, setOpen] = useState<number | null>(null);
  const active = list.data?.active ?? [];
  const shown = tab === "discover" ? active : active.filter((c) => c.joined);

  return (
    <SocialPage title="Challenges" right={<button onClick={create.startChallenge} aria-label="Start a challenge" style={{ ...iconBtn, color: S.ink }}><Plus size={22} /></button>}>
      <div role="tablist" style={{ display: "flex", gap: 22, borderBottom: `1px solid ${S.line}`, fontSize: 13, fontWeight: 700, marginTop: -6 }}>
        {([["discover", "Discover"], ["joined", "Joined"], ["progress", "My Progress"]] as const).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            style={{ background: "none", border: 0, padding: "8px 0", marginBottom: -1, color: tab === id ? S.ink : S.ink3, borderBottom: `2px solid ${tab === id ? S.gold : "transparent"}`, font: "inherit", cursor: "pointer" }}>{label}</button>
        ))}
      </div>
      {list.isLoading ? <div style={{ fontSize: 13, color: S.ink3 }}>Loading…</div> : null}
      {list.error ? <div style={{ fontSize: 13, color: "#FF8A8A" }}>{(list.error as Error).message}</div> : null}
      {!list.isLoading && !shown.length ? (
        <div style={{ ...card, padding: 22, textAlign: "center", display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
          <Trophy size={26} color={S.gold} />
          <div style={{ fontSize: 14, fontWeight: 800 }}>{tab === "discover" ? "No challenges running" : "You haven't joined any challenges yet"}</div>
          <div style={{ fontSize: 13, color: S.ink2 }}>{tab === "discover" ? "Start one and invite people to join." : "Join one from Discover by posting an entry."}</div>
        </div>
      ) : null}

      {tab === "progress" ? shown.map((c) => <Progress key={c.id} c={c} onOpen={() => setOpen(c.id)} />)
        : shown.map((c) => <ChallengeCard key={c.id} c={c} onOpen={() => setOpen(c.id)} onJoin={() => create.start("challenge", { challengeId: c.id })} />)}

      {list.data?.ended.length && tab === "discover" ? (
        <>
          <div style={{ fontSize: 12, fontWeight: 800, color: S.ink2, marginTop: 8 }}>Recently ended</div>
          {list.data.ended.map((c) => <ChallengeCard key={c.id} c={c} onOpen={() => setOpen(c.id)} />)}
        </>
      ) : null}

      <ChallengeSheet id={open} onClose={() => setOpen(null)} onJoin={(c) => { setOpen(null); create.start("challenge", { challengeId: c.id }); }}
        onSeeAll={(c) => { setOpen(null); nav(`/feed?challenge=${c.id}`); }} onPostChange={() => undefined}
        onOpenComments={(p) => { setOpen(null); nav(`/feed/post/${p.id}`); }} onTag={(t) => nav(`/feed?tag=${encodeURIComponent(t)}`)} />
      {create.ui}
    </SocialPage>
  );
}

function ChallengeCard({ c, onOpen, onJoin }: { c: Challenge; onOpen: () => void; onJoin?: () => void }) {
  const line = c.ended ? "Ended" : c.totalDays > 1 ? `Day ${c.day} / ${c.totalDays}` : endsIn(c.endsAt);
  return (
    <div role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => e.key === "Enter" && onOpen()}
      style={{ position: "relative", overflow: "hidden", borderRadius: 18, border: `1px solid ${c.official ? "rgba(226,193,126,0.35)" : S.line}`, background: sceneFor(c.tag), padding: 14, minHeight: 104, boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "space-between", cursor: "pointer", opacity: c.ended ? 0.7 : 1 }}>
      <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(10,10,12,0.92) 20%, rgba(10,10,12,0.35))" }} />
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14.5, fontWeight: 800 }}>{c.official ? <Trophy size={14} color={S.gold} /> : null}{c.title}</div>
        <div style={{ fontSize: 12, color: S.ink2, marginTop: 4 }}>{line}{c.description ? ` · ${c.description}` : ""}</div>
      </div>
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 18 }}>
        <span style={{ fontSize: 12, color: c.joined ? S.ink : S.ink2, fontWeight: c.joined ? 800 : 500 }}>{compact(c.entries)} joined</span>
        {c.ended ? null : c.joined ? (
          <span style={{ height: 26, padding: "0 10px", borderRadius: 8, display: "flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 800, background: "rgba(255,255,255,0.08)", color: S.ink, border: "1px solid rgba(255,255,255,0.2)" }}><Check size={12} />JOINED</span>
        ) : onJoin ? (
          <button onClick={(e) => { e.stopPropagation(); onJoin(); }} style={{ height: 28, padding: "0 14px", borderRadius: 8, border: `1px solid ${S.line2}`, background: "rgba(10,10,12,0.5)", color: S.ink, fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: "Manrope, sans-serif" }}>JOIN</button>
        ) : null}
      </div>
    </div>
  );
}

function Progress({ c, onOpen }: { c: Challenge; onOpen: () => void }) {
  const pct = Math.round((c.day / c.totalDays) * 100);
  return (
    <button onClick={onOpen} style={{ ...card, padding: 14, display: "flex", flexDirection: "column", gap: 10, color: S.ink, textAlign: "left", cursor: "pointer", fontFamily: "Manrope, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 800 }}>{c.title}</span>
        <span style={{ fontSize: 12, color: S.gold, fontWeight: 800 }}>Day {c.day} / {c.totalDays}</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: S.surf2, overflow: "hidden" }}><div style={{ height: "100%", width: `${pct}%`, background: S.gold }} /></div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: S.ink3 }}>
        <span>{c.myEntries} entr{c.myEntries === 1 ? "y" : "ies"} from you · #{c.tag}</span><span>{endsIn(c.endsAt)}</span>
      </div>
    </button>
  );
}
