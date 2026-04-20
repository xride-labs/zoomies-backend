import { Webhook } from "standardwebhooks";

export type DodoWebhookEvent = {
  business_id?: string;
  type?: string;
  timestamp?: string;
  data?: {
    payload_type?: string;
    subscription_id?: string;
    status?: string;
    next_billing_date?: string;
    cancelled_at?: string | null;
    customer?: {
      customer_id?: string;
      email?: string;
      name?: string;
    };
    metadata?: Record<string, string>;
    [key: string]: unknown;
  };
};

type CreateCheckoutSessionInput = {
  productId: string;
  quantity?: number;
  customer?: {
    email?: string | null;
    name?: string | null;
  };
  returnUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, string>;
};

type DodoRequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
};

function getBaseUrl(): string {
  const configuredBaseUrl = process.env.DODO_PAYMENTS_BASE_URL?.trim();
  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/$/, "");
  }

  return process.env.DODO_PAYMENTS_ENVIRONMENT === "test_mode"
    ? "https://test.dodopayments.com"
    : "https://live.dodopayments.com";
}

function getApiKey(): string {
  const apiKey = process.env.DODO_PAYMENTS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("DODO_PAYMENTS_API_KEY is not configured");
  }
  return apiKey;
}

function getWebhookSecret(): string | null {
  return process.env.DODO_PAYMENTS_WEBHOOK_KEY?.trim() || null;
}

async function dodoRequest<T>(
  path: string,
  options: DodoRequestOptions = {},
): Promise<T> {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const rawText = await response.text();
  const parsedBody = rawText ? JSON.parse(rawText) : null;

  if (!response.ok) {
    const errorMessage =
      parsedBody?.message || parsedBody?.error?.message || "Dodo API request failed";
    throw new Error(`${errorMessage} (HTTP ${response.status})`);
  }

  return parsedBody as T;
}

export async function createDodoCheckoutSession(
  input: CreateCheckoutSessionInput,
): Promise<{ checkout_url?: string; url?: string; session_id?: string }> {
  const fallbackReturnUrl = process.env.DODO_PAYMENTS_RETURN_URL?.trim();
  const fallbackCancelUrl = process.env.DODO_PAYMENTS_CANCEL_URL?.trim();

  if (!input.returnUrl && !fallbackReturnUrl) {
    throw new Error("DODO_PAYMENTS_RETURN_URL is not configured");
  }

  return dodoRequest("/checkouts", {
    method: "POST",
    body: {
      product_cart: [
        {
          product_id: input.productId,
          quantity: input.quantity || 1,
        },
      ],
      customer: {
        email: input.customer?.email || undefined,
        name: input.customer?.name || undefined,
      },
      return_url: input.returnUrl || fallbackReturnUrl,
      cancel_url: input.cancelUrl || fallbackCancelUrl || undefined,
      metadata: input.metadata,
    },
  });
}

export async function createCustomerPortalSession(
  customerId: string,
  sendEmail = false,
): Promise<{ portal_url?: string; url?: string }> {
  const encodedCustomerId = encodeURIComponent(customerId);
  const query = sendEmail ? "?send_email=true" : "";

  return dodoRequest(
    `/customers/${encodedCustomerId}/customer-portal/session${query}`,
    {
      method: "POST",
    },
  );
}

export function verifyDodoWebhook(
  rawBody: string,
  headers: Record<string, string>,
): DodoWebhookEvent {
  const webhookSecret = getWebhookSecret();

  if (!webhookSecret) {
    return JSON.parse(rawBody) as DodoWebhookEvent;
  }

  const webhook = new Webhook(webhookSecret);
  return webhook.verify(rawBody, headers) as DodoWebhookEvent;
}

export function getDodoConfigStatus() {
  return {
    environment:
      process.env.DODO_PAYMENTS_ENVIRONMENT === "test_mode"
        ? "test_mode"
        : "live_mode",
    hasApiKey: Boolean(process.env.DODO_PAYMENTS_API_KEY?.trim()),
    hasWebhookKey: Boolean(process.env.DODO_PAYMENTS_WEBHOOK_KEY?.trim()),
    hasReturnUrl: Boolean(process.env.DODO_PAYMENTS_RETURN_URL?.trim()),
    hasMonthlyProductId: Boolean(
      process.env.DODO_PRO_MONTHLY_PRODUCT_ID?.trim(),
    ),
    hasAnnualProductId: Boolean(
      process.env.DODO_PRO_ANNUAL_PRODUCT_ID?.trim(),
    ),
  };
}