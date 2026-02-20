import { Router, Request, Response } from "express";
import prisma from "../lib/prisma.js";
import { requireAuth } from "../config/auth.js";
import { ApiResponse, ErrorCode } from "../lib/utils/apiResponse.js";
import {
  validateBody,
  validateParams,
  asyncHandler,
} from "../middlewares/validation.js";
import { idParamSchema } from "../validators/schemas.js";
import { z } from "zod";

const router = Router();

// All feed routes require authentication
router.use(requireAuth);

// Validation schemas
const createPostSchema = z.object({
  content: z.string().min(1).max(2000),
  type: z
    .enum(["ride", "content", "listing", "club-activity"])
    .optional()
    .default("content"),
  images: z.array(z.string().url()).optional().default([]),
});

const createCommentSchema = z.object({
  content: z.string().min(1).max(500),
});

/**
 * @swagger
 * /api/feed:
 *   get:
 *     summary: Get feed posts
 *     description: Get paginated feed posts from followed users and clubs
 *     tags: [Feed]
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: List of feed posts
 */
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const session = (req as any).session;
    const page = parseInt(req.query.page as string) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    // Get posts from users the current user follows + their own posts
    const following = await prisma.follow.findMany({
      where: { followerId: session.user.id },
      select: { followingId: true },
    });

    const followingIds = following.map((f) => f.followingId);
    const userIds = [session.user.id, ...followingIds];

    const posts = await prisma.post.findMany({
      where: {
        authorId: { in: userIds },
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
        _count: {
          select: { likes: true, comments: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit + 1,
    });

    const hasMore = posts.length > limit;
    const resultPosts = hasMore ? posts.slice(0, limit) : posts;

    // Get like status for current user
    const postIds = resultPosts.map((p) => p.id);
    const userLikes = await prisma.like.findMany({
      where: {
        postId: { in: postIds },
        userId: session.user.id,
      },
      select: { postId: true },
    });
    const likedPostIds = new Set(userLikes.map((l) => l.postId));

    const enrichedPosts = resultPosts.map((post) => ({
      id: post.id,
      type: post.type,
      author: {
        id: post.author.id,
        name: post.author.name,
        username: post.author.username,
        avatar: post.author.avatar,
        clubs: [],
      },
      content: post.content,
      images: post.images,
      likesCount: post._count.likes,
      commentsCount: post._count.comments,
      isLiked: likedPostIds.has(post.id),
      isSaved: false,
      createdAt: post.createdAt.toISOString(),
    }));

    ApiResponse.success(res, { posts: enrichedPosts, hasMore });
  }),
);

/**
 * @swagger
 * /api/posts:
 *   post:
 *     summary: Create a new post
 *     tags: [Feed]
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *               type:
 *                 type: string
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Post created
 */
router.post(
  "/posts",
  validateBody(createPostSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const session = (req as any).session;
    const { content, type, images } = req.body;

    const post = await prisma.post.create({
      data: {
        content,
        type,
        images,
        authorId: session.user.id,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    ApiResponse.created(res, post);
  }),
);

/**
 * @swagger
 * /api/posts/{id}:
 *   get:
 *     summary: Get a single post
 *     tags: [Feed]
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 */
router.get(
  "/posts/:id",
  validateParams(idParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const session = (req as any).session;
    const { id } = req.params;

    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
        _count: {
          select: { likes: true, comments: true },
        },
      },
    });

    if (!post) {
      return ApiResponse.notFound(res, "Post not found");
    }

    // Check if user liked this post
    const userLike = await prisma.like.findUnique({
      where: { postId_userId: { userId: session.user.id, postId: id } },
    });

    const enrichedPost = {
      ...post,
      likesCount: post._count.likes,
      commentsCount: post._count.comments,
      isLiked: !!userLike,
      isSaved: false,
    };

    ApiResponse.success(res, enrichedPost);
  }),
);

/**
 * @swagger
 * /api/posts/{id}:
 *   patch:
 *     summary: Update a post
 *     tags: [Feed]
 */
router.patch(
  "/posts/:id",
  validateParams(idParamSchema),
  validateBody(createPostSchema.partial()),
  asyncHandler(async (req: Request, res: Response) => {
    const session = (req as any).session;
    const { id } = req.params;
    const { content, images } = req.body;

    const post = await prisma.post.findUnique({
      where: { id },
      select: { authorId: true },
    });

    if (!post) {
      return ApiResponse.notFound(res, "Post not found");
    }

    if (post.authorId !== session.user.id) {
      return ApiResponse.forbidden(res, "You can only edit your own posts");
    }

    const updated = await prisma.post.update({
      where: { id },
      data: { content, images },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    ApiResponse.success(res, updated);
  }),
);

/**
 * @swagger
 * /api/posts/{id}:
 *   delete:
 *     summary: Delete a post
 *     tags: [Feed]
 */
router.delete(
  "/posts/:id",
  validateParams(idParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const session = (req as any).session;
    const { id } = req.params;

    const post = await prisma.post.findUnique({
      where: { id },
      select: { authorId: true },
    });

    if (!post) {
      return ApiResponse.notFound(res, "Post not found");
    }

    if (post.authorId !== session.user.id) {
      return ApiResponse.forbidden(res, "You can only delete your own posts");
    }

    await prisma.post.delete({ where: { id } });

    ApiResponse.success(res, null, "Post deleted");
  }),
);

/**
 * @swagger
 * /api/posts/{id}/like:
 *   post:
 *     summary: Like a post
 *     tags: [Feed]
 */
router.post(
  "/posts/:id/like",
  validateParams(idParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const session = (req as any).session;
    const { id } = req.params;

    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) {
      return ApiResponse.notFound(res, "Post not found");
    }

    await prisma.like.upsert({
      where: { postId_userId: { userId: session.user.id, postId: id } },
      create: { userId: session.user.id, postId: id },
      update: {},
    });

    ApiResponse.success(res, null, "Post liked");
  }),
);

/**
 * @swagger
 * /api/posts/{id}/like:
 *   delete:
 *     summary: Unlike a post
 *     tags: [Feed]
 */
router.delete(
  "/posts/:id/like",
  validateParams(idParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const session = (req as any).session;
    const { id } = req.params;

    await prisma.like.deleteMany({
      where: { userId: session.user.id, postId: id },
    });

    ApiResponse.success(res, null, "Post unliked");
  }),
);

/**
 * @swagger
 * /api/posts/{id}/comments:
 *   get:
 *     summary: Get comments on a post
 *     tags: [Feed]
 */
router.get(
  "/posts/:id/comments",
  validateParams(idParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    const comments = await prisma.comment.findMany({
      where: { postId: id },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit + 1,
    });

    const hasMore = comments.length > limit;
    const resultComments = hasMore ? comments.slice(0, limit) : comments;

    ApiResponse.success(res, {
      comments: resultComments.map((c) => ({
        id: c.id,
        content: c.content,
        author: c.author,
        createdAt: c.createdAt.toISOString(),
      })),
      hasMore,
    });
  }),
);

/**
 * @swagger
 * /api/posts/{id}/comments:
 *   post:
 *     summary: Add a comment to a post
 *     tags: [Feed]
 */
router.post(
  "/posts/:id/comments",
  validateParams(idParamSchema),
  validateBody(createCommentSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const session = (req as any).session;
    const { id } = req.params;
    const { content } = req.body;

    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) {
      return ApiResponse.notFound(res, "Post not found");
    }

    const comment = await prisma.comment.create({
      data: {
        content,
        postId: id,
        authorId: session.user.id,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    ApiResponse.created(res, {
      id: comment.id,
      content: comment.content,
      author: comment.author,
      createdAt: comment.createdAt.toISOString(),
    });
  }),
);

/**
 * @swagger
 * /api/posts/{id}/comments/{commentId}:
 *   delete:
 *     summary: Delete a comment
 *     tags: [Feed]
 */
router.delete(
  "/posts/:id/comments/:commentId",
  asyncHandler(async (req: Request, res: Response) => {
    const session = (req as any).session;
    const { commentId } = req.params;

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { authorId: true },
    });

    if (!comment) {
      return ApiResponse.notFound(res, "Comment not found");
    }

    if (comment.authorId !== session.user.id) {
      return ApiResponse.forbidden(
        res,
        "You can only delete your own comments",
      );
    }

    await prisma.comment.delete({ where: { id: commentId } });

    ApiResponse.success(res, null, "Comment deleted");
  }),
);

export default router;
