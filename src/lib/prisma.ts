import { PrismaClient } from "../generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(client);
const prisma = new PrismaClient({ adapter });

export default prisma;
