/**
 * FEED ROUTES TESTS
 * Comprehensive tests for the social feed: posts, comments, likes, reports.
 *
 * Route file: src/routes/feed/feed.routes.ts — mounted at BOTH /api/feed and
 * /api/posts (server.ts). The router defines paths RELATIVE to those mounts:
 *
 *   GET    /                       -> feed list      (/api/feed)
 *   POST   /                       -> create post    (/api/posts)
 *   POST   /reports                -> create report
 *   GET    /:id                    -> get post
 *   PATCH  /:id                    -> update post
 *   DELETE /:id                    -> delete post
 *   POST   /:id/like               -> like post
 *   DELETE /:id/like               -> unlike post
 *   GET    /:id/comments           -> list comments
 *   POST   /:id/comments           -> add comment
 *   DELETE /:id/comments/:commentId -> delete comment
 *
 * NOTE: The previous version of this file hit non-existent sub-paths such as
 * POST /api/feed/posts, DELETE /api/feed/comments/:id and POST
 * /api/feed/posts/:id/report — those only "passed" because Express returns 404
 * for unmatched routes. They have been rewritten to the real paths above and
 * now assert real behaviour.
 *
 * ID rules: feed uses Postgres cuids. idParamSchema requires
 * /^[a-zA-Z0-9_-]{20,36}$/, so a short id like "test-post-id" is a 400
 * validation error, while a well-formed-but-absent cuid yields 404.
 *
 * Post/Like/Comment/Report tables are NOT cleared by cleanupTestData(), so we
 * wipe them (children-first) in afterEach before deleting users.
 */

import request from "supertest";
import { app } from "../../server";
import { createTestUser, cleanupTestData } from "../../test/utils";
import prisma from "../../lib/prisma";

// Well-formed cuid-shaped id (25 chars) that will not exist => 404.
const ABSENT_POST_ID = "clabsentpost00000000000aa";
const ABSENT_COMMENT_ID = "clabsentcomment000000000a";
// Too short for idParamSchema (regex requires 20-36 chars) => 400.
const MALFORMED_ID = "test-post-id";

/** Create a post via POST /api/posts and return the created post object. */
async function createPost(
  token: string,
  body: Record<string, unknown> = { content: "Just finished a great ride!" },
) {
  const res = await request(app)
    .post("/api/posts")
    .set("Authorization", `Bearer ${token}`)
    .send(body);
  expect(res.status).toBe(201);
  return res.body.data;
}

describe("Feed Routes", () => {
  afterEach(async () => {
    // Children first to respect FKs, then users via the shared helper.
    await prisma.like.deleteMany({});
    await prisma.comment.deleteMany({});
    await prisma.report.deleteMany({});
    await prisma.follow.deleteMany({});
    await prisma.post.deleteMany({});
    await cleanupTestData();
  });

  // ─── GET /api/feed ─────────────────────────────────────────────────────────

  describe("GET /api/feed", () => {
    it("returns the user's own posts with the { posts, hasMore } envelope", async () => {
      const { token, user } = await createTestUser();
      const post = await createPost(token, { content: "my own post" });

      const res = await request(app)
        .get("/api/feed?page=1&limit=20")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.posts)).toBe(true);
      expect(res.body.data).toHaveProperty("hasMore", false);
      const own = res.body.data.posts.find((p: any) => p.id === post.id);
      expect(own).toBeDefined();
      expect(own.author.id).toBe(user.id);
      expect(own.likesCount).toBe(0);
      expect(own.commentsCount).toBe(0);
      expect(own.isLiked).toBe(false);
    });

    it("does not include posts from users the caller does not follow", async () => {
      const author = await createTestUser();
      await createPost(author.token, { content: "stranger post" });

      const viewer = await createTestUser();
      const res = await request(app)
        .get("/api/feed")
        .set("Authorization", `Bearer ${viewer.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.posts).toHaveLength(0);
    });

    it("supports hasMore pagination", async () => {
      const { token } = await createTestUser();
      await createPost(token, { content: "post 1" });
      await createPost(token, { content: "post 2" });
      await createPost(token, { content: "post 3" });

      const res = await request(app)
        .get("/api/feed?page=1&limit=2")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.posts).toHaveLength(2);
      expect(res.body.data.hasMore).toBe(true);
    });

    it("filters by post type", async () => {
      const { token } = await createTestUser();
      await createPost(token, { content: "a content post", type: "content" });
      await createPost(token, { content: "a ride post", type: "ride" });

      const res = await request(app)
        .get("/api/feed?type=ride")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.posts).toHaveLength(1);
      expect(res.body.data.posts[0].type).toBe("ride");
    });

    it("returns 400 for an invalid type filter", async () => {
      const { token } = await createTestUser();
      const res = await request(app)
        .get("/api/feed?type=bogus")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 401 without auth", async () => {
      const res = await request(app).get("/api/feed");
      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/posts (create) ──────────────────────────────────────────────

  describe("POST /api/posts (create a post)", () => {
    it("creates a post (201) and persists it", async () => {
      const { token, user } = await createTestUser();

      const res = await request(app)
        .post("/api/posts")
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "Just finished a great ride!", images: [] });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.content).toBe("Just finished a great ride!");
      expect(res.body.data.authorId).toBe(user.id);
      expect(res.body.data.type).toBe("content"); // schema default

      const inDb = await prisma.post.findUnique({
        where: { id: res.body.data.id },
      });
      expect(inDb).not.toBeNull();
    });

    it("also works via the /api/feed mount", async () => {
      const { token } = await createTestUser();
      const res = await request(app)
        .post("/api/feed")
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "posted through /api/feed" });

      expect(res.status).toBe(201);
      expect(res.body.data.content).toBe("posted through /api/feed");
    });

    it("returns 400 for empty content", async () => {
      const { token } = await createTestUser();
      const res = await request(app)
        .post("/api/posts")
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 for a non-url image", async () => {
      const { token } = await createTestUser();
      const res = await request(app)
        .post("/api/posts")
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "with bad image", images: ["not-a-url"] });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 for an invalid post type", async () => {
      const { token } = await createTestUser();
      const res = await request(app)
        .post("/api/posts")
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "bad type", type: "memes" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 401 without auth", async () => {
      const res = await request(app)
        .post("/api/posts")
        .send({ content: "Test post" });
      expect(res.status).toBe(401);
    });
  });

  // ─── GET /api/posts/:id ────────────────────────────────────────────────────

  describe("GET /api/posts/:id (get a single post)", () => {
    it("returns post details with like/comment counts", async () => {
      const { token } = await createTestUser();
      const post = await createPost(token, { content: "detail post" });

      const res = await request(app)
        .get(`/api/posts/${post.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(post.id);
      expect(res.body.data.likesCount).toBe(0);
      expect(res.body.data.commentsCount).toBe(0);
      expect(res.body.data.isLiked).toBe(false);
      expect(res.body.data.author).toBeDefined();
    });

    it("returns 404 for a well-formed but non-existent id", async () => {
      const { token } = await createTestUser();
      const res = await request(app)
        .get(`/api/posts/${ABSENT_POST_ID}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("returns 400 for a malformed id", async () => {
      const { token } = await createTestUser();
      const res = await request(app)
        .get(`/api/posts/${MALFORMED_ID}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 401 without auth", async () => {
      const res = await request(app).get(`/api/posts/${ABSENT_POST_ID}`);
      expect(res.status).toBe(401);
    });
  });

  // ─── PATCH /api/posts/:id ──────────────────────────────────────────────────

  describe("PATCH /api/posts/:id (update a post)", () => {
    it("lets the author edit their post", async () => {
      const { token } = await createTestUser();
      const post = await createPost(token, { content: "original" });

      const res = await request(app)
        .patch(`/api/posts/${post.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "Updated content" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.content).toBe("Updated content");

      const inDb = await prisma.post.findUnique({ where: { id: post.id } });
      expect(inDb?.content).toBe("Updated content");
    });

    it("returns 403 when a non-author tries to edit", async () => {
      const author = await createTestUser();
      const post = await createPost(author.token, { content: "owned" });
      const other = await createTestUser();

      const res = await request(app)
        .patch(`/api/posts/${post.id}`)
        .set("Authorization", `Bearer ${other.token}`)
        .send({ content: "hijack" });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 404 for a non-existent post", async () => {
      const { token } = await createTestUser();
      const res = await request(app)
        .patch(`/api/posts/${ABSENT_POST_ID}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "ghost" });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("returns 400 for a malformed id", async () => {
      const { token } = await createTestUser();
      const res = await request(app)
        .patch(`/api/posts/${MALFORMED_ID}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "x" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 for an invalid update body (content too long)", async () => {
      const { token } = await createTestUser();
      const post = await createPost(token, { content: "valid" });

      const res = await request(app)
        .patch(`/api/posts/${post.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "x".repeat(2001) });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 401 without auth", async () => {
      const res = await request(app)
        .patch(`/api/posts/${ABSENT_POST_ID}`)
        .send({ content: "x" });
      expect(res.status).toBe(401);
    });
  });

  // ─── DELETE /api/posts/:id ─────────────────────────────────────────────────

  describe("DELETE /api/posts/:id (delete a post)", () => {
    it("lets the author delete their post", async () => {
      const { token } = await createTestUser();
      const post = await createPost(token, { content: "to delete" });

      const res = await request(app)
        .delete(`/api/posts/${post.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Post deleted");

      const inDb = await prisma.post.findUnique({ where: { id: post.id } });
      expect(inDb).toBeNull();
    });

    it("returns 403 when a non-author tries to delete", async () => {
      const author = await createTestUser();
      const post = await createPost(author.token, { content: "owned" });
      const other = await createTestUser();

      const res = await request(app)
        .delete(`/api/posts/${post.id}`)
        .set("Authorization", `Bearer ${other.token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 404 for a non-existent post", async () => {
      const { token } = await createTestUser();
      const res = await request(app)
        .delete(`/api/posts/${ABSENT_POST_ID}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("returns 400 for a malformed id", async () => {
      const { token } = await createTestUser();
      const res = await request(app)
        .delete(`/api/posts/${MALFORMED_ID}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 401 without auth", async () => {
      const res = await request(app).delete(`/api/posts/${ABSENT_POST_ID}`);
      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/posts/:id/like ──────────────────────────────────────────────

  describe("POST /api/posts/:id/like", () => {
    it("likes a post and records the like", async () => {
      const { token, user } = await createTestUser();
      const post = await createPost(token, { content: "likeable" });

      const res = await request(app)
        .post(`/api/posts/${post.id}/like`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Post liked");

      const like = await prisma.like.findUnique({
        where: { postId_userId: { postId: post.id, userId: user.id } },
      });
      expect(like).not.toBeNull();
    });

    it("is idempotent (liking twice does not error or duplicate)", async () => {
      const { token, user } = await createTestUser();
      const post = await createPost(token, { content: "likeable" });

      await request(app)
        .post(`/api/posts/${post.id}/like`)
        .set("Authorization", `Bearer ${token}`);
      const second = await request(app)
        .post(`/api/posts/${post.id}/like`)
        .set("Authorization", `Bearer ${token}`);

      expect(second.status).toBe(200);
      const count = await prisma.like.count({
        where: { postId: post.id, userId: user.id },
      });
      expect(count).toBe(1);
    });

    it("returns 404 for a non-existent post", async () => {
      const { token } = await createTestUser();
      const res = await request(app)
        .post(`/api/posts/${ABSENT_POST_ID}/like`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("returns 400 for a malformed id", async () => {
      const { token } = await createTestUser();
      const res = await request(app)
        .post(`/api/posts/${MALFORMED_ID}/like`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 401 without auth", async () => {
      const res = await request(app).post(`/api/posts/${ABSENT_POST_ID}/like`);
      expect(res.status).toBe(401);
    });
  });

  // ─── DELETE /api/posts/:id/like ────────────────────────────────────────────

  describe("DELETE /api/posts/:id/like", () => {
    it("unlikes a previously liked post", async () => {
      const { token, user } = await createTestUser();
      const post = await createPost(token, { content: "likeable" });

      await request(app)
        .post(`/api/posts/${post.id}/like`)
        .set("Authorization", `Bearer ${token}`);

      const res = await request(app)
        .delete(`/api/posts/${post.id}/like`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Post unliked");

      const like = await prisma.like.findUnique({
        where: { postId_userId: { postId: post.id, userId: user.id } },
      });
      expect(like).toBeNull();
    });

    it("succeeds (200) even when no like exists (deleteMany is a no-op)", async () => {
      const { token } = await createTestUser();
      const post = await createPost(token, { content: "never liked" });

      const res = await request(app)
        .delete(`/api/posts/${post.id}/like`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Post unliked");
    });

    it("returns 400 for a malformed id", async () => {
      const { token } = await createTestUser();
      const res = await request(app)
        .delete(`/api/posts/${MALFORMED_ID}/like`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 401 without auth", async () => {
      const res = await request(app).delete(`/api/posts/${ABSENT_POST_ID}/like`);
      expect(res.status).toBe(401);
    });
  });

  // ─── GET /api/posts/:id/comments ───────────────────────────────────────────

  describe("GET /api/posts/:id/comments", () => {
    it("lists comments for a post", async () => {
      const { token } = await createTestUser();
      const post = await createPost(token, { content: "commentable" });
      await request(app)
        .post(`/api/posts/${post.id}/comments`)
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "first comment" });

      const res = await request(app)
        .get(`/api/posts/${post.id}/comments`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.comments)).toBe(true);
      expect(res.body.data.comments).toHaveLength(1);
      expect(res.body.data.comments[0].content).toBe("first comment");
      expect(res.body.data).toHaveProperty("hasMore", false);
    });

    it("returns an empty list for a post with no comments", async () => {
      const { token } = await createTestUser();
      const post = await createPost(token, { content: "no comments" });

      const res = await request(app)
        .get(`/api/posts/${post.id}/comments`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.comments).toHaveLength(0);
    });

    it("returns 400 for a malformed id", async () => {
      const { token } = await createTestUser();
      const res = await request(app)
        .get(`/api/posts/${MALFORMED_ID}/comments`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 401 without auth", async () => {
      const res = await request(app).get(
        `/api/posts/${ABSENT_POST_ID}/comments`,
      );
      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/posts/:id/comments ──────────────────────────────────────────

  describe("POST /api/posts/:id/comments", () => {
    it("adds a comment to a post (201) and persists it", async () => {
      const { token, user } = await createTestUser();
      const post = await createPost(token, { content: "commentable" });

      const res = await request(app)
        .post(`/api/posts/${post.id}/comments`)
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "Great post!" });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.content).toBe("Great post!");
      expect(res.body.data.author.id).toBe(user.id);

      const inDb = await prisma.comment.findUnique({
        where: { id: res.body.data.id },
      });
      expect(inDb).not.toBeNull();
      expect(inDb?.postId).toBe(post.id);
    });

    it("returns 404 for a non-existent post", async () => {
      const { token } = await createTestUser();
      const res = await request(app)
        .post(`/api/posts/${ABSENT_POST_ID}/comments`)
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "ghost comment" });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("returns 400 for an empty comment body", async () => {
      const { token } = await createTestUser();
      const post = await createPost(token, { content: "commentable" });

      const res = await request(app)
        .post(`/api/posts/${post.id}/comments`)
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 for a malformed id", async () => {
      const { token } = await createTestUser();
      const res = await request(app)
        .post(`/api/posts/${MALFORMED_ID}/comments`)
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "hi" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 401 without auth", async () => {
      const res = await request(app)
        .post(`/api/posts/${ABSENT_POST_ID}/comments`)
        .send({ content: "hi" });
      expect(res.status).toBe(401);
    });
  });

  // ─── DELETE /api/posts/:id/comments/:commentId ─────────────────────────────

  describe("DELETE /api/posts/:id/comments/:commentId", () => {
    async function createComment(postId: string, token: string, content: string) {
      const res = await request(app)
        .post(`/api/posts/${postId}/comments`)
        .set("Authorization", `Bearer ${token}`)
        .send({ content });
      expect(res.status).toBe(201);
      return res.body.data.id as string;
    }

    it("lets the comment author delete it", async () => {
      const { token } = await createTestUser();
      const post = await createPost(token, { content: "commentable" });
      const commentId = await createComment(post.id, token, "delete me");

      const res = await request(app)
        .delete(`/api/posts/${post.id}/comments/${commentId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Comment deleted");

      const inDb = await prisma.comment.findUnique({ where: { id: commentId } });
      expect(inDb).toBeNull();
    });

    it("returns 403 when a non-author tries to delete the comment", async () => {
      const author = await createTestUser();
      const post = await createPost(author.token, { content: "commentable" });
      const commentId = await createComment(post.id, author.token, "owned comment");
      const other = await createTestUser();

      const res = await request(app)
        .delete(`/api/posts/${post.id}/comments/${commentId}`)
        .set("Authorization", `Bearer ${other.token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 404 for a non-existent comment", async () => {
      const { token } = await createTestUser();
      const post = await createPost(token, { content: "commentable" });

      const res = await request(app)
        .delete(`/api/posts/${post.id}/comments/${ABSENT_COMMENT_ID}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("returns 401 without auth", async () => {
      const res = await request(app).delete(
        `/api/posts/${ABSENT_POST_ID}/comments/${ABSENT_COMMENT_ID}`,
      );
      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/posts/reports (create a report) ─────────────────────────────

  describe("POST /api/posts/reports", () => {
    it("reports a post (201) and persists the report", async () => {
      const author = await createTestUser();
      const post = await createPost(author.token, { content: "reportable" });
      const reporter = await createTestUser();

      const res = await request(app)
        .post("/api/posts/reports")
        .set("Authorization", `Bearer ${reporter.token}`)
        .send({
          type: "post",
          title: "Inappropriate content",
          description: "This post violates the guidelines",
          reportedItemId: post.id,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Report submitted successfully");
      expect(res.body.data.status).toBe("pending");
      expect(res.body.data.type).toBe("post");

      const inDb = await prisma.report.findFirst({
        where: { reporterId: reporter.user.id, reportedItemId: post.id },
      });
      expect(inDb).not.toBeNull();
    });

    it("returns 404 when the reported post does not exist", async () => {
      const reporter = await createTestUser();
      const res = await request(app)
        .post("/api/posts/reports")
        .set("Authorization", `Bearer ${reporter.token}`)
        .send({
          type: "post",
          title: "Missing target",
          reportedItemId: ABSENT_POST_ID,
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("RESOURCE_NOT_FOUND");
    });

    it("returns 409 when the same user reports the same content twice", async () => {
      const author = await createTestUser();
      const post = await createPost(author.token, { content: "reportable" });
      const reporter = await createTestUser();
      const body = {
        type: "post" as const,
        title: "Inappropriate content",
        reportedItemId: post.id,
      };

      const first = await request(app)
        .post("/api/posts/reports")
        .set("Authorization", `Bearer ${reporter.token}`)
        .send(body);
      expect(first.status).toBe(201);

      const second = await request(app)
        .post("/api/posts/reports")
        .set("Authorization", `Bearer ${reporter.token}`)
        .send(body);

      expect(second.status).toBe(409);
      expect(second.body.error.code).toBe("DUPLICATE_ENTRY");
    });

    it("returns 400 for an invalid report body (missing title)", async () => {
      const reporter = await createTestUser();
      const res = await request(app)
        .post("/api/posts/reports")
        .set("Authorization", `Bearer ${reporter.token}`)
        .send({ type: "post", reportedItemId: ABSENT_POST_ID });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 for an invalid report type", async () => {
      const reporter = await createTestUser();
      const res = await request(app)
        .post("/api/posts/reports")
        .set("Authorization", `Bearer ${reporter.token}`)
        .send({ type: "spaceship", title: "bad type", reportedItemId: ABSENT_POST_ID });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 401 without auth", async () => {
      const res = await request(app)
        .post("/api/posts/reports")
        .send({ type: "post", title: "x", reportedItemId: ABSENT_POST_ID });
      expect(res.status).toBe(401);
    });
  });

  // ─── Full flow ─────────────────────────────────────────────────────────────

  describe("full post flow", () => {
    it("create -> like -> comment -> update -> delete (counts reflected)", async () => {
      const { token } = await createTestUser();

      // 1. Create
      const post = await createPost(token, { content: "flow post" });

      // 2. Like
      const liked = await request(app)
        .post(`/api/posts/${post.id}/like`)
        .set("Authorization", `Bearer ${token}`);
      expect(liked.status).toBe(200);

      // 3. Comment
      const commented = await request(app)
        .post(`/api/posts/${post.id}/comments`)
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "nice flow" });
      expect(commented.status).toBe(201);

      // Counts reflected on the detail endpoint.
      const detail = await request(app)
        .get(`/api/posts/${post.id}`)
        .set("Authorization", `Bearer ${token}`);
      expect(detail.body.data.likesCount).toBe(1);
      expect(detail.body.data.commentsCount).toBe(1);
      expect(detail.body.data.isLiked).toBe(true);

      // 4. Update
      const updated = await request(app)
        .patch(`/api/posts/${post.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "flow post (edited)" });
      expect(updated.status).toBe(200);
      expect(updated.body.data.content).toBe("flow post (edited)");

      // 5. Delete (cascades likes + comments via Prisma onDelete: Cascade)
      const deleted = await request(app)
        .delete(`/api/posts/${post.id}`)
        .set("Authorization", `Bearer ${token}`);
      expect(deleted.status).toBe(200);

      const gone = await request(app)
        .get(`/api/posts/${post.id}`)
        .set("Authorization", `Bearer ${token}`);
      expect(gone.status).toBe(404);
    });
  });
});
