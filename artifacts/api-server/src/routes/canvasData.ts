/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  APEX CANVAS DATA API                                                    ║
 * ║  Real data layer for live builder canvas components                      ║
 * ║  Messages · Products · Leaderboard · Feed · Orders · Auth · Projects     ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */
import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  emitMessageNew, emitAiReply, emitProductUpdated, emitOrderCreated,
  emitFeedPostNew, emitFeedLiked, emitLeaderboardUpdate, emitStatsUpdate,
} from "../modules/realtime/canvasRealtime";

const router = Router();

// ─── In-Memory Stores ────────────────────────────────────────────────────────
interface Message { id: number; text: string; sender: "user" | "ai"; ts: number; }
interface Product { id: number; name: string; price: number; emoji: string; color: string; stock: number; sales: number; }
interface LeaderboardEntry { id: number; name: string; avatar: string; score: number; level: number; ts: number; }
interface FeedPost { id: number; user: string; avatar: string; text: string; likes: number; likedBy: number[]; ts: number; }
interface Order { id: number; productId: number; quantity: number; total: number; ts: number; }

const messages: Message[] = [
  { id: 1, text: "Hey! I'm Apex AI. Ask me anything 🚀", sender: "ai", ts: Date.now() - 60000 },
];

const products: Product[] = [
  { id: 1, name: "Air Max Pro",     price: 129, emoji: "👟", color: "#6C5CE7", stock: 42, sales: 312 },
  { id: 2, name: "Street Hoodie",   price: 79,  emoji: "👕", color: "#FD79A8", stock: 28, sales: 205 },
  { id: 3, name: "Cap Classic",     price: 39,  emoji: "🧢", color: "#00D2D3", stock: 86, sales: 441 },
  { id: 4, name: "Cargo Pants",     price: 99,  emoji: "👖", color: "#55EFC4", stock: 15, sales: 178 },
  { id: 5, name: "Tech Backpack",   price: 149, emoji: "🎒", color: "#FFCC33", stock: 33, sales: 96  },
  { id: 6, name: "Wireless Buds",   price: 199, emoji: "🎧", color: "#A29BFE", stock: 7,  sales: 523 },
];

const leaderboard: LeaderboardEntry[] = [
  { id: 1, name: "Player_1",   avatar: "🧑", score: 2840, level: 12, ts: Date.now() - 300000 },
  { id: 2, name: "DragonX",    avatar: "🐉", score: 2610, level: 10, ts: Date.now() - 200000 },
  { id: 3, name: "NeonKnight", avatar: "⚡", score: 2420, level: 9,  ts: Date.now() - 100000 },
  { id: 4, name: "ShadowBot",  avatar: "🤖", score: 2100, level: 8,  ts: Date.now() - 50000  },
  { id: 5, name: "BlazeFox",   avatar: "🦊", score: 1890, level: 7,  ts: Date.now() - 10000  },
];

const feed: FeedPost[] = [
  { id: 1, user: "alex_dev",   avatar: "👨‍💻", text: "Just shipped v2 with Apex! The live canvas is insane 🔥", likes: 142, likedBy: [], ts: Date.now() - 120000 },
  { id: 2, user: "sara_codes", avatar: "👩‍🎨", text: "Built a full e-commerce site in 5 mins. Real data, real backend 🚀", likes: 89, likedBy: [], ts: Date.now() - 480000 },
  { id: 3, user: "mike_ux",    avatar: "🎨",   text: "The canvas renderer now shows REAL components. This is production-grade 💯", likes: 203, likedBy: [], ts: Date.now() - 900000 },
];

const orders: Order[] = [];
let nextMsgId    = messages.length + 1;
let nextOrderId  = 1;
let nextScoreId  = leaderboard.length + 1;

// ─── AI reply helper ─────────────────────────────────────────────────────────
async function getAiReply(userText: string): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system",    content: "You are Apex AI, a friendly and concise assistant built into the Apex app builder canvas. Keep replies under 2 sentences, be enthusiastic and helpful." },
        { role: "user",      content: userText },
      ],
      max_tokens: 80,
      temperature: 0.8,
    });
    return completion.choices[0]?.message?.content?.trim() ?? "Got it! Let me think about that... 🤔";
  } catch {
    const fallbacks = [
      "Interesting! Here's what I found for you 🔍",
      "On it! Processing your request now ⚡",
      "Great question! Let me break that down 🧠",
      "Absolutely! Here's what you need to know 📚",
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
}

// ─── Messages ─────────────────────────────────────────────────────────────────
// GET /api/canvas/messages
router.get("/messages", (_req, res) => {
  res.json(messages.slice(-50));
});

// POST /api/canvas/messages  { text: string }
router.post("/messages", async (req, res) => {
  const { text } = req.body as { text: string };
  if (!text?.trim()) return res.status(400).json({ error: "text required" });

  const userMsg: Message = { id: nextMsgId++, text: text.trim(), sender: "user", ts: Date.now() };
  messages.push(userMsg);

  // Fire AI reply async so we can return userMsg immediately
  emitMessageNew(userMsg);
  res.json({ userMessage: userMsg });

  const reply = await getAiReply(text.trim());
  const aiMsg: Message = { id: nextMsgId++, text: reply, sender: "ai", ts: Date.now() };
  messages.push(aiMsg);
  emitAiReply(aiMsg);
});

// GET /api/canvas/messages/latest — poll for the newest AI reply after a userMsg
router.get("/messages/latest", (_req, res) => {
  const last = messages[messages.length - 1];
  res.json(last ?? null);
});

// ─── Products ─────────────────────────────────────────────────────────────────
// GET /api/canvas/products
router.get("/products", (_req, res) => {
  res.json(products);
});

// POST /api/canvas/products/:id/buy  { quantity?: number }
router.post("/products/:id/buy", (req, res) => {
  const product = products.find(p => p.id === Number(req.params.id));
  if (!product) return res.status(404).json({ error: "Product not found" });
  const qty = Number(req.body.quantity ?? 1);
  if (product.stock < qty) return res.status(400).json({ error: "Out of stock" });
  product.stock -= qty;
  product.sales += qty;
  const order: Order = { id: nextOrderId++, productId: product.id, quantity: qty, total: product.price * qty, ts: Date.now() };
  orders.push(order);
  emitProductUpdated(product);
  emitOrderCreated(order);
  res.json({ order, product });
});

// ─── Leaderboard ──────────────────────────────────────────────────────────────
// GET /api/canvas/leaderboard
router.get("/leaderboard", (_req, res) => {
  const sorted = [...leaderboard].sort((a, b) => b.score - a.score).slice(0, 10);
  res.json(sorted);
});

// POST /api/canvas/leaderboard  { name: string, score: number, avatar?: string }
router.post("/leaderboard", (req, res) => {
  const { name, score, avatar } = req.body as { name: string; score: number; avatar?: string };
  if (!name || score == null) return res.status(400).json({ error: "name and score required" });
  const existing = leaderboard.find(e => e.name === name);
  if (existing) {
    if (score > existing.score) {
      existing.score = score;
      existing.level = Math.floor(score / 200) + 1;
      existing.ts = Date.now();
    }
    return res.json(existing);
  }
  const entry: LeaderboardEntry = { id: nextScoreId++, name, avatar: avatar ?? "🎮", score, level: Math.floor(score / 200) + 1, ts: Date.now() };
  leaderboard.push(entry);
  emitLeaderboardUpdate([...leaderboard].sort((a,b) => b.score - a.score).slice(0,10));
  res.json(entry);
});

// ─── Social Feed ──────────────────────────────────────────────────────────────
// GET /api/canvas/feed
router.get("/feed", (_req, res) => {
  const sorted = [...feed].sort((a, b) => b.ts - a.ts);
  res.json(sorted);
});

// POST /api/canvas/feed/:id/like  { userId?: number }
router.post("/feed/:id/like", (req, res) => {
  const post = feed.find(p => p.id === Number(req.params.id));
  if (!post) return res.status(404).json({ error: "Post not found" });
  const uid = Number(req.body.userId ?? Math.floor(Math.random() * 9999));
  if (post.likedBy.includes(uid)) {
    post.likes--;
    post.likedBy = post.likedBy.filter(id => id !== uid);
    return res.json({ liked: false, likes: post.likes });
  }
  post.likes++;
  post.likedBy.push(uid);
  emitFeedLiked(post.id, post.likes);
  res.json({ liked: true, likes: post.likes });
});

// POST /api/canvas/feed  { user, text, avatar? }
router.post("/feed", (req, res) => {
  const { user, text, avatar } = req.body as { user: string; text: string; avatar?: string };
  if (!user || !text) return res.status(400).json({ error: "user and text required" });
  const post: FeedPost = { id: feed.length + 1, user, avatar: avatar ?? "👤", text, likes: 0, likedBy: [], ts: Date.now() };
  feed.unshift(post);
  emitFeedPostNew(post);
  res.json(post);
});

// ─── Stats summary ────────────────────────────────────────────────────────────
// GET /api/canvas/stats — aggregated stats for dashboard
router.get("/stats", (_req, res) => {
  const totalRevenue   = orders.reduce((s, o) => s + o.total, 0);
  const totalOrders    = orders.length;
  const totalUsers     = leaderboard.length;
  const totalMessages  = messages.length;
  res.json({
    revenue:  { value: totalRevenue, label: "Revenue",  delta: "+18%", icon: "💰" },
    orders:   { value: totalOrders,  label: "Orders",   delta: "+24%", icon: "📦" },
    users:    { value: totalUsers,   label: "Players",  delta: "+9%",  icon: "👥" },
    messages: { value: totalMessages,label: "Messages", delta: "+31%", icon: "💬" },
  });
});

// ─── User Project Storage ─────────────────────────────────────────────────────
interface CanvasProject {
  id:        string;
  name:      string;
  prompt:    string;
  blockIds:  string[];
  emoji:     string;
  userId:    number;
  createdAt: number;
}

// In-memory project store keyed by userId
const userProjects = new Map<number, CanvasProject[]>();
let projectCounter = 100;

// Auth middleware helper — resolves X-Session-Id → user row
async function resolveUser(req: import("express").Request): Promise<typeof usersTable.$inferSelect | null> {
  const sessionId = req.headers["x-session-id"] as string | undefined;
  if (!sessionId) return null;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.sessionId, sessionId)).limit(1);
  return user ?? null;
}

// GET /api/canvas/my-projects — list user's saved apps
router.get("/my-projects", async (req, res): Promise<void> => {
  const user = await resolveUser(req);
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }
  const projects = userProjects.get(user.id) ?? [];
  res.json(projects);
});

// POST /api/canvas/my-projects — save a new app
router.post("/my-projects", async (req, res): Promise<void> => {
  const user = await resolveUser(req);
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }

  const { name, prompt, blockIds, emoji } = req.body;
  if (!name || !blockIds) { res.status(400).json({ error: "name and blockIds are required" }); return; }

  const project: CanvasProject = {
    id:        `proj_${++projectCounter}`,
    name,
    prompt:    prompt ?? "",
    blockIds:  Array.isArray(blockIds) ? blockIds : [],
    emoji:     emoji ?? "🏗️",
    userId:    user.id,
    createdAt: Date.now(),
  };

  const existing = userProjects.get(user.id) ?? [];
  userProjects.set(user.id, [...existing, project]);
  res.status(201).json(project);
});

// DELETE /api/canvas/my-projects/:id — remove a saved app
router.delete("/my-projects/:id", async (req, res): Promise<void> => {
  const user = await resolveUser(req);
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }

  const existing  = userProjects.get(user.id) ?? [];
  const filtered  = existing.filter(p => p.id !== req.params.id);
  userProjects.set(user.id, filtered);
  res.json({ ok: true });
});

export default router;
