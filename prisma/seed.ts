import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  // Clear existing data
  console.log("🗑️  Clearing existing data...");
  await prisma.review.deleteMany();
  await prisma.follow.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.like.deleteMany();
  await prisma.post.deleteMany();
  await prisma.rideParticipant.deleteMany();
  await prisma.clubMember.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.marketplaceListing.deleteMany();
  await prisma.club.deleteMany();
  await prisma.ride.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.media.deleteMany();
  await prisma.user.deleteMany();

  const hashedPassword = await bcrypt.hash("password123", 12);

  // Create Admin User
  const adminUser = await prisma.user.create({
    data: {
      email: "admin@zoomies.com",
      username: "admin",
      name: "Admin User",
      password: hashedPassword,
      phone: "+1234567890",
      emailVerified: new Date(),
      phoneVerified: new Date(),
      role: "ADMIN",
      bio: "Platform administrator",
      location: "Mumbai, India",
      bikeType: "Sport",
      bikeOwned: "Kawasaki Ninja 650",
      xpPoints: 5000,
      experienceLevel: "Expert",
      levelOfActivity: "Enthusiast",
      reputationScore: 5.0,
    },
  });
  console.log("✅ Created admin user:", adminUser.email);

  // Create Regular Users
  const user1 = await prisma.user.create({
    data: {
      email: "john@example.com",
      username: "john_rider",
      name: "John Doe",
      password: hashedPassword,
      phone: "+1234567891",
      emailVerified: new Date(),
      phoneVerified: new Date(),
      role: "RIDER",
      bio: "Love riding on weekends!",
      location: "Bangalore, India",
      bikeType: "Cruiser",
      bikeOwned: "Royal Enfield Classic 350",
      bikeOwnerSince: new Date("2020-01-15"),
      bikeOdometer: 15000,
      xpPoints: 1200,
      experienceLevel: "Intermediate",
      levelOfActivity: "Regular",
      reputationScore: 4.5,
    },
  });
  console.log("✅ Created user:", user1.email);

  const user2 = await prisma.user.create({
    data: {
      email: "sarah@example.com",
      username: "sarah_speed",
      name: "Sarah Johnson",
      password: hashedPassword,
      phone: "+1234567892",
      emailVerified: new Date(),
      phoneVerified: new Date(),
      role: "RIDER",
      bio: "Speed enthusiast and track day lover",
      location: "Delhi, India",
      bikeType: "Sport",
      bikeOwned: "Yamaha YZF-R15",
      bikeOwnerSince: new Date("2021-06-10"),
      bikeOdometer: 8000,
      xpPoints: 2500,
      experienceLevel: "Expert",
      levelOfActivity: "Enthusiast",
      reputationScore: 4.8,
    },
  });
  console.log("✅ Created user:", user2.email);

  const user3 = await prisma.user.create({
    data: {
      email: "mike@example.com",
      username: "mike_adventure",
      name: "Mike Wilson",
      password: hashedPassword,
      phone: "+1234567893",
      emailVerified: new Date(),
      role: "CLUB_OWNER",
      bio: "Adventure rider exploring India",
      location: "Pune, India",
      bikeType: "Adventure",
      bikeOwned: "KTM 390 Adventure",
      bikeOwnerSince: new Date("2019-03-20"),
      bikeOdometer: 25000,
      xpPoints: 3500,
      experienceLevel: "Expert",
      levelOfActivity: "Enthusiast",
      reputationScore: 4.7,
    },
  });
  console.log("✅ Created user:", user3.email);

  const user4 = await prisma.user.create({
    data: {
      email: "lisa@example.com",
      username: "lisa_rider",
      name: "Lisa Brown",
      password: hashedPassword,
      phone: "+1234567894",
      emailVerified: new Date(),
      role: "SELLER",
      bio: "Gear enthusiast and marketplace seller",
      location: "Chennai, India",
      bikeType: "Naked",
      bikeOwned: "KTM Duke 200",
      xpPoints: 800,
      experienceLevel: "Beginner",
      levelOfActivity: "Casual",
      reputationScore: 4.3,
    },
  });
  console.log("✅ Created user:", user4.email);

  // Create Clubs
  const club1 = await prisma.club.create({
    data: {
      name: "Mumbai Riders Club",
      description: "Premier riding club for Mumbai bikers. Weekly rides and events.",
      location: "Mumbai, India",
      establishedAt: new Date("2018-05-01"),
      verified: true,
      clubType: "Riding Club",
      isPublic: true,
      memberCount: 3,
      trophies: ["Best Club 2023", "Most Active Club"],
      trophyCount: 2,
      reputation: 4.8,
      ownerId: adminUser.id,
    },
  });
  console.log("✅ Created club:", club1.name);

  const club2 = await prisma.club.create({
    data: {
      name: "Bangalore Adventure Riders",
      description: "For those who love off-road and adventure riding",
      location: "Bangalore, India",
      establishedAt: new Date("2020-08-15"),
      verified: true,
      clubType: "Adventure Club",
      isPublic: true,
      memberCount: 2,
      trophies: ["Adventure Champions"],
      trophyCount: 1,
      reputation: 4.6,
      ownerId: user3.id,
    },
  });
  console.log("✅ Created club:", club2.name);

  const club3 = await prisma.club.create({
    data: {
      name: "Delhi Speed Demons",
      description: "Track day enthusiasts and speed lovers",
      location: "Delhi, India",
      verified: false,
      clubType: "Sport Club",
      isPublic: true,
      memberCount: 1,
      reputation: 4.5,
      ownerId: user2.id,
    },
  });
  console.log("✅ Created club:", club3.name);

  // Create Club Members
  await prisma.clubMember.createMany({
    data: [
      { clubId: club1.id, userId: adminUser.id, role: "FOUNDER" },
      { clubId: club1.id, userId: user1.id, role: "MEMBER" },
      { clubId: club1.id, userId: user2.id, role: "OFFICER" },
      { clubId: club2.id, userId: user3.id, role: "FOUNDER" },
      { clubId: club2.id, userId: user1.id, role: "MEMBER" },
      { clubId: club3.id, userId: user2.id, role: "FOUNDER" },
    ],
  });
  console.log("✅ Created club memberships");

  // Create Rides
  const ride1 = await prisma.ride.create({
    data: {
      title: "Mumbai to Lonavala Weekend Ride",
      description: "Scenic ride through the Western Ghats. Perfect for all skill levels.",
      startLocation: "Mumbai, India",
      endLocation: "Lonavala, India",
      experienceLevel: "Intermediate",
      xpRequired: 500,
      pace: "Moderate",
      distance: 83.5,
      duration: 180,
      scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: "PLANNED",
      creatorId: adminUser.id,
      clubId: club1.id,
    },
  });
  console.log("✅ Created ride:", ride1.title);

  const ride2 = await prisma.ride.create({
    data: {
      title: "Bangalore to Nandi Hills Sunrise Ride",
      description: "Early morning ride to catch the sunrise at Nandi Hills",
      startLocation: "Bangalore, India",
      endLocation: "Nandi Hills, India",
      experienceLevel: "Beginner",
      xpRequired: 100,
      pace: "Leisurely",
      distance: 60.0,
      duration: 120,
      scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      status: "PLANNED",
      creatorId: user1.id,
      clubId: club2.id,
    },
  });
  console.log("✅ Created ride:", ride2.title);

  const ride3 = await prisma.ride.create({
    data: {
      title: "Delhi to Agra Day Trip",
      description: "Visit the Taj Mahal on two wheels!",
      startLocation: "Delhi, India",
      endLocation: "Agra, India",
      experienceLevel: "Intermediate",
      xpRequired: 800,
      pace: "Fast",
      distance: 230.0,
      duration: 240,
      scheduledAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      status: "PLANNED",
      creatorId: user2.id,
      clubId: club3.id,
    },
  });
  console.log("✅ Created ride:", ride3.title);

  const ride4 = await prisma.ride.create({
    data: {
      title: "Pune City Night Ride",
      description: "Casual night ride through Pune city",
      startLocation: "Pune, India",
      endLocation: "Pune, India",
      experienceLevel: "Beginner",
      pace: "Leisurely",
      distance: 25.0,
      duration: 90,
      scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      status: "PLANNED",
      creatorId: user3.id,
    },
  });
  console.log("✅ Created ride:", ride4.title);

  // Create Ride Participants
  await prisma.rideParticipant.createMany({
    data: [
      { rideId: ride1.id, userId: user1.id, status: "ACCEPTED" },
      { rideId: ride1.id, userId: user2.id, status: "ACCEPTED" },
      { rideId: ride1.id, userId: user3.id, status: "REQUESTED" },
      { rideId: ride2.id, userId: user2.id, status: "ACCEPTED" },
      { rideId: ride2.id, userId: user3.id, status: "ACCEPTED" },
      { rideId: ride3.id, userId: user1.id, status: "REQUESTED" },
      { rideId: ride4.id, userId: user1.id, status: "ACCEPTED" },
    ],
  });
  console.log("✅ Created ride participants");

  // Create Marketplace Listings
  const listing1 = await prisma.marketplaceListing.create({
    data: {
      title: "AGV K3 SV Helmet - Size L",
      description: "Brand new AGV helmet, never used. Comes with original box and accessories.",
      price: 15000,
      currency: "INR",
      category: "Gear",
      subcategory: "Helmet",
      condition: "New",
      images: [],
      status: "ACTIVE",
      sellerId: user4.id,
    },
  });
  console.log("✅ Created listing:", listing1.title);

  const listing2 = await prisma.marketplaceListing.create({
    data: {
      title: "Alpinestars Riding Jacket - Medium",
      description: "Lightly used riding jacket with armor. Great condition.",
      price: 8500,
      currency: "INR",
      category: "Gear",
      subcategory: "Jacket",
      condition: "Good",
      images: [],
      status: "ACTIVE",
      sellerId: user4.id,
    },
  });
  console.log("✅ Created listing:", listing2.title);

  const listing3 = await prisma.marketplaceListing.create({
    data: {
      title: "Royal Enfield Classic 350 - 2019",
      description: "Well maintained bike, single owner. All service records available.",
      price: 125000,
      currency: "INR",
      category: "Motorcycle",
      condition: "Excellent",
      images: [],
      status: "ACTIVE",
      sellerId: user1.id,
    },
  });
  console.log("✅ Created listing:", listing3.title);

  const listing4 = await prisma.marketplaceListing.create({
    data: {
      title: "GoPro Hero 10 with Mounts",
      description: "Perfect for recording your rides. Includes helmet and handlebar mounts.",
      price: 28000,
      currency: "INR",
      category: "Accessories",
      condition: "Good",
      images: [],
      status: "SOLD",
      sellerId: user3.id,
    },
  });
  console.log("✅ Created listing:", listing4.title);

  // Create Posts
  const post1 = await prisma.post.create({
    data: {
      type: "content",
      content: "Just completed an amazing 500km ride through the Himalayas! 🏔️",
      images: [],
      authorId: user1.id,
    },
  });
  console.log("✅ Created post by:", user1.name);

  const post2 = await prisma.post.create({
    data: {
      type: "ride",
      content: "Join us for an epic ride to Lonavala this weekend!",
      images: [],
      authorId: adminUser.id,
      rideId: ride1.id,
    },
  });
  console.log("✅ Created post by:", adminUser.name);

  const post3 = await prisma.post.create({
    data: {
      type: "listing",
      content: "Selling my AGV helmet - brand new condition!",
      images: [],
      authorId: user4.id,
      listingId: listing1.id,
    },
  });
  console.log("✅ Created post by:", user4.name);

  // Create Likes
  await prisma.like.createMany({
    data: [
      { postId: post1.id, userId: user2.id },
      { postId: post1.id, userId: user3.id },
      { postId: post1.id, userId: adminUser.id },
      { postId: post2.id, userId: user1.id },
      { postId: post2.id, userId: user2.id },
      { postId: post3.id, userId: user1.id },
    ],
  });
  console.log("✅ Created likes");

  // Create Comments
  await prisma.comment.createMany({
    data: [
      { postId: post1.id, authorId: user2.id, content: "Wow! That sounds amazing! 🔥" },
      { postId: post1.id, authorId: user3.id, content: "I want to do this ride too!" },
      { postId: post2.id, authorId: user1.id, content: "Count me in! 👍" },
      { postId: post3.id, authorId: user2.id, content: "Is this still available?" },
    ],
  });
  console.log("✅ Created comments");

  // Create Follows
  await prisma.follow.createMany({
    data: [
      { followerId: user1.id, followingId: user2.id },
      { followerId: user1.id, followingId: user3.id },
      { followerId: user2.id, followingId: user1.id },
      { followerId: user2.id, followingId: adminUser.id },
      { followerId: user3.id, followingId: user1.id },
      { followerId: user4.id, followingId: user1.id },
    ],
  });
  console.log("✅ Created follows");

  // Create Reviews
  await prisma.review.createMany({
    data: [
      { listingId: listing1.id, reviewerId: user1.id, rating: 5.0, comment: "Great seller, fast response!" },
      { listingId: listing2.id, reviewerId: user2.id, rating: 4.5, comment: "Good quality jacket" },
      { listingId: listing4.id, reviewerId: user1.id, rating: 5.0, comment: "Excellent condition, as described" },
    ],
  });
  console.log("✅ Created reviews");

  console.log("\n🎉 Database seed completed successfully!");
  console.log("\n📊 Summary:");
  console.log("   - Users: 5 (1 admin, 4 regular users)");
  console.log("   - Clubs: 3");
  console.log("   - Rides: 4");
  console.log("   - Marketplace Listings: 4");
  console.log("   - Posts: 3");
  console.log("   - Likes, Comments, Follows, Reviews: Multiple");
  console.log("\n🔑 Test Credentials:");
  console.log("   Email: admin@zoomies.com | Password: password123");
  console.log("   Email: john@example.com | Password: password123");
  console.log("   Email: sarah@example.com | Password: password123");
  console.log("   Email: mike@example.com | Password: password123");
  console.log("   Email: lisa@example.com | Password: password123");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
