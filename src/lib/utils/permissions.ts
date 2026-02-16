/**
 * Multi-role permission utilities for Zoomies platform.
 *
 * Users can hold multiple roles simultaneously (e.g. CLUB_OWNER + SELLER).
 * Every user implicitly has the USER role.
 */

// Mirror the Prisma enum – kept in sync manually to avoid importing generated client everywhere.
export enum UserRole {
  SUPER_ADMIN = "SUPER_ADMIN",
  ADMIN = "ADMIN",
  CLUB_OWNER = "CLUB_OWNER",
  USER = "USER",
  RIDER = "RIDER",
  SELLER = "SELLER",
}

// ─── Platform access lists ───────────────────────────────────────────

/** Roles that may access the **web** admin / manager portal */
export const WEB_ACCESS_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.CLUB_OWNER,
  UserRole.SELLER,
];

/** Roles designed for the **mobile** app */
export const MOBILE_ACCESS_ROLES: UserRole[] = [
  UserRole.USER,
  UserRole.RIDER,
  UserRole.CLUB_OWNER,
  UserRole.SELLER,
];

// ─── Helpers ─────────────────────────────────────────────────────────

/** Check whether the user holds **any** of the required roles. */
export function hasAnyRole(
  userRoles: UserRole[],
  requiredRoles: UserRole[],
): boolean {
  // SUPER_ADMIN always passes
  if (userRoles.includes(UserRole.SUPER_ADMIN)) return true;
  return requiredRoles.some((r) => userRoles.includes(r));
}

/** Check whether the user holds **all** of the required roles. */
export function hasAllRoles(
  userRoles: UserRole[],
  requiredRoles: UserRole[],
): boolean {
  if (userRoles.includes(UserRole.SUPER_ADMIN)) return true;
  return requiredRoles.every((r) => userRoles.includes(r));
}

/** Check if user is a super admin */
export function isSuperAdmin(userRoles: UserRole[]): boolean {
  return userRoles.includes(UserRole.SUPER_ADMIN);
}

/** Check if user is any kind of admin */
export function isAdmin(userRoles: UserRole[]): boolean {
  return (
    userRoles.includes(UserRole.SUPER_ADMIN) ||
    userRoles.includes(UserRole.ADMIN)
  );
}

/** Can the user access the web portal? */
export function canAccessWeb(userRoles: UserRole[]): boolean {
  return hasAnyRole(userRoles, WEB_ACCESS_ROLES);
}

/** Can the user access the mobile app? */
export function canAccessMobile(userRoles: UserRole[]): boolean {
  // Everyone can access mobile except pure admin-only accounts.
  return hasAnyRole(userRoles, MOBILE_ACCESS_ROLES);
}

/** Normalise a roles array – always includes USER, deduplicates. */
export function normalizeRoles(roles: UserRole[]): UserRole[] {
  const set = new Set(roles);
  set.add(UserRole.USER); // USER is implicit
  return Array.from(set);
}

/**
 * Role permission matrix.
 * Maps each conceptual permission to the roles that grant it.
 */
export const PERMISSIONS = {
  // Admin
  VIEW_ADMIN_DASHBOARD: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  MANAGE_USERS: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  MANAGE_ADMINS: [UserRole.SUPER_ADMIN],
  VIEW_METRICS: [UserRole.SUPER_ADMIN],
  MODERATE_CONTENT: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  VERIFY_CLUBS: [UserRole.SUPER_ADMIN, UserRole.ADMIN],

  // Club owner
  MANAGE_OWN_CLUBS: [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.CLUB_OWNER,
  ],
  MANAGE_CLUB_RIDES: [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.CLUB_OWNER,
  ],
  MANAGE_CLUB_MEMBERS: [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.CLUB_OWNER,
  ],

  // Seller
  MANAGE_LISTINGS: [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.SELLER,
  ],

  // Rider / User (mobile)
  JOIN_RIDES: [
    UserRole.USER,
    UserRole.RIDER,
    UserRole.CLUB_OWNER,
    UserRole.SELLER,
  ],
  CREATE_RIDES: [
    UserRole.USER,
    UserRole.RIDER,
    UserRole.CLUB_OWNER,
    UserRole.SELLER,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
  ],
  JOIN_CLUBS: [
    UserRole.USER,
    UserRole.RIDER,
    UserRole.CLUB_OWNER,
    UserRole.SELLER,
  ],
  CREATE_CLUBS: [
    UserRole.USER,
    UserRole.RIDER,
    UserRole.CLUB_OWNER,
    UserRole.SELLER,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
  ],
  CREATE_LISTINGS: [
    UserRole.USER,
    UserRole.RIDER,
    UserRole.CLUB_OWNER,
    UserRole.SELLER,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
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
