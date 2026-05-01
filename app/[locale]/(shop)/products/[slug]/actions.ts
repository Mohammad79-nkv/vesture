"use server";

import { requireUser } from "@/lib/auth";
import { toggleFavorite } from "@/lib/services/favorite";

export async function toggleFavoriteAction(productId: string) {
  const user = await requireUser();
  return toggleFavorite({ userId: user.id, productId });
}
