# Zoomies Backend

A Node.js/TypeScript backend for the Zoomies application featuring:

- **Express.js** - Web framework
- **Prisma ORM** - PostgreSQL database access with type-safe queries
- **Auth.js (NextAuth)** - Authentication with multiple providers
- **MongoDB** - Additional NoSQL database support
- **Twilio** - SMS OTP verification

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (Supabase or Neon recommended)
- MongoDB database (optional)
- Twilio account (for SMS OTP)
- Google OAuth credentials

### Installation

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Set up environment variables:**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your database URLs and API keys.

3. **Generate Prisma client:**

   ```bash
   npm run prisma:generate
   ```

4. **Run database migrations:**

   ```bash
   npm run prisma:migrate
   ```

5. **Seed the database (optional):**

   ```bash
   npm run db:seed
   ```

6. **Start the development server:**

   ```bash
   npm run dev
   ```

The server will start at `http://localhost:3001`.

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auth/signin` | Auth.js sign in page |
| GET | `/auth/signout` | Sign out |
| GET | `/auth/session` | Get current session |
| GET | `/auth/providers` | List available providers |
| POST | `/api/auth/sign-up/email` | Register with email/password |
| POST | `/api/auth/sign-in/email` | Login with email/password |
| POST | `/api/auth/phone-number/send-otp` | Send OTP to phone |
| POST | `/api/auth/phone-number/verify` | Verify OTP code |
| GET | `/api/account/me` | Get current user profile |
| PATCH | `/api/account/me` | Update user profile |
| POST | `/api/account/change-password` | Change password |

### Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | List all users |
| GET | `/api/users/:id` | Get user by ID |
| PATCH | `/api/users/:id` | Update user (self or admin) |
| DELETE | `/api/users/:id` | Delete user (self or admin) |

### Rides

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rides` | List all rides |
| GET | `/api/rides/:id` | Get ride by ID |
| POST | `/api/rides` | Create a ride |
| PATCH | `/api/rides/:id` | Update a ride |
| DELETE | `/api/rides/:id` | Delete a ride |

### Clubs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/clubs` | List all clubs |
| GET | `/api/clubs/:id` | Get club by ID |
| POST | `/api/clubs` | Create a club |
| PATCH | `/api/clubs/:id` | Update a club |
| DELETE | `/api/clubs/:id` | Delete a club |

### Marketplace

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/marketplace` | List all listings |
| GET | `/api/marketplace/my-listings` | Get user's listings |
| GET | `/api/marketplace/:id` | Get listing by ID |
| POST | `/api/marketplace` | Create a listing |
| PATCH | `/api/marketplace/:id` | Update a listing |
| DELETE | `/api/marketplace/:id` | Delete a listing |

### Monitoring

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/metrics` | Prometheus scrape endpoint (Super Admin or bearer token) |

## Authentication Providers

### Google OAuth

Sign in with Google account. Configure `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` in `.env`.

### Email/Password

Traditional credentials-based authentication. Use `/api/auth/sign-up/email` to create accounts.

### Phone OTP

SMS-based authentication via Twilio:

1. Call `/api/auth/phone-number/send-otp` with phone number
2. User receives SMS with 6-digit code
3. Sign in via `/api/auth/phone-number/verify`

## Database Schema

The Prisma schema includes:

- **User** - User profiles with email, phone, password support
- **Account** - OAuth provider accounts (Auth.js)
- **Session** - User sessions (Auth.js)
- **VerificationToken** - Email/SMS verification tokens
- **Ride** - Cycling rides
- **Club** - User communities
- **MarketplaceListing** - Items for sale

## Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Run database migrations
npm run prisma:studio    # Open Prisma Studio
npm run db:seed      # Seed database with sample data
```

## Monitoring (Prometheus + Grafana)

Monitoring assets live in [monitoring/](monitoring). Start with:

```bash
docker compose -f monitoring/docker-compose.yml up -d
```

Set `METRICS_BEARER_TOKEN` in the backend and update
`monitoring/secrets/metrics_token` to the same value. Prometheus scrapes
`/api/admin/metrics` using that bearer token.

## Project Structure

```
zoomies-backend/
├── prisma/
│   ├── schema.prisma     # Database schema
│   └── seed.ts           # Database seed script
├── src/
│   ├── config/
│   │   └── auth.ts       # Auth.js configuration
│   ├── generated/
│   │   └── prisma/       # Generated Prisma client
│   ├── lib/
│   │   ├── mongodb.ts    # MongoDB connection
│   │   ├── prisma.ts     # Prisma client instance
│   │   └── twilio.ts     # Twilio SMS utilities
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   ├── club.routes.ts
│   │   ├── marketplace.routes.ts
│   │   ├── ride.routes.ts
│   │   └── user.routes.ts
│   └── server.ts         # Express app entry point
├── .env.example          # Environment template
├── package.json
├── tsconfig.json
└── README.md
```

## License

ISC
