/** Apex Moments: today's prompt, ways to answer it, and what the community shared today. */
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Type, Image as ImageIcon, Video, Mic, BarChart3, Sparkles, Smile, HelpCircle, BookOpen } from "lucide-react";
import { socialApi, mediaSrc, type Post } from "@/lib/socialApi";
import { S, card, Avatar, sceneFor } from "@/components/social/ui";
import { SocialPage } from "@/components/social/Page";
import { useCreateFlow } from "@/components/social/CreateFlow";

export default function MomentsPage() {
  const [, nav] = useLocation();
  const create = useCreateFlow({ onPosted: () => void community.refetch() });
  const moment = useQuery({ queryKey: ["social-moment"], queryFn: socialApi.moment, staleTime: 60_000 });
  const community = useQuery({ queryKey: ["social-moment-answers"], queryFn: () => socialApi.feed("foryou", null, undefined, undefined, undefined, true) });
  const answers = community.data?.posts ?? [];

  const ring = (Icon: typeof Type, label: string, onClick: () => void) => (
    <button onClick={onClick} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, background: "none", border: 0, color: S.ink2, fontFamily: "Manrope, sans-serif", fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0 }}>
      <span style={{ width: 44, height: 44, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.05)", border: `1px solid ${S.line2}`, color: S.ink }}><Icon size={19} /></span>{label}
    </button>
  );
  const tool = (Icon: typeof Type, label: string, color: string, onClick: () => void) => (
    <button onClick={onClick} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "14px 4px 12px", borderRadius: 16, background: S.surf2, border: `1px solid ${S.line}`, color: S.ink, fontFamily: "Manrope, sans-serif", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>
      <span style={{ width: 40, height: 40, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.05)", color }}><Icon size={22} /></span>{label}
    </button>
  );

  return (
    <SocialPage title="Apex Moments">
      <div style={{ ...card, padding: 14, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: S.ink3 }}>Today's prompt</div>
        <div style={{ position: "relative", overflow: "hidden", borderRadius: 16, padding: 16, background: "linear-gradient(135deg, #1D1D22, #141417)", border: `1px solid ${S.line}` }}>
          <div aria-hidden style={{ position: "absolute", right: -30, top: -30, width: 140, height: 140, borderRadius: "50%", background: "radial-gradient(circle, rgba(226,193,126,0.18), rgba(226,193,126,0) 70%)" }} />
          <div style={{ position: "relative", fontFamily: "Sora, sans-serif", fontSize: 22, fontWeight: 700, lineHeight: 1.25, maxWidth: 260, minHeight: 56 }}>{moment.data?.prompt ?? " "}</div>
          <div style={{ position: "relative", fontSize: 12, color: S.ink2, marginTop: 8 }}>{moment.data?.answered ? "You've answered today. Add another?" : "Answer in your style"}{moment.data?.answers ? ` · ${moment.data.answers} shared today` : ""}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "0 4px" }}>
          {ring(Type, "Text", () => create.start("text", { moment: true }))}
          {ring(ImageIcon, "Photo", () => create.start("text", { moment: true }))}
          {ring(Video, "Video", () => create.start("video", { moment: true }))}
          {ring(Mic, "Voice", () => create.start("voice", { moment: true }))}
          {ring(BarChart3, "Poll", () => create.start("poll", { moment: true }))}
        </div>
      </div>

      <div style={{ ...card, padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 800 }}>More ways to create</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
          {tool(Sparkles, "AI Creation", "#EED9A8", () => create.start("ai"))}
          {tool(Smile, "Meme", S.ink2, () => create.start("meme"))}
          {tool(HelpCircle, "Ask Apex", S.ink2, () => create.start("ask"))}
          {tool(BookOpen, "Story", S.ink2, () => create.start("story"))}
        </div>
      </div>

      <div style={{ ...card, padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 800 }}>Community Moments</div>
        {community.isLoading ? <div style={{ fontSize: 13, color: S.ink3 }}>Loading…</div> : null}
        {!community.isLoading && !answers.length ? <div style={{ fontSize: 13, color: S.ink2 }}>No answers yet today. Be the first!</div> : null}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
          {answers.slice(0, 12).map((p) => <MomentTile key={p.id} post={p} onOpen={() => nav(p.video ? `/feed/reels?start=${p.id}` : `/feed/post/${p.id}`)} />)}
        </div>
      </div>
      {create.ui}
    </SocialPage>
  );
}

function MomentTile({ post, onOpen }: { post: Post; onOpen: () => void }) {
  const pic = post.media?.url ?? post.video?.poster ?? null;
  return (
    <button onClick={onOpen} style={{ borderRadius: 14, overflow: "hidden", background: S.surf2, border: `1px solid ${S.line}`, padding: 0, color: S.ink, textAlign: "left", cursor: "pointer", fontFamily: "Manrope, sans-serif" }}>
      <span aria-hidden style={{ display: "block", height: 118, background: pic ? `center / cover no-repeat url("${mediaSrc(pic)}")` : sceneFor(post.id) }} />
      <span style={{ display: "flex", flexDirection: "column", gap: 8, padding: 8 }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{post.body || (post.audio ? "Voice note" : post.video ? "Reel" : "Moment")}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Avatar user={post.author} size={18} /><span style={{ fontSize: 10.5, color: S.ink3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{post.author.username}</span></span>
      </span>
    </button>
  );
}
