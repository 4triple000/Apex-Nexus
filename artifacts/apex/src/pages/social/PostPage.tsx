/** One post with its comments: Ask Apex, reply suggestions, replies and likes. */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { socialApi, type Post } from "@/lib/socialApi";
import { S, card } from "@/components/social/ui";
import { SocialPage } from "@/components/social/Page";
import { PostCard } from "@/components/social/PostCard";
import { CommentsPanel } from "@/components/social/Comments";

export default function PostPage() {
  const { id } = useParams<{ id: string }>();
  const postId = Number(id);
  const qc = useQueryClient();
  const [, nav] = useLocation();
  const key = ["social-post", postId];
  const { data: post, isLoading, error } = useQuery({ queryKey: key, enabled: postId > 0, queryFn: () => socialApi.get(postId) });
  const set = (p: Post) => qc.setQueryData(key, p);

  return (
    <SocialPage title={post ? `${post.author.username}'s post` : "Post"}>
      {isLoading ? <div style={{ fontSize: 13, color: S.ink3 }}>Loading…</div> : null}
      {error ? <div style={{ ...card, padding: 18, fontSize: 13.5, color: S.ink2 }}>{(error as Error).message}</div> : null}
      {post ? (
        <>
          <PostCard post={post} detail onChange={set} onRemove={() => nav("/feed")} onOpenComments={() => document.getElementById("comment-box")?.focus()} onTag={(t) => nav(`/feed?tag=${encodeURIComponent(t)}`)} />
          <div style={{ ...card, padding: 14 }}>
            <CommentsPanel post={post} onCountChange={(_, d) => set({ ...post, commentCount: Math.max(0, post.commentCount + d) })} />
          </div>
        </>
      ) : null}
    </SocialPage>
  );
}
