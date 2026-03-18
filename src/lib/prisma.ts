import { PrismaClient } from "@prisma/client";

console.log(
  "[DB] Initializing Prisma with DATABASE_URL:",
  process.env.DATABASE_URL?.substring(0, 40) + "...",
);

const prisma = new PrismaClient();

console.log("[DB] Prisma client initialized");

let postgresConnectPromise: Promise<void> | null = null;

export async function connectPostgres(): Promise<void> {
  if (postgresConnectPromise) {
    return postgresConnectPromise;
  }

  postgresConnectPromise = prisma
    .$connect()
    .then(() => {
      console.log("✅ PostgreSQL connected successfully");
    })
    .catch((error: Error) => {
      postgresConnectPromise = null;
      console.error("❌ PostgreSQL connection failed:", error.message);
      throw error;
    });

  return postgresConnectPromise;
}

export default prisma;
