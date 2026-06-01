/**
 * Meta Webhook Entry Point
 *
 * GET  /api/webhooks/meta — Challenge verification (used by Meta to verify the endpoint)
 * POST /api/webhooks/meta — Incoming events from Instagram and Messenger
 *
 * Meta sends all events to a single callback URL. We detect the platform by
 * inspecting the `object` field ("instagram" | "page") and route accordingly.
 */

import { Router, type IRouter } from "express";
import {
  handleInstagramWebhook,
  verifyInstagramWebhook,
} from "../platforms/instagram/webhookHandler.js";
import {
  handleMessengerWebhook,
  verifyMessengerWebhook,
} from "../platforms/messenger/webhookHandler.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

// ─── GET /api/webhooks/meta (Challenge Verification) ─────────────────────────

router.get("/webhooks/meta", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN ?? "apex_verify";

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    logger.info("[webhooks] Meta challenge verified");
    res.status(200).send(req.query["hub.challenge"]);
  } else {
    res.status(403).json({ error: "Forbidden" });
  }
});

// ─── POST /api/webhooks/meta (Event Receiver) ─────────────────────────────────

router.post("/webhooks/meta", async (req, res) => {
  const { object } = req.body as { object?: string };

  if (!object) {
    res.status(400).json({ error: "Missing object field" });
    return;
  }

  logger.info({ object }, "[webhooks] Meta event received");

  switch (object) {
    case "instagram":
      await handleInstagramWebhook(req, res);
      break;

    case "page":
      await handleMessengerWebhook(req, res);
      break;

    default:
      logger.warn({ object }, "[webhooks] Unknown Meta object type");
      res.status(400).json({ error: `Unknown object type: ${object}` });
  }
});

export default router;
