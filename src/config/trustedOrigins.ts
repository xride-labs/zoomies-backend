/**
 * Centralized trusted origins configuration
 * Used by both CORS and Better Auth for consistent origin validation
 */

function parseOrigins(value?: string): string[] {
  if (!value) return [];

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

// Development local origins
const LOCALHOST_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "http://localhost:3003",
  "http://localhost:5173",
  "http://localhost:4173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:3002",
  "http://127.0.0.1:3003",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:4173",
  "http://localhost:5000",
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  "http://10.0.2.2:8081",
  "http://10.0.2.2:5000",
];

// Mobile/Expo origins
const MOBILE_ORIGINS = [
  "exp://localhost:8081",
  "exp://10.0.2.2:8081",
  "http://10.0.2.2:19000",
  "http://localhost:19000",
  "http://10.0.2.2:19006",
  "http://localhost:19006",
];

// Production origins
const PRODUCTION_ORIGINS = [
  "https://zoomies.xride-labs.in",
  "https://api.zoomies.xride-labs.in",
  process.env.FRONTEND_URL || "",
  process.env.MOBILE_APP_URL || "",
].filter(Boolean);

// Extra origins can be provided as comma-separated URLs via env.
const ADDITIONAL_ORIGINS = parseOrigins(
  process.env.ADDITIONAL_TRUSTED_ORIGINS || process.env.CORS_ORIGIN,
);

/**
 * Complete list of all trusted origins
 * Used for both CORS and Better Auth origin validation
 */
export const TRUSTED_ORIGINS = [
  ...PRODUCTION_ORIGINS,
  ...LOCALHOST_ORIGINS,
  ...MOBILE_ORIGINS,
  ...ADDITIONAL_ORIGINS,
].filter(Boolean);

/**
 * CORS configuration using trusted origins
 */
export const CORS_OPTIONS = {
  origin: TRUSTED_ORIGINS,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};

/**
 * Export origins by category for debugging/logging
 */
export const ORIGINS_BY_CATEGORY = {
  production: PRODUCTION_ORIGINS,
  localhost: LOCALHOST_ORIGINS,
  mobile: MOBILE_ORIGINS,
  additional: ADDITIONAL_ORIGINS,
  all: TRUSTED_ORIGINS,
};
