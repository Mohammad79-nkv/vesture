"use server";

import { revalidatePath } from "next/cache";
import { redirect as redirectRaw } from "next/navigation";
import { requireOnboarded } from "@/lib/auth";
import { logOutfitWear, deleteOutfit } from "@/lib/services/outfit";

const redirect = redirectRaw as unknown as (path: string) => never;

export async function logOutfitWearAction(outfitId: string) {
  const user = await requireOnboarded();
  await logOutfitWear({ userId: user.id, outfitId });
  revalidatePath("/closet/styles");
  revalidatePath(`/closet/styles/${outfitId}`);
}

export async function deleteOutfitAction(outfitId: string) {
  const user = await requireOnboarded();
  await deleteOutfit({ userId: user.id, outfitId });
  revalidatePath("/closet/styles");
  redirect("/closet/styles");
}
