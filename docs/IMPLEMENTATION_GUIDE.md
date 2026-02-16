# Zoomies Backend - Production Features Implementation Guide

This document provides comprehensive guidance on the production-ready features implemented in the Zoomies backend.

## Table of Contents

1. [API Response Structure](#api-response-structure)
2. [Request Validation](#request-validation)
3. [Role-Based Access Control (RBAC)](#role-based-access-control)
4. [Media Upload (Cloudinary)](#media-upload-cloudinary)
5. [Background Jobs & Ride Lifecycle](#background-jobs--ride-lifecycle)
6. [Admin Routes](#admin-routes)
7. [Platform Access Model](#platform-access-model)

---

## API Response Structure

All API responses follow a consistent format defined in `src/lib/utils/apiResponse.ts`.

### Response Format

```typescript
// Success Response
{
  success: true,
  message: "Operation completed successfully",
  data: { ... },
  pagination?: {
    page: 1,
    pageSize: 10,
    total: 100,
    totalPages: 10
  }
}

// Error Response
{
  success: false,
  message: "Error message",
  error: {
    code: "ERROR_CODE",
    details?: { ... }
  }
}
```

### Error Codes

All standardized error codes are defined in the `ErrorCode` enum:

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Request validation failed |
| `AUTHENTICATION_REQUIRED` | User not authenticated |
| `INVALID_CREDENTIALS` | Wrong username/password |
| `TOKEN_EXPIRED` | Auth token expired |
| `USER_NOT_FOUND` | User doesn't exist |
| `RESOURCE_NOT_FOUND` | Resource doesn't exist |
| `ALREADY_EXISTS` | Duplicate resource |
| `INSUFFICIENT_PERMISSIONS` | User lacks permission |
| `ROLE_REQUIRED` | Specific role required |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `INTERNAL_ERROR` | Server error |

### Usage Examples

```typescript
import { ApiResponse, ErrorCode } from "../lib/utils/apiResponse.js";

// Success response
return ApiResponse.success(res, { user: userData }, "User created successfully");

// Paginated response
return ApiResponse.paginated(res, rides, { page: 1, pageSize: 10, total: 100 });

// Error responses
return ApiResponse.error(res, "Something went wrong", 500);
return ApiResponse.validationError(res, validationDetails);
return ApiResponse.unauthorized(res, "Please login");
return ApiResponse.forbidden(res, "Admin access required", ErrorCode.ROLE_REQUIRED);
return ApiResponse.notFound(res, "Ride not found");
```

---

## Request Validation

Validation uses **Zod** schemas defined in `src/validators/schemas.ts`.

### Available Validators

#### Auth Routes

- `registerSchema` - User registration
- `loginSchema` - User login
- `verifyOtpSchema` - OTP verification
- `refreshTokenSchema` - Token refresh

#### Ride Routes

- `createRideSchema` - Create new ride
- `updateRideSchema` - Update ride
- `joinRideSchema` - Join a ride
- `rideQuerySchema` - Filter/search rides

#### Club Routes

- `createClubSchema` - Create club
- `updateClubSchema` - Update club
- `clubMemberUpdateSchema` - Update member role

#### Marketplace Routes

- `createListingSchema` - Create listing
- `updateListingSchema` - Update listing
- `listingQuerySchema` - Filter listings
- `createReviewSchema` - Create review

#### Common

- `idParamSchema` - Validate UUID params
- `paginationSchema` - Page, pageSize validation
- `mediaUploadSchema` - Media upload validation

### Middleware Usage

```typescript
import { validateBody, validateQuery, validateParams, asyncHandler } from "../middlewares/validation.js";
import { createRideSchema, idParamSchema, paginationSchema } from "../validators/index.js";

// Validate request body
router.post("/", 
  validateBody(createRideSchema), 
  asyncHandler(async (req, res) => { ... })
);

// Validate query params
router.get("/", 
  validateQuery(paginationSchema), 
  asyncHandler(async (req, res) => { ... })
);

// Validate URL params
router.get("/:id", 
  validateParams(idParamSchema), 
  asyncHandler(async (req, res) => { ... })
);

// Combine multiple validations
router.put("/:id",
  validateParams(idParamSchema),
  validateBody(updateRideSchema),
  asyncHandler(async (req, res) => { ... })
);
```

### Type Inference

Zod schemas export inferred types for type-safe handlers:

```typescript
import { CreateRideInput } from "../validators/index.js";

const data = req.body as CreateRideInput;
// data is fully typed
```

---

## Role-Based Access Control

RBAC is implemented in `src/middlewares/rbac.ts`.

### User Roles (Hierarchy)

| Role | Level | Description |
|------|-------|-------------|
| `SUPER_ADMIN` | 4 | Full system access |
| `ADMIN` | 3 | Platform administration |
| `CLUB_OWNER` | 2 | Club management access |
| `USER` | 1 | Regular rider |

### Role Middleware

```typescript
import { 
  requireRole, 
  requireAdmin, 
  requireSuperAdmin,
  requireWebAccess,
  requireOwnershipOrAdmin,
  requireClubMembership 
} from "../middlewares/rbac.js";
import { UserRole } from "../middlewares/rbac.js";

// Require specific role(s)
router.post("/", requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN), handler);

// Preset middlewares
router.get("/admin-only", requireAdmin, handler);
router.get("/super-admin", requireSuperAdmin, handler);

// Web platform access (ADMIN, SUPER_ADMIN, CLUB_OWNER only)
router.get("/dashboard", requireWebAccess, handler);

// Resource ownership check
router.put("/rides/:id", 
  requireOwnershipOrAdmin("ride", "id"), 
  handler
);

// Club membership check
router.post("/clubs/:clubId/events", 
  requireClubMembership("ADMIN", "clubId"), 
  handler
);
```

### Club Member Roles

Within a club, members have roles:

- `FOUNDER` - Club creator
- `ADMIN` - Club administrator
- `OFFICER` - Event management
- `MEMBER` - Regular member

---

## Media Upload (Cloudinary)

Cloudinary integration is in `src/lib/cloudinary.ts`.

### Environment Variables

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### Upload Functions

```typescript
import { 
  uploadProfileImage, 
  uploadClubLogo, 
  uploadRideMedia, 
  uploadListingImage,
  uploadPostMedia,
  deleteMedia,
  generateUploadSignature
} from "../lib/cloudinary.js";

// Upload profile image (circular crop, 500x500)
const result = await uploadProfileImage(base64Data, userId);

// Upload club logo (square, 800x800)
const result = await uploadClubLogo(base64Data, clubId);

// Upload ride media (image or video, max 1080p)
const result = await uploadRideMedia(base64Data, rideId, "image");

// Upload listing image (product format, 1200x1200)
const result = await uploadListingImage(base64Data, listingId, imageIndex);

// Delete media
await deleteMedia(publicId, "image");

// Generate signed upload URL for direct client upload
const signature = generateUploadSignature("zoomies/rides");
```

### Media Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/media/upload` | POST | Generic media upload |
| `/api/media/upload/profile` | POST | Profile image upload |
| `/api/media/upload/club/:clubId` | POST | Club media upload |
| `/api/media/signature` | GET | Get signed upload URL |
| `/api/media/:publicId` | DELETE | Delete media |

### Upload Response

```typescript
interface UploadResult {
  publicId: string;      // Cloudinary public ID
  url: string;           // Full URL
  secureUrl: string;     // HTTPS URL
  format: string;        // File format
  width?: number;
  height?: number;
  resourceType: string;  // "image" | "video"
  bytes: number;         // File size
}
```

---

## Background Jobs & Ride Lifecycle

Background jobs are scheduled in `src/jobs/scheduler.ts` using `node-cron`.

### Scheduled Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| `cleanupOldRides` | Daily 2:00 AM | Delete rides 30 days after end |
| `updateRideStatuses` | Every 15 min | Auto-update ride statuses |
| `cleanupExpiredTokens` | Hourly | Remove expired tokens/sessions |
| `updateUserStatistics` | Daily 3:00 AM | Recalculate user stats |

### Ride Lifecycle

```
DRAFT → SCHEDULED → LIVE → COMPLETED → (deleted after 30 days)
         ↓
      CANCELLED
```

**Status transitions:**

- `SCHEDULED → LIVE`: When current time >= startTime
- `LIVE → COMPLETED`: When current time >= endTime
- `COMPLETED → deleted`: 30 days after endedAt (unless `keepPermanently: true`)

### Keep Ride Permanently

Prevent auto-deletion by setting `keepPermanently: true`:

```typescript
// When creating/updating a ride
await prisma.ride.update({
  where: { id: rideId },
  data: { keepPermanently: true }
});
```

### Manual Job Execution

Admins can trigger jobs manually via API:

```http
POST /api/admin/jobs/:jobName/run

# Available jobs:
# - cleanupOldRides
# - updateRideStatuses
# - cleanupExpiredTokens
# - updateUserStatistics
```

### Environment Configuration

```env
# Enable/disable scheduled jobs (default: true)
ENABLE_SCHEDULED_JOBS=true

# Cleanup threshold in days (default: 30)
RIDE_CLEANUP_DAYS=30
```

---

## Admin Routes

Admin endpoints are defined in `src/routes/admin.routes.ts`.

### Authentication

All admin routes require `ADMIN` or `SUPER_ADMIN` role.

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/stats` | GET | Platform statistics |
| `/api/admin/users` | GET | List users (paginated) |
| `/api/admin/users/:id` | GET | Get user details |
| `/api/admin/users/:id/role` | PUT | Update user role |
| `/api/admin/users/:id/ban` | PUT | Ban/unban user |
| `/api/admin/rides` | GET | List all rides |
| `/api/admin/rides/:id` | DELETE | Delete ride |
| `/api/admin/clubs` | GET | List all clubs |
| `/api/admin/clubs/:id/verify` | PUT | Verify club |
| `/api/admin/marketplace` | GET | List all listings |
| `/api/admin/jobs/:jobName/run` | POST | Run background job |

### Stats Response

```typescript
{
  success: true,
  data: {
    users: { total: 1000, active: 800, new: 50 },
    rides: { total: 500, active: 20, completed: 450 },
    clubs: { total: 100, verified: 80 },
    marketplace: { activeListings: 200, totalSales: 150 }
  }
}
```

---

## Platform Access Model

### Web Frontend (Admin Dashboard)

**Allowed roles:**

- `SUPER_ADMIN` - Full platform management
- `ADMIN` - User/content moderation
- `CLUB_OWNER` - Manage their clubs

**Features:**

- User management
- Content moderation
- Club verification
- Marketplace oversight
- Analytics dashboard
- Job management

### Mobile App (Riders)

**Allowed roles:**

- `USER` - Regular riders
- `CLUB_OWNER` - Club owners on mobile

**Features:**

- Create/join rides
- Join/manage clubs
- Marketplace browsing
- Social features (posts, feed)
- Profile management

### Implementation

```typescript
// Web routes protected with:
router.use(requireWebAccess);

// Mobile-specific features
export const MOBILE_ACCESS_ROLES = [UserRole.USER, UserRole.CLUB_OWNER];

// Full access roles
export const WEB_ACCESS_ROLES = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.CLUB_OWNER];
```

---

## Quick Reference

See the Prisma setup guide in `docs/PRISMA_GUIDE.md` for dev/prod database workflows.

### File Structure

```
src/
├── lib/
│   ├── cloudinary.ts          # Media upload utilities
│   ├── utils/
│   │   └── apiResponse.ts     # Response formatting
├── middlewares/
│   ├── validation.ts          # Zod validation middleware
│   ├── rbac.ts                # Role-based access control
│   └── index.ts               # Middleware exports
├── validators/
│   ├── schemas.ts             # Zod validation schemas
│   └── index.ts               # Schema exports
├── jobs/
│   └── scheduler.ts           # Background job scheduling
├── routes/
│   ├── admin.routes.ts        # Admin endpoints
│   └── media.routes.ts        # Media upload endpoints
```

### Environment Variables

```env
# Cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Jobs
ENABLE_SCHEDULED_JOBS=true
RIDE_CLEANUP_DAYS=30

# Better Auth
BETTER_AUTH_SECRET=
BETTER_AUTH_BASE_URL=http://localhost:5000
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=

# CORS / trusted origins
FRONTEND_URL=http://localhost:3000
MOBILE_APP_URL=exp://localhost:8081

# Database
DATABASE_URL=

# Optional Mongo (metrics + optional features)
MONGODB_URI=

# Monitoring
METRICS_BEARER_TOKEN=
```

### Migration Commands

```bash
# Generate Prisma client after schema changes
npx prisma generate

# Create and apply migration
npx prisma migrate dev --name migration_name

# Apply migrations in production
npx prisma migrate deploy
```

---

## Testing

### Validate TypeScript

```bash
npx tsc --noEmit
```

### Start Development Server

```bash
npm run dev
```

### Test API Endpoints

```bash
# Health check
curl http://localhost:5000/health

# Admin stats (requires auth)
curl -H "Authorization: Bearer <token>" http://localhost:5000/api/admin/stats
```
