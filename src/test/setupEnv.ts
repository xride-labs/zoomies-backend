import dotenv from "dotenv";

// Force the test environment before anything else loads. Vitest already sets
// NODE_ENV=test, but we pin it explicitly so app code that branches on it (auth
// email verification, rate limits, logging) behaves deterministically.
process.env.NODE_ENV = "test";

// Load .env for DATABASE_URL / secrets. `override` defaults to false, so the
// NODE_ENV we set above is preserved even though .env declares "development".
dotenv.config();

// Stable secrets for the JWT bridge in the Better Auth mock (see
// src/test/mocks/better-auth.ts). createMockToken signs with the same fallback.
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.BETTER_AUTH_SECRET =
  process.env.BETTER_AUTH_SECRET || "test-better-auth-secret";

// Point chat (MongoDB) at an isolated test database on the SAME running Mongo
// instance, so suites never read or wipe the dev "revvie_chat" data. The db
// name is the path segment between the host and the query string. mongodb.ts
// captures MONGODB_URI at import time, so this must run before it loads (it
// does — setupFiles run before any test module is imported).
if (process.env.MONGODB_URI) {
  process.env.MONGODB_URI = process.env.MONGODB_URI.replace(
    /(mongodb(?:\+srv)?:\/\/[^/]+\/)([^?]*)/i,
    (_match, prefix: string) => `${prefix}revvie_chat_test`,
  );
}
