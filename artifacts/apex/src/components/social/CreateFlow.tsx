/**
 * One place that opens every creation flow (composer, Ask Apex, story, start a challenge, new circle),
 * so any Social page can offer "create" without repeating the wiring.
 *
 *   const create = useCreateFlow();
 *   create.start("video");            // or "ask", "story", { mode: "challenge", challengeId }, ...
 *   return <>{...}{create.ui}</>;
 */
import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { socialApi, type Post } from "@/lib/socialApi";
import { Composer, type ComposeMode, type CreatePick } from "./Create";
import { AskSheet } from "./AskApex";
import { StartChallengeSheet } from "./Challenges";
import { StoryComposer } from "./Stories";
import { FindCirclesSheet } from "./Circles";

export interface StartOptions {
  idea?: string;
  challengeId?: number;
  circle?: { id: number; name: string; emoji: string };
  /** Counts as an answer to today's Apex Moment */
  moment?: boolean;
}

export function useCreateFlow(opts: { onPosted?: (p: Post) => void; afterPost?: "stay" | "feed" } = {}) {
  const qc = useQueryClient();
  const [, nav] = useLocation();
  const [compose, setCompose] = useState<({ mode: ComposeMode } & StartOptions) | null>(null);
  const [ask, setAsk] = useState(false);
  const [story, setStory] = useState(false);
  const [startChallenge, setStartChallenge] = useState(false);
  const [circles, setCircles] = useState(false);
  const moment = useQuery({ queryKey: ["social-moment"], queryFn: socialApi.moment, staleTime: 60_000 });

  const posted = (p: Post) => {
    void qc.invalidateQueries({ queryKey: ["social-feed"] });
    void qc.invalidateQueries({ queryKey: ["social-trending"] });
    void qc.invalidateQueries({ queryKey: ["social-person"] });
    opts.onPosted?.(p);
    if (opts.afterPost === "feed") nav("/feed");
  };

  const start = (pick: CreatePick | "story", o: StartOptions = {}) => {
    if (pick === "ask") return setAsk(true);
    if (pick === "story") return setStory(true);
    setCompose({ mode: o.moment && pick === "text" ? "moment" : pick, ...o });
  };

  const ui: ReactNode = (
    <>
      <Composer open={!!compose} mode={compose?.mode ?? "text"} idea={compose?.idea} challengeId={compose?.challengeId} circle={compose?.circle}
        momentAnswer={!!compose?.moment && compose.mode !== "moment"} prompt={moment.data?.prompt}
        onClose={() => setCompose(null)} onPosted={posted}
        onStartChallenge={() => { setCompose(null); setStartChallenge(true); }}
        onNewCircle={() => { setCompose(null); setCircles(true); }} />
      <AskSheet open={ask} onClose={() => setAsk(false)} onPosted={posted} />
      <StoryComposer open={story} onClose={() => setStory(false)} />
      <StartChallengeSheet open={startChallenge} onClose={() => setStartChallenge(false)}
        onStarted={(c) => { setStartChallenge(false); setCompose({ mode: "challenge", challengeId: c.id }); }} />
      <FindCirclesSheet open={circles} onClose={() => setCircles(false)} onOpen={(id) => { setCircles(false); nav(`/feed?circle=${id}`); }} />
    </>
  );
  return { start, ui, startChallenge: () => setStartChallenge(true) };
}
