-- Pro-tier features:
--   * MarketplaceListing.featured: marks Pro-boosted listings so they sort first
--     in marketplace queries. featuredUntil lets us auto-unfeature on a schedule.
--   * Indexed so the marketplace query stays fast when "featured first" is enabled.

ALTER TABLE "marketplace_listings"
  ADD COLUMN "featured"        BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN "featured_until"  TIMESTAMP(3);

CREATE INDEX "marketplace_featured_idx"
  ON "marketplace_listings" ("featured", "featured_until");
