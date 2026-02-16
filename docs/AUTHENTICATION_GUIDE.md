# Zoomies Backend Authentication Guide

This guide documents the authentication system for the Zoomies backend, powered by [Better Auth](https://www.better-auth.com/).

## Table of Contents

1. [Overview](#overview)
2. [Authentication Flow](#authentication-flow)
3. [API Endpoints](#api-endpoints)
4. [Error Responses](#error-responses)
5. [Client Integration](#client-integration)
6. [Role-Based Access Control](#role-based-access-control)
7. [Testing Authentication](#testing-authentication)

---

## Overview

The Zoomies backend uses **Better Auth** for authentication, providing:

- **Email/Password Authentication** - Traditional email and password sign-up/sign-in
- **Phone OTP Authentication** - SMS-based one-time password for mobile apps
- **Google OAuth** - Social sign-in with Google
- **Session Management** - Secure cookie-based sessions with server-side session tokens
- **Role-Based Access Control** - Multi-role support (USER, ADMIN, CLUB_OWNER, etc.)

### Environment Variables

```env
# Required
BETTER_AUTH_SECRET=your-32-character-secret-key   # Generate with: openssl rand -base64 32
DATABASE_URL=postgresql://user:pass@localhost:5432/zoomies

# Optional - Social Providers
AUTH_GOOGLE_ID=your-google-client-id
AUTH_GOOGLE_SECRET=your-google-client-secret

# Optional - Twilio for SMS OTP
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=+1234567890

# Frontend URLs (for CORS)
FRONTEND_URL=http://localhost:3000
MOBILE_APP_URL=http://localhost:8081
```

---

## Authentication Flow

### Email/Password Sign-Up Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     EMAIL SIGN-UP FLOW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Client sends POST /api/auth/sign-up/email                   │
│     ├── email: "user@example.com"                               │
│     ├── password: "SecurePass123"                               │
│     └── name: "John Doe"                                        │
│                                                                 │
│  2. Better Auth creates user + account in database              │
│                                                                 │
│  3. Session is created and returned with cookies                │
│                                                                 │
│  4. User is immediately logged in                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Email/Password Sign-In Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     EMAIL SIGN-IN FLOW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Client sends POST /api/auth/sign-in/email                   │
│     ├── email: "user@example.com"                               │
│     └── password: "SecurePass123"                               │
│                                                                 │
│  2. Better Auth verifies credentials                            │
│                                                                 │
│  3. New session is created                                      │
│                                                                 │
│  4. Session cookie is set + user data returned                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Phone OTP Sign-In Flow (Mobile App)

```
┌─────────────────────────────────────────────────────────────────┐
│                     PHONE OTP FLOW                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Step 1: Request OTP                                            │
│  POST /api/auth/phone-number/send-otp                           │
│  Body: { "phoneNumber": "+1234567890" }                         │
│  Response: { "success": true }                                 │
│                                                                 │
│  Step 2: Verify OTP and Sign In                                 │
│  POST /api/auth/phone-number/verify                             │
│  Body: { "phoneNumber": "+1234567890", "code": "123456" }       │
│  Response: { user: {...}, session: {...} }                      │
│                                                                 │
│  Note: If phone is not registered, a new user is created        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Session Validation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                   SESSION VALIDATION                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  For authenticated requests:                                    │
│                                                                 │
│  1. Include session cookie (automatic in browsers)              │
│     OR                                                          │
│  2. Include Authorization header:                               │
│     Authorization: Bearer <session-token>                       │
│                                                                 │
│  3. Backend validates session via Better Auth                   │
│                                                                 │
│  4. User roles are loaded from database                         │
│                                                                 │
│  5. Request proceeds with req.session attached                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Better Auth Endpoints (Handled Automatically)

These endpoints are handled by Better Auth at `/api/auth/*`:

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/sign-up/email` | Sign up with email/password |
| POST | `/api/auth/sign-in/email` | Sign in with email/password |
| POST | `/api/auth/sign-in/social` | Sign in with social provider |
| POST | `/api/auth/sign-out` | Sign out (invalidate session) |
| GET | `/api/auth/session` | Get current session |
| POST | `/api/auth/phone-number/send-otp` | Send OTP to phone |
| POST | `/api/auth/phone-number/verify` | Verify OTP and sign in |
| GET | `/api/auth/callback/:provider` | OAuth callback |

### Custom Auth Endpoints

Additional custom endpoints for the Zoomies app:

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Custom registration (assigns roles, no session) |
| POST | `/api/auth/verify-email` | Verify email with token |
| GET | `/api/auth/me` | Get current user profile |
| PATCH | `/api/auth/me` | Update current user profile |
| POST | `/api/auth/change-password` | Change password |

---

## API Request/Response Examples

### Sign Up with Email

**Request:**

```http
POST /api/auth/sign-up/email HTTP/1.1
Content-Type: application/json

{
  "email": "rider@example.com",
  "password": "SecureRider123",
  "name": "Alex Rider"
}
```

**Success Response (200):**

Notes:

- A session cookie is set on success.
- The response includes `user` and `session` objects (session token + expiry).

```json
{
  "user": {
    "id": "cm1x2y3z4a5b6c7d8e9f0",
    "email": "rider@example.com",
    "name": "Alex Rider",
    "emailVerified": false,
    "image": null,
    "createdAt": "2026-02-14T10:30:00.000Z",
    "updatedAt": "2026-02-14T10:30:00.000Z"
  },
  "session": {
    "id": "sess_abc123",
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "expiresAt": "2026-03-16T10:30:00.000Z"
  }
}
```

### Sign In with Email

**Request:**

```http
POST /api/auth/sign-in/email HTTP/1.1
Content-Type: application/json

{
  "email": "rider@example.com",
  "password": "SecureRider123"
}
```

**Success Response (200):**

```json
{
  "user": {
    "id": "cm1x2y3z4a5b6c7d8e9f0",
    "email": "rider@example.com",
    "name": "Alex Rider",
    "emailVerified": true,
    "image": null
  },
  "session": {
    "id": "sess_xyz789",
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "expiresAt": "2026-03-16T10:30:00.000Z"
  }
}
```

### Send OTP (Better Auth)

**Request:**

```http
POST /api/auth/phone-number/send-otp HTTP/1.1
Content-Type: application/json

{
  "phoneNumber": "+1234567890"
}
```

**Success Response (200):**

```json
{
  "success": true
}
```

### Get Current User

**Request:**

```http
GET /api/auth/me HTTP/1.1
Authorization: Bearer <session-token>
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "user": {
      "id": "cm1x2y3z4a5b6c7d8e9f0",
      "email": "rider@example.com",
      "name": "Alex Rider",
      "image": null,
      "phone": "+1234567890",
      "phoneVerified": "2026-02-14T10:35:00.000Z",
      "emailVerified": "2026-02-14T10:32:00.000Z",
      "bio": "Weekend rider",
      "location": "San Francisco, CA",
      "roles": ["USER", "RIDER"],
      "createdAt": "2026-02-14T10:30:00.000Z",
      "updatedAt": "2026-02-14T10:45:00.000Z"
    }
  }
}
```

---

## Error Responses

All authentication errors follow a consistent format:

### Error Response Format

```json
{
  "success": false,
  "message": "Human-readable error message",
  "error": {
    "code": "ERROR_CODE",
    "details": {
      "hint": "How to fix the error"
    }
  }
}
```

### Common Error Codes

| HTTP Code | Error Code | Description |
|-----------|------------|-------------|
| 400 | `VALIDATION_ERROR` | Invalid request body |
| 400 | `INVALID_INPUT` | Invalid input data |
| 401 | `UNAUTHORIZED` | No authentication provided |
| 401 | `INVALID_CREDENTIALS` | Wrong email/password |
| 401 | `SESSION_EXPIRED` | Session has expired |
| 401 | `TOKEN_EXPIRED` | Auth token has expired |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 404 | `USER_NOT_FOUND` | User doesn't exist |
| 409 | `ALREADY_EXISTS` | Email/phone already registered |

### Example Error Responses

**Invalid Credentials (401):**

```json
{
  "success": false,
  "message": "Invalid email or password",
  "error": {
    "code": "INVALID_CREDENTIALS"
  }
}
```

**Unauthorized (401):**

```json
{
  "success": false,
  "message": "Authentication required. Please sign in.",
  "error": {
    "code": "UNAUTHORIZED",
    "details": {
      "hint": "Include session cookie or Bearer token in your request"
    }
  }
}
```

**Session Expired (401):**

```json
{
  "success": false,
  "message": "Invalid or expired session",
  "error": {
    "code": "SESSION_EXPIRED",
    "details": {
      "hint": "Please sign in again"
    }
  }
}
```

**Forbidden (403):**

```json
{
  "success": false,
  "message": "Access denied. Insufficient permissions.",
  "error": {
    "code": "FORBIDDEN",
    "details": {
      "required": ["ADMIN", "SUPER_ADMIN"],
      "current": ["USER"]
    }
  }
}
```

**User Already Exists (409):**

```json
{
  "success": false,
  "message": "User with this email already exists",
  "error": {
    "code": "ALREADY_EXISTS"
  }
}
```

---

## Client Integration

### React/Next.js Client

Install the Better Auth client:

```bash
npm install better-auth
```

Create auth client:

```typescript
// lib/auth-client.ts
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000",
});

export const { signIn, signUp, signOut, useSession } = authClient;
```

Usage in components:

```tsx
// Sign in
const { data, error } = await authClient.signIn.email({
  email: "user@example.com",
  password: "password123",
});

// Sign up
const { data, error } = await authClient.signUp.email({
  email: "newuser@example.com",
  password: "SecurePass123",
  name: "New User",
});

// Get session (React hook)
const { data: session, isPending } = useSession();

// Sign out
await authClient.signOut();
```

### Mobile (React Native)

```typescript
// services/auth.ts
const API_URL = "http://your-backend-url:5000";

// Sign in with email
export async function signInWithEmail(email: string, password: string) {
  const response = await fetch(`${API_URL}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    credentials: "include",
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Sign in failed");
  }
  
  return response.json();
}

// Send OTP
export async function sendOTP(phone: string) {
  const response = await fetch(`${API_URL}/api/auth/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });
  
  return response.json();
}

// Verify OTP and sign in
export async function verifyOTPAndSignIn(phone: string, code: string) {
  const response = await fetch(`${API_URL}/api/auth/phone-number/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumber: phone, code }),
    credentials: "include",
  });
  
  return response.json();
}
```

---

## Role-Based Access Control

### Available Roles

| Role | Description | Access |
|------|-------------|--------|
| `USER` | Default role for all users | Mobile app |
| `RIDER` | Active motorcycle rider | Mobile app |
| `SELLER` | Marketplace seller | Web + Mobile |
| `CLUB_OWNER` | Club creator/manager | Web + Mobile |
| `ADMIN` | System administrator | Web only |
| `SUPER_ADMIN` | Full platform access | Web only |

### Web Portal Access

Only these roles can access the web portal dashboard:

- `SUPER_ADMIN`
- `ADMIN`
- `CLUB_OWNER`
- `SELLER`

### Protecting Routes

Backend middleware:

```typescript
import { requireAuth, requireRoles, UserRole } from "./config/auth.js";

// Require any authenticated user
router.get("/profile", requireAuth, handler);

// Require specific roles
router.get(
  "/admin/users",
  requireAuth,
  requireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  handler
);
```

---

## Testing Authentication

### Using cURL

**Sign up:**

```bash
curl -X POST http://localhost:5000/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234","name":"Test User"}' \
  -c cookies.txt
```

**Sign in:**

```bash
curl -X POST http://localhost:5000/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234"}' \
  -c cookies.txt
```

**Get session:**

```bash
curl http://localhost:5000/api/auth/session -b cookies.txt
```

**Get current user:**

```bash
curl http://localhost:5000/api/auth/me -b cookies.txt
```

**Sign out:**

```bash
curl -X POST http://localhost:5000/api/auth/sign-out -b cookies.txt
```

### Using Postman/Insomnia

1. **Set Cookie Jar**: Enable cookies to persist sessions
2. **Base URL**: `http://localhost:5000`
3. **Sign In**: POST to `/api/auth/sign-in/email` with credentials
4. **Authenticated Requests**: Cookies are automatically included

---

## Database Schema

Better Auth uses these tables (managed by Prisma):

```prisma
model User {
  id            String    @id @default(cuid())
  email         String?   @unique
  emailVerified DateTime?
  name          String?
  image         String?
  phone         String?   @unique
  phoneVerified DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  accounts  Account[]
  sessions  Session[]
  userRoles UserRoleAssignment[]
}

model Account {
  id                    String   @id @default(cuid())
  userId                String
  accountId             String   // Provider's account ID
  providerId            String   // "credential", "google", "phone"
  password              String?  // For credential accounts
  accessToken           String?
  refreshToken          String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  
  user User @relation(fields: [userId], references: [id])
  @@unique([providerId, accountId])
}

model Session {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String
  expiresAt DateTime
  ipAddress String?
  userAgent String?
  
  user User @relation(fields: [userId], references: [id])
}

model Verification {
  id         String   @id @default(cuid())
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
}
```

### Why there are User and Account tables

Better Auth separates **user identity** from **login methods**:

- **User** stores profile data that belongs to the person (name, email, phone, avatar).
- **Account** stores provider-specific credentials and identifiers (Google, email/password, phone OTP).
- One user can have multiple accounts (e.g., email/password + Google OAuth) without duplicating user profiles.

This design keeps provider details isolated while allowing a single user profile to link to multiple sign-in methods.

---

## Troubleshooting

### Common Issues

**1. Cookies not being set**

- Check CORS configuration includes `credentials: true`
- Ensure `trustedOrigins` in auth config includes your frontend URL
- For cross-origin requests, use `SameSite=None; Secure` cookies

**2. Session not persisting**

- Verify cookies are enabled in the browser/client
- Check that the session hasn't expired
- Ensure the `BETTER_AUTH_SECRET` is consistent across restarts

**3. Phone OTP not sending**

- Check Twilio credentials are set correctly
- In development, OTP is logged to console instead of sent
- Verify phone number format (E.164: +1234567890)

---

## Further Reading

- [Better Auth Documentation](https://www.better-auth.com/docs)
- [Better Auth Express Integration](https://www.better-auth.com/docs/integrations/express)
- [Better Auth Plugins](https://www.better-auth.com/docs/plugins)
