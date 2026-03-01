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

  // ── Bangalore Coordinates (base: 12.9716°N, 77.5946°E) ─────────────────
  const bangaloreBase = {
    lat: 12.9716,
    lng: 77.5946,
  };

  // Helper to generate nearby coords (within ~15km radius)
  function generateBangaloreCoords(index: number) {
    const latDelta = (Math.sin(index * 0.5) * 0.15) % 0.15;
    const lngDelta = (Math.cos(index * 0.7) * 0.15) % 0.15;
    return {
      lat: bangaloreBase.lat + (latDelta - 0.075),
      lng: bangaloreBase.lng + (lngDelta - 0.075),
    };
  }

  // Create 30+ Clubs with Bangalore coordinates
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
    "Aravind Eye Hospital Riders",
    "Hebbal Lake Weekend Warriors",
    "Koramangala Casual Riders",
    "Jayanagar Club Members",
    "Rajajinagar Motorcycle Circle",
    "Ulsoor Urban Explorers",
    "Langford Road Riders",
    "Nageswara Rao Park Club",
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
  ];

  const clubs: any[] = [];
  for (let i = 0; i < clubNames.length; i++) {
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
        ownerId: [adminUser.id, user1.id, user2.id, user3.id][
          Math.floor(Math.random() * 4)
        ],
      },
    });
    clubs.push(club);
  }
  console.log(`✅ Created ${clubs.length} clubs with Bangalore coordinates`);

  // Create Club Members (deduplicated to avoid unique constraint violations)
  const clubMemberMap = new Map<string, any>();
  for (let i = 0; i < clubs.length; i++) {
    const ownerKey = `${clubs[i].id}:${clubs[i].ownerId}`;
    clubMemberMap.set(ownerKey, {
      clubId: clubs[i].id,
      userId: clubs[i].ownerId,
      role: "FOUNDER",
    });
    // Add random other members (skip if same as owner)
    const userIds = [adminUser.id, user1.id, user2.id, user3.id, user4.id];
    for (let j = 0; j < Math.floor(Math.random() * 4) + 1; j++) {
      const userId = userIds[Math.floor(Math.random() * userIds.length)];
      const key = `${clubs[i].id}:${userId}`;
      if (!clubMemberMap.has(key)) {
        clubMemberMap.set(key, {
          clubId: clubs[i].id,
          userId,
          role: ["MEMBER", "OFFICER", "ADMIN"][Math.floor(Math.random() * 3)],
        });
      }
    }
  }
  const clubMemberData = Array.from(clubMemberMap.values());
  await prisma.clubMember.createMany({
    data: clubMemberData,
  });
  console.log(`✅ Created ${clubMemberData.length} club memberships`);

  // Create 30+ Rides with Bangalore coordinates
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
    "Yeshwanthpur Industrial Area Loop",
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
    "Yelahanka Noble Off-Road Trail",
    "Sanjaynagar Motorcycle Meetup",
    "Vidyaranyapura Adventure Trek",
    "Singasandra Desert Road Blast",
    "Nagarbhavi Night Exploration",
    "Jalahalli Weekend Waves",
    "Goraguntepalya Cross-City Ride",
    "Dakshineswar Mountain Twisties",
  ];

  const rideStartLocations = [
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
  ];

  const rides: any[] = [];
  for (let i = 0; i < rideNames.length; i++) {
    const coords = generateBangaloreCoords(i);
    const experienceLevels = ["Beginner", "Intermediate", "Expert"];
    const paces = ["Leisurely", "Moderate", "Fast"];

    const futureDate = new Date(
      Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000,
    );
    const isLive = Math.random() > 0.9;

    const ride = await prisma.ride.create({
      data: {
        title: rideNames[i],
        description: `${rideNames[i]} - A premium experience for motorcycle enthusiasts. Join our community for an unforgettable riding adventure with fellow riders!`,
        startLocation: rideStartLocations[i],
        endLocation: rideStartLocations[(i + 1) % rideStartLocations.length],
        latitude: coords.lat,
        longitude: coords.lng,
        experienceLevel: experienceLevels[Math.floor(Math.random() * 3)],
        xpRequired: Math.floor(Math.random() * 1000) + 100,
        pace: paces[Math.floor(Math.random() * 3)],
        distance: Math.floor(Math.random() * 150) + 20,
        duration: Math.floor(Math.random() * 240) + 60,
        scheduledAt: futureDate,
        status: isLive ? "IN_PROGRESS" : "PLANNED",
        creatorId: [adminUser.id, user1.id, user2.id, user3.id, user4.id][
          Math.floor(Math.random() * 5)
        ],
        clubId: clubs[Math.floor(Math.random() * clubs.length)].id,
      },
    });
    rides.push(ride);
  }
  console.log(`✅ Created ${rides.length} rides with Bangalore coordinates`);

  // Create Ride Participants
  const participantData: any[] = [];
  for (const ride of rides) {
    const participantCount = Math.floor(Math.random() * 10) + 1;
    const userIds = [adminUser.id, user1.id, user2.id, user3.id, user4.id];
    for (let j = 0; j < participantCount; j++) {
      const userId = userIds[Math.floor(Math.random() * userIds.length)];
      // Check if already added to avoid duplicates
      const exists = participantData.some(
        (p) => p.rideId === ride.id && p.userId === userId,
      );
      if (!exists) {
        participantData.push({
          rideId: ride.id,
          userId: userId,
          status: ["REQUESTED", "ACCEPTED", "DECLINED"][
            Math.floor(Math.random() * 3)
          ],
        });
      }
    }
  }
  await prisma.rideParticipant.createMany({
    data: participantData,
  });
  console.log(`✅ Created ${participantData.length} ride participants`);

  // Create 30+ Marketplace Listings with Bangalore coordinates
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
    "Carbide Chain Lube Premium",
    "Riding Jacket Winter Edition",
    "Cross Country Gear Set",
    "Daily Commute Backpack",
    "Motorcycle Tool Kit Professional",
    "Portable Air Pump 12V",
    "Secure Cable Lock 2M",
    "Reflective Safety Vest",
    "Motorcycle Phone Charger",
    "Handlebar Mirrors Pair",
  ];

  const listingCategories = [
    { cat: "Gear", subcat: "Helmet" },
    { cat: "Gear", subcat: "Jacket" },
    { cat: "Gear", subcat: "Gloves" },
    { cat: "Gear", subcat: "Boots" },
    { cat: "Gear", subcat: "Armor" },
    { cat: "Motorcycle", subcat: "Street" },
    { cat: "Motorcycle", subcat: "Sport" },
    { cat: "Motorcycle", subcat: "Cruiser" },
    { cat: "Motorcycle", subcat: "Scooter" },
    { cat: "Motorcycle", subcat: "Commuter" },
    { cat: "Accessories", subcat: "Camera" },
    { cat: "Accessories", subcat: "Drone" },
    { cat: "Accessories", subcat: "GPS" },
    { cat: "Accessories", subcat: "Mount" },
    { cat: "Accessories", subcat: "Lights" },
    { cat: "Parts", subcat: "Tyres" },
    { cat: "Parts", subcat: "Exhaust" },
    { cat: "Parts", subcat: "Filters" },
    { cat: "Parts", subcat: "Guards" },
    { cat: "Parts", subcat: "Oil" },
    { cat: "Parts", subcat: "Battery" },
    { cat: "Parts", subcat: "Lubrication" },
    { cat: "Gear", subcat: "Protective" },
    { cat: "Accessories", subcat: "Luggage" },
    { cat: "Accessories", subcat: "Tools" },
    { cat: "Accessories", subcat: "Pump" },
    { cat: "Accessories", subcat: "Lock" },
    { cat: "Accessories", subcat: "Safety" },
    { cat: "Accessories", subcat: "Charger" },
    { cat: "Accessories", subcat: "Mirror" },
    { cat: "Gear", subcat: "Winter" },
    { cat: "Gear", subcat: "Adventure" },
    { cat: "Accessories", subcat: "Backpack" },
  ];

  const listings: any[] = [];
  for (let i = 0; i < listingNames.length; i++) {
    const coords = generateBangaloreCoords(i);
    const pricing = [
      5000, 8500, 15000, 28000, 125000, 250000, 2000, 3500, 1200, 25000,
    ];
    const condition = ["New", "Like New", "Good", "Fair"];
    const status = Math.random() > 0.1 ? "ACTIVE" : "SOLD";

    const listing = await prisma.marketplaceListing.create({
      data: {
        title: listingNames[i],
        description: `${listingNames[i]} - Premium quality, verified seller. Contact for details and inspection.`,
        price: pricing[Math.floor(Math.random() * pricing.length)],
        currency: "INR",
        category: listingCategories[i].cat,
        subcategory: listingCategories[i].subcat,
        condition: condition[Math.floor(Math.random() * condition.length)],
        images: [],
        status: status,
        latitude: coords.lat,
        longitude: coords.lng,
        sellerId: [adminUser.id, user1.id, user2.id, user3.id, user4.id][
          Math.floor(Math.random() * 5)
        ],
      },
    });
    listings.push(listing);
  }
  console.log(
    `✅ Created ${listings.length} marketplace listings with Bangalore coordinates`,
  );

  // Create Posts (sample from rides and listings)
  const posts: any[] = [];
  for (let i = 0; i < Math.min(10, rides.length); i++) {
    const post = await prisma.post.create({
      data: {
        type: "ride",
        content: `Amazing ride upcoming: ${rides[i].title}! Join us for an unforgettable experience! 🏍️`,
        images: [],
        authorId: rides[i].creatorId,
        rideId: rides[i].id,
      },
    });
    posts.push(post);
  }

  for (let i = 0; i < Math.min(10, listings.length); i++) {
    const post = await prisma.post.create({
      data: {
        type: "listing",
        content: `Selling ${listings[i].title} - Great condition! Interested? Check it out! 🛵`,
        images: [],
        authorId: listings[i].sellerId,
        listingId: listings[i].id,
      },
    });
    posts.push(post);
  }

  console.log(`✅ Created ${posts.length} posts`);

  // Create Likes
  const likesData: any[] = [];
  const userIds = [adminUser.id, user1.id, user2.id, user3.id, user4.id];
  for (const post of posts) {
    for (let j = 0; j < Math.floor(Math.random() * 4) + 1; j++) {
      const userId = userIds[Math.floor(Math.random() * userIds.length)];
      const exists = likesData.some(
        (l) => l.postId === post.id && l.userId === userId,
      );
      if (!exists) {
        likesData.push({ postId: post.id, userId: userId });
      }
    }
  }
  await prisma.like.createMany({
    data: likesData,
  });
  console.log(`✅ Created ${likesData.length} likes`);

  // Create Comments
  const commentsData: any[] = [];
  const commentTexts = [
    "Amazing! Count me in! 🔥",
    "This looks incredible! When is the next one?",
    "Can't wait! See you there!",
    "Perfect ride for my skill level!",
    "Is this beginner friendly?",
    "Already signed up! 💪",
    "Love riding with this crew!",
    "Great deal! Still available?",
    "Excellent condition! Interested!",
    "Would you consider trading?",
    "What's the best time to reach?",
    "I'm in! Let's do this!",
  ];

  for (const post of posts) {
    for (let j = 0; j < Math.floor(Math.random() * 3); j++) {
      const userId = userIds[Math.floor(Math.random() * userIds.length)];
      commentsData.push({
        postId: post.id,
        authorId: userId,
        content: commentTexts[Math.floor(Math.random() * commentTexts.length)],
      });
    }
  }

  await prisma.comment.createMany({
    data: commentsData,
  });
  console.log(`✅ Created ${commentsData.length} comments`);

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

  // Create Reviews for listings
  const reviewsData: any[] = [];
  const reviewComments = [
    "Excellent seller, fast and reliable!",
    "Great quality, as described perfectly!",
    "Highly recommended, 5 stars!",
    "Good condition, exactly what I needed!",
    "Very responsive seller, great experience!",
    "Authentic product, very satisfied!",
    "Fast delivery and good quality!",
    "Would buy again from this seller!",
  ];

  const reviewKeySet = new Set<string>();
  for (let i = 0; i < Math.min(listings.length, 20); i++) {
    const listingWithReviews = listings[i];
    for (let j = 0; j < Math.floor(Math.random() * 3) + 1; j++) {
      const userId = userIds[Math.floor(Math.random() * userIds.length)];
      const key = `${listingWithReviews.id}:${userId}`;
      if (userId !== listingWithReviews.sellerId && !reviewKeySet.has(key)) {
        reviewKeySet.add(key);
        reviewsData.push({
          listingId: listingWithReviews.id,
          reviewerId: userId,
          rating: Math.floor(Math.random() * 2) + 4,
          comment:
            reviewComments[Math.floor(Math.random() * reviewComments.length)],
        });
      }
    }
  }

  await prisma.review.createMany({
    data: reviewsData,
  });
  console.log(`✅ Created ${reviewsData.length} reviews`);

  console.log("\n🎉 Database seed completed successfully!");
  console.log("\n📊 Summary:");
  console.log("   - Users: 5 (1 admin, 4 riders)");
  console.log("   - Multi-role assignments: ✅");
  console.log(`   - Clubs: ${clubs.length} (all in Bangalore)`);
  console.log(`   - Rides: ${rides.length} (all in Bangalore)`);
  console.log(
    `   - Marketplace Listings: ${listings.length} (all in Bangalore)`,
  );
  console.log(`   - Posts: ${posts.length}`);
  console.log(`   - Likes: ${likesData.length}`);
  console.log(`   - Comments: ${commentsData.length}`);
  console.log(`   - Reviews: ${reviewsData.length}`);
  console.log("   - Club Members: Multiple per club");
  console.log("   - Ride Participants: Multiple per ride");
  console.log("   - Bikes, Badges, Preferences, Ride Stats, Friendships: ✅");
  console.log(
    "\n📍 All rides & clubs centered around Bangalore (12.9716°N, 77.5946°E) ± 0.15°",
  );
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
  console.log("\n✅ Ready for location-based discovery feed testing!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
