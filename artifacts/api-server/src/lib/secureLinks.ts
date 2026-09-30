/**
 * Helpers for sign-in and account-linking flows that bounce through another site (Google, GitHub…):
 * signed short-lived state, encryption for stored tokens, and a whitelist of where we may send people back.
 */
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const secret = () => process.env.CONNECTOR_SECRET || process.env.SESSION_SECRET || "apex-dev-secret-change-in-production";

// ── Public URL of this API (OAuth providers redirect here) ─────────────────────
// Render sets RENDER_EXTERNAL_URL automatically; PUBLIC_API_URL overrides it.
export function publicApiUrl(): string {
  return (process.env.PUBLIC_API_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT ?? 8080}`).replace(/\/$/, "");
}

// ── Where people may be sent back to ──────────────────────────────────────────
const DEFAULT_APPS = ["https://apex-nexus-apex.vercel.app", "https://apex-nexus-mobile.vercel.app"];

export function isAllowedReturn(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol === "apex-mobile:") return true; // the phone app's own link scheme
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return true;
    const extra = (process.env.APP_URLS ?? "").split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean);
    return [...DEFAULT_APPS, ...extra].includes(u.origin);
  } catch {
    return false;
  }
}

export function defaultReturnUrl(): string {
  return (process.env.APP_URLS ?? "").split(",")[0]?.trim() || DEFAULT_APPS[0]!;
}

// ── Signed state (stateless, survives restarts and multiple servers) ──────────
export function signState(payload: Record<string, unknown>, ttlSeconds = 600): string {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + ttlSeconds * 1000, n: randomBytes(6).toString("hex") })).toString("base64url");
  const sig = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyState<T extends Record<string, unknown>>(state: string | undefined): T | null {
  if (!state) return null;
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString()) as T & { exp: number };
    return data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}

// ── Encryption for stored keys and tokens (AES-256-GCM) ───────────────────────
const encKey = () => createHash("sha256").update(`connectors:${secret()}`).digest();

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${data.toString("base64url")}`;
}

export function decrypt(stored: string): string | null {
  try {
    const [v, iv, tag, data] = stored.split(".");
    if (v !== "v1" || !iv || !tag || !data) return null;
    const decipher = createDecipheriv("aes-256-gcm", encKey(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
