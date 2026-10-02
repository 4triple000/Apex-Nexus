/** "Create on Apex": every way to post, as a full screen (the + button opens it). */
import { useEffect, useState } from "react";
import { Lightbulb, Sparkles, Loader2 } from "lucide-react";
import { socialApi } from "@/lib/socialApi";
import { S, primaryBtn } from "@/components/social/ui";
import { SocialPage } from "@/components/social/Page";
import { TILES, type CreatePick } from "@/components/social/Create";
import { useCreateFlow } from "@/components/social/CreateFlow";
import { useShown } from "@/components/social/useShown";

export default function CreatePage() {
  const create = useCreateFlow({ afterPost: "feed" });
  const [busy, setBusy] = useState(false);
  const { ref, shown } = useShown();

  // /feed/create?mode=video opens that composer straight away (in the copy of the page that's on screen)
  useEffect(() => {
    if (!shown) return;
    const mode = new URLSearchParams(window.location.search).get("mode") as CreatePick | null;
    if (mode && TILES.some((t) => t.id === mode)) create.start(mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);

  const surprise = async () => {
    setBusy(true);
    try { const ideas = await socialApi.ideas(); create.start("text", { idea: ideas[Math.floor(Math.random() * ideas.length)] }); }
    catch { create.start("text"); }
    finally { setBusy(false); }
  };

  return (
    <SocialPage title=" ">
      <div ref={ref} style={{ marginTop: -8 }}>
        <h1 style={{ margin: 0, fontFamily: "Sora, sans-serif", fontSize: 22, fontWeight: 700 }}>Create on Apex</h1>
        <div style={{ fontSize: 13, color: S.ink2, marginTop: 4 }}>What do you want to make?</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
        {TILES.map((t) => (
          <button key={t.title} onClick={() => create.start(t.id)}
            style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10, padding: "14px 12px", minHeight: 92, borderRadius: 16, background: S.surf, border: `1px solid ${S.line}`, color: S.ink, textAlign: "left", cursor: "pointer", fontFamily: "Manrope, sans-serif" }}>
            <span style={{ width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.06)" }}><t.icon size={18} /></span>
            <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 13.5, fontWeight: 800 }}>{t.title}</span>
              <span style={{ fontSize: 10.5, color: S.ink3 }}>{t.sub}</span>
            </span>
          </button>
        ))}
      </div>
      <div style={{ marginTop: 22, padding: 16, borderRadius: 20, background: "linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0.04))", border: `1px solid ${S.line2}`, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <span style={{ width: 38, height: 38, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: S.goldSoft, flexShrink: 0 }}><Lightbulb size={20} color="#EED9A8" /></span>
          <div><div style={{ fontSize: 14, fontWeight: 800 }}>Not sure what to post?</div><div style={{ fontSize: 12, color: S.ink2, marginTop: 3 }}>Apex can help you create something.</div></div>
        </div>
        <button onClick={() => void surprise()} disabled={busy} style={primaryBtn({ height: 44, fontSize: 14 })}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : null} Surprise Me <Sparkles size={15} />
        </button>
      </div>
      {create.ui}
    </SocialPage>
  );
}
