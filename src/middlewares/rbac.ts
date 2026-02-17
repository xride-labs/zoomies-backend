import { Request, Response, NextFunction } from "express";
import { ApiResponse, ErrorCode } from "../lib/utils/apiResponse.js";
import {
  UserRole,
  hasAnyRole,
  isAdmin,
  WEB_ACCESS_ROLES,
  MOBILE_ACCESS_ROLES,
} from "../lib/utils/permissions.js";
import prisma from "../lib/prisma.js";

// Re-export for backward compatibility
export { UserRole, WEB_ACCESS_ROLES, MOBILE_ACCESS_ROLES };

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Fetch a user's roles from the DB as a UserRole[].
 * Returns the assigned roles as-is.
 */
export async function getUserRoles(userId: string): Promise<UserRole[]> {
  const assignments = await prisma.userRoleAssignment.findMany({
    where: { userId },
    select: { role: true },
  });
  return assignments.map((a) => a.role as UserRole);
}

// ─── Middleware factories ────────────────────────────────────────────

/**
 * Require that the authenticated user holds **any** of the listed roles.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const session = (req as any).session;

    if (!session?.user) {
      return ApiResponse.unauthorized(res, "Authentication required");
    }

    const userRoles = await getUserRoles(session.user.id);

    if (!hasAnyRole(userRoles, allowedRoles)) {
      return ApiResponse.forbidden(
        res,
        `This action requires one of the following roles: ${allowedRoles.join(", ")}`,
        ErrorCode.ROLE_REQUIRED,
      );
    }

    (req as any).userRoles = userRoles;
    next();
  };
}

// ─── Pre-built guards ────────────────────────────────────────────────

export const requireAdmin = requireRole(UserRole.ADMIN);
export const requireSuperAdmin = requireRole(UserRole.ADMIN);
export const requireClubOwnerOrAdmin = requireRole(
  UserRole.CLUB_OWNER,
  UserRole.ADMIN,
);

/**
 * Require web-portal access (ADMIN | CLUB_OWNER | SELLER).
 */
export function requireWebAccess(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  return requireRole(...WEB_ACCESS_ROLES)(req, res, next);
}

// ─── Ownership guards ───────────────────────────────────────────────

/**
 * Require resource ownership **or** admin access.
 */
export function requireOwnershipOrAdmin(
  resourceType: "ride" | "club" | "listing" | "post",
  resourceIdParam: string = "id",
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const session = (req as any).session;
    const resourceId = req.params[resourceIdParam];

    if (!session?.user) {
      return ApiResponse.unauthorized(res, "Authentication required");
    }

    const userRoles = await getUserRoles(session.user.id);

    // Admins always pass
    if (isAdmin(userRoles)) {
      (req as any).userRoles = userRoles;
      return next();
    }

    // Check ownership
    let isOwner = false;

    switch (resourceType) {
      case "ride": {
        const ride = await prisma.ride.findUnique({
          where: { id: resourceId },
          select: { creatorId: true },
        });
        isOwner = ride?.creatorId === session.user.id;
        break;
      }
      case "club": {
        const club = await prisma.club.findUnique({
          where: { id: resourceId },
          select: { ownerId: true },
        });
        isOwner = club?.ownerId === session.user.id;
        if (!isOwner) {
          const membership = await prisma.clubMember.findUnique({
            where: {
              clubId_userId: {
                clubId: resourceId,
                userId: session.user.id,
              },
            },
            select: { role: true },
          });
          isOwner =
            membership?.role === "ADMIN" || membership?.role === "FOUNDER";
        }
        break;
      }
      case "listing": {
        const listing = await prisma.marketplaceListing.findUnique({
          where: { id: resourceId },
          select: { sellerId: true },
        });
        isOwner = listing?.sellerId === session.user.id;
        break;
      }
      case "post": {
        const post = await prisma.post.findUnique({
          where: { id: resourceId },
          select: { authorId: true },
        });
        isOwner = post?.authorId === session.user.id;
        break;
      }
    }

    if (!isOwner) {
      return ApiResponse.forbidden(
        res,
        "You don't have permission to modify this resource",
        ErrorCode.INSUFFICIENT_PERMISSIONS,
      );
    }

    (req as any).userRoles = userRoles;
    next();
  };
}

/**
 * Require club membership with a minimum role.
 */
export function requireClubMembership(
  minRole: "MEMBER" | "OFFICER" | "ADMIN" | "FOUNDER" = "MEMBER",
  clubIdParam: string = "clubId",
) {
  const roleOrder = { MEMBER: 0, OFFICER: 1, ADMIN: 2, FOUNDER: 3 };

  return async (req: Request, res: Response, next: NextFunction) => {
    const session = (req as any).session;
    const clubId = req.params[clubIdParam] || req.body.clubId;

    if (!session?.user) {
      return ApiResponse.unauthorized(res, "Authentication required");
    }

    if (!clubId) {
      return ApiResponse.error(
        res,
        "Club ID is required",
        400,
        ErrorCode.MISSING_REQUIRED_FIELD,
      );
    }

    // System admins always pass
    const userRoles = await getUserRoles(session.user.id);
    if (isAdmin(userRoles)) return next();

    // Check club membership
    const membership = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId: session.user.id } },
      select: { role: true },
    });

    const club = await prisma.club.findUnique({
      where: { id: clubId },
      select: { ownerId: true },
    });

    const isOwner = club?.ownerId === session.user.id;

    if (!membership && !isOwner) {
      return ApiResponse.forbidden(res, "You are not a member of this club");
    }

    const memberRole = isOwner ? "FOUNDER" : membership?.role || "MEMBER";

    if (roleOrder[memberRole as keyof typeof roleOrder] < roleOrder[minRole]) {
      return ApiResponse.forbidden(
        res,
        `This action requires ${minRole} role or higher in the club`,
      );
    }

    (req as any).clubRole = memberRole;
    next();
  };
}
