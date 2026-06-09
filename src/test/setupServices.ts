import { beforeAll, afterAll, afterEach } from "vitest";
import mongoose from "mongoose";
import { connectMongoDB } from "../lib/mongodb.js";
import prisma from "../lib/prisma.js";

// Connect to the (isolated) test MongoDB once per test file. connectMongoDB is
// idempotent, so chat suites get a live connection instead of the bufferCommands
// timeout that previously surfaced as a 500. Non-chat suites pay a cheap no-op.
beforeAll(async () => {
  await connectMongoDB();
});

// Keep Mongo isolated between tests the same way utils.cleanupTestData keeps
// Postgres clean. Only the chat collections live in Mongo, so wiping them is
// cheap and prevents conversation/message bleed across tests.
afterEach(async () => {
  if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
    const collections = await mongoose.connection.db.collections();
    await Promise.all(collections.map((c) => c.deleteMany({})));
  }
});

afterAll(async () => {
  await mongoose.connection.close().catch(() => undefined);
  await prisma.$disconnect().catch(() => undefined);
});
