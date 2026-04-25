import { Request, Response, NextFunction } from "express";
import prisma from "./prisma.js";
import { ApiResponse, ErrorCode } from "./utils/apiResponse.js";

export const FREE_MARKETPLACE_LISTING_LIMIT = 3;
export const FREE_CLUB_OWNERSHIP_LIMIT = 5;

const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "trialing", "renewed"];

type BillingSubscriptionRecord = {
  id: string;
  userId: string;
  provider: string;
  providerCustomerId: string | null;
  providerSubscriptionId: string;
  tier: string;
  plan: string | null;
  status: string;
  currentPeriodEnd: Date | null;
  cancelAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type BillingSubscriptionDelegate = {
  findFirst: (args: unknown) => Promise<BillingSubscriptionRecord | null>;
  upsert: (args: unknown) => Promise<unknown>;
};

function getBillingSubscriptionDelegate(): BillingSubscriptionDelegate | null {
  const delegate = (prisma as any).billingSubscription;

  if (
    delegate &&
    typeof delegate.findFirst === "function" &&
    typeof delegate.upsert === "function"
  ) {
    return delegate as BillingSubscriptionDelegate;
  }

  return null;
}

function isMissingBillingDelegateError(error: unknown): boolean {
  return error instanceof TypeError && /findfirst|upsert/i.test(error.message);
}

async function queryBillingSubscriptionByUserId(
  userId: string,
): Promise<BillingSubscriptionRecord | null> {
  const rows = await prisma.$queryRaw<BillingSubscriptionRecord[]>`
    SELECT
      id,
      user_id AS "userId",
      provider,
      provider_customer_id AS "providerCustomerId",
      provider_subscription_id AS "providerSubscriptionId",
      tier,
      plan,
      status,
      current_period_end AS "currentPeriodEnd",
      cancel_at AS "cancelAt",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM billing_subscriptions
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC, created_at DESC
    LIMIT 1
  `;

  return rows[0] || null;
}

export async function upsertBillingSubscription(input: {
  userId: string;
  provider?: string;
  providerCustomerId?: string | null;
  providerSubscriptionId: string;
  tier?: string;
  plan?: string | null;
  status: string;
  currentPeriodEnd?: Date | null;
  cancelAt?: Date | null;
}): Promise<void> {
  const delegate = getBillingSubscriptionDelegate();

  if (delegate) {
    await delegate.upsert({
      where: { providerSubscriptionId: input.providerSubscriptionId },
      update: {
        userId: input.userId,
        provider: input.provider || "DODO",
        providerCustomerId: input.providerCustomerId || null,
        tier: input.tier || "PRO",
        plan: input.plan || null,
        status: input.status,
        currentPeriodEnd: input.currentPeriodEnd || null,
        cancelAt: input.cancelAt || null,
      },
      create: {
        userId: input.userId,
        provider: input.provider || "DODO",
        providerCustomerId: input.providerCustomerId || null,
        providerSubscriptionId: input.providerSubscriptionId,
        tier: input.tier || "PRO",
        plan: input.plan || null,
        status: input.status,
        currentPeriodEnd: input.currentPeriodEnd || null,
        cancelAt: input.cancelAt || null,
      },
    });
    return;
  }

  await prisma.$executeRaw`
    INSERT INTO billing_subscriptions (
      id,
      user_id,
      provider,
      provider_customer_id,
      provider_subscription_id,
      tier,
      plan,
      status,
      current_period_end,
      cancel_at,
      created_at,
      updated_at
    )
    VALUES (
      ${`sub_${input.providerSubscriptionId}`},
      ${input.userId},
      ${input.provider || "DODO"},
      ${input.providerCustomerId || null},
      ${input.providerSubscriptionId},
      ${input.tier || "PRO"},
      ${input.plan || null},
      ${input.status},
      ${input.currentPeriodEnd || null},
      ${input.cancelAt || null},
      NOW(),
      NOW()
    )
    ON CONFLICT (provider_subscription_id)
    DO UPDATE SET
      user_id = EXCLUDED.user_id,
      provider = EXCLUDED.provider,
      provider_customer_id = EXCLUDED.provider_customer_id,
      tier = EXCLUDED.tier,
      plan = EXCLUDED.plan,
      status = EXCLUDED.status,
      current_period_end = EXCLUDED.current_period_end,
      cancel_at = EXCLUDED.cancel_at,
      updated_at = NOW()
  `;
}

export function isActiveSubscriptionStatus(status?: string | null): boolean {
  return (
    !!status && ACTIVE_SUBSCRIPTION_STATUSES.includes(status.toLowerCase())
  );
}

export async function getCurrentBillingSubscription(userId: string) {
  const delegate = getBillingSubscriptionDelegate();

  if (delegate) {
    try {
      return await delegate.findFirst({
        where: { userId },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      });
    } catch (error) {
      if (!isMissingBillingDelegateError(error)) {
        throw error;
      }
    }
  }

  return queryBillingSubscriptionByUserId(userId);
}

export async function refreshUserSubscriptionTier(
  userId: string,
): Promise<string> {
  const [subscription, user] = await Promise.all([
    prisma.billingSubscription.findFirst({
      where: { userId },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      select: { tier: true, status: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionTier: true },
    }),
  ]);

  const subscriptionTier = subscription
    ? isActiveSubscriptionStatus(subscription.status)
      ? subscription.tier || "PRO"
      : "FREE"
    : user?.subscriptionTier || "FREE";

  await prisma.user.update({
    where: { id: userId },
    data: { subscriptionTier },
  });

  return subscriptionTier;
}

export async function isUserPro(userId: string): Promise<boolean> {
  const [subscription, user] = await Promise.all([
    getCurrentBillingSubscription(userId),
    prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionTier: true },
    }),
  ]);

  if (subscription) {
    return (
      subscription.tier === "PRO" &&
      isActiveSubscriptionStatus(subscription.status)
    );
  }

  return user?.subscriptionTier === "PRO";
}

export async function countUserOwnedClubs(userId: string): Promise<number> {
  return prisma.club.count({ where: { ownerId: userId } });
}

export async function countUserActiveListings(userId: string): Promise<number> {
  return prisma.marketplaceListing.count({
    where: {
      sellerId: userId,
      status: "ACTIVE",
    },
  });
}

/**
 * Express middleware: 403 the request unless the authenticated user has an
 * active Pro subscription. Mount AFTER `requireAuth`.
 *
 * The 403 body uses `ErrorCode.SUBSCRIPTION_REQUIRED` (with safe fallback)
 * so the mobile client can detect it and route the user to the paywall.
 */
export function requirePro(featureName?: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const session = (req as any).session;

    if (!session?.user?.id) {
      return ApiResponse.unauthorized(res, "Authentication required");
    }

    const hasPro = await isUserPro(session.user.id);

    if (!hasPro) {
      return ApiResponse.forbidden(
        res,
        featureName
          ? `${featureName} requires Zoomies Pro. Upgrade to unlock this feature.`
          : "This feature requires Zoomies Pro.",
        ErrorCode.SUBSCRIPTION_REQUIRED,
      );
    }

    next();
  };
}
