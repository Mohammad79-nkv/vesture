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
