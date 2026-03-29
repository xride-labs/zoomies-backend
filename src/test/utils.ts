/**
 * SHARED TEST UTILITIES
 * Common utilities, mocks, and helpers for all route tests
 * Import this in every test file
 */

import request from "supertest";
import { app } from "../../server";
import prisma from "../../lib/prisma.js";
import jwt from "jsonwebtoken";

// ─────────────────────────────────────────────────────────────────────────────
// SESSION / TOKEN UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a mock session token for testing
 */
export function createMockToken(userId: string, expiresIn = "7d") {
  return jwt.sign(
    { userId, iat: Math.floor(Date.now() / 1000) },
    process.env.JWT_SECRET || "test-secret",
    { expiresIn },
  );
}

/**
 * Create a test user and return authenticated request helper
 */
export async function createTestUser(userData?: Partial<any>) {
  const defaultUser = {
    username: `testuser_${Date.now()}`,
    email: `test_${Date.now()}@example.com`,
    name: "Test User",
    emailVerified: true,
    phone: `+1${Math.random().toString().slice(2, 12)}`,
    phoneVerified: true,
  };

  const user = await prisma.user.create({
    data: {
      ...defaultUser,
      ...userData,
    },
  });

  // Create a session for this user
  const token = createMockToken(user.id);

  return {
    user,
    token,
    authenticated: (req: any) => req.set("Authorization", `Bearer ${token}`),
  };
}

/**
 * Create a ride for testing
 */
export async function createTestRide(
  creatorId: string,
  rideData?: Partial<any>,
) {
  const defaultRide = {
    title: "Test Ride",
    description: "A test ride",
    startLocation: "Starting Point",
    endLocation: "Ending Point",
    experienceLevel: "INTERMEDIATE",
    pace: "Moderate",
    distance: 50,
    duration: 180,
    scheduledAt: new Date(Date.now() + 86400000), // Tomorrow
    latitude: 40.7128,
    longitude: -74.006,
    creatorId,
  };

  return prisma.ride.create({
    data: {
      ...defaultRide,
      ...rideData,
    },
  });
}

/**
 * Create a club for testing
 */
export async function createTestClub(ownerId: string, clubData?: Partial<any>) {
  const defaultClub = {
    name: `Test Club ${Date.now()}`,
    description: "A test club",
    location: "Test City",
    isPublic: true,
    latitude: 40.7128,
    longitude: -74.006,
    ownerId,
  };

  return prisma.club.create({
    data: {
      ...defaultClub,
      ...clubData,
    },
  });
}

/**
 * Create a marketplace listing for testing
 */
export async function createTestListing(
  sellerId: string,
  listingData?: Partial<any>,
) {
  const defaultListing = {
    title: "Test Item",
    description: "A test marketplace item",
    price: 999.99,
    category: "Motorcycle",
    condition: "Good",
    status: "ACTIVE",
    latitude: 40.7128,
    longitude: -74.006,
    sellerId,
  };

  return prisma.marketplaceListing.create({
    data: {
      ...defaultListing,
      ...listingData,
    },
  });
}

/**
 * Add user to a club
 */
export async function addUserToClub(
  userId: string,
  clubId: string,
  role = "MEMBER",
) {
  return prisma.clubMember.create({
    data: {
      userId,
      clubId,
      role,
    },
  });
}

/**
 * Add user as ride participant
 */
export async function addRideParticipant(
  userId: string,
  rideId: string,
  status = "ACCEPTED",
) {
  return prisma.rideParticipant.create({
    data: {
      userId,
      rideId,
      status,
    },
  });
}

/**
 * Create admin user
 */
export async function createAdminUser(userData?: Partial<any>) {
  const admin = await createTestUser(userData);

  // Assign ADMIN role
  await prisma.userRoleAssignment.create({
    data: {
      userId: admin.user.id,
      role: "ADMIN",
    },
  });

  return admin;
}

// ─────────────────────────────────────────────────────────────────────────────
// ASSERTION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Assert valid paginated response
 */
export function assertValidPaginatedResponse(body: any) {
  expect(body).toHaveProperty("data");
  expect(body.pagination).toEqual({
    page: expect.any(Number),
    limit: expect.any(Number),
    total: expect.any(Number),
    totalPages: expect.any(Number),
  });
}

/**
 * Assert valid single resource response
 */
export function assertValidSuccessResponse(body: any, expectedDataKey: string) {
  expect(body).toHaveProperty("success", true);
  expect(body).toHaveProperty("data");
  expect(body.data).toHaveProperty(expectedDataKey);
}

/**
 * Assert valid error response
 */
export function assertValidErrorResponse(body: any, expectedStatus: number) {
  expect(body).toHaveProperty("success", false);
  expect(body).toHaveProperty("error");
  expect(body).toHaveProperty("statusCode", expectedStatus);
}

// ─────────────────────────────────────────────────────────────────────────────
// CLEANUP UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Clean up all test data
 */
export async function cleanupTestData() {
  // Delete in order to avoid foreign key constraints
  await prisma.rideParticipant.deleteMany({});
  await prisma.ride.deleteMany({});
  await prisma.clubMember.deleteMany({});
  await prisma.clubJoinRequest.deleteMany({});
  await prisma.club.deleteMany({});
  await prisma.review.deleteMany({});
  await prisma.marketplaceListing.deleteMany({});
  await prisma.userRoleAssignment.deleteMany({});
  await prisma.user.deleteMany({});
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA GENERATORS
// ─────────────────────────────────────────────────────────────────────────────

export const mockRideData = {
  valid: {
    title: "Scenic Mountain Ride",
    description: "Beautiful 50km ride through the mountains",
    startLocation: "Downtown",
    endLocation: "Mountain Peak",
    experienceLevel: "INTERMEDIATE",
    pace: "Moderate",
    distance: 50,
    duration: 240,
    scheduledAt: new Date(Date.now() + 86400000).toISOString(),
  },
  invalid: {
    title: "", // Invalid - empty title
    description: "Test",
    startLocation: "",
  },
};

export const mockClubData = {
  valid: {
    name: "Mountain Bikers United",
    description: "A club for mountain biking enthusiasts",
    location: "Colorado",
    clubType: "Riding Club",
    isPublic: true,
  },
  invalid: {
    name: "", // Invalid - empty name
    description: "",
  },
};

export const mockListingData = {
  valid: {
    title: "Mountain Bike - Excellent Condition",
    description: "2022 Trek mountain bike",
    price: 1200,
    category: "Motorcycle",
    condition: "Excellent",
  },
  invalid: {
    title: "", // Invalid - empty title
    price: -100, // Invalid - negative price
  },
};

export const mockUserData = {
  valid: {
    username: `testuser_${Date.now()}`,
    email: `test_${Date.now()}@example.com`,
    name: "John Doe",
    bio: "Motorcycle enthusiast",
    location: "San Francisco",
    phone: "+1234567890",
  },
  invalid: {
    email: "invalid-email", // Invalid email format
    username: "", // Invalid - empty username
  },
};
