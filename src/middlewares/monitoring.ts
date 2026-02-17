import type { Request, Response, NextFunction } from "express";
import { getCurrentSession } from "../config/auth.js";
import { ApiResponse, ErrorCode } from "../lib/utils/apiResponse.js";
import { requireAdmin, UserRole } from "./rbac.js";

export async function requireMonitoringAccess(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization || "";
  const bearerToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (
    bearerToken &&
    process.env.METRICS_BEARER_TOKEN &&
    bearerToken === process.env.METRICS_BEARER_TOKEN
  ) {
    (req as any).userRole = UserRole.ADMIN;
    return next();
  }

  const session = await getCurrentSession(req);
  if (!session || !session.user) {
    return ApiResponse.unauthorized(
      res,
      "Authentication required",
      ErrorCode.UNAUTHORIZED,
    );
  }

  (req as any).session = session;
  return requireAdmin(req, res, next);
}
