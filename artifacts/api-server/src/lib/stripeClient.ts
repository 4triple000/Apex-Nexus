import Stripe from "stripe";
import { StripeSync } from "stripe-replit-sync";

// Pinned Stripe API version. The billing code reads fields in this version's shape
// (e.g. invoice.parent.subscription_details, subscription item billing periods).
const STRIPE_API_VERSION = "2025-03-31.basil" as Stripe.LatestApiVersion;

let stripeSyncInstance: StripeSync | null = null;

async function getStripeSecretKey(): Promise<string> {
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
      return tokenData.credentials.secret_key;
    }
  }

  // Fallback to env var
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("No Stripe credentials found. Connect the Stripe integration or set STRIPE_SECRET_KEY.");
  }
  return key;
}

export async function getUncachableStripeClient(): Promise<Stripe> {
  return new Stripe(await getStripeSecretKey(), { apiVersion: STRIPE_API_VERSION });
}

export async function getStripeSync(): Promise<StripeSync> {
  if (!stripeSyncInstance) {
    stripeSyncInstance = new StripeSync({
      stripeSecretKey: await getStripeSecretKey(),
      stripeApiVersion: STRIPE_API_VERSION,
      poolConfig: { connectionString: process.env.DATABASE_URL },
    });
  }
  return stripeSyncInstance;
}
