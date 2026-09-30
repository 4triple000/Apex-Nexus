/**
 * Full-screen game player. Opens straight into the game; Exit opens the pause menu
 * with Resume, Remix (opens a copy in the Engine), Like, Share and Quit.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Play, Repeat2, Heart, Share2, X } from "lucide-react";
import { ApexGameRuntime } from "@/components/game/ApexGameRuntime";
import { useEngine } from "@/engine/EngineContext";
import type { GameConfig } from "@/engine/types";

export function GamePlayer({
  config, title, creator, liked, onLike, onRemix, onQuit, shareUrl,
}: {
  config: GameConfig;
  title: string;
  creator?: string;
  liked?: boolean;
  onLike?: () => void;
  onRemix?: () => void;
  onQuit: () => void;
  shareUrl?: string;
}) {
  const { sendToEngine, stopGame, startGame, status } = useEngine();
  const [menu, setMenu] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    sendToEngine(config);
    return () => stopGame();
    // Start once per game
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (menu) resume(); else openMenu();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const openMenu = () => {
    if (status === "playing") stopGame();
    setMenu(true);
  };
  const resume = () => {
    setMenu(false);
    if (status === "paused") startGame();
  };
  const share = async () => {
    const url = shareUrl ?? window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setNote("Link copied");
    } catch {
      setNote(url);
    }
  };

  // Portal to <body>: page transitions use transforms, which would trap a fixed overlay inside the page
  return createPortal(
    <div className="mg-font" style={{ position: "fixed", inset: 0, zIndex: 200, background: "#05040C" }} role="dialog" aria-label={`Playing ${title}`}>
      <ApexGameRuntime visible onClose={openMenu} style={{ width: "100%", height: "100%", borderRadius: 0 }} />

      {menu && (
        <div style={{ position: "absolute", inset: 0, zIndex: 5, background: "rgba(5,4,12,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 12 }} onClick={resume}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "min(420px, 100%)", borderRadius: 30, padding: 16, display: "grid", gap: 12, background: "rgba(28,24,62,0.9)", border: "1.5px solid rgba(255,255,255,0.2)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", marginBottom: "env(safe-area-inset-bottom, 0px)" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
              <span className="mg-display" style={{ fontSize: 17, fontWeight: 700, color: "var(--mg-ink)" }}>Paused</span>
              <span style={{ fontSize: 12.5, color: "var(--mg-ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}{creator ? ` · by ${creator}` : ""}</span>
            </div>
            <button onClick={resume} autoFocus className="mg-press mg-focus" style={{ height: 46, borderRadius: 23, border: 0, background: "#fff", color: "#1C1640", fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer" }}>
              <Play size={16} fill="currentColor" /> Resume
            </button>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, justifyItems: "center" }}>
              <Action label="Remix" onClick={onRemix} icon={<Repeat2 size={20} strokeWidth={2.2} />} />
              <Action label={liked ? "Liked" : "Like"} on={liked} onClick={onLike} icon={<Heart size={20} strokeWidth={2.2} fill={liked ? "currentColor" : "none"} />} />
              <Action label="Share" onClick={share} icon={<Share2 size={20} strokeWidth={2.2} />} />
              <Action label="Quit" onClick={onQuit} icon={<X size={20} strokeWidth={2.2} />} />
            </div>
            {note && <p role="status" style={{ margin: 0, textAlign: "center", fontSize: 12.5, color: "var(--mg-ink-2)", wordBreak: "break-all" }}>{note}</p>}
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}

function Action({ label, icon, onClick, on }: { label: string; icon: React.ReactNode; onClick?: () => void; on?: boolean }) {
  return (
    <button onClick={onClick} disabled={!onClick} className="mg-bubble mg-focus" style={{ display: "grid", justifyItems: "center", gap: 5, background: "none", border: 0, cursor: onClick ? "pointer" : "default", opacity: onClick ? 1 : 0.4, padding: 0 }}>
      <span className={`mg-cc${on ? " on" : ""}`} style={{ width: 50, height: 50, color: on ? "#FF4FA3" : "#fff" }}>{icon}</span>
      <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--mg-ink-2)" }}>{label}</span>
    </button>
  );
}
