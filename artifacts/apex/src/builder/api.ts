/**
 * Apex Canvas API Helper
 * Centralized fetch wrapper for all canvas block data endpoints.
 */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API  = `${BASE}/api/canvas`;

export async function getData<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${API}${endpoint}`, {
    headers: { "Cache-Control": "no-cache" },
  });
  if (!res.ok) throw new Error(`GET ${endpoint} → ${res.status}`);
  return res.json() as Promise<T>;
}

export async function postData<T>(endpoint: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`POST ${endpoint} → ${res.status}`);
  return res.json() as Promise<T>;
}

// ── Typed shortcuts ────────────────────────────────────────────────────────────
export const canvasApi = {
  // Messages
  getMessages:    ()                           => getData<Message[]>("/messages"),
  sendMessage:    (text: string)               => postData<{ userMessage: Message }>("/messages", { text }),
  latestMessage:  ()                           => getData<Message | null>("/messages/latest"),

  // Products
  getProducts:    ()                           => getData<Product[]>("/products"),
  buyProduct:     (id: number, qty = 1)        => postData<{ order: Order; product: Product }>(`/products/${id}/buy`, { quantity: qty }),

  // Leaderboard
  getLeaderboard: ()                           => getData<LeaderEntry[]>("/leaderboard"),
  submitScore:    (name: string, score: number, avatar?: string) =>
                                                  postData<LeaderEntry>("/leaderboard", { name, score, avatar }),

  // Feed
  getFeed:        ()                           => getData<FeedPost[]>("/feed"),
  toggleLike:     (id: number, userId?: number) => postData<{ liked: boolean; likes: number }>(`/feed/${id}/like`, { userId }),
  createPost:     (user: string, text: string, avatar?: string) =>
                                                  postData<FeedPost>("/feed", { user, text, avatar }),

  // Stats
  getStats:       ()                           => getData<StatsResult>("/stats"),
};

// ── Types ──────────────────────────────────────────────────────────────────────
export interface Message  { id: number; text: string; sender: "user" | "ai"; ts: number; }
export interface Product  { id: number; name: string; price: number; emoji: string; color: string; stock: number; sales: number; }
export interface LeaderEntry { id: number; name: string; avatar: string; score: number; level: number; ts: number; }
export interface FeedPost { id: number; user: string; avatar: string; text: string; likes: number; likedBy: number[]; ts: number; }
export interface Order    { id: number; productId: number; quantity: number; total: number; ts: number; }
export interface StatsResult { revenue: Stat; orders: Stat; users: Stat; messages: Stat; }
export interface Stat { value: number; label: string; delta: string; icon: string; }
