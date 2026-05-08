"use server";

import { revalidatePath } from "next/cache";
import { requireOnboarded } from "@/lib/auth";
import { createOutfit } from "@/lib/services/outfit";
import { logWear } from "@/lib/services/closet";
import type { OutfitSlot } from "@/lib/domain/outfit-slots";

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
