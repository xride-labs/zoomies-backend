import { PrismaClient } from "@prisma/client";

console.log(
  "[DB] Initializing Prisma with DATABASE_URL:",
  process.env.DATABASE_URL?.substring(0, 40) + "...",
);

const prisma = new PrismaClient();

console.log("[DB] Prisma client initialized");

export default prisma;
