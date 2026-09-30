/**
 * Connectors — accounts a person links to Apex.
 *
 * Two kinds:
 *  - "key":   their own AI account (an API key). Chat replies on that model then run on their key:
 *             free for them in credits and free for the app owner.
 *  - "oauth": an app account (GitHub, Google, Spotify…). Apex can read from it when the chat asks
 *             ("what's on my calendar", "summarize my repos").
 *
 * An app only shows as available once the owner adds its OAuth client on the server
 * (e.g. GITHUB_CLIENT_ID + GITHUB_CLIENT_SECRET). Everything is stored encrypted.
 */
import Anthropic from "@anthropic-ai/sdk";
import { db, userConnectorsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { decrypt, encrypt, publicApiUrl } from "./secureLinks";
import type { AiProvider, UserKeys } from "./aiRouter";
import { logger } from "./logger";

// ── Catalog ───────────────────────────────────────────────────────────────────

export interface ConnectorInfo {
  id: string;
  name: string;
  kind: "key" | "oauth";
  category: "ai" | "voice" | "apps";
  description: string;
  /** What linking lets Apex do, in plain words */
  unlocks: string;
  color: string;
  /** Where to get a key (key connectors) */
  keyUrl?: string;
  keyHint?: string;
  /** Chat model this key powers */
  provider?: AiProvider;
}

export const CONNECTORS: ConnectorInfo[] = [
  // AI accounts: use your own subscription's API key
  { id: "openai", name: "OpenAI (ChatGPT)", kind: "key", category: "ai", provider: "openai", color: "#10A37F", keyUrl: "https://platform.openai.com/api-keys", keyHint: "sk-…", description: "Use your own OpenAI account for ChatGPT replies.", unlocks: "Unlimited ChatGPT in Apex, billed to your OpenAI account instead of your credits." },
  { id: "anthropic", name: "Anthropic (Claude)", kind: "key", category: "ai", provider: "claude", color: "#D97757", keyUrl: "https://console.anthropic.com/settings/keys", keyHint: "sk-ant-…", description: "Use your own Anthropic account for Claude replies.", unlocks: "Unlimited Claude in Apex, billed to your Anthropic account." },
  { id: "gemini", name: "Google Gemini", kind: "key", category: "ai", provider: "gemini", color: "#4285F4", keyUrl: "https://aistudio.google.com/app/apikey", keyHint: "AIza…", description: "Use your own Google AI Studio key for Gemini.", unlocks: "Unlimited Gemini replies (Google has a free tier)." },
  { id: "xai", name: "xAI (Grok)", kind: "key", category: "ai", provider: "grok", color: "#E5E7EB", keyUrl: "https://console.x.ai", keyHint: "xai-…", description: "Use your own xAI account for Grok.", unlocks: "Unlimited Grok replies in Apex." },
  { id: "perplexity", name: "Perplexity", kind: "key", category: "ai", provider: "perplexity", color: "#20B8CD", keyUrl: "https://www.perplexity.ai/settings/api", keyHint: "pplx-…", description: "Use your own Perplexity account for web-search answers.", unlocks: "Unlimited research answers with live web search." },
  { id: "deepseek", name: "DeepSeek", kind: "key", category: "ai", provider: "deepseek", color: "#4D6BFE", keyUrl: "https://platform.deepseek.com/api_keys", keyHint: "sk-…", description: "Use your own DeepSeek key.", unlocks: "Unlimited DeepSeek replies." },
  { id: "mistral", name: "Mistral", kind: "key", category: "ai", provider: "mistral", color: "#FA520F", keyUrl: "https://console.mistral.ai/api-keys", description: "Use your own Mistral key.", unlocks: "Unlimited Mistral replies." },
  { id: "groq", name: "Groq (Llama)", kind: "key", category: "ai", provider: "llama", color: "#F55036", keyUrl: "https://console.groq.com/keys", keyHint: "gsk_…", description: "Use your own Groq key for Llama.", unlocks: "Unlimited, very fast Llama replies (Groq has a free tier)." },
  { id: "elevenlabs", name: "ElevenLabs", kind: "key", category: "voice", color: "#FFFFFF", keyUrl: "https://elevenlabs.io/app/settings/api-keys", description: "Use your own ElevenLabs account for character voices.", unlocks: "Voice previews and game character voices on your ElevenLabs plan." },
  // Apps
  { id: "google", name: "Google Calendar & Drive", kind: "oauth", category: "apps", color: "#34A853", description: "Let Apex read your calendar and your Drive file list.", unlocks: "Ask \"what's on my calendar this week?\" or \"find my pitch deck\"." },
  { id: "github", name: "GitHub", kind: "oauth", category: "apps", color: "#E5E7EB", description: "Let Apex see your repositories.", unlocks: "Ask about your repos, recent work and what to build next." },
  { id: "spotify", name: "Spotify", kind: "oauth", category: "apps", color: "#1DB954", description: "Let Apex see what you've been listening to.", unlocks: "Get playlists, music picks and soundtrack ideas for your games." },
  { id: "notion", name: "Notion", kind: "oauth", category: "apps", color: "#FFFFFF", description: "Let Apex search the Notion pages you share with it.", unlocks: "Ask about your notes, docs and plans." },
  { id: "discord", name: "Discord", kind: "oauth", category: "apps", color: "#5865F2", description: "Link your Discord account.", unlocks: "Apex knows your servers, for community and game-launch ideas." },
];

export const connectorById = (id: string) => CONNECTORS.find((c) => c.id === id);

// ── OAuth apps ────────────────────────────────────────────────────────────────

interface OAuthApp {
  envPrefix: string;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
  extraAuthParams?: Record<string, string>;
  /** How the token endpoint wants the client credentials */
  tokenAuth: "body" | "basic" | "basic-json";
  profile: (token: string, tokenResponse: Record<string, unknown>) => Promise<string | null>;
}

const bearer = (token: string) => ({ Authorization: `Bearer ${token}`, Accept: "application/json", "User-Agent": "Apex" });

async function getJson(url: string, token: string, init?: RequestInit): Promise<any> {
  const res = await fetch(url, { ...init, headers: { ...bearer(token), ...(init?.headers ?? {}) } });
  if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => "")}`.slice(0, 200));
  return res.json();
}

const OAUTH: Record<string, OAuthApp> = {
  google: {
    envPrefix: "GOOGLE",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: ["openid", "email", "https://www.googleapis.com/auth/calendar.readonly", "https://www.googleapis.com/auth/drive.metadata.readonly"],
    extraAuthParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
    tokenAuth: "body",
    profile: async (t) => (await getJson("https://openidconnect.googleapis.com/v1/userinfo", t)).email ?? null,
  },
  github: {
    envPrefix: "GITHUB",
    authorizeUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    scopes: ["read:user", "repo"],
    tokenAuth: "body",
    profile: async (t) => (await getJson("https://api.github.com/user", t)).login ?? null,
  },
  spotify: {
    envPrefix: "SPOTIFY",
    authorizeUrl: "https://accounts.spotify.com/authorize",
    tokenUrl: "https://accounts.spotify.com/api/token",
    scopes: ["user-read-recently-played", "user-top-read"],
    tokenAuth: "basic",
    profile: async (t) => (await getJson("https://api.spotify.com/v1/me", t)).display_name ?? null,
  },
  notion: {
    envPrefix: "NOTION",
    authorizeUrl: "https://api.notion.com/v1/oauth/authorize",
    tokenUrl: "https://api.notion.com/v1/oauth/token",
    scopes: [],
    extraAuthParams: { owner: "user" },
    tokenAuth: "basic-json",
    profile: async (_t, r) => (r.workspace_name as string) ?? null,
  },
  discord: {
    envPrefix: "DISCORD",
    authorizeUrl: "https://discord.com/oauth2/authorize",
    tokenUrl: "https://discord.com/api/oauth2/token",
    scopes: ["identify", "guilds"],
    tokenAuth: "body",
    profile: async (t) => (await getJson("https://discord.com/api/users/@me", t)).username ?? null,
  },
};

const clientId = (app: OAuthApp) => process.env[`${app.envPrefix}_CLIENT_ID`] ?? "";
const clientSecret = (app: OAuthApp) => process.env[`${app.envPrefix}_CLIENT_SECRET`] ?? "";

export const oauthCallbackUrl = () => `${publicApiUrl()}/api/connectors/oauth/callback`;

/** Whether the owner has set up this app's OAuth client (key connectors are always available). */
export function isAvailable(id: string): boolean {
  const c = connectorById(id);
  if (!c) return false;
  if (c.kind === "key") return true;
  const app = OAUTH[id];
  return !!app && !!clientId(app) && !!clientSecret(app);
}

/** Env var names the owner sets to turn an app on. */
export function oauthEnvKeys(id: string): string[] {
  const app = OAUTH[id];
  return app ? [`${app.envPrefix}_CLIENT_ID`, `${app.envPrefix}_CLIENT_SECRET`] : [];
}

export function authorizeUrl(id: string, state: string): string | null {
  const app = OAUTH[id];
  if (!app || !isAvailable(id)) return null;
  const params = new URLSearchParams({
    client_id: clientId(app),
    redirect_uri: oauthCallbackUrl(),
    response_type: "code",
    state,
    ...(app.scopes.length ? { scope: app.scopes.join(" ") } : {}),
    ...(app.extraAuthParams ?? {}),
  });
  return `${app.authorizeUrl}?${params}`;
}

async function tokenRequest(app: OAuthApp, fields: Record<string, string>): Promise<Record<string, unknown>> {
  const basic = Buffer.from(`${clientId(app)}:${clientSecret(app)}`).toString("base64");
  let init: RequestInit;
  if (app.tokenAuth === "basic-json") {
    init = { method: "POST", headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(fields) };
  } else {
    const body = new URLSearchParams(app.tokenAuth === "body" ? { ...fields, client_id: clientId(app), client_secret: clientSecret(app) } : fields);
    init = {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", ...(app.tokenAuth === "basic" ? { Authorization: `Basic ${basic}` } : {}) },
      body,
    };
  }
  const res = await fetch(app.tokenUrl, init);
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || !data.access_token) throw new Error(String(data.error_description ?? data.error ?? `token request failed (${res.status})`));
  return data;
}

/** Finish linking: trade the code for tokens and save them. Returns the account label. */
export async function completeOAuth(id: string, userId: number, code: string): Promise<string | null> {
  const app = OAUTH[id];
  if (!app) throw new Error("Unknown app");
  const data = await tokenRequest(app, { grant_type: "authorization_code", code, redirect_uri: oauthCallbackUrl() });
  const access = String(data.access_token);
  const label = await app.profile(access, data).catch(() => null);
  const expiresIn = Number(data.expires_in ?? 0);
  await saveConnector(userId, id, "oauth", access, {
    refresh: typeof data.refresh_token === "string" ? data.refresh_token : undefined,
    expiresAt: expiresIn ? new Date(Date.now() + (expiresIn - 60) * 1000) : null,
    label,
  });
  return label;
}

/** A working access token for a linked app, refreshed if it expired. */
async function accessToken(row: typeof userConnectorsTable.$inferSelect): Promise<string | null> {
  const token = decrypt(row.secret);
  if (!token) return null;
  if (!row.expiresAt || row.expiresAt.getTime() > Date.now()) return token;
  const app = OAUTH[row.connectorId];
  const refresh = row.refreshSecret ? decrypt(row.refreshSecret) : null;
  if (!app || !refresh) return null;
  try {
    const data = await tokenRequest(app, { grant_type: "refresh_token", refresh_token: refresh });
    const expiresIn = Number(data.expires_in ?? 0);
    await db
      .update(userConnectorsTable)
      .set({
        secret: encrypt(String(data.access_token)),
        ...(typeof data.refresh_token === "string" ? { refreshSecret: encrypt(data.refresh_token) } : {}),
        expiresAt: expiresIn ? new Date(Date.now() + (expiresIn - 60) * 1000) : null,
        updatedAt: new Date(),
      })
      .where(eq(userConnectorsTable.id, row.id));
    return String(data.access_token);
  } catch (err) {
    logger.warn({ err, connector: row.connectorId }, "Connector token refresh failed");
    return null;
  }
}

// ── Storage ───────────────────────────────────────────────────────────────────

export async function saveConnector(
  userId: number,
  connectorId: string,
  kind: "key" | "oauth",
  secret: string,
  opts: { refresh?: string; expiresAt?: Date | null; label?: string | null } = {},
): Promise<void> {
  const values = {
    kind,
    secret: encrypt(secret),
    refreshSecret: opts.refresh ? encrypt(opts.refresh) : null,
    expiresAt: opts.expiresAt ?? null,
    accountLabel: opts.label ?? null,
    updatedAt: new Date(),
  };
  await db
    .insert(userConnectorsTable)
    .values({ userId, connectorId, ...values })
    .onConflictDoUpdate({ target: [userConnectorsTable.userId, userConnectorsTable.connectorId], set: values });
}

export async function removeConnector(userId: number, connectorId: string): Promise<void> {
  await db.delete(userConnectorsTable).where(and(eq(userConnectorsTable.userId, userId), eq(userConnectorsTable.connectorId, connectorId)));
}

export async function listLinked(userId: number) {
  return db
    .select({ connectorId: userConnectorsTable.connectorId, accountLabel: userConnectorsTable.accountLabel, createdAt: userConnectorsTable.createdAt })
    .from(userConnectorsTable)
    .where(eq(userConnectorsTable.userId, userId));
}

/** The person's own AI keys, by chat provider. */
export async function getUserKeys(userId: number): Promise<UserKeys> {
  const rows = await db.select().from(userConnectorsTable).where(and(eq(userConnectorsTable.userId, userId), eq(userConnectorsTable.kind, "key")));
  const keys: UserKeys = {};
  for (const row of rows) {
    const provider = connectorById(row.connectorId)?.provider;
    const key = decrypt(row.secret);
    if (provider && key) keys[provider] = key;
  }
  return keys;
}

/** The person's own key for a non-chat service (e.g. ElevenLabs). */
export async function getUserSecret(userId: number, connectorId: string): Promise<string | null> {
  const [row] = await db.select().from(userConnectorsTable).where(and(eq(userConnectorsTable.userId, userId), eq(userConnectorsTable.connectorId, connectorId))).limit(1);
  return row ? decrypt(row.secret) : null;
}

/** Last 4 characters, for showing which key is linked. */
export const maskKey = (key: string) => `…${key.slice(-4)}`;

// ── Checking a pasted key ─────────────────────────────────────────────────────

const MODELS_URL: Record<string, string> = {
  openai: "https://api.openai.com/v1/models",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai/models",
  xai: "https://api.x.ai/v1/models",
  deepseek: "https://api.deepseek.com/models",
  mistral: "https://api.mistral.ai/v1/models",
  groq: "https://api.groq.com/openai/v1/models",
};

/** Makes a free call with the key (listing models) to confirm it works. */
export async function checkKey(connectorId: string, key: string): Promise<{ ok: boolean; error?: string }> {
  try {
    if (connectorId === "anthropic") {
      await new Anthropic({ apiKey: key, maxRetries: 0 }).models.list({ limit: 1 });
      return { ok: true };
    }
    if (connectorId === "elevenlabs") {
      const res = await fetch("https://api.elevenlabs.io/v1/user", { headers: { "xi-api-key": key } });
      return res.ok ? { ok: true } : { ok: false, error: "ElevenLabs didn't accept that key." };
    }
    if (connectorId === "perplexity") {
      // Perplexity has no free "list models" call, so just check the shape
      return key.startsWith("pplx-") && key.length > 20 ? { ok: true } : { ok: false, error: "Perplexity keys start with pplx-." };
    }
    const url = MODELS_URL[connectorId];
    if (!url) return { ok: false, error: "Unknown connector." };
    const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    return res.ok ? { ok: true } : { ok: false, error: res.status === 401 || res.status === 403 ? "That key was rejected. Check you copied all of it." : `The provider answered ${res.status}. Try again in a moment.` };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return { ok: false, error: "That key was rejected. Check you copied all of it." };
    if (err instanceof Anthropic.APIError) return { ok: false, error: `Anthropic answered ${err.status ?? "an error"}. Try again in a moment.` };
    return { ok: false, error: "Couldn't reach the provider to check the key." };
  }
}

// ── Chat context from linked apps ─────────────────────────────────────────────

const TRIGGERS: Record<string, RegExp> = {
  google: /\b(calendar|schedule|meeting|event|appointment|busy|free time|agenda|drive|doc|docs|file|files|sheet|slides)\b/i,
  github: /\b(github|repo|repos|repository|repositories|commit|pull request|my code|my projects)\b/i,
  spotify: /\b(spotify|music|song|songs|playlist|listening|artist|artists|soundtrack|track)\b/i,
  notion: /\b(notion|notes|note|wiki|my docs|my pages)\b/i,
  discord: /\b(discord|server|servers|community|guild)\b/i,
};

type Fetcher = (token: string, message: string) => Promise<string>;

const FETCHERS: Record<string, Fetcher> = {
  google: async (t, message) => {
    const parts: string[] = [];
    if (/calendar|schedule|meeting|event|appointment|busy|free time|agenda/i.test(message)) {
      const now = new Date();
      const params = new URLSearchParams({ timeMin: now.toISOString(), timeMax: new Date(now.getTime() + 7 * 86_400_000).toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "15" });
      const cal = await getJson(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, t);
      const events = (cal.items ?? []).map((e: any) => `- ${e.start?.dateTime ?? e.start?.date}: ${e.summary ?? "(no title)"}${e.location ? ` @ ${e.location}` : ""}`);
      parts.push(`Google Calendar, next 7 days:\n${events.join("\n") || "- nothing scheduled"}`);
    }
    if (/drive|doc|docs|file|files|sheet|slides/i.test(message)) {
      const drive = await getJson("https://www.googleapis.com/drive/v3/files?pageSize=15&orderBy=modifiedTime desc&fields=files(name,mimeType,modifiedTime)", t);
      parts.push(`Google Drive, recently edited:\n${(drive.files ?? []).map((f: any) => `- ${f.name} (${String(f.mimeType).split(".").pop()}, ${String(f.modifiedTime).slice(0, 10)})`).join("\n")}`);
    }
    return parts.join("\n\n");
  },
  github: async (t) => {
    const repos = await getJson("https://api.github.com/user/repos?sort=updated&per_page=12", t);
    return `GitHub repositories, most recently updated:\n${repos.map((r: any) => `- ${r.full_name}${r.private ? " (private)" : ""}: ${r.description ?? "no description"} [${r.language ?? "?"}, updated ${String(r.updated_at).slice(0, 10)}]`).join("\n")}`;
  },
  spotify: async (t) => {
    const [recent, top] = await Promise.all([
      getJson("https://api.spotify.com/v1/me/player/recently-played?limit=10", t),
      getJson("https://api.spotify.com/v1/me/top/artists?limit=8&time_range=short_term", t),
    ]);
    const tracks = (recent.items ?? []).map((i: any) => `- ${i.track?.name} by ${i.track?.artists?.map((a: any) => a.name).join(", ")}`);
    const artists = (top.items ?? []).map((a: any) => a.name).join(", ");
    return `Spotify, recently played:\n${tracks.join("\n")}\nTop artists lately: ${artists}`;
  },
  notion: async (t) => {
    const data = await getJson("https://api.notion.com/v1/search", t, {
      method: "POST",
      headers: { "Notion-Version": "2022-06-28", "Content-Type": "application/json" },
      body: JSON.stringify({ page_size: 12, sort: { direction: "descending", timestamp: "last_edited_time" } }),
    });
    const titles = (data.results ?? []).map((p: any) => {
      const titleProp = Object.values(p.properties ?? {}).find((v: any) => v?.type === "title") as any;
      const title = titleProp?.title?.map((x: any) => x.plain_text).join("") || p.title?.map((x: any) => x.plain_text).join("") || "(untitled)";
      return `- ${title} (edited ${String(p.last_edited_time).slice(0, 10)})`;
    });
    return `Notion pages shared with Apex:\n${titles.join("\n")}`;
  },
  discord: async (t) => {
    const guilds = await getJson("https://discord.com/api/users/@me/guilds", t);
    return `Discord servers:\n${guilds.slice(0, 20).map((g: any) => `- ${g.name}`).join("\n")}`;
  },
};

/**
 * Data from the person's linked apps that matches what they asked, as a system-prompt addition.
 * Only apps whose keywords appear in the message are called, so most messages cost nothing extra.
 */
export async function appContextFor(userId: number, message: string): Promise<string> {
  const wanted = Object.keys(TRIGGERS).filter((id) => TRIGGERS[id]!.test(message));
  if (!wanted.length) return "";
  const rows = await db.select().from(userConnectorsTable).where(and(eq(userConnectorsTable.userId, userId), eq(userConnectorsTable.kind, "oauth")));
  const linked = rows.filter((r) => wanted.includes(r.connectorId));
  if (!linked.length) return "";
  const parts = await Promise.all(
    linked.map(async (row) => {
      try {
        const token = await accessToken(row);
        if (!token) return "";
        return await FETCHERS[row.connectorId]!(token, message);
      } catch (err) {
        logger.warn({ err, connector: row.connectorId }, "Connector context fetch failed");
        return "";
      }
    }),
  );
  const text = parts.filter(Boolean).join("\n\n").slice(0, 4000);
  return text ? `\n\nData from the user's linked accounts (use it when it helps answer; don't recite it unprompted):\n${text}` : "";
}
