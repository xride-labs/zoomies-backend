import { buildDailyRanges } from "./activity.js";

describe("buildDailyRanges", () => {
  it("returns seven ranges by default", () => {
    const ranges = buildDailyRanges(7, new Date("2026-03-20T10:00:00.000Z"));

    expect(ranges).toHaveLength(7);
    expect(ranges[0].dateKey).toBe("2026-03-14");
    expect(ranges[6].dateKey).toBe("2026-03-20");
  });

  it("clamps invalid day values", () => {
    expect(buildDailyRanges(-5)).toHaveLength(1);
    expect(buildDailyRanges(999)).toHaveLength(90);
  });
});
