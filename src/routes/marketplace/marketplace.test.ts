/**
 * MARKETPLACE ROUTES TESTS
 *
 * Comprehensive coverage of every endpoint mounted under /api/marketplace
 * (marketplace.routes.ts). All 14 routes are exercised:
 *
 *   GET    /                       list (pagination + filters/search)
 *   GET    /my-listings            current user's listings
 *   GET    /:id                    listing detail (+ offerSummary)
 *   POST   /                       create (+ free-tier limit gate)
 *   PATCH  /:id                    update (ownership)
 *   DELETE /:id                    delete (ownership, cascades reviews)
 *   POST   /:id/feature            Pro-only boost
 *   POST   /:id/unfeature          unboost
 *   POST   /:id/reviews            add review (own-listing / dup / not-found)
 *   POST   /:id/interests          mark interest (upsert)
 *   POST   /:id/offers             place bid (allowBids / status / own-listing)
 *   GET    /:id/offers/my          my offer for a listing
 *   GET    /:id/offers             all offers (seller/admin only)
 *   PATCH  /:id/offers/:offerId    update offer status (buyer/seller rules)
 *
 * Auth: Bearer-token via createTestUser(); the Better Auth mock bridges the JWT
 * to a real session so requireAuth runs unmodified.
 *
 * Pro state: isUserPro() reads user.subscriptionTier (no billing rows in tests),
 * so createTestUser({ subscriptionTier: "PRO" }) yields a Pro user.
 *
 * Envelope: success { success, message, data } (200), created (201);
 * ApiResponse.paginated => data: { items, pagination } (NESTED).
 *
 * IDs: idParamSchema requires 20-36 chars of [a-zA-Z0-9_-]; a short id => 400,
 * a 24-char nonexistent id => 404. Offer sub-routes that PATCH use a cuid
 * schema for both id + offerId.
 *
 * Cleanup: cleanupTestData() wipes reviews/listings/users; deleting users
 * cascades ListingOffer, ListingInterest, Review, so no extra teardown needed.
 */

import request from "supertest";
import { app } from "../../server";
import prisma from "../../lib/prisma";
import {
  createTestUser,
  createTestListing,
  createAdminUser,
  cleanupTestData,
  assertValidSuccessResponse,
  mockListingData,
} from "../../test/utils";

// A 24-char id that matches idParamSchema (/^[a-zA-Z0-9_-]{20,36}$/) but never
// exists in the DB — used to assert 404s.
const NONEXISTENT_ID = "clnonexistent00000000abc";
// A cuid-shaped id (starts with "c", lowercase alphanumeric) that satisfies the
// offer routes' z.string().cuid() param schema but never exists.
const NONEXISTENT_CUID = "ckzzzzzzzzzzzzzzzzzzzzzzzz";

describe("Marketplace Routes", () => {
  afterEach(async () => {
    await cleanupTestData();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GET /api/marketplace  — list
  // ───────────────────────────────────────────────────────────────────────────
  describe("GET /api/marketplace", () => {
    it("should list active marketplace listings (nested paginated envelope)", async () => {
      const seller = await createTestUser();
      const { token } = await createTestUser();
      await createTestListing(seller.user.id, { status: "ACTIVE" });
      await createTestListing(seller.user.id, { status: "ACTIVE" });

      const res = await request(app)
        .get("/api/marketplace?page=1&limit=10")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // ApiResponse.paginated nests under data: { items, pagination }
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(2);
      expect(res.body.data.pagination).toMatchObject({
        page: 1,
        limit: 10,
        total: expect.any(Number),
        totalPages: expect.any(Number),
      });
      // seller is included via the relation select
      expect(res.body.data.items[0].seller).toHaveProperty("id");
    });

    it("should default to ACTIVE status and exclude SOLD/INACTIVE listings", async () => {
      const seller = await createTestUser();
      const { token } = await createTestUser();
      await createTestListing(seller.user.id, { status: "ACTIVE" });
      await createTestListing(seller.user.id, { status: "SOLD" });
      await createTestListing(seller.user.id, { status: "INACTIVE" });

      const res = await request(app)
        .get("/api/marketplace")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(
        res.body.data.items.every((l: any) => l.status === "ACTIVE"),
      ).toBe(true);
    });

    it("should filter by status when explicitly requested", async () => {
      const seller = await createTestUser();
      const { token } = await createTestUser();
      await createTestListing(seller.user.id, { status: "SOLD" });

      const res = await request(app)
        .get("/api/marketplace?status=SOLD")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
      expect(
        res.body.data.items.every((l: any) => l.status === "SOLD"),
      ).toBe(true);
    });

    it("should filter by category", async () => {
      const seller = await createTestUser();
      const { token } = await createTestUser();
      await createTestListing(seller.user.id, { category: "Motorcycle" });
      await createTestListing(seller.user.id, { category: "Gear" });

      const res = await request(app)
        .get("/api/marketplace?category=Motorcycle")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(
        res.body.data.items.every((l: any) => l.category === "Motorcycle"),
      ).toBe(true);
    });

    it("should filter by price range (minPrice/maxPrice)", async () => {
      const seller = await createTestUser();
      const { token } = await createTestUser();
      await createTestListing(seller.user.id, { price: 100 });
      await createTestListing(seller.user.id, { price: 5000 });

      const res = await request(app)
        .get("/api/marketplace?minPrice=1000&maxPrice=9999")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(
        res.body.data.items.every(
          (l: any) => l.price >= 1000 && l.price <= 9999,
        ),
      ).toBe(true);
      expect(res.body.data.items.some((l: any) => l.price === 5000)).toBe(true);
    });

    it("should filter by condition", async () => {
      const seller = await createTestUser();
      const { token } = await createTestUser();
      await createTestListing(seller.user.id, { condition: "New" });
      await createTestListing(seller.user.id, { condition: "Poor" });

      const res = await request(app)
        .get("/api/marketplace?condition=New")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(
        res.body.data.items.every((l: any) => l.condition === "New"),
      ).toBe(true);
    });

    it("should filter by sellerId", async () => {
      const seller = await createTestUser();
      const other = await createTestUser();
      const { token } = await createTestUser();
      await createTestListing(seller.user.id);
      await createTestListing(other.user.id);

      const res = await request(app)
        .get(`/api/marketplace?sellerId=${seller.user.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(
        res.body.data.items.every((l: any) => l.sellerId === seller.user.id),
      ).toBe(true);
    });

    it("should search listings by title", async () => {
      const seller = await createTestUser();
      const { token } = await createTestUser();
      await createTestListing(seller.user.id, { title: "Mountain Bike 2023" });
      await createTestListing(seller.user.id, { title: "Road Helmet" });

      const res = await request(app)
        .get("/api/marketplace?search=Mountain")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
      expect(
        res.body.data.items.every((l: any) =>
          /mountain/i.test(l.title ?? ""),
        ),
      ).toBe(true);
    });

    it("should sort featured listings first", async () => {
      const seller = await createTestUser();
      const { token } = await createTestUser();
      await createTestListing(seller.user.id, { title: "Plain" });
      await createTestListing(seller.user.id, {
        title: "Boosted",
        featured: true,
      });

      const res = await request(app)
        .get("/api/marketplace?limit=50")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items[0].featured).toBe(true);
    });

    it("should reject invalid pagination (limit > 100) with 400", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get("/api/marketplace?limit=500")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
    });

    it("should return 401 without auth", async () => {
      const res = await request(app).get("/api/marketplace");
      expect(res.status).toBe(401);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GET /api/marketplace/my-listings
  // ───────────────────────────────────────────────────────────────────────────
  describe("GET /api/marketplace/my-listings", () => {
    it("should return only the current user's listings", async () => {
      const { user, token } = await createTestUser();
      const other = await createTestUser();
      await createTestListing(user.id);
      await createTestListing(user.id);
      await createTestListing(other.user.id);

      const res = await request(app)
        .get("/api/marketplace/my-listings")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.items.length).toBe(2);
      expect(
        res.body.data.items.every((l: any) => l.sellerId === user.id),
      ).toBe(true);
      expect(res.body.data.pagination.total).toBe(2);
    });

    it("should filter my-listings by status", async () => {
      const { user, token } = await createTestUser();
      await createTestListing(user.id, { status: "ACTIVE" });
      await createTestListing(user.id, { status: "SOLD" });

      const res = await request(app)
        .get("/api/marketplace/my-listings?status=SOLD")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].status).toBe("SOLD");
    });

    it("should search my-listings by title", async () => {
      const { user, token } = await createTestUser();
      await createTestListing(user.id, { title: "Carbon Frame" });
      await createTestListing(user.id, { title: "Steel Frame" });

      const res = await request(app)
        .get("/api/marketplace/my-listings?search=Carbon")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].title).toBe("Carbon Frame");
    });

    it("should return 401 without auth", async () => {
      const res = await request(app).get("/api/marketplace/my-listings");
      expect(res.status).toBe(401);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GET /api/marketplace/:id
  // ───────────────────────────────────────────────────────────────────────────
  describe("GET /api/marketplace/:id", () => {
    it("should return listing details with offerSummary", async () => {
      const seller = await createTestUser();
      const listing = await createTestListing(seller.user.id);
      const { token } = await createTestUser();

      const res = await request(app)
        .get(`/api/marketplace/${listing.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      assertValidSuccessResponse(res.body, "listing");
      expect(res.body.data.listing.id).toBe(listing.id);
      expect(res.body.data.listing.seller).toHaveProperty("reputationScore");
      expect(res.body.data.listing.offerSummary).toMatchObject({
        totalOffers: expect.any(Number),
        activeOffers: expect.any(Number),
        interestCount: expect.any(Number),
      });
    });

    it("should hide other buyers' offers from a non-seller viewer", async () => {
      const seller = await createTestUser();
      const buyer = await createTestUser();
      const viewer = await createTestUser();
      const listing = await createTestListing(seller.user.id);

      // buyer places a bid
      await request(app)
        .post(`/api/marketplace/${listing.id}/offers`)
        .set("Authorization", `Bearer ${buyer.token}`)
        .send({ offeredPrice: 500 });

      const res = await request(app)
        .get(`/api/marketplace/${listing.id}`)
        .set("Authorization", `Bearer ${viewer.token}`);

      expect(res.status).toBe(200);
      // viewer is neither seller nor the bidding buyer -> offers array empty
      expect(res.body.data.listing.offers).toEqual([]);
      // but the summary still reflects there is an active offer
      expect(res.body.data.listing.offerSummary.totalOffers).toBe(1);
    });

    it("should expose all offers to the seller", async () => {
      const seller = await createTestUser();
      const buyer = await createTestUser();
      const listing = await createTestListing(seller.user.id);

      await request(app)
        .post(`/api/marketplace/${listing.id}/offers`)
        .set("Authorization", `Bearer ${buyer.token}`)
        .send({ offeredPrice: 700 });

      const res = await request(app)
        .get(`/api/marketplace/${listing.id}`)
        .set("Authorization", `Bearer ${seller.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.listing.offers.length).toBe(1);
      expect(res.body.data.listing.offers[0].offeredPrice).toBe(700);
    });

    it("should return 404 for a valid-format but nonexistent id", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get(`/api/marketplace/${NONEXISTENT_ID}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("LISTING_NOT_FOUND");
    });

    it("should return 400 for an id shorter than 20 chars", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get("/api/marketplace/short")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
    });

    it("should return 401 without auth", async () => {
      const seller = await createTestUser();
      const listing = await createTestListing(seller.user.id);

      const res = await request(app).get(`/api/marketplace/${listing.id}`);
      expect(res.status).toBe(401);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // POST /api/marketplace  — create
  // ───────────────────────────────────────────────────────────────────────────
  describe("POST /api/marketplace", () => {
    it("should create a listing successfully and assign SELLER role", async () => {
      const { user, token } = await createTestUser();

      // mockListingData.valid.condition ("Excellent") is NOT in the enum
      // [New, Like New, Good, Fair, Poor]; override so validation passes.
      const payload = { ...mockListingData.valid, condition: "Like New" };
      const res = await request(app)
        .post("/api/marketplace")
        .set("Authorization", `Bearer ${token}`)
        .send(payload);

      expect(res.status).toBe(201);
      assertValidSuccessResponse(res.body, "listing");
      expect(res.body.message).toBe("Listing created successfully");
      expect(res.body.data.listing.title).toBe(mockListingData.valid.title);
      expect(res.body.data.listing.sellerId).toBe(user.id);
      // currency defaults to INR per the schema
      expect(res.body.data.listing.currency).toBe("INR");

      // DB side-effects: listing persisted + SELLER role granted
      const dbListing = await prisma.marketplaceListing.findUnique({
        where: { id: res.body.data.listing.id },
      });
      expect(dbListing).not.toBeNull();
      const sellerRole = await prisma.userRoleAssignment.findFirst({
        where: { userId: user.id, role: "SELLER" },
      });
      expect(sellerRole).not.toBeNull();
    });

    it("should accept an explicit currency and condition enum value", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/api/marketplace")
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "USD Helmet",
          price: 250,
          currency: "USD",
          category: "Gear",
          condition: "Good",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.listing.currency).toBe("USD");
      expect(res.body.data.listing.condition).toBe("Good");
      expect(res.body.data.listing.category).toBe("Gear");
    });

    it("should reject empty title / negative price with 400", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/api/marketplace")
        .set("Authorization", `Bearer ${token}`)
        .send(mockListingData.invalid);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should reject an invalid condition enum value with 400", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/api/marketplace")
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "Bad Condition", price: 100, condition: "Excellent" });

      expect(res.status).toBe(400);
    });

    it("should reject an invalid category enum value with 400", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/api/marketplace")
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "Bad Category", price: 100, category: "Spaceship" });

      expect(res.status).toBe(400);
    });

    it("should 403 a FREE user creating beyond the active-listing limit", async () => {
      // FREE_MARKETPLACE_LISTING_LIMIT === 3
      const { user, token } = await createTestUser(); // FREE by default
      await createTestListing(user.id, { status: "ACTIVE" });
      await createTestListing(user.id, { status: "ACTIVE" });
      await createTestListing(user.id, { status: "ACTIVE" });

      const res = await request(app)
        .post("/api/marketplace")
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "Fourth Listing", price: 100 });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("SUBSCRIPTION_REQUIRED");
    });

    it("should allow a PRO user to create beyond the free limit", async () => {
      const { user, token } = await createTestUser({ subscriptionTier: "PRO" });
      await createTestListing(user.id, { status: "ACTIVE" });
      await createTestListing(user.id, { status: "ACTIVE" });
      await createTestListing(user.id, { status: "ACTIVE" });

      const res = await request(app)
        .post("/api/marketplace")
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "Pro Fourth Listing", price: 100 });

      expect(res.status).toBe(201);
    });

    it("should return 401 without auth", async () => {
      const res = await request(app)
        .post("/api/marketplace")
        .send({ title: "No Auth", price: 100 });

      expect(res.status).toBe(401);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // PATCH /api/marketplace/:id  — update
  // ───────────────────────────────────────────────────────────────────────────
  describe("PATCH /api/marketplace/:id", () => {
    it("seller should update their listing and persist changes", async () => {
      const seller = await createTestUser();
      const listing = await createTestListing(seller.user.id);

      const res = await request(app)
        .patch(`/api/marketplace/${listing.id}`)
        .set("Authorization", `Bearer ${seller.token}`)
        .send({ price: 1500, title: "Updated Title", status: "INACTIVE" });

      expect(res.status).toBe(200);
      assertValidSuccessResponse(res.body, "listing");
      expect(res.body.data.listing.price).toBe(1500);
      expect(res.body.data.listing.title).toBe("Updated Title");
      expect(res.body.data.listing.status).toBe("INACTIVE");

      const db = await prisma.marketplaceListing.findUnique({
        where: { id: listing.id },
      });
      expect(db?.price).toBe(1500);
      expect(db?.status).toBe("INACTIVE");
    });

    it("admin should be able to update someone else's listing", async () => {
      const seller = await createTestUser();
      const admin = await createAdminUser();
      const listing = await createTestListing(seller.user.id);

      const res = await request(app)
        .patch(`/api/marketplace/${listing.id}`)
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ title: "Admin Edited" });

      expect(res.status).toBe(200);
      expect(res.body.data.listing.title).toBe("Admin Edited");
    });

    it("non-seller should not update listing (403)", async () => {
      const seller = await createTestUser();
      const listing = await createTestListing(seller.user.id);
      const { token } = await createTestUser();

      const res = await request(app)
        .patch(`/api/marketplace/${listing.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ price: 100 });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    it("should reject an invalid status enum with 400 (before ownership)", async () => {
      const seller = await createTestUser();
      const listing = await createTestListing(seller.user.id);

      const res = await request(app)
        .patch(`/api/marketplace/${listing.id}`)
        .set("Authorization", `Bearer ${seller.token}`)
        .send({ status: "ARCHIVED" });

      expect(res.status).toBe(400);
    });

    it("should 403 a non-owner even for a nonexistent listing (ownership check runs)", async () => {
      const { token } = await createTestUser();

      // validateParams passes (24-char), update body valid; ownership check
      // finds no listing -> not owner -> 403.
      const res = await request(app)
        .patch(`/api/marketplace/${NONEXISTENT_ID}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ price: 100 });

      expect(res.status).toBe(403);
    });

    it("should return 401 without auth", async () => {
      const seller = await createTestUser();
      const listing = await createTestListing(seller.user.id);

      const res = await request(app)
        .patch(`/api/marketplace/${listing.id}`)
        .send({ price: 100 });

      expect(res.status).toBe(401);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // DELETE /api/marketplace/:id
  // ───────────────────────────────────────────────────────────────────────────
  describe("DELETE /api/marketplace/:id", () => {
    it("seller should delete their listing and its reviews", async () => {
      const seller = await createTestUser();
      const buyer = await createTestUser();
      const listing = await createTestListing(seller.user.id);

      // leave a review so we can assert the cascade delete
      await request(app)
        .post(`/api/marketplace/${listing.id}/reviews`)
        .set("Authorization", `Bearer ${buyer.token}`)
        .send({ rating: 4, comment: "ok" });

      const res = await request(app)
        .delete(`/api/marketplace/${listing.id}`)
        .set("Authorization", `Bearer ${seller.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const db = await prisma.marketplaceListing.findUnique({
        where: { id: listing.id },
      });
      expect(db).toBeNull();
      const reviews = await prisma.review.findMany({
        where: { listingId: listing.id },
      });
      expect(reviews.length).toBe(0);
    });

    it("admin should be able to delete someone else's listing", async () => {
      const seller = await createTestUser();
      const admin = await createAdminUser();
      const listing = await createTestListing(seller.user.id);

      const res = await request(app)
        .delete(`/api/marketplace/${listing.id}`)
        .set("Authorization", `Bearer ${admin.token}`);

      expect(res.status).toBe(200);
    });

    it("non-seller should not delete listing (403)", async () => {
      const seller = await createTestUser();
      const listing = await createTestListing(seller.user.id);
      const { token } = await createTestUser();

      const res = await request(app)
        .delete(`/api/marketplace/${listing.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it("should return 401 without auth", async () => {
      const seller = await createTestUser();
      const listing = await createTestListing(seller.user.id);

      const res = await request(app).delete(`/api/marketplace/${listing.id}`);
      expect(res.status).toBe(401);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // POST /api/marketplace/:id/feature  &  /unfeature
  // ───────────────────────────────────────────────────────────────────────────
  describe("POST /api/marketplace/:id/feature", () => {
    it("PRO seller should feature their listing", async () => {
      const seller = await createTestUser({ subscriptionTier: "PRO" });
      const listing = await createTestListing(seller.user.id);

      const res = await request(app)
        .post(`/api/marketplace/${listing.id}/feature`)
        .set("Authorization", `Bearer ${seller.token}`)
        .send({ durationDays: 5 });

      expect(res.status).toBe(200);
      expect(res.body.data.listing.featured).toBe(true);
      expect(res.body.data.listing.featuredUntil).toBeTruthy();

      const db = await prisma.marketplaceListing.findUnique({
        where: { id: listing.id },
      });
      expect(db?.featured).toBe(true);
    });

    it("should default durationDays when omitted (PRO seller)", async () => {
      const seller = await createTestUser({ subscriptionTier: "PRO" });
      const listing = await createTestListing(seller.user.id);

      const res = await request(app)
        .post(`/api/marketplace/${listing.id}/feature`)
        .set("Authorization", `Bearer ${seller.token}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.listing.featured).toBe(true);
    });

    it("FREE seller should be blocked from featuring (403)", async () => {
      const seller = await createTestUser(); // FREE
      const listing = await createTestListing(seller.user.id);

      const res = await request(app)
        .post(`/api/marketplace/${listing.id}/feature`)
        .set("Authorization", `Bearer ${seller.token}`)
        .send({ durationDays: 7 });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("SUBSCRIPTION_REQUIRED");
    });

    it("non-owner should be blocked from featuring (403, before Pro check)", async () => {
      const seller = await createTestUser();
      const listing = await createTestListing(seller.user.id);
      const stranger = await createTestUser({ subscriptionTier: "PRO" });

      const res = await request(app)
        .post(`/api/marketplace/${listing.id}/feature`)
        .set("Authorization", `Bearer ${stranger.token}`)
        .send({ durationDays: 7 });

      expect(res.status).toBe(403);
    });

    it("should reject durationDays out of range (>30) with 400", async () => {
      const seller = await createTestUser({ subscriptionTier: "PRO" });
      const listing = await createTestListing(seller.user.id);

      const res = await request(app)
        .post(`/api/marketplace/${listing.id}/feature`)
        .set("Authorization", `Bearer ${seller.token}`)
        .send({ durationDays: 90 });

      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/marketplace/:id/unfeature", () => {
    it("owner should unfeature their listing", async () => {
      const seller = await createTestUser({ subscriptionTier: "PRO" });
      const listing = await createTestListing(seller.user.id, {
        featured: true,
      });

      const res = await request(app)
        .post(`/api/marketplace/${listing.id}/unfeature`)
        .set("Authorization", `Bearer ${seller.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.listing.featured).toBe(false);

      const db = await prisma.marketplaceListing.findUnique({
        where: { id: listing.id },
      });
      expect(db?.featured).toBe(false);
      expect(db?.featuredUntil).toBeNull();
    });

    it("non-owner should not unfeature (403)", async () => {
      const seller = await createTestUser();
      const listing = await createTestListing(seller.user.id, {
        featured: true,
      });
      const { token } = await createTestUser();

      const res = await request(app)
        .post(`/api/marketplace/${listing.id}/unfeature`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // POST /api/marketplace/:id/reviews
  // ───────────────────────────────────────────────────────────────────────────
  describe("POST /api/marketplace/:id/reviews", () => {
    it("a buyer should add a review to someone else's listing", async () => {
      const seller = await createTestUser();
      const buyer = await createTestUser();
      const listing = await createTestListing(seller.user.id);

      const res = await request(app)
        .post(`/api/marketplace/${listing.id}/reviews`)
        .set("Authorization", `Bearer ${buyer.token}`)
        .send({ rating: 5, comment: "Great seller!" });

      expect(res.status).toBe(201);
      assertValidSuccessResponse(res.body, "review");
      expect(res.body.data.review.rating).toBe(5);
      expect(res.body.data.review.reviewer).toHaveProperty("id", buyer.user.id);

      const db = await prisma.review.findUnique({
        where: {
          listingId_reviewerId: {
            listingId: listing.id,
            reviewerId: buyer.user.id,
          },
        },
      });
      expect(db).not.toBeNull();
    });

    it("should reject reviewing your own listing (400)", async () => {
      const seller = await createTestUser();
      const listing = await createTestListing(seller.user.id);

      const res = await request(app)
        .post(`/api/marketplace/${listing.id}/reviews`)
        .set("Authorization", `Bearer ${seller.token}`)
        .send({ rating: 5, comment: "love my own thing" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_INPUT");
    });

    it("should reject a duplicate review with 409", async () => {
      const seller = await createTestUser();
      const buyer = await createTestUser();
      const listing = await createTestListing(seller.user.id);

      await request(app)
        .post(`/api/marketplace/${listing.id}/reviews`)
        .set("Authorization", `Bearer ${buyer.token}`)
        .send({ rating: 4 });

      const res = await request(app)
        .post(`/api/marketplace/${listing.id}/reviews`)
        .set("Authorization", `Bearer ${buyer.token}`)
        .send({ rating: 2 });

      expect(res.status).toBe(409);
    });

    it("should 404 when reviewing a nonexistent listing", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post(`/api/marketplace/${NONEXISTENT_ID}/reviews`)
        .set("Authorization", `Bearer ${token}`)
        .send({ rating: 5 });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("LISTING_NOT_FOUND");
    });

    it("should reject rating out of range (>5) with 400", async () => {
      const seller = await createTestUser();
      const buyer = await createTestUser();
      const listing = await createTestListing(seller.user.id);

      const res = await request(app)
        .post(`/api/marketplace/${listing.id}/reviews`)
        .set("Authorization", `Bearer ${buyer.token}`)
        .send({ rating: 9 });

      expect(res.status).toBe(400);
    });

    it("should return 401 without auth", async () => {
      const seller = await createTestUser();
      const listing = await createTestListing(seller.user.id);

      const res = await request(app)
        .post(`/api/marketplace/${listing.id}/reviews`)
        .send({ rating: 5 });

      expect(res.status).toBe(401);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // POST /api/marketplace/:id/interests
  // ───────────────────────────────────────────────────────────────────────────
  describe("POST /api/marketplace/:id/interests", () => {
    it("a non-owner should be able to mark interest (idempotent upsert)", async () => {
      const seller = await createTestUser();
      const buyer = await createTestUser();
      const listing = await createTestListing(seller.user.id);

      const res1 = await request(app)
        .post(`/api/marketplace/${listing.id}/interests`)
        .set("Authorization", `Bearer ${buyer.token}`);

      expect(res1.status).toBe(200);
      assertValidSuccessResponse(res1.body, "interest");

      // upsert: marking interest again should not error or duplicate
      const res2 = await request(app)
        .post(`/api/marketplace/${listing.id}/interests`)
        .set("Authorization", `Bearer ${buyer.token}`);
      expect(res2.status).toBe(200);

      const count = await prisma.listingInterest.count({
        where: { listingId: listing.id, userId: buyer.user.id },
      });
      expect(count).toBe(1);
    });

    it("should reject marking interest on your own listing (400)", async () => {
      const seller = await createTestUser();
      const listing = await createTestListing(seller.user.id);

      const res = await request(app)
        .post(`/api/marketplace/${listing.id}/interests`)
        .set("Authorization", `Bearer ${seller.token}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_INPUT");
    });

    it("should 404 for a nonexistent listing", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post(`/api/marketplace/${NONEXISTENT_ID}/interests`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it("should return 401 without auth", async () => {
      const seller = await createTestUser();
      const listing = await createTestListing(seller.user.id);

      const res = await request(app).post(
        `/api/marketplace/${listing.id}/interests`,
      );
      expect(res.status).toBe(401);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // POST /api/marketplace/:id/offers  — place a bid
  // ───────────────────────────────────────────────────────────────────────────
  describe("POST /api/marketplace/:id/offers", () => {
    it("a buyer should place a bid on an active, biddable listing", async () => {
      const seller = await createTestUser();
      const buyer = await createTestUser();
      const listing = await createTestListing(seller.user.id, {
        price: 1000,
        allowBids: true,
      });

      const res = await request(app)
        .post(`/api/marketplace/${listing.id}/offers`)
        .set("Authorization", `Bearer ${buyer.token}`)
        .send({ offeredPrice: 800, message: "Would you take 800?" });

      expect(res.status).toBe(200);
      assertValidSuccessResponse(res.body, "offer");
      expect(res.body.data.offer.offeredPrice).toBe(800);
      expect(res.body.data.offer.status).toBe("OFFER_MADE");
      expect(res.body.data.offer.buyer).toHaveProperty("id", buyer.user.id);

      const db = await prisma.listingOffer.findUnique({
        where: {
          listingId_buyerId: {
            listingId: listing.id,
            buyerId: buyer.user.id,
          },
        },
      });
      expect(db?.offeredPrice).toBe(800);
      expect(db?.originalPrice).toBe(1000);
    });

    it("a second bid from the same buyer should upsert into NEGOTIATING", async () => {
      const seller = await createTestUser();
      const buyer = await createTestUser();
      const listing = await createTestListing(seller.user.id, {
        allowBids: true,
      });

      await request(app)
        .post(`/api/marketplace/${listing.id}/offers`)
        .set("Authorization", `Bearer ${buyer.token}`)
        .send({ offeredPrice: 800 });

      const res = await request(app)
        .post(`/api/marketplace/${listing.id}/offers`)
        .set("Authorization", `Bearer ${buyer.token}`)
        .send({ offeredPrice: 850 });

      expect(res.status).toBe(200);
      expect(res.body.data.offer.status).toBe("NEGOTIATING");
      expect(res.body.data.offer.offeredPrice).toBe(850);

      const count = await prisma.listingOffer.count({
        where: { listingId: listing.id, buyerId: buyer.user.id },
      });
      expect(count).toBe(1);
    });

    it("should reject bidding on your own listing (400)", async () => {
      const seller = await createTestUser();
      const listing = await createTestListing(seller.user.id);

      const res = await request(app)
        .post(`/api/marketplace/${listing.id}/offers`)
        .set("Authorization", `Bearer ${seller.token}`)
        .send({ offeredPrice: 500 });

      expect(res.status).toBe(400);
    });

    it("should reject bidding when allowBids is disabled (400)", async () => {
      const seller = await createTestUser();
      const buyer = await createTestUser();
      const listing = await createTestListing(seller.user.id, {
        allowBids: false,
      });

      const res = await request(app)
        .post(`/api/marketplace/${listing.id}/offers`)
        .set("Authorization", `Bearer ${buyer.token}`)
        .send({ offeredPrice: 500 });

      expect(res.status).toBe(400);
    });

    it("should reject bidding on a non-active listing (400)", async () => {
      const seller = await createTestUser();
      const buyer = await createTestUser();
      const listing = await createTestListing(seller.user.id, {
        status: "SOLD",
        allowBids: true,
      });

      const res = await request(app)
        .post(`/api/marketplace/${listing.id}/offers`)
        .set("Authorization", `Bearer ${buyer.token}`)
        .send({ offeredPrice: 500 });

      expect(res.status).toBe(400);
    });

    it("should reject a non-positive offer price with 400", async () => {
      const seller = await createTestUser();
      const buyer = await createTestUser();
      const listing = await createTestListing(seller.user.id);

      const res = await request(app)
        .post(`/api/marketplace/${listing.id}/offers`)
        .set("Authorization", `Bearer ${buyer.token}`)
        .send({ offeredPrice: -10 });

      expect(res.status).toBe(400);
    });

    it("should 404 for a nonexistent listing", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post(`/api/marketplace/${NONEXISTENT_ID}/offers`)
        .set("Authorization", `Bearer ${token}`)
        .send({ offeredPrice: 500 });

      expect(res.status).toBe(404);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GET /api/marketplace/:id/offers/my
  // ───────────────────────────────────────────────────────────────────────────
  describe("GET /api/marketplace/:id/offers/my", () => {
    it("should return the buyer's own offer for a listing", async () => {
      const seller = await createTestUser();
      const buyer = await createTestUser();
      const listing = await createTestListing(seller.user.id);

      await request(app)
        .post(`/api/marketplace/${listing.id}/offers`)
        .set("Authorization", `Bearer ${buyer.token}`)
        .send({ offeredPrice: 600 });

      const res = await request(app)
        .get(`/api/marketplace/${listing.id}/offers/my`)
        .set("Authorization", `Bearer ${buyer.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.offer).not.toBeNull();
      expect(res.body.data.offer.offeredPrice).toBe(600);
      expect(res.body.data.offer.listing).toHaveProperty("id", listing.id);
    });

    it("should return null when the user has no offer", async () => {
      const seller = await createTestUser();
      const viewer = await createTestUser();
      const listing = await createTestListing(seller.user.id);

      const res = await request(app)
        .get(`/api/marketplace/${listing.id}/offers/my`)
        .set("Authorization", `Bearer ${viewer.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.offer).toBeNull();
    });

    it("should return 401 without auth", async () => {
      const seller = await createTestUser();
      const listing = await createTestListing(seller.user.id);

      const res = await request(app).get(
        `/api/marketplace/${listing.id}/offers/my`,
      );
      expect(res.status).toBe(401);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GET /api/marketplace/:id/offers  — seller/admin only
  // ───────────────────────────────────────────────────────────────────────────
  describe("GET /api/marketplace/:id/offers", () => {
    it("seller should see all offers with a summary", async () => {
      const seller = await createTestUser();
      const buyer1 = await createTestUser();
      const buyer2 = await createTestUser();
      const listing = await createTestListing(seller.user.id);

      await request(app)
        .post(`/api/marketplace/${listing.id}/offers`)
        .set("Authorization", `Bearer ${buyer1.token}`)
        .send({ offeredPrice: 500 });
      await request(app)
        .post(`/api/marketplace/${listing.id}/offers`)
        .set("Authorization", `Bearer ${buyer2.token}`)
        .send({ offeredPrice: 900 });

      const res = await request(app)
        .get(`/api/marketplace/${listing.id}/offers`)
        .set("Authorization", `Bearer ${seller.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.offers.length).toBe(2);
      expect(res.body.data.summary.totalOffers).toBe(2);
      // ordered by offeredPrice desc -> highest is 900
      expect(res.body.data.summary.highestOffer).toBe(900);
    });

    it("admin should see all offers for any listing", async () => {
      const seller = await createTestUser();
      const buyer = await createTestUser();
      const admin = await createAdminUser();
      const listing = await createTestListing(seller.user.id);

      await request(app)
        .post(`/api/marketplace/${listing.id}/offers`)
        .set("Authorization", `Bearer ${buyer.token}`)
        .send({ offeredPrice: 400 });

      const res = await request(app)
        .get(`/api/marketplace/${listing.id}/offers`)
        .set("Authorization", `Bearer ${admin.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.offers.length).toBe(1);
    });

    it("a non-seller non-admin should be forbidden (403)", async () => {
      const seller = await createTestUser();
      const buyer = await createTestUser();
      const listing = await createTestListing(seller.user.id);

      await request(app)
        .post(`/api/marketplace/${listing.id}/offers`)
        .set("Authorization", `Bearer ${buyer.token}`)
        .send({ offeredPrice: 400 });

      // even the bidding buyer cannot list all offers
      const res = await request(app)
        .get(`/api/marketplace/${listing.id}/offers`)
        .set("Authorization", `Bearer ${buyer.token}`);

      expect(res.status).toBe(403);
    });

    it("should 404 for a nonexistent listing", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get(`/api/marketplace/${NONEXISTENT_ID}/offers`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // PATCH /api/marketplace/:id/offers/:offerId  — update offer status
  // ───────────────────────────────────────────────────────────────────────────
  describe("PATCH /api/marketplace/:id/offers/:offerId", () => {
    async function setupOffer(offeredPrice = 800) {
      const seller = await createTestUser();
      const buyer = await createTestUser();
      const listing = await createTestListing(seller.user.id, {
        price: 1000,
        allowBids: true,
      });
      const offerRes = await request(app)
        .post(`/api/marketplace/${listing.id}/offers`)
        .set("Authorization", `Bearer ${buyer.token}`)
        .send({ offeredPrice });
      const offerId = offerRes.body.data.offer.id;
      return { seller, buyer, listing, offerId };
    }

    it("seller should accept an offer (ACCEPTED)", async () => {
      const { seller, listing, offerId } = await setupOffer();

      const res = await request(app)
        .patch(`/api/marketplace/${listing.id}/offers/${offerId}`)
        .set("Authorization", `Bearer ${seller.token}`)
        .send({ status: "ACCEPTED" });

      expect(res.status).toBe(200);
      expect(res.body.data.offer.status).toBe("ACCEPTED");
    });

    it("seller marking DEAL_DONE should mark the listing SOLD", async () => {
      const { seller, listing, offerId } = await setupOffer();

      const res = await request(app)
        .patch(`/api/marketplace/${listing.id}/offers/${offerId}`)
        .set("Authorization", `Bearer ${seller.token}`)
        .send({ status: "DEAL_DONE" });

      expect(res.status).toBe(200);
      expect(res.body.data.offer.status).toBe("DEAL_DONE");

      const db = await prisma.marketplaceListing.findUnique({
        where: { id: listing.id },
      });
      expect(db?.status).toBe("SOLD");
    });

    it("buyer should be able to withdraw their own offer", async () => {
      const { buyer, listing, offerId } = await setupOffer();

      const res = await request(app)
        .patch(`/api/marketplace/${listing.id}/offers/${offerId}`)
        .set("Authorization", `Bearer ${buyer.token}`)
        .send({ status: "WITHDRAWN" });

      expect(res.status).toBe(200);
      expect(res.body.data.offer.status).toBe("WITHDRAWN");
    });

    it("buyer should NOT be able to set a seller-only status (403)", async () => {
      const { buyer, listing, offerId } = await setupOffer();

      const res = await request(app)
        .patch(`/api/marketplace/${listing.id}/offers/${offerId}`)
        .set("Authorization", `Bearer ${buyer.token}`)
        .send({ status: "ACCEPTED" });

      expect(res.status).toBe(403);
    });

    it("seller should NOT be able to withdraw (buyer-only) (403)", async () => {
      const { seller, listing, offerId } = await setupOffer();

      const res = await request(app)
        .patch(`/api/marketplace/${listing.id}/offers/${offerId}`)
        .set("Authorization", `Bearer ${seller.token}`)
        .send({ status: "WITHDRAWN" });

      expect(res.status).toBe(403);
    });

    it("an unrelated user should be forbidden from updating the offer (403)", async () => {
      const { listing, offerId } = await setupOffer();
      const stranger = await createTestUser();

      const res = await request(app)
        .patch(`/api/marketplace/${listing.id}/offers/${offerId}`)
        .set("Authorization", `Bearer ${stranger.token}`)
        .send({ status: "REJECTED" });

      expect(res.status).toBe(403);
    });

    it("should 404 for a nonexistent offer id (valid cuid format)", async () => {
      const { seller, listing } = await setupOffer();

      const res = await request(app)
        .patch(`/api/marketplace/${listing.id}/offers/${NONEXISTENT_CUID}`)
        .set("Authorization", `Bearer ${seller.token}`)
        .send({ status: "REJECTED" });

      expect(res.status).toBe(404);
    });

    it("should reject an invalid status enum with 400", async () => {
      const { seller, listing, offerId } = await setupOffer();

      const res = await request(app)
        .patch(`/api/marketplace/${listing.id}/offers/${offerId}`)
        .set("Authorization", `Bearer ${seller.token}`)
        .send({ status: "MAYBE" });

      expect(res.status).toBe(400);
    });

    it("should reject a non-cuid offerId param with 400", async () => {
      const { seller, listing } = await setupOffer();

      const res = await request(app)
        .patch(`/api/marketplace/${listing.id}/offers/not-a-cuid`)
        .set("Authorization", `Bearer ${seller.token}`)
        .send({ status: "REJECTED" });

      expect(res.status).toBe(400);
    });

    it("should return 401 without auth", async () => {
      const { listing, offerId } = await setupOffer();

      const res = await request(app)
        .patch(`/api/marketplace/${listing.id}/offers/${offerId}`)
        .send({ status: "REJECTED" });

      expect(res.status).toBe(401);
    });
  });
});
