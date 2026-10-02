/** Client for the Social API (/api/posts…). Every call carries the signed-in session. */
import { authHeaders } from "@/lib/authSession";
import { openCreditsSheet } from "@/hooks/useCredits";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface Author { id: number; username: string; avatarEmoji: string | null; avatarUrl: string | null }

export interface Post {
  id: number;
  kind: "text" | "photo" | "poll" | "game" | "moment" | "debate" | "ask" | "video" | "voice";
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
  debate: Debate | null;
  /** Apex's answer, on "ask" posts */
  answer: string | null;
  /** Set when the post is a challenge entry */
  challenge: { id: number; title: string; tag: string } | null;
  /** Set when posted in a circle */
  circle: { id: number; name: string; emoji: string } | null;
  /** Reels */
  video: { url: string; mime: string; durationMs: number | null; width: number | null; height: number | null; poster: string | null } | null;
  /** Voice notes */
  audio: { url: string; mime: string; durationMs: number | null } | null;
}

export interface Person { id: number; username: string; avatarEmoji: string | null; avatarUrl: string | null; followersCount?: number }
export interface Profile {
  user: Author & { bio: string };
  profile: { cover: string; tagline: string; interests: string };
  stats: { posts: number; followers: number; following: number };
  creations: { games: number; voice: number; reels: number; apex: number };
  achievements: { challenges: number; interactions: number; moments: number };
  mine: boolean;
  following: boolean;
}
export interface DebateSide { side: number; label: string; supporters: Author[]; arguments: { id: number; body: string; reactionCount: number; createdAt: string; author: Author }[] }

export type StoryBg = "night" | "gold" | "ember" | "ocean" | "rose" | "mono";
export interface Story { id: number; text: string; bg: StoryBg; createdAt: string; expiresAt: string; seen: boolean; media: { url: string } | null; viewCount?: number }
export interface StoryGroup { author: Author; mine: boolean; stories: Story[]; unseen: number; allSeen: boolean }

export interface Circle {
  id: number;
  name: string;
  description: string;
  emoji: string;
  privacy: "public" | "invite";
  memberCount: number;
  role: "owner" | "member" | null;
  member: boolean;
  /** Shown to members, for inviting people */
  inviteCode: string | null;
}

export interface Debate { sides: string[]; counts: number[]; total: number; mySide: number | null; summary: string | null; summaryAt: string | null }

export interface Challenge {
  id: number;
  title: string;
  description: string;
  tag: string;
  endsAt: string;
  ended: boolean;
  /** Apex's weekly challenge */
  official: boolean;
  mine: boolean;
  creator: Author | null;
  entries: number;
  joined: boolean;
  startsAt: string;
  totalDays: number;
  day: number;
  myEntries: number;
}

/** An Apex answer the person can review, then share. The token proves Apex wrote it. */
export interface ApexAnswer { question: string; answer: string; token: string }
export type AssistAction = "draft" | "improve" | "hashtags" | "poll" | "debate" | "reply";

export interface Comment {
  id: number;
  body: string;
  createdAt: string;
  reactionCount: number;
  reacted: boolean;
  mine: boolean;
  canDelete: boolean;
  author: Author;
  /** Debate side the writer picked (0 or 1) */
  side?: number | null;
  /** A shared Apex answer; aiPrompt is what was asked */
  ai?: boolean;
  aiPrompt?: string | null;
  replies?: Comment[];
}

export interface Moment { day: string; prompt: string; answers: number; answered: boolean; friends: Author[] }

export type Visibility = Post["visibility"];
export type ReportReason = "spam" | "harassment" | "hate" | "violence" | "nudity" | "self_harm" | "misinformation" | "other";

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, { ...init, headers: { "Content-Type": "application/json", ...authHeaders(), ...init?.headers } });
  const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: T; error?: string; code?: string } | null;
  if (!res.ok || !json?.ok) {
    // A 404 with no JSON means the server hasn't got this feature yet (the website was updated first)
    const message = json?.error ?? (res.status === 404 ? "This part of Social isn't on the server yet. It'll work after the next server update." : `Something went wrong (${res.status})`);
    if (json?.code === "OUT_OF_CREDITS") openCreditsSheet("out", message);
    throw new Error(message);
  }
  return json.data as T;
}
const post = <T,>(path: string, body?: unknown) => call<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) });

/** Photos and other server paths are relative to the site. */
export const mediaSrc = (url: string) => `${BASE}${url}`;

export const socialApi = {
  feed: (tab: "foryou" | "following" | "trending", cursor?: string | null, tag?: string, challenge?: number, circle?: number, momentToday?: boolean) => {
    const q = new URLSearchParams({ tab });
    if (momentToday) q.set("moment", "today");
    if (cursor) q.set("cursor", cursor);
    if (tag) q.set("tag", tag);
    if (challenge) q.set("challenge", String(challenge));
    if (circle) q.set("circle", String(circle));
    return call<{ posts: Post[]; nextCursor: string | null }>(`/posts/feed?${q}`);
  },
  moment: () => call<Moment>("/posts/moment"),
  trending: () => call<{ tags: { tag: string; count: number }[] }>("/posts/trending").then((d) => d.tags),
  ideas: () => call<{ ideas: string[] }>("/posts/ideas").then((d) => d.ideas),
  create: (data: { kind: Post["kind"]; body: string; mediaId?: number; pollOptions?: string[]; gameId?: number; blobId?: number; challengeId?: number; circleId?: number; momentAnswer?: boolean; answer?: string; answerToken?: string; visibility: Visibility }) =>
    post<{ post: Post }>("/posts", data).then((d) => d.post),
  uploadPhoto: (dataUrl: string, width: number, height: number) => post<{ id: number; url: string }>("/posts/media", { dataUrl, width, height }),
  get: (id: number) => call<{ post: Post }>(`/posts/${id}`).then((d) => d.post),
  remove: (id: number) => call<{ deleted: boolean }>(`/posts/${id}`, { method: "DELETE" }),
  react: (id: number) => post<{ reacted: boolean; reactionCount: number }>(`/posts/${id}/react`),
  vote: (id: number, option: number) => post<{ poll: NonNullable<Post["poll"]> }>(`/posts/${id}/vote`, { option }).then((d) => d.poll),
  pickSide: (id: number, side: number) => post<{ debate: Debate }>(`/posts/${id}/vote`, { option: side }).then((d) => d.debate),
  comments: (id: number) => call<{ comments: Comment[] }>(`/posts/${id}/comments`).then((d) => d.comments),
  comment: (id: number, body: string, parentId?: number) => post<{ comment: Comment }>(`/posts/${id}/comments`, { body, parentId }).then((d) => d.comment),
  shareAnswer: (id: number, a: ApexAnswer) => post<{ comment: Comment }>(`/posts/${id}/comments`, { body: a.answer, aiPrompt: a.question, aiToken: a.token }).then((d) => d.comment),
  reactComment: (id: number) => post<{ reacted: boolean; reactionCount: number }>(`/post-comments/${id}/react`),
  removeComment: (id: number) => call<{ deleted: boolean }>(`/post-comments/${id}`, { method: "DELETE" }),
  report: (targetType: "post" | "comment" | "user", targetId: number, reason: ReportReason) => post<{ reported: boolean }>("/social-reports", { targetType, targetId, reason }),
  block: (userId: number) => post<{ blocked: boolean }>("/blocks", { userId }),

  challenges: () => call<{ active: Challenge[]; ended: Challenge[] }>("/challenges"),
  challenge: (id: number) => call<{ challenge: Challenge; top: Post[] }>(`/challenges/${id}`),
  startChallenge: (data: { title: string; description: string; days: number }) => post<{ challenge: Challenge }>("/challenges", data).then((d) => d.challenge),
  removeChallenge: (id: number) => call<{ deleted: boolean }>(`/challenges/${id}`, { method: "DELETE" }),

  reels: (cursor?: string | null) => call<{ posts: Post[]; nextCursor: string | null }>(`/posts/reels${cursor ? `?cursor=${cursor}` : ""}`),
  debate: (id: number) => call<{ post: Post; sides: DebateSide[] }>(`/posts/${id}/debate`),

  person: (id: number | "me") => call<Profile>(`/people/${id}`),
  personPosts: (id: number | "me", tab: string, cursor?: string | null) => call<{ posts: Post[]; nextCursor: string | null }>(`/people/${id}/posts?tab=${tab}${cursor ? `&cursor=${cursor}` : ""}`),
  follow: (id: number) => post<{ following: boolean; followers: number }>(`/people/${id}/follow`),
  saveProfile: (data: { bio?: string; tagline?: string; interests?: string; cover?: string }) => call<{ saved: boolean }>("/people/me", { method: "PUT", body: JSON.stringify(data) }),
  search: (q: string) => call<{ people: Person[]; tags: { tag: string; count: number }[]; circles: { id: number; name: string; emoji: string; memberCount: number }[] }>(`/people/search?q=${encodeURIComponent(q)}`),
  followList: (id: number | "me", which: "followers" | "following") => call<{ people: Person[] }>(`/people/${id}/${which}`).then((d) => d.people),

  stories: () => call<{ groups: StoryGroup[] }>("/stories").then((d) => d.groups),
  postStory: (data: { mediaId?: number; text: string; bg: StoryBg }) => post<{ id: number }>("/stories", data),
  viewStory: (id: number) => post<{ seen: boolean }>(`/stories/${id}/view`),
  storyViewers: (id: number) => call<{ viewers: (Author & { seenAt: string })[] }>(`/stories/${id}/viewers`).then((d) => d.viewers),
  deleteStory: (id: number) => call<{ deleted: boolean }>(`/stories/${id}`, { method: "DELETE" }),

  circles: () => call<{ mine: Circle[]; discover: Circle[] }>("/circles"),
  circle: (id: number, code?: string) => call<{ circle: Circle; members: (Author & { role: string })[] }>(`/circles/${id}${code ? `?code=${encodeURIComponent(code)}` : ""}`),
  startCircle: (data: { name: string; description: string; emoji: string; privacy: "public" | "invite" }) => post<{ circle: Circle }>("/circles", data).then((d) => d.circle),
  joinCircle: (id: number, code?: string) => post<{ circle: Circle }>(`/circles/${id}/join`, { code }).then((d) => d.circle),
  joinByCode: (code: string) => post<{ circle: Circle }>("/circles/join-code", { code }).then((d) => d.circle),
  leaveCircle: (id: number) => call<{ left: boolean }>(`/circles/${id}/membership`, { method: "DELETE" }),
  deleteCircle: (id: number) => call<{ deleted: boolean }>(`/circles/${id}`, { method: "DELETE" }),

  // Apex's helpers: each uses credits like a chat message, and nothing is posted until the person chooses to
  assist: <A extends AssistAction>(action: A, text: string) =>
    post<A extends "hashtags" ? { tags: string[] } : A extends "poll" | "debate" ? { question: string; options: string[] } : { text: string }>("/social-ai/assist", { action, text }),
  ask: (question: string) => post<ApexAnswer>("/social-ai/ask", { question }),
  askAboutPost: (id: number, question: string) => post<ApexAnswer>(`/posts/${id}/ask-apex`, { question }),
  summary: (id: number) => post<{ summary: string; summaryAt: string; cached: boolean }>(`/posts/${id}/summary`),
};

/**
 * Uploads a reel or voice note as the raw file, reporting progress (0 to 1).
 * Returns the id to attach to the post.
 */
export function uploadMedia(file: Blob, meta: { kind: "video" | "audio"; durationMs?: number; width?: number; height?: number }, onProgress?: (p: number) => void): Promise<{ id: number; url: string }> {
  const q = new URLSearchParams({ kind: meta.kind });
  if (meta.durationMs) q.set("duration", String(Math.round(meta.durationMs)));
  if (meta.width) q.set("width", String(meta.width));
  if (meta.height) q.set("height", String(meta.height));
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE}/api/media/upload?${q}`);
    for (const [k, v] of Object.entries(authHeaders() as Record<string, string>)) xhr.setRequestHeader(k, v);
    xhr.setRequestHeader("Content-Type", (file.type || (meta.kind === "video" ? "video/mp4" : "audio/webm")).split(";")[0]!);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(e.loaded / e.total); };
    xhr.onload = () => {
      let json: { ok?: boolean; data?: { id: number; url: string }; error?: string } | null = null;
      try { json = JSON.parse(xhr.responseText); } catch { /* not JSON */ }
      if (xhr.status >= 200 && xhr.status < 300 && json?.ok && json.data) resolve(json.data);
      else reject(new Error(json?.error ?? (xhr.status === 413 ? "That file is too big." : xhr.status === 404 ? "Reels aren't on the server yet. They'll work after the next server update." : `Upload failed (${xhr.status})`)));
    };
    xhr.onerror = () => reject(new Error("Upload failed. Check your connection and try again."));
    xhr.send(file);
  });
}

/** "0:42" */
export const clock = (ms: number | null | undefined) => {
  const s = Math.max(0, Math.round((ms ?? 0) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
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

/** "3d left", "5h left", "Ended" */
export function endsIn(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Ended";
  const h = ms / 3_600_000;
  return h >= 24 ? `${Math.ceil(h / 24)}d left` : h >= 1 ? `${Math.floor(h)}h left` : `${Math.max(1, Math.floor(ms / 60_000))}m left`;
}
