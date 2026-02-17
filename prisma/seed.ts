import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  // Clear existing data
  console.log("🗑️  Clearing existing data...");
  await prisma.review.deleteMany();
  await prisma.report.deleteMany();
  await prisma.follow.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.like.deleteMany();
  await prisma.post.deleteMany();
  await prisma.userBadge.deleteMany();
  await prisma.badge.deleteMany();
  await prisma.emergencyContact.deleteMany();
  await prisma.userPreferences.deleteMany();
  await prisma.userRideStats.deleteMany();
  await prisma.friendship.deleteMany();
  await prisma.bike.deleteMany();
  await prisma.rideParticipant.deleteMany();
  await prisma.clubMember.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.marketplaceListing.deleteMany();
  await prisma.club.deleteMany();
  await prisma.ride.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.media.deleteMany();
  await prisma.userRoleAssignment.deleteMany();
  await prisma.user.deleteMany();

  // Use Better Auth's hashPassword (scrypt-based) so sign-in works correctly
  const hashedPassword = await hashPassword("password123");

  // ── Helper: create user + multi-role assignments ─────────────────
  async function createUserWithRoles(
    data: Parameters<typeof prisma.user.create>[0]["data"],
    roles: string[],
    passwordHash: string,
  ) {
    const user = await prisma.user.create({
      data: {
        ...data,
      },
    });
    await prisma.userRoleAssignment.createMany({
      data: roles.map((role) => ({ userId: user.id, role: role as any })),
    });
    // Better Auth stores credentials in the Account table
    await prisma.account.create({
      data: {
        userId: user.id,
        providerId: "credential",
        accountId: user.id,
        password: passwordHash,
      },
    });
    return user;
  }

  // ── Admin (super admin) ──────────────────────────────────────────
  const adminUser = await createUserWithRoles(
    {
      email: "admin@zoomies.com",
      username: "admin",
      name: "Admin User",
      phone: "+1234567890",
      emailVerified: true,
      phoneVerified: true,
      bio: "Platform administrator & club manager",
      location: "Mumbai, India",
      dob: new Date("1992-02-01"),
      bloodType: "O+",
      avatar: "https://cdn.zoomies.app/assets/avatars/admin.jpg",
      coverImage: "https://cdn.zoomies.app/assets/covers/admin.jpg",
      xpPoints: 5200,
      level: 12,
      levelTitle: "Road Commander",
      activityLevel: "Enthusiast",
      reputationScore: 5.0,
      helmetVerified: true,
      lastSafetyCheck: new Date("2026-01-12"),
    },
    ["ADMIN", "CLUB_OWNER"],
    hashedPassword,
  );
  console.log("✅ Created admin user:", adminUser.email);

  // ── Regular rider (mobile-only) ──────────────────────────────────
  const user1 = await createUserWithRoles(
    {
      email: "john@example.com",
      username: "john_rider",
      name: "John Doe",
      phone: "+1234567891",
      emailVerified: true,
      phoneVerified: true,
      bio: "Love riding on weekends!",
      location: "Bangalore, India",
      dob: new Date("1996-04-11"),
      bloodType: "B+",
      avatar: "https://cdn.zoomies.app/assets/avatars/john.jpg",
      coverImage: "https://cdn.zoomies.app/assets/covers/john.jpg",
      xpPoints: 1200,
      level: 5,
      levelTitle: "Weekend Runner",
      activityLevel: "Regular",
      reputationScore: 4.5,
      helmetVerified: true,
      lastSafetyCheck: new Date("2026-01-05"),
    },
    ["RIDER", "SELLER"],
    hashedPassword,
  );
  console.log("✅ Created user:", user1.email);

  // ── Rider + Seller (web + mobile) ────────────────────────────────
  const user2 = await createUserWithRoles(
    {
      email: "sarah@example.com",
      username: "sarah_speed",
      name: "Sarah Johnson",
      phone: "+1234567892",
      emailVerified: true,
      phoneVerified: true,
      bio: "Speed enthusiast and track day lover",
      location: "Delhi, India",
      dob: new Date("1998-09-23"),
      bloodType: "A+",
      avatar: "https://cdn.zoomies.app/assets/avatars/sarah.jpg",
      coverImage: "https://cdn.zoomies.app/assets/covers/sarah.jpg",
      xpPoints: 2500,
      level: 8,
      levelTitle: "Track Chaser",
      activityLevel: "Enthusiast",
      reputationScore: 4.8,
      helmetVerified: true,
      lastSafetyCheck: new Date("2026-01-20"),
    },
    ["RIDER", "SELLER"],
    hashedPassword,
  );
  console.log("✅ Created user:", user2.email);

  // ── Club Owner + Rider (web + mobile) ────────────────────────────
  const user3 = await createUserWithRoles(
    {
      email: "mike@example.com",
      username: "mike_adventure",
      name: "Mike Wilson",
      phone: "+1234567893",
      emailVerified: true,
      bio: "Adventure rider exploring India",
      location: "Pune, India",
      dob: new Date("1994-12-02"),
      bloodType: "O-",
      avatar: "https://cdn.zoomies.app/assets/avatars/mike.jpg",
      coverImage: "https://cdn.zoomies.app/assets/covers/mike.jpg",
      xpPoints: 3500,
      level: 10,
      levelTitle: "Trail Boss",
      activityLevel: "Enthusiast",
      reputationScore: 4.7,
      helmetVerified: true,
      lastSafetyCheck: new Date("2026-02-01"),
    },
    ["CLUB_OWNER", "RIDER", "SELLER"],
    hashedPassword,
  );
  console.log("✅ Created user:", user3.email);

  // ── Seller + Rider (web + mobile) ────────────────────────────────
  const user4 = await createUserWithRoles(
    {
      email: "lisa@example.com",
      username: "lisa_rider",
      name: "Lisa Brown",
      phone: "+1234567894",
      emailVerified: true,
      bio: "Gear enthusiast and marketplace seller",
      location: "Chennai, India",
      dob: new Date("2000-06-14"),
      bloodType: "AB+",
      avatar: "https://cdn.zoomies.app/assets/avatars/lisa.jpg",
      coverImage: "https://cdn.zoomies.app/assets/covers/lisa.jpg",
      xpPoints: 800,
      level: 3,
      levelTitle: "Starter",
      activityLevel: "Casual",
      reputationScore: 4.3,
      helmetVerified: false,
    },
    ["SELLER", "RIDER"],
    hashedPassword,
  );
  console.log("✅ Created user:", user4.email);

  // Bikes
  await prisma.bike.createMany({
    data: [
      {
        userId: adminUser.id,
        make: "Kawasaki",
        model: "Ninja 650",
        year: 2022,
        type: "SPORT",
        engineCc: 649,
        color: "Emerald Green",
        odo: 5200,
        ownerSince: new Date("2022-06-01"),
        isPrimary: true,
        modifications: { exhaust: "Akrapovic", phoneMount: true },
      },
      {
        userId: user1.id,
        make: "Royal Enfield",
        model: "Classic 350",
        year: 2020,
        type: "CRUISER",
        engineCc: 349,
        color: "Signals Desert Sand",
        odo: 15000,
        ownerSince: new Date("2020-01-15"),
        isPrimary: true,
        modifications: { lights: "LED", tyres: "Michelin Road 6" },
      },
      {
        userId: user2.id,
        make: "Yamaha",
        model: "R15 V4",
        year: 2023,
        type: "SPORT",
        engineCc: 155,
        color: "Racing Blue",
        odo: 8450,
        ownerSince: new Date("2023-02-12"),
        isPrimary: true,
        modifications: { exhaust: "Akrapovic", phoneMount: true },
      },
      {
        userId: user3.id,
        make: "KTM",
        model: "390 Adventure",
        year: 2019,
        type: "ADVENTURE",
        engineCc: 373,
        color: "Orange",
        odo: 25000,
        ownerSince: new Date("2019-03-20"),
        isPrimary: true,
        modifications: { panniers: "Touring", lights: "Aux LED" },
      },
      {
        userId: user4.id,
        make: "KTM",
        model: "Duke 200",
        year: 2021,
        type: "NAKED",
        engineCc: 199,
        color: "White",
        odo: 6400,
        ownerSince: new Date("2021-09-11"),
        isPrimary: true,
        modifications: { tyres: "Pirelli Diablo" },
      },
    ],
  });
  console.log("✅ Created bikes");

  // Badges
  const badgeFirstRide = await prisma.badge.create({
    data: {
      title: "First Ride",
      description: "Completed your first ride",
      icon: "🏁",
      auraPoints: 100,
      category: "achievement",
    },
  });
  const badge1000Km = await prisma.badge.create({
    data: {
      title: "1000 KM Club",
      description: "Crossed 1000km total distance",
      icon: "🔥",
      auraPoints: 150,
      category: "distance",
    },
  });
  const badgeNightOwl = await prisma.badge.create({
    data: {
      title: "Night Owl",
      description: "Completed 10 night rides",
      icon: "🌙",
      auraPoints: 120,
      category: "activity",
    },
  });
  await prisma.userBadge.createMany({
    data: [
      { userId: user1.id, badgeId: badgeFirstRide.id },
      { userId: user1.id, badgeId: badge1000Km.id },
      { userId: user2.id, badgeId: badgeFirstRide.id },
      { userId: user2.id, badgeId: badgeNightOwl.id },
      { userId: user3.id, badgeId: badgeFirstRide.id },
      { userId: user4.id, badgeId: badgeFirstRide.id },
    ],
  });
  console.log("✅ Created badges and user badges");

  // Emergency contacts
  await prisma.emergencyContact.createMany({
    data: [
      {
        userId: user1.id,
        name: "Ravi Kumar",
        phone: "+919876543210",
        relationship: "Brother",
        isPrimary: true,
      },
      {
        userId: user2.id,
        name: "Ananya Singh",
        phone: "+919812345678",
        relationship: "Friend",
        isPrimary: true,
      },
      {
        userId: user3.id,
        name: "Priya Wilson",
        phone: "+919911122233",
        relationship: "Spouse",
        isPrimary: true,
      },
    ],
  });
  console.log("✅ Created emergency contacts");

  // Preferences
  await prisma.userPreferences.createMany({
    data: [
      {
        userId: adminUser.id,
        rideReminders: true,
        serviceReminderKm: 4000,
        darkMode: false,
        units: "metric",
        openToInvite: true,
      },
      {
        userId: user1.id,
        rideReminders: true,
        serviceReminderKm: 3000,
        darkMode: true,
        units: "metric",
        openToInvite: true,
      },
      {
        userId: user2.id,
        rideReminders: true,
        serviceReminderKm: 3500,
        darkMode: false,
        units: "metric",
        openToInvite: false,
      },
      {
        userId: user3.id,
        rideReminders: false,
        serviceReminderKm: 5000,
        darkMode: true,
        units: "metric",
        openToInvite: true,
      },
      {
        userId: user4.id,
        rideReminders: true,
        serviceReminderKm: 2500,
        darkMode: true,
        units: "metric",
        openToInvite: true,
      },
    ],
  });
  console.log("✅ Created user preferences");

  // Ride stats
  await prisma.userRideStats.createMany({
    data: [
      {
        userId: adminUser.id,
        totalDistanceKm: 5400,
        longestRideKm: 420,
        totalRides: 55,
        nightRides: 14,
        weekendRides: 28,
      },
      {
        userId: user1.id,
        totalDistanceKm: 3420,
        longestRideKm: 410,
        totalRides: 48,
        nightRides: 18,
        weekendRides: 22,
      },
      {
        userId: user2.id,
        totalDistanceKm: 2800,
        longestRideKm: 320,
        totalRides: 33,
        nightRides: 10,
        weekendRides: 16,
      },
      {
        userId: user3.id,
        totalDistanceKm: 7600,
        longestRideKm: 560,
        totalRides: 72,
        nightRides: 12,
        weekendRides: 30,
      },
      {
        userId: user4.id,
        totalDistanceKm: 1200,
        longestRideKm: 180,
        totalRides: 12,
        nightRides: 4,
        weekendRides: 6,
      },
    ],
  });
  console.log("✅ Created ride stats");

  // Friendships
  await prisma.friendship.createMany({
    data: [
      { senderId: user1.id, receiverId: user2.id, status: "ACCEPTED" },
      { senderId: user2.id, receiverId: user3.id, status: "ACCEPTED" },
      { senderId: user4.id, receiverId: user1.id, status: "PENDING" },
    ],
  });
  console.log("✅ Created friendships");

  // Create Clubs
  const club1 = await prisma.club.create({
    data: {
      name: "Mumbai Riders Club",
      description:
        "Premier riding club for Mumbai bikers. Weekly rides and events.",
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
      description:
        "Scenic ride through the Western Ghats. Perfect for all skill levels.",
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

  // In-progress ride for live tracking demo
  const ride5 = await prisma.ride.create({
    data: {
      title: "Chennai Coastal Express",
      description: "Live ride along ECR — currently in progress!",
      startLocation: "Chennai, India",
      endLocation: "Mahabalipuram, India",
      experienceLevel: "Beginner",
      pace: "Moderate",
      distance: 55.0,
      duration: 90,
      scheduledAt: new Date(Date.now() - 30 * 60 * 1000),
      status: "IN_PROGRESS",
      creatorId: user4.id,
    },
  });
  console.log("✅ Created live ride:", ride5.title);

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
      { rideId: ride5.id, userId: user4.id, status: "ACCEPTED" },
      { rideId: ride5.id, userId: user1.id, status: "ACCEPTED" },
    ],
  });
  console.log("✅ Created ride participants");

  // Create Marketplace Listings
  const listing1 = await prisma.marketplaceListing.create({
    data: {
      title: "AGV K3 SV Helmet - Size L",
      description:
        "Brand new AGV helmet, never used. Comes with original box and accessories.",
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
      description:
        "Well maintained bike, single owner. All service records available.",
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
      description:
        "Perfect for recording your rides. Includes helmet and handlebar mounts.",
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
      {
        postId: post1.id,
        authorId: user2.id,
        content: "Wow! That sounds amazing! 🔥",
      },
      {
        postId: post1.id,
        authorId: user3.id,
        content: "I want to do this ride too!",
      },
      { postId: post2.id, authorId: user1.id, content: "Count me in! 👍" },
      {
        postId: post3.id,
        authorId: user2.id,
        content: "Is this still available?",
      },
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
      {
        listingId: listing1.id,
        reviewerId: user1.id,
        rating: 5.0,
        comment: "Great seller, fast response!",
      },
      {
        listingId: listing2.id,
        reviewerId: user2.id,
        rating: 4.5,
        comment: "Good quality jacket",
      },
      {
        listingId: listing4.id,
        reviewerId: user1.id,
        rating: 5.0,
        comment: "Excellent condition, as described",
      },
    ],
  });
  console.log("✅ Created reviews");

  console.log("\n🎉 Database seed completed successfully!");
  console.log("\n📊 Summary:");
  console.log("   - Users: 5 (1 admin, 4 riders)");
  console.log("   - Multi-role assignments: ✅");
  console.log("   - Clubs: 3");
  console.log("   - Rides: 5 (4 planned, 1 live)");
  console.log("   - Marketplace Listings: 4");
  console.log("   - Posts: 3");
  console.log("   - Likes, Comments, Follows, Reviews: Multiple");
  console.log("   - Bikes, Badges, Preferences, Ride Stats, Friendships: ✅");
  console.log("\n🔑 Test Credentials (password: password123):");
  console.log(
    "   admin@zoomies.com      → ADMIN + CLUB_OWNER         (web + mobile)",
  );
  console.log(
    "   john@example.com       → RIDER                      (mobile only)",
  );
  console.log(
    "   sarah@example.com      → RIDER + SELLER             (mobile + web)",
  );
  console.log(
    "   mike@example.com       → CLUB_OWNER + RIDER         (web + mobile)",
  );
  console.log(
    "   lisa@example.com       → SELLER + RIDER             (web + mobile)",
  );
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
