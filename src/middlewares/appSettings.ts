import type { Request, Response, NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../config/auth.js";
import { getAdminSettings } from "../lib/adminSettings.js";
import { ApiResponse, ErrorCode } from "../lib/utils/apiResponse.js";
import { getUserRoles, UserRole } from "./rbac.js";

const MAINTENANCE_ALLOWLIST = [
  "/health",
  "/auth",
  "/admin",
  "/public",
  "/payments/webhook",
];

function isAllowlisted(pathname: string): boolean {
  return MAINTENANCE_ALLOWLIST.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

async function isAdminRequest(req: Request): Promise<boolean> {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers as any),
  });

  if (!session?.user?.id) return false;
  const roles = await getUserRoles(session.user.id);
  return roles.includes(UserRole.ADMIN) || roles.includes(UserRole.CO_ADMIN);
}

export async function maintenanceModeMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const settings = await getAdminSettings();
  if (!settings.maintenanceMode) return next();
  if (isAllowlisted(req.path)) return next();

  if (await isAdminRequest(req)) return next();

  return ApiResponse.error(
    res,
    "Maintenance mode enabled",
    503,
    ErrorCode.FORBIDDEN,
  );
}

export async function signupGateMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const settings = await getAdminSettings();
  if (settings.allowRegistration) return next();

  const isSignup = req.method === "POST" && req.path.includes("sign-up");
  if (!isSignup) return next();

  return ApiResponse.forbidden(
    res,
    "New registrations are disabled",
    ErrorCode.FORBIDDEN,
  );
}

export async function requireMarketplaceEnabled(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const settings = await getAdminSettings();
  if (settings.marketplaceEnabled) return next();

  if (await isAdminRequest(req)) return next();

  return ApiResponse.forbidden(
    res,
    "Marketplace is currently disabled",
    ErrorCode.FORBIDDEN,
  );
}

export async function requireClubCreationEnabled(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const settings = await getAdminSettings();
  if (settings.clubCreationEnabled) return next();

  if (await isAdminRequest(req)) return next();

  return ApiResponse.forbidden(
    res,
    "Club creation is currently disabled",
    ErrorCode.FORBIDDEN,
  );
}
