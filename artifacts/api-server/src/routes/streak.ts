/**
 * 7-day streak: a day counts when the signed-in user opens and uses the app.
 * The app sends its local date so the day rolls over at the user's midnight.
 * Rewards per 7-day cycle: day 3 = +10 messages today, day 7 = the Midnight avatar outfit (kept for good).
 */
import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, userStreaksTable, type UserStreak } from "@workspace/db";
import { requireUser } from "../shared/middleware/requireAuth";
import { grantBonusCredits } from "../lib/credits";
import type { ApexRequest } from "../shared/types";

const router: IRouter = Router();

export const BONUS_DAY = 3;
export const BONUS_MESSAGES = 10;
export const AVATAR_DAY = 7;

const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const dayNum = (d: string) => Math.round(Date.parse(`${d}T00:00:00Z`) / 86_400_000);

/** The client's date must be within a day of the server's UTC date (covers every time zone). */
function plausible(today: string) {
  const diff = dayNum(today) - dayNum(new Date().toISOString().slice(0, 10));
  return Number.isFinite(diff) && Math.abs(diff) <= 1;
}

function view(row: UserStreak | undefined, today: string, earned: "bonus" | "avatar" | null = null) {
  const last = row?.lastDay ? dayNum(row.lastDay) : null;
  const gap = last === null ? Infinity : dayNum(today) - last;
  // A missed day breaks the streak even before the next check-in
  const streak = row && gap <= 1 ? row.streak : 0;
  const cycleDay = streak ? ((streak - 1) % 7) + 1 : 0;
  return {
    streak,
    best: row?.best ?? 0,
    cycleDay,
    checkedInToday: gap === 0,
    rewards: {
      bonus: { day: BONUS_DAY, messages: BONUS_MESSAGES, earned: cycleDay >= BONUS_DAY },
      avatar: { day: AVATAR_DAY, earned: !!row?.avatarLook },
    },
    earned,
  };
}

router.get("/streak", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const today = Day.safeParse(req.query.today);
  if (!today.success || !plausible(today.data)) {
    res.status(400).json({ ok: false, error: "Send today's date as YYYY-MM-DD" });
    return;
  }
  const [row] = await db.select().from(userStreaksTable).where(eq(userStreaksTable.userId, req.userId!)).limit(1);
  res.json({ ok: true, data: view(row, today.data) });
});

router.post("/streak/checkin", requireUser, async (req: ApexRequest, res): Promise<void> => {
  const today = Day.safeParse(req.body?.today);
  if (!today.success || !plausible(today.data)) {
    res.status(400).json({ ok: false, error: "Send today's date as YYYY-MM-DD" });
    return;
  }
  const userId = req.userId!;
  const [row] = await db.select().from(userStreaksTable).where(eq(userStreaksTable.userId, userId)).limit(1);
  const gap = row?.lastDay ? dayNum(today.data) - dayNum(row.lastDay) : Infinity;

  // Already counted today, or a date earlier than the last check-in: nothing changes
  if (gap <= 0) {
    res.json({ ok: true, data: view(row, today.data) });
    return;
  }

  const streak = gap === 1 && row ? row.streak + 1 : 1;
  const cycleDay = ((streak - 1) % 7) + 1;
  let earned: "bonus" | "avatar" | null = null;
  if (cycleDay === BONUS_DAY) {
    await grantBonusCredits(userId, BONUS_MESSAGES);
    earned = "bonus";
  }
  const avatarLook = !!row?.avatarLook || cycleDay === AVATAR_DAY;
  if (cycleDay === AVATAR_DAY && !row?.avatarLook) earned = "avatar";

  const values = { streak, best: Math.max(row?.best ?? 0, streak), lastDay: today.data, avatarLook, updatedAt: new Date() };
  const [saved] = await db
    .insert(userStreaksTable)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: userStreaksTable.userId, set: values })
    .returning();
  res.json({ ok: true, data: view(saved, today.data, earned) });
});

export default router;
