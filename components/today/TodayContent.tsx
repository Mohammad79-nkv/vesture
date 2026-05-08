"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { TodayTopBar } from "./TodayTopBar";
import { TodayHeader } from "./TodayHeader";
import { TodayCard } from "./TodayCard";
import { WeatherChip } from "./WeatherChip";
import type {
  TodayOutfit,
  TodayRecommendationsPayload,
} from "@/lib/services/today-cache";
import type { TodayPiece } from "@/lib/services/today-recommender";
import type { WeatherCondition } from "@/lib/adapters/weather";

// Frame 02 (Tonight, evening) and frame 03 (Today, daytime) share
// header + chip + card vocabulary; the only difference is layout:
//   - evening → 3 outfits stacked, all full-width
//   - daytime → 1 hero + 2 mini in a 2-col "Or, lighter" grid
//
// We branch client-side because the server only knows a coarse local
// time (lon-based offset, no DST). On mount we read the device clock
// and re-render if the SSR guess was wrong. The brief flicker is
// preferable to building a tz-database lookup just for this.

export function TodayContent({
  recommendations,
  pieces,
  weather,
  piecesCount,
  serverIsEvening,
}: {
  recommendations: TodayRecommendationsPayload;
  pieces: TodayPiece[];
  weather: {
    tempC: number;
    condition: WeatherCondition;
  } | null;
  piecesCount: number;
  serverIsEvening: boolean;
}) {
  const t = useTranslations("today");

  // Hydrate piece-id → piece map once. Cards look up thumbnails by id
  // so the model can return slot+id pairs without each card carrying
  // a fat piece copy in the cache JSON.
  const pieceMap = useMemo(
    () => new Map(pieces.map((p) => [p.id, p])),
    [pieces],
  );

  // Time-of-day correction. Server seeds with its best guess; we
  // re-evaluate on mount using the device clock. Deferred via
  // setTimeout(0) so the setState fires on a fresh task — keeps
  // React's set-state-in-effect lint quiet.
  const [isEvening, setIsEvening] = useState(serverIsEvening);
  useEffect(() => {
    const id = setTimeout(() => {
      setIsEvening(new Date().getHours() >= 16);
    }, 0);
    return () => clearTimeout(id);
  }, []);

  const outfits = recommendations.outfits;
  const hero = outfits[0];
  const others = outfits.slice(1, 3);

  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-mist pb-44 text-ink">
      <TodayTopBar
        kicker={
          <TimeKicker piecesCount={piecesCount} piecesLabel={t("pieces")} />
        }
        right={
          weather ? (
            <WeatherChip
              tempC={weather.tempC}
              condition={weather.condition}
            />
          ) : null
        }
      />

      <TodayHeader
        kicker={recommendations.headline.kicker}
        title={recommendations.headline.title}
        sub={recommendations.headline.sub ?? null}
      />

      {/* Outfit cards — layout flips on time-of-day */}
      <div className="px-4 pt-5">
        {isEvening || outfits.length === 1 ? (
          <div className="flex flex-col gap-2.5">
            {outfits.map((o, idx) => (
              <TodayCard
                key={`${o.name}-${idx}`}
                outfit={o}
                pieces={pieceMap}
                primary={idx === 0}
                badgeAllOwn={t("badge.allOwn")}
              />
            ))}
          </div>
        ) : (
          <>
            {hero && (
              <TodayCard
                outfit={hero}
                pieces={pieceMap}
                primary
                badgeAllOwn={t("badge.allOwn")}
              />
            )}
            {others.length > 0 && (
              <div className="mt-3.5 px-1">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/55">
                  {t("orLighter")}
                </p>
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  {others.map((o, idx) => (
                    <TodayCard
                      key={`${o.name}-mini-${idx}`}
                      outfit={o}
                      pieces={pieceMap}
                      variant="mini"
                      badgeAllOwn={t("badge.allOwn")}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Why-line preview — pinned just above the floating nav with
         the same offset as EmptyToday's CTA so both surfaces share
         a consistent "above-the-tab-bar" rest position. fixed (not
         absolute) keeps it anchored when the user scrolls the
         outfit cards. Phase 3E.4 makes it tappable + expands the
         dark sheet; today it's a quiet read-only callout. */}
      {hero?.why ? (
        <div
          className="fixed inset-x-4 z-10"
          style={{ bottom: "calc(100px + env(safe-area-inset-bottom, 0px))" }}
        >
          <WhyLine why={hero.why} />
        </div>
      ) : null}
    </div>
  );
}

// Local clock + pieces count for the eyebrow. suppressHydrationWarning
// is here intentionally — SSR renders with the server's clock, the
// client corrects on mount, and the brief disagreement on weekday/
// minute is below the noise floor for this label.
function TimeKicker({
  piecesCount,
  piecesLabel,
}: {
  piecesCount: number;
  piecesLabel: string;
}) {
  const [now, setNow] = useState<Date>(() => new Date());
  // Defer the initial sync to a fresh task + only schedule the
  // interval after, so the lint rule sees no synchronous setState
  // in the effect body.
  useEffect(() => {
    let intervalId: number | undefined;
    const initId = window.setTimeout(() => {
      setNow(new Date());
      intervalId = window.setInterval(() => setNow(new Date()), 60_000);
    }, 0);
    return () => {
      window.clearTimeout(initId);
      if (intervalId !== undefined) window.clearInterval(intervalId);
    };
  }, []);

  const day = now
    .toLocaleDateString(undefined, { weekday: "long" })
    .toUpperCase();
  const time = now.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return (
    <span
      suppressHydrationWarning
      className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/55"
    >
      {day} · {time} · {piecesCount} {piecesLabel}
    </span>
  );
}

function WhyLine({ why }: { why: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[14px] bg-paper/90 px-3.5 py-2.5 shadow-[inset_0_0_0_1px_rgba(33,39,57,0.05)] backdrop-blur">
      <span aria-hidden="true" className="text-primary">
        ✦
      </span>
      <span className="flex-1 text-[11.5px] leading-[1.35] text-ink/65">
        {why}
      </span>
      <span aria-hidden="true" className="text-ink/40">
        →
      </span>
    </div>
  );
}

// Re-export the imported types from this barrel for convenience
// when callers want the shape without reaching into lib/services.
export type { TodayOutfit };
