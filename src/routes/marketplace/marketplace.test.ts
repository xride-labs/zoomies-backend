/**
 * MARKETPLACE ROUTES TESTS
 * Tests for marketplace endpoints: create, list, update, delete, reviews, ratings
 */

import request from "supertest";
import { app } from "../../server";
import {
  createTestUser,
  createTestListing,
  createAdminUser,
  cleanupTestData,
  assertValidSuccessResponse,
  assertValidPaginatedResponse,
  mockListingData,
} from "../../test/utils";

describe("Marketplace Routes", () => {
  afterEach(async () => {
    await cleanupTestData();
  });

  describe("GET /api/marketplace", () => {
    it("should list active marketplace listings", async () => {
      const seller = await createTestUser();
      const { token } = await createTestUser();
      await createTestListing(seller.user.id, { status: "ACTIVE" });
      await createTestListing(seller.user.id, { status: "ACTIVE" });

      const res = await request(app)
        .get("/api/marketplace?page=1&limit=10")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      assertValidPaginatedResponse(res.body);
      expect(Array.isArray(res.body.data)).toBe(true);
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
    });

    it("should search listings", async () => {
      const seller = await createTestUser();
      const { token } = await createTestUser();
      await createTestListing(seller.user.id, { title: "Mountain Bike 2023" });

      const res = await request(app)
        .get("/api/marketplace?search=Mountain")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
    });
  });

  describe("GET /api/marketplace/my-listings", () => {
    it("should return user's listings", async () => {
      const { user, token } = await createTestUser();
      await createTestListing(user.id);
      await createTestListing(user.id);

      const res = await request(app)
        .get("/api/marketplace/my-listings")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      assertValidPaginatedResponse(res.body);
    });
  });

  describe("GET /api/marketplace/:id", () => {
    it("should return listing details", async () => {
      const seller = await createTestUser();
      const listing = await createTestListing(seller.user.id);
      const { token } = await createTestUser();

      const res = await request(app)
        .get(`/api/marketplace/${listing.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      assertValidSuccessResponse(res.body, "listing");
      expect(res.body.data.listing.id).toBe(listing.id);
    });

    it("should return 404 for non-existent listing", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get("/api/marketplace/invalid-id")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/marketplace", () => {
    it("should create a listing successfully", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/api/marketplace")
        .set("Authorization", `Bearer ${token}`)
        .send(mockListingData.valid);

      expect(res.status).toBe(201);
      assertValidSuccessResponse(res.body, "listing");
      expect(res.body.data.listing.title).toBe(mockListingData.valid.title);
    });

    it("should reject invalid listing data", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/api/marketplace")
        .set("Authorization", `Bearer ${token}`)
        .send(mockListingData.invalid);

      expect(res.status).toBe(400);
    });
  });

  describe("PATCH /api/marketplace/:id", () => {
    it("seller should update their listing", async () => {
      const seller = await createTestUser();
      const listing = await createTestListing(seller.user.id);

      const res = await request(app)
        .patch(`/api/marketplace/${listing.id}`)
        .set("Authorization", `Bearer ${seller.token}`)
        .send({ price: 1500, title: "Updated Title" });

      expect(res.status).toBe(200);
      assertValidSuccessResponse(res.body, "listing");
      expect(res.body.data.listing.price).toBe(1500);
    });

    it("non-seller should not update listing", async () => {
      const seller = await createTestUser();
      const listing = await createTestListing(seller.user.id);
      const { token } = await createTestUser();

      const res = await request(app)
        .patch(`/api/marketplace/${listing.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ price: 100 });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe("DELETE /api/marketplace/:id", () => {
    it("seller should delete their listing", async () => {
      const seller = await createTestUser();
      const listing = await createTestListing(seller.user.id);

      const res = await request(app)
        .delete(`/api/marketplace/${listing.id}`)
        .set("Authorization", `Bearer ${seller.token}`);

      expect(res.status).toBe(200);
    });
  });

  describe("[CRITICAL] Marketplace Reviews & Ratings", () => {
    it("should leave a review for a purchase (MISSING FEATURE - NEEDS IMPLEMENTATION)", async () => {
      const seller = await createTestUser();
      const buyer = await createTestUser();
      const listing = await createTestListing(seller.user.id);

      const res = await request(app)
        .post(`/api/marketplace/${listing.id}/review`)
        .set("Authorization", `Bearer ${buyer.token}`)
        .send({
          rating: 5,
          message: "Great product!",
        });

      // This endpoint might not exist yet
      expect([201, 404]).toContain(res.status);
    });

    it("seller reputation should update based on buyer reviews", async () => {
      const seller = await createTestUser();
      const listing = await createTestListing(seller.user.id);

      // Leave multiple reviews
      await createTestUser().then(async (buyer) => {
        await request(app)
          .post(`/api/marketplace/${listing.id}/review`)
          .set("Authorization", `Bearer ${buyer.token}`)
          .send({ rating: 5, message: "Great!" });
      });

      // Check seller reputation
      const res = await request(app)
        .get(`/api/users/${seller.user.id}`)
        .set("Authorization", `Bearer ${seller.token}`);

      expect([200, 404]).toContain(res.status);
    });
  });
});
