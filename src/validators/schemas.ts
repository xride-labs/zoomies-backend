import { z } from "zod";

// ========================================
// Common Schemas
// ========================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const idParamSchema = z.object({
  id: z.string().cuid("Invalid ID format"),
});

// ========================================
// Auth Schemas
// ========================================

export const registerSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

export const sendOtpSchema = z.object({
  phone: z
    .string()
    .min(10, "Phone number must be at least 10 digits")
    .regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format (E.164)"),
});

export const verifyOtpSchema = z.object({
  phone: z
    .string()
    .min(10, "Phone number must be at least 10 digits")
    .regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format"),
  otp: z
    .string()
    .length(6, "OTP must be 6 digits")
    .regex(/^\d+$/, "OTP must contain only digits"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email format"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

export const verifyEmailSchema = z.object({
  email: z.string().email("Invalid email format"),
  token: z.string().min(1, "Token is required"),
});

// ========================================
// User Schemas
// ========================================

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  bio: z.string().max(500).optional(),
  location: z.string().max(200).optional(),
  bikeType: z.string().max(100).optional(),
  bikeOwned: z.string().max(200).optional(),
  experienceLevel: z.enum(["Beginner", "Intermediate", "Expert"]).optional(),
  levelOfActivity: z.enum(["Casual", "Regular", "Enthusiast"]).optional(),
  bloodType: z
    .enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"])
    .optional(),
});

export const updateUserSchema = updateProfileSchema.extend({
  email: z.string().email("Invalid email format").optional(),
  username: z.string().min(2).max(50).optional(),
  image: z.string().url("Invalid image URL").optional(),
  phone: z.string().min(10).max(20).optional(),
});

export const userQuerySchema = paginationSchema.extend({
  role: z.enum(["ADMIN", "USER", "RIDER", "SELLER"]).optional(),
  search: z.string().optional(),
});

// ========================================
// Ride Schemas
// ========================================

export const createRideSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(200),
  description: z.string().max(2000).optional(),
  startLocation: z.string().min(1, "Start location is required").max(500),
  endLocation: z.string().max(500).optional(),
  experienceLevel: z.enum(["Beginner", "Intermediate", "Expert"]).optional(),
  xpRequired: z.number().int().min(0).optional(),
  pace: z.enum(["Leisurely", "Moderate", "Fast"]).optional(),
  distance: z.number().positive("Distance must be positive").optional(),
  duration: z.number().int().positive("Duration must be positive").optional(),
  scheduledAt: z.string().datetime().optional().or(z.date()),
  keepPermanently: z.boolean().default(false), // Flag to prevent auto-deletion
});

export const updateRideSchema = createRideSchema.partial();

export const rideQuerySchema = paginationSchema.extend({
  status: z
    .enum(["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"])
    .optional(),
  experienceLevel: z.enum(["Beginner", "Intermediate", "Expert"]).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const joinRideSchema = z.object({
  message: z.string().max(500).optional(),
});

export const updateParticipantStatusSchema = z.object({
  status: z.enum(["ACCEPTED", "DECLINED", "CANCELLED"]),
});

// ========================================
// Club Schemas
// ========================================

export const createClubSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(200),
  description: z.string().max(2000).optional(),
  location: z.string().max(500).optional(),
  clubType: z.string().max(100).optional(),
  isPublic: z.boolean().default(true),
  image: z.string().url("Invalid image URL").optional(),
  coverImage: z.string().url("Invalid cover image URL").optional(),
});

export const updateClubSchema = createClubSchema.partial();

export const clubQuerySchema = paginationSchema.extend({
  isPublic: z.coerce.boolean().optional(),
  verified: z.coerce.boolean().optional(),
  search: z.string().optional(),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(["MEMBER", "OFFICER", "ADMIN"]),
});

// ========================================
// Marketplace Schemas
// ========================================

export const createListingSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(200),
  description: z.string().max(5000).optional(),
  price: z.number().positive("Price must be positive"),
  currency: z
    .string()
    .length(3, "Currency must be 3 characters")
    .default("INR"),
  images: z.array(z.string().url("Invalid image URL")).max(10).optional(),
  category: z
    .enum(["Motorcycle", "Gear", "Accessories", "Parts", "Other"])
    .optional(),
  subcategory: z.string().max(100).optional(),
  specifications: z.string().max(2000).optional(), // JSON string
  condition: z.enum(["New", "Like New", "Good", "Fair", "Poor"]).optional(),
});

export const updateListingSchema = createListingSchema.partial().extend({
  status: z.enum(["ACTIVE", "SOLD", "INACTIVE"]).optional(),
});

export const listingQuerySchema = paginationSchema.extend({
  category: z.string().optional(),
  minPrice: z.coerce.number().positive().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  condition: z.string().optional(),
  status: z.enum(["ACTIVE", "SOLD", "INACTIVE"]).optional(),
});

export const createReviewSchema = z.object({
  rating: z
    .number()
    .min(1, "Rating must be at least 1")
    .max(5, "Rating must be at most 5"),
  comment: z.string().max(1000).optional(),
});

// ========================================
// Post/Feed Schemas
// ========================================

export const createPostSchema = z.object({
  type: z.enum(["ride", "content", "listing", "club-activity"]),
  content: z.string().max(5000).optional(),
  images: z.array(z.string().url("Invalid image URL")).max(10).optional(),
  rideId: z.string().cuid().optional(),
  listingId: z.string().cuid().optional(),
  clubId: z.string().cuid().optional(),
});

export const updatePostSchema = createPostSchema.partial();

export const postQuerySchema = paginationSchema.extend({
  type: z.enum(["ride", "content", "listing", "club-activity"]).optional(),
  authorId: z.string().cuid().optional(),
});

export const createCommentSchema = z.object({
  content: z.string().min(1, "Comment cannot be empty").max(1000),
});

// ========================================
// Media Upload Schemas
// ========================================

export const uploadMediaSchema = z.object({
  type: z.enum(["image", "video"]),
  folder: z.enum(["profiles", "clubs", "rides", "listings", "posts"]),
});

// ========================================
// Admin Schemas
// ========================================

export const updateUserRoleSchema = z.object({
  role: z.enum([
    "ADMIN",
    "USER",
    "RIDER",
    "SELLER",
    "CLUB_OWNER",
    "SUPER_ADMIN",
  ]),
});

export const adminStatsQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  granularity: z.enum(["day", "week", "month"]).default("day"),
});

// Type exports
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type SendOtpInput = z.infer<typeof sendOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreateRideInput = z.infer<typeof createRideSchema>;
export type UpdateRideInput = z.infer<typeof updateRideSchema>;
export type CreateClubInput = z.infer<typeof createClubSchema>;
export type UpdateClubInput = z.infer<typeof updateClubSchema>;
export type CreateListingInput = z.infer<typeof createListingSchema>;
export type UpdateListingInput = z.infer<typeof updateListingSchema>;
export type CreatePostInput = z.infer<typeof createPostSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type CreateReviewInput = z.infer<typeof createReviewSchema>;
