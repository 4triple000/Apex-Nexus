/**
 * Google OAuth 2.0 Routes
 * Flow: /auth/google → Google consent → /auth/google/callback → session
 * Also accepts: POST /auth/google/token (for mobile / one-tap ID tokens)
 */
import { Router } from "express";
import { randomBytes } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import { db, usersTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { issueTokenPair } from "../shared/lib/jwt";
import { isOwnerEmail } from "../shared/lib/owner";

const router = Router();

const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID     ?? "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
const BASE_URL             = process.env.REPLIT_DEV_DOMAIN
  ? `https://${process.env.REPLIT_DEV_DOMAIN}`
  : "http://localhost:8080";
const REDIRECT_URI = `${BASE_URL}/api/auth/google/callback`;
const FRONTEND_URL = process.env.REPLIT_DEV_DOMAIN
  ? `https://${process.env.REPLIT_DEV_DOMAIN}`
  : "http://localhost:23095";

const oauthClient = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI);

// State store (in-memory; safe because short-lived)
const pendingStates = new Map<string, number>();

function randomUsername(): string {
  const adj  = ["Apex","Neon","Swift","Ultra","Nova","Cyber","Storm","Sharp"];
  const noun = ["Builder","Coder","Mind","Wave","Core","Pulse","Arc","Byte"];
  return `${adj[Math.floor(Math.random()*adj.length)]}${noun[Math.floor(Math.random()*noun.length)]}${Math.floor(Math.random()*9000)+1000}`;
}

function sanitize(u: typeof usersTable.$inferSelect) {
  const { passwordHash: _, sessionId: __, stripeCustomerId: ___, stripeSubscriptionId: ____, googleId: _____, ...safe } = u;
  return { ...safe, isOwner: isOwnerEmail(u.email) };
}

// ── GET /auth/google — redirect to Google consent page ────────────────────────
router.get("/auth/google", (req, res) => {
  if (!GOOGLE_CLIENT_ID) {
    res.status(503).json({ error: "Google OAuth not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET." });
    return;
  }
  const state = randomBytes(16).toString("hex");
  pendingStates.set(state, Date.now());

  const url = oauthClient.generateAuthUrl({
    access_type: "offline",
    scope: ["openid", "email", "profile"],
    state,
  });
  res.redirect(url);
});

// ── GET /auth/google/callback — Google redirects here after consent ───────────
router.get("/auth/google/callback", async (req, res): Promise<void> => {
  const { code, state, error } = req.query as Record<string, string>;

  if (error) {
    res.redirect(`${FRONTEND_URL}/?oauth_error=${encodeURIComponent(error)}`);
    return;
  }
  if (!code || !state || !pendingStates.has(state)) {
    res.redirect(`${FRONTEND_URL}/?oauth_error=invalid_state`);
    return;
  }
  pendingStates.delete(state);

  try {
    const { tokens: oauthTokens } = await oauthClient.getToken(code);
    oauthClient.setCredentials(oauthTokens);

    // Decode the ID token to get user info
    const ticket = await oauthClient.verifyIdToken({
      idToken: oauthTokens.id_token!,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload()!;
    const { sub: googleId, email, name, picture } = payload;

    // Upsert user: find by googleId or email
    const [existing] = await db.select().from(usersTable)
      .where(or(eq(usersTable.googleId, googleId!), eq(usersTable.email, email!)))
      .limit(1);

    let user: typeof usersTable.$inferSelect;

    if (existing) {
      // Update Google fields if not set
      const updates: Partial<typeof usersTable.$inferInsert> = {};
      if (!existing.googleId) updates.googleId = googleId;
      if (!existing.avatarUrl && picture) updates.avatarUrl = picture;
      if (Object.keys(updates).length > 0) {
        [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, existing.id)).returning();
      } else {
        user = existing;
      }
    } else {
      // Create new user
      const sessionId = randomBytes(32).toString("hex");
      [user] = await db.insert(usersTable).values({
        sessionId,
        email: email!,
        username: name ?? randomUsername(),
        googleId: googleId,
        avatarUrl: picture,
        avatarEmoji: "🔑",
      }).returning();
    }

    // Issue JWT tokens for the user
    const tier = (user.subscriptionTier === "pro" || user.subscriptionTier === "creator_pro" || user.subscriptionTier === "enterprise")
      ? user.subscriptionTier as "pro" | "creator_pro" | "enterprise"
      : "free";
    const jwtTokens = issueTokenPair(user.id, user.sessionId, tier);

    // Redirect to frontend with session + tokens (Base64-encoded for URL safety)
    const tokenParam = Buffer.from(JSON.stringify(jwtTokens)).toString("base64url");
    res.redirect(`${FRONTEND_URL}/?oauth_session=${user.sessionId}&oauth_success=1&oauth_tokens=${tokenParam}`);
  } catch (err) {
    console.error("[Google OAuth] callback error:", err);
    res.redirect(`${FRONTEND_URL}/?oauth_error=server_error`);
  }
});

// ── POST /auth/google/token — verify Google ID token (one-tap / mobile) ───────
router.post("/auth/google/token", async (req, res): Promise<void> => {
  const { idToken } = req.body ?? {};
  if (!idToken) { res.status(400).json({ error: "idToken required" }); return; }
  if (!GOOGLE_CLIENT_ID) { res.status(503).json({ error: "Google OAuth not configured" }); return; }

  try {
    const client = new OAuth2Client(GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload()!;
    const { sub: googleId, email, name, picture } = payload;

    const [existing] = await db.select().from(usersTable)
      .where(or(eq(usersTable.googleId, googleId!), eq(usersTable.email, email!)))
      .limit(1);

    let user: typeof usersTable.$inferSelect;
    if (existing) {
      const updates: Partial<typeof usersTable.$inferInsert> = {};
      if (!existing.googleId) updates.googleId = googleId;
      if (!existing.avatarUrl && picture) updates.avatarUrl = picture;
      if (Object.keys(updates).length > 0) {
        [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, existing.id)).returning();
      } else {
        user = existing;
      }
    } else {
      const sessionId = randomBytes(32).toString("hex");
      [user] = await db.insert(usersTable).values({
        sessionId, email: email!,
        username: name ?? randomUsername(),
        googleId: googleId, avatarUrl: picture, avatarEmoji: "🔑",
      }).returning();
    }

    const userTier = (user.subscriptionTier === "pro" || user.subscriptionTier === "creator_pro" || user.subscriptionTier === "enterprise")
      ? user.subscriptionTier as "pro" | "creator_pro" | "enterprise"
      : "free";
    const jwtPair = issueTokenPair(user.id, user.sessionId, userTier);
    res.json({ user: sanitize(user), sessionId: user.sessionId, ...jwtPair });
  } catch (err) {
    console.error("[Google OAuth] token verify error:", err);
    res.status(401).json({ error: "Invalid Google token" });
  }
});

// ── GET /auth/google/status — check if Google OAuth is configured ─────────────
router.get("/auth/google/status", (_req, res) => {
  res.json({
    configured: !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET),
    redirectUri: REDIRECT_URI,
  });
});

export default router;
