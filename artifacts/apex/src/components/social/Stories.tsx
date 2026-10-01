/**
 * Stories: the row of rings at the top of Social, the full-screen viewer, and "Add to your story".
 * A gold ring means there's something you haven't seen. Stories disappear after 24 hours.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Trash2, Eye, Loader2, Image as ImageIcon, Type } from "lucide-react";
import { socialApi, mediaSrc, resizePhoto, timeAgo, type Story, type StoryBg, type StoryGroup } from "@/lib/socialApi";
import { useAuth } from "@/contexts/AuthContext";
import { S, Avatar, Sheet, primaryBtn, ghostBtn } from "./ui";

export const STORY_BG: Record<StoryBg, { css: string; ink: string }> = {
  night: { css: "linear-gradient(160deg, #24242B, #0A0A0C)", ink: "#F5F5F7" },
  gold: { css: "linear-gradient(160deg, #EBCB8B, #8A6A34)", ink: "#17120A" },
  ember: { css: "linear-gradient(160deg, #FF9B6B, #9C3B1E)", ink: "#FFF5EE" },
  ocean: { css: "linear-gradient(160deg, #5F9CC6, #16324A)", ink: "#F2F8FC" },
  rose: { css: "linear-gradient(160deg, #F29BAE, #7A2E44)", ink: "#FFF3F6" },
  mono: { css: "linear-gradient(160deg, #F5F5F7, #B5B5BD)", ink: "#0A0A0C" },
};
const STORY_MS = 5000;

export function StoryTray({ onOpen, onAdd }: { onOpen: (groups: StoryGroup[], index: number) => void; onAdd: () => void }) {
  const { user } = useAuth();
  const { data } = useQuery({ queryKey: ["social-stories"], queryFn: socialApi.stories, staleTime: 30_000 });
  const groups = data ?? [];
  const mine = groups.find((g) => g.mine);
  const others = groups.filter((g) => !g.mine);
  const ring = (unseen: boolean) => ({ padding: 2.5, borderRadius: "50%", background: unseen ? `conic-gradient(${S.gold}, #F3DFAE, ${S.gold})` : "rgba(255,255,255,0.18)" });

  return (
    <div role="list" aria-label="Stories" style={{ display: "flex", gap: 14, overflowX: "auto", scrollbarWidth: "none", margin: "0 -16px", padding: "2px 16px 4px" }}>
      <div role="listitem" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0, width: 66 }}>
        <span style={{ position: "relative" }}>
          <button onClick={() => (mine ? onOpen(groups, groups.indexOf(mine)) : onAdd())} aria-label={mine ? "See your story" : "Add to your story"}
            style={{ ...ring(false), border: 0, cursor: "pointer", display: "block" }}>
            <span style={{ display: "block", padding: 2, borderRadius: "50%", background: S.bg }}>
              <Avatar user={{ username: user?.username ?? "You", avatarUrl: (user as { avatarUrl?: string | null } | null)?.avatarUrl ?? null, avatarEmoji: null }} size={56} />
            </span>
          </button>
          <button onClick={onAdd} aria-label="Add to your story"
            style={{ position: "absolute", right: -2, bottom: -2, width: 22, height: 22, borderRadius: "50%", border: `2px solid ${S.bg}`, background: S.btn, color: S.btnText, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
            <Plus size={13} strokeWidth={3} />
          </button>
        </span>
        <span style={{ fontSize: 11, color: S.ink2, fontWeight: 600 }}>Your story</span>
      </div>
      {others.map((g) => (
        <div role="listitem" key={g.author.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0, width: 66 }}>
          <button onClick={() => onOpen(groups, groups.indexOf(g))} aria-label={`${g.author.username}'s story${g.allSeen ? "" : ", new"}`} style={{ ...ring(!g.allSeen), border: 0, cursor: "pointer", display: "block" }}>
            <span style={{ display: "block", padding: 2, borderRadius: "50%", background: S.bg }}><Avatar user={g.author} size={56} /></span>
          </button>
          <span style={{ fontSize: 11, color: g.allSeen ? S.ink3 : S.ink, fontWeight: 600, maxWidth: 66, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.author.username}</span>
        </div>
      ))}
      {!others.length ? (
        <div style={{ display: "flex", alignItems: "center", fontSize: 12, color: S.ink3, paddingBottom: 18, flexShrink: 0 }}>Follow people to see their stories here</div>
      ) : null}
    </div>
  );
}

/** Full-screen story player. Tap the right side for next, left for back, hold to pause. */
export function StoryViewer({ groups, start, onClose }: { groups: StoryGroup[]; start: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [gi, setGi] = useState(start);
  // Start each person's stories at the first one you haven't seen
  const firstUnseen = (g?: StoryGroup) => Math.max(0, g ? g.stories.findIndex((s) => !s.seen) : 0);
  const [si, setSi] = useState(() => firstUnseen(groups[start]));
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [viewers, setViewers] = useState<{ id: number; list: Awaited<ReturnType<typeof socialApi.storyViewers>> } | null>(null);
  const viewed = useRef(new Set<number>());

  const group = groups[gi];
  const story: Story | undefined = group?.stories[si];

  const next = useCallback(() => {
    if (!group) return onClose();
    if (si + 1 < group.stories.length) { setSi(si + 1); setProgress(0); return; }
    if (gi + 1 < groups.length) { setGi(gi + 1); setSi(firstUnseen(groups[gi + 1])); setProgress(0); return; }
    onClose();
  }, [group, si, gi, groups, onClose]);
  const prev = () => {
    if (si > 0) { setSi(si - 1); setProgress(0); return; }
    if (gi > 0) { setGi(gi - 1); setSi(0); setProgress(0); }
  };

  // Mark seen once per story
  useEffect(() => {
    if (!story || group?.mine || viewed.current.has(story.id)) return;
    viewed.current.add(story.id);
    void socialApi.viewStory(story.id).catch(() => undefined);
  }, [story, group]);

  // Refresh the tray (rings turn grey) when the viewer closes
  useEffect(() => () => { void qc.invalidateQueries({ queryKey: ["social-stories"] }); }, [qc]);

  useEffect(() => {
    if (paused || viewers || !story) return;
    const started = Date.now() - progress * STORY_MS;
    const t = setInterval(() => {
      const p = (Date.now() - started) / STORY_MS;
      if (p >= 1) { clearInterval(t); next(); } else setProgress(p);
    }, 50);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, viewers, story?.id, next]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); if (e.key === "ArrowRight") next(); if (e.key === "ArrowLeft") prev(); };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prevOverflow; };
  });

  if (!group || !story) return null;
  const bg = STORY_BG[story.bg] ?? STORY_BG.night;

  const remove = async () => {
    if (!window.confirm("Delete this story?")) return;
    await socialApi.deleteStory(story.id).catch(() => undefined);
    void qc.invalidateQueries({ queryKey: ["social-stories"] });
    onClose();
  };
  const openViewers = async () => {
    setPaused(true);
    setViewers({ id: story.id, list: await socialApi.storyViewers(story.id).catch(() => []) });
  };

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`${group.author.username}'s story`} className="mg-font"
      style={{ position: "fixed", inset: 0, zIndex: 9500, background: "#000", display: "flex", justifyContent: "center" }}>
      <div style={{ position: "relative", width: "100%", maxWidth: 480, height: "100%", background: story.media ? "#000" : bg.css, overflow: "hidden" }}>
        {story.media ? <img src={mediaSrc(story.media.url)} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} /> : null}
        {story.text ? (
          <div style={{ position: "absolute", left: 24, right: 24, ...(story.media ? { bottom: 110 } : { top: "50%", transform: "translateY(-50%)" }), textAlign: "center" }}>
            <span style={{ fontFamily: "Sora, sans-serif", fontWeight: 700, fontSize: story.media ? 20 : story.text.length > 80 ? 22 : 30, lineHeight: 1.3, color: story.media ? "#fff" : bg.ink, whiteSpace: "pre-wrap", ...(story.media ? { background: "rgba(0,0,0,0.55)", padding: "6px 12px", borderRadius: 12, boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" } : {}) }}>{story.text}</span>
          </div>
        ) : null}

        {/* Tap zones: back on the left third, next on the rest; holding pauses */}
        <button aria-label="Previous" onClick={prev} onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)} onPointerLeave={() => setPaused(false)}
          style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "33%", background: "none", border: 0, cursor: "pointer" }} />
        <button aria-label="Next" onClick={next} onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)} onPointerLeave={() => setPaused(false)}
          style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "67%", background: "none", border: 0, cursor: "pointer" }} />

        <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "calc(10px + env(safe-area-inset-top, 0px)) 12px 24px", background: "linear-gradient(rgba(0,0,0,0.45), transparent)", pointerEvents: "none" }}>
          <div style={{ display: "flex", gap: 4 }}>
            {group.stories.map((s, i) => (
              <span key={s.id} style={{ flex: 1, height: 2.5, borderRadius: 2, background: "rgba(255,255,255,0.3)", overflow: "hidden" }}>
                <span style={{ display: "block", height: "100%", background: "#fff", width: `${i < si ? 100 : i === si ? progress * 100 : 0}%` }} />
              </span>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, pointerEvents: "auto" }}>
            <Avatar user={group.author} size={34} />
            <div style={{ flexGrow: 1, color: "#fff", fontSize: 13.5, fontWeight: 700 }}>{group.mine ? "Your story" : group.author.username} <span style={{ fontWeight: 500, opacity: 0.75 }}>· {timeAgo(story.createdAt)}</span></div>
            {group.mine ? <button onClick={() => void remove()} aria-label="Delete story" style={{ width: 36, height: 36, borderRadius: "50%", border: 0, background: "rgba(0,0,0,0.35)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Trash2 size={17} /></button> : null}
            <button onClick={onClose} aria-label="Close" style={{ width: 36, height: 36, borderRadius: "50%", border: 0, background: "rgba(0,0,0,0.35)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><X size={20} /></button>
          </div>
        </div>

        {group.mine ? (
          <button onClick={() => void openViewers()} style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: "calc(24px + env(safe-area-inset-bottom, 0px))", display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 14px", borderRadius: 18, border: 0, background: "rgba(0,0,0,0.5)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Manrope, sans-serif" }}>
            <Eye size={15} /> Seen by {story.viewCount ?? 0}
          </button>
        ) : null}
      </div>

      <Sheet open={!!viewers} onClose={() => { setViewers(null); setPaused(false); }} label="Story viewers" title={`Seen by ${viewers?.list.length ?? 0}`} maxWidth={440} z={9600}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {viewers?.list.length ? viewers.list.map((v) => (
            <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar user={v} size={36} />
              <span style={{ flexGrow: 1, fontSize: 14, fontWeight: 700 }}>{v.username}</span>
              <span style={{ fontSize: 12, color: S.ink3 }}>{timeAgo(v.seenAt)}</span>
            </div>
          )) : <div style={{ fontSize: 13.5, color: S.ink3 }}>Nobody yet. Your followers will show up here when they watch.</div>}
        </div>
      </Sheet>
    </div>,
    document.body,
  );
}

export function StoryComposer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"photo" | "text">("text");
  const [text, setText] = useState("");
  const [bg, setBg] = useState<StoryBg>("gold");
  const [photo, setPhoto] = useState<{ dataUrl: string; width: number; height: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) { setText(""); setPhoto(null); setError(null); setMode("text"); setBg("gold"); } }, [open]);

  const pick = async (file?: File) => {
    if (!file) return;
    try { setPhoto(await resizePhoto(file)); setMode("photo"); setError(null); } catch (e) { setError((e as Error).message || "Couldn't read that photo."); }
  };
  const share = async () => {
    setBusy(true); setError(null);
    try {
      const mediaId = mode === "photo" && photo ? (await socialApi.uploadPhoto(photo.dataUrl, photo.width, photo.height)).id : undefined;
      await socialApi.postStory({ mediaId, text: text.trim(), bg });
      void qc.invalidateQueries({ queryKey: ["social-stories"] });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const look = STORY_BG[bg];
  const ready = mode === "photo" ? !!photo : !!text.trim();

  return (
    <Sheet open={open} onClose={onClose} label="Add to your story" title="Add to your story" maxWidth={460}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div role="tablist" style={{ display: "flex", gap: 8 }}>
          <button role="tab" aria-selected={mode === "text"} onClick={() => setMode("text")} style={ghostBtn({ height: 34, flexGrow: 1, ...(mode === "text" ? { background: S.btn, color: S.btnText, borderColor: S.btn } : {}) })}><Type size={15} /> Text</button>
          <button role="tab" aria-selected={mode === "photo"} onClick={() => (photo ? setMode("photo") : fileRef.current?.click())} style={ghostBtn({ height: 34, flexGrow: 1, ...(mode === "photo" ? { background: S.btn, color: S.btnText, borderColor: S.btn } : {}) })}><ImageIcon size={15} /> Photo</button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => void pick(e.target.files?.[0])} />
        </div>

        {/* Live preview, the same shape as the viewer */}
        <div style={{ position: "relative", aspectRatio: "9 / 14", maxHeight: 380, borderRadius: 18, overflow: "hidden", background: mode === "photo" ? "#000" : look.css, border: `1px solid ${S.line}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {mode === "photo" && photo ? <img src={photo.dataUrl} alt="Story photo" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} /> : null}
          <label style={{ position: "relative", width: "84%", ...(mode === "photo" ? { alignSelf: "flex-end", marginBottom: 18 } : {}) }}>
            <span style={{ position: "absolute", left: -9999 }}>Story text</span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={200} rows={mode === "photo" ? 2 : 4} placeholder={mode === "photo" ? "Add a caption…" : "Type something…"}
              style={{ width: "100%", background: mode === "photo" ? "rgba(0,0,0,0.5)" : "transparent", border: 0, outline: "none", resize: "none", textAlign: "center", borderRadius: 12, padding: 8, color: mode === "photo" ? "#fff" : look.ink, fontFamily: "Sora, sans-serif", fontWeight: 700, fontSize: mode === "photo" ? 17 : 24, lineHeight: 1.3 }} />
          </label>
        </div>

        {mode === "text" ? (
          <div role="radiogroup" aria-label="Background" style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            {(Object.keys(STORY_BG) as StoryBg[]).map((k) => (
              <button key={k} role="radio" aria-checked={bg === k} aria-label={k} onClick={() => setBg(k)}
                style={{ width: 32, height: 32, borderRadius: "50%", background: STORY_BG[k].css, border: bg === k ? `2px solid ${S.ink}` : `1px solid ${S.line2}`, cursor: "pointer", padding: 0, boxShadow: bg === k ? `0 0 0 2px ${S.bg}` : "none" }} />
            ))}
          </div>
        ) : null}
        {mode === "photo" && photo ? <button onClick={() => fileRef.current?.click()} style={ghostBtn({ height: 34, alignSelf: "center", fontSize: 12.5 })}>Choose another photo</button> : null}

        {error ? <div role="alert" style={{ fontSize: 13, color: "#FF8A8A" }}>{error}</div> : null}
        <button onClick={() => void share()} disabled={!ready || busy} style={primaryBtn({ height: 44, opacity: ready ? 1 : 0.5 })}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : null} Share to your story
        </button>
        <div style={{ fontSize: 11.5, color: S.ink3, textAlign: "center" }}>Your followers can see it for 24 hours</div>
      </div>
    </Sheet>
  );
}
