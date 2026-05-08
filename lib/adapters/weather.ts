// Open-Meteo client — free, no API key, commercial-friendly.
// Docs: https://open-meteo.com/en/docs
//
// We only use the `current` block (temperature_2m, weather_code, is_day,
// apparent_temperature) for the Today page. The hourly forecast is
// available on the same endpoint if a future frame (rain timing, "later
// tonight" hint) needs it — wire it through then.
//
// `weather_code` is the WMO interpretation table; we collapse it into a
// small UI-friendly enum (`clear` / `cloudy` / `rain` / `snow` / `fog` /
// `storm`) so the UI doesn't have to memorise 30 codes.

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";

export type WeatherCondition =
  | "clear"
  | "cloudy"
  | "rain"
  | "snow"
  | "fog"
  | "storm";

export type CurrentWeather = {
  tempC: number;
  apparentTempC: number;
  isDay: boolean;
  code: number;
  condition: WeatherCondition;
  // 5°C buckets used as a TodayRecommendation cache key — encapsulated
  // here so the cache layer doesn't have to repeat the bucket math.
  tempBucket: number;
  // Timestamp the upstream API resolved this for. Surfaces in the
  // Today header eyebrow ("TUESDAY · 18:42") if needed.
  observedAt: Date;
};

// ±10° away from comfort gets you to interesting outfit territory; we
// keep buckets consistent across the UI strings + the cache key so a
// 17 → 19° drift doesn't spoil the cache, but 17 → 22° does.
export function tempBucketOf(tempC: number): number {
  return Math.floor(tempC / 5) * 5;
}

// Map WMO codes → coarse condition. Full table at
// https://open-meteo.com/en/docs (search "weather_code"). We err on
// the side of grouping into broad UI buckets; per-code subtlety
// (drizzle vs heavy rain) lives in the temperature + UI copy.
export function conditionFromCode(code: number): WeatherCondition {
  if (code === 0) return "clear";
  if (code <= 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 67) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 80 && code <= 82) return "rain";
  if (code >= 85 && code <= 86) return "snow";
  if (code >= 95) return "storm";
  return "cloudy";
}

// Validates a number lies within a sane lat/lon range. Open-Meteo
// returns 400s for absurd coords, but failing fast at the adapter
// gives the caller a clearer error.
function isValidCoord(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

export class WeatherError extends Error {
  constructor(
    public code: "INVALID_COORDS" | "UPSTREAM_FAILED" | "BAD_RESPONSE",
    message: string,
  ) {
    super(message);
    this.name = "WeatherError";
  }
}

// In-process cache so a tab refresh + the Today page render that
// follows don't double-call the API for the same coords. Keyed by
// rounded coords (3 decimal places ≈ 100m precision is plenty for
// outfit decisions). Lifetime is 10 minutes.
type CacheEntry = { data: CurrentWeather; expiresAt: number };
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

function cacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

export async function getCurrentWeather(args: {
  lat: number;
  lon: number;
}): Promise<CurrentWeather> {
  const { lat, lon } = args;
  if (!isValidCoord(lat, lon)) {
    throw new WeatherError("INVALID_COORDS", `Invalid lat/lon: ${lat},${lon}`);
  }

  const key = cacheKey(lat, lon);
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.data;
  }

  const url = new URL(OPEN_METEO_URL);
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set(
    "current",
    "temperature_2m,apparent_temperature,is_day,weather_code",
  );
  url.searchParams.set("timezone", "auto");

  let res: Response;
  try {
    res = await fetch(url, {
      // Open-Meteo doesn't require auth headers — keep this simple.
      // 8s timeout via AbortSignal so a stalled upstream doesn't
      // block the Today page render.
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Open-Meteo fetch failed";
    throw new WeatherError("UPSTREAM_FAILED", message);
  }

  if (!res.ok) {
    throw new WeatherError(
      "UPSTREAM_FAILED",
      `Open-Meteo returned ${res.status}`,
    );
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new WeatherError("BAD_RESPONSE", "Open-Meteo body wasn't JSON");
  }

  // Narrow without a full zod schema — we own this single call site, and
  // the upstream contract is well-documented. If the shape ever changes
  // the next access throws and the typed error bubbles up.
  const current = (json as { current?: Record<string, unknown> }).current;
  if (
    !current ||
    typeof current.temperature_2m !== "number" ||
    typeof current.weather_code !== "number" ||
    typeof current.is_day !== "number"
  ) {
    throw new WeatherError(
      "BAD_RESPONSE",
      "Missing required fields in Open-Meteo response",
    );
  }

  const tempC = current.temperature_2m;
  const apparent =
    typeof current.apparent_temperature === "number"
      ? current.apparent_temperature
      : tempC;
  const code = current.weather_code;

  const data: CurrentWeather = {
    tempC,
    apparentTempC: apparent,
    isDay: current.is_day === 1,
    code,
    condition: conditionFromCode(code),
    tempBucket: tempBucketOf(tempC),
    observedAt: new Date(),
  };

  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}
