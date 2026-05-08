"use server";

import { revalidatePath } from "next/cache";
import { redirect as redirectRaw } from "next/navigation";
import { requireOnboarded } from "@/lib/auth";
import {
  createOutfit,
  updateOutfit,
  type OutfitPieceInput,
} from "@/lib/services/outfit";

// next/navigation's redirect is typed against the static route map; the
// /closet/styles/[id] target is a template string. Local cast keeps the
// callers clean — same pattern used by app/[locale]/(shop)/closet/actions.ts.
const redirect = redirectRaw as unknown as (path: string) => never;

export async function createOutfitAction(input: {
  name?: string;
  occasion?: string;
  pieces: OutfitPieceInput[];
}) {
  const user = await requireOnboarded();
  if (input.pieces.length === 0) {
    throw new Error("needPieces");
  }
  const outfit = await createOutfit({
    userId: user.id,
    name: input.name?.trim() || undefined,
    occasion: input.occasion?.trim() || undefined,
    pieces: input.pieces,
  });
  revalidatePath("/closet/styles");
  redirect(`/closet/styles/${outfit.id}`);
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
