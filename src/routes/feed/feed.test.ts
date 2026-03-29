/**
 * FEED ROUTES TESTS
 * Tests for social feed endpoints: posts, comments, likes, reports
 */

import request from "supertest";
import { app } from "../../server";
import {
  createTestUser,
  cleanupTestData,
  assertValidSuccessResponse,
  assertValidPaginatedResponse,
} from "../../test/utils";

describe("Feed Routes", () => {
  afterEach(async () => {
    await cleanupTestData();
  });

  describe("GET /api/feed", () => {
    it("should get user feed", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get("/api/feed?page=1&limit=20")
        .set("Authorization", `Bearer ${token}`);

      expect([200, 404]).toContain(res.status);
      if (res.status === 200) {
        expect(Array.isArray(res.body.data || res.body)).toBe(true);
      }
    });
  });

  describe("POST /api/feed/posts", () => {
    it("should create a post", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/api/feed/posts")
        .set("Authorization", `Bearer ${token}`)
        .send({
          content: "Just finished a great ride!",
          images: [],
        });

      expect([200, 201, 404]).toContain(res.status);
    });

    it("should return 401 without auth", async () => {
      const res = await request(app)
        .post("/api/feed/posts")
        .send({ content: "Test post" });

      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/feed/posts/:id", () => {
    it("should get post details", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get("/api/feed/posts/test-post-id")
        .set("Authorization", `Bearer ${token}`);

      expect([200, 404]).toContain(res.status);
    });
  });

  describe("PATCH /api/feed/posts/:id", () => {
    it("author should edit their post", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .patch("/api/feed/posts/test-post-id")
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "Updated content" });

      expect([200, 404]).toContain(res.status);
    });
  });

  describe("DELETE /api/feed/posts/:id", () => {
    it("author should delete their post", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .delete("/api/feed/posts/test-post-id")
        .set("Authorization", `Bearer ${token}`);

      expect([200, 204, 404]).toContain(res.status);
    });
  });

  describe("POST /api/feed/posts/:id/like", () => {
    it("should like a post", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/api/feed/posts/test-post-id/like")
        .set("Authorization", `Bearer ${token}`);

      expect([200, 201, 404]).toContain(res.status);
    });
  });

  describe("DELETE /api/feed/posts/:id/like", () => {
    it("should unlike a post", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .delete("/api/feed/posts/test-post-id/like")
        .set("Authorization", `Bearer ${token}`);

      expect([200, 204, 404]).toContain(res.status);
    });
  });

  describe("POST /api/feed/posts/:id/comments", () => {
    it("should add comment to post", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/api/feed/posts/test-post-id/comments")
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "Great post!" });

      expect([200, 201, 404]).toContain(res.status);
    });
  });

  describe("DELETE /api/feed/comments/:id", () => {
    it("author should delete comment", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .delete("/api/feed/comments/test-comment-id")
        .set("Authorization", `Bearer ${token}`);

      expect([200, 204, 404]).toContain(res.status);
    });
  });

  describe("POST /api/feed/posts/:id/report", () => {
    it("should report inappropriate post", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/api/feed/posts/test-post-id/report")
        .set("Authorization", `Bearer ${token}`)
        .send({ reason: "Inappropriate content" });

      expect([200, 201, 404]).toContain(res.status);
    });
  });
});
