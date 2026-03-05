┌─────────────────────────────────────────────────────────────┐
│                    Client (Mobile/Web)                      │
│                                                             │
│  1. Connect to Socket.io → authenticate with token          │
│  2. Join conversation rooms                                 │
│  3. Send/receive messages in real-time                      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Backend (Express + Socket.io)                  │
│                                                             │
│  - REST API for history, conversations (/api/chat)          │
│  - WebSocket for real-time messaging                        │
│  - Better Auth for authentication                           │
└─────┬──────────────┬──────────────────┬─────────────────────┘
      │              │                  │
      ▼              ▼                  ▼
┌──────────┐  ┌──────────────┐  ┌───────────────┐
│ Postgres │  │   MongoDB    │  │     Redis     │
│ (Prisma) │  │  (Mongoose)  │  │ (Pub/Sub for  │
│          │  │              │  │  scaling)     │
│ - Users  │  │ - Messages   │  │               │
│ - Rides  │  │ - Convos     │  │ - Socket.io   │
│ - Clubs  │  │ - Unreads    │  │   adapter     │
└──────────┘  └──────────────┘  └───────────────┘
