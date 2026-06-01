import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "./use-session";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
function api(path: string) { return `${BASE}/api${path}`; }

async function req<T>(url: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(url, { headers: { "Content-Type": "application/json", ...((opts?.headers) || {}) }, ...opts });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<T>;
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: number;
  sessionId: string;
  username: string;
  avatarEmoji: string;
  bio: string | null;
  followersCount: number;
  followingCount: number;
  createdAt: string;
}

export interface SocialProject {
  id: number;
  title: string;
  type: string;
  thumbnail: string;
  description: string | null;
  authorId: number | null;
  authorName: string;
  likes: number;
  plays: number;
  remixes: number;
  publishedAt: string;
}

export interface Notification {
  id: number;
  type: string;
  message: string;
  relatedUserId: number | null;
  relatedProjectId: number | null;
  read: boolean;
  createdAt: string;
}

// ── My Profile ─────────────────────────────────────────────────────────────

export function useMyProfile() {
  const sessionId = useSession();
  return useQuery({
    queryKey: ["social-me", sessionId],
    queryFn: () => req<{ user: UserProfile }>(api("/social/me"), { headers: { "x-session-id": sessionId } }),
    enabled: !!sessionId,
    staleTime: 60_000,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  const sessionId = useSession();
  return useMutation({
    mutationFn: (data: { username?: string; bio?: string; avatarEmoji?: string }) =>
      req<{ user: UserProfile }>(api("/social/me"), {
        method: "PUT",
        headers: { "x-session-id": sessionId },
        body: JSON.stringify({ ...data, sessionId }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["social-me"] }),
  });
}

// ── Public Profile ─────────────────────────────────────────────────────────

export function useProfile(userId: number | null) {
  const sessionId = useSession();
  return useQuery({
    queryKey: ["social-profile", userId, sessionId],
    queryFn: () => req<{ profile: UserProfile; projects: SocialProject[]; stats: Record<string, number>; isFollowing: boolean }>(
      api(`/social/profile/${userId}`),
      { headers: { "x-session-id": sessionId } }
    ),
    enabled: !!userId,
    staleTime: 30_000,
  });
}

// ── Follow / Unfollow ──────────────────────────────────────────────────────

export function useFollow() {
  const qc = useQueryClient();
  const sessionId = useSession();
  return useMutation({
    mutationFn: ({ targetUserId }: { targetUserId: number }) =>
      req<{ following: boolean }>(api("/social/follow"), {
        method: "POST",
        body: JSON.stringify({ sessionId, targetUserId }),
      }),
    onSuccess: (_, { targetUserId }) => {
      qc.invalidateQueries({ queryKey: ["social-profile", targetUserId] });
      qc.invalidateQueries({ queryKey: ["social-me"] });
    },
  });
}

export function useUnfollow() {
  const qc = useQueryClient();
  const sessionId = useSession();
  return useMutation({
    mutationFn: ({ targetUserId }: { targetUserId: number }) =>
      req<{ following: boolean }>(api("/social/unfollow"), {
        method: "POST",
        body: JSON.stringify({ sessionId, targetUserId }),
      }),
    onSuccess: (_, { targetUserId }) => {
      qc.invalidateQueries({ queryKey: ["social-profile", targetUserId] });
      qc.invalidateQueries({ queryKey: ["social-me"] });
    },
  });
}

// ── Like ───────────────────────────────────────────────────────────────────

export function useLike() {
  const qc = useQueryClient();
  const sessionId = useSession();
  return useMutation({
    mutationFn: ({ projectId }: { projectId: number }) =>
      req<{ liked: boolean }>(api("/social/like"), {
        method: "POST",
        body: JSON.stringify({ sessionId, projectId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social-feed"] });
      qc.invalidateQueries({ queryKey: ["social-explore"] });
      qc.invalidateQueries({ queryKey: ["social-liked-ids"] });
    },
  });
}

export function useLikedIds(projectIds: number[]) {
  const sessionId = useSession();
  return useQuery({
    queryKey: ["social-liked-ids", sessionId, projectIds],
    queryFn: () => req<{ likedIds: number[] }>(api("/social/likes/check"), {
      method: "POST",
      body: JSON.stringify({ sessionId, projectIds }),
    }),
    enabled: !!sessionId && projectIds.length > 0,
    staleTime: 30_000,
  });
}

// ── Feed ───────────────────────────────────────────────────────────────────

export function useFeed() {
  const sessionId = useSession();
  return useQuery({
    queryKey: ["social-feed", sessionId],
    queryFn: () => req<{ following: SocialProject[]; trending: SocialProject[]; recent: SocialProject[] }>(
      api("/social/feed"),
      { headers: { "x-session-id": sessionId } }
    ),
    enabled: !!sessionId,
    staleTime: 30_000,
  });
}

// ── Explore ────────────────────────────────────────────────────────────────

export function useExplore() {
  const sessionId = useSession();
  return useQuery({
    queryKey: ["social-explore", sessionId],
    queryFn: () => req<{ trendingProjects: SocialProject[]; suggestedCreators: UserProfile[] }>(
      api("/social/explore"),
      { headers: { "x-session-id": sessionId } }
    ),
    staleTime: 60_000,
  });
}

// ── Notifications ──────────────────────────────────────────────────────────

export function useNotifications() {
  const sessionId = useSession();
  return useQuery({
    queryKey: ["social-notifications", sessionId],
    queryFn: () => req<{ notifications: Notification[]; unreadCount: number }>(
      api("/social/notifications"),
      { headers: { "x-session-id": sessionId } }
    ),
    enabled: !!sessionId,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  const sessionId = useSession();
  return useMutation({
    mutationFn: () => req<{ ok: boolean }>(api("/social/notifications/read"), {
      method: "POST",
      body: JSON.stringify({ sessionId }),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["social-notifications"] }),
  });
}
