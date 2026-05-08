import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { prisma } from "@/lib/adapters/prisma";
import { dailyTokenBudgetPerUser } from "@/lib/adapters/openrouter";
import { tokensUsedTodayForUser } from "@/lib/services/stylist";
import {
  generateCleanProductImage,
  PieceImageGenError,
} from "@/lib/services/piece-image-gen";

// POST /api/closet/generate-image
//
// Sibling endpoint to /api/closet/analyze. Splitting them lets the
// AutoTagAnalyzer fire both in parallel and surface tag analysis
// (~3-5s) the moment it returns while the slower image gen
// (~10-15s) keeps a separate "polishing image…" loading state
// over the photo. Continue stays disabled until both finish so
// the user can't accidentally save with the original photo
// while the clean-product version is still rendering.
//
// Same auth + onboarded gate + daily token budget as the analyze
// route. On any model / upload failure we return a non-200 + the
// client falls back to the original photo (graceful degradation).

export const runtime = "nodejs";

const requestSchema = z.object({
  publicId: z
    .string()
    .min(1)
    .max(256)
    .regex(/^[a-zA-Z0-9_\-./]+$/, "Invalid Cloudinary publicId"),
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

  const used = await tokensUsedTodayForUser(dbUser.id);
  const limit = dailyTokenBudgetPerUser();
  if (used >= limit) {
    return Response.json(
      { error: "BUDGET_EXCEEDED", used, limit },
      { status: 429 },
    );
  }

  try {
    const result = await generateCleanProductImage({
      userId: dbUser.id,
      sourcePublicId: parsed.data.publicId,
    });

    // Token bookkeeping — same placeholder ChatMessage trick the
    // sibling routes use so tokensUsedTodayForUser sums one ceiling
    // across stylist + scoring + analyzer + image gen.
    await prisma.chatSession
      .create({
        data: {
          userId: dbUser.id,
          messages: {
            create: [
              {
                role: "ASSISTANT",
                content: "[image gen]",
                tokensUsed: result.tokensUsed,
              },
            ],
          },
        },
      })
      .catch(() => {});

    return Response.json({
      generatedImage: { publicId: result.publicId, url: result.url },
      tokensUsed: result.tokensUsed,
    });
  } catch (err) {
    if (err instanceof PieceImageGenError) {
      return Response.json(
        { error: err.code, message: err.message },
        { status: 502 },
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
