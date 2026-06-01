import Stripe from "stripe";
import { StripeSync } from "stripe-replit-sync";

let stripeSyncInstance: StripeSync | null = null;

export async function getUncachableStripeClient(): Promise<Stripe> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const identity = process.env.REPL_IDENTITY;
  const renewal = process.env.WEB_REPL_RENEWAL;

  if (hostname && identity) {
    // Use Replit connector to get Stripe credentials
    const tokenRes = await fetch(`https://${hostname}/v1/connection/ccfg_stripe_01K611P4YQR0SZM11XFRQJC44Y/token`, {
      headers: {
        Authorization: `Bearer ${identity}`,
        "X-Replit-Renewal": renewal ?? "",
      },
    });
    if (tokenRes.ok) {
      const tokenData = await tokenRes.json() as { credentials: { secret_key: string } };
      return new Stripe(tokenData.credentials.secret_key, { apiVersion: "2025-03-31.basil" });
    }
  }

  // Fallback to env var
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("No Stripe credentials found. Connect the Stripe integration or set STRIPE_SECRET_KEY.");
  }
  return new Stripe(key, { apiVersion: "2025-03-31.basil" });
}

export async function getStripeSync(): Promise<StripeSync> {
  if (!stripeSyncInstance) {
    const stripe = await getUncachableStripeClient();
    stripeSyncInstance = new StripeSync({ stripe, databaseUrl: process.env.DATABASE_URL! });
  }
  return stripeSyncInstance;
}
