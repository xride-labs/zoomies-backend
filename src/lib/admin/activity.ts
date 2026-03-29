export interface DailyRange {
  start: Date;
  end: Date;
  label: string;
  dateKey: string;
}

function startOfUtcDay(input: Date): Date {
  return new Date(
    Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()),
  );
}

export function buildDailyRanges(
  days: number,
  now: Date = new Date(),
): DailyRange[] {
  const safeDays = Number.isFinite(days)
    ? Math.min(Math.max(Math.trunc(days), 1), 90)
    : 7;

  const todayStart = startOfUtcDay(now);
  const result: DailyRange[] = [];

  for (let offset = safeDays - 1; offset >= 0; offset -= 1) {
    const dayStart = new Date(todayStart);
    dayStart.setUTCDate(todayStart.getUTCDate() - offset);

    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayStart.getUTCDate() + 1);

    result.push({
      start: dayStart,
      end: dayEnd,
      label: dayStart.toLocaleDateString("en-US", { weekday: "short" }),
      dateKey: dayStart.toISOString().slice(0, 10),
    });
  }

  return result;
}

export interface WeeklyActivityPoint {
  label: string;
  date: string;
  usersRegistered: number;
  ridesCreated: number;
  clubsCreated: number;
  listingsCreated: number;
  reportsCreated: number;
}
