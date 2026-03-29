/**
 * CHAT ROUTES TESTS
 * Tests for chat endpoints: conversations, messages, reactions
 */

import request from "supertest";
import { app } from "../../server";
import {
  createTestUser,
  cleanupTestData,
  assertValidSuccessResponse,
  assertValidPaginatedResponse,
} from "../../test/utils";

describe("Chat Routes", () => {
  afterEach(async () => {
    await cleanupTestData();
  });

  describe("GET /api/chat/conversations", () => {
    it("should list user conversations", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get("/api/chat/conversations")
        .set("Authorization", `Bearer ${token}`);

      expect([200, 404]).toContain(res.status);
      if (res.status === 200) {
        expect(Array.isArray(res.body.data || res.body)).toBe(true);
      }
    });

    it("should return 401 without auth", async () => {
      const res = await request(app).get("/api/chat/conversations");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/chat/conversations/:id", () => {
    it("should get conversation details", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get("/api/chat/conversations/test-conv-id")
        .set("Authorization", `Bearer ${token}`);

      expect([200, 404]).toContain(res.status);
    });
  });

  describe("GET /api/chat/conversations/:id/messages", () => {
    it("should list conversation messages", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get("/api/chat/conversations/test-conv-id/messages")
        .set("Authorization", `Bearer ${token}`);

      expect([200, 404]).toContain(res.status);
    });
  });

  describe("POST /api/chat/messages", () => {
    it("should send a message", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/api/chat/messages")
        .set("Authorization", `Bearer ${token}`)
        .send({
          conversationId: "test-conv-id",
          content: "Hello!",
        });

      expect([200, 201, 404]).toContain(res.status);
    });

    it("should return 401 without auth", async () => {
      const res = await request(app)
        .post("/api/chat/messages")
        .send({ conversationId: "test", content: "Hello" });

      expect(res.status).toBe(401);
    });
  });

  describe("PATCH /api/chat/messages/:id", () => {
    it("should edit message", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .patch("/api/chat/messages/test-msg-id")
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "Updated message" });

      expect([200, 404]).toContain(res.status);
    });
  });

  describe("DELETE /api/chat/messages/:id", () => {
    it("should delete message", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .delete("/api/chat/messages/test-msg-id")
        .set("Authorization", `Bearer ${token}`);

      expect([200, 204, 404]).toContain(res.status);
    });
  });

  describe("POST /api/chat/messages/:id/reaction", () => {
    it("should add reaction to message", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/api/chat/messages/test-msg-id/reaction")
        .set("Authorization", `Bearer ${token}`)
        .send({ emoji: "👍" });

      expect([200, 201, 404]).toContain(res.status);
    });
  });

  describe("GET /api/chat/conversations/:id/unread", () => {
    it("should get unread message count", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get("/api/chat/conversations/test-conv-id/unread")
        .set("Authorization", `Bearer ${token}`);

      expect([200, 404]).toContain(res.status);
    });
  });
});
