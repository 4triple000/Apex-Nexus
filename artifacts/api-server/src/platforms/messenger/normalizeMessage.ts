import type { NormalizedMessage } from "@workspace/db";

/**
 * Facebook Messenger Webhook Message Entry shape.
 * https://developers.facebook.com/docs/messenger-platform/reference/webhook-events/messages
 */
export interface MessengerWebhookEntry {
  id: string;
  messaging?: Array<{
    sender: { id: string };
    recipient: { id: string };
    timestamp: number;
    message?: {
      mid: string;
      text?: string;
    };
  }>;
}

export function normalizeMessengerMessage(
  entry: MessengerWebhookEntry
): NormalizedMessage[] {
  const results: NormalizedMessage[] = [];

  for (const msg of entry.messaging ?? []) {
    if (!msg.message?.text) continue;

    results.push({
      platform: "messenger",
      conversation_id: `msng_${entry.id}_${msg.sender.id}`,
      external_user_id: msg.sender.id,
      message_text: msg.message.text,
      timestamp: msg.timestamp,
      raw: msg,
    });
  }

  return results;
}
