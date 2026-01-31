import { PrismaClient } from "../src/generated/prisma/index.js";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  // Create a test user
  const hashedPassword = await bcrypt.hash("password123", 12);

  const testUser = await prisma.user.upsert({
    where: { email: "test@example.com" },
    update: {},
    create: {
      email: "test@example.com",
      name: "Test User",
      password: hashedPassword,
      emailVerified: new Date(),
      bio: "Just a test user for development",
      location: "San Francisco, CA",
    },
  });

  console.log("✅ Created test user:", testUser.email);

  // Create a sample ride
  const sampleRide = await prisma.ride.create({
    data: {
      title: "Morning Coastal Ride",
      description: "A beautiful morning ride along the coast",
      startLocation: "San Francisco, CA",
      endLocation: "Half Moon Bay, CA",
      distance: 45.5,
      duration: 120,
      creatorId: testUser.id,
      status: "PLANNED",
    },
  });

  console.log("✅ Created sample ride:", sampleRide.title);

  // Create a sample club
  const sampleClub = await prisma.club.create({
    data: {
      name: "Bay Area Riders",
      description: "A community for cycling enthusiasts in the Bay Area",
      isPublic: true,
      ownerId: testUser.id,
    },
  });

  console.log("✅ Created sample club:", sampleClub.name);

  // Create a sample marketplace listing
  const sampleListing = await prisma.marketplaceListing.create({
    data: {
      title: "Vintage Road Bike",
      description:
        "Classic road bike in excellent condition. Perfect for casual rides.",
      price: 350.0,
      currency: "USD",
      category: "Bikes",
      condition: "Good",
      images: [],
      sellerId: testUser.id,
      status: "ACTIVE",
    },
  });

  console.log("✅ Created sample listing:", sampleListing.title);

  console.log("🎉 Database seed completed!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
