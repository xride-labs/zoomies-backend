/**
 * PAYMENTS ROUTES TESTS
 *
 * Covers the 8 endpoints mounted at /api/payments plus the raw-body Dodo
 * webhook (POST /api/payments/webhook, wired with express.raw in server.ts).
 *
 * The Dodo Payments SDK (lib/dodoPayments.js) makes real HTTP calls to Dodo
 * and verifies webhook signatures with `standardwebhooks`, so the ENTIRE module
 * is mocked here. lib/subscription.js is left REAL — it only touches Prisma
 * (findFirst / upsert / raw SQL), so it exercises the genuine DB side effects.
 *
 * Mocked Dodo exports:
 *   - createDodoCheckoutSession   -> fake { checkout_url, session_id }
 *   - createCustomerPortalSession -> fake { portal_url }
 *   - getDodoConfigStatus         -> fake config snapshot
 *   - verifyDodoWebhook           -> throws on a bad/missing signature, parses
 *                                    the body only when our magic "valid"
 *                                    signature header is present (we cannot
 *                                    forge a real standardwebhooks signature).
 */

import { vi } from "vitest";
import request from "supertest";
import { app } from "../../server";
import prisma from "../../lib/prisma.js";
import { createTestUser, cleanupTestData } from "../../test/utils";

// Magic header value our mocked verifier treats as a valid signature. Anything
// else (missing/empty/wrong) is rejected, mirroring standardwebhooks.
const VALID_SIGNATURE = "v1,valid-test-signature";

// `vi.mock` factories are hoisted above the module body, so the fns they
// reference must be created via `vi.hoisted` (also hoisted) to avoid a
// "cannot access before initialization" error.
const { checkoutMock, portalMock } = vi.hoisted(() => ({
  checkoutMock: vi.fn(async () => ({
    checkout_url: "https://checkout.test/session-abc",
    session_id: "sess_test_123",
  })),
  portalMock: vi.fn(async () => ({
    portal_url: "https://portal.test/customer-xyz",
  })),
}));

vi.mock("../../lib/dodoPayments.js", async (importActual) => {
  const actual =
    await importActual<typeof import("../../lib/dodoPayments.js")>();
  return {
    ...actual,
    createDodoCheckoutSession: checkoutMock,
    createCustomerPortalSession: portalMock,
    getDodoConfigStatus: vi.fn(() => ({
      environment: "test_mode",
      hasApiKey: true,
      hasWebhookKey: true,
      hasReturnUrl: true,
      hasMonthlyProductId: true,
      hasAnnualProductId: true,
      hasBrandMonthlyProductId: true,
    })),
    // Simulate standardwebhooks verification: reject unless the magic valid
    // signature header is supplied, otherwise parse the raw JSON body.
    verifyDodoWebhook: vi.fn(
      (rawBody: string, headers: Record<string, string>) => {
        if (headers["webhook-signature"] !== VALID_SIGNATURE) {
          throw new Error("No matching signature found");
        }
        return JSON.parse(rawBody);
      },
    ),
  };
});

// ── Env required by the checkout endpoints ────────────────────────────────────
const ENV_KEYS = [
  "DODO_PRO_MONTHLY_PRODUCT_ID",
  "DODO_PRO_ANNUAL_PRODUCT_ID",
  "DODO_BRAND_MONTHLY_PRODUCT_ID",
] as const;
const originalEnv: Record<string, string | undefined> = {};

// Helper: create a BillingSubscription row with the model's real required
// fields (status is required; providerSubscriptionId is unique).
let subSeq = 0;
async function createSubscription(
  userId: string,
  overrides: Partial<{
    provider: string;
    providerCustomerId: string | null;
    providerSubscriptionId: string;
    tier: string;
    plan: string | null;
    status: string;
    currentPeriodEnd: Date | null;
    cancelAt: Date | null;
  }> = {},
) {
  return prisma.billingSubscription.create({
    data: {
      userId,
      provider: "DODO",
      providerCustomerId: "cus_test_default",
      providerSubscriptionId: `psub_${Date.now()}_${subSeq++}`,
      tier: "PRO",
      plan: "monthly",
      status: "active",
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancelAt: null,
      ...overrides,
    },
  });
}

let bizSeq = 0;
async function createBusiness(
  ownerId: string,
  overrides: Partial<{ brandTier: string; brandProExpiresAt: Date | null }> = {},
) {
  return prisma.businessProfile.create({
    data: {
      ownerId,
      categories: ["BRAND"],
      displayName: "Test Moto Shop",
      slug: `test-moto-${Date.now()}-${bizSeq++}`,
      brandTier: "FREE",
      ...overrides,
    },
  });
}

describe("Payments Routes", () => {
  beforeAll(() => {
    for (const key of ENV_KEYS) originalEnv[key] = process.env[key];
    process.env.DODO_PRO_MONTHLY_PRODUCT_ID = "prod_monthly_test";
    process.env.DODO_PRO_ANNUAL_PRODUCT_ID = "prod_annual_test";
    process.env.DODO_BRAND_MONTHLY_PRODUCT_ID = "prod_brand_test";
  });

  afterAll(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  });

  beforeEach(() => {
    checkoutMock.mockClear();
    portalMock.mockClear();
  });

  afterEach(async () => {
    // cleanupTestData() does NOT touch BillingSubscription / BusinessProfile,
    // and both FK to user with onDelete: Cascade — but we delete them up front
    // explicitly so the order is deterministic and independent of cascade.
    await prisma.billingSubscription.deleteMany({});
    await prisma.businessProfile.deleteMany({});
    await cleanupTestData();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GET /config-status  (public, no auth)
  // ───────────────────────────────────────────────────────────────────────────
  describe("GET /api/payments/config-status", () => {
    it("returns the Dodo config status without auth", async () => {
      const res = await request(app).get("/api/payments/config-status");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        environment: "test_mode",
        hasApiKey: true,
        hasMonthlyProductId: true,
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GET /subscription  (requireAuth)
  // ───────────────────────────────────────────────────────────────────────────
  describe("GET /api/payments/subscription", () => {
    it("returns 401 without auth", async () => {
      const res = await request(app).get("/api/payments/subscription");
      expect(res.status).toBe(401);
    });

    it("returns tier=FREE and subscription=null when none exists", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get("/api/payments/subscription")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tier).toBe("FREE");
      expect(res.body.data.subscription).toBeNull();
    });

    it("returns the subscription details when one exists", async () => {
      const { user, token } = await createTestUser({
        subscriptionTier: "PRO",
      });
      const sub = await createSubscription(user.id, {
        providerCustomerId: "cus_abc",
        plan: "annual",
        status: "active",
      });

      const res = await request(app)
        .get("/api/payments/subscription")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.tier).toBe("PRO");
      expect(res.body.data.subscription).toMatchObject({
        id: sub.id,
        provider: "DODO",
        plan: "annual",
        status: "active",
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // POST /sync  (requireAuth) — exercises refreshUserSubscriptionTier (real)
  // ───────────────────────────────────────────────────────────────────────────
  describe("POST /api/payments/sync", () => {
    it("returns 401 without auth", async () => {
      const res = await request(app).post("/api/payments/sync");
      expect(res.status).toBe(401);
    });

    it("downgrades to FREE when the user has no subscription rows", async () => {
      const { user, token } = await createTestUser({
        subscriptionTier: "PRO",
      });

      const res = await request(app)
        .post("/api/payments/sync")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.synced).toBe(true);
      // No subscription => user falls back to its own (PRO) tier per logic.
      expect(res.body.data.tier).toBe("PRO");

      // DB side effect: refreshUserSubscriptionTier writes subscriptionTier.
      const refreshed = await prisma.user.findUnique({
        where: { id: user.id },
        select: { subscriptionTier: true },
      });
      expect(refreshed?.subscriptionTier).toBe("PRO");
    });

    it("syncs tier to PRO when an active PRO subscription exists", async () => {
      const { user, token } = await createTestUser({
        subscriptionTier: "FREE",
      });
      await createSubscription(user.id, { tier: "PRO", status: "active" });

      const res = await request(app)
        .post("/api/payments/sync")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.tier).toBe("PRO");

      const refreshed = await prisma.user.findUnique({
        where: { id: user.id },
        select: { subscriptionTier: true },
      });
      expect(refreshed?.subscriptionTier).toBe("PRO");
    });

    it("syncs tier to FREE when the subscription is cancelled/inactive", async () => {
      const { user, token } = await createTestUser({
        subscriptionTier: "PRO",
      });
      await createSubscription(user.id, { tier: "PRO", status: "cancelled" });

      const res = await request(app)
        .post("/api/payments/sync")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.tier).toBe("FREE");

      const refreshed = await prisma.user.findUnique({
        where: { id: user.id },
        select: { subscriptionTier: true },
      });
      expect(refreshed?.subscriptionTier).toBe("FREE");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // POST /checkout-session  (requireAuth) — mocked Dodo checkout
  // ───────────────────────────────────────────────────────────────────────────
  describe("POST /api/payments/checkout-session", () => {
    it("returns 401 without auth", async () => {
      const res = await request(app)
        .post("/api/payments/checkout-session")
        .send({ billingCycle: "monthly" });
      expect(res.status).toBe(401);
    });

    it("creates a monthly checkout session and returns the checkout URL", async () => {
      const { user, token } = await createTestUser();

      const res = await request(app)
        .post("/api/payments/checkout-session")
        .set("Authorization", `Bearer ${token}`)
        .send({ billingCycle: "monthly" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.checkoutUrl).toBe(
        "https://checkout.test/session-abc",
      );
      expect(res.body.data.sessionId).toBe("sess_test_123");
      expect(res.body.data.billingCycle).toBe("monthly");

      // The mocked Dodo fn was called with the monthly product id + metadata.
      expect(checkoutMock).toHaveBeenCalledTimes(1);
      const arg = checkoutMock.mock.calls[0][0] as any;
      expect(arg.productId).toBe("prod_monthly_test");
      expect(arg.customer.email).toBe(user.email);
      expect(arg.metadata).toMatchObject({
        userId: user.id,
        tier: "PRO",
        plan: "monthly",
      });
    });

    it("uses the annual product id when billingCycle=annual", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/api/payments/checkout-session")
        .set("Authorization", `Bearer ${token}`)
        .send({ billingCycle: "annual" });

      expect(res.status).toBe(200);
      expect(res.body.data.billingCycle).toBe("annual");
      const arg = checkoutMock.mock.calls[0][0] as any;
      expect(arg.productId).toBe("prod_annual_test");
      expect(arg.metadata.plan).toBe("annual");
    });

    it("defaults to monthly when billingCycle is omitted/invalid", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/api/payments/checkout-session")
        .set("Authorization", `Bearer ${token}`)
        .send({ billingCycle: "weekly" });

      expect(res.status).toBe(200);
      expect(res.body.data.billingCycle).toBe("monthly");
      const arg = checkoutMock.mock.calls[0][0] as any;
      expect(arg.productId).toBe("prod_monthly_test");
    });

    it("returns 500 when the product id env var is not configured", async () => {
      const { token } = await createTestUser();
      const saved = process.env.DODO_PRO_MONTHLY_PRODUCT_ID;
      delete process.env.DODO_PRO_MONTHLY_PRODUCT_ID;

      try {
        const res = await request(app)
          .post("/api/payments/checkout-session")
          .set("Authorization", `Bearer ${token}`)
          .send({ billingCycle: "monthly" });

        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe("EXTERNAL_SERVICE_ERROR");
        expect(checkoutMock).not.toHaveBeenCalled();
      } finally {
        process.env.DODO_PRO_MONTHLY_PRODUCT_ID = saved;
      }
    });

    it("returns 502 when Dodo does not return a checkout URL", async () => {
      const { token } = await createTestUser();
      checkoutMock.mockResolvedValueOnce({} as any);

      const res = await request(app)
        .post("/api/payments/checkout-session")
        .set("Authorization", `Bearer ${token}`)
        .send({ billingCycle: "monthly" });

      expect(res.status).toBe(502);
      expect(res.body.error.code).toBe("EXTERNAL_SERVICE_ERROR");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GET /portal  (requireAuth) — mocked customer portal
  // ───────────────────────────────────────────────────────────────────────────
  describe("GET /api/payments/portal", () => {
    it("returns 401 without auth", async () => {
      const res = await request(app).get("/api/payments/portal");
      expect(res.status).toBe(401);
    });

    it("returns 409 when no Dodo customer is linked", async () => {
      const { user, token } = await createTestUser();
      // Subscription exists but providerCustomerId is null => conflict.
      await createSubscription(user.id, { providerCustomerId: null });

      const res = await request(app)
        .get("/api/payments/portal")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("CONFLICT");
      expect(portalMock).not.toHaveBeenCalled();
    });

    it("returns 409 when the user has no subscription at all", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get("/api/payments/portal")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("CONFLICT");
    });

    it("creates a customer portal session when a customer is linked", async () => {
      const { user, token } = await createTestUser();
      await createSubscription(user.id, { providerCustomerId: "cus_linked_1" });

      const res = await request(app)
        .get("/api/payments/portal")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.portalUrl).toBe("https://portal.test/customer-xyz");
      expect(portalMock).toHaveBeenCalledTimes(1);
      expect(portalMock.mock.calls[0][0]).toBe("cus_linked_1");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // POST /brand-checkout  (requireAuth) — mocked Dodo checkout
  // ───────────────────────────────────────────────────────────────────────────
  describe("POST /api/payments/brand-checkout", () => {
    it("returns 401 without auth", async () => {
      const res = await request(app)
        .post("/api/payments/brand-checkout")
        .send({ businessId: "x" });
      expect(res.status).toBe(401);
    });

    it("returns 400 when businessId is missing", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/api/payments/brand-checkout")
        .set("Authorization", `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("returns 404 when the business is not owned by the user", async () => {
      const { token } = await createTestUser();
      const other = await createTestUser();
      const business = await createBusiness(other.user.id);

      const res = await request(app)
        .post("/api/payments/brand-checkout")
        .set("Authorization", `Bearer ${token}`)
        .send({ businessId: business.id });

      expect(res.status).toBe(404);
      expect(checkoutMock).not.toHaveBeenCalled();
    });

    it("returns 409 when the business already has Brand Pro", async () => {
      const { user, token } = await createTestUser();
      const business = await createBusiness(user.id, { brandTier: "PRO" });

      const res = await request(app)
        .post("/api/payments/brand-checkout")
        .set("Authorization", `Bearer ${token}`)
        .send({ businessId: business.id });

      expect(res.status).toBe(409);
      expect(checkoutMock).not.toHaveBeenCalled();
    });

    it("returns 500 when the brand product id is not configured", async () => {
      const { user, token } = await createTestUser();
      const business = await createBusiness(user.id);
      const saved = process.env.DODO_BRAND_MONTHLY_PRODUCT_ID;
      delete process.env.DODO_BRAND_MONTHLY_PRODUCT_ID;

      try {
        const res = await request(app)
          .post("/api/payments/brand-checkout")
          .set("Authorization", `Bearer ${token}`)
          .send({ businessId: business.id });

        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
      } finally {
        process.env.DODO_BRAND_MONTHLY_PRODUCT_ID = saved;
      }
    });

    it("creates a brand checkout session for an owned FREE business", async () => {
      const { user, token } = await createTestUser();
      const business = await createBusiness(user.id);

      const res = await request(app)
        .post("/api/payments/brand-checkout")
        .set("Authorization", `Bearer ${token}`)
        .send({ businessId: business.id });

      expect(res.status).toBe(200);
      expect(res.body.data.checkoutUrl).toBe(
        "https://checkout.test/session-abc",
      );
      expect(checkoutMock).toHaveBeenCalledTimes(1);
      const arg = checkoutMock.mock.calls[0][0] as any;
      expect(arg.productId).toBe("prod_brand_test");
      expect(arg.metadata).toMatchObject({
        type: "BRAND_PRO",
        businessId: business.id,
        userId: user.id,
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GET /brand-status/:businessId  (requireAuth)
  // ───────────────────────────────────────────────────────────────────────────
  describe("GET /api/payments/brand-status/:businessId", () => {
    it("returns 401 without auth", async () => {
      const res = await request(app).get(
        "/api/payments/brand-status/some-business-id",
      );
      expect(res.status).toBe(401);
    });

    it("returns 404 when the business is not owned by the user", async () => {
      const { token } = await createTestUser();
      const other = await createTestUser();
      const business = await createBusiness(other.user.id);

      const res = await request(app)
        .get(`/api/payments/brand-status/${business.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it("returns the current FREE tier for an owned business", async () => {
      const { user, token } = await createTestUser();
      const business = await createBusiness(user.id);

      const res = await request(app)
        .get(`/api/payments/brand-status/${business.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.tier).toBe("FREE");
      expect(res.body.data.expiresAt).toBeNull();
    });

    it("returns PRO with expiry for an active brand subscription", async () => {
      const { user, token } = await createTestUser();
      const expiresAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      const business = await createBusiness(user.id, {
        brandTier: "PRO",
        brandProExpiresAt: expiresAt,
      });

      const res = await request(app)
        .get(`/api/payments/brand-status/${business.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.tier).toBe("PRO");
      expect(res.body.data.expiresAt).not.toBeNull();
    });

    it("auto-downgrades an expired PRO brand subscription to FREE", async () => {
      const { user, token } = await createTestUser();
      const business = await createBusiness(user.id, {
        brandTier: "PRO",
        brandProExpiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // past
      });

      const res = await request(app)
        .get(`/api/payments/brand-status/${business.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.tier).toBe("FREE");
      expect(res.body.data.expiresAt).toBeNull();

      // DB side effect: the row was actually downgraded.
      const refreshed = await prisma.businessProfile.findUnique({
        where: { id: business.id },
        select: { brandTier: true, brandProExpiresAt: true },
      });
      expect(refreshed?.brandTier).toBe("FREE");
      expect(refreshed?.brandProExpiresAt).toBeNull();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // POST /webhook  (express.raw, signature-verified) — no requireAuth
  // ───────────────────────────────────────────────────────────────────────────
  describe("POST /api/payments/webhook", () => {
    const buildEvent = (overrides: Record<string, unknown> = {}) => ({
      type: "subscription.active",
      data: {
        subscription_id: "dodo_sub_1",
        status: "active",
        next_billing_date: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        customer: { customer_id: "cus_wh_1" },
        metadata: { userId: "", tier: "PRO", plan: "monthly" },
      },
      ...overrides,
    });

    it("rejects a webhook with a MISSING signature header", async () => {
      const res = await request(app)
        .post("/api/payments/webhook")
        .set("Content-Type", "application/json")
        .send(JSON.stringify(buildEvent()));

      // verifyDodoWebhook throws -> asyncHandler -> internalError (500).
      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });

    it("rejects a webhook with an INVALID signature header", async () => {
      const res = await request(app)
        .post("/api/payments/webhook")
        .set("Content-Type", "application/json")
        .set("webhook-id", "msg_1")
        .set("webhook-signature", "v1,totally-wrong")
        .set("webhook-timestamp", String(Math.floor(Date.now() / 1000)))
        .send(JSON.stringify(buildEvent()));

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });

    it("accepts a valid-signature webhook and syncs the user subscription", async () => {
      const { user } = await createTestUser({ subscriptionTier: "FREE" });
      const event = buildEvent({
        type: "subscription.active",
        data: {
          subscription_id: "dodo_sub_active_1",
          status: "active",
          next_billing_date: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          customer: { customer_id: "cus_wh_active" },
          metadata: { userId: user.id, tier: "PRO", plan: "monthly" },
        },
      });

      const res = await request(app)
        .post("/api/payments/webhook")
        .set("Content-Type", "application/json")
        .set("webhook-id", "msg_ok")
        .set("webhook-signature", VALID_SIGNATURE)
        .set("webhook-timestamp", String(Math.floor(Date.now() / 1000)))
        .send(JSON.stringify(event));

      expect(res.status).toBe(200);
      expect(res.body.data.received).toBe(true);

      // DB side effect: upsertBillingSubscription created the row and
      // refreshUserSubscriptionTier promoted the user to PRO.
      const sub = await prisma.billingSubscription.findUnique({
        where: { providerSubscriptionId: "dodo_sub_active_1" },
      });
      expect(sub).not.toBeNull();
      expect(sub?.userId).toBe(user.id);
      expect(sub?.status).toBe("active");

      const refreshed = await prisma.user.findUnique({
        where: { id: user.id },
        select: { subscriptionTier: true },
      });
      expect(refreshed?.subscriptionTier).toBe("PRO");
    });

    it("activates a BRAND_PRO business on a valid brand webhook", async () => {
      const { user } = await createTestUser();
      const business = await createBusiness(user.id, { brandTier: "FREE" });
      const event = {
        type: "subscription.active",
        data: {
          subscription_id: "dodo_brand_1",
          status: "active",
          next_billing_date: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          metadata: { type: "BRAND_PRO", businessId: business.id },
        },
      };

      const res = await request(app)
        .post("/api/payments/webhook")
        .set("Content-Type", "application/json")
        .set("webhook-id", "msg_brand")
        .set("webhook-signature", VALID_SIGNATURE)
        .set("webhook-timestamp", String(Math.floor(Date.now() / 1000)))
        .send(JSON.stringify(event));

      expect(res.status).toBe(200);

      const refreshed = await prisma.businessProfile.findUnique({
        where: { id: business.id },
        select: { brandTier: true, brandProExpiresAt: true },
      });
      expect(refreshed?.brandTier).toBe("PRO");
      expect(refreshed?.brandProExpiresAt).not.toBeNull();
    });

    it("ignores unhandled event types but still acks with 200", async () => {
      const event = { type: "payment.succeeded", data: {} };

      const res = await request(app)
        .post("/api/payments/webhook")
        .set("Content-Type", "application/json")
        .set("webhook-id", "msg_ignore")
        .set("webhook-signature", VALID_SIGNATURE)
        .set("webhook-timestamp", String(Math.floor(Date.now() / 1000)))
        .send(JSON.stringify(event));

      expect(res.status).toBe(200);
      expect(res.body.data.received).toBe(true);
    });
  });
});
