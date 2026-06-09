/**
 * WEATHER ROUTES TESTS
 *
 * Covers GET /api/weather (the single endpoint), which is guarded by
 * requireAuth + validateQuery(weatherQuerySchema) and proxies an external
 * weather provider via the global `fetch`.
 *
 * The handler talks to api.openweathermap.org when OPENWEATHER_API_KEY is set,
 * otherwise falls back to api.open-meteo.com. Both providers return a different
 * JSON shape that the handler maps into a single WeatherSnapshot. We stub the
 * global fetch so the tests are deterministic and never touch the network, and
 * we drive BOTH provider branches by toggling OPENWEATHER_API_KEY.
 */

import { vi } from "vitest";
import request from "supertest";
import express from "express";
import weatherRoutes from "./weather.routes.js";
import { createTestUser, cleanupTestData } from "../../test/utils";

// NOTE: weatherRoutes is NOT mounted in src/server.ts — `/api/weather` is
// unreachable through the real app (a wiring bug worth fixing separately). To
// exercise the handler we mount the router on a standalone Express app. The
// requireAuth guard inside the router still runs against the Better Auth mock.
const app = express();
app.use(express.json());
app.use("/api/weather", weatherRoutes);

// A realistic OpenWeather "current weather" payload. The handler reads
// main.temp / main.feels_like / main.humidity / wind.speed and weather[0].
const OPENWEATHER_JSON = {
  main: { temp: 21.4, feels_like: 20.1, humidity: 55 },
  wind: { speed: 5 }, // m/s -> the handler converts to km/h (round(5 * 3.6) = 18)
  weather: [{ main: "Rain", description: "light rain", icon: "10d" }],
};

// A realistic Open-Meteo "current" payload. The handler reads json.current.*
// and maps weather_code through OPEN_METEO_CODE_MAP (61 => "Rain").
const OPEN_METEO_JSON = {
  current: {
    temperature_2m: 18.6,
    apparent_temperature: 17.2,
    relative_humidity_2m: 70,
    wind_speed_10m: 12,
    weather_code: 61,
  },
};

function mockFetchOk(json: unknown) {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => json,
  }));
}

describe("Weather Routes", () => {
  const originalKey = process.env.OPENWEATHER_API_KEY;

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    // Restore the env to its pre-test value so the provider branch doesn't leak.
    if (originalKey === undefined) {
      delete process.env.OPENWEATHER_API_KEY;
    } else {
      process.env.OPENWEATHER_API_KEY = originalKey;
    }
    await cleanupTestData();
  });

  describe("GET /api/weather", () => {
    // ── Auth ────────────────────────────────────────────────────────────────
    it("returns 401 when no auth token is provided", async () => {
      vi.stubGlobal("fetch", mockFetchOk(OPEN_METEO_JSON));

      const res = await request(app).get("/api/weather").query({
        lat: 40.7128,
        lng: -74.006,
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    // ── Validation (400) ──────────────────────────────────────────────────────
    it("returns 400 when lat/lng query params are missing", async () => {
      const { token } = await createTestUser();
      vi.stubGlobal("fetch", mockFetchOk(OPEN_METEO_JSON));

      const res = await request(app)
        .get("/api/weather")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      // fetch must never be called when validation fails.
      expect((globalThis.fetch as any).mock.calls.length).toBe(0);
    });

    it("returns 400 when lat is out of range (>90)", async () => {
      const { token } = await createTestUser();
      vi.stubGlobal("fetch", mockFetchOk(OPEN_METEO_JSON));

      const res = await request(app)
        .get("/api/weather")
        .set("Authorization", `Bearer ${token}`)
        .query({ lat: 120, lng: 10 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect((globalThis.fetch as any).mock.calls.length).toBe(0);
    });

    it("returns 400 when lng is out of range (<-180)", async () => {
      const { token } = await createTestUser();
      vi.stubGlobal("fetch", mockFetchOk(OPEN_METEO_JSON));

      const res = await request(app)
        .get("/api/weather")
        .set("Authorization", `Bearer ${token}`)
        .query({ lat: 10, lng: -200 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("returns 400 when lat is non-numeric", async () => {
      const { token } = await createTestUser();
      vi.stubGlobal("fetch", mockFetchOk(OPEN_METEO_JSON));

      const res = await request(app)
        .get("/api/weather")
        .set("Authorization", `Bearer ${token}`)
        .query({ lat: "not-a-number", lng: 10 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    // ── Happy path: Open-Meteo fallback (no API key) ─────────────────────────
    it("returns 200 with mapped Open-Meteo data when no API key is set", async () => {
      delete process.env.OPENWEATHER_API_KEY;
      const { token } = await createTestUser();
      const fetchMock = mockFetchOk(OPEN_METEO_JSON);
      vi.stubGlobal("fetch", fetchMock);

      const res = await request(app)
        .get("/api/weather")
        .set("Authorization", `Bearer ${token}`)
        .query({ lat: 40.7128, lng: -74.006 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.source).toBe("open-meteo");
      expect(res.body.data.tempC).toBe(19); // round(18.6)
      expect(res.body.data.feelsLikeC).toBe(17); // round(17.2)
      expect(res.body.data.humidity).toBe(70);
      expect(res.body.data.windKmh).toBe(12); // round(12)
      expect(res.body.data.conditions).toBe("Rain"); // code 61
      expect(typeof res.body.data.fetchedAt).toBe("string");

      // It must hit the Open-Meteo host, not OpenWeather.
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const calledUrl = fetchMock.mock.calls[0][0] as string;
      expect(calledUrl).toContain("api.open-meteo.com");
      expect(calledUrl).toContain("latitude=40.7128");
      expect(calledUrl).toContain("longitude=-74.006");
    });

    it("maps unknown Open-Meteo weather codes to 'Unknown'", async () => {
      delete process.env.OPENWEATHER_API_KEY;
      const { token } = await createTestUser();
      vi.stubGlobal(
        "fetch",
        mockFetchOk({
          current: {
            temperature_2m: 10,
            apparent_temperature: 9,
            relative_humidity_2m: 40,
            wind_speed_10m: 0,
            weather_code: 12345, // not in OPEN_METEO_CODE_MAP
          },
        }),
      );

      const res = await request(app)
        .get("/api/weather")
        .set("Authorization", `Bearer ${token}`)
        .query({ lat: 1, lng: 1 });

      expect(res.status).toBe(200);
      expect(res.body.data.conditions).toBe("Unknown");
      // wind_speed_10m of 0 is falsy -> windKmh omitted.
      expect(res.body.data.windKmh).toBeUndefined();
    });

    // ── Happy path: OpenWeather (API key set) ────────────────────────────────
    it("returns 200 with mapped OpenWeather data when API key is set", async () => {
      process.env.OPENWEATHER_API_KEY = "test-openweather-key";
      const { token } = await createTestUser();
      const fetchMock = mockFetchOk(OPENWEATHER_JSON);
      vi.stubGlobal("fetch", fetchMock);

      const res = await request(app)
        .get("/api/weather")
        .set("Authorization", `Bearer ${token}`)
        .query({ lat: 51.5, lng: -0.12 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.source).toBe("openweather");
      expect(res.body.data.tempC).toBe(21); // round(21.4)
      expect(res.body.data.feelsLikeC).toBe(20); // round(20.1)
      expect(res.body.data.humidity).toBe(55);
      expect(res.body.data.windKmh).toBe(18); // round(5 * 3.6)
      expect(res.body.data.conditions).toBe("Rain");
      expect(res.body.data.description).toBe("light rain");
      expect(res.body.data.icon).toBe("10d");

      // It must hit the OpenWeather host and include the API key.
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const calledUrl = fetchMock.mock.calls[0][0] as string;
      expect(calledUrl).toContain("api.openweathermap.org");
      expect(calledUrl).toContain("appid=test-openweather-key");
    });

    // ── Error path: upstream failure => 502 ──────────────────────────────────
    it("returns 502 when the upstream provider responds !ok", async () => {
      delete process.env.OPENWEATHER_API_KEY;
      const { token } = await createTestUser();
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
          ok: false,
          status: 503,
          json: async () => ({}),
        })),
      );

      const res = await request(app)
        .get("/api/weather")
        .set("Authorization", `Bearer ${token}`)
        .query({ lat: 10, lng: 10 });

      expect(res.status).toBe(502);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("EXTERNAL_SERVICE_ERROR");
    });

    it("returns 502 when fetch itself rejects (network error)", async () => {
      process.env.OPENWEATHER_API_KEY = "test-openweather-key";
      const { token } = await createTestUser();
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          throw new Error("ECONNREFUSED");
        }),
      );

      const res = await request(app)
        .get("/api/weather")
        .set("Authorization", `Bearer ${token}`)
        .query({ lat: 10, lng: 10 });

      expect(res.status).toBe(502);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("EXTERNAL_SERVICE_ERROR");
    });
  });
});
