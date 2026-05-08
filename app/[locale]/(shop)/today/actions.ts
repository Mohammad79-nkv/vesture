"use server";

import { revalidatePath } from "next/cache";
import { requireOnboarded } from "@/lib/auth";
import { prisma } from "@/lib/adapters/prisma";
import { createOutfit } from "@/lib/services/outfit";
import { logWear } from "@/lib/services/closet";
import {
  fetchTodayPieces,
  generateTodayRecommendations,
  timeOfDayFor,
} from "@/lib/services/today-recommender";
import {
  getCurrentWeather,
  type CurrentWeather,
} from "@/lib/adapters/weather";
import {
  todayUtc,
  type TodayOutfit,
  type TodayRecommendationsPayload,
} from "@/lib/services/today-cache";
import {
  suggestSwap,
  TodaySwapError,
  type SwapAlternative,
} from "@/lib/services/today-swap";
import {
  createScheduledOutfit,
  deleteScheduledOutfit,
} from "@/lib/services/scheduled-outfit";
import type { OutfitSlot } from "@/lib/domain/outfit-slots";
import type { TimeOfDay } from "@prisma/client";

// Phase 3E.4+6 · Today actions.
//
// Two server actions back the Why sheet's Wear / Save buttons:
//
//   - saveTodayOutfitAction snapshots a recommendation as a
//     persistent SavedOutfit (the Phase 3B model) so it shows up
//     under /closet/styles. Returns the new id so the client can
//     route the user to the saved-look detail page.
//
//   - wearTodayOutfitAction iterates the recommendation's pieces
//     and calls logWear for each one. logWear already bumps
//     wearCount + lastWornAt + closetVersion (the cache
//     invalidation key for the next /today render), so the next
//     visit will regenerate fresh combos that account for what
//     the user just wore.
//
// Both return discriminated results rather than throwing —
// matches the pattern we used in app/[locale]/(shop)/closet/
// builder/actions.ts so the client can render inline error copy
// without lighting up Next 16's dev error overlay.

export type TodayActionInput = {
  name: string;
  occasion?: string;
  pieces: Array<{ slot: OutfitSlot; pieceId: string }>;
};

export type SaveResult =
  | { ok: true; outfitId: string }
  | { ok: false; error: "needPieces" | "saveFailed" };

export async function saveTodayOutfitAction(
  input: TodayActionInput,
): Promise<SaveResult> {
  const user = await requireOnboarded();
  if (input.pieces.length === 0) {
    return { ok: false, error: "needPieces" };
  }

  try {
    const outfit = await createOutfit({
      userId: user.id,
      name: input.name.trim() || undefined,
      occasion: input.occasion?.trim() || undefined,
      pieces: input.pieces,
    });
    revalidatePath("/closet/styles");
    return { ok: true, outfitId: outfit.id };
  } catch {
    return { ok: false, error: "saveFailed" };
  }
}

export type WearResult =
  | { ok: true; piecesLogged: number }
  | { ok: false; error: "needPieces" | "wearFailed" };

export async function wearTodayOutfitAction(
  input: TodayActionInput,
): Promise<WearResult> {
  const user = await requireOnboarded();
  if (input.pieces.length === 0) {
    return { ok: false, error: "needPieces" };
  }

  try {
    // Sequential to keep transaction semantics simple — these are
    // independent updates so we don't strictly need a transaction,
    // but doing them in series means a half-failure shows a
    // partial wear log rather than spending budget on parallel
    // writes that could partially clash with closetVersion bumps.
    let logged = 0;
    for (const p of input.pieces) {
      // logWear is user-scoped; it returns null/throws if the
      // piece doesn't belong to the user. We catch per-piece so
      // one stale id doesn't fail the whole outfit.
      try {
        await logWear({ userId: user.id, pieceId: p.pieceId });
        logged += 1;
      } catch {
        // Skip and continue — pieces deleted between cache and
        // tap shouldn't block the user from logging the rest.
      }
    }

    if (logged === 0) {
      return { ok: false, error: "wearFailed" };
    }

    // Today's cache invalidates naturally via the closetVersion
    // bump inside logWear, so the next /today render
    // regenerates. No need to explicitly invalidate.
    revalidatePath("/today");
    return { ok: true, piecesLogged: logged };
  } catch {
    return { ok: false, error: "wearFailed" };
  }
}

// ──────────────────────────────────────────────────────────────
// Phase 3E.5 · Interactivity: swap, lock, refresh
// ──────────────────────────────────────────────────────────────

export type SwapSuggestionResult =
  | { ok: true; alternatives: SwapAlternative[]; suggestion: string | null }
  | { ok: false; error: "noCandidates" | "modelFailed" };

// Tap a piece in an outfit → ask the model for ranked alternatives.
// Returns the list for the SwapSheet to render. Doesn't apply the
// swap yet — that's a separate action so the user can browse.
export async function getSwapSuggestionsAction(args: {
  outfitName: string;
  outfitMood: string;
  outfitPieces: Array<{ slot: OutfitSlot; pieceId: string }>;
  slot: OutfitSlot;
  currentPieceId: string;
  locale: string;
}): Promise<SwapSuggestionResult> {
  const user = await requireOnboarded();
  const { pieces } = await fetchTodayPieces(user.id);

  try {
    const result = await suggestSwap({
      outfit: {
        name: args.outfitName,
        mood: args.outfitMood,
        pieces: args.outfitPieces,
      },
      slot: args.slot,
      currentPieceId: args.currentPieceId,
      closet: pieces,
      locale: args.locale,
    });

    // Bookkeep tokens into the same daily-budget tally other AI
    // surfaces use, so the cap stays comprehensible.
    if (result.tokensUsed > 0) {
      await prisma.chatSession
        .create({
          data: {
            userId: user.id,
            messages: {
              create: [
                {
                  role: "ASSISTANT",
                  content: "[today swap]",
                  tokensUsed: result.tokensUsed,
                },
              ],
            },
          },
        })
        .catch(() => {});
    }

    return {
      ok: true,
      alternatives: result.alternatives,
      suggestion: result.suggestion ?? null,
    };
  } catch (err) {
    if (err instanceof TodaySwapError && err.code === "NO_CANDIDATES") {
      return { ok: false, error: "noCandidates" };
    }
    return { ok: false, error: "modelFailed" };
  }
}

// Apply a chosen swap: locate the outfit by index in the cached
// row, replace the piece in the given slot. The `locked` flag
// (3E.5) is preserved.
export async function applyPieceSwapAction(args: {
  outfitIndex: number;
  slot: OutfitSlot;
  newPieceId: string;
}): Promise<
  | { ok: true; payload: TodayRecommendationsPayload }
  | { ok: false; error: "notFound" | "saveFailed" }
> {
  const user = await requireOnboarded();
  const dateUtc = todayUtc();

  const row = await prisma.todayRecommendation.findUnique({
    where: { userId_dateUtc: { userId: user.id, dateUtc } },
  });
  if (!row) {
    return { ok: false, error: "notFound" };
  }

  const payload = row.recommendations as unknown as TodayRecommendationsPayload;
  if (
    args.outfitIndex < 0 ||
    args.outfitIndex >= payload.outfits.length
  ) {
    return { ok: false, error: "notFound" };
  }

  // Verify the new piece belongs to the user before persisting —
  // applies the same exfiltration guard outfit.ts uses on save.
  const owned = await prisma.closetPiece.count({
    where: { id: args.newPieceId, userId: user.id },
  });
  if (owned === 0) {
    return { ok: false, error: "notFound" };
  }

  const outfit = payload.outfits[args.outfitIndex]!;
  const updatedPieces = outfit.pieces.map((p) =>
    p.slot === args.slot ? { ...p, pieceId: args.newPieceId } : p,
  );
  const updatedOutfit: TodayOutfit = { ...outfit, pieces: updatedPieces };

  const updatedPayload: TodayRecommendationsPayload = {
    ...payload,
    outfits: payload.outfits.map((o, i) =>
      i === args.outfitIndex ? updatedOutfit : o,
    ),
  };

  try {
    await prisma.todayRecommendation.update({
      where: { userId_dateUtc: { userId: user.id, dateUtc } },
      data: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recommendations: updatedPayload as any,
      },
    });
    revalidatePath("/today");
    return { ok: true, payload: updatedPayload };
  } catch {
    return { ok: false, error: "saveFailed" };
  }
}

// Toggle the `locked` flag on an outfit. Persisted on the cache
// row so the lock survives nav-away-and-back; refreshTodayAction
// reads it to decide what to keep verbatim.
export async function setOutfitLockAction(args: {
  outfitIndex: number;
  locked: boolean;
}): Promise<
  | { ok: true; payload: TodayRecommendationsPayload }
  | { ok: false; error: "notFound" | "saveFailed" }
> {
  const user = await requireOnboarded();
  const dateUtc = todayUtc();

  const row = await prisma.todayRecommendation.findUnique({
    where: { userId_dateUtc: { userId: user.id, dateUtc } },
  });
  if (!row) {
    return { ok: false, error: "notFound" };
  }

  const payload = row.recommendations as unknown as TodayRecommendationsPayload;
  if (
    args.outfitIndex < 0 ||
    args.outfitIndex >= payload.outfits.length
  ) {
    return { ok: false, error: "notFound" };
  }

  const updatedPayload: TodayRecommendationsPayload = {
    ...payload,
    outfits: payload.outfits.map((o, i) =>
      i === args.outfitIndex ? { ...o, locked: args.locked } : o,
    ),
  };

  try {
    await prisma.todayRecommendation.update({
      where: { userId_dateUtc: { userId: user.id, dateUtc } },
      data: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recommendations: updatedPayload as any,
      },
    });
    revalidatePath("/today");
    return { ok: true, payload: updatedPayload };
  } catch {
    return { ok: false, error: "saveFailed" };
  }
}

// Pull-to-refresh handler. Regenerates outfits with the AI but
// preserves any locked entries verbatim. We read the user's
// stored location to derive weather + time-of-day exactly the way
// the page does on a cold render.
export async function refreshTodayAction(args: {
  locale: string;
}): Promise<
  | { ok: true; payload: TodayRecommendationsPayload }
  | { ok: false; error: "noPieces" | "modelFailed" }
> {
  const user = await requireOnboarded();
  const dateUtc = todayUtc();

  const { pieces, closetVersion } = await fetchTodayPieces(user.id);
  if (pieces.length === 0) {
    return { ok: false, error: "noPieces" };
  }

  // Read existing row (for locked outfits) — may be absent if the
  // cache was wiped between visits, in which case we just generate
  // a clean batch.
  const existingRow = await prisma.todayRecommendation.findUnique({
    where: { userId_dateUtc: { userId: user.id, dateUtc } },
  });
  const existingPayload = existingRow
    ? (existingRow.recommendations as unknown as TodayRecommendationsPayload)
    : null;
  const lockedOutfits = (existingPayload?.outfits ?? []).filter(
    (o) => o.locked,
  );

  // Resolve weather. Same crude lon-based local-time estimate the
  // page uses; refresh only fires from an authenticated client so
  // the user record is always there.
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { location: true },
  });
  const rawLoc = dbUser?.location as
    | { lat?: number; lon?: number }
    | null
    | undefined;
  let weather: CurrentWeather | null = null;
  if (rawLoc && typeof rawLoc.lat === "number" && typeof rawLoc.lon === "number") {
    try {
      weather = await getCurrentWeather({ lat: rawLoc.lat, lon: rawLoc.lon });
    } catch {
      // Stay null — recommender handles a missing weather block.
    }
  }
  const lonOffsetH =
    rawLoc && typeof rawLoc.lon === "number" ? Math.round(rawLoc.lon / 15) : 0;
  const localNow = new Date(Date.now() + lonOffsetH * 60 * 60 * 1000);
  const timeOfDay = timeOfDayFor(localNow);

  let generated;
  try {
    generated = await generateTodayRecommendations({
      userId: user.id,
      pieces,
      weather,
      timeOfDay,
      locale: args.locale,
      closetVersion,
    });
  } catch {
    return { ok: false, error: "modelFailed" };
  }

  // Merge locked outfits back at their previous indices. Locked
  // entries always preserve position; the model's fresh outfits
  // fill the gaps. If the model returned more outfits than slots
  // we trim; if fewer, we leave nulls and filter them out.
  const merged: TodayOutfit[] = [];
  const generatedIter = [...generated.payload.outfits];
  const lockedByIndex = new Map<number, TodayOutfit>();
  for (const o of lockedOutfits) {
    const idx = (existingPayload?.outfits ?? []).findIndex(
      (x) => x === o || (x.locked && x.name === o.name),
    );
    if (idx >= 0) lockedByIndex.set(idx, o);
  }
  const totalSlots = Math.max(
    generated.payload.outfits.length,
    Math.max(...Array.from(lockedByIndex.keys()), -1) + 1,
  );
  for (let i = 0; i < totalSlots; i += 1) {
    const locked = lockedByIndex.get(i);
    if (locked) {
      merged.push(locked);
    } else {
      const next = generatedIter.shift();
      if (next) merged.push(next);
    }
  }

  const finalPayload: TodayRecommendationsPayload = {
    ...generated.payload,
    outfits: merged,
  };

  // generateTodayRecommendations already saved a row; if we have
  // locks to merge in, overwrite that row with the merged payload.
  if (lockedByIndex.size > 0) {
    try {
      await prisma.todayRecommendation.update({
        where: { userId_dateUtc: { userId: user.id, dateUtc } },
        data: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          recommendations: finalPayload as any,
        },
      });
    } catch {
      // Cache write failed — return the merged payload anyway so
      // the UI updates; next visit will regenerate from scratch.
    }
  }

  revalidatePath("/today");
  return { ok: true, payload: finalPayload };
}

// ──────────────────────────────────────────────────────────────
// Phase 3E.7 · Schedule outfit to calendar
// ──────────────────────────────────────────────────────────────

export type ScheduleResult =
  | { ok: true; scheduledOutfitId: string }
  | { ok: false; error: "needPieces" | "scheduleFailed" };

export async function scheduleOutfitAction(args: {
  scheduledFor: string; // ISO date — pulled from the calendar grid cell
  timeOfDay: TimeOfDay;
  pieces: Array<{ slot: OutfitSlot; pieceId: string }>;
  name?: string;
  occasion?: string;
  savedOutfitId?: string;
}): Promise<ScheduleResult> {
  const user = await requireOnboarded();
  if (args.pieces.length === 0) {
    return { ok: false, error: "needPieces" };
  }

  try {
    const created = await createScheduledOutfit({
      userId: user.id,
      scheduledFor: args.scheduledFor,
      timeOfDay: args.timeOfDay,
      name: args.name ?? null,
      occasion: args.occasion ?? null,
      savedOutfitId: args.savedOutfitId ?? null,
      pieces: args.pieces,
    });
    revalidatePath("/today");
    revalidatePath("/calendar");
    return { ok: true, scheduledOutfitId: created.id };
  } catch {
    return { ok: false, error: "scheduleFailed" };
  }
}

export async function unscheduleOutfitAction(args: {
  scheduledOutfitId: string;
}): Promise<{ ok: true } | { ok: false; error: "deleteFailed" }> {
  const user = await requireOnboarded();
  try {
    await deleteScheduledOutfit({
      userId: user.id,
      scheduledOutfitId: args.scheduledOutfitId,
    });
    revalidatePath("/today");
    revalidatePath("/calendar");
    return { ok: true };
  } catch {
    return { ok: false, error: "deleteFailed" };
  }
}
