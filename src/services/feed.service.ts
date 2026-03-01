/**
 * Discovery Feed Service
 *
 * Location-first feed engine that ranks and returns nearby rides, clubs,
 * and marketplace listings.  Designed for Phase 1 (no social graph).
 *
 * Scoring formula:
 *   ride_score  = w_distance * (1 - dist/radius) + w_participants * norm(participants)
 *                + w_freshness * freshness + w_upcoming * upcoming_bonus
 *   club_score  = w_distance * (1 - dist/radius) + w_members * norm(memberCount)
 *                + w_activity * activityBonus + w_new * newBonus
 *
 * Future-ready: scoring weights are configurable constants that can later
 * be driven by a recommendation / personalisation engine.
 */

import prisma from "../lib/prisma.js";
import { haversineDistance, boundingBox } from "../lib/utils/geo.js";

// ──────────────── Types ────────────────
export interface FeedQuery {
  lat: number;
  lng: number;
  radiusKm?: number;
  page?: number;
  limit?: number;
  // Optional ride filters
  rideType?: string; // experienceLevel
  difficulty?: string; // pace
  upcomingOnly?: boolean;
}

export interface FeedItem<T = unknown> {
  /** Distance from user in km, rounded to 1 decimal */
  distanceKm: number;
  /** Internal ranking score (higher = more relevant) */
  score: number;
  data: T;
}

export interface DiscoveryFeedResult {
  nearbyRides: FeedItem[];
  upcomingRides: FeedItem[];
  clubsNearYou: FeedItem[];
  newClubs: FeedItem[];
  /** Marketplace listings near the user (when available) */
  nearbyListings: FeedItem[];
}

// ──────────────── Scoring weights ────────────────
// Easily tuneable—move to env / config in future phases

const RIDE_WEIGHTS = {
  distance: 0.4,
  participants: 0.2,
  freshness: 0.2,
  upcoming: 0.2,
} as const;

const CLUB_WEIGHTS = {
  distance: 0.35,
  members: 0.25,
  activity: 0.2,
  newness: 0.2,
} as const;

// ──────────────── Normalisation helpers ────────────────

/** Clamp to [0, 1] */
function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** Normalise distance: closer = higher score */
function distanceScore(distKm: number, radiusKm: number): number {
  return clamp01(1 - distKm / radiusKm);
}

/** Normalise participant count (log scale, cap at ~50 riders) */
function participantScore(count: number): number {
  if (count <= 0) return 0;
  return clamp01(Math.log10(count + 1) / Math.log10(51));
}

/** Freshness score: rides created within the last 7 days get higher scores */
function freshnessScore(createdAt: Date): number {
  const ageMs = Date.now() - createdAt.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return clamp01(1 - ageDays / 7);
}

/** Upcoming bonus: rides scheduled within the next 48 h get a boost */
function upcomingScore(scheduledAt: Date | null): number {
  if (!scheduledAt) return 0;
  const msUntil = scheduledAt.getTime() - Date.now();
  if (msUntil < 0) return 0; // already started / past
  const hoursUntil = msUntil / (1000 * 60 * 60);
  return clamp01(1 - hoursUntil / 48);
}

/** Club member score (log scale, cap at ~500) */
function memberCountScore(count: number): number {
  if (count <= 0) return 0;
  return clamp01(Math.log10(count + 1) / Math.log10(501));
}

/** Newness bonus: clubs created within the last 14 days */
function newnessScore(createdAt: Date): number {
  const ageDays = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
  return clamp01(1 - ageDays / 14);
}

// ──────────────── Core query functions ────────────────

async function queryNearbyRides(q: FeedQuery) {
  const radiusKm = q.radiusKm ?? 50;
  const limit = q.limit ?? 20;
  const page = q.page ?? 1;
  const skip = (page - 1) * limit;

  const bbox = boundingBox(q.lat, q.lng, radiusKm);

  // Build Prisma where clause
  const where: any = {
    latitude: { not: null, gte: bbox.minLat, lte: bbox.maxLat },
    longitude: { not: null, gte: bbox.minLng, lte: bbox.maxLng },
    status: { in: ["PLANNED", "IN_PROGRESS"] },
  };

  if (q.rideType) where.experienceLevel = q.rideType;
  if (q.difficulty) where.pace = q.difficulty;
  if (q.upcomingOnly) where.scheduledAt = { gte: new Date() };

  const rides = await prisma.ride.findMany({
    where,
    include: {
      creator: { select: { id: true, name: true, avatar: true } },
      _count: { select: { participants: true } },
    },
    orderBy: { createdAt: "desc" },
    // Fetch more than limit so we can score & re-rank in-memory
    take: limit * 3,
  });

  // Score & filter by precise Haversine distance
  const scored: FeedItem[] = [];

  for (const ride of rides) {
    if (ride.latitude == null || ride.longitude == null) continue;

    const dist = haversineDistance(q.lat, q.lng, ride.latitude, ride.longitude);
    if (dist > radiusKm) continue;

    const score =
      RIDE_WEIGHTS.distance * distanceScore(dist, radiusKm) +
      RIDE_WEIGHTS.participants * participantScore(ride._count.participants) +
      RIDE_WEIGHTS.freshness * freshnessScore(ride.createdAt) +
      RIDE_WEIGHTS.upcoming * upcomingScore(ride.scheduledAt);

    scored.push({
      distanceKm: Math.round(dist * 10) / 10,
      score: Math.round(score * 1000) / 1000,
      data: ride,
    });
  }

  // Sort by score descending, then paginate
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(skip, skip + limit);
}

async function queryUpcomingRides(q: FeedQuery) {
  const radiusKm = q.radiusKm ?? 50;
  const limit = q.limit ?? 10;
  const page = q.page ?? 1;
  const skip = (page - 1) * limit;

  const bbox = boundingBox(q.lat, q.lng, radiusKm);

  const rides = await prisma.ride.findMany({
    where: {
      latitude: { not: null, gte: bbox.minLat, lte: bbox.maxLat },
      longitude: { not: null, gte: bbox.minLng, lte: bbox.maxLng },
      status: "PLANNED",
      scheduledAt: { gte: new Date() },
    },
    include: {
      creator: { select: { id: true, name: true, avatar: true } },
      _count: { select: { participants: true } },
    },
    orderBy: { scheduledAt: "asc" },
    take: limit * 3,
  });

  const scored: FeedItem[] = [];
  for (const ride of rides) {
    if (ride.latitude == null || ride.longitude == null) continue;
    const dist = haversineDistance(q.lat, q.lng, ride.latitude, ride.longitude);
    if (dist > radiusKm) continue;

    const score =
      RIDE_WEIGHTS.distance * distanceScore(dist, radiusKm) +
      RIDE_WEIGHTS.participants * participantScore(ride._count.participants) +
      RIDE_WEIGHTS.freshness * freshnessScore(ride.createdAt) +
      RIDE_WEIGHTS.upcoming * upcomingScore(ride.scheduledAt);

    scored.push({
      distanceKm: Math.round(dist * 10) / 10,
      score: Math.round(score * 1000) / 1000,
      data: ride,
    });
  }

  // For upcoming, secondary sort by scheduledAt ASC (soonest first)
  scored.sort((a, b) => {
    if (Math.abs(b.score - a.score) > 0.05) return b.score - a.score;
    const aTime = (a.data as any).scheduledAt?.getTime() ?? Infinity;
    const bTime = (b.data as any).scheduledAt?.getTime() ?? Infinity;
    return aTime - bTime;
  });

  return scored.slice(skip, skip + limit);
}

async function queryNearbyClubs(q: FeedQuery) {
  const radiusKm = q.radiusKm ?? 50;
  const limit = q.limit ?? 10;
  const page = q.page ?? 1;
  const skip = (page - 1) * limit;

  const bbox = boundingBox(q.lat, q.lng, radiusKm);

  const clubs = await prisma.club.findMany({
    where: {
      latitude: { not: null, gte: bbox.minLat, lte: bbox.maxLat },
      longitude: { not: null, gte: bbox.minLng, lte: bbox.maxLng },
      isPublic: true,
    },
    include: {
      owner: { select: { id: true, name: true, avatar: true } },
      _count: { select: { members: true } },
    },
    orderBy: { memberCount: "desc" },
    take: limit * 3,
  });

  const scored: FeedItem[] = [];
  for (const club of clubs) {
    if (club.latitude == null || club.longitude == null) continue;
    const dist = haversineDistance(q.lat, q.lng, club.latitude, club.longitude);
    if (dist > radiusKm) continue;

    const score =
      CLUB_WEIGHTS.distance * distanceScore(dist, radiusKm) +
      CLUB_WEIGHTS.members * memberCountScore(club.memberCount) +
      CLUB_WEIGHTS.activity *
        (club.reputation ? clamp01(club.reputation / 5) : 0.3) +
      CLUB_WEIGHTS.newness * newnessScore(club.createdAt);

    scored.push({
      distanceKm: Math.round(dist * 10) / 10,
      score: Math.round(score * 1000) / 1000,
      data: club,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(skip, skip + limit);
}

async function queryNewClubs(q: FeedQuery) {
  const radiusKm = q.radiusKm ?? 50;
  const limit = q.limit ?? 10;

  const bbox = boundingBox(q.lat, q.lng, radiusKm);
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const clubs = await prisma.club.findMany({
    where: {
      latitude: { not: null, gte: bbox.minLat, lte: bbox.maxLat },
      longitude: { not: null, gte: bbox.minLng, lte: bbox.maxLng },
      isPublic: true,
      createdAt: { gte: fourteenDaysAgo },
    },
    include: {
      owner: { select: { id: true, name: true, avatar: true } },
      _count: { select: { members: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit * 2,
  });

  const scored: FeedItem[] = [];
  for (const club of clubs) {
    if (club.latitude == null || club.longitude == null) continue;
    const dist = haversineDistance(q.lat, q.lng, club.latitude, club.longitude);
    if (dist > radiusKm) continue;

    scored.push({
      distanceKm: Math.round(dist * 10) / 10,
      score: Math.round(newnessScore(club.createdAt) * 1000) / 1000,
      data: club,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

async function queryNearbyListings(q: FeedQuery) {
  const radiusKm = q.radiusKm ?? 50;
  const limit = q.limit ?? 10;
  const page = q.page ?? 1;
  const skip = (page - 1) * limit;

  const bbox = boundingBox(q.lat, q.lng, radiusKm);

  const listings = await prisma.marketplaceListing.findMany({
    where: {
      latitude: { not: null, gte: bbox.minLat, lte: bbox.maxLat },
      longitude: { not: null, gte: bbox.minLng, lte: bbox.maxLng },
      status: "ACTIVE",
    },
    include: {
      seller: { select: { id: true, name: true, avatar: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit * 2,
  });

  const results: FeedItem[] = [];
  for (const listing of listings) {
    if (listing.latitude == null || listing.longitude == null) continue;
    const dist = haversineDistance(
      q.lat,
      q.lng,
      listing.latitude,
      listing.longitude,
    );
    if (dist > radiusKm) continue;

    results.push({
      distanceKm: Math.round(dist * 10) / 10,
      score: Math.round(distanceScore(dist, radiusKm) * 1000) / 1000,
      data: listing,
    });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(skip, skip + limit);
}

// ──────────────── Public API ────────────────

/**
 * Fetch the complete discovery feed in parallel.
 * All five sections are resolved concurrently for <300 ms target.
 */
export async function getDiscoveryFeed(
  query: FeedQuery,
): Promise<DiscoveryFeedResult> {
  const [nearbyRides, upcomingRides, clubsNearYou, newClubs, nearbyListings] =
    await Promise.all([
      queryNearbyRides(query),
      queryUpcomingRides(query),
      queryNearbyClubs(query),
      queryNewClubs(query),
      queryNearbyListings(query),
    ]);

  return {
    nearbyRides,
    upcomingRides,
    clubsNearYou,
    newClubs,
    nearbyListings,
  };
}
