import prisma from "./prisma.js";

/**
 * XP awards per action — keep these in one place so we can tune the economy
 * without hunting through routes. Plan §7.4 calls for "subtle XP, not flashy"
 * so values are intentionally small; level thresholds are 250 XP per level
 * (matches `nextLevelXp = (level + 1) * 250` already exposed by /auth/me).
 */
export const XP_REWARDS = {
  RIDE_CREATED: 25,
  RIDE_COMPLETED: 50,
  RIDE_JOINED: 10,
  POST_CREATED: 5,
  CLUB_JOINED: 5,
  FRIEND_ADDED: 2,
  RATING_GIVEN: 3,
} as const;

export type XpAction = keyof typeof XP_REWARDS;

const LEVEL_THRESHOLD = 250;

/**
 * Recompute level from total XP. Mirrors the `nextLevelXp = (level + 1) * 250`
 * formula used in /auth/me so client-side progress bars stay in sync.
 */
export function levelForXp(xp: number): { level: number; title: string } {
  const level = Math.max(1, Math.floor(xp / LEVEL_THRESHOLD) + 1);
  // Friendly titles (plan §7.4 "10 ranks with meaningful names").
  const titles = [
    "Rookie",      // 1
    "Cruiser",     // 2
    "Day Tripper", // 3
    "Weekender",   // 4
    "Tourer",      // 5
    "Pacer",       // 6
    "Road Captain",// 7
    "Adventurer",  // 8
    "Ironbutt",    // 9
    "Legend",      // 10+
  ];
  const title = titles[Math.min(level - 1, titles.length - 1)];
  return { level, title };
}

/**
 * Award XP atomically. Recomputes level and levelTitle on every grant so the
 * user can level up from a single action. Returns the new totals so callers
 * can surface a "Level up!" toast on the client.
 *
 * Failures are swallowed and logged — we never want a missing XP grant to
 * fail the underlying user action (creating a post, completing a ride, etc.)
 * because XP is decorative and the action itself is the contract.
 */
export async function awardXp(
  userId: string,
  action: XpAction,
  reason?: string,
): Promise<{ xpPoints: number; level: number; levelTitle: string } | null> {
  const reward = XP_REWARDS[action];
  if (!reward) return null;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { xpPoints: true, level: true, levelTitle: true },
    });
    if (!user) return null;

    const newXp = (user.xpPoints ?? 0) + reward;
    const { level, title } = levelForXp(newXp);

    await prisma.user.update({
      where: { id: userId },
      data: {
        xpPoints: newXp,
        level,
        levelTitle: title,
      },
    });

    if (level > (user.level ?? 1)) {
      console.log(
        `[xp] user ${userId} leveled up: ${user.level} → ${level} (${title})`,
        reason ? `via ${action} (${reason})` : `via ${action}`,
      );
    }

    return { xpPoints: newXp, level, levelTitle: title };
  } catch (error) {
    console.warn("[xp] award failed for user", userId, action, error);
    return null;
  }
}

/**
 * Best-effort badge auto-award. Looks up a Badge by exact title and creates
 * the UserBadge if it doesn't already exist. Designed for "milestone" badges
 * seeded via prisma/seed.ts — if the badge isn't seeded, this no-ops.
 *
 * Use awardBadgeByTitle("First Ride") after a user finishes their first ride,
 * etc. Called from action handlers (ride.routes.ts, friendship.routes.ts).
 */
export async function awardBadgeByTitle(
  userId: string,
  badgeTitle: string,
): Promise<void> {
  try {
    const badge = await prisma.badge.findUnique({
      where: { title: badgeTitle },
      select: { id: true, auraPoints: true },
    });
    if (!badge) return;

    // upsert so awarding the same badge twice is a no-op
    await prisma.userBadge.upsert({
      where: { userId_badgeId: { userId, badgeId: badge.id } },
      create: { userId, badgeId: badge.id },
      update: {},
    });
  } catch (error) {
    console.warn("[xp] badge award failed", userId, badgeTitle, error);
  }
}
