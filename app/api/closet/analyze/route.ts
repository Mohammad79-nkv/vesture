import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { prisma } from "@/lib/adapters/prisma";
import { dailyTokenBudgetPerUser } from "@/lib/adapters/openrouter";
import { tokensUsedTodayForUser } from "@/lib/services/stylist";
import {
  analyzePiece,
  PieceAnalyzerError,
} from "@/lib/services/piece-analyzer";
import { generateCleanProductImage } from "@/lib/services/piece-image-gen";

// POST /api/closet/analyze
//
// One-shot vision tagging for a piece the user just uploaded. Takes a
// Cloudinary publicId, runs the photo through a vision model, returns
// structured tags (category / color / fabric / formality / season /
// name / brand) the client uses to populate the add-piece form.
//
// Same auth + budget contract as /api/closet/outfit/score: blocks if
// onboarding incomplete or daily token budget exhausted, then folds
// usage into the same UTC-day bucket the stylist + scoring share so
// the user sees one comprehensible cost ceiling.

export const runtime = "nodejs";

// Cloudinary public IDs are slash-separated paths (folder/filename).
// We allow the standard URL-safe character set and cap length to
// prevent absurd payloads.
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
    // Tag analysis + clean-product image generation run in parallel.
    // The analyzer is the must-have (its tags drive the form); the
    // image gen is best-effort and falls back to the original photo
    // on any failure (Promise.allSettled lets one fail without
    // tanking the other).
    const [analyzerResult, imageGenResult] = await Promise.allSettled([
      analyzePiece({ publicId: parsed.data.publicId }),
      generateCleanProductImage({
        userId: dbUser.id,
        sourcePublicId: parsed.data.publicId,
      }),
    ]);

    if (analyzerResult.status === "rejected") {
      // Re-throw so the existing error mapping below catches it.
      throw analyzerResult.reason;
    }
    const { piece, tokensUsed: analyzerTokens } = analyzerResult.value;

    // Image-gen failed → keep going, just hand back null so the
    // client uses the original photo as the piece's main image.
    const generatedImage =
      imageGenResult.status === "fulfilled"
        ? {
            publicId: imageGenResult.value.publicId,
            url: imageGenResult.value.url,
          }
        : null;
    const imageTokens =
      imageGenResult.status === "fulfilled"
        ? imageGenResult.value.tokensUsed
        : 0;

    // Token bookkeeping for both calls — same trick the score
    // endpoint uses: stamp the cost on placeholder ChatMessage rows
    // so tokensUsedTodayForUser sums consistently across stylist +
    // scoring + analyzer + image gen without a parallel tally
    // table. Best-effort; if the write fails the analysis still
    // succeeds and we just lose this call's budget accuracy.
    const totalTokens = analyzerTokens + imageTokens;
    await prisma.chatSession
      .create({
        data: {
          userId: dbUser.id,
          messages: {
            create: [
              {
                role: "ASSISTANT",
                content: "[piece analysis]",
                tokensUsed: totalTokens,
              },
            ],
          },
        },
      })
      .catch(() => {});

    return Response.json({
      piece,
      generatedImage,
      tokensUsed: totalTokens,
    });
  } catch (err) {
    if (err instanceof PieceAnalyzerError) {
      const status =
        err.code === "MODEL_NO_TOOL_CALL" ||
        err.code === "MODEL_BAD_JSON" ||
        err.code === "MODEL_BAD_SHAPE"
          ? 502
          : 502;
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
