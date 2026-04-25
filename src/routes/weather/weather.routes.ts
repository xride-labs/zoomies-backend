import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "../../config/auth.js";
import { ApiResponse, ErrorCode } from "../../lib/utils/apiResponse.js";
import {
  validateQuery,
  asyncHandler,
} from "../../middlewares/validation.js";

const router = Router();
router.use(requireAuth);

const weatherQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

type WeatherSnapshot = {
  source: "openweather" | "open-meteo";
  tempC: number;
  feelsLikeC?: number;
  humidity?: number;
  windKmh?: number;
  conditions: string;
  icon?: string;
  description?: string;
  fetchedAt: string;
};

/**
 * Fetch current weather for a coordinate, used by ride planning to show
 * "rain expected on Saturday" warnings on the create/detail screens.
 *
 * If `OPENWEATHER_API_KEY` is configured, we proxy OpenWeather. Otherwise we
 * fall back to Open-Meteo, which is free and keyless — perfect for dev.
 * Either way the response shape is identical so the mobile client doesn't
 * branch.
 */
async function fetchOpenWeather(
  lat: number,
  lng: number,
  apiKey: string,
): Promise<WeatherSnapshot> {
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&units=metric&appid=${apiKey}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`OpenWeather request failed (HTTP ${response.status})`);
  }
  const json: any = await response.json();
  return {
    source: "openweather",
    tempC: Math.round(json?.main?.temp ?? 0),
    feelsLikeC: Math.round(json?.main?.feels_like ?? 0),
    humidity: json?.main?.humidity,
    windKmh: json?.wind?.speed ? Math.round(json.wind.speed * 3.6) : undefined,
    conditions: json?.weather?.[0]?.main ?? "Clear",
    description: json?.weather?.[0]?.description,
    icon: json?.weather?.[0]?.icon,
    fetchedAt: new Date().toISOString(),
  };
}

const OPEN_METEO_CODE_MAP: Record<number, string> = {
  0: "Clear",
  1: "Mostly Clear",
  2: "Partly Cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Fog",
  51: "Drizzle",
  53: "Drizzle",
  55: "Drizzle",
  61: "Rain",
  63: "Rain",
  65: "Heavy Rain",
  71: "Snow",
  73: "Snow",
  75: "Heavy Snow",
  80: "Rain Showers",
  81: "Rain Showers",
  82: "Heavy Rain",
  95: "Thunderstorm",
  96: "Thunderstorm",
  99: "Thunderstorm",
};

async function fetchOpenMeteo(
  lat: number,
  lng: number,
): Promise<WeatherSnapshot> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code` +
    `&wind_speed_unit=kmh&timezone=auto`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Open-Meteo request failed (HTTP ${response.status})`);
  }
  const json: any = await response.json();
  const c = json?.current ?? {};
  const code = typeof c.weather_code === "number" ? c.weather_code : 0;
  return {
    source: "open-meteo",
    tempC: Math.round(c.temperature_2m ?? 0),
    feelsLikeC: Math.round(c.apparent_temperature ?? 0),
    humidity: c.relative_humidity_2m,
    windKmh: c.wind_speed_10m ? Math.round(c.wind_speed_10m) : undefined,
    conditions: OPEN_METEO_CODE_MAP[code] ?? "Unknown",
    fetchedAt: new Date().toISOString(),
  };
}

router.get(
  "/",
  validateQuery(weatherQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { lat, lng } = req.query as unknown as { lat: number; lng: number };
    const apiKey = process.env.OPENWEATHER_API_KEY?.trim();

    try {
      const weather = apiKey
        ? await fetchOpenWeather(lat, lng, apiKey)
        : await fetchOpenMeteo(lat, lng);

      ApiResponse.success(res, weather);
    } catch (error) {
      console.warn("[weather] fetch failed:", error);
      ApiResponse.error(
        res,
        "Weather is temporarily unavailable for this location.",
        502,
        ErrorCode.EXTERNAL_SERVICE_ERROR,
      );
    }
  }),
);

export default router;
