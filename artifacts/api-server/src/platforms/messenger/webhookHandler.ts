import type { Request, Response } from "express";
import { normalizeMessengerMessage, type MessengerWebhookEntry } from "./normalizeMessage.js";
import { messageRouter } from "../../core/messageRouter.js";
import { logger } from "../../lib/logger.js";

interface MessengerWebhookBody {
  object: string;
  entry: MessengerWebhookEntry[];
}

/**
 * Handle incoming Facebook Messenger webhook events.
 * Called by the /webhooks/meta endpoint when object === "page".
 */
export async function handleMessengerWebhook(req: Request, res: Response): Promise<void> {
  const body = req.body as MessengerWebhookBody;

  res.status(200).json({ status: "ok" });

  for (const entry of body.entry ?? []) {
    const normalized = normalizeMessengerMessage(entry);

    for (const msg of normalized) {
      try {
        await messageRouter.receive(msg);
      } catch (err) {
        logger.error({ err, msg }, "[messenger] Failed to process message");
      }
    }
  }
}

/**
 * Verify the Messenger webhook subscription challenge from Meta.
 */
export function verifyMessengerWebhook(req: Request, res: Response): void {
  const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN ?? "apex_verify";
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    logger.info("[messenger] Webhook verified");
    res.status(200).send(challenge);
  } else {
    res.status(403).json({ error: "Forbidden" });
  }
}
