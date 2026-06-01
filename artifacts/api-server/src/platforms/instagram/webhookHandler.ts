import type { Request, Response } from "express";
import { normalizeInstagramMessage, type InstagramWebhookEntry } from "./normalizeMessage.js";
import { messageRouter } from "../../core/messageRouter.js";
import { logger } from "../../lib/logger.js";

interface InstagramWebhookBody {
  object: string;
  entry: InstagramWebhookEntry[];
}

/**
 * Handle incoming Instagram webhook events from Meta.
 * Called by the /webhooks/meta endpoint when object === "instagram".
 */
export async function handleInstagramWebhook(req: Request, res: Response): Promise<void> {
  const body = req.body as InstagramWebhookBody;

  res.status(200).json({ status: "ok" });

  for (const entry of body.entry ?? []) {
    const normalized = normalizeInstagramMessage(entry);

    for (const msg of normalized) {
      try {
        await messageRouter.receive(msg);
      } catch (err) {
        logger.error({ err, msg }, "[instagram] Failed to process message");
      }
    }
  }
}

/**
 * Verify the Instagram webhook subscription challenge from Meta.
 */
export function verifyInstagramWebhook(req: Request, res: Response): void {
  const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN ?? "apex_verify";
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    logger.info("[instagram] Webhook verified");
    res.status(200).send(challenge);
  } else {
    res.status(403).json({ error: "Forbidden" });
  }
}
