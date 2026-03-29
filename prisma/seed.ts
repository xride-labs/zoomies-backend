import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

const prisma = new PrismaClient();

const IS_PROD = process.env.NODE_ENV === "production";
const PRIMARY_ADMIN_EMAIL = "admin@zoomies.com";
const GOOGLE_ADMIN_EMAIL = "krithikm923@gmail.com";

async function ensureGoogleAdminSeedUser(): Promise<void> {
  const googleAdmin = await prisma.user.upsert({
    where: { email: GOOGLE_ADMIN_EMAIL },
    update: {
      name: "Krithik M",
      emailVerified: true,
    },
    create: {
      email: GOOGLE_ADMIN_EMAIL,
      name: "Krithik M",
      emailVerified: true,
      bio: "Platform admin user",
      location: "Bangalore, India",
    },
  });

  await prisma.userRoleAssignment.createMany({
    data: [
      { userId: googleAdmin.id, role: "ADMIN" as const },
      { userId: googleAdmin.id, role: "RIDER" as const },
    ],
    skipDuplicates: true,
  });

  console.log(`✅ Ensured ${GOOGLE_ADMIN_EMAIL} has ADMIN + RIDER roles`);
}

async function seedProductionAdmin(passwordHash: string): Promise<void> {
  console.log("🌱 Running production-safe seed (no destructive deletes)...");

  const adminUser = await prisma.user.upsert({
    where: { email: PRIMARY_ADMIN_EMAIL },
    update: {
      name: "Admin User",
      emailVerified: true,
      phoneVerified: true,
      bio: "Platform administrator & club manager",
      location: "Mumbai, India",
      dob: new Date("1992-02-01"),
      bloodType: "O+",
      avatar:
        "https://res.cloudinary.com/xride-labs/image/upload/v1772386875/zoomies/rides/avatar_hgoxkz.jpg",
      coverImage:
        "https://res.cloudinary.com/xride-labs/image/upload/v1772387502/zoomies/rides/bannerBackgroundImage_o8qnzwji8ckd1_rynbjl.png",
      xpPoints: 5200,
      level: 12,
      levelTitle: "Road Commander",
      activityLevel: "Enthusiast",
      reputationScore: 5.0,
      helmetVerified: true,
      lastSafetyCheck: new Date("2026-01-12"),
    },
    create: {
      email: PRIMARY_ADMIN_EMAIL,
      name: "Admin User",
      emailVerified: true,
      phoneVerified: true,
      bio: "Platform administrator & club manager",
      location: "Mumbai, India",
      dob: new Date("1992-02-01"),
      bloodType: "O+",
      avatar:
        "https://res.cloudinary.com/xride-labs/image/upload/v1772386875/zoomies/rides/avatar_hgoxkz.jpg",
      coverImage:
        "https://res.cloudinary.com/xride-labs/image/upload/v1772387502/zoomies/rides/bannerBackgroundImage_o8qnzwji8ckd1_rynbjl.png",
      xpPoints: 5200,
      level: 12,
      levelTitle: "Road Commander",
      activityLevel: "Enthusiast",
      reputationScore: 5.0,
      helmetVerified: true,
      lastSafetyCheck: new Date("2026-01-12"),
    },
  });

  await ensureGoogleAdminSeedUser();

  await prisma.userRoleAssignment.createMany({
    data: [
      { userId: adminUser.id, role: "ADMIN" as const },
      { userId: adminUser.id, role: "CLUB_OWNER" as const },
    ],
    skipDuplicates: true,
  });

  await prisma.account.upsert({
    where: {
      providerId_accountId: {
        providerId: "credential",
        accountId: adminUser.id,
      },
    },
    update: {
      userId: adminUser.id,
      password: passwordHash,
    },
    create: {
      userId: adminUser.id,
      providerId: "credential",
      accountId: adminUser.id,
      password: passwordHash,
    },
  });

  console.log("✅ Production seed completed safely");
  console.log(`🔑 ${PRIMARY_ADMIN_EMAIL} / password123  -> ADMIN + CLUB_OWNER`);
  console.log(`🟢 ${GOOGLE_ADMIN_EMAIL} -> ADMIN + RIDER`);
}

async function main() {
  console.log(`🌱 Starting ${IS_PROD ? "PRODUCTION" : "DEVELOPMENT"} seed...`);

  const hashedPassword = await hashPassword("password123");

  if (IS_PROD) {
    await seedProductionAdmin(hashedPassword);
    return;
  }

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
  await prisma.clubJoinRequest.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.marketplaceListing.deleteMany();
  await prisma.friendGroupMember.deleteMany();
  await prisma.friendGroup.deleteMany();
  await prisma.club.deleteMany();
  await prisma.ride.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.media.deleteMany();
  await prisma.userRoleAssignment.deleteMany();
  await prisma.user.deleteMany();

  // ── Helper ──────────────────────────────────────────────────────
  async function createUserWithRoles(
    data: Parameters<typeof prisma.user.create>[0]["data"],
    roles: string[],
    passwordHash: string,
  ) {
    const user = await prisma.user.create({ data });
    await prisma.userRoleAssignment.createMany({
      data: roles.map((role) => ({ userId: user.id, role: role as any })),
    });
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

  // ══════════════════════════════════════════════════════════════════
  //  ADMIN USER (always created)
  // ══════════════════════════════════════════════════════════════════
  const adminUser = await createUserWithRoles(
    {
      email: PRIMARY_ADMIN_EMAIL,
      username: "admin",
      name: "Admin User",
      phone: "+1234567890",
      emailVerified: true,
      phoneVerified: true,
      bio: "Platform administrator & club manager",
      location: "Mumbai, India",
      dob: new Date("1992-02-01"),
      bloodType: "O+",
      avatar:
        "https://res.cloudinary.com/xride-labs/image/upload/v1772386875/zoomies/rides/avatar_hgoxkz.jpg",
      coverImage:
        "https://res.cloudinary.com/xride-labs/image/upload/v1772387502/zoomies/rides/bannerBackgroundImage_o8qnzwji8ckd1_rynbjl.png",
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

  await ensureGoogleAdminSeedUser();

  // ══════════════════════════════════════════════════════════════════
  //  DEV-ONLY DATA BELOW
  // ══════════════════════════════════════════════════════════════════

  // ── Users ────────────────────────────────────────────────────────
  const devUsers = [
    {
      email: "john@example.com",
      username: "john_rider",
      name: "John Doe",
      phone: "+1234567891",
      bio: "Love riding on weekends!",
      location: "Bangalore, India",
      dob: new Date("1996-04-11"),
      bloodType: "B+",
      avatar:
        "https://res.cloudinary.com/xride-labs/image/upload/v1772560334/zoomies/rides/male_doctor_njjg5j.png",
      coverImage:
        "https://res.cloudinary.com/xride-labs/image/upload/v1772560334/zoomies/rides/119419735_udtbgq.webp",
      xpPoints: 1200,
      level: 5,
      levelTitle: "Weekend Runner",
      activityLevel: "Regular",
      reputationScore: 4.5,
      helmetVerified: true,
      lastSafetyCheck: new Date("2026-01-05"),
      roles: ["RIDER", "SELLER"],
    },
    {
      email: "sarah@example.com",
      username: "sarah_speed",
      name: "Sarah Johnson",
      phone: "+1234567892",
      bio: "Speed enthusiast and track day lover",
      location: "Delhi, India",
      dob: new Date("1998-09-23"),
      bloodType: "A+",
      avatar:
        "https://res.cloudinary.com/xride-labs/image/upload/v1772560335/zoomies/rides/Police_Woman_h2lvlq.png",
      coverImage:
        "https://res.cloudinary.com/xride-labs/image/upload/v1772560336/zoomies/rides/IMG_6600_t57x4d.webp",
      xpPoints: 2500,
      level: 8,
      levelTitle: "Track Chaser",
      activityLevel: "Enthusiast",
      reputationScore: 4.8,
      helmetVerified: true,
      lastSafetyCheck: new Date("2026-01-20"),
      roles: ["RIDER", "SELLER"],
    },
    {
      email: "mike@example.com",
      username: "mike_adventure",
      name: "Mike Wilson",
      phone: "+1234567893",
      bio: "Adventure rider exploring India",
      location: "Pune, India",
      dob: new Date("1994-12-02"),
      bloodType: "O-",
      xpPoints: 3500,
      level: 10,
      levelTitle: "Trail Boss",
      activityLevel: "Enthusiast",
      reputationScore: 4.7,
      helmetVerified: true,
      lastSafetyCheck: new Date("2026-02-01"),
      roles: ["CLUB_OWNER", "RIDER", "SELLER"],
    },
    {
      email: "lisa@example.com",
      username: "lisa_rider",
      name: "Lisa Brown",
      phone: "+1234567894",
      bio: "Gear enthusiast and marketplace seller",
      location: "Chennai, India",
      dob: new Date("2000-06-14"),
      bloodType: "AB+",
      avatar:
        "https://res.cloudinary.com/xride-labs/image/upload/v1772560334/zoomies/rides/male_doctor_njjg5j.png",
      xpPoints: 800,
      level: 3,
      levelTitle: "Starter",
      activityLevel: "Casual",
      reputationScore: 4.3,
      helmetVerified: false,
      roles: ["SELLER", "RIDER"],
    },
    {
      email: "raj@example.com",
      username: "raj_thunder",
      name: "Raj Patel",
      phone: "+1234567895",
      bio: "Thunder lover, long highway cruises",
      location: "Hyderabad, India",
      dob: new Date("1997-07-18"),
      bloodType: "A-",
      xpPoints: 1800,
      level: 7,
      levelTitle: "Highway King",
      activityLevel: "Regular",
      reputationScore: 4.4,
      helmetVerified: true,
      lastSafetyCheck: new Date("2026-01-28"),
      roles: ["RIDER"],
    },
    {
      email: "priya@example.com",
      username: "priya_cruiser",
      name: "Priya Sharma",
      phone: "+1234567896",
      bio: "Café racer enthusiast, weekend vibes only",
      location: "Bangalore, India",
      dob: new Date("1999-03-05"),
      bloodType: "B-",
      xpPoints: 2100,
      level: 6,
      levelTitle: "Café Racer",
      activityLevel: "Regular",
      reputationScore: 4.6,
      helmetVerified: true,
      lastSafetyCheck: new Date("2026-02-05"),
      roles: ["RIDER", "SELLER"],
    },
    {
      email: "arjun@example.com",
      username: "arjun_offroad",
      name: "Arjun Nair",
      phone: "+1234567897",
      bio: "Offroad trails are my therapy",
      location: "Kochi, India",
      dob: new Date("1995-11-29"),
      bloodType: "O+",
      xpPoints: 3100,
      level: 9,
      levelTitle: "Trail Blazer",
      activityLevel: "Enthusiast",
      reputationScore: 4.9,
      helmetVerified: true,
      lastSafetyCheck: new Date("2026-02-10"),
      roles: ["CLUB_OWNER", "RIDER"],
    },
    {
      email: "neha@example.com",
      username: "neha_night",
      name: "Neha Gupta",
      phone: "+1234567898",
      bio: "Night rides through the city lights",
      location: "Mumbai, India",
      dob: new Date("2001-01-15"),
      bloodType: "AB-",
      xpPoints: 950,
      level: 4,
      levelTitle: "Night Owl",
      activityLevel: "Casual",
      reputationScore: 4.2,
      helmetVerified: true,
      roles: ["RIDER"],
    },
    {
      email: "vikram@example.com",
      username: "vikram_vroom",
      name: "Vikram Singh",
      phone: "+1234567899",
      bio: "Vintage motorcycle collector and restorer",
      location: "Jaipur, India",
      dob: new Date("1993-08-22"),
      bloodType: "B+",
      xpPoints: 4200,
      level: 11,
      levelTitle: "Vintage King",
      activityLevel: "Pro",
      reputationScore: 4.8,
      helmetVerified: true,
      lastSafetyCheck: new Date("2026-01-15"),
      roles: ["CLUB_OWNER", "RIDER", "SELLER"],
    },
  ];

  const createdUsers: any[] = [];
  for (const u of devUsers) {
    const { roles, ...userData } = u;
    const user = await createUserWithRoles(
      { ...userData, emailVerified: true, phoneVerified: !!u.phone },
      roles,
      hashedPassword,
    );
    createdUsers.push(user);
  }
  const allUsers = [adminUser, ...createdUsers];
  const [user1, user2, user3, user4, user5, user6, user7, user8, user9] =
    createdUsers;
  console.log(`✅ Created ${createdUsers.length} dev users`);

  // ── Bikes ────────────────────────────────────────────────────────
  const bikeData = [
    {
      userId: adminUser.id,
      make: "Kawasaki",
      model: "Ninja 650",
      year: 2022,
      type: "SPORT" as const,
      engineCc: 649,
      color: "Emerald Green",
      odo: 5200,
      isPrimary: true,
    },
    {
      userId: user1.id,
      make: "Royal Enfield",
      model: "Classic 350",
      year: 2020,
      type: "CRUISER" as const,
      engineCc: 349,
      color: "Signals Desert Sand",
      odo: 15000,
      isPrimary: true,
    },
    {
      userId: user2.id,
      make: "Yamaha",
      model: "R15 V4",
      year: 2023,
      type: "SPORT" as const,
      engineCc: 155,
      color: "Racing Blue",
      odo: 8450,
      isPrimary: true,
    },
    {
      userId: user3.id,
      make: "KTM",
      model: "390 Adventure",
      year: 2019,
      type: "ADVENTURE" as const,
      engineCc: 373,
      color: "Orange",
      odo: 25000,
      isPrimary: true,
    },
    {
      userId: user4.id,
      make: "KTM",
      model: "Duke 200",
      year: 2021,
      type: "NAKED" as const,
      engineCc: 199,
      color: "White",
      odo: 6400,
      isPrimary: true,
    },
    {
      userId: user5.id,
      make: "Royal Enfield",
      model: "Thunderbird 500",
      year: 2018,
      type: "CRUISER" as const,
      engineCc: 499,
      color: "Black",
      odo: 32000,
      isPrimary: true,
    },
    {
      userId: user6.id,
      make: "Honda",
      model: "CB350 RS",
      year: 2023,
      type: "NAKED" as const,
      engineCc: 348,
      color: "Matte Steel Black",
      odo: 4500,
      isPrimary: true,
    },
    {
      userId: user7.id,
      make: "Hero",
      model: "XPulse 200 4V",
      year: 2024,
      type: "ADVENTURE" as const,
      engineCc: 199,
      color: "Trail Blue",
      odo: 9800,
      isPrimary: true,
    },
    {
      userId: user8.id,
      make: "Bajaj",
      model: "Dominar 400",
      year: 2022,
      type: "TOURING" as const,
      engineCc: 373,
      color: "Aurora Green",
      odo: 11200,
      isPrimary: true,
    },
    {
      userId: user9.id,
      make: "Jawa",
      model: "Classic",
      year: 2020,
      type: "CRUISER" as const,
      engineCc: 293,
      color: "Maroon",
      odo: 18500,
      isPrimary: true,
    },
  ];
  await prisma.bike.createMany({
    data: bikeData.map((b) => ({ ...b, ownerSince: new Date("2022-01-01") })),
  });
  console.log("✅ Created bikes");

  // ── Badges ───────────────────────────────────────────────────────
  const badges = await Promise.all([
    prisma.badge.create({
      data: {
        title: "First Ride",
        description: "Completed your first ride",
        icon: "🏁",
        auraPoints: 100,
        category: "achievement",
      },
    }),
    prisma.badge.create({
      data: {
        title: "1000 KM Club",
        description: "Crossed 1000km total distance",
        icon: "🔥",
        auraPoints: 150,
        category: "distance",
      },
    }),
    prisma.badge.create({
      data: {
        title: "Night Owl",
        description: "Completed 10 night rides",
        icon: "🌙",
        auraPoints: 120,
        category: "activity",
      },
    }),
    prisma.badge.create({
      data: {
        title: "Social Butterfly",
        description: "Made 5 friends on the platform",
        icon: "🦋",
        auraPoints: 80,
        category: "social",
      },
    }),
    prisma.badge.create({
      data: {
        title: "Marketplace Pro",
        description: "Sold 10 items on the marketplace",
        icon: "💰",
        auraPoints: 200,
        category: "marketplace",
      },
    }),
  ]);
  const badgeAssignments = allUsers.flatMap((u, i) => {
    const count = Math.min(2 + (i % 3), badges.length);
    return badges.slice(0, count).map((b) => ({ userId: u.id, badgeId: b.id }));
  });
  await prisma.userBadge.createMany({ data: badgeAssignments });
  console.log("✅ Created badges and user badges");

  // ── Emergency Contacts ───────────────────────────────────────────
  const emergencyNames = [
    "Ravi Kumar",
    "Ananya Singh",
    "Priya Wilson",
    "Suresh Rao",
    "Deepa Iyer",
    "Karthik M",
    "Shreya Das",
    "Mohan L",
    "Arun P",
    "Meera J",
  ];
  await prisma.emergencyContact.createMany({
    data: allUsers.slice(0, 8).map((u, i) => ({
      userId: u.id,
      name: emergencyNames[i],
      phone: `+91${9876543210 + i}`,
      relationship: ["Brother", "Friend", "Spouse", "Parent", "Sister"][i % 5],
      isPrimary: true,
    })),
  });
  console.log("✅ Created emergency contacts");

  // ── Preferences ──────────────────────────────────────────────
  await prisma.userPreferences.createMany({
    data: allUsers.map((u, i) => ({
      userId: u.id,
      rideReminders: i % 3 !== 0,
      serviceReminderKm: 3000 + i * 500,
      darkMode: i % 2 === 0,
      units: "metric",
      openToInvite: i % 4 !== 0,
    })),
  });
  console.log("✅ Created user preferences");

  // ── Ride Stats ───────────────────────────────────────────────
  await prisma.userRideStats.createMany({
    data: allUsers.map((u, i) => ({
      userId: u.id,
      totalDistanceKm: 1000 + i * 800,
      longestRideKm: 150 + i * 40,
      totalRides: 10 + i * 8,
      nightRides: 2 + i * 2,
      weekendRides: 5 + i * 3,
    })),
  });
  console.log("✅ Created ride stats");

  // ── Friendships (at least 5 per user) ────────────────────────
  // Create a mesh where every user is friends with at least 5 others
  const friendshipPairs: {
    senderId: string;
    receiverId: string;
    status: "PENDING" | "ACCEPTED" | "DECLINED" | "BLOCKED";
  }[] = [];
  const friendshipSet = new Set<string>();
  for (let i = 0; i < allUsers.length; i++) {
    // Connect to the next 5 users (wrapping around)
    for (let offset = 1; offset <= 5; offset++) {
      const j = (i + offset) % allUsers.length;
      const key = [allUsers[i].id, allUsers[j].id].sort().join(":");
      if (!friendshipSet.has(key)) {
        friendshipSet.add(key);
        friendshipPairs.push({
          senderId: allUsers[i].id,
          receiverId: allUsers[j].id,
          status: "ACCEPTED" as const,
        });
      }
    }
  }
  // Add a few pending requests too
  friendshipPairs.push(
    { senderId: user5.id, receiverId: user9.id, status: "PENDING" as const },
    { senderId: user8.id, receiverId: user6.id, status: "PENDING" as const },
  );
  await prisma.friendship.createMany({
    data: friendshipPairs,
    skipDuplicates: true,
  });
  console.log(`✅ Created ${friendshipPairs.length} friendships (≥5 per user)`);

  // ── Follows ──────────────────────────────────────────────────
  const followData: { followerId: string; followingId: string }[] = [];
  const followSet = new Set<string>();
  for (let i = 0; i < allUsers.length; i++) {
    for (let offset = 1; offset <= 3; offset++) {
      const j = (i + offset) % allUsers.length;
      const key = `${allUsers[i].id}:${allUsers[j].id}`;
      if (!followSet.has(key) && allUsers[i].id !== allUsers[j].id) {
        followSet.add(key);
        followData.push({
          followerId: allUsers[i].id,
          followingId: allUsers[j].id,
        });
      }
    }
  }
  await prisma.follow.createMany({ data: followData, skipDuplicates: true });
  console.log(`✅ Created ${followData.length} follows`);

  // ── Bangalore Coordinates (centered on Koramangala) ────────────────────────────────────
  // Koramangala is at approximately 12.9352° N, 77.6245° E
  // Using Bangalore as base for names/descriptions, but concentrating coordinates on Koramangala
  const koramangalaBase = { lat: 12.9352, lng: 77.6245 };

  function generateBangaloreCoords(index: number) {
    // Generate 70% of coordinates VERY close to Koramangala (1-15km) for discovery
    // 30% spread across Bangalore for variety
    if (index < 90) {
      // Heavy concentration around Koramangala (close)
      const angle = (index / 90) * Math.PI * 2;
      const distance = 0.05 + Math.random() * 0.15; // 0-16km roughly
      return {
        lat:
          koramangalaBase.lat +
          Math.sin(angle) * distance +
          (Math.random() - 0.5) * 0.02,
        lng:
          koramangalaBase.lng +
          Math.cos(angle) * distance +
          (Math.random() - 0.5) * 0.02,
      };
    } else {
      // Spread across larger Bangalore area
      const angle = (index / 35) * Math.PI * 2;
      const distance = 0.15 + (index % 3) * 0.08;
      return {
        lat: koramangalaBase.lat + Math.sin(angle) * distance,
        lng: koramangalaBase.lng + Math.cos(angle) * distance,
      };
    }
  }

  // ── Clubs ────────────────────────────────────────────────────
  const clubNames = [
    "Bangalore Velocity Riders",
    "Silk City Bikers",
    "Outer Ring Road Warriors",
    "Tech Park Riders Club",
    "Indiranagar Motorcycle Society",
    "Whitefield Adventure Club",
    "Bellandur Cruiser Community",
    "Yeshwanthpur Speed Enthusiasts",
    "Electronic City Riders",
    "Banashankari Touring Club",
    "Marathahalli Bike Brotherhood",
    "Hebbal Lake Weekend Warriors",
    "Koramangala Casual Riders",
    "Jayanagar Club Members",
    "Rajajinagar Motorcycle Circle",
    "Ulsoor Urban Explorers",
    "Langford Road Riders",
    "Varthur Adrenaline Junkies",
    "RT Nagar Bike Lovers",
    "Frazer Town Heritage Riders",
    "Yelahanka Noble Riders",
    "Yeshwantpur Off-Road Club",
    "Sanjaynagar Motorcycle Guild",
    "Vidyaranyapura Adventure Seekers",
    "Singasandra Speedway Club",
    "Nagarbhavi Night Riders",
    "Jalahalli Weekend Waves",
    "Gowdenhalli Touring Society",
    "Dakshineswar Motorcycle Collective",
    "Peenya Industrial Area Riders",
    "Goraguntepalya Casual Commuters",
    "MG Road Thunder Club",
    "Brigade Road Cruiser Gang",
  ];

  const clubs: any[] = [];

  // Create clubs - doubled for more discovery data, especially at Koramangala
  for (let i = 0; i < clubNames.length; i++) {
    // First iteration - original clubs
    const coords = generateBangaloreCoords(i);
    const club = await prisma.club.create({
      data: {
        name: clubNames[i],
        description: `Premier motorcycle and scooter club in Bangalore. Join ${clubNames[i]} for weekly group rides, track events, and social gatherings!`,
        location: "Bangalore, India",
        latitude: coords.lat,
        longitude: coords.lng,
        establishedAt: new Date(
          Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000,
        ),
        verified: Math.random() > 0.3,
        clubType: [
          "Riding Club",
          "Adventure Club",
          "Sport Club",
          "Casual Community",
        ][Math.floor(Math.random() * 4)],
        isPublic: true,
        memberCount: Math.floor(Math.random() * 50) + 5,
        trophies:
          Math.random() > 0.5 ? ["Best Turnout 2025", "Most Active"] : [],
        trophyCount:
          Math.random() > 0.5 ? Math.floor(Math.random() * 3) + 1 : 0,
        reputation: 3.5 + Math.random() * 1.5,
        ownerId: allUsers[Math.floor(Math.random() * allUsers.length)].id,
      },
    });
    clubs.push(club);
  }

  // Create duplicate clubs concentrated around Koramangala for better discovery
  for (let i = 0; i < clubNames.length; i++) {
    // Generate mostly Koramangala-area coords (indices 0-35 are all close to Koramangala)
    const coords = generateBangaloreCoords(i + 50); // Offset indices to get more Koramangala coords
    const club = await prisma.club.create({
      data: {
        name: `${clubNames[i]} - Local Chapter`,
        description: `Local ${clubNames[i]} chapter in Koramangala area. Join for rides, meetups, and community events!`,
        location: "Koramangala, Bangalore",
        latitude: coords.lat,
        longitude: coords.lng,
        establishedAt: new Date(
          Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000,
        ),
        verified: Math.random() > 0.4,
        clubType: [
          "Riding Club",
          "Adventure Club",
          "Sport Club",
          "Casual Community",
        ][Math.floor(Math.random() * 4)],
        isPublic: true,
        memberCount: Math.floor(Math.random() * 40) + 8,
        trophies: Math.random() > 0.6 ? ["Local Favorite"] : [],
        trophyCount: Math.random() > 0.6 ? 1 : 0,
        reputation: 3.2 + Math.random() * 1.6,
        ownerId: allUsers[Math.floor(Math.random() * allUsers.length)].id,
      },
    });
    clubs.push(club);
  }

  console.log(`✅ Created ${clubs.length} clubs`);

  // Club members
  const clubMemberMap = new Map<string, any>();
  for (const club of clubs) {
    clubMemberMap.set(`${club.id}:${club.ownerId}`, {
      clubId: club.id,
      userId: club.ownerId,
      role: "FOUNDER",
    });
    for (let j = 0; j < Math.floor(Math.random() * 6) + 2; j++) {
      const userId = allUsers[Math.floor(Math.random() * allUsers.length)].id;
      const key = `${club.id}:${userId}`;
      if (!clubMemberMap.has(key)) {
        clubMemberMap.set(key, {
          clubId: club.id,
          userId,
          role: ["MEMBER", "OFFICER", "ADMIN"][Math.floor(Math.random() * 3)],
        });
      }
    }
  }
  await prisma.clubMember.createMany({
    data: Array.from(clubMemberMap.values()),
  });
  console.log(`✅ Created ${clubMemberMap.size} club memberships`);

  // ── Rides ────────────────────────────────────────────────────
  const rideNames = [
    "Nandi Hills Sunrise Expedition",
    "Ring Road Night Cruise",
    "Electronic City Tech Park Ride",
    "Old Airport Road Speed Run",
    "Sarjapur Road Scenic Tour",
    "Whitefield Tech Campus Commute",
    "Bannerghatta Nature Reserve Ride",
    "Tumkur Road Long Distance",
    "Mysore Road Highway Dash",
    "Bangalore Fort Historical Tour",
    "Vidhana Soudha City Exploration",
    "Cubbon Park Casual Cruise",
    "Indiranagar Lake Weekend Ride",
    "Bellandur Lake Evening Tour",
    "Yeshwanthpur Industrial Loop",
    "Marathahalli Bridge Challenge",
    "Koramangala Nightlife Run",
    "Jayanagar Group Meetup Ride",
    "RT Nagar Community Cruise",
    "Rajajinagar Breakfast Ride",
    "Ulsoor Urban Adventure",
    "Langford Road Vintage Tour",
    "Hebbal Weekend Warriors Ride",
    "Varthur Adrenaline Rush",
    "Frazer Town Heritage Cruise",
    "Yelahanka Off-Road Trail",
    "Sanjaynagar Motorcycle Meetup",
    "Vidyaranyapura Adventure Trek",
    "Singasandra Desert Road Blast",
    "Nagarbhavi Night Exploration",
    "Jalahalli Weekend Waves",
    "Goraguntepalya Cross-City Ride",
    "Dakshineswar Mountain Twisties",
    "MG Road Express Rally",
    "Brigade Road Night Circuit",
  ];

  const rideLocations = [
    "Nandi Hills",
    "Electronic City",
    "Whitefield",
    "Sarjapur",
    "Old Airport Road",
    "Bannerghatta",
    "Tumkur",
    "Mysore Road",
    "Bangalore Fort",
    "Cubbon Park",
    "Indiranagar",
    "Bellandur",
    "Yeshwanthpur",
    "Marathahalli",
    "Koramangala",
    "Jayanagar",
    "RT Nagar",
    "Rajajinagar",
    "Ulsoor",
    "Langford Road",
    "Hebbal",
    "Varthur",
    "Frazer Town",
    "Yelahanka",
    "Sanjaynagar",
    "Vidyaranyapura",
    "Singasandra",
    "Nagarbhavi",
    "Jalahalli",
    "Goraguntepalya",
    "Dakshineswar",
    "Peenya",
    "Gowdenhalli",
    "MG Road",
    "Brigade Road",
  ];

  const rides: any[] = [];
  for (let i = 0; i < rideNames.length; i++) {
    const coords = generateBangaloreCoords(i);
    const expLevels = ["Beginner", "Intermediate", "Expert"];
    const paces = ["Leisurely", "Moderate", "Fast"];
    const statuses = [
      "PLANNED",
      "PLANNED",
      "PLANNED",
      "IN_PROGRESS",
      "COMPLETED",
      "CANCELLED",
    ] as const;

    const ride = await prisma.ride.create({
      data: {
        title: rideNames[i],
        description: `${rideNames[i]} - A premium experience for motorcycle enthusiasts. Join our community for an unforgettable riding adventure!`,
        startLocation: rideLocations[i],
        endLocation: rideLocations[(i + 1) % rideLocations.length],
        latitude: coords.lat,
        longitude: coords.lng,
        experienceLevel: expLevels[Math.floor(Math.random() * 3)],
        xpRequired: Math.floor(Math.random() * 1000) + 100,
        pace: paces[Math.floor(Math.random() * 3)],
        distance: Math.floor(Math.random() * 150) + 20,
        duration: Math.floor(Math.random() * 240) + 60,
        scheduledAt: new Date(
          Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000,
        ),
        status: statuses[Math.floor(Math.random() * statuses.length)],
        creatorId: allUsers[Math.floor(Math.random() * allUsers.length)].id,
        clubId: clubs[Math.floor(Math.random() * clubs.length)].id,
      },
    });
    rides.push(ride);
  }

  // Create duplicate rides concentrated around Koramangala
  for (let i = 0; i < rideNames.length; i++) {
    const coords = generateBangaloreCoords(i + 50); // Offset for Koramangala concentration
    const expLevels = ["Beginner", "Intermediate", "Expert"];
    const paces = ["Leisurely", "Moderate", "Fast"];
    const statuses = [
      "PLANNED",
      "PLANNED",
      "PLANNED",
      "IN_PROGRESS",
      "COMPLETED",
    ] as const;

    const ride = await prisma.ride.create({
      data: {
        title: `${rideNames[i]} - Koramangala Chapter`,
        description: `${rideNames[i]} from Koramangala! Experience the best riding routes in your area with fellow enthusiasts.`,
        startLocation: rideLocations[i],
        endLocation: rideLocations[(i + 1) % rideLocations.length],
        latitude: coords.lat,
        longitude: coords.lng,
        experienceLevel: expLevels[Math.floor(Math.random() * 3)],
        xpRequired: Math.floor(Math.random() * 800) + 50,
        pace: paces[Math.floor(Math.random() * 3)],
        distance: Math.floor(Math.random() * 120) + 15,
        duration: Math.floor(Math.random() * 180) + 45,
        scheduledAt: new Date(
          Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000,
        ),
        status: statuses[Math.floor(Math.random() * statuses.length)],
        creatorId: allUsers[Math.floor(Math.random() * allUsers.length)].id,
        clubId: clubs[Math.floor(Math.random() * clubs.length)].id,
      },
    });
    rides.push(ride);
  }

  console.log(`✅ Created ${rides.length} rides`);

  // Ride participants
  const participantMap = new Map<string, any>();
  for (const ride of rides) {
    for (let j = 0; j < Math.floor(Math.random() * 8) + 2; j++) {
      const userId = allUsers[Math.floor(Math.random() * allUsers.length)].id;
      const key = `${ride.id}:${userId}`;
      if (!participantMap.has(key)) {
        participantMap.set(key, {
          rideId: ride.id,
          userId,
          status: ["REQUESTED", "ACCEPTED", "ACCEPTED", "ACCEPTED"][
            Math.floor(Math.random() * 4)
          ],
        });
      }
    }
  }
  await prisma.rideParticipant.createMany({
    data: Array.from(participantMap.values()),
  });
  console.log(`✅ Created ${participantMap.size} ride participants`);

  // ── Marketplace Listings ─────────────────────────────────────
  const listingNames = [
    "AGV K3 SV Full Face Helmet - Size L",
    "Alpinestars Racing Jacket - Medium",
    "Alpinestars Leather Gloves",
    "SIDI Racing Boots - Size 42",
    "Dainese Body Armor Set",
    "Royal Enfield Classic 350 - 2019",
    "Yamaha R15 V4 - 2023",
    "KTM Duke 200 - 2021",
    "Harley Davidson Street 750",
    "Hero Honda Splendor Plus",
    "GoPro Hero 10 with Mounts",
    "DJI Mini 3 Pro Drone",
    "Garmin Zumo 396 GPS",
    "Phone Mount Handlebar Bracket",
    "LED Fog Lights Set",
    "Michelin Road 6 Tyres - Pair",
    "Pirelli Diablo Motorcycle Tyres",
    "Akrapovic Titanium Exhaust",
    "Performance Air Filter Kit",
    "Carbon Fiber Hugger Guard",
    "Motorcycle Chain Lubricant",
    "OEM Engine Oil 4L",
    "Motorcycle Battery YTZ7S",
    "Riding Jacket Winter Edition",
    "Cross Country Gear Set",
    "Daily Commute Backpack",
    "Motorcycle Tool Kit Professional",
    "Portable Air Pump 12V",
    "Secure Cable Lock 2M",
    "Reflective Safety Vest",
    "Motorcycle Phone Charger",
    "Handlebar Mirrors Pair",
    "Tail Tidy Kit Universal",
  ];

  const categories = [
    { cat: "Gear", sub: "Helmet" },
    { cat: "Gear", sub: "Jacket" },
    { cat: "Gear", sub: "Gloves" },
    { cat: "Gear", sub: "Boots" },
    { cat: "Gear", sub: "Armor" },
    { cat: "Motorcycle", sub: "Street" },
    { cat: "Motorcycle", sub: "Sport" },
    { cat: "Motorcycle", sub: "Cruiser" },
    { cat: "Motorcycle", sub: "Scooter" },
    { cat: "Motorcycle", sub: "Commuter" },
    { cat: "Accessories", sub: "Camera" },
    { cat: "Accessories", sub: "Drone" },
    { cat: "Accessories", sub: "GPS" },
    { cat: "Accessories", sub: "Mount" },
    { cat: "Accessories", sub: "Lights" },
    { cat: "Parts", sub: "Tyres" },
    { cat: "Parts", sub: "Exhaust" },
    { cat: "Parts", sub: "Filters" },
    { cat: "Parts", sub: "Guards" },
    { cat: "Parts", sub: "Oil" },
    { cat: "Parts", sub: "Battery" },
    { cat: "Gear", sub: "Protective" },
    { cat: "Gear", sub: "Winter" },
    { cat: "Accessories", sub: "Luggage" },
    { cat: "Accessories", sub: "Tools" },
    { cat: "Accessories", sub: "Pump" },
    { cat: "Accessories", sub: "Lock" },
    { cat: "Accessories", sub: "Safety" },
    { cat: "Accessories", sub: "Charger" },
    { cat: "Accessories", sub: "Mirror" },
    { cat: "Gear", sub: "Adventure" },
    { cat: "Accessories", sub: "Backpack" },
    { cat: "Parts", sub: "Tail Tidy" },
  ];

  const listings: any[] = [];
  const prices = [
    2000, 3500, 5000, 8500, 12000, 15000, 25000, 28000, 125000, 250000,
  ];
  const conditions = ["New", "Like New", "Good", "Fair"];
  for (let i = 0; i < listingNames.length; i++) {
    const coords = generateBangaloreCoords(i);
    const listing = await prisma.marketplaceListing.create({
      data: {
        title: listingNames[i],
        description: `${listingNames[i]} - Premium quality, verified seller. Contact for details.`,
        price: prices[Math.floor(Math.random() * prices.length)],
        currency: "INR",
        category: categories[i % categories.length].cat,
        subcategory: categories[i % categories.length].sub,
        condition: conditions[Math.floor(Math.random() * conditions.length)],
        images: [],
        status: Math.random() > 0.15 ? "ACTIVE" : "SOLD",
        latitude: coords.lat,
        longitude: coords.lng,
        sellerId: allUsers[Math.floor(Math.random() * allUsers.length)].id,
      },
    });
    listings.push(listing);
  }
  console.log(`✅ Created ${listings.length} marketplace listings`);

  // ── Posts ─────────────────────────────────────────────────────
  const posts: any[] = [];
  const postContents = [
    "Just completed an amazing sunrise ride! 🌅🏍️",
    "Who's joining this weekend?",
    "Selling my gear - check out the listing!",
    "Best track day ever! 🏁",
    "New bike day! Couldn't resist 🔥",
    "Safety check done, ready to roll!",
    "Exploring new routes around Bangalore",
    "Night ride vibes are unmatched 🌙",
    "Group ride photos coming soon!",
    "Anyone knows a good mechanic in Koramangala?",
    "Monsoon riding tips - thread below 🧵",
    "Just hit 10000 km milestone!",
  ];
  for (let i = 0; i < 25; i++) {
    const post = await prisma.post.create({
      data: {
        type: i < 10 ? "ride" : i < 20 ? "content" : "listing",
        content: postContents[i % postContents.length],
        images: [],
        authorId: allUsers[i % allUsers.length].id,
        rideId: i < 10 ? rides[i % rides.length].id : undefined,
        listingId: i >= 20 ? listings[i % listings.length].id : undefined,
      },
    });
    posts.push(post);
  }
  console.log(`✅ Created ${posts.length} posts`);

  // ── Likes ────────────────────────────────────────────────────
  const likeMap = new Map<string, any>();
  for (const post of posts) {
    for (let j = 0; j < Math.floor(Math.random() * 6) + 1; j++) {
      const userId = allUsers[Math.floor(Math.random() * allUsers.length)].id;
      const key = `${post.id}:${userId}`;
      if (!likeMap.has(key)) likeMap.set(key, { postId: post.id, userId });
    }
  }
  await prisma.like.createMany({ data: Array.from(likeMap.values()) });
  console.log(`✅ Created ${likeMap.size} likes`);

  // ── Comments ─────────────────────────────────────────────────
  const commentTexts = [
    "Amazing! Count me in! 🔥",
    "This looks incredible!",
    "Can't wait! See you there!",
    "Perfect for my skill level!",
    "Is this beginner friendly?",
    "Already signed up! 💪",
    "Love riding with this crew!",
    "Great deal! Still available?",
    "Excellent condition! Interested!",
    "Would you consider trading?",
  ];
  const commentsData: any[] = [];
  for (const post of posts) {
    for (let j = 0; j < Math.floor(Math.random() * 4); j++) {
      commentsData.push({
        postId: post.id,
        authorId: allUsers[Math.floor(Math.random() * allUsers.length)].id,
        content: commentTexts[Math.floor(Math.random() * commentTexts.length)],
      });
    }
  }
  await prisma.comment.createMany({ data: commentsData });
  console.log(`✅ Created ${commentsData.length} comments`);

  // ── Reviews ──────────────────────────────────────────────────
  const reviewTexts = [
    "Excellent seller, fast and reliable!",
    "Great quality, as described!",
    "Highly recommended!",
    "Good condition, exactly needed!",
    "Very responsive seller!",
    "Authentic product, satisfied!",
  ];
  const reviewSet = new Set<string>();
  const reviewsData: any[] = [];
  for (let i = 0; i < Math.min(listings.length, 20); i++) {
    for (let j = 0; j < Math.floor(Math.random() * 3) + 1; j++) {
      const userId = allUsers[Math.floor(Math.random() * allUsers.length)].id;
      const key = `${listings[i].id}:${userId}`;
      if (userId !== listings[i].sellerId && !reviewSet.has(key)) {
        reviewSet.add(key);
        reviewsData.push({
          listingId: listings[i].id,
          reviewerId: userId,
          rating: Math.floor(Math.random() * 2) + 4,
          comment: reviewTexts[Math.floor(Math.random() * reviewTexts.length)],
        });
      }
    }
  }
  await prisma.review.createMany({ data: reviewsData });
  console.log(`✅ Created ${reviewsData.length} reviews`);

  // ── Reports ──────────────────────────────────────────────────
  const reportData = [
    {
      type: "user",
      title: "Spam account",
      description: "This user keeps spamming the feed",
      reportedItemId: user4.id,
      reportedItemName: user4.name,
      reportedItemType: "user",
      reporterId: user1.id,
      status: "pending",
      priority: "medium",
    },
    {
      type: "listing",
      title: "Suspicious listing",
      description: "Price too good to be true",
      reportedItemId: listings[0]?.id,
      reportedItemName: listings[0]?.title,
      reportedItemType: "listing",
      reporterId: user2.id,
      status: "pending",
      priority: "high",
    },
    {
      type: "user",
      title: "Inappropriate bio",
      description: "User has offensive content",
      reportedItemId: user8.id,
      reportedItemName: user8.name,
      reportedItemType: "user",
      reporterId: user3.id,
      status: "reviewing",
      priority: "medium",
    },
    {
      type: "listing",
      title: "Counterfeit product",
      description: "Fake branded item",
      reportedItemId: listings[2]?.id,
      reportedItemName: listings[2]?.title,
      reportedItemType: "listing",
      reporterId: user5.id,
      status: "pending",
      priority: "high",
    },
    {
      type: "club",
      title: "Inactive club",
      description: "Club has no activity for months",
      reportedItemId: clubs[5]?.id,
      reportedItemName: clubs[5]?.name,
      reportedItemType: "club",
      reporterId: user7.id,
      status: "resolved",
      priority: "low",
    },
  ];
  await prisma.report.createMany({ data: reportData });
  console.log(`✅ Created ${reportData.length} reports`);

  // ── Friend Groups (Squads) ───────────────────────────────────
  const friendGroups = [
    {
      name: "Weekend Warriors",
      description: "Early morning weekend rides around Bangalore",
      creatorId: adminUser.id,
      members: [adminUser.id, user1.id, user2.id, user3.id, user5.id],
    },
    {
      name: "Night Riders Crew",
      description: "Late night cruises through the city",
      creatorId: user1.id,
      members: [user1.id, user2.id, user4.id, user8.id],
    },
    {
      name: "Highway Hoolz",
      description: "Long distance highway runs every fortnight",
      creatorId: user2.id,
      members: [user2.id, adminUser.id, user3.id, user4.id, user6.id, user7.id],
    },
    {
      name: "Coffee Run Squad",
      description: "Short rides to the best cafés in town",
      creatorId: user3.id,
      members: [user3.id, user1.id, user4.id, user6.id],
    },
    {
      name: "Nandi Hills Gang",
      description: "Weekly sunrise rides to Nandi Hills",
      creatorId: user5.id,
      members: [user5.id, adminUser.id, user1.id, user2.id, user3.id, user9.id],
    },
    {
      name: "Track Day Addicts",
      description: "Track practice at MMRT & Kari Motor Speedway",
      creatorId: user7.id,
      members: [user7.id, user2.id, user9.id],
    },
    {
      name: "Vintage Collectors",
      description: "Classic and vintage motorcycle enthusiasts",
      creatorId: user9.id,
      members: [user9.id, user3.id, user5.id, user7.id],
    },
    {
      name: "Offroad Tribe",
      description: "Dirt trails and offroad adventures",
      creatorId: user7.id,
      members: [user7.id, user3.id, user5.id, adminUser.id, user8.id],
    },
  ];

  for (const fg of friendGroups) {
    const group = await prisma.friendGroup.create({
      data: {
        name: fg.name,
        description: fg.description,
        creatorId: fg.creatorId,
      },
    });
    await prisma.friendGroupMember.createMany({
      data: fg.members.map((userId) => ({ groupId: group.id, userId })),
    });
  }
  console.log(`✅ Created ${friendGroups.length} friend groups`);

  console.log("\n🎉 Development seed completed!");
  console.log("\n📊 Summary:");
  console.log(
    `   - Users: ${allUsers.length} (1 admin, ${createdUsers.length} riders)`,
  );
  console.log(`   - Friendships: ${friendshipPairs.length} (≥5 per user)`);
  console.log(`   - Clubs: ${clubs.length}`);
  console.log(`   - Rides: ${rides.length}`);
  console.log(`   - Listings: ${listings.length}`);
  console.log(`   - Posts: ${posts.length}`);
  console.log(`   - Friend Groups: ${friendGroups.length}`);
  console.log(`   - Reports: ${reportData.length}`);
  console.log("\n🔑 Credentials (password: password123):");
  console.log("   admin@zoomies.com      → ADMIN + CLUB_OWNER");
  for (const u of devUsers)
    console.log(`   ${u.email.padEnd(24)} → ${u.roles.join(", ")}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
