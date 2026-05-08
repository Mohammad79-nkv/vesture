"use server";

import { revalidatePath } from "next/cache";
import { redirect as redirectRaw } from "next/navigation";
import { requireOnboarded } from "@/lib/auth";
import {
  createOutfit,
  updateOutfit,
  scoreOutfit,
  type OutfitPieceInput,
} from "@/lib/services/outfit";
import { prisma } from "@/lib/adapters/prisma";
import { dailyTokenBudgetPerUser } from "@/lib/adapters/openrouter";
import { tokensUsedTodayForUser } from "@/lib/services/stylist";

// next/navigation's redirect is typed against the static route map; the
// /closet/styles/[id] target is a template string. Local cast keeps the
// callers clean — same pattern used by app/[locale]/(shop)/closet/actions.ts.
const redirect = redirectRaw as unknown as (path: string) => never;

// Result shape used by both save actions. Errors are *returned*, not
// thrown — Next 16's dev overlay surfaces every uncaught throw from a
// server action even when the client catches it, which made the
// "budgetExceeded" inline-error path look like a runtime crash. The
// success path still ends with a redirect (which throws the special
// NEXT_REDIRECT digest the framework knows how to handle).
type SaveError = { ok: false; error: "needPieces" | "budgetExceeded" };

// Note: success path ends with redirect() which throws NEXT_REDIRECT,
// so the inferred return type is `Promise<SaveError>` — clients see
// either the discriminated error union (and reach normal control flow)
// or get redirected by the framework.

export async function createOutfitAction(input: {
  name?: string;
  occasion?: string;
  pieces: OutfitPieceInput[];
}) {
  const user = await requireOnboarded();
  if (input.pieces.length === 0) {
    return { ok: false, error: "needPieces" };
  }
  const outfit = await createOutfit({
    userId: user.id,
    name: input.name?.trim() || undefined,
    occasion: input.occasion?.trim() || undefined,
    pieces: input.pieces,
  });
  revalidatePath("/closet/styles");
  return redirect(`/closet/styles/${outfit.id}`);
}

// Save + score in a single round-trip. Used by the builder's primary
// "Get AI feedback" CTA — saves the look and runs the scorer
// synchronously, then redirects to the detail page where the score is
// already persisted (no client-side score trigger needed).
//
// Budget gate runs first so a busted budget surfaces as a returned
// error instead of a half-saved outfit.
export async function saveAndScoreAction(input: {
  name?: string;
  occasion?: string;
  pieces: OutfitPieceInput[];
  locale: string;
}) {
  const user = await requireOnboarded();
  if (input.pieces.length === 0) {
    return { ok: false, error: "needPieces" } as SaveError;
  }

  const used = await tokensUsedTodayForUser(user.id);
  const limit = dailyTokenBudgetPerUser();
  if (used >= limit) {
    return { ok: false, error: "budgetExceeded" } as SaveError;
  }

  const outfit = await createOutfit({
    userId: user.id,
    name: input.name?.trim() || undefined,
    occasion: input.occasion?.trim() || undefined,
    pieces: input.pieces,
  });

  try {
    const { tokensUsed } = await scoreOutfit({
      userId: user.id,
      outfitId: outfit.id,
      locale: input.locale,
    });

    // Bookkeep into the chat-message tally so the daily budget keeps
    // working across surfaces (same pattern as the score route handler).
    await prisma.chatSession
      .create({
        data: {
          userId: user.id,
          messages: {
            create: [
              { role: "ASSISTANT", content: "[outfit scoring]", tokensUsed },
            ],
          },
        },
      })
      .catch(() => {});
  } catch {
    // Score failed — outfit is still saved; user can retry from the
    // detail page where OutfitScoreButton handles errors gracefully.
  }

  revalidatePath("/closet/styles");
  return redirect(`/closet/styles/${outfit.id}`);
}

export async function updateOutfitAction(
  outfitId: string,
  input: {
    name?: string | null;
    occasion?: string | null;
    pieces?: OutfitPieceInput[];
  },
) {
  const user = await requireOnboarded();
  await updateOutfit({
    userId: user.id,
    outfitId,
    name: input.name,
    occasion: input.occasion,
    pieces: input.pieces,
  });
  revalidatePath("/closet/styles");
  revalidatePath(`/closet/styles/${outfitId}`);
}
