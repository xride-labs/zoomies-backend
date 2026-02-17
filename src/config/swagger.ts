import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { Express } from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "Zoomies API",
    version: "1.0.0",
    description: `
## Zoomies Backend API Documentation

A comprehensive REST API for the Zoomies cycling community platform.

### Authentication
This API uses **Better Auth** for authentication with multiple providers:
- **Google OAuth** - Sign in with Google
- **Email/Password** - Traditional credentials

**Important:**
- \`/api/auth/sign-up/email\` and \`/api/auth/sign-in/email\` are Better Auth endpoints.
- \`/api/auth/register\` is a custom legacy-compatible endpoint that creates a user and credential account.
- Prefer Better Auth endpoints for new integrations.

### Base URL
- Development: \`http://localhost:5000\`
- Production: \`https://api.zoomies.app\`

### Authentication Flow (Recommended)
**New user (email/password)**
1. **Sign Up**: \`POST /api/auth/sign-up/email\` (Better Auth)
2. **Verify Email**: \`POST /api/auth/verify-email\` (token sent by email)
3. **Sign In**: \`POST /api/auth/sign-in/email\`
4. **Use Session**: \`GET /api/auth/session\` or \`GET /api/auth/me\`
5. **Sign Out**: \`POST /api/auth/sign-out\`

**Existing user (email/password)**
1. **Sign In**: \`POST /api/auth/sign-in/email\`
2. **Use Session**: \`GET /api/auth/session\` or \`GET /api/auth/me\`
3. **Sign Out**: \`POST /api/auth/sign-out\`

**Legacy register (if required)**
1. **Register**: \`POST /api/auth/register\`
2. **Verify Email**: \`POST /api/auth/verify-email\`
3. **Sign In**: \`POST /api/auth/sign-in/email\`
    `,
    contact: {
      name: "Zoomies Support",
      email: "support@zoomies.app",
    },
    license: {
      name: "MIT",
      url: "https://opensource.org/licenses/MIT",
    },
  },
  servers: [
    {
      url: "http://localhost:5000",
      description: "Development server",
    },
    {
      url: "https://api.zoomies.app",
      description: "Production server",
    },
  ],
  tags: [
    {
      name: "Health",
      description: "Health check endpoints",
    },
    {
      name: "Auth",
      description: "Authentication endpoints (Better Auth)",
    },
    {
      name: "Users",
      description: "User management endpoints",
    },
    {
      name: "Rides",
      description: "Ride management endpoints",
    },
    {
      name: "Clubs",
      description: "Club management endpoints",
    },
    {
      name: "Marketplace",
      description: "Marketplace listing endpoints",
    },
    {
      name: "Media",
      description: "Media upload endpoints - All images and videos are delivered via Cloudinary",
    },
    {
      name: "Admin",
      description: "Admin management endpoints (requires ADMIN role)",
    },
  ],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "better-auth.session-token",
        description:
          "Session cookie set by Better Auth after successful authentication",
      },
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Session token for API authentication (optional)",
      },
    },
    schemas: {
      User: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Unique identifier",
            example: "clg1234567890",
          },
          name: {
            type: "string",
            description: "User display name",
            example: "John Doe",
          },
          email: {
            type: "string",
            format: "email",
            description: "User email address",
            example: "john@example.com",
          },
          image: {
            type: "string",
            format: "uri",
            description: "Profile image URL",
            example: "https://example.com/avatar.jpg",
          },
          phone: {
            type: "string",
            description: "Phone number",
            example: "+1234567890",
          },
          bio: {
            type: "string",
            description: "User biography",
            example: "Cycling enthusiast from San Francisco",
          },
          location: {
            type: "string",
            description: "User location",
            example: "San Francisco, CA",
          },
          emailVerified: {
            type: "string",
            format: "date-time",
            description: "Email verification timestamp",
          },
          phoneVerified: {
            type: "string",
            format: "date-time",
            description: "Phone verification timestamp",
          },
          createdAt: {
            type: "string",
            format: "date-time",
            description: "Account creation timestamp",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
            description: "Last update timestamp",
          },
        },
      },
      Ride: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Unique identifier",
            example: "clg1234567890",
          },
          title: {
            type: "string",
            description: "Ride title",
            example: "Morning Coastal Ride",
          },
          description: {
            type: "string",
            description: "Ride description",
            example: "A beautiful morning ride along the coast",
          },
          startLocation: {
            type: "string",
            description: "Starting location",
            example: "San Francisco, CA",
          },
          endLocation: {
            type: "string",
            description: "Ending location",
            example: "Half Moon Bay, CA",
          },
          distance: {
            type: "number",
            description: "Distance in kilometers",
            example: 45.5,
          },
          duration: {
            type: "integer",
            description: "Duration in minutes",
            example: 120,
          },
          scheduledAt: {
            type: "string",
            format: "date-time",
            description: "Scheduled start time",
          },
          status: {
            type: "string",
            enum: ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
            description: "Ride status",
            example: "PLANNED",
          },
          creatorId: {
            type: "string",
            description: "Creator user ID",
          },
          createdAt: {
            type: "string",
            format: "date-time",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
          },
        },
      },
      Club: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Unique identifier",
            example: "clg1234567890",
          },
          name: {
            type: "string",
            description: "Club name",
            example: "Bay Area Riders",
          },
          description: {
            type: "string",
            description: "Club description",
            example: "A community for cycling enthusiasts",
          },
          image: {
            type: "string",
            format: "uri",
            description: "Club image URL",
          },
          isPublic: {
            type: "boolean",
            description: "Whether the club is public",
            example: true,
          },
          ownerId: {
            type: "string",
            description: "Owner user ID",
          },
          createdAt: {
            type: "string",
            format: "date-time",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
          },
        },
      },
      MarketplaceListing: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Unique identifier",
            example: "clg1234567890",
          },
          title: {
            type: "string",
            description: "Listing title",
            example: "Carbon Road Bike",
          },
          description: {
            type: "string",
            description: "Listing description",
            example: "Excellent condition, barely used",
          },
          price: {
            type: "number",
            description: "Price",
            example: 2500.0,
          },
          currency: {
            type: "string",
            description: "Currency code",
            example: "USD",
          },
          images: {
            type: "array",
            items: {
              type: "string",
              format: "uri",
            },
            description: "Image URLs",
          },
          category: {
            type: "string",
            description: "Listing category",
            example: "Bikes",
          },
          condition: {
            type: "string",
            description: "Item condition",
            example: "Like New",
          },
          status: {
            type: "string",
            enum: ["ACTIVE", "SOLD", "INACTIVE"],
            description: "Listing status",
            example: "ACTIVE",
          },
          sellerId: {
            type: "string",
            description: "Seller user ID",
          },
          createdAt: {
            type: "string",
            format: "date-time",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
          },
        },
      },
      Session: {
        type: "object",
        properties: {
          user: {
            type: "object",
            properties: {
              id: {
                type: "string",
              },
              name: {
                type: "string",
              },
              email: {
                type: "string",
              },
              image: {
                type: "string",
              },
            },
          },
          expires: {
            type: "string",
            format: "date-time",
          },
        },
      },
      Error: {
        type: "object",
        properties: {
          error: {
            type: "string",
            description: "Error message",
            example: "Unauthorized",
          },
          message: {
            type: "string",
            description: "Detailed error message (development only)",
          },
        },
      },
      SuccessResponse: {
        type: "object",
        properties: {
          success: {
            type: "boolean",
            example: true,
          },
          message: {
            type: "string",
            example: "Operation completed successfully",
          },
        },
      },
      PaginatedResponse: {
        type: "object",
        properties: {
          data: {
            type: "array",
            items: {},
          },
          pagination: {
            type: "object",
            properties: {
              page: {
                type: "integer",
                example: 1,
              },
              limit: {
                type: "integer",
                example: 10,
              },
              total: {
                type: "integer",
                example: 100,
              },
              totalPages: {
                type: "integer",
                example: 10,
              },
            },
          },
        },
      },
      MediaUploadResult: {
        type: "object",
        properties: {
          publicId: {
            type: "string",
            description: "Cloudinary public ID",
            example: "zoomies/profiles/profile_123",
          },
          url: {
            type: "string",
            format: "uri",
            description: "HTTP URL of the media",
          },
          secureUrl: {
            type: "string",
            format: "uri",
            description: "HTTPS URL of the media (Cloudinary CDN)",
            example: "https://res.cloudinary.com/...",
          },
          format: {
            type: "string",
            description: "File format",
            example: "jpg",
          },
          width: {
            type: "integer",
            description: "Image width in pixels",
            example: 400,
          },
          height: {
            type: "integer",
            description: "Image height in pixels",
            example: 400,
          },
          bytes: {
            type: "integer",
            description: "File size in bytes",
            example: 45678,
          },
          resourceType: {
            type: "string",
            enum: ["image", "video"],
            description: "Resource type",
          },
          thumbnailUrl: {
            type: "string",
            format: "uri",
            description: "Thumbnail URL if available",
          },
        },
      },
      UploadSignature: {
        type: "object",
        properties: {
          signature: {
            type: "string",
            description: "Cloudinary upload signature",
          },
          timestamp: {
            type: "integer",
            description: "Unix timestamp",
          },
          cloudName: {
            type: "string",
            description: "Cloudinary cloud name",
          },
          apiKey: {
            type: "string",
            description: "Cloudinary API key",
          },
        },
      },
    },
    responses: {
      Unauthorized: {
        description: "Authentication required",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Error",
            },
            example: {
              error: "Unauthorized",
            },
          },
        },
      },
      NotFound: {
        description: "Resource not found",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Error",
            },
            example: {
              error: "Not Found",
            },
          },
        },
      },
      BadRequest: {
        description: "Invalid request",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Error",
            },
            example: {
              error: "Bad Request",
              message: "Invalid input data",
            },
          },
        },
      },
      InternalError: {
        description: "Internal server error",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Error",
            },
            example: {
              error: "Internal Server Error",
            },
          },
        },
      },
    },
  },
};

const options: swaggerJsdoc.Options = {
  swaggerDefinition,
  apis: [
    path.join(__dirname, "../routes/*.ts"),
    path.join(__dirname, "../routes/*.js"),
    path.join(__dirname, "../server.ts"),
    path.join(__dirname, "../server.js"),
  ],
};

const swaggerSpec = swaggerJsdoc(options);

export function setupSwagger(app: Express): void {
  // Swagger UI
  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customCss: `
        .swagger-ui .topbar { display: none }
        .swagger-ui .info .title { color: #3b82f6 }
      `,
      customSiteTitle: "Zoomies API Documentation",
      customfavIcon: "/favicon.ico",
    }),
  );

  // Raw OpenAPI JSON spec
  app.get("/api-docs.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });

  // Redoc alternative documentation
  app.get("/redoc", (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Zoomies API Documentation - ReDoc</title>
          <meta charset="utf-8"/>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
          <style>
            body { margin: 0; padding: 0; }
          </style>
        </head>
        <body>
          <redoc spec-url='/api-docs.json' 
            expand-responses="200,201"
            hide-download-button="false"
            theme='{
              "colors": {
                "primary": { "main": "#3b82f6" }
              },
              "typography": {
                "fontSize": "15px",
                "fontFamily": "Roboto, sans-serif",
                "headings": { "fontFamily": "Montserrat, sans-serif" }
              },
              "sidebar": {
                "backgroundColor": "#fafafa"
              }
            }'
          ></redoc>
          <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
        </body>
      </html>
    `);
  });

  console.log("📚 API Documentation available at:");
  console.log("   - Swagger UI: http://localhost:3001/api-docs");
  console.log("   - ReDoc: http://localhost:3001/redoc");
  console.log("   - OpenAPI JSON: http://localhost:3001/api-docs.json");
}

export { swaggerSpec };
