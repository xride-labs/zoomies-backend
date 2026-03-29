import express from "express";
import request from "supertest";
import { describe, it, expect } from "@jest/globals";
import { ApiResponse, ErrorCode } from "./lib/utils/apiResponse.js";
import { healthHandler } from "./routes/health.js";

describe("http contracts", () => {
  const app = express();

  app.get("/health", healthHandler);

  app.use((_req, res) => {
    ApiResponse.notFound(res, "Endpoint not found", ErrorCode.NOT_FOUND);
  });

  it("GET /health returns descriptive health contract", async () => {
    const response = await request(app).get("/health");

    expect([200, 503]).toContain(response.status);
    expect(["ok", "degraded", "down"]).toContain(response.body.status);
    expect(typeof response.body.timestamp).toBe("string");
    expect(typeof response.body.environment).toBe("string");
    expect(typeof response.body.uptimeSeconds).toBe("number");
    expect(typeof response.body.latencyMs).toBe("number");

    expect(response.body.checks).toBeDefined();
    expect(response.body.checks.postgres).toBeDefined();
    expect(["up", "down"]).toContain(response.body.checks.postgres.status);
    expect(typeof response.body.checks.postgres.latencyMs).toBe("number");

    expect(response.body.checks.mongodb).toBeDefined();
    expect(["up", "down", "not_configured"]).toContain(
      response.body.checks.mongodb.status,
    );

    if (response.body.checks.mongodb.status === "not_configured") {
      expect(response.body.checks.mongodb.latencyMs).toBeNull();
      expect(response.body.checks.mongodb.readyState).toBeNull();
    }
  });

  it("unknown routes return standard error response format", async () => {
    const response = await request(app).get("/unknown");

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });
});
