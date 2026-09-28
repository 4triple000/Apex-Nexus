/**
 * Shared OpenAI client for the API server.
 * Uses the Replit AI integration env vars when present, else a plain OpenAI key.
 *
 * The client is created on first use, so the server can start without a key;
 * AI calls then fail with a clear "not configured" error instead.
 */
import OpenAI from "openai";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OpenAI is not configured. Set AI_INTEGRATIONS_OPENAI_API_KEY (Replit integration) or OPENAI_API_KEY.",
      );
    }
    client = new OpenAI({
      apiKey,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  return client;
}

export function isOpenAIConfigured(): boolean {
  return !!(process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY);
}

export const openai = new Proxy({} as OpenAI, {
  get(_target, prop) {
    const value = Reflect.get(getClient(), prop);
    return typeof value === "function" ? value.bind(getClient()) : value;
  },
});
