/**
 * Sign in with Google.
 *
 *   GET  /auth/google?returnTo=<app url>  → Google's consent screen
 *   GET  /auth/google/callback            → back from Google; sends the browser to returnTo#google_code=…
 *   POST /auth/google/exchange {code}     → the app trades that one-time code for a session
 *   POST /auth/google/token {idToken}     → sign in with a Google ID token (one-tap / native)
 *   GET  /auth/google/status              → whether it's set up, and the redirect URI to register with Google
 *
 * Setup (owner): create an OAuth client (Web application) in Google Cloud Console, add the redirect URI
 * from /auth/google/status, and set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the server.
 */
import { Router } from "express";
import { randomBytes } from "node:crypto";
import { OAuth2Client, type TokenPayload } from "google-auth-library";
import { db, usersTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { issueTokenPair } from "../shared/lib/jwt";
import { isOwnerEmail } from "../shared/lib/owner";
import { authLimiter } from "../shared/middleware/rateLimiter";
import { success, badRequest, unauthorized } from "../shared/utils/response";
import { publicApiUrl, signState, verifyState, isAllowedReturn, defaultReturnUrl } from "../lib/secureLinks";
import { logger } from "../lib/logger";

const router = Router();

const clientId = () => process.env.GOOGLE_CLIENT_ID ?? "";
const clientSecret = () => process.env.GOOGLE_CLIENT_SECRET ?? "";
const redirectUri = () => `${publicApiUrl()}/api/auth/google/callback`;
const oauthClient = () => new OAuth2Client(clientId(), clientSecret(), redirectUri());

function randomUsername(): string {
  const adj  = ["Apex","Neon","Swift","Ultra","Nova","Cyber","Storm","Sharp"];
  const noun = ["Builder","Coder","Mind","Wave","Core","Pulse","Arc","Byte"];
  return `${adj[Math.floor(Math.random()*adj.length)]}${noun[Math.floor(Math.random()*noun.length)]}${Math.floor(Math.random()*9000)+1000}`;
}

function sanitize(u: typeof usersTable.$inferSelect) {
  const { passwordHash: _, sessionId: __, stripeCustomerId: ___, stripeSubscriptionId: ____, googleId: _____, ...safe } = u;
  return { ...safe, isOwner: isOwnerEmail(u.email) };
}

function tierOf(user: typeof usersTable.$inferSelect): "free" | "pro" | "creator_pro" | "enterprise" {
  const t = user.subscriptionTier;
  return t === "pro" || t === "creator_pro" || t === "enterprise" ? t : "free";
}

/** Find the account for this Google identity, link it to an existing email account, or create one. */
async function upsertGoogleUser(payload: TokenPayload): Promise<typeof usersTable.$inferSelect> {
  const { sub: googleId, email, name, picture, email_verified } = payload;
  if (!googleId || !email) throw new Error("Google didn't share an email address");

  const [existing] = await db.select().from(usersTable)
    .where(or(eq(usersTable.googleId, googleId), eq(usersTable.email, email)))
    .limit(1);

  if (existing) {
    // Only link to an email/password account when Google has verified the address
    if (existing.googleId !== googleId && !email_verified) throw new Error("Verify your Google email address first");
    const updates: Partial<typeof usersTable.$inferInsert> = {};
    if (!existing.googleId) updates.googleId = googleId;
    if (!existing.avatarUrl && picture) updates.avatarUrl = picture;
    if (!Object.keys(updates).length) return existing;
    const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, existing.id)).returning();
    return updated!;
  }

  const base = (name ?? "").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 24);
  let username = base.length >= 2 ? base : randomUsername();
  const [taken] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, username)).limit(1);
  if (taken) username = `${username.slice(0, 20)}${Math.floor(Math.random() * 9000) + 1000}`;

  const [created] = await db.insert(usersTable).values({
    sessionId: randomBytes(32).toString("hex"),
    email,
    username,
    googleId,
    avatarUrl: picture,
    avatarEmoji: "🙂",
  }).returning();
  return created!;
}

function sessionResponse(user: typeof usersTable.$inferSelect) {
  return { user: sanitize(user), sessionId: user.sessionId, ...issueTokenPair(user.id, user.sessionId, tierOf(user)) };
}

function withHash(url: string, params: Record<string, string>): string {
  const u = new URL(url);
  u.hash = new URLSearchParams(params).toString();
  return u.toString();
}

// ── Browser flow ──────────────────────────────────────────────────────────────

router.get("/auth/google", (req, res) => {
  const requested = typeof req.query.returnTo === "string" ? req.query.returnTo : "";
  const returnTo = requested && isAllowedReturn(requested) ? requested : `${defaultReturnUrl()}/login`;
  if (!clientId() || !clientSecret()) {
    res.redirect(withHash(returnTo, { google_error: "not_configured" }));
    return;
  }
  const url = oauthClient().generateAuthUrl({
    scope: ["openid", "email", "profile"],
    state: signState({ r: returnTo }),
    prompt: "select_account",
  });
  res.redirect(url);
});

router.get("/auth/google/callback", async (req, res): Promise<void> => {
  const { code, state, error } = req.query as Record<string, string | undefined>;
  const data = verifyState<{ r: string }>(state);
  if (!data || !isAllowedReturn(data.r)) {
    res.status(400).send("This sign-in link expired. Go back to Apex and tap Continue with Google again.");
    return;
  }
  if (error || !code) {
    res.redirect(withHash(data.r, { google_error: error === "access_denied" ? "cancelled" : "failed" }));
    return;
  }
  try {
    const client = oauthClient();
    const { tokens } = await client.getToken(code);
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token!, audience: clientId() });
    const user = await upsertGoogleUser(ticket.getPayload()!);
    // A one-time code (valid 2 minutes) in the URL fragment, which browsers never send to servers
    res.redirect(withHash(data.r, { google_code: signState({ u: user.id, k: "google-login" }, 120) }));
  } catch (err) {
    logger.error({ err }, "[Google sign-in] callback error");
    res.redirect(withHash(data.r, { google_error: "failed" }));
  }
});

const usedCodes = new Map<string, number>();

router.post("/auth/google/exchange", authLimiter, async (req, res): Promise<void> => {
  const code = typeof req.body?.code === "string" ? req.body.code : "";
  const data = verifyState<{ u: number; k: string }>(code);
  if (!data || data.k !== "google-login" || usedCodes.has(code)) {
    unauthorized(res, "That sign-in link expired. Try Continue with Google again.");
    return;
  }
  // Each code works once
  usedCodes.set(code, Date.now());
  for (const [c, at] of usedCodes) if (Date.now() - at > 5 * 60_000) usedCodes.delete(c);

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, data.u)).limit(1);
  if (!user) { unauthorized(res, "Account not found."); return; }
  success(res, sessionResponse(user));
});

// ── ID token flow (one-tap / native) ──────────────────────────────────────────

router.post("/auth/google/token", authLimiter, async (req, res): Promise<void> => {
  const { idToken } = req.body ?? {};
  if (!idToken) { badRequest(res, "idToken required"); return; }
  if (!clientId()) { res.status(503).json({ ok: false, error: "Google sign-in isn't set up yet." }); return; }
  try {
    const ticket = await new OAuth2Client(clientId()).verifyIdToken({ idToken, audience: clientId() });
    const user = await upsertGoogleUser(ticket.getPayload()!);
    success(res, sessionResponse(user));
  } catch (err) {
    logger.warn({ err }, "[Google sign-in] token verify error");
    unauthorized(res, "Couldn't sign in with that Google account.");
  }
});

router.get("/auth/google/status", (_req, res) => {
  res.json({ configured: !!(clientId() && clientSecret()), redirectUri: redirectUri() });
});

export default router;
