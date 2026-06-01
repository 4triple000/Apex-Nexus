import { db, usageTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getTierLimit } from "./aiRouter";

function getNextResetDate(): Date {
  const now = new Date();
  const reset = new Date(now);
  reset.setDate(reset.getDate() + 1);
  reset.setHours(0, 0, 0, 0);
  return reset;
}

export async function getOrCreateUsage(sessionId: string) {
  const existing = await db.select().from(usageTable).where(eq(usageTable.sessionId, sessionId));

  if (existing.length > 0) {
    const usage = existing[0]!;
    const now = new Date();

    if (new Date(usage.resetAt) <= now) {
      const [updated] = await db
        .update(usageTable)
        .set({ requestsUsed: 0, resetAt: getNextResetDate(), updatedAt: now })
        .where(eq(usageTable.sessionId, sessionId))
        .returning();
      return updated!;
    }

    return usage;
  }

  const [created] = await db
    .insert(usageTable)
    .values({
      sessionId,
      requestsUsed: 0,
      tier: "free",
      resetAt: getNextResetDate(),
    })
    .returning();

  return created!;
}

export async function incrementUsage(sessionId: string) {
  const usage = await getOrCreateUsage(sessionId);
  const limit = getTierLimit(usage.tier);

  if (usage.requestsUsed >= limit) {
    return { exceeded: true, usage };
  }

  const [updated] = await db
    .update(usageTable)
    .set({ requestsUsed: usage.requestsUsed + 1, updatedAt: new Date() })
    .where(eq(usageTable.sessionId, sessionId))
    .returning();

  return { exceeded: false, usage: updated! };
}
