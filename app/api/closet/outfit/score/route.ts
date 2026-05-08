import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/adapters/prisma";
import { dailyTokenBudgetPerUser } from "@/lib/adapters/openrouter";
import { tokensUsedTodayForUser } from "@/lib/services/stylist";
import { scoreOutfit, OutfitScoreError } from "@/lib/services/outfit";

// POST /api/closet/outfit/score
//
// Single-shot AI scoring for a SavedOutfit. Persists the score on the
// outfit row and returns it. Reuses the same daily token budget as the
// stylist chat (tokensUsedTodayForUser → dailyTokenBudgetPerUser).
//
// Pre-flight check is the only auth-gated control — if the user blew
// their budget chatting today, no scoring. The check is the same
// midnight-UTC bucket the chat endpoint uses, so users see one
// predictable cost ceiling, not two.

export const runtime = "nodejs";

const requestSchema = z.object({
  outfitId: z.string().min(1).max(64),
  // Locale lets the model reply in the user's language. Falls back to
  // the path locale if the client doesn't pass one.
  locale: z.enum(["en", "ar", "fa"]).optional(),
});

export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return jsonError(401, "Unauthorized");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Invalid JSON");
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, parsed.error.message);
  }

  const dbUser = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true, onboardedAt: true },
  });
  if (!dbUser) {
    return jsonError(404, "User not found");
  }
  if (!dbUser.onboardedAt) {
    return jsonError(403, "Complete onboarding first");
  }

  // Daily token budget — same UTC-day bucket the stylist chat uses, so
  // the cap is comprehensible (one budget, not two).
  const used = await tokensUsedTodayForUser(dbUser.id);
  const limit = dailyTokenBudgetPerUser();
  if (used >= limit) {
    return Response.json(
      { error: "BUDGET_EXCEEDED", used, limit },
      { status: 429 },
    );
  }

  try {
    const { score, tokensUsed } = await scoreOutfit({
      userId: dbUser.id,
      outfitId: parsed.data.outfitId,
      locale: parsed.data.locale ?? "en",
    });

    // Bookkeeping into the same column the stylist endpoint reads. We
    // stamp it on a placeholder ChatMessage so tokensUsedTodayForUser()
    // sums consistently across both surfaces — keeps the daily budget
    // honest without inventing a new tally table. The session is
    // disposable; we only need the column to live somewhere.
    await prisma.chatSession
      .create({
        data: {
          userId: dbUser.id,
          messages: {
            create: [
              {
                role: "ASSISTANT",
                content: "[outfit scoring]",
                tokensUsed,
              },
            ],
          },
        },
      })
      .catch(() => {
        // Best-effort. If the bookkeeping write fails the score still
        // landed — we just lose budget accuracy for this one call.
      });

    revalidatePath(`/closet/styles/${parsed.data.outfitId}`);
    revalidatePath("/closet/styles");

    return Response.json({ score, tokensUsed });
  } catch (err) {
    if (err instanceof OutfitScoreError) {
      const status =
        err.code === "NOT_FOUND" ? 404 : err.code === "EMPTY" ? 400 : 502;
      return Response.json(
        { error: err.code, message: err.message },
        { status },
      );
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json(
      { error: "MODEL_FAILED", message },
      { status: 502 },
    );
  }
}

function jsonError(status: number, message: string) {
  return Response.json({ error: message }, { status });
}
