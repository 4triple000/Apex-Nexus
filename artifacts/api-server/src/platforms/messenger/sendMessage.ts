import axios from "axios";
import { logger } from "../../lib/logger.js";
import { db, platformMessageLogTable } from "@workspace/db";

const GRAPH_API_BASE = "https://graph.facebook.com/v21.0";

export interface MessengerSendParams {
  recipientId: string;
  messageText: string;
  accessToken: string;
  pageId: string;
}

/**
 * Send a message via the Facebook Messenger Send API (Meta Graph API).
 * https://developers.facebook.com/docs/messenger-platform/send-messages
 */
export async function sendMessengerMessage(params: MessengerSendParams): Promise<string> {
  const { recipientId, messageText, accessToken, pageId } = params;

  const payload = {
    recipient: { id: recipientId },
    message: { text: messageText },
    messaging_type: "RESPONSE",
  };

  try {
    const response = await axios.post(
      `${GRAPH_API_BASE}/${pageId}/messages`,
      payload,
      {
        params: { access_token: accessToken },
        headers: { "Content-Type": "application/json" },
        timeout: 10000,
      }
    );

    const messageId: string = response.data?.message_id ?? "";

    await db.insert(platformMessageLogTable).values({
      platform: "messenger",
      direction: "outbound",
      externalConversationId: recipientId,
      externalMessageId: messageId,
      payload,
      statusCode: response.status,
    });

    logger.info({ messageId, recipientId }, "[messenger] Message sent");
    return messageId;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const statusCode = axios.isAxiosError(err) ? (err.response?.status ?? 0) : 0;

    await db.insert(platformMessageLogTable).values({
      platform: "messenger",
      direction: "outbound",
      externalConversationId: recipientId,
      payload,
      statusCode,
      error: errorMsg,
    });

    logger.error({ err, recipientId }, "[messenger] Failed to send message");
    throw new Error(`Messenger send failed: ${errorMsg}`);
  }
}
