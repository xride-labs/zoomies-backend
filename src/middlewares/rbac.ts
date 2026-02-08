import { Request, Response, NextFunction } from "express";
import { ApiResponse, ErrorCode } from "../lib/utils/apiResponse.js";
import prisma from "../lib/prisma.js";

/**
 * User roles enum matching Prisma schema
 */
export enum UserRole {
  SUPER_ADMIN = "SUPER_ADMIN", // Full platform access
  ADMIN = "ADMIN", // System administrator
  CLUB_OWNER = "CLUB_OWNER", // Club creator/manager
  USER = "USER", // Regular user (default)
  RIDER = "RIDER", // Active motorcycle rider
  SELLER = "SELLER", // Marketplace seller
}

/**
 * Role hierarchy - higher roles include permissions of lower roles
 */
const roleHierarchy: Record<UserRole, number> = {
  [UserRole.SUPER_ADMIN]: 100,
  [UserRole.ADMIN]: 80,
  [UserRole.CLUB_OWNER]: 60,
  [UserRole.SELLER]: 40,
  [UserRole.RIDER]: 30,
  [UserRole.USER]: 10,
};

/**
 * Web platform access roles - only these can access web frontend
 */
export const WEB_ACCESS_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.CLUB_OWNER,
];

/**
 * Mobile app access roles
 */
export const MOBILE_ACCESS_ROLES: UserRole[] = [
  UserRole.RIDER,
  UserRole.SELLER,
  UserRole.CLUB_OWNER, // Club owners can also use mobile
  UserRole.USER,
];

/**
 * Check if a role has sufficient privileges
 */
function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

/**
 * Middleware to require specific role(s)
 * @param allowedRoles - Array of roles that are allowed access
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const session = (req as any).session;

    if (!session?.user) {
      return ApiResponse.unauthorized(res, "Authentication required");
    }

    // Fetch user with role from database
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true },
    });

    if (!user) {
      return ApiResponse.unauthorized(
        res,
        "User not found",
        ErrorCode.USER_NOT_FOUND,
      );
    }

    const userRole = user.role as UserRole;

    // SUPER_ADMIN always has access
    if (userRole === UserRole.SUPER_ADMIN) {
      (req as any).userRole = userRole;
      return next();
    }

    // Check if user has any of the allowed roles
    const hasAccess = allowedRoles.some(
      (role) => userRole === role || hasRole(userRole, role),
    );

    if (!hasAccess) {
      return ApiResponse.forbidden(
        res,
        `This action requires one of the following roles: ${allowedRoles.join(", ")}`,
        ErrorCode.ROLE_REQUIRED,
      );
    }

    (req as any).userRole = userRole;
    next();
  };
}

/**
 * Middleware to require admin access
 */
export const requireAdmin = requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN);

/**
 * Middleware to require super admin access
 */
export const requireSuperAdmin = requireRole(UserRole.SUPER_ADMIN);

/**
 * Middleware to require club owner or admin access
 */
export const requireClubOwnerOrAdmin = requireRole(
  UserRole.CLUB_OWNER,
  UserRole.ADMIN,
  UserRole.SUPER_ADMIN,
);

/**
 * Middleware to check if user can access web platform
 */
export function requireWebAccess(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  return requireRole(...WEB_ACCESS_ROLES)(req, res, next);
}

/**
 * Middleware to check resource ownership or admin access
 * @param resourceType - Type of resource to check ownership
 * @param resourceIdParam - Request param containing resource ID
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

    // Fetch user role
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true },
    });

    if (!user) {
      return ApiResponse.unauthorized(res, "User not found");
    }

    const userRole = user.role as UserRole;

    // Admins always have access
    if (userRole === UserRole.SUPER_ADMIN || userRole === UserRole.ADMIN) {
      (req as any).userRole = userRole;
      return next();
    }

    // Check ownership based on resource type
    let isOwner = false;

    switch (resourceType) {
      case "ride":
        const ride = await prisma.ride.findUnique({
          where: { id: resourceId },
          select: { creatorId: true },
        });
        isOwner = ride?.creatorId === session.user.id;
        break;

      case "club":
        const club = await prisma.club.findUnique({
          where: { id: resourceId },
          select: { ownerId: true },
        });
        isOwner = club?.ownerId === session.user.id;
        // Also check if user is a club admin
        if (!isOwner) {
          const membership = await prisma.clubMember.findUnique({
            where: {
              clubId_userId: { clubId: resourceId, userId: session.user.id },
            },
            select: { role: true },
          });
          isOwner =
            membership?.role === "ADMIN" || membership?.role === "FOUNDER";
        }
        break;

      case "listing":
        const listing = await prisma.marketplaceListing.findUnique({
          where: { id: resourceId },
          select: { sellerId: true },
        });
        isOwner = listing?.sellerId === session.user.id;
        break;

      case "post":
        const post = await prisma.post.findUnique({
          where: { id: resourceId },
          select: { authorId: true },
        });
        isOwner = post?.authorId === session.user.id;
        break;
    }

    if (!isOwner) {
      return ApiResponse.forbidden(
        res,
        "You don't have permission to modify this resource",
        ErrorCode.INSUFFICIENT_PERMISSIONS,
      );
    }

    (req as any).userRole = userRole;
    next();
  };
}

/**
 * Middleware to require club membership with specific role
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

    // Check if user is system admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role === "SUPER_ADMIN" || user?.role === "ADMIN") {
      return next();
    }

    // Check club membership
    const membership = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId: session.user.id } },
      select: { role: true },
    });

    // Also check if user is club owner
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
