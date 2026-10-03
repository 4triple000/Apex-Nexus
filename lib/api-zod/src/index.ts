/**
 * Request/response schemas shared by the API server and the web client.
 */
import { z } from "zod";

export const AiProvider = z.enum(["openai", "claude", "perplexity", "gemini", "grok", "deepseek", "mistral", "llama", "free"]);
export type AiProvider = z.infer<typeof AiProvider>;

// ── Health ────────────────────────────────────────────────────────────────────
export const HealthCheckResponse = z.object({ status: z.literal("ok") });
export type HealthCheckResponse = z.infer<typeof HealthCheckResponse>;

// ── Chat ──────────────────────────────────────────────────────────────────────
export const SendChatBody = z.object({
  message: z.string().min(1),
  mode: z.enum(["chat", "battle", "hive", "agent"]).default("chat"),
  sessionId: z.string().optional(),
  preferredProvider: AiProvider.nullish(),
  /** Continue a saved conversation (chat mode). Omit to start a new one. */
  conversationId: z.number().int().positive().nullish(),
  /** What the person typed, without the app's added instructions (saved to history and used for its title) */
  rawMessage: z.string().max(20000).nullish(),
});
export type SendChatBody = z.input<typeof SendChatBody>;

export const ChatMessage = z.object({
  provider: z.string(),
  content: z.string(),
  responseTime: z.number(),
  error: z.string().optional(),
});
export type ChatMessage = z.infer<typeof ChatMessage>;

/** Today's AI credits (-1 = unlimited) */
export const CreditBalance = z.object({
  tier: z.string(),
  used: z.number(),
  limit: z.number(),
  bonus: z.number(),
  remaining: z.number(),
  unlimited: z.boolean(),
  resetsAt: z.string(),
  costs: z.record(z.number()),
});
export type CreditBalance = z.infer<typeof CreditBalance>;

export const SendChatResponse = z.object({
  mode: z.enum(["chat", "battle", "hive"]),
  messages: z.array(ChatMessage),
  routedTo: z.string(),
  usageRemaining: z.number(),
  credits: CreditBalance.optional(),
  combinedAnswer: z.string().optional(),
  personalizationActive: z.boolean().optional(),
  preferredTone: z.string().optional(),
});
export type SendChatResponse = z.infer<typeof SendChatResponse>;

export const AnalyzeScreenshotBody = z
  .object({
    content: z.string().optional(),
    context: z.string().optional(),
    imageBase64: z.string().optional(),
  })
  .refine((b) => !!b.content || !!b.imageBase64, {
    message: "Provide either content text or an image.",
  });
export type AnalyzeScreenshotBody = z.infer<typeof AnalyzeScreenshotBody>;

export const AnalyzeScreenshotResponse = z.object({
  analysis: z.string(),
  suggestions: z.array(z.string()),
});
export type AnalyzeScreenshotResponse = z.infer<typeof AnalyzeScreenshotResponse>;

// ── Usage ─────────────────────────────────────────────────────────────────────
export const GetUsageQueryParams = z.object({ sessionId: z.string().optional() });
export type GetUsageQueryParams = z.infer<typeof GetUsageQueryParams>;

export const UsageResponse = z.object({
  requestsUsed: z.number(),
  requestsLimit: z.number(),
  tier: z.string(),
  resetAt: z.string(),
});
export type UsageResponse = z.infer<typeof UsageResponse>;

// ── Votes ─────────────────────────────────────────────────────────────────────
export const CastVoteBody = z.object({
  provider: AiProvider,
  sessionId: z.string().optional(),
  prompt: z.string().optional(),
});
export type CastVoteBody = z.infer<typeof CastVoteBody>;

export const VoteStatsResponse = z.object({
  total: z.number(),
  providers: z.array(z.object({ provider: z.string(), votes: z.number(), percentage: z.number() })),
});
export type VoteStatsResponse = z.infer<typeof VoteStatsResponse>;

// ── Storage ───────────────────────────────────────────────────────────────────
export const RequestUploadUrlBody = z.object({
  name: z.string().min(1),
  size: z.number().int().nonnegative(),
  contentType: z.string().min(1),
});
export type RequestUploadUrlBody = z.infer<typeof RequestUploadUrlBody>;

export const RequestUploadUrlResponse = z.object({
  uploadURL: z.string(),
  objectKey: z.string(),
  expiresAt: z.string(),
  metadata: RequestUploadUrlBody,
});
export type RequestUploadUrlResponse = z.infer<typeof RequestUploadUrlResponse>;
