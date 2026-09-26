/**
 * Shared OpenAI client for the API server.
 * Uses the Replit AI integration env vars when present, else a plain OpenAI key.
 */
import OpenAI from "openai";

const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error(
    "OpenAI is not configured. Set AI_INTEGRATIONS_OPENAI_API_KEY (Replit integration) or OPENAI_API_KEY.",
  );
}

export const openai = new OpenAI({
  apiKey,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});
