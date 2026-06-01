import axios from "axios";
import { logger } from "../../lib/logger.js";
import { db, platformMessageLogTable } from "@workspace/db";

const GRAPH_API_BASE = "https://graph.facebook.com/v21.0";

export interface InstagramSendParams {
  recipientId: string;
  messageText: string;
  accessToken: string;
  pageId: string;
}

/**
 * Send a message via the Instagram Messaging API (Meta Graph API).
 * https://developers.facebook.com/docs/messenger-platform/instagram/features/send-message
 */
export async function sendInstagramMessage(params: InstagramSendParams): Promise<string> {
  const { recipientId, messageText, accessToken, pageId } = params;

  const payload = {
    recipient: { id: recipientId },
    message: { text: messageText },
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
      platform: "instagram",
      direction: "outbound",
      externalConversationId: recipientId,
      externalMessageId: messageId,
      payload,
      statusCode: response.status,
    });

    logger.info({ messageId, recipientId }, "[instagram] Message sent");
    return messageId;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const statusCode = axios.isAxiosError(err) ? (err.response?.status ?? 0) : 0;

    await db.insert(platformMessageLogTable).values({
      platform: "instagram",
      direction: "outbound",
      externalConversationId: recipientId,
      payload,
      statusCode,
      error: errorMsg,
    });

    logger.error({ err, recipientId }, "[instagram] Failed to send message");
    throw new Error(`Instagram send failed: ${errorMsg}`);
  }
}
