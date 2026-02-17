/**
 * Multi-role permission utilities for Zoomies platform.
 *
 * Users can hold multiple roles simultaneously (e.g. CLUB_OWNER + SELLER).
 */

// Mirror the Prisma enum – kept in sync manually to avoid importing generated client everywhere.
export enum UserRole {
  ADMIN = "ADMIN",
  CLUB_OWNER = "CLUB_OWNER",
  RIDER = "RIDER",
  SELLER = "SELLER",
}

// ─── Platform access lists ───────────────────────────────────────────

/** Roles that may access the **web** admin / manager portal */
export const WEB_ACCESS_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.CLUB_OWNER,
  UserRole.SELLER,
];

/** Roles designed for the **mobile** app */
export const MOBILE_ACCESS_ROLES: UserRole[] = [
  UserRole.RIDER,
  UserRole.CLUB_OWNER,
  UserRole.SELLER,
  UserRole.ADMIN,
];

// ─── Helpers ─────────────────────────────────────────────────────────

/** Check whether the user holds **any** of the required roles. */
export function hasAnyRole(
  userRoles: UserRole[],
  requiredRoles: UserRole[],
): boolean {
  return requiredRoles.some((r) => userRoles.includes(r));
}

/** Check whether the user holds **all** of the required roles. */
export function hasAllRoles(
  userRoles: UserRole[],
  requiredRoles: UserRole[],
): boolean {
  return requiredRoles.every((r) => userRoles.includes(r));
}

/** Check if user is any kind of admin */
export function isAdmin(userRoles: UserRole[]): boolean {
  return userRoles.includes(UserRole.ADMIN);
}

/** Can the user access the web portal? */
export function canAccessWeb(userRoles: UserRole[]): boolean {
  return hasAnyRole(userRoles, WEB_ACCESS_ROLES);
}

/** Can the user access the mobile app? */
export function canAccessMobile(userRoles: UserRole[]): boolean {
  // Admins and rider roles can access mobile.
  return hasAnyRole(userRoles, MOBILE_ACCESS_ROLES);
}

/** Normalise a roles array – deduplicates. */
export function normalizeRoles(roles: UserRole[]): UserRole[] {
  const set = new Set(roles);
  return Array.from(set);
}

/**
 * Role permission matrix.
 * Maps each conceptual permission to the roles that grant it.
 */
export const PERMISSIONS = {
  // Admin
  VIEW_ADMIN_DASHBOARD: [UserRole.ADMIN],
  MANAGE_USERS: [UserRole.ADMIN],
  MANAGE_ADMINS: [UserRole.ADMIN],
  VIEW_METRICS: [UserRole.ADMIN],
  MODERATE_CONTENT: [UserRole.ADMIN],
  VERIFY_CLUBS: [UserRole.ADMIN],

  // Club owner
  MANAGE_OWN_CLUBS: [UserRole.ADMIN, UserRole.CLUB_OWNER],
  MANAGE_CLUB_RIDES: [UserRole.ADMIN, UserRole.CLUB_OWNER],
  MANAGE_CLUB_MEMBERS: [UserRole.ADMIN, UserRole.CLUB_OWNER],

  // Seller
  MANAGE_LISTINGS: [UserRole.ADMIN, UserRole.SELLER],

  // Rider / User (mobile)
  JOIN_RIDES: [UserRole.RIDER, UserRole.CLUB_OWNER, UserRole.SELLER],
  CREATE_RIDES: [
    UserRole.RIDER,
    UserRole.CLUB_OWNER,
    UserRole.SELLER,
    UserRole.ADMIN,
  ],
  JOIN_CLUBS: [UserRole.RIDER, UserRole.CLUB_OWNER, UserRole.SELLER],
  CREATE_CLUBS: [
    UserRole.RIDER,
    UserRole.CLUB_OWNER,
    UserRole.SELLER,
    UserRole.ADMIN,
  ],
  CREATE_LISTINGS: [
    UserRole.RIDER,
    UserRole.CLUB_OWNER,
    UserRole.SELLER,
    UserRole.ADMIN,
  ],
} as const;

export type Permission = keyof typeof PERMISSIONS;

/** Check whether a user has a specific permission. */
export function hasPermission(
  userRoles: UserRole[],
  permission: Permission,
): boolean {
  return hasAnyRole(userRoles, [...PERMISSIONS[permission]]);
}
