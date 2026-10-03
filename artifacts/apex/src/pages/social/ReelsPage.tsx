/** /feed/reels — the full-screen reels player. ?start=<post id> plays that reel first. */
import { useMemo } from "react";
import { useLocation } from "wouter";
import { ReelsViewer } from "@/components/social/Reels";
import { S } from "@/components/social/ui";
import { useShown } from "@/components/social/useShown";
import { goBackInTab } from "@/lib/tabHistory";

export default function ReelsPage() {
  const [, nav] = useLocation();
  const start = useMemo(() => Number(new URLSearchParams(window.location.search).get("start")) || null, []);
  const close = () => goBackInTab(nav, "/feed");
  const { ref, shown } = useShown();
  return (
    <div ref={ref} style={{ flex: 1, background: S.bg }}>
      {shown ? <ReelsViewer startId={start} onClose={close} /> : null}
    </div>
  );
}
