/**
 * Platform Registry
 *
 * To add a new platform:
 *  1. Create /src/platforms/<name>/
 *  2. Implement normalizeMessage.ts, webhookHandler.ts, sendMessage.ts
 *  3. Register the send function below
 *
 * Nothing else needs to change.
 */

import { sendInstagramMessage, type InstagramSendParams } from "./instagram/sendMessage.js";
import { sendMessengerMessage, type MessengerSendParams } from "./messenger/sendMessage.js";
import type { ConnectedAccount } from "@workspace/db";

export type PlatformSendParams = {
  recipientId: string;
  messageText: string;
  account: ConnectedAccount;
};

const PLATFORM_SENDERS: Record<
  string,
  (params: PlatformSendParams) => Promise<string>
> = {
  instagram: async ({ recipientId, messageText, account }) => {
    const meta = account.metadata as Record<string, string> | null;
    return sendInstagramMessage({
      recipientId,
      messageText,
      accessToken: account.accessToken,
      pageId: meta?.page_id ?? account.platformUserId,
    } satisfies InstagramSendParams);
  },

  messenger: async ({ recipientId, messageText, account }) => {
    const meta = account.metadata as Record<string, string> | null;
    return sendMessengerMessage({
      recipientId,
      messageText,
      accessToken: account.accessToken,
      pageId: meta?.page_id ?? account.platformUserId,
    } satisfies MessengerSendParams);
  },
};

/**
 * Unified send — routes to the correct platform handler automatically.
 */
export async function sendPlatformMessage(
  platform: string,
  params: PlatformSendParams
): Promise<string> {
  const sender = PLATFORM_SENDERS[platform];
  if (!sender) throw new Error(`Unsupported platform: ${platform}`);
  return sender(params);
}

export { sendInstagramMessage, sendMessengerMessage };
