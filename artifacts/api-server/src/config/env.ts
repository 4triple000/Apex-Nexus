/**
 * Centralized environment configuration.
 * All env vars are validated and typed here — never read process.env directly elsewhere.
 */

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

function optionalEnv(key: string, fallback = ""): string {
  return process.env[key] ?? fallback;
}

export const env = {
  // Server
  port: parseInt(optionalEnv("PORT", "8080")),
  nodeEnv: optionalEnv("NODE_ENV", "development"),
  isProduction: process.env.NODE_ENV === "production",

  // Database
  databaseUrl: requireEnv("DATABASE_URL"),

  // Session — signs login tokens, so a known default would let anyone forge them
  sessionSecret: process.env.NODE_ENV === "production"
    ? requireEnv("SESSION_SECRET")
    : optionalEnv("SESSION_SECRET", "apex-dev-secret-change-in-production"),

  // Stripe
  stripeWebhookSecret: optionalEnv("STRIPE_WEBHOOK_SECRET"),
  stripeSecretKey: optionalEnv("STRIPE_SECRET_KEY"),

  // Replit connector (for Stripe + AI via Replit integrations)
  replitConnectorsHostname: optionalEnv("REPLIT_CONNECTORS_HOSTNAME"),
  replIdentity: optionalEnv("REPL_IDENTITY"),
  webReplRenewal: optionalEnv("WEB_REPL_RENEWAL"),
  replitDomains: optionalEnv("REPLIT_DOMAINS"),

  // Rate limiting
  rateLimitWindowMs: parseInt(optionalEnv("RATE_LIMIT_WINDOW_MS", "60000")),
  rateLimitMaxRequests: parseInt(optionalEnv("RATE_LIMIT_MAX", "60")),
} as const;

export type Env = typeof env;
