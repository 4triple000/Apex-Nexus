/** Client for the Social API (/api/posts…). Every call carries the signed-in session. */
import { authHeaders } from "@/lib/authSession";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface Author { id: number; username: string; avatarEmoji: string | null; avatarUrl: string | null }

export interface Post {
  id: number;
  kind: "text" | "photo" | "poll" | "game" | "moment";
  body: string;
  createdAt: string;
  location: string | null;
  visibility: "public" | "followers" | "private";
  tags: string[];
  reactionCount: number;
  commentCount: number;
  reacted: boolean;
  mine: boolean;
  author: Author;
  media: { url: string; width: number | null; height: number | null } | null;
  poll: { options: string[]; counts: number[]; total: number; myVote: number | null } | null;
  game: { id: number; name: string; creatorName: string; playCount: number; likeCount: number; mode: string | null } | null;
  moment: { day: string; prompt: string } | null;
}

export interface Comment {
  id: number;
  body: string;
  createdAt: string;
  reactionCount: number;
  reacted: boolean;
  mine: boolean;
  canDelete: boolean;
  author: Author;
  replies?: Comment[];
}

export interface Moment { day: string; prompt: string; answers: number; answered: boolean; friends: Author[] }

export type Visibility = Post["visibility"];
export type ReportReason = "spam" | "harassment" | "hate" | "violence" | "nudity" | "self_harm" | "misinformation" | "other";

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, { ...init, headers: { "Content-Type": "application/json", ...authHeaders(), ...init?.headers } });
  const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: T; error?: string } | null;
  if (!res.ok || !json?.ok) throw new Error(json?.error ?? `Something went wrong (${res.status})`);
  return json.data as T;
}
const post = <T,>(path: string, body?: unknown) => call<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) });

/** Photos and other server paths are relative to the site. */
export const mediaSrc = (url: string) => `${BASE}${url}`;

export const socialApi = {
  feed: (tab: "foryou" | "following", cursor?: number | null, tag?: string) => {
    const q = new URLSearchParams({ tab });
    if (cursor) q.set("cursor", String(cursor));
    if (tag) q.set("tag", tag);
    return call<{ posts: Post[]; nextCursor: number | null }>(`/posts/feed?${q}`);
  },
  moment: () => call<Moment>("/posts/moment"),
  trending: () => call<{ tags: { tag: string; count: number }[] }>("/posts/trending").then((d) => d.tags),
  ideas: () => call<{ ideas: string[] }>("/posts/ideas").then((d) => d.ideas),
  create: (data: { kind: Post["kind"]; body: string; mediaId?: number; pollOptions?: string[]; gameId?: number; visibility: Visibility }) =>
    post<{ post: Post }>("/posts", data).then((d) => d.post),
  uploadPhoto: (dataUrl: string, width: number, height: number) => post<{ id: number; url: string }>("/posts/media", { dataUrl, width, height }),
  get: (id: number) => call<{ post: Post }>(`/posts/${id}`).then((d) => d.post),
  remove: (id: number) => call<{ deleted: boolean }>(`/posts/${id}`, { method: "DELETE" }),
  react: (id: number) => post<{ reacted: boolean; reactionCount: number }>(`/posts/${id}/react`),
  vote: (id: number, option: number) => post<{ poll: NonNullable<Post["poll"]> }>(`/posts/${id}/vote`, { option }).then((d) => d.poll),
  comments: (id: number) => call<{ comments: Comment[] }>(`/posts/${id}/comments`).then((d) => d.comments),
  comment: (id: number, body: string, parentId?: number) => post<{ comment: Comment }>(`/posts/${id}/comments`, { body, parentId }).then((d) => d.comment),
  reactComment: (id: number) => post<{ reacted: boolean; reactionCount: number }>(`/post-comments/${id}/react`),
  removeComment: (id: number) => call<{ deleted: boolean }>(`/post-comments/${id}`, { method: "DELETE" }),
  report: (targetType: "post" | "comment" | "user", targetId: number, reason: ReportReason) => post<{ reported: boolean }>("/social-reports", { targetType, targetId, reason }),
  block: (userId: number) => post<{ blocked: boolean }>("/blocks", { userId }),
};

/** Shrinks a photo on the device (longest side 1280px, JPEG) before upload. */
export async function resizePhoto(file: File, max = 1280): Promise<{ dataUrl: string; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  let quality = 0.82;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);
  while (dataUrl.length > 1_100_000 && quality > 0.4) {
    quality -= 0.12;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }
  if (dataUrl.length > 1_100_000) throw new Error("That photo is too large. Try a smaller one.");
  return { dataUrl, width, height };
}

export function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

export const compact = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}K` : String(n));
