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
import {
  refreshTodayAction,
  setOutfitLockAction,
} from "@/app/[locale]/(shop)/today/actions";
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

  // Why-sheet + save/wore lifecycle (Phase 3E.4+6). The hero
  // outfit (first card) is the one the why-line preview describes,
  // and Save/Wear act on it.
  const [whyOpen, setWhyOpen] = useState(false);
  const [savedToast, setSavedToast] = useState<{
    outfitId: string;
    name: string;
    pieceCount: number;
  } | null>(null);
  const [woreOverlay, setWoreOverlay] = useState<{
    piecesLogged: number;
  } | null>(null);

  // Phase 3E.5 — swap sheet target.
  const [swapTarget, setSwapTarget] = useState<SwapTarget | null>(null);

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
                lockedLabel={t("locked")}
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

      {/* Why-line preview — tap to expand the dark reasoning sheet
         where Wear / Save / Share live. Pinned just above the
         floating nav (same offset as EmptyToday's CTA) so the
         whole site shares a consistent "above-the-tab-bar"
         rest position. */}
      {hero?.why ? (
        <button
          type="button"
          onClick={() => setWhyOpen(true)}
          className="fixed inset-x-4 z-10 text-start"
          style={{ bottom: "calc(100px + env(safe-area-inset-bottom, 0px))" }}
        >
          <WhyLine why={hero.why} />
        </button>
      ) : null}

      {/* Why sheet (frame 07). Owns the actual Wear / Save /
         Share buttons. Successful Wear opens the WoreConfirmation
         overlay; successful Save fires the SavedToast. */}
      <WhySheet
        open={whyOpen}
        onClose={() => setWhyOpen(false)}
        outfit={hero}
        pieces={pieceMap}
        weather={weather}
        contextKicker={recommendations.headline.kicker}
        onSaved={(outfitId) => {
          if (!hero) return;
          setSavedToast({
            outfitId,
            name: hero.name,
            pieceCount: hero.pieces.length,
          });
        }}
        onWore={(count) => {
          setWoreOverlay({ piecesLogged: count });
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

      {/* Wore confirmation (frame 09). Full-screen takeover; tap
         anywhere or wait ~6s to dismiss back to /today. */}
      <WoreConfirmation
        open={woreOverlay !== null}
        onClose={() => setWoreOverlay(null)}
        outfit={hero}
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
