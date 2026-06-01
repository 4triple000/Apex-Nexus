/**
 * User Service — handles registration, login, profiles, and settings.
 * Authentication is session-based (UUID stored client-side).
 * Future: integrate JWT or OAuth provider.
 */

import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger";
import type { User } from "@workspace/db";

const ADJECTIVES = ["swift", "bright", "bold", "keen", "calm", "sharp", "wild", "cool", "dark", "neon"];
const NOUNS = ["apex", "signal", "nexus", "vortex", "cipher", "pulse", "nova", "grid", "flux", "code"];
const EMOJIS = ["🎮", "🚀", "🤖", "⚡", "🎯", "🦊", "🐉", "🌙", "🔥", "💫", "🎨", "🦄", "👾", "🧠", "⭐"];

function randomUsername(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 9999);
  return `${adj}_${noun}_${num}`;
}

function randomEmoji(): string {
  return EMOJIS[Math.floor(Math.random() * EMOJIS.length)] ?? "🎮";
}

// ── Register (or resolve) a user by session ID ────────────────────────────────
export async function registerOrResolve(sessionId: string): Promise<User> {
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.sessionId, sessionId)).limit(1);
  if (existing) return existing;

  const [created] = await db.insert(usersTable).values({
    sessionId,
    username: randomUsername(),
    avatarEmoji: randomEmoji(),
  }).returning();

  logger.info({ userId: created?.id }, "New user registered");
  return created!;
}

// ── Get profile ───────────────────────────────────────────────────────────────
export async function getProfile(sessionId: string): Promise<User | null> {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.sessionId, sessionId)).limit(1);
  return user ?? null;
}

// ── Get profile by user ID ────────────────────────────────────────────────────
export async function getProfileById(userId: number): Promise<User | null> {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  return user ?? null;
}

// ── Update settings ───────────────────────────────────────────────────────────
export interface UserSettings {
  username?: string;
  avatarEmoji?: string;
  bio?: string;
}

export async function updateSettings(sessionId: string, settings: UserSettings): Promise<User | null> {
  const updatePayload: Partial<typeof usersTable.$inferInsert> = {};
  if (settings.username) updatePayload.username = settings.username;
  if (settings.avatarEmoji) updatePayload.avatarEmoji = settings.avatarEmoji;
  if (settings.bio !== undefined) updatePayload.bio = settings.bio;

  if (Object.keys(updatePayload).length === 0) return getProfile(sessionId);

  const [updated] = await db.update(usersTable).set(updatePayload).where(eq(usersTable.sessionId, sessionId)).returning();
  return updated ?? null;
}

// ── Sanitize user for public API response (no session ID) ─────────────────────
export function sanitizeUser(user: User): Omit<User, "sessionId" | "stripeCustomerId" | "stripeSubscriptionId"> {
  const { sessionId, stripeCustomerId, stripeSubscriptionId, ...safe } = user;
  return safe;
}
