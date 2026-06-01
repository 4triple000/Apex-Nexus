import { useState, useEffect } from "react";
import { canvasApi, type FeedPost } from "../api";

const PINK = "#FD79A8";
const GREEN = "#55EFC4";
const USER_ID = Math.floor(Math.random() * 99999);

export default function FeedUI() {
  const [posts, setPosts]   = useState<FeedPost[]>([]);
  const [liked, setLiked]   = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    canvasApi.getFeed()
      .then(setPosts)
      .catch(() => {})
      .finally(() => setLoading(false));

    const poll = setInterval(() => {
      canvasApi.getFeed().then(setPosts).catch(() => {});
    }, 8000);
    return () => clearInterval(poll);
  }, []);

  const toggleLike = async (post: FeedPost, e: React.MouseEvent) => {
    e.stopPropagation();
    const isLiked = liked.has(post.id);

    // Optimistic update
    setLiked(prev => {
      const next = new Set(prev);
      isLiked ? next.delete(post.id) : next.add(post.id);
      return next;
    });
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, likes: p.likes + (isLiked ? -1 : 1) } : p));

    try {
      await canvasApi.toggleLike(post.id, USER_ID);
    } catch { /* revert optimistic */ }
  };

  const timeAgo = (ts: number) => {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60)  return `${s}s`;
    if (s < 3600) return `${Math.floor(s/60)}m`;
    return `${Math.floor(s/3600)}h`;
  };

  return (
    <div style={{ background: "#0A0A12", borderRadius: 12, overflow: "hidden" }}
         onClick={e => e.stopPropagation()}>
      <div style={{ padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: "#E8EAED" }}>📱 Feed</div>
        <div style={{ fontSize: 8, color: GREEN }}>● Live</div>
      </div>

      {loading ? (
        <div style={{ padding: 16, display: "flex", justifyContent: "center" }}>
          <div style={{ width: 16, height: 16, border: "2px solid rgba(162,155,254,0.2)", borderTopColor: "#A29BFE", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        </div>
      ) : (
        <div>
          {posts.slice(0, 3).map((post, idx) => {
            const isLiked = liked.has(post.id);
            const COLORS = ["#6C5CE7", "#FD79A8", "#00D2D3"];
            return (
              <div key={post.id} style={{ padding: "10px 10px", borderBottom: idx < 2 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                <div style={{ display: "flex", gap: 7, alignItems: "center", marginBottom: 6 }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", background: COLORS[idx % 3], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>
                    {post.avatar}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#E8EAED" }}>{post.user}</div>
                    <div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)" }}>{timeAgo(post.ts)} ago</div>
                  </div>
                </div>
                <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.7)", lineHeight: 1.5, marginBottom: 8 }}>{post.text}</div>
                <div style={{ display: "flex", gap: 12 }}>
                  <button onClick={e => toggleLike(post, e)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, padding: 0 }}>
                    <span style={{ fontSize: 13, transition: "transform 0.2s", transform: isLiked ? "scale(1.25)" : "scale(1)" }}>
                      {isLiked ? "❤️" : "🤍"}
                    </span>
                    <span style={{ fontSize: 9, fontWeight: 600, color: isLiked ? PINK : "rgba(255,255,255,0.3)", transition: "color 0.2s" }}>
                      {post.likes}
                    </span>
                  </button>
                  <button style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, padding: 0 }} onClick={e => e.stopPropagation()}>
                    <span style={{ fontSize: 12 }}>💬</span>
                    <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>Reply</span>
                  </button>
                  <button style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, padding: 0, marginLeft: "auto" }} onClick={e => e.stopPropagation()}>
                    <span style={{ fontSize: 11 }}>↗</span>
                    <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>Share</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
