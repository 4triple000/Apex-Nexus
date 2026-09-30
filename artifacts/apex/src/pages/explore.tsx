import { useLocation } from "wouter";
import { TrendingUp, UserPlus, Zap, ArrowLeft } from "lucide-react";
import { FeedCard } from "@/components/social/FeedCard";
import { NotificationBell } from "@/components/social/NotificationBell";
import { useExplore, useFollow, useUnfollow, useMyProfile, useLike, useLikedIds } from "@/hooks/useSocial";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function ExplorePage() {
  const [, nav] = useLocation();
  const { data, isLoading } = useExplore();
  const { data: meData } = useMyProfile();
  const me = meData?.user;
  const follow = useFollow();
  const unfollow = useUnfollow();
  const like = useLike();

  const projects = data?.trendingProjects ?? [];
  const creators = data?.suggestedCreators ?? [];

  const { data: likedData } = useLikedIds(projects.map((p) => p.id));
  const likedSet = new Set(likedData?.likedIds ?? []);

  return (
    <div className="flex flex-col h-full bg-transparent overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <button onClick={() => window.history.length > 1 ? window.history.back() : nav('/')} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-white">Explore</h1>
            <p className="text-xs text-white/40">Discover creators & projects</p>
          </div>
        </div>
        <NotificationBell />
      </div>

      {/* Suggested creators */}
      <div className="px-4 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <UserPlus size={14} className="text-[#A29BFE]" />
          <h2 className="text-sm font-bold text-white">People to Follow</h2>
        </div>

        {isLoading && (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-28 h-32 rounded-2xl bg-white/5 animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && creators.length === 0 && (
          <p className="text-sm text-white/30 py-4 text-center">No suggestions yet — start building!</p>
        )}

        {creators.length > 0 && (
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
            {creators.map((creator) => {
              const isMe = me?.id === creator.id;
              return (
                <div
                  key={creator.id}
                  className="flex-shrink-0 w-28 bg-[rgba(30,26,62,0.62)] border border-white/5 rounded-2xl p-3 flex flex-col items-center gap-2"
                >
                  <button onClick={() => nav(`/profile/${creator.id}`)} className="text-3xl hover:scale-110 transition-transform">
                    {creator.avatarEmoji}
                  </button>
                  <div className="text-center">
                    <p className="text-xs font-bold text-white leading-tight truncate w-full">{creator.username}</p>
                    <p className="text-[10px] text-white/30 mt-0.5">{creator.followersCount} followers</p>
                  </div>
                  {!isMe && (
                    <Button
                      size="sm"
                      className="h-6 px-3 text-[10px] font-bold rounded-full w-full"
                      style={{ background: "#A29BFE", color: "#000" }}
                      onClick={() => follow.mutate({ targetUserId: creator.id })}
                    >
                      Follow
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Trending projects */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={14} className="text-[#A29BFE]" />
          <h2 className="text-sm font-bold text-white">Trending Projects</h2>
        </div>

        {isLoading && Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-white/5 animate-pulse mb-3" />
        ))}

        <div className="space-y-3">
          {projects.map((p) => (
            <FeedCard
              key={p.id}
              project={p}
              liked={likedSet.has(p.id)}
              onLike={(id) => like.mutate({ projectId: id })}
              onRun={(id) => nav(`/marketplace?run=${id}`)}
              onCreatorClick={(authorId) => nav(`/profile/${authorId}`)}
              compact
            />
          ))}
        </div>

        {!isLoading && projects.length === 0 && (
          <div className="text-center py-12">
            <div className="text-3xl mb-2">🚀</div>
            <p className="text-sm text-white/40">Publish something to get trending!</p>
            <button
              onClick={() => nav("/studio")}
              className="mt-3 px-4 py-2 rounded-full text-xs font-bold"
              style={{ background: "#A29BFE", color: "#000" }}
            >
              Open Studio
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
