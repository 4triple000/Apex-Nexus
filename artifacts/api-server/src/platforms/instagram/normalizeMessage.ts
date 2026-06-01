import type { NormalizedMessage } from "@workspace/db";

/**
 * Instagram Webhook Message Entry shape (simplified from Meta Graph API docs).
 * https://developers.facebook.com/docs/messenger-platform/instagram/features/send-message
 */
export interface InstagramWebhookEntry {
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

export function normalizeInstagramMessage(
  entry: InstagramWebhookEntry
): NormalizedMessage[] {
  const results: NormalizedMessage[] = [];

  for (const msg of entry.messaging ?? []) {
    if (!msg.message?.text) continue;

    results.push({
      platform: "instagram",
      conversation_id: `ig_${entry.id}_${msg.sender.id}`,
      external_user_id: msg.sender.id,
      message_text: msg.message.text,
      timestamp: msg.timestamp,
      raw: msg,
    });
  }

  return results;
}
