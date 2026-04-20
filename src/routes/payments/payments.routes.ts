import { Router, Request, Response } from "express";
import { ApiResponse, ErrorCode } from "../../lib/utils/apiResponse.js";
import prisma from "../../lib/prisma.js";
import { requireAuth } from "../../config/auth.js";
import { asyncHandler } from "../../middlewares/validation.js";
import {
  createCustomerPortalSession,
  createDodoCheckoutSession,
  getDodoConfigStatus,
  verifyDodoWebhook,
  type DodoWebhookEvent,
} from "../../lib/dodoPayments.js";
import {
  getCurrentBillingSubscription,
  refreshUserSubscriptionTier,
  upsertBillingSubscription,
} from "../../lib/subscription.js";

const router = Router();

function toDate(value: unknown): Date | null {
  if (!value || typeof value !== "string") {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function syncSubscriptionFromEvent(event: DodoWebhookEvent) {
  const data = event.data;
  const metadata = data?.metadata || {};
  const userId = metadata.userId || metadata.user_id;
  const providerSubscriptionId = data?.subscription_id;

  if (!userId) {
    return;
  }

  const status = data?.status?.toLowerCase() || null;

  if (!providerSubscriptionId || !status) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionTier:
          event.type === "subscription.active" ||
          event.type === "subscription.renewed" ||
          event.type === "subscription.created"
            ? "PRO"
            : "FREE",
      },
    });
    return;
  }

  await upsertBillingSubscription({
    userId,
    provider: "DODO",
    providerCustomerId: data?.customer?.customer_id || null,
    providerSubscriptionId,
    tier: String(metadata.tier || "PRO").toUpperCase(),
    plan: metadata.plan || metadata.plan_type || null,
    status,
    currentPeriodEnd: toDate(data?.next_billing_date),
    cancelAt: toDate(data?.cancelled_at),
  });

  await refreshUserSubscriptionTier(userId);
}

router.get("/config-status", (_req: Request, res: Response) => {
  ApiResponse.success(res, getDodoConfigStatus(), "Dodo config status loaded");
});

// Create a checkout session (e.g. for Pro subscription)
router.post(
  "/checkout-session",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const session = (req as any).session;
    const billingCycle =
      req.body?.billingCycle === "annual" ? "annual" : "monthly";
    const productId =
      billingCycle === "annual"
        ? process.env.DODO_PRO_ANNUAL_PRODUCT_ID?.trim()
        : process.env.DODO_PRO_MONTHLY_PRODUCT_ID?.trim();

    if (!productId) {
      return ApiResponse.error(
        res,
        `Dodo product ID is not configured for the ${billingCycle} plan`,
        500,
        ErrorCode.EXTERNAL_SERVICE_ERROR,
      );
    }

    const checkout = await createDodoCheckoutSession({
      productId,
      customer: {
        email: session.user.email,
        name: session.user.name,
      },
      metadata: {
        userId: session.user.id,
        tier: "PRO",
        plan: billingCycle,
        source: "mobile_pro_upgrade",
      },
    });

    ApiResponse.success(
      res,
      {
        checkoutUrl: checkout.checkout_url || checkout.url,
        sessionId: checkout.session_id || null,
        billingCycle,
      },
      "Checkout session created successfully",
    );
  }),
);

router.get(
  "/portal",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const session = (req as any).session;
    const subscription = await getCurrentBillingSubscription(session.user.id);

    if (!subscription?.providerCustomerId) {
      return ApiResponse.error(
        res,
        "No Dodo customer is linked to this account yet",
        409,
        ErrorCode.CONFLICT,
      );
    }

    const portal = await createCustomerPortalSession(
      subscription.providerCustomerId,
      false,
    );

    ApiResponse.success(
      res,
      { portalUrl: portal.portal_url || portal.url },
      "Customer portal created successfully",
    );
  }),
);

// Dodo Webhook Handler
router.post(
  "/webhook",
  asyncHandler(async (req: Request, res: Response) => {
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body.toString("utf8")
      : JSON.stringify(req.body || {});

    const webhookHeaders = {
      "webhook-id": String(req.headers["webhook-id"] || ""),
      "webhook-signature": String(req.headers["webhook-signature"] || ""),
      "webhook-timestamp": String(req.headers["webhook-timestamp"] || ""),
    };

    const payload = verifyDodoWebhook(rawBody, webhookHeaders);

    if (
      payload.type === "subscription.active" ||
      payload.type === "subscription.created" ||
      payload.type === "subscription.renewed" ||
      payload.type === "subscription.cancelled" ||
      payload.type === "subscription.canceled" ||
      payload.type === "subscription.failed" ||
      payload.type === "subscription.expired" ||
      payload.type === "subscription.on_hold"
    ) {
      await syncSubscriptionFromEvent(payload);
    }

    ApiResponse.success(res, { received: true }, "Webhook received");
  }),
);

export default router;
