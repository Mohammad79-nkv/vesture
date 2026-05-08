"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { TodayTopBar } from "./TodayTopBar";
import { TodayHeader } from "./TodayHeader";
import { TodayCard } from "./TodayCard";
import { WeatherChip } from "./WeatherChip";
import { WeatherBanner } from "./WeatherBanner";
import { LayerMeter } from "./LayerMeter";
import { WhySheet } from "./WhySheet";
import { SavedToast } from "./SavedToast";
import { WoreConfirmation } from "./WoreConfirmation";
import { SwapSheet, type SwapTarget } from "./SwapSheet";
import { PullToRefresh } from "./PullToRefresh";
import { ScheduleSheet } from "./ScheduleSheet";
import { ScheduledPill } from "./ScheduledPill";
import {
  refreshTodayAction,
  setOutfitLockAction,
} from "@/app/[locale]/(shop)/today/actions";
import type { TimeOfDay } from "@prisma/client";
import type {
  TodayOutfit,
  TodayRecommendationsPayload,
} from "@/lib/services/today-cache";
import type { TodayPiece } from "@/lib/services/today-recommender";
import type { WeatherCondition } from "@/lib/adapters/weather";
import type { OutfitSlot } from "@/lib/domain/outfit-slots";

// Frame 02 (Tonight, evening) and frame 03 (Today, daytime) share
// header + chip + card vocabulary; the only difference is layout:
//   - evening → 3 outfits stacked, all full-width
//   - daytime → 1 hero + 2 mini in a 2-col "Or, lighter" grid
//
// We branch client-side because the server only knows a coarse local
// time (lon-based offset, no DST). On mount we read the device clock
// and re-render if the SSR guess was wrong. The brief flicker is
// preferable to building a tz-database lookup just for this.

export type ScheduledForToday = {
  id: string;
  timeOfDay: TimeOfDay;
  name: string | null;
  occasion: string | null;
};

export function TodayContent({
  recommendations,
  pieces,
  weather,
  piecesCount,
  serverIsEvening,
  scheduledForToday,
  scheduledDates,
}: {
  recommendations: TodayRecommendationsPayload;
  pieces: TodayPiece[];
  weather: {
    tempC: number;
    condition: WeatherCondition;
  } | null;
  piecesCount: number;
  serverIsEvening: boolean;
  // Phase 3E.7 — schedules anchored on today (UTC) drive the
  // "On your calendar" pill; scheduledDates feeds the dot
  // indicators in the ScheduleSheet's calendar grid.
  scheduledForToday: ScheduledForToday[];
  scheduledDates: string[];
}) {
  const t = useTranslations("today");
  const tRain = useTranslations("today.rain");
  const tCold = useTranslations("today.cold");
  const locale = useLocale();

  // Weather variants — both surface UI only, the recommender already
  // baked the condition into its outfit picks.
  const isRain = weather?.condition === "rain";
  const isCold = weather !== null && weather.tempC <= 5;

  // Phase 3E.5 — local copy of the recommendations so swaps /
  // locks / refreshes can update without a full page reload. The
  // server actions return the new payload; we just setState.
  // setTimeout(0) defers the prop sync so React's set-state-in-
  // effect lint stays clean.
  const [liveRecs, setLiveRecs] = useState(recommendations);
  useEffect(() => {
    const id = setTimeout(() => setLiveRecs(recommendations), 0);
    return () => clearTimeout(id);
  }, [recommendations]);

  // Why-sheet + save/wore lifecycle (Phase 3E.4+6). Each card
  // opens its own WhySheet — we track which outfit index is
  // active so Save/Wear/Schedule act on whatever the user
  // tapped, not just the hero.
  const [whyOutfitIdx, setWhyOutfitIdx] = useState<number | null>(null);
  const [savedToast, setSavedToast] = useState<{
    outfitId: string;
    name: string;
    pieceCount: number;
  } | null>(null);
  const [woreOverlay, setWoreOverlay] = useState<{
    piecesLogged: number;
    outfitIdx: number;
  } | null>(null);

  // Phase 3E.5 — swap sheet target.
  const [swapTarget, setSwapTarget] = useState<SwapTarget | null>(null);

  // Phase 3E.7 — schedule sheet target. Tracks which outfit's
  // schedule the user is editing (matches whatever was active
  // in the WhySheet when they tapped Schedule).
  const [scheduleOutfitIdx, setScheduleOutfitIdx] = useState<number | null>(
    null,
  );
  const scheduledDateSet = useMemo(
    () => new Set(scheduledDates),
    [scheduledDates],
  );

  function makeTapPiece(outfitIndex: number, outfit: TodayOutfit) {
    return (slot: OutfitSlot, pieceId: string) => {
      setSwapTarget({
        outfitIndex,
        outfitName: outfit.name,
        outfitMood: outfit.mood,
        outfitPieces: outfit.pieces.map((p) => ({
          slot: p.slot as OutfitSlot,
          pieceId: p.pieceId,
        })),
        slot,
        currentPieceId: pieceId,
      });
    };
  }

  async function handleToggleLock(outfitIndex: number, next: boolean) {
    const res = await setOutfitLockAction({ outfitIndex, locked: next });
    if (res.ok) setLiveRecs(res.payload);
  }

  async function handleRefresh() {
    const res = await refreshTodayAction({ locale });
    if (res.ok) setLiveRecs(res.payload);
  }

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

  const outfits = liveRecs.outfits;
  const hero = outfits[0];
  const others = outfits.slice(1, 3);

  return (
   <PullToRefresh onRefresh={handleRefresh} pieceCount={piecesCount}>
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
        kicker={liveRecs.headline.kicker}
        title={liveRecs.headline.title}
        sub={liveRecs.headline.sub ?? null}
      />

      {/* "On your calendar" pill (3E.7) — visible only when the
         user has at least one ScheduledOutfit anchored on today's
         UTC bucket. */}
      <ScheduledPill scheduled={scheduledForToday} />

      {/* Weather variants — banner explains rain swaps, meter
         visualises layering on cold days. Both stay above the
         outfit cards so the user reads context before browsing
         the recommendations. */}
      {isRain && (
        <WeatherBanner
          body={liveRecs.headline.sub ?? tRain("fallbackBody")}
        />
      )}
      {isCold && !isRain && (
        <LayerMeter
          outfit={liveRecs.outfits[0]}
          caption={tCold("layersCaption")}
          labels={{
            base: tCold("layers.base"),
            mid: tCold("layers.mid"),
            outer: tCold("layers.outer"),
            acc: tCold("layers.acc"),
          }}
        />
      )}

      {/* Outfit cards — layout flips on time-of-day. Every card
         is tappable: clicking the body opens that card's own
         WhySheet. Inner buttons (piece thumbs, lock) stop
         propagation so they keep their own meanings. */}
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
                lockedLabel={t("locked")}
                onTapCard={() => setWhyOutfitIdx(idx)}
                onTapPiece={makeTapPiece(idx, o)}
                onToggleLock={(next) => handleToggleLock(idx, next)}
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
                lockedLabel={t("locked")}
                onTapCard={() => setWhyOutfitIdx(0)}
                onTapPiece={makeTapPiece(0, hero)}
                onToggleLock={(next) => handleToggleLock(0, next)}
              />
            )}
            {others.length > 0 && (
              <div className="mt-3.5 px-1">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/55">
                  {t("orLighter")}
                </p>
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  {others.map((o, idx) => {
                    const realIdx = idx + 1; // others starts at index 1
                    return (
                      <TodayCard
                        key={`${o.name}-mini-${idx}`}
                        outfit={o}
                        pieces={pieceMap}
                        variant="mini"
                        badgeAllOwn={t("badge.allOwn")}
                        onTapCard={() => setWhyOutfitIdx(realIdx)}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Why-line preview — tap to open the WhySheet for the
         hero outfit. Same affordance every card now exposes via
         body-tap; this pill is the "primary" callout pinned
         above the nav. */}
      {hero?.why ? (
        <button
          type="button"
          onClick={() => setWhyOutfitIdx(0)}
          className="fixed inset-x-4 z-10 text-start"
          style={{ bottom: "calc(100px + env(safe-area-inset-bottom, 0px))" }}
        >
          <WhyLine why={hero.why} />
        </button>
      ) : null}

      {/* Why sheet (frame 07). Renders the outfit at whichever
         index the user tapped. Save / Wear act on the same
         outfit, so the toasts read correctly even when alt
         cards are tapped. */}
      <WhySheet
        open={whyOutfitIdx !== null}
        onClose={() => setWhyOutfitIdx(null)}
        outfit={
          whyOutfitIdx !== null ? outfits[whyOutfitIdx] : undefined
        }
        pieces={pieceMap}
        weather={weather}
        contextKicker={liveRecs.headline.kicker}
        onSaved={(outfitId) => {
          const o =
            whyOutfitIdx !== null ? outfits[whyOutfitIdx] : undefined;
          if (!o) return;
          setSavedToast({
            outfitId,
            name: o.name,
            pieceCount: o.pieces.length,
          });
        }}
        onWore={(count) => {
          if (whyOutfitIdx === null) return;
          setWoreOverlay({ piecesLogged: count, outfitIdx: whyOutfitIdx });
        }}
        onSchedule={() => {
          if (whyOutfitIdx === null) return;
          setScheduleOutfitIdx(whyOutfitIdx);
        }}
      />

      {/* Saved toast (frame 08). Auto-dismisses ~3.5s after save. */}
      {savedToast ? (
        <SavedToast
          outfitId={savedToast.outfitId}
          outfitName={savedToast.name}
          pieceCount={savedToast.pieceCount}
          onDismiss={() => setSavedToast(null)}
        />
      ) : null}

      {/* Wore confirmation (frame 09). Renders the outfit the
         user actually wore (whichever card they tapped), not
         always the hero. */}
      <WoreConfirmation
        open={woreOverlay !== null}
        onClose={() => setWoreOverlay(null)}
        outfit={
          woreOverlay !== null ? outfits[woreOverlay.outfitIdx] : undefined
        }
        pieces={pieceMap}
        piecesLogged={woreOverlay?.piecesLogged ?? 0}
      />

      {/* Swap sheet (frame 04). Mounted at the page level so it
         lives outside any single card's stacking context. */}
      <SwapSheet
        open={swapTarget !== null}
        target={swapTarget}
        pieces={pieceMap}
        onClose={() => setSwapTarget(null)}
        onApplied={(payload) => setLiveRecs(payload)}
      />

      {/* Schedule sheet (frame 10). Acts on the outfit that was
         in the WhySheet when the user tapped Schedule. */}
      <ScheduleSheet
        open={scheduleOutfitIdx !== null}
        onClose={() => setScheduleOutfitIdx(null)}
        outfit={
          scheduleOutfitIdx !== null
            ? outfits[scheduleOutfitIdx]
            : undefined
        }
        pieces={pieceMap}
        existingDates={scheduledDateSet}
        onScheduled={() => {
          // No client-side toast yet — server action revalidates
          // /today + /calendar so the pill repaints on next nav.
          setScheduleOutfitIdx(null);
        }}
      />
    </div>
   </PullToRefresh>
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
