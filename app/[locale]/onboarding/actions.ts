"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/adapters/prisma";
import { STYLE_TAGS } from "@/lib/domain/styleTags";

const tasteSchema = z.object({
  styleTags: z
    .array(z.enum(STYLE_TAGS))
    .min(2, "Pick at least 2 styles")
    .max(STYLE_TAGS.length),
});

export async function saveTasteAction(input: { styleTags: string[] }) {
  const user = await requireUser();
  const parsed = tasteSchema.parse(input);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      styleTags: parsed.styleTags,
      onboardedAt: new Date(),
    },
  });

  revalidatePath("/me");
  // After taste, drop the user on Discover. The intended destination they
  // came from (closet/me/stylist) will be one tap away in the bottom nav.
  redirect("/products");
}

// "Skip for now" — stamps onboardedAt so requireOnboarded() releases the
// gate without recording any style picks. Users can revisit /onboarding/taste
// later from /me if we add an entry point there.
export async function skipTasteAction() {
  const user = await requireUser();
  if (!user.onboardedAt) {
    await prisma.user.update({
      where: { id: user.id },
      data: { onboardedAt: new Date() },
    });
  }
  revalidatePath("/me");
  redirect("/products");
}
