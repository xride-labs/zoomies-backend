// Normalizers for ride taxonomy fields.
//
// History: the mobile client sends lowercase values like "intermediate",
// "advanced", "relaxed", "spirited" while the discovery feed and admin
// surfaces query on the legacy Title-cased enum ("Beginner" | "Intermediate"
// | "Expert", "Leisurely" | "Moderate" | "Fast"). Without normalization,
// rides created from mobile become invisible to the discovery filters and
// the web admin's dropdowns.
//
// We canonicalize on write (create + update) so the DB stays consistent and
// every downstream filter works without per-call casing logic. Unknown
// values fall back to the closest sane bucket rather than throwing — the
// column is `String?` and refusing the write would block the creator.

const EXPERIENCE_MAP: Record<string, "Beginner" | "Intermediate" | "Expert"> = {
  beginner: "Beginner",
  novice: "Beginner",
  intermediate: "Intermediate",
  // Mobile uses "advanced" and "expert" interchangeably. The DB enum has
  // only Expert, so collapse both into Expert.
  advanced: "Expert",
  expert: "Expert",
  pro: "Expert",
};

const PACE_MAP: Record<string, "Leisurely" | "Moderate" | "Fast"> = {
  // Mobile labels → canonical pace
  relaxed: "Leisurely",
  leisurely: "Leisurely",
  scenic: "Leisurely",
  moderate: "Moderate",
  steady: "Moderate",
  fast: "Fast",
  // "spirited" is the upper end of the mobile picker; bucket into Fast.
  spirited: "Fast",
  aggressive: "Fast",
};

export function normalizeExperienceLevel(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return EXPERIENCE_MAP[trimmed.toLowerCase()] ?? trimmed;
}

export function normalizePace(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return PACE_MAP[trimmed.toLowerCase()] ?? trimmed;
}
