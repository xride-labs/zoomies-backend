# Prisma Guide: Development & Production Workflows

A comprehensive guide for managing Prisma ORM in the Zoomies backend. This document covers everything from initial setup to advanced troubleshooting.

## 📚 Table of Contents
- [Overview](#overview)
- [Prisma Commands Cheat Sheet](#prisma-commands-cheat-sheet)
- [Development Workflow](#development-workflow)
- [Production Workflow](#production-workflow)
- [Common Tasks](#common-tasks)
- [Schema Design Patterns](#schema-design-patterns)
- [Troubleshooting Guide](#troubleshooting-guide)
- [Best Practices](#best-practices)

---

## Overview

- **Schema Location**: `prisma/schema.prisma`
- **Config File**: `prisma/prisma.config.ts` 
- **Database**: PostgreSQL
- **Client**: `@prisma/client`
- **Migration History**: `prisma/migrations/`

---

## Prisma Commands Cheat Sheet

| Command | Environment | Description |
|---------|-------------|-------------|
| `npx prisma generate` | Dev/Prod | Generate Prisma Client from schema |
| `npx prisma migrate dev` | Dev only | Create and apply migrations |
| `npx prisma migrate deploy` | Prod only | Apply pending migrations safely |
| `npx prisma db push` | Dev only | Push schema without migrations |
| `npx prisma studio` | Dev only | Open database GUI |
| `npx prisma migrate reset` | Dev only | Reset DB and reapply migrations |
| `npx prisma migrate status` | Dev/Prod | Check migration status |
| `npx prisma db pull` | Dev only | Introspect DB to update schema |
| `npx prisma db seed` | Dev only | Seed database with test data |

---

## Development Workflow

### 🔄 **Complete Dev Cycle**

#### **Initial Setup (First Time)**
```bash
# 1. Install Prisma (already done in project)
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your DATABASE_URL

# 3. Generate Prisma Client
npm run prisma:generate
# or: npx prisma generate

# 4. Create initial migration
npm run prisma:migrate -- --name init
# or: npx prisma migrate dev --name init

# 5. (Optional) Seed database
npm run db:seed
# or: npx prisma db seed

# 6. (Optional) Open Prisma Studio
npm run prisma:studio
# or: npx prisma studio
```

#### **Daily Development Loop**
```bash
# 1. Make changes to prisma/schema.prisma

# 2. Create and apply migration
npm run prisma:migrate -- --name describe_your_changes
# Example: npm run prisma:migrate -- --name add_user_roles

# 3. Generate updated client
npm run prisma:generate

# 4. (Optional) Reset database if needed
npm run prisma:reset
# or: npx prisma migrate reset
```

#### **When Pulling Latest Changes**
```bash
# After git pull with schema changes:
npm run prisma:generate  # Always generate after schema changes
npm run prisma:migrate   # Apply any new migrations
```

---

## Production Workflow

### 🚀 **Deployment Steps**

#### **Pre-deployment Checklist**
```bash
# 1. Ensure all migrations are committed to git
git add prisma/migrations/
git commit -m "Add new migrations"

# 2. Test migrations locally first
npm run prisma:migrate
```

#### **Deployment Commands**
```bash
# 1. Set production database URL
export DATABASE_URL="postgresql://user:pass@prod-host:5432/zoomies_prod?sslmode=require"

# 2. Apply pending migrations (safe for production)
npx prisma migrate deploy

# 3. Generate Prisma Client for production
npm run prisma:generate
# or: npx prisma generate

# 4. Build the application
npm run build

# 5. Start the application
npm start
```

#### **CI/CD Pipeline Example (GitHub Actions)**
```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run database migrations
        run: npx prisma migrate deploy
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          
      - name: Generate Prisma Client
        run: npx prisma generate
        
      - name: Build application
        run: npm run build
        
      - name: Deploy to server
        # Your deployment steps here
        run: |
          # Copy files to server
          # Restart application
```

---

## Common Tasks

### 📝 **Working with Migrations**

```bash
# Create a new migration
npx prisma migrate dev --name add_user_preferences

# Check migration status
npx prisma migrate status

# Reset database (dev only)
npx prisma migrate reset

# Resolve migration issues
npx prisma migrate resolve --applied 20240220123456_add_user_roles

# Revert last migration (dev only - careful!)
npx prisma migrate reset  # This resets everything, not just last
```

### 🔧 **Database Operations**

```bash
# Push schema changes without migrations (quick dev only)
npx prisma db push

# Pull schema from existing database
npx prisma db pull

# Seed database
npx prisma db seed

# Validate schema
npx prisma validate
```

### 📊 **Prisma Client Operations**

```bash
# Generate client
npx prisma generate

# Generate with specific engine
npx prisma generate --engine=binary  # Use if library engine fails

# Format schema
npx prisma format
```

---

## Schema Design Patterns

### 📁 **Example Schema Structure**
```prisma
// prisma/schema.prisma

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [postgis]  // For location-based features
}

// Enums
enum UserRole {
  SUPER_ADMIN
  ADMIN
  CLUB_OWNER
  USER
  RIDER
  SELLER
}

enum RideType {
  CASUAL
  ADVENTURE
  SPORT
  TOURING
  RACING
}

// Models
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  phone         String?   @unique
  imageUrl      String?
  skillLevel    SkillLevel?
  
  // Relations
  userRoles     UserRoleAssignment[]
  ownedClubs    Club[]                @relation("ClubOwner")
  memberships   ClubMember[]
  rides         RideParticipant[]
  preferences   UserPreference?
  
  // Timestamps
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  @@map("users")
}

// Multi-role support
model UserRoleAssignment {
  id         String   @id @default(cuid())
  userId     String   @map("user_id")
  role       UserRole
  assignedAt DateTime @default(now()) @map("assigned_at")
  assignedBy String?  @map("assigned_by")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, role])
  @@map("user_role_assignments")
}

// User preferences for recommendations
model UserPreference {
  id              String   @id @default(cuid())
  userId          String   @unique @map("user_id")
  preferredRideTypes RideType[]
  preferredLocations String[]
  maxRideDistance Float?
  notifyBefore    Int?     @default(24) // Hours before ride
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@map("user_preferences")
}

model Club {
  id          String   @id @default(cuid())
  name        String
  description String?
  logoUrl     String?
  location    String
  coordinates Json?    // { lat: number, lng: number }
  
  // Relations
  ownerId     String   @map("owner_id")
  owner       User     @relation("ClubOwner", fields: [ownerId], references: [id])
  members     ClubMember[]
  rides       Ride[]
  
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@map("clubs")
}

model Ride {
  id          String     @id @default(cuid())
  title       String
  description String?
  type        RideType
  difficulty  Difficulty?
  location    String
  coordinates Json?      // Start point
  route       Json?      // GPX or route points
  distance    Float?     // in km
  duration    Int?       // in minutes
  date        DateTime
  maxParticipants Int?
  
  // Relations
  clubId      String?    @map("club_id")
  club        Club?      @relation(fields: [clubId], references: [id])
  participants RideParticipant[]
  
  // Timestamps
  createdAt   DateTime   @default(now()) @map("created_at")
  updatedAt   DateTime   @updatedAt @map("updated_at")

  @@map("rides")
}

// Junction table for ride participation
model RideParticipant {
  id        String   @id @default(cuid())
  userId    String   @map("user_id")
  rideId    String   @map("ride_id")
  status    ParticipantStatus @default(REGISTERED)
  joinedAt  DateTime @default(now()) @map("joined_at")
  
  user User @relation(fields: [userId], references: [id])
  ride Ride @relation(fields: [rideId], references: [id])

  @@unique([userId, rideId])
  @@map("ride_participants")
}

// Indexes for performance
model UserInteraction {
  id        String   @id @default(cuid())
  userId    String   @map("user_id")
  rideId    String   @map("ride_id")
  type      InteractionType // VIEW, CLICK, JOIN, SHARE
  weight    Float    // For recommendations
  createdAt DateTime @default(now()) @map("created_at")

  @@index([userId])
  @@index([rideId])
  @@index([createdAt])
  @@map("user_interactions")
}
```

---

## Troubleshooting Guide

### 🐛 **Common Errors & Solutions**

#### **1. Prisma Client Generation Failed**
```bash
Error: EPERM: operation not permitted, rename '...query_engine.dll'

Solution:
# Kill all Node processes
taskkill /F /IM node.exe  # Windows
# or
pkill node  # Linux/Mac

# Clear Prisma cache
rm -rf node_modules/.prisma

# Regenerate
npx prisma generate
```

#### **2. Migration Failed with Drift**
```bash
Error: Migration failed. Database drift detected.

Solution:
# Check migration status
npx prisma migrate status

# In development - reset (careful, deletes data!)
npx prisma migrate reset

# Or resolve drift manually
npx prisma db pull  # Pull current DB state
# Review changes
npx prisma migrate dev --name sync_with_db
```

#### **3. Connection Timeout**
```bash
Error: Can't reach database server at `localhost:5432`

Solution:
# 1. Check if PostgreSQL is running
pg_isready

# 2. Verify connection string in .env
echo $DATABASE_URL

# 3. Test connection
psql $DATABASE_URL

# 4. Add timeout to connection string
DATABASE_URL="postgresql://...?connect_timeout=60"
```

#### **4. Type Errors in Generated Client**
```bash
Error: TS2742: The inferred type of '...' cannot be named

Solution:
# Regenerate client with clean cache
npx prisma generate --force

# Restart TypeScript server
# In VSCode: Ctrl+Shift+P -> "TypeScript: Restart TS server"
```

#### **5. Migration Lock Issues**
```bash
Error: Database migration lock detected

Solution:
# Connect to PostgreSQL and release lock
psql $DATABASE_URL -c "SELECT * FROM pg_stat_activity;"

# Find and terminate blocking process
psql $DATABASE_URL -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle in transaction';"
```

---

## Best Practices

### ✅ **Do's and Don'ts**

#### **Development**
```bash
✅ DO:
- Use `prisma migrate dev` for schema changes
- Commit migration files to git
- Generate client after pulling changes
- Use `prisma studio` to verify data

❌ DON'T:
- Don't edit migration files manually
- Don't use `db push` in shared dev environments
- Don't ignore migration conflicts
- Don't commit .env files
```

#### **Production**
```bash
✅ DO:
- Use `prisma migrate deploy` in CI/CD
- Backup database before migrations
- Test migrations in staging first
- Monitor migration performance

❌ DON'T:
- Never use `prisma migrate dev` in production
- Never use `prisma db push` in production
- Don't run migrations during peak traffic
- Don't ignore migration warnings
```

### 🔒 **Security Checklist**

```prisma
// 1. Use prepared statements (Prisma does this by default)
// 2. Enable SSL in production
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")  // Add ?sslmode=require
}

// 3. Mask sensitive data
model User {
  password    String @password   // @password directive marks as sensitive
  // or handle manually in code
}

// 4. Add row-level security (PostgreSQL)
model Account {
  id      String @id @default(cuid())
  userId  String
  balance Float
  
  @@allow('select', auth().id == userId)  // Prisma Policy
}
```

### 🚀 **Performance Optimization**

```prisma
// 1. Add indexes
model Ride {
  id        String @id @default(cuid())
  date      DateTime
  type      RideType
  location  String
  
  @@index([date])
  @@index([type])
  @@index([location])
  @@index([clubId])
}

// 2. Use raw SQL for complex queries
const rides = await prisma.$queryRaw`
  SELECT r.*, 
         COUNT(rp.user_id) as participant_count
  FROM rides r
  LEFT JOIN ride_participants rp ON r.id = rp.ride_id
  WHERE r.date > NOW()
  GROUP BY r.id
  ORDER BY participant_count DESC
  LIMIT 20
`;

// 3. Select only needed fields
const users = await prisma.user.findMany({
  select: { id: true, name: true, email: true },  // Don't select everything
  where: { /* ... */ }
});

// 4. Use pagination
const rides = await prisma.ride.findMany({
  take: 10,
  skip: (page - 1) * 10,
  orderBy: { date: 'asc' }
});
```

### 📊 **Monitoring Queries**

```typescript
// prisma/prisma.config.ts
import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'stdout' },
    { level: 'info', emit: 'stdout' },
    { level: 'warn', emit: 'stdout' }
  ]
})

// Log slow queries
prisma.$on('query' as never, (e: any) => {
  if (e.duration > 1000) { // Queries slower than 1s
    console.warn('Slow query:', e.query, e.duration, 'ms')
  }
})
```

---

## Quick Reference - Most Used Commands

```bash
# After pulling changes
npm run prisma:generate
npm run prisma:migrate

# After schema changes
npm run prisma:migrate -- --name your_migration_name

# Reset dev database
npm run prisma:reset

# Production deployment
npx prisma migrate deploy
npx prisma generate
npm run build

# Troubleshooting
npx prisma migrate status
npx prisma validate
npx prisma format
```

Remember: **`migrate dev` is for development only! Always use `migrate deploy` in production.**