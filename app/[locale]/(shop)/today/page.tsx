import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { isLocale } from "@/lib/i18n/config";
import { requireOnboarded } from "@/lib/auth";
import {
  fetchTodayPieces,
  getOrGenerateTodayRecommendations,
  timeOfDayFor,
} from "@/lib/services/today-recommender";
import {
  getCurrentWeather,
  type CurrentWeather,
} from "@/lib/adapters/weather";
import { EmptyToday } from "@/components/today/EmptyToday";
import { SparseToday } from "@/components/today/SparseToday";
import { TodayContent } from "@/components/today/TodayContent";
import { LocationResolver } from "@/components/today/LocationResolver";
import {
  listScheduledForToday,
  listScheduledRange,
} from "@/lib/services/scheduled-outfit";
import type { UserLocation } from "@/lib/hooks/use-user-location";

// Threshold below which we render the sparse variant (frame 01)
// instead of the healthy 3-card layout. Matches the design's
// "5 / 10 PIECES" progress bar.
const SPARSE_THRESHOLD = 10;

// Phase 3E.2 · /today page.
//
// Render branches:
//   1. closet === 0 pieces → frame 00 (EmptyToday). No AI calls.
//   2. closet ≥ 1 piece → frame 02 / 03 via TodayContent.
//
// Weather + time-of-day are best-effort. We use a crude longitude-
// based offset to estimate the user's local time server-side; the
// client re-evaluates on mount and corrects the layout if the SSR
// guess was wrong. The headline copy stays whatever the model
// generated against the server-side guess — minor drift is OK.
//
// If the user denies location, we still render the page; the weather
// chip just hides and the cache key uses tempBucket=-1.

type StoredLocation = {
  lat: number;
  lon: number;
  label?: string | null;
  source?: string;
} | null;

function readStoredLocation(raw: unknown): StoredLocation {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.lat !== "number" || typeof r.lon !== "number") return null;
  return {
    lat: r.lat,
    lon: r.lon,
    label: typeof r.label === "string" ? r.label : null,
    source: typeof r.source === "string" ? r.source : "geolocation",
  };
}

// Crude server-side timezone estimate. lon/15 gives the offset in
// hours, accurate to ±1h for most longitudes (DST, half-hour zones,
// and the international dateline aside). The client corrects on
// mount; this exists so the SSR layout isn't wildly off for users
// outside UTC.
function localHourFromLon(lon: number | null): Date {
  const offsetH = lon === null ? 0 : Math.round(lon / 15);
  return new Date(Date.now() + offsetH * 60 * 60 * 1000);
}

export default async function TodayPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const user = await requireOnboarded();
  const t = await getTranslations("today");

  // Snapshot the closet once + reuse for both the recommender call
  // and the cards' piece-thumbnail lookup.
  const { pieces, closetVersion } = await fetchTodayPieces(user.id);

  // Resolve the stored location early — same value seeds the
  // LocationResolver as `initial` (so subsequent visits don't
  // re-prompt) and drives the page's weather + tz fallback.
  const location = readStoredLocation(user.location);
  const userLocationInitial: UserLocation | null = location
    ? {
        lat: location.lat,
        lon: location.lon,
        label: location.label ?? null,
        source:
          location.source === "ip" || location.source === "manual"
            ? location.source
            : "geolocation",
      }
    : null;

  if (pieces.length === 0) {
    return (
      <>
        <LocationResolver initial={userLocationInitial} />
        <EmptyToday kicker={t("kickerEmpty")} />
      </>
    );
  }

  let weather: CurrentWeather | null = null;
  if (location) {
    try {
      weather = await getCurrentWeather({
        lat: location.lat,
        lon: location.lon,
      });
    } catch {
      // Open-Meteo down or the coords were nonsense — render
      // without a weather chip, recs still work.
    }
  }
  // Once weather is known the location was already declared above.


  const localNow = localHourFromLon(location?.lon ?? null);
  const timeOfDay = timeOfDayFor(localNow);
  const serverIsEvening = timeOfDay === "evening";

  // Recommendations. On first render this hits the model; subsequent
  // visits same-day with the same closetVersion + tempBucket are cache
  // hits. If the model fails we fall through to a graceful empty
  // state so a transient OpenRouter blip doesn't blank the page.
  let recommendations;
  try {
    const result = await getOrGenerateTodayRecommendations({
      userId: user.id,
      pieces,
      closetVersion,
      weather,
      timeOfDay,
      locale,
    });
    recommendations = result.payload;
  } catch {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-mist px-6 text-center text-ink">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/55">
          {t("errors.kicker")}
        </p>
        <p className="mt-3 max-w-[320px] text-[14px] leading-[1.4] text-ink/70">
          {t("errors.body")}
        </p>
      </main>
    );
  }

  // Sparse variant (frame 01) — closet has 1-9 pieces. Renders a
  // single hero outfit + an unlock progress bar pushing toward the
  // healthy 10-piece threshold. The recommender's full output is
  // still cached; the UI just trims to the first card.
  if (pieces.length < SPARSE_THRESHOLD) {
    return (
      <>
        <LocationResolver initial={userLocationInitial} />
        <SparseToday
          recommendations={recommendations}
          pieces={pieces}
          weather={
            weather
              ? { tempC: weather.tempC, condition: weather.condition }
              : null
          }
          locationLabel={location?.label ?? null}
          piecesCount={pieces.length}
        />
      </>
    );
  }

  // Phase 3E.7 — pull the user's schedules for today + the next
  // 14 days (the same window the schedule sheet displays). Cheap
  // queries; user typically has only a handful of rows.
  const [scheduledToday, upcomingScheduled] = await Promise.all([
    listScheduledForToday(user.id),
    listScheduledRange({ userId: user.id, rangeDays: 14 }),
  ]);
  const scheduledDates = upcomingScheduled.map((s) =>
    s.scheduledFor.toISOString().slice(0, 10),
  );
  const scheduledForToday = scheduledToday.map((s) => ({
    id: s.id,
    timeOfDay: s.timeOfDay,
    name: s.name,
    occasion: s.occasion,
  }));

  return (
    <>
      <LocationResolver initial={userLocationInitial} />
      <TodayContent
        recommendations={recommendations}
        pieces={pieces}
        weather={
          weather
            ? { tempC: weather.tempC, condition: weather.condition }
            : null
        }
        locationLabel={location?.label ?? null}
        piecesCount={pieces.length}
        serverIsEvening={serverIsEvening}
        scheduledForToday={scheduledForToday}
        scheduledDates={scheduledDates}
      />
    </>
  );
}
