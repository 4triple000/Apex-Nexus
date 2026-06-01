/**
 * Core Message Router
 *
 * The single entry point for all inbound messages from any platform.
 *
 * Responsibilities:
 *  1. Accept a normalized message
 *  2. Resolve or create the DM contact + conversation records
 *  3. Persist the message to the database
 *  4. Invalidate relevant caches
 *  5. Trigger async AI suggestion generation
 */

import {
  db,
  dmContactsTable,
  dmConversationsTable,
  dmMessagesTable,
  type NormalizedMessage,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { cacheDel, CacheKeys } from "./cache.js";
import { enqueueAiSuggestionJob } from "./jobQueue.js";

class MessageRouter {
  /**
   * Process one normalized inbound message end-to-end.
   */
  async receive(msg: NormalizedMessage): Promise<void> {
    logger.info({ platform: msg.platform, externalUserId: msg.external_user_id }, "[router] Incoming message");

    // 1. Resolve or create contact
    const contact = await this.upsertContact(msg);

    // 2. Resolve or create conversation
    const conversation = await this.upsertConversation(msg, contact.id);

    // 3. Persist message
    const [saved] = await db
      .insert(dmMessagesTable)
      .values({
        conversationId: conversation.id,
        direction: "inbound",
        content: msg.message_text,
        platform: msg.platform,
        externalMessageId: `${msg.platform}_${msg.timestamp}_${msg.external_user_id}`,
        aiGenerated: false,
      })
      .returning();

    // 4. Update conversation last-message timestamp
    await db
      .update(dmConversationsTable)
      .set({
        lastMessageAt: new Date(msg.timestamp),
        unreadCount: conversation.unreadCount + 1,
        updatedAt: new Date(),
      })
      .where(eq(dmConversationsTable.id, conversation.id));

    // 5. Bust caches
    await cacheDel(CacheKeys.messages(conversation.id));
    await cacheDel(CacheKeys.suggestions(conversation.id));

    // 6. Enqueue AI suggestion job (non-blocking)
    await enqueueAiSuggestionJob({
      conversationId: conversation.id,
      platform: msg.platform,
      triggerMessageId: saved.id,
    });
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async upsertContact(msg: NormalizedMessage) {
    const existing = await db
      .select()
      .from(dmContactsTable)
      .where(
        and(
          eq(dmContactsTable.externalId, msg.external_user_id),
          eq(dmContactsTable.platform, msg.platform)
        )
      )
      .limit(1);

    if (existing.length) {
      await db
        .update(dmContactsTable)
        .set({ totalInteractions: existing[0].totalInteractions + 1, updatedAt: new Date() })
        .where(eq(dmContactsTable.id, existing[0].id));
      return existing[0];
    }

    const [created] = await db
      .insert(dmContactsTable)
      .values({
        username: msg.external_user_id,
        displayName: msg.external_user_id,
        platform: msg.platform,
        externalId: msg.external_user_id,
        totalInteractions: 1,
      })
      .returning();

    return created;
  }

  private async upsertConversation(msg: NormalizedMessage, contactId: number) {
    const existing = await db
      .select()
      .from(dmConversationsTable)
      .where(
        and(
          eq(dmConversationsTable.contactId, contactId),
          eq(dmConversationsTable.platform, msg.platform),
          eq(dmConversationsTable.externalThreadId, msg.conversation_id)
        )
      )
      .limit(1);

    if (existing.length) return existing[0];

    const [created] = await db
      .insert(dmConversationsTable)
      .values({
        contactId,
        platform: msg.platform,
        externalThreadId: msg.conversation_id,
        lastMessageAt: new Date(msg.timestamp),
      })
      .returning();

    return created;
  }
}

export const messageRouter = new MessageRouter();
