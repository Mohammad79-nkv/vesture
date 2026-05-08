"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
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

// Phase 3E.3 · frame 01 (Sparse closet, 1-9 pieces).
// Shows 1 primary outfit + an unlock progress bar pushing the user
// to add more pieces. The progress bar fills as a fraction of
// piecesCount / SPARSE_TARGET (10). Tips below give an
// AI-generated nudge if the model returned a why on the primary
// outfit.

const SPARSE_TARGET = 10;

export function SparseToday({
  recommendations,
  pieces,
  weather,
  piecesCount,
}: {
  recommendations: TodayRecommendationsPayload;
  pieces: TodayPiece[];
  weather: {
    tempC: number;
    condition: WeatherCondition;
  } | null;
  piecesCount: number;
}) {
  const t = useTranslations("today");
  const tSparse = useTranslations("today.sparse");

  const pieceMap = useMemo(
    () => new Map(pieces.map((p) => [p.id, p])),
    [pieces],
  );

  // The sparse view only renders the first outfit even if the
  // recommender returned more — the design pushes for "one outfit,
  // from your N" focus. Extras are dropped (cache still keeps them).
  const hero = recommendations.outfits[0];
  const remaining = Math.max(0, SPARSE_TARGET - piecesCount);
  const progressPct = Math.min(
    100,
    Math.round((piecesCount / SPARSE_TARGET) * 100),
  );

  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-mist pb-44 text-ink">
      <TodayTopBar
        kicker={
          <TimeKicker
            piecesCount={piecesCount}
            piecesLabel={t("pieces")}
          />
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

      {/* Single outfit */}
      <div className="px-4 pt-5">
        {hero && (
          <TodayCard
            outfit={hero}
            pieces={pieceMap}
            primary
            badgeAllOwn={t("badge.allOwn")}
          />
        )}
      </div>

      {/* Unlock progress card */}
      <div className="px-4 pt-4">
        <div className="flex items-center gap-3 rounded-[18px] bg-paper p-4">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold tracking-[-0.01em] text-ink">
              {tSparse.rich("unlockTitle", {
                n: remaining,
                accent: (chunks) => (
                  <em className="not-italic font-medium text-primary">
                    {chunks}
                  </em>
                ),
              })}
            </p>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-ink/[0.06]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-primary/40"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.08em] text-ink/55">
              {tSparse("progress", {
                count: piecesCount,
                target: SPARSE_TARGET,
              })}
            </p>
          </div>
          <Link
            href="/closet/add"
            aria-label={tSparse("addAria")}
            className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[12px] bg-ink text-paper hover:bg-ink/90"
          >
            <Plus size={16} strokeWidth={2} aria-hidden="true" />
          </Link>
        </div>
      </div>

      {/* Tip line — uses the model's why if it provided one,
         otherwise a static prompt about closet variety. */}
      <div className="px-5 pt-3.5">
        <p className="flex items-center gap-2 text-[11.5px] leading-[1.5] text-ink/55">
          <span aria-hidden="true" className="text-primary">
            ✦
          </span>
          {hero?.why ?? tSparse("tipFallback")}
        </p>
      </div>
    </div>
  );
}

// Local copy of the TimeKicker used in TodayContent. We could
// extract to a shared module but the duplication is small and the
// two callers' lifetimes diverge cleanly.
function TimeKicker({
  piecesCount,
  piecesLabel,
}: {
  piecesCount: number;
  piecesLabel: string;
}) {
  const [now, setNow] = useState<Date>(() => new Date());
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

export type { TodayOutfit };
